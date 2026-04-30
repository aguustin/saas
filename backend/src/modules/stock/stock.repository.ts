import { Injectable }              from '@nestjs/common'
import { Prisma }                  from '@prisma/client'
import { PrismaTenantService }     from '@database/prisma-tenant.service'
import { TenantBaseRepository }    from '@common/repositories/tenant-base.repository'
import type {
  StockRow,
  StockMovementRow,
  StockAlert,
  StockQueryDto,
  MovementQueryDto,
} from './dto/stock.dto'

@Injectable()
export class StockRepository extends TenantBaseRepository {
  constructor(prisma: PrismaTenantService) {
    super(prisma)
  }

  // ─── Lecturas ─────────────────────────────────────────────────────────────

  async findStock(tenantId: string, q: StockQueryDto): Promise<{
    items: StockRow[]
    total: number
    limit:  number
    offset: number
  }> {
    const s      = this.schema(tenantId)
    const limit  = q.limit  ?? 50
    const offset = q.offset ?? 0

    const branchCond  = q.branch_id
      ? Prisma.sql`AND st.branch_id = ${q.branch_id}::uuid`
      : Prisma.sql``
    const lowCond     = q.low_stock_only
      ? Prisma.sql`AND st.quantity <= st.min_quantity`
      : Prisma.sql``
    const searchCond  = q.search
      ? Prisma.sql`AND (p.name ILIKE ${'%' + q.search + '%'} OR p.sku ILIKE ${'%' + q.search + '%'})`
      : Prisma.sql``

    const items = await this.rawQuery<StockRow>(tenantId, (_s) =>
      Prisma.sql`
        SELECT
          st.id           AS stock_id,
          p.id            AS product_id,
          p.name          AS product_name,
          p.sku           AS product_sku,
          b.id            AS branch_id,
          b.name          AS branch_name,
          st.quantity::float,
          st.min_quantity::float,
          (st.quantity <= st.min_quantity) AS is_low,
          st.sync_version,
          st.updated_at::text
        FROM ${Prisma.raw(s)}.stock st
        JOIN ${Prisma.raw(s)}.products p ON p.id = st.product_id
        JOIN ${Prisma.raw(s)}.branches  b ON b.id = st.branch_id
        WHERE p.deleted_at IS NULL
          AND b.deleted_at IS NULL
          ${branchCond}
          ${lowCond}
          ${searchCond}
        ORDER BY is_low DESC, p.name ASC
        LIMIT  ${limit}
        OFFSET ${offset}
      `
    )

    const [{ total }] = await this.rawQuery<{ total: number }>(tenantId, (_s) =>
      Prisma.sql`
        SELECT COUNT(*)::int AS total
        FROM ${Prisma.raw(s)}.stock st
        JOIN ${Prisma.raw(s)}.products p ON p.id = st.product_id
        JOIN ${Prisma.raw(s)}.branches  b ON b.id = st.branch_id
        WHERE p.deleted_at IS NULL AND b.deleted_at IS NULL
          ${branchCond} ${lowCond} ${searchCond}
      `
    )

    return { items, total, limit, offset }
  }

  async findStockByProduct(
    tenantId:  string,
    productId: string,
  ): Promise<StockRow[]> {
    const s = this.schema(tenantId)
    return this.rawQuery<StockRow>(tenantId, (_s) =>
      Prisma.sql`
        SELECT
          st.id AS stock_id,
          p.id AS product_id, p.name AS product_name, p.sku AS product_sku,
          b.id AS branch_id,  b.name AS branch_name,
          st.quantity::float, st.min_quantity::float,
          (st.quantity <= st.min_quantity) AS is_low,
          st.sync_version, st.updated_at::text
        FROM ${Prisma.raw(s)}.stock st
        JOIN ${Prisma.raw(s)}.products p ON p.id = st.product_id
        JOIN ${Prisma.raw(s)}.branches  b ON b.id = st.branch_id
        WHERE st.product_id = ${productId}::uuid
          AND p.deleted_at IS NULL
        ORDER BY b.name
      `
    )
  }

