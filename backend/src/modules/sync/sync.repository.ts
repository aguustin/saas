import { Injectable, BadRequestException, Logger } from '@nestjs/common'
import { PrismaTenantService } from '@database/prisma-tenant.service'
import {
  SYNCABLE_TABLES,
  TABLE_META,
  type SyncableTable,
  type SalePayload,
  type CustomerPayload,
} from './dto/sync.dto'

@Injectable()
export class SyncRepository {
  private readonly logger = new Logger(SyncRepository.name)

  constructor(private readonly prisma: PrismaTenantService) {}

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private getSchema(tenantId: string): string {
    // UUID validation is done inside tenantSchema()
    return this.prisma.tenantSchema(tenantId).replace(/"/g, '')
  }

  private assertTable(name: string): SyncableTable {
    if (!SYNCABLE_TABLES.includes(name as SyncableTable)) {
      throw new BadRequestException(`Table '${name}' is not syncable`)
    }
    return name as SyncableTable
  }

  // ─── Pull ─────────────────────────────────────────────────────────────────

  /**
   * Fetch rows from a table where sync_version > afterVersion.
   * Returns page_size + 1 rows to detect has_more; caller must slice.
   * Both schema and tableName are validated before use in the query.
   */
  async pullTable(
    tenantId:     string,
    tableName:    SyncableTable,
    afterVersion: number,
    pageSize:     number,
  ): Promise<{ rows: Record<string, unknown>[]; maxVersion: number; hasMore: boolean }> {
    const schema = this.getSchema(tenantId)
    const table  = this.assertTable(tableName)

    // row_to_json returns a json type; Prisma materializes it as a plain object.
    // sync_version::int avoids BigInt in Node (values will never exceed MAX_SAFE_INT).
    const rows = await this.prisma.$queryRawUnsafe<Array<{
      row_data:     Record<string, unknown>
      sync_version: number
    }>>(`
      SELECT row_to_json(t) AS row_data, t.sync_version::int AS sync_version
      FROM "${schema}"."${table}" t
      WHERE t.sync_version > $1
      ORDER BY t.sync_version ASC
      LIMIT $2
    `, afterVersion, pageSize + 1)

    const hasMore    = rows.length > pageSize
    const page       = hasMore ? rows.slice(0, pageSize) : rows
    const maxVersion = page.length > 0
      ? page[page.length - 1].sync_version
      : afterVersion

    return { rows: page.map(r => r.row_data), maxVersion, hasMore }
  }

  /** Current max sync_version for a specific table (server head). */
  async getTableHead(tenantId: string, tableName: SyncableTable): Promise<number> {
    const schema = this.getSchema(tenantId)
    const table  = this.assertTable(tableName)

    const [row] = await this.prisma.$queryRawUnsafe<Array<{ v: number }>>(`
      SELECT COALESCE(MAX(sync_version), 0)::int AS v FROM "${schema}"."${table}"
    `)
    return row?.v ?? 0
  }

  // ─── Cursors ──────────────────────────────────────────────────────────────

  async getCursors(
    tenantId: string,
    deviceId: string,
  ): Promise<Record<string, number>> {
    const schema = this.getSchema(tenantId)

    const rows = await this.prisma.$queryRawUnsafe<Array<{
      table_name:          string
      last_pulled_version: number
    }>>(`
      SELECT table_name, last_pulled_version::int
      FROM "${schema}".sync_cursors
      WHERE device_id = $1
    `, deviceId)

    return Object.fromEntries(rows.map(r => [r.table_name, r.last_pulled_version]))
  }

  async upsertCursor(
    tenantId:  string,
    deviceId:  string,
    tableName: string,
    version:   number,
  ): Promise<void> {
    const schema = this.getSchema(tenantId)

    await this.prisma.$executeRawUnsafe(`
      INSERT INTO "${schema}".sync_cursors (device_id, table_name, last_pulled_version)
      VALUES ($1, $2, $3)
      ON CONFLICT (device_id, table_name) DO UPDATE
        SET last_pulled_version = GREATEST(sync_cursors.last_pulled_version, $3),
            updated_at          = now()
    `, deviceId, tableName, version)
  }

  // ─── Changes log ──────────────────────────────────────────────────────────

  async logChange(params: {
    tenantId:    string
    tableName:   string
    rowId:       string
    operation:   'INSERT' | 'UPDATE' | 'DELETE'
    syncVersion: number
    payload:     Record<string, unknown>
    deviceId?:   string
    userId?:     string
  }): Promise<void> {
    const schema = this.getSchema(params.tenantId)

    await this.prisma.$executeRawUnsafe(`
      INSERT INTO "${schema}".changes_log
        (table_name, row_id, operation, sync_version, payload, device_id, user_id)
      VALUES ($1, $2::uuid, $3, $4, $5::jsonb, $6, $7::uuid)
    `,
      params.tableName,
      params.rowId,
      params.operation,
      params.syncVersion,
      JSON.stringify(params.payload),
      params.deviceId ?? null,
      params.userId   ?? null,
    )
  }

  // ─── Push: find by sync_id ─────────────────────────────────────────────────

  async findBySyncId(
    tenantId:  string,
    tableName: SyncableTable,
    syncId:    string,
  ): Promise<{ id: string; sync_version: number } | null> {
    const schema = this.getSchema(tenantId)
    const table  = this.assertTable(tableName)

    const rows = await this.prisma.$queryRawUnsafe<Array<{ id: string; sync_version: number }>>(`
      SELECT id, sync_version::int FROM "${schema}"."${table}"
      WHERE sync_id = $1::uuid
      LIMIT 1
    `, syncId)

    return rows[0] ?? null
  }

  // ─── Push: customers ──────────────────────────────────────────────────────

  async applyCustomerInsert(
    tenantId: string,
    syncId:   string,
    payload:  CustomerPayload,
    deviceId: string,
    userId:   string,
  ): Promise<{ id: string; syncVersion: number; isNew: boolean }> {
    const schema = this.getSchema(tenantId)

    // Idempotent — ON CONFLICT (sync_id) DO NOTHING
    const rows = await this.prisma.$queryRawUnsafe<Array<{ id: string; sv: number }>>(`
      INSERT INTO "${schema}".customers
        (sync_id, first_name, last_name, email, phone, tax_id, address, notes, sync_version)
      VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, nextval('public.sync_version_seq'))
      ON CONFLICT (sync_id) DO NOTHING
      RETURNING id, sync_version::int AS sv
    `,
      syncId,
      payload.first_name ?? null,
      payload.last_name  ?? null,
      payload.email      ?? null,
      payload.phone      ?? null,
      payload.tax_id     ?? null,
      payload.address    ?? null,
      payload.notes      ?? null,
    )

    if (rows.length === 0) {
      // Already existed — return existing
      const existing = await this.findBySyncId(tenantId, 'customers', syncId)
      return { id: existing!.id, syncVersion: existing!.sync_version, isNew: false }
    }

    await this.logChange({
      tenantId, tableName: 'customers', rowId: rows[0].id,
      operation: 'INSERT', syncVersion: rows[0].sv,
      payload: payload as Record<string, unknown>, deviceId, userId,
    })

    return { id: rows[0].id, syncVersion: rows[0].sv, isNew: true }
  }

  async applyCustomerUpdate(
    tenantId:    string,
    syncId:      string,
    payload:     CustomerPayload,
    baseVersion: number,
    deviceId:    string,
    userId:      string,
  ): Promise<{
    id:          string
    syncVersion: number
    conflict:    boolean
    serverRow?:  Record<string, unknown>
  }> {
    const schema   = this.getSchema(tenantId)
    const existing = await this.findBySyncId(tenantId, 'customers', syncId)

    if (!existing) {
      // Row doesn't exist → create it
      const ins = await this.applyCustomerInsert(tenantId, syncId, payload, deviceId, userId)
      return { id: ins.id, syncVersion: ins.syncVersion, conflict: false }
    }

    // Conflict detection: server was modified after client's base
    if (existing.sync_version > baseVersion && baseVersion !== 0) {
      const [serverRow] = await this.prisma.$queryRawUnsafe<Record<string, unknown>[]>(`
        SELECT row_to_json(c) AS row_data FROM "${schema}".customers c WHERE id = $1::uuid
      `, existing.id)
      return {
        id:          existing.id,
        syncVersion: existing.sync_version,
        conflict:    true,
        serverRow:   (serverRow as any)?.row_data ?? {},
      }
    }

    // Apply update
    const [updated] = await this.prisma.$queryRawUnsafe<Array<{ sv: number }>>(`
      UPDATE "${schema}".customers
      SET first_name   = COALESCE($1, first_name),
          last_name    = COALESCE($2, last_name),
          email        = COALESCE($3, email),
          phone        = COALESCE($4, phone),
          tax_id       = COALESCE($5, tax_id),
          address      = COALESCE($6, address),
          notes        = COALESCE($7, notes),
          updated_at   = now(),
          sync_version = nextval('public.sync_version_seq')
      WHERE id = $8::uuid AND deleted_at IS NULL
      RETURNING sync_version::int AS sv
    `,
      payload.first_name ?? null,
      payload.last_name  ?? null,
      payload.email      ?? null,
      payload.phone      ?? null,
      payload.tax_id     ?? null,
      payload.address    ?? null,
      payload.notes      ?? null,
      existing.id,
    )

    await this.logChange({
      tenantId, tableName: 'customers', rowId: existing.id,
      operation: 'UPDATE', syncVersion: updated.sv,
      payload: payload as Record<string, unknown>, deviceId, userId,
    })

    return { id: existing.id, syncVersion: updated.sv, conflict: false }
  }

  async applyCustomerDelete(
    tenantId: string,
    syncId:   string,
    deviceId: string,
    userId:   string,
  ): Promise<{ id: string | null; skipped: boolean }> {
    const schema   = this.getSchema(tenantId)
    const existing = await this.findBySyncId(tenantId, 'customers', syncId)
    if (!existing) return { id: null, skipped: true }

    const [row] = await this.prisma.$queryRawUnsafe<Array<{ sv: number }>>(`
      UPDATE "${schema}".customers
      SET deleted_at   = now(),
          updated_at   = now(),
          sync_version = nextval('public.sync_version_seq')
      WHERE id = $1::uuid AND deleted_at IS NULL
      RETURNING sync_version::int AS sv
    `, existing.id)

    if (row) {
      await this.logChange({
        tenantId, tableName: 'customers', rowId: existing.id,
        operation: 'DELETE', syncVersion: row.sv, payload: {}, deviceId, userId,
      })
    }

    return { id: existing.id, skipped: !row }
  }

  // ─── Push: offline sales ──────────────────────────────────────────────────

  /**
   * Apply an offline sale with stock best-effort decrement.
   * If stock is insufficient, the sale is accepted but the shortfall
   * is returned so the caller can flag the conflict to the client.
   * Stock is clamped to 0 via GREATEST to never violate the CHECK constraint.
   */
  async applyOfflineSale(params: {
    tenantId: string
    syncId:   string
    payload:  SalePayload
    deviceId: string
    userId:   string
  }): Promise<{
    saleId:      string
    isNew:       boolean
    shortfalls:  Array<{ product_id: string; requested: number; available: number }>
  }> {
    const { tenantId, syncId, payload, deviceId, userId } = params
    const schema = this.getSchema(tenantId)

    // ── Idempotency check ──────────────────────────────────────────────────
    const existing = await this.findBySyncId(tenantId, 'sales', syncId)
    if (existing) {
      return { saleId: existing.id, isNew: false, shortfalls: [] }
    }

    await this.prisma.$executeRawUnsafe('BEGIN')
    try {
      // ── Insert sale ───────────────────────────────────────────────────────
      const [saleRow] = await this.prisma.$queryRawUnsafe<Array<{ id: string; sv: number }>>(`
        INSERT INTO "${schema}".sales (
          sync_id, branch_id, cashier_id, customer_id, status,
          subtotal, discount, tax, total,
          payment_method, payment_details, notes,
          client_created_at, sync_version
        ) VALUES (
          $1::uuid, $2::uuid, $3::uuid, $4, 'completed',
          $5, $6, $7, $8,
          $9, $10::jsonb, $11,
          $12, nextval('public.sync_version_seq')
        )
        RETURNING id, sync_version::int AS sv
      `,
        syncId,
        payload.branch_id,
        payload.cashier_id,
        payload.customer_id ?? null,
        payload.subtotal,
        payload.discount,
        payload.tax,
        payload.total,
        payload.payment_method,
        JSON.stringify(payload.payment_details),
        payload.notes ?? null,
        payload.client_created_at ?? null,
      )

      const saleId = saleRow.id
      const shortfalls: Array<{ product_id: string; requested: number; available: number }> = []

      // ── Insert items + stock decrement ────────────────────────────────────
      for (const item of payload.items) {
        // Insert sale_item
        await this.prisma.$executeRawUnsafe(`
          INSERT INTO "${schema}".sale_items (
            sync_id, sale_id, product_id, product_name, product_sku,
            quantity, unit_price, discount, subtotal, sync_version
          ) VALUES (
            $1::uuid, $2::uuid, $3::uuid, $4, $5,
            $6, $7, $8, $9, nextval('public.sync_version_seq')
          )
        `,
          item.sync_id,
          saleId,
          item.product_id,
          item.product_name,
          item.product_sku ?? null,
          item.quantity,
          item.unit_price,
          item.discount,
          item.subtotal,
        )

        // Ensure stock row exists
        await this.prisma.$executeRawUnsafe(`
          INSERT INTO "${schema}".stock (product_id, branch_id, quantity, sync_version)
          VALUES ($1::uuid, $2::uuid, 0, nextval('public.sync_version_seq'))
          ON CONFLICT (product_id, branch_id) DO NOTHING
        `, item.product_id, payload.branch_id)

        // Read current qty for shortfall detection
        const [stockRow] = await this.prisma.$queryRawUnsafe<Array<{ qty: number }>>(`
          SELECT quantity::float AS qty FROM "${schema}".stock
          WHERE product_id = $1::uuid AND branch_id = $2::uuid
        `, item.product_id, payload.branch_id)

        const available = stockRow?.qty ?? 0

        if (available < item.quantity) {
          shortfalls.push({
            product_id: item.product_id,
            requested:  item.quantity,
            available,
          })
        }

        // Clamp to 0 — avoids violating CHECK(quantity >= 0) for offline sales
        const decrement = Math.min(available, item.quantity)
        if (decrement > 0) {
          await this.prisma.$executeRawUnsafe(`
            UPDATE "${schema}".stock
            SET quantity     = quantity - $1,
                updated_at   = now(),
                sync_version = nextval('public.sync_version_seq')
            WHERE product_id = $2::uuid AND branch_id = $3::uuid
          `, decrement, item.product_id, payload.branch_id)
        }

        // Stock movement (full requested qty for accuracy)
        await this.prisma.$executeRawUnsafe(`
          INSERT INTO "${schema}".stock_movements
            (stock_id, type, quantity, reference_id, created_by, sync_version)
          SELECT id, 'sale', $1, $2::uuid, $3::uuid, nextval('public.sync_version_seq')
          FROM "${schema}".stock
          WHERE product_id = $4::uuid AND branch_id = $5::uuid
        `, -item.quantity, saleId, userId, item.product_id, payload.branch_id)
      }

      // ── Update customer stats ─────────────────────────────────────────────
      if (payload.customer_id) {
        await this.prisma.$executeRawUnsafe(`
          UPDATE "${schema}".customers
          SET total_spent = total_spent + $1,
              visit_count = visit_count + 1,
              updated_at  = now()
          WHERE id = $2::uuid
        `, payload.total, payload.customer_id)
      }

      await this.prisma.$executeRawUnsafe('COMMIT')

      await this.logChange({
        tenantId, tableName: 'sales', rowId: saleId,
        operation: 'INSERT', syncVersion: saleRow.sv,
        payload: { ...payload, items: payload.items.length } as any,
        deviceId, userId,
      })

      return { saleId, isNew: true, shortfalls }
    } catch (err) {
      await this.prisma.$executeRawUnsafe('ROLLBACK')
      this.logger.error({ syncId, tenantId }, `Failed to apply offline sale: ${err}`)
      throw err
    }
  }

  // ─── Server heads (for status endpoint) ───────────────────────────────────

  async getAllHeads(tenantId: string): Promise<Record<string, number>> {
    const heads: Record<string, number> = {}
    for (const table of SYNCABLE_TABLES) {
      heads[table] = await this.getTableHead(tenantId, table)
    }
    return heads
  }
}
