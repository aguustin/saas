import { Injectable, Logger } from '@nestjs/common'
import { Prisma }              from '@prisma/client'
import { PrismaTenantService }    from '@database/prisma-tenant.service'
import { TenantBaseRepository }   from '@common/repositories/tenant-base.repository'
import type {
  SaleItemInput,
  SaleTotals,
  SaleResponse,
  StockCheck,
  SaleQueryDto,
} from './dto/sale.dto'

@Injectable()
export class SalesRepository extends TenantBaseRepository {
  private readonly logger = new Logger(SalesRepository.name)

  constructor(prisma: PrismaTenantService) {
    super(prisma)
  }

  // ─── Verificación de stock ─────────────────────────────────────────────────
  // Ejecutar ANTES de iniciar la transacción — respuesta rápida al usuario.

  async checkStock(
    tenantId: string,
    branchId: string,
    items: Array<{ product_id: string; quantity: number }>,
  ): Promise<StockCheck[]> {
    const schema   = this.schema(tenantId)
    const uuidList = Prisma.join(
      items.map(i => Prisma.sql`${i.product_id}::uuid`)
    )

    const stockRows = await this.rawQuery<{
      product_id:   string
      product_name: string
      quantity:     number
    }>(tenantId, (_s) =>
      Prisma.sql`
        SELECT
          p.id  AS product_id,
          p.name AS product_name,
          COALESCE(s.quantity, 0)::float AS quantity
        FROM ${Prisma.raw(schema)}.products p
        LEFT JOIN ${Prisma.raw(schema)}.stock s
          ON s.product_id = p.id AND s.branch_id = ${branchId}::uuid
        WHERE p.id IN (${uuidList})
          AND p.deleted_at IS NULL
          AND p.is_active = true
      `
    )

    const stockMap = new Map(stockRows.map(r => [r.product_id, r]))

    return items.map(item => {
      const row = stockMap.get(item.product_id)
      return {
        product_id:   item.product_id,
        product_name: row?.product_name ?? 'Unknown',
        available:    row?.quantity ?? 0,
        requested:    item.quantity,
      }
    })
  }

  // ─── Crear venta (transacción atómica completa) ────────────────────────────