  async getAlerts(tenantId: string, branchId?: string): Promise<StockAlert[]> {
    const s           = this.schema(tenantId)
    const branchCond  = branchId
      ? Prisma.sql`AND st.branch_id = ${branchId}::uuid`
      : Prisma.sql``

    return this.rawQuery<StockAlert>(tenantId, (_s) =>
      Prisma.sql`
        SELECT
          p.id   AS product_id,
          p.name AS product_name,
          p.sku  AS product_sku,
          b.id   AS branch_id,
          b.name AS branch_name,
          st.quantity::float,
          st.min_quantity::float,
          (st.min_quantity - st.quantity)::float AS deficit
        FROM ${Prisma.raw(s)}.stock st
        JOIN ${Prisma.raw(s)}.products p ON p.id = st.product_id
        JOIN ${Prisma.raw(s)}.branches  b ON b.id = st.branch_id
        WHERE st.quantity   <= st.min_quantity
          AND st.min_quantity > 0
          AND p.deleted_at IS NULL
          AND b.deleted_at IS NULL
          ${branchCond}
        ORDER BY deficit DESC
      `
    )
  }

  async findMovements(tenantId: string, q: MovementQueryDto): Promise<{
    items: StockMovementRow[]
    total: number
    limit:  number
    offset: number
  }> {
    const s      = this.schema(tenantId)
    const limit  = q.limit  ?? 50
    const offset = q.offset ?? 0

    const productCond  = q.product_id ? Prisma.sql`AND p.id  = ${q.product_id}::uuid`  : Prisma.sql``
    const branchCond   = q.branch_id  ? Prisma.sql`AND b.id  = ${q.branch_id}::uuid`   : Prisma.sql``
    const typeCond     = q.type       ? Prisma.sql`AND sm.type = ${q.type}`             : Prisma.sql``
    const dateFromCond = q.date_from  ? Prisma.sql`AND sm.created_at >= ${q.date_from}::timestamptz` : Prisma.sql``
    const dateToCond   = q.date_to    ? Prisma.sql`AND sm.created_at <= ${q.date_to}::timestamptz`   : Prisma.sql``

    const items = await this.rawQuery<StockMovementRow>(tenantId, (_s) =>
      Prisma.sql`
        SELECT
          sm.id, sm.stock_id,
          p.id   AS product_id,  p.name AS product_name,
          b.id   AS branch_id,   b.name AS branch_name,
          sm.type, sm.quantity::float,
          sm.reference_id, sm.note,
          sm.created_by, sm.created_at::text
        FROM ${Prisma.raw(s)}.stock_movements sm
        JOIN ${Prisma.raw(s)}.stock    st ON st.id = sm.stock_id
        JOIN ${Prisma.raw(s)}.products p  ON p.id  = st.product_id
        JOIN ${Prisma.raw(s)}.branches b  ON b.id  = st.branch_id
        WHERE true
          ${productCond} ${branchCond} ${typeCond}
          ${dateFromCond} ${dateToCond}
        ORDER BY sm.created_at DESC
        LIMIT  ${limit}
        OFFSET ${offset}
      `
    )

    const [{ total }] = await this.rawQuery<{ total: number }>(tenantId, (_s) =>
      Prisma.sql`
        SELECT COUNT(*)::int AS total
        FROM ${Prisma.raw(s)}.stock_movements sm
        JOIN ${Prisma.raw(s)}.stock    st ON st.id = sm.stock_id
        JOIN ${Prisma.raw(s)}.products p  ON p.id  = st.product_id
        JOIN ${Prisma.raw(s)}.branches b  ON b.id  = st.branch_id
        WHERE true
          ${productCond} ${branchCond} ${typeCond}
          ${dateFromCond} ${dateToCond}
      `
    )

    return { items, total, limit, offset }
  }

  // ─── Mutaciones ───────────────────────────────────────────────────────────

