import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnprocessableEntityException,
  Logger,
} from '@nestjs/common'
import { SalesRepository, InsufficientStockError } from './sales.repository'
import type {
  CreateSaleDto,
  SaleQueryDto,
  RefundDto,
  SaleItemInput,
  SaleTotals,
} from './dto/sale.dto'

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name)

  constructor(private repo: SalesRepository) {}

  // ─── Crear venta ──────────────────────────────────────────────────────────

  async create(tenantId: string, cashierId: string, dto: CreateSaleDto, status: 'completed' | 'pending' = 'completed') {
    // 1. Validar duplicados de producto en los items
    this.assertNoDuplicateItems(dto.items)

    // 2. Verificar stock disponible (sin lock — lectura rápida para feedback)
    const stockChecks = await this.repo.checkStock(
      tenantId,
      dto.branch_id,
      dto.items.map(i => ({ product_id: i.product_id, quantity: i.quantity })),
    )

    const insufficient = stockChecks.filter(s => s.available < s.requested)
    if (insufficient.length > 0) {
      throw new UnprocessableEntityException({
        code:    'INSUFFICIENT_STOCK',
        message: 'One or more products do not have enough stock',
        details: insufficient.map(s => ({
          product_id:   s.product_id,
          product_name: s.product_name,
          available:    s.available,
          requested:    s.requested,
        })),
      })
    }

    // 3. Construir items enriquecidos con nombres (evitar N+1: ya vienen del checkStock)
    const stockMap = new Map(stockChecks.map(s => [s.product_id, s]))
    const saleItems: SaleItemInput[] = dto.items.map(item => {
      const stock    = stockMap.get(item.product_id)!
      const subtotal = round2(item.unit_price * item.quantity - item.discount)
      return {
        product_id:   item.product_id,
        product_name: stock.product_name,
        product_sku:  null,   // se denormaliza en el INSERT desde la tabla products
        quantity:     item.quantity,
        unit_price:   item.unit_price,
        discount:     item.discount,
        subtotal,
      }
    })

    // 4. Calcular totales
    const totals = this.calculateTotals(saleItems, dto.discount ?? 0)

    // 5. Validar pago mixto si aplica
    if (dto.payment_method === 'mixed') {
      this.validateMixedPayment(dto, totals.total)
    }

    // 6. Ejecutar transacción atómica
    try {
      const sale = await this.repo.createWithTransaction({
        tenantId:       tenantId,
        branchId:       dto.branch_id,
        cashierId,
        customerId:     dto.customer_id ?? null,
        items:          saleItems,
        totals,
        paymentMethod:  dto.payment_method,
        paymentDetails: dto.payment_details ?? {},
        discount:       dto.discount ?? 0,
        notes:          dto.notes ?? null,
        clientCreatedAt: dto.client_created_at,
        status,
      })

      this.logger.log({
        tenantId,
        saleId:   sale.id,
        total:    totals.total,
        items:    saleItems.length,
        method:   dto.payment_method,
      }, 'Sale created')

      return sale

    } catch (err) {
      if (err instanceof InsufficientStockError) {
        // Race condition: pasó el pre-check pero falló en el UPDATE atómico
        throw new UnprocessableEntityException({
          code:    'STOCK_RACE_CONDITION',
          message: `Stock for "${err.productName}" was depleted by another sale. Please retry.`,
          product_id: err.productId,
        })
      }
      throw err
    }
  }

  // ─── MP QR helpers ───────────────────────────────────────────────────────

  async createPending(tenantId: string, cashierId: string, dto: CreateSaleDto) {
    return this.create(tenantId, cashierId, dto, 'pending')
  }

  async completePendingSale(
    tenantId:  string,
    saleId:    string,
    mpPaymentId: string,
  ) {
    const sale = await this.repo.findById(tenantId, saleId)
    if (!sale) throw new NotFoundException(`Sale ${saleId} not found`)
    if (sale.status !== 'pending') return sale

    const updated = await this.repo.updateStatus(tenantId, saleId, 'completed', {
      mp_payment_id: mpPaymentId,
    })
    this.logger.log({ tenantId, saleId, mpPaymentId }, 'Pending sale completed via MP')
    return updated
  }

  async cancelPendingSale(tenantId: string, saleId: string) {
    const sale = await this.repo.findById(tenantId, saleId)
    if (!sale) return
    if (sale.status !== 'pending') return
    await this.repo.cancelPendingSale(tenantId, saleId)
    this.logger.log({ tenantId, saleId }, 'Pending sale cancelled')
  }

  // ─── Refund ───────────────────────────────────────────────────────────────

  async refund(
    tenantId:  string,
    saleId:    string,
    cashierId: string,
    dto:       RefundDto,
  ) {
    const sale = await this.repo.findById(tenantId, saleId)
    if (!sale) throw new NotFoundException(`Sale ${saleId} not found`)

    if (sale.status === 'refunded') {
      throw new BadRequestException('Sale is already refunded')
    }
    if (sale.status === 'cancelled') {
      throw new BadRequestException('Cannot refund a cancelled sale')
    }

    // Validar items de refund parcial
    if (dto.items?.length) {
      const saleItemIds = new Set(sale.items.map(i => i.id))
      const invalid     = dto.items.filter(i => !saleItemIds.has(i.sale_item_id))
      if (invalid.length) {
        throw new BadRequestException(`Invalid sale_item_ids: ${invalid.map(i => i.sale_item_id).join(', ')}`)
      }
    }

    const result = await this.repo.refundSale(
      tenantId,
      saleId,
      dto.reason,
      cashierId,
      dto.restock ?? true,
      dto.items?.map(i => i.sale_item_id),
    )

    this.logger.log({ tenantId, saleId, reason: dto.reason }, 'Sale refunded')
    return result
  }

  // ─── Queries ──────────────────────────────────────────────────────────────

  async list(tenantId: string, query: SaleQueryDto) {
    return this.repo.findMany(tenantId, query)
  }

  async getById(tenantId: string, id: string) {
    const sale = await this.repo.findById(tenantId, id)
    if (!sale) throw new NotFoundException(`Sale ${id} not found`)
    return sale
  }

  async getDailySummary(tenantId: string, branchId: string, date?: string) {
    const targetDate = date ?? new Date().toISOString().split('T')[0]
    return this.repo.getDailySummary(tenantId, branchId, targetDate)
  }

  // ─── Lógica de negocio ────────────────────────────────────────────────────

  private calculateTotals(items: SaleItemInput[], globalDiscount: number): SaleTotals {
    // Subtotal = suma de subtotales por item (ya con descuento por item)
    const subtotal = round2(items.reduce((sum, i) => sum + i.subtotal, 0))

    // Descuento global sobre el subtotal
    const discount = round2(Math.min(globalDiscount, subtotal))
    const net      = round2(subtotal - discount)

    // IVA sobre el neto (21% fijo para MVP — en el futuro usar tax_rate por producto)
    const TAX_RATE = 0.21
    const tax      = round2(net * TAX_RATE)
    const total    = round2(net + tax)

    return { subtotal, discount, tax, total }
  }

  private validateMixedPayment(dto: CreateSaleDto, expectedTotal: number): void {
    const breakdown = dto.payment_details?.mixed_breakdown ?? []
    const sum       = round2(breakdown.reduce((s, b) => s + b.amount, 0))

    // Tolerancia de $0.01 por redondeos flotantes
    if (Math.abs(sum - expectedTotal) > 0.01) {
      throw new BadRequestException(
        `Mixed payment breakdown (${sum}) does not match total (${expectedTotal})`
      )
    }
  }

  private assertNoDuplicateItems(items: Array<{ product_id: string }>): void {
    const seen = new Set<string>()
    for (const item of items) {
      if (seen.has(item.product_id)) {
        throw new BadRequestException(
          `Duplicate product_id in items: ${item.product_id}. Merge quantities instead.`
        )
      }
      seen.add(item.product_id)
    }
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