  async createWithTransaction(params: {
    tenantId:       string
    branchId:       string
    cashierId:      string
    customerId:     string | null
    items:          SaleItemInput[]
    totals:         SaleTotals
    paymentMethod:  string
    paymentDetails: Record<string, unknown>
    discount:       number
    notes:          string | null
    clientCreatedAt?: string
    status?:        'completed' | 'pending'
  }): Promise<SaleResponse> {
    const schema = this.schema(params.tenantId).replace(/"/g, '')

    // $transaction de Prisma no soporta $executeRawUnsafe con schema dinámico,
    // usamos una transacción SQL explícita via $queryRawUnsafe
    const result = await this.prisma.$queryRawUnsafe<any[]>(`
      WITH sale_insert AS (
        INSERT INTO "${schema}".sales (
          branch_id, cashier_id, customer_id, status,
          subtotal, discount, tax, total,
          payment_method, payment_details, notes,
          client_created_at, sync_version
        ) VALUES (
          $1::uuid, $2::uuid, $3, $12,
          $4, $5, $6, $7,
          $8, $9::jsonb, $10,
          $11, nextval('public.sync_version_seq')
        )
        RETURNING id, sync_id, created_at
      )
      SELECT * FROM sale_insert
    `,
      params.branchId,
      params.cashierId,
      params.customerId ?? null,
      params.totals.subtotal,
      params.totals.discount,
      params.totals.tax,
      params.totals.total,
      params.paymentMethod,
      JSON.stringify(params.paymentDetails),
      params.notes ?? null,
      params.clientCreatedAt ?? null,
      params.status ?? 'completed',
    )

    const sale = result[0]
    if (!sale) throw new Error('Sale insert returned no rows')

    // Insertar items
    for (const item of params.items) {
      await this.prisma.$executeRawUnsafe(`
        INSERT INTO "${schema}".sale_items (
          sale_id, product_id, product_name, product_sku,
          quantity, unit_price, discount, subtotal, sync_version
        ) VALUES (
          $1::uuid, $2::uuid, $3, $4,
          $5, $6, $7, $8,
          nextval('public.sync_version_seq')
        )
      `,
        sale.id,
        item.product_id,
        item.product_name,
        item.product_sku ?? null,
        item.quantity,
        item.unit_price,
        item.discount,
        item.subtotal,
      )
    }

    // Descontar stock con UPDATE + constraint CHECK (quantity >= 0)
    // Si quantity < 0 → viola el CHECK → PostgreSQL lanza error → rollback automático
    for (const item of params.items) {
      const updated = await this.prisma.$executeRawUnsafe(`
        UPDATE "${schema}".stock
        SET quantity     = quantity - $1,
            updated_at   = now(),
            sync_version = nextval('public.sync_version_seq')
        WHERE product_id = $2::uuid
          AND branch_id  = $3::uuid
          AND quantity   >= $1
      `, item.quantity, item.product_id, params.branchId)

      if (updated === 0) {
        // La fila no se actualizó → stock insuficiente en este momento exacto
        throw new InsufficientStockError(item.product_id, item.product_name)
      }

      // Registrar movimiento de stock (append-only)
      await this.prisma.$executeRawUnsafe(`
        INSERT INTO "${schema}".stock_movements (
          stock_id, type, quantity, reference_id, created_by, sync_version
        )
        SELECT s.id, 'sale', $1, $2::uuid, $3::uuid,
               nextval('public.sync_version_seq')
        FROM "${schema}".stock s
        WHERE s.product_id = $4::uuid AND s.branch_id = $5::uuid
      `,
        -item.quantity,
        sale.id,
        params.cashierId,
        item.product_id,
        params.branchId,
      )
    }

    // Actualizar estadísticas del cliente si viene con customer
    if (params.customerId) {
      await this.prisma.$executeRawUnsafe(`
        UPDATE "${schema}".customers
        SET total_spent  = total_spent + $1,
            visit_count  = visit_count + 1,
            updated_at   = now()
        WHERE id = $2::uuid
      `, params.totals.total, params.customerId)
    }

    return this.findById(params.tenantId, sale.id) as Promise<SaleResponse>
  }

  // ─── Update status ────────────────────────────────────────────────────────

  async updateStatus(
    tenantId:       string,
    saleId:         string,
    status:         'completed' | 'cancelled',
    paymentDetails?: Record<string, unknown>,
  ): Promise<SaleResponse | null> {
    const schema = this.schema(tenantId).replace(/"/g, '')

    if (paymentDetails) {
      await this.prisma.$executeRawUnsafe(`
        UPDATE "${schema}".sales
        SET status          = $1,
            payment_details = payment_details || $2::jsonb,
            updated_at      = now(),
            sync_version    = nextval('public.sync_version_seq')
        WHERE id = $3::uuid
      `, status, JSON.stringify(paymentDetails), saleId)
    } else {
      await this.prisma.$executeRawUnsafe(`
        UPDATE "${schema}".sales
        SET status       = $1,
            updated_at   = now(),
            sync_version = nextval('public.sync_version_seq')
        WHERE id = $2::uuid
      `, status, saleId)
    }

    return this.findById(tenantId, saleId)
  }

  // ─── Cancel pending (update to cancelled + restock) ──────────────────────

  async cancelPendingSale(tenantId: string, saleId: string): Promise<void> {
    const schema  = this.schema(tenantId).replace(/"/g, '')
    const sale    = await this.findById(tenantId, saleId)
    if (!sale || sale.status !== 'pending') return

    await this.prisma.$executeRawUnsafe(`
      UPDATE "${schema}".sales
      SET status       = 'cancelled',
          updated_at   = now(),
          sync_version = nextval('public.sync_version_seq')
      WHERE id = $1::uuid
    `, saleId)

    for (const item of sale.items) {
      await this.prisma.$executeRawUnsafe(`
        UPDATE "${schema}".stock
        SET quantity     = quantity + $1,
            updated_at   = now(),
            sync_version = nextval('public.sync_version_seq')
        WHERE product_id = $2::uuid AND branch_id = $3::uuid
      `, item.quantity, item.product_id, sale.branch_id)
    }
  }

  // ─── Refund ───────────────────────────────────────────────────────────────

  async refundSale(
    tenantId:   string,
    saleId:     string,
    reason:     string,
    cashierId:  string,
    restock:    boolean,
    itemIds?:   string[],
  ): Promise<SaleResponse> {
    const schema = this.schema(tenantId).replace(/"/g, '')

    // Obtener datos de la venta + items
    const sale = await this.findById(tenantId, saleId)
    if (!sale) throw new Error('Sale not found')

    const itemsToRefund = itemIds?.length
      ? sale.items.filter(i => itemIds.includes(i.id))
      : sale.items

    const refundTotal = itemsToRefund.reduce((s, i) => s + i.subtotal, 0)

    // Marcar como refunded
    await this.prisma.$executeRawUnsafe(`
      UPDATE "${schema}".sales
      SET status       = 'refunded',
          notes        = COALESCE(notes || ' | ', '') || 'REFUND: ' || $1,
          updated_at   = now(),
          sync_version = nextval('public.sync_version_seq')
      WHERE id = $2::uuid
    `, reason, saleId)

    // Devolver stock si corresponde
    if (restock) {
      const branchId = sale.branch_id
      for (const item of itemsToRefund) {
        await this.prisma.$executeRawUnsafe(`
          UPDATE "${schema}".stock
          SET quantity     = quantity + $1,
              updated_at   = now(),
              sync_version = nextval('public.sync_version_seq')
          WHERE product_id = $2::uuid AND branch_id = $3::uuid
        `, item.quantity, item.product_id, branchId)

        await this.prisma.$executeRawUnsafe(`
          INSERT INTO "${schema}".stock_movements (
            stock_id, type, quantity, reference_id, created_by, sync_version
          )
          SELECT s.id, 'return', $1, $2::uuid, $3::uuid,
                 nextval('public.sync_version_seq')
          FROM "${schema}".stock s
          WHERE s.product_id = $4::uuid AND s.branch_id = $5::uuid
        `,
          item.quantity, saleId, cashierId,
          item.product_id, branchId,
        )
      }
    }

    return this.findById(tenantId, saleId) as Promise<SaleResponse>
  }

  // ─── Queries ──────────────────────────────────────────────────────────────

  async findById(tenantId: string, id: string): Promise<SaleResponse | null> {
    const schema = this.schema(tenantId)

    const rows = await this.rawQuery<any>(tenantId, (_s) =>
      Prisma.sql`
        SELECT
          s.id, s.branch_id, s.customer_id, s.cashier_id, s.status,
          s.subtotal::float, s.discount::float, s.tax::float, s.total::float,
          s.payment_method, s.payment_details, s.notes,
          s.sync_id, s.sync_version,
          s.created_at::text,
          json_agg(
            json_build_object(
              'id',           si.id,
              'product_id',   si.product_id,
              'product_name', si.product_name,
              'product_sku',  si.product_sku,
              'quantity',     si.quantity::float,
              'unit_price',   si.unit_price::float,
              'discount',     si.discount::float,
              'subtotal',     si.subtotal::float
            ) ORDER BY si.id
          ) AS items
        FROM ${Prisma.raw(schema)}.sales s
        JOIN ${Prisma.raw(schema)}.sale_items si ON si.sale_id = s.id
        WHERE s.id = ${id}::uuid AND s.deleted_at IS NULL
        GROUP BY s.id
      `
    )
    return rows[0] ?? null
  }

  async findMany(tenantId: string, q: SaleQueryDto): Promise<{
    items: SaleResponse[]
    total: number
    limit:  number
    offset: number
  }> {
    const schema = this.schema(tenantId)
    const limit  = q.limit  ?? 50
    const offset = q.offset ?? 0

    const branchCond   = q.branch_id   ? Prisma.sql`AND s.branch_id   = ${q.branch_id}::uuid`   : Prisma.sql``
    const cashierCond  = q.cashier_id  ? Prisma.sql`AND s.cashier_id  = ${q.cashier_id}::uuid`  : Prisma.sql``
    const customerCond = q.customer_id ? Prisma.sql`AND s.customer_id = ${q.customer_id}::uuid` : Prisma.sql``
    const statusCond   = q.status      ? Prisma.sql`AND s.status      = ${q.status}`            : Prisma.sql``
    const dateFromCond = q.date_from   ? Prisma.sql`AND s.created_at >= ${q.date_from}::timestamptz` : Prisma.sql``
    const dateToCond   = q.date_to     ? Prisma.sql`AND s.created_at <= ${q.date_to}::timestamptz`   : Prisma.sql``

    const items = await this.rawQuery<SaleResponse>(tenantId, (_s) =>
      Prisma.sql`
        SELECT
          s.id, s.branch_id, s.customer_id, s.cashier_id, s.status,
          s.subtotal::float, s.discount::float, s.tax::float, s.total::float,
          s.payment_method, s.payment_details, s.notes,
          s.sync_id, s.sync_version,
          s.created_at::text,
          json_agg(
            json_build_object(
              'id',           si.id,
              'product_id',   si.product_id,
              'product_name', si.product_name,
              'product_sku',  si.product_sku,
              'quantity',     si.quantity::float,
              'unit_price',   si.unit_price::float,
              'discount',     si.discount::float,
              'subtotal',     si.subtotal::float
            ) ORDER BY si.id
          ) AS items
        FROM ${Prisma.raw(schema)}.sales s
        JOIN ${Prisma.raw(schema)}.sale_items si ON si.sale_id = s.id
        WHERE s.deleted_at IS NULL
          ${branchCond} ${cashierCond} ${customerCond}
          ${statusCond} ${dateFromCond} ${dateToCond}
        GROUP BY s.id
        ORDER BY s.created_at DESC
        LIMIT  ${limit}
        OFFSET ${offset}
      `
    )

    const [{ total }] = await this.rawQuery<{ total: number }>(tenantId, (_s) =>
      Prisma.sql`
        SELECT COUNT(DISTINCT s.id)::int AS total
        FROM ${Prisma.raw(schema)}.sales s
        WHERE s.deleted_at IS NULL
          ${branchCond} ${cashierCond} ${customerCond}
          ${statusCond} ${dateFromCond} ${dateToCond}
      `
    )

    return { items, total, limit, offset }
  }

  // Resumen del día para el dashboard del POS
  async getDailySummary(tenantId: string, branchId: string, date: string): Promise<DailySummary> {
    const schema = this.schema(tenantId)
    const rows   = await this.rawQuery<DailySummary>(tenantId, (_s) =>
      Prisma.sql`
        SELECT
          COUNT(*)::int                                       AS total_sales,
          COALESCE(SUM(total), 0)::float                     AS total_revenue,
          COALESCE(SUM(CASE WHEN payment_method = 'cash'     THEN total ELSE 0 END), 0)::float AS cash,
          COALESCE(SUM(CASE WHEN payment_method = 'card'     THEN total ELSE 0 END), 0)::float AS card,
          COALESCE(SUM(CASE WHEN payment_method = 'transfer' THEN total ELSE 0 END), 0)::float AS transfer,
          COALESCE(SUM(CASE WHEN payment_method = 'mp'       THEN total ELSE 0 END), 0)::float AS mp,
          COALESCE(AVG(total), 0)::float                     AS avg_ticket
        FROM ${Prisma.raw(schema)}.sales
        WHERE branch_id  = ${branchId}::uuid
          AND status     = 'completed'
          AND created_at >= ${date}::date
          AND created_at  < ${date}::date + INTERVAL '1 day'
      `
    )
    return rows[0]
  }
}

// ─── Error personalizado para stock insuficiente ───────────────────────────────

export class InsufficientStockError extends Error {
  constructor(
    public readonly productId:   string,
    public readonly productName: string,
  ) {
    super(`Insufficient stock for "${productName}"`)
    this.name = 'InsufficientStockError'
  }
}

export interface DailySummary {
  total_sales:   number
  total_revenue: number
  cash:          number
  card:          number
  transfer:      number
  mp:            number
  avg_ticket:    number
}