  async upsertAndAdd(params: {
    tenantId:    string
    productId:   string
    branchId:    string
    quantity:    number      // siempre positivo (entrada)
    type:        string
    createdBy:   string
    note?:       string | null
    referenceId?: string | null
  }): Promise<StockRow> {
    const schema = this.schema(params.tenantId).replace(/"/g, '')

    await this.prisma.$executeRawUnsafe('BEGIN')
    try {
      // UPSERT: si no existe stock para product+branch, lo crea con quantity=0
      await this.prisma.$executeRawUnsafe(`
        INSERT INTO "${schema}".stock (product_id, branch_id, quantity, sync_version)
        VALUES ($1::uuid, $2::uuid, 0, nextval('public.sync_version_seq'))
        ON CONFLICT (product_id, branch_id) DO NOTHING
      `, params.productId, params.branchId)

      // Incrementar
      await this.prisma.$executeRawUnsafe(`
        UPDATE "${schema}".stock
        SET quantity     = quantity + $1,
            updated_at   = now(),
            sync_version = nextval('public.sync_version_seq')
        WHERE product_id = $2::uuid AND branch_id = $3::uuid
      `, params.quantity, params.productId, params.branchId)

      // Registrar movimiento
      await this.prisma.$executeRawUnsafe(`
        INSERT INTO "${schema}".stock_movements
          (stock_id, type, quantity, reference_id, note, created_by, sync_version)
        SELECT id, $1, $2, $3, $4, $5::uuid, nextval('public.sync_version_seq')
        FROM "${schema}".stock
        WHERE product_id = $6::uuid AND branch_id = $7::uuid
      `,
        params.type,
        params.quantity,           // positivo = entrada
        params.referenceId ?? null,
        params.note        ?? null,
        params.createdBy,
        params.productId,
        params.branchId,
      )

      await this.prisma.$executeRawUnsafe('COMMIT')
    } catch (err) {
      await this.prisma.$executeRawUnsafe('ROLLBACK')
      throw err
    }

    return (await this.findStockByProduct(params.tenantId, params.productId))
      .find(r => r.branch_id === params.branchId)!
  }

  // Variante de upsertAndAdd que devuelve el StockMovementRow (para POST /stock/movements)
  async upsertAndAddReturningMovement(params: {
    tenantId:    string
    productId:   string
    branchId:    string
    quantity:    number   // puede ser negativo para ajustes
    type:        string
    createdBy:   string
    note?:       string | null
    referenceId?: string | null
  }): Promise<StockMovementRow> {
    const schema = this.schema(params.tenantId).replace(/"/g, '')

    await this.prisma.$executeRawUnsafe('BEGIN')
    let movementId: string
    try {
      await this.prisma.$executeRawUnsafe(`
        INSERT INTO "${schema}".stock (product_id, branch_id, quantity, sync_version)
        VALUES ($1::uuid, $2::uuid, 0, nextval('public.sync_version_seq'))
        ON CONFLICT (product_id, branch_id) DO NOTHING
      `, params.productId, params.branchId)

      await this.prisma.$executeRawUnsafe(`
        UPDATE "${schema}".stock
        SET quantity     = quantity + $1,
            updated_at   = now(),
            sync_version = nextval('public.sync_version_seq')
        WHERE product_id = $2::uuid AND branch_id = $3::uuid
      `, params.quantity, params.productId, params.branchId)

      const mvRows = await this.prisma.$queryRawUnsafe<{ id: string }[]>(`
        INSERT INTO "${schema}".stock_movements
          (stock_id, type, quantity, reference_id, note, created_by, sync_version)
        SELECT id, $1, $2, $3, $4, $5::uuid, nextval('public.sync_version_seq')
        FROM "${schema}".stock
        WHERE product_id = $6::uuid AND branch_id = $7::uuid
        RETURNING id
      `,
        params.type,
        params.quantity,
        params.referenceId ?? null,
        params.note        ?? null,
        params.createdBy,
        params.productId,
        params.branchId,
      )
      movementId = mvRows[0].id

      await this.prisma.$executeRawUnsafe('COMMIT')
    } catch (err) {
      await this.prisma.$executeRawUnsafe('ROLLBACK')
      throw err
    }

    const rows = await this.prisma.$queryRawUnsafe<StockMovementRow[]>(`
      SELECT
        m.id, m.stock_id,
        p.id   AS product_id, p.name AS product_name,
        b.id   AS branch_id,  b.name AS branch_name,
        m.type, m.quantity::float,
        m.reference_id, m.note,
        m.created_by::text,
        m.created_at::text
      FROM "${schema}".stock_movements m
      JOIN "${schema}".stock    st ON st.id = m.stock_id
      JOIN "${schema}".products p  ON p.id  = st.product_id
      JOIN "${schema}".branches b  ON b.id  = st.branch_id
      WHERE m.id = $1::uuid
    `, movementId)

    return rows[0]
  }

  async adjust(params: {
    tenantId:    string
    productId:   string
    branchId:    string
    newQuantity: number
    createdBy:   string
    note:        string
  }): Promise<{ stock: StockRow; delta: number }> {
    const schema = this.schema(params.tenantId).replace(/"/g, '')

    await this.prisma.$executeRawUnsafe('BEGIN')
    try {
      // Leer cantidad actual con lock exclusivo
      const rows = await this.prisma.$queryRawUnsafe<{ quantity: number }[]>(`
        SELECT quantity::float FROM "${schema}".stock
        WHERE product_id = $1::uuid AND branch_id = $2::uuid
        FOR UPDATE
      `, params.productId, params.branchId)

      const current = rows[0]?.quantity ?? 0
      const delta   = params.newQuantity - current

      if (delta === 0) {
        await this.prisma.$executeRawUnsafe('ROLLBACK')
        const stock = (await this.findStockByProduct(params.tenantId, params.productId))
          .find(r => r.branch_id === params.branchId)!
        return { stock, delta: 0 }
      }

      // Si no existe fila de stock, la crea
      await this.prisma.$executeRawUnsafe(`
        INSERT INTO "${schema}".stock (product_id, branch_id, quantity, sync_version)
        VALUES ($1::uuid, $2::uuid, $3, nextval('public.sync_version_seq'))
        ON CONFLICT (product_id, branch_id) DO UPDATE
          SET quantity     = $3,
              updated_at   = now(),
              sync_version = nextval('public.sync_version_seq')
      `, params.productId, params.branchId, params.newQuantity)

      await this.prisma.$executeRawUnsafe(`
        INSERT INTO "${schema}".stock_movements
          (stock_id, type, quantity, note, created_by, sync_version)
        SELECT id, 'adjustment', $1, $2, $3::uuid, nextval('public.sync_version_seq')
        FROM "${schema}".stock
        WHERE product_id = $4::uuid AND branch_id = $5::uuid
      `,
        delta,                      // positivo o negativo
        params.note,
        params.createdBy,
        params.productId,
        params.branchId,
      )

      await this.prisma.$executeRawUnsafe('COMMIT')
    } catch (err) {
      await this.prisma.$executeRawUnsafe('ROLLBACK')
      throw err
    }

    const stock = (await this.findStockByProduct(params.tenantId, params.productId))
      .find(r => r.branch_id === params.branchId)!

    return { stock, delta: params.newQuantity - (stock.quantity - 0) }
  }

  async transfer(params: {
    tenantId:     string
    productId:    string
    fromBranchId: string
    toBranchId:   string
    quantity:     number
    createdBy:    string
    note?:        string | null
  }): Promise<{ from: StockRow; to: StockRow }> {
    const schema = this.schema(params.tenantId).replace(/"/g, '')

    await this.prisma.$executeRawUnsafe('BEGIN')
    try {
      // Locks en orden determinístico (menor UUID primero) para evitar deadlocks
      const [first, second] = [params.fromBranchId, params.toBranchId].sort()

      await this.prisma.$executeRawUnsafe(`
        SELECT id FROM "${schema}".stock
        WHERE product_id = $1::uuid
          AND branch_id IN ($2::uuid, $3::uuid)
        ORDER BY branch_id
        FOR UPDATE
      `, params.productId, first, second)

      // Verificar stock disponible en origen
      const fromRows = await this.prisma.$queryRawUnsafe<{ quantity: number }[]>(`
        SELECT quantity::float FROM "${schema}".stock
        WHERE product_id = $1::uuid AND branch_id = $2::uuid
      `, params.productId, params.fromBranchId)

      const available = fromRows[0]?.quantity ?? 0
      if (available < params.quantity) {
        throw new InsufficientTransferStockError(available, params.quantity)
      }

      // Descontar origen
      await this.prisma.$executeRawUnsafe(`
        UPDATE "${schema}".stock
        SET quantity     = quantity - $1,
            updated_at   = now(),
            sync_version = nextval('public.sync_version_seq')
        WHERE product_id = $2::uuid AND branch_id = $3::uuid
      `, params.quantity, params.productId, params.fromBranchId)

      // UPSERT destino
      await this.prisma.$executeRawUnsafe(`
        INSERT INTO "${schema}".stock (product_id, branch_id, quantity, sync_version)
        VALUES ($1::uuid, $2::uuid, $3, nextval('public.sync_version_seq'))
        ON CONFLICT (product_id, branch_id) DO UPDATE
          SET quantity     = "${schema}".stock.quantity + $3,
              updated_at   = now(),
              sync_version = nextval('public.sync_version_seq')
      `, params.productId, params.toBranchId, params.quantity)

      // Movimientos
      const note = params.note ?? `Transfer to branch ${params.toBranchId}`
      for (const [branchId, qty] of [
        [params.fromBranchId, -params.quantity],
        [params.toBranchId,    params.quantity],
      ] as [string, number][]) {
        await this.prisma.$executeRawUnsafe(`
          INSERT INTO "${schema}".stock_movements
            (stock_id, type, quantity, note, created_by, sync_version)
          SELECT id, 'transfer', $1, $2, $3::uuid, nextval('public.sync_version_seq')
          FROM "${schema}".stock
          WHERE product_id = $4::uuid AND branch_id = $5::uuid
        `, qty, note, params.createdBy, params.productId, branchId)
      }

      await this.prisma.$executeRawUnsafe('COMMIT')
    } catch (err) {
      await this.prisma.$executeRawUnsafe('ROLLBACK')
      throw err
    }

    const rows  = await this.findStockByProduct(params.tenantId, params.productId)
    return {
      from: rows.find(r => r.branch_id === params.fromBranchId)!,
      to:   rows.find(r => r.branch_id === params.toBranchId)!,
    }
  }

  async setMinQuantity(params: {
    tenantId:    string
    productId:   string
    branchId:    string
    minQuantity: number
  }): Promise<StockRow | null> {
    const schema = this.schema(params.tenantId).replace(/"/g, '')

    await this.prisma.$executeRawUnsafe(`
      INSERT INTO "${schema}".stock (product_id, branch_id, min_quantity, sync_version)
      VALUES ($1::uuid, $2::uuid, $3, nextval('public.sync_version_seq'))
      ON CONFLICT (product_id, branch_id) DO UPDATE
        SET min_quantity  = $3,
            updated_at    = now(),
            sync_version  = nextval('public.sync_version_seq')
    `, params.productId, params.branchId, params.minQuantity)

    return (await this.findStockByProduct(params.tenantId, params.productId))
      .find(r => r.branch_id === params.branchId) ?? null
  }
}

export class InsufficientTransferStockError extends Error {
  constructor(
    public readonly available: number,
    public readonly requested: number,
  ) {
    super(`Transfer failed: available ${available}, requested ${requested}`)
    this.name = 'InsufficientTransferStockError'
  }
}
