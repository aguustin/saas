import { z } from 'zod'

// ─── Enums ────────────────────────────────────────────────────────────────────

export const PaymentMethod = z.enum(['cash', 'card', 'transfer', 'mp', 'mixed'])
export type  PaymentMethodType = z.infer<typeof PaymentMethod>

export const SaleStatus = z.enum(['pending', 'completed', 'cancelled', 'refunded'])
export type  SaleStatusType = z.infer<typeof SaleStatus>

// ─── Requests ─────────────────────────────────────────────────────────────────

export const SaleItemSchema = z.object({
  product_id:  z.string().uuid(),
  quantity:    z.number().positive('Quantity must be positive'),
  unit_price:  z.number().nonnegative('Unit price must be >= 0'),
  discount:    z.number().nonnegative().optional().default(0),
})

export const CreateSaleSchema = z.object({
  branch_id:      z.string().uuid(),
  customer_id:    z.string().uuid().optional().nullable(),
  items:          z.array(SaleItemSchema).min(1, 'Sale must have at least one item'),
  payment_method: PaymentMethod,
  payment_details: z.object({
    cash_received:   z.number().nonnegative().optional(),  // efectivo recibido
    change:          z.number().nonnegative().optional(),  // vuelto
    card_last4:      z.string().length(4).optional(),
    installments:    z.number().int().min(1).max(24).optional(),
    transfer_ref:    z.string().max(100).optional(),
    mp_payment_id:   z.string().max(100).optional(),
    // Para pago mixto: desglose por método
    mixed_breakdown: z.array(z.object({
      method: PaymentMethod,
      amount: z.number().positive(),
    })).optional(),
  }).optional().default({}),
  discount:    z.number().nonnegative().optional().default(0),  // descuento global
  notes:       z.string().max(500).optional().nullable(),
  client_created_at: z.string().datetime().optional(),  // timestamp del cliente (solo auditoría)
})
.refine(
  data => {
    // Para pago mixto, el desglose es obligatorio
    if (data.payment_method === 'mixed') {
      return (data.payment_details?.mixed_breakdown?.length ?? 0) >= 2
    }
    return true
  },
  { message: 'Mixed payment requires breakdown with at least 2 methods', path: ['payment_details'] }
)

export const SaleQuerySchema = z.object({
  branch_id:   z.string().uuid().optional(),
  cashier_id:  z.string().uuid().optional(),
  customer_id: z.string().uuid().optional(),
  status:      SaleStatus.optional(),
  date_from:   z.string().datetime().optional(),
  date_to:     z.string().datetime().optional(),
  limit:       z.coerce.number().int().min(1).max(100).optional().default(50),
  offset:      z.coerce.number().int().min(0).optional().default(0),
})

export const RefundSchema = z.object({
  reason:     z.string().min(1).max(500),
  items:      z.array(z.object({
    sale_item_id: z.string().uuid(),
    quantity:     z.number().positive(),
  })).optional(),  // Si no viene: refund total
  restock:    z.boolean().optional().default(true),  // Volver al stock
})

export type CreateSaleDto = z.infer<typeof CreateSaleSchema>
export type SaleQueryDto  = z.infer<typeof SaleQuerySchema>
export type RefundDto     = z.infer<typeof RefundSchema>

// ─── Internos (no expuestos en la API) ────────────────────────────────────────

export interface SaleItemInput {
  product_id:   string
  product_name: string
  product_sku:  string | null
  quantity:     number
  unit_price:   number
  discount:     number
  subtotal:     number
}

export interface StockCheck {
  product_id:   string
  product_name: string
  available:    number
  requested:    number
}

// ─── Responses ────────────────────────────────────────────────────────────────

export interface SaleItemResponse {
  id:           string
  product_id:   string
  product_name: string
  product_sku:  string | null
  quantity:     number
  unit_price:   number
  discount:     number
  subtotal:     number
}

export interface SaleResponse {
  id:              string
  branch_id:       string
  customer_id:     string | null
  cashier_id:      string | null
  status:          SaleStatusType
  subtotal:        number
  discount:        number
  tax:             number
  total:           number
  payment_method:  PaymentMethodType
  payment_details: Record<string, unknown>
  notes:           string | null
  items:           SaleItemResponse[]
  sync_id:         string
  sync_version:    number
  created_at:      string
}

export interface SaleTotals {
  subtotal: number   // suma de (item.unit_price * item.quantity - item.discount)
  discount: number   // descuento global
  tax:      number   // subtotal neto * tax_rate promedio ponderado
  total:    number   // subtotal - discount + tax
}
