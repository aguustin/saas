import {
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common'
import { SyncRepository } from './sync.repository'
import {
  SYNCABLE_TABLES,
  TABLE_META,
  SalePayloadSchema,
  CustomerPayloadSchema,
  type PullRequestDto,
  type PushRequestDto,
  type PullResponse,
  type PushResponse,
  type PushResult,
  type SyncStatusResponse,
  type SyncableTable,
  type PushChange,
} from './dto/sync.dto'

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name)

  constructor(private readonly repo: SyncRepository) {}

  // ─── Pull ──────────────────────────────────────────────────────────────────

  async pull(tenantId: string, userId: string, dto: PullRequestDto): Promise<PullResponse> {
    const tablesToPull = dto.tables ?? ([...SYNCABLE_TABLES] as SyncableTable[])
    const response: PullResponse = { tables: {}, pulled_at: new Date().toISOString() }

    await Promise.all(
      tablesToPull.map(async (table) => {
        const cursor  = dto.cursors[table] ?? 0
        const { rows, maxVersion, hasMore } = await this.repo.pullTable(
          tenantId, table, cursor, dto.page_size,
        )

        response.tables[table] = { rows, cursor: maxVersion, has_more: hasMore }

        // Persist cursor so server knows what the device has
        if (rows.length > 0) {
          await this.repo.upsertCursor(tenantId, dto.device_id, table, maxVersion)
        }
      })
    )

    this.logger.debug(
      { tenantId, deviceId: dto.device_id, tables: tablesToPull.length },
      'Pull completed'
    )

    return response
  }

  // ─── Push ──────────────────────────────────────────────────────────────────

  async push(tenantId: string, userId: string, dto: PushRequestDto): Promise<PushResponse> {
    const results: PushResult[] = []

    for (const change of dto.changes) {
      const result = await this.applyChange(tenantId, userId, dto.device_id, change)
      results.push(result)
    }

    const applied   = results.filter(r => r.status === 'applied').length
    const skipped   = results.filter(r => r.status === 'skipped').length
    const conflicts = results.filter(r => r.status === 'conflict').length

    this.logger.log(
      { tenantId, deviceId: dto.device_id, applied, skipped, conflicts },
      'Push processed'
    )

    return { results, applied, skipped, conflicts, server_time: new Date().toISOString() }
  }

  private async applyChange(
    tenantId: string,
    userId:   string,
    deviceId: string,
    change:   PushChange,
  ): Promise<PushResult> {
    const meta = TABLE_META[change.table]

    if (!meta.pushAllowed) {
      return {
        sync_id: change.sync_id,
        table:   change.table,
        status:  'error',
        error:   `Table '${change.table}' does not allow client pushes`,
      }
    }

    if (!meta.allowedOps.includes(change.operation as any)) {
      return {
        sync_id: change.sync_id,
        table:   change.table,
        status:  'error',
        error:   `Operation '${change.operation}' not allowed on table '${change.table}'`,
      }
    }

    try {
      if (change.table === 'sales') {
        return await this.applySaleChange(tenantId, userId, deviceId, change)
      }
      if (change.table === 'customers') {
        return await this.applyCustomerChange(tenantId, userId, deviceId, change)
      }

      return { sync_id: change.sync_id, table: change.table, status: 'error', error: 'Unhandled table' }
    } catch (err: any) {
      this.logger.error(
        { tenantId, deviceId, syncId: change.sync_id, table: change.table },
        `Push error: ${err.message}`
      )
      return {
        sync_id: change.sync_id,
        table:   change.table,
        status:  'error',
        error:   err.message ?? 'Internal error',
      }
    }
  }

  // ─── Sale handler ──────────────────────────────────────────────────────────

  private async applySaleChange(
    tenantId: string,
    userId:   string,
    deviceId: string,
    change:   PushChange,
  ): Promise<PushResult> {
    const parsed = SalePayloadSchema.safeParse(change.payload)
    if (!parsed.success) {
      return {
        sync_id: change.sync_id,
        table:   'sales',
        status:  'error',
        error:   parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; '),
      }
    }

    const { saleId, isNew, shortfalls } = await this.repo.applyOfflineSale({
      tenantId,
      syncId:   change.sync_id,
      payload:  parsed.data,
      deviceId,
      userId,
    })

    if (!isNew) {
      return { sync_id: change.sync_id, table: 'sales', status: 'skipped', server_id: saleId }
    }

    if (shortfalls.length > 0) {
      this.logger.warn(
        { tenantId, saleId, shortfalls },
        'Offline sale applied with stock shortfalls'
      )
      return {
        sync_id:   change.sync_id,
        table:     'sales',
        status:    'conflict',
        server_id: saleId,
        conflict: {
          reason:     'Stock insufficient for some items at time of sync; sale recorded, stock clamped to 0',
          server_row: { id: saleId, shortfalls },
        },
      }
    }

    return { sync_id: change.sync_id, table: 'sales', status: 'applied', server_id: saleId }
  }

  // ─── Customer handler ──────────────────────────────────────────────────────

  private async applyCustomerChange(
    tenantId: string,
    userId:   string,
    deviceId: string,
    change:   PushChange,
  ): Promise<PushResult> {
    if (change.operation === 'DELETE') {
      const { id, skipped } = await this.repo.applyCustomerDelete(
        tenantId, change.sync_id, deviceId, userId
      )
      return {
        sync_id:   change.sync_id,
        table:     'customers',
        status:    skipped ? 'skipped' : 'applied',
        server_id: id ?? undefined,
      }
    }

    const parsed = CustomerPayloadSchema.safeParse(change.payload)
    if (!parsed.success) {
      return {
        sync_id: change.sync_id,
        table:   'customers',
        status:  'error',
        error:   parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; '),
      }
    }

    if (change.operation === 'INSERT') {
      const { id, syncVersion, isNew } = await this.repo.applyCustomerInsert(
        tenantId, change.sync_id, parsed.data, deviceId, userId
      )
      return {
        sync_id:   change.sync_id,
        table:     'customers',
        status:    isNew ? 'applied' : 'skipped',
        server_id: id,
      }
    }

    // UPDATE
    const { id, conflict, serverRow } = await this.repo.applyCustomerUpdate(
      tenantId, change.sync_id, parsed.data, change.base_version, deviceId, userId
    )

    if (conflict) {
      return {
        sync_id:   change.sync_id,
        table:     'customers',
        status:    'conflict',
        server_id: id,
        conflict: {
          reason:     'Row was modified on server after your last pull',
          server_row: serverRow ?? {},
        },
      }
    }

    return { sync_id: change.sync_id, table: 'customers', status: 'applied', server_id: id }
  }

  // ─── Status ────────────────────────────────────────────────────────────────

  async getStatus(
    tenantId: string,
    deviceId: string,
  ): Promise<SyncStatusResponse> {
    const [cursors, serverHeads] = await Promise.all([
      this.repo.getCursors(tenantId, deviceId),
      this.repo.getAllHeads(tenantId),
    ])

    const behind: Record<string, number> = {}
    for (const [table, head] of Object.entries(serverHeads)) {
      const cursor  = cursors[table] ?? 0
      const delta   = head - cursor
      if (delta > 0) behind[table] = delta
    }

    return { device_id: deviceId, cursors, server_heads: serverHeads, behind }
  }
}
