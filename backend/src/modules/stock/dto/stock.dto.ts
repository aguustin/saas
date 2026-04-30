import { z } from 'zod'

export const MovementType = z.enum(['purchase', 'adjustment', 'transfer', 'return'])
export type  MovementTypeValue = z.infer<typeof MovementType>

// ─── Requests ─────────────────────────────────────────────────────────────────

export const AddStockSchema = z.object({
  product_id:  z.string().uuid(),
  branch_id:   z.string().uuid(),
  quantity:    z.number().positive('Quantity must be positive'),
  type:        MovementType,
  unit_cost:   z.number().nonnegative().optional().nullable(),
  note:        z.string().max(300).optional().nullable(),
  reference_id: z.string().uuid().optional().nullable(),  // purchase_id, etc.
})

export const AdjustStockSchema = z.object({
  product_id:  z.string().uuid(),
  branch_id:   z.string().uuid(),
  // Cantidad absoluta final deseada — el servicio calcula el delta
  new_quantity: z.number().nonnegative(),
  note:        z.string().min(1, 'Adjustment reason is required').max(300),
})

export const TransferStockSchema = z.object({
  product_id:    z.string().uuid(),
  from_branch_id: z.string().uuid(),
  to_branch_id:   z.string().uuid(),
  quantity:      z.number().positive(),
  note:          z.string().max(300).optional().nullable(),
}).refine(
  d => d.from_branch_id !== d.to_branch_id,
  { message: 'Source and destination branches must be different' }
)

// Endpoint unificado POST /stock/movements (usado por el formulario del frontend)
export const CreateMovementSchema = z.object({
  product_id:   z.string().uuid(),
  branch_id:    z.string().uuid(),
  type:         MovementType,
  quantity:     z.number().refine(v => v !== 0, { message: 'Quantity cannot be zero' }),
  reference_id: z.string().uuid().optional().nullable(),
  note:         z.string().max(300).optional().nullable(),
})
export type CreateMovementDto = z.infer<typeof CreateMovementSchema>

export const SetMinStockSchema = z.object({
  product_id:   z.string().uuid(),
  branch_id:    z.string().uuid(),
  min_quantity: z.number().nonnegative(),
})

export const MovementQuerySchema = z.object({
  product_id:  z.string().uuid().optional(),
  branch_id:   z.string().uuid().optional(),
  type:        MovementType.optional(),
  date_from:   z.string().datetime().optional(),
  date_to:     z.string().datetime().optional(),
  limit:       z.coerce.number().int().min(1).max(200).optional().default(50),
  offset:      z.coerce.number().int().min(0).optional().default(0),
})

export const StockQuerySchema = z.object({
  branch_id:    z.string().uuid().optional(),
  low_stock_only: z.coerce.boolean().optional().default(false),
  search:       z.string().optional(),
  limit:        z.coerce.number().int().min(1).max(200).optional().default(50),
  offset:       z.coerce.number().int().min(0).optional().default(0),
})

export type AddStockDto      = z.infer<typeof AddStockSchema>
export type AdjustStockDto   = z.infer<typeof AdjustStockSchema>
export type TransferStockDto = z.infer<typeof TransferStockSchema>
export type SetMinStockDto   = z.infer<typeof SetMinStockSchema>
export type MovementQueryDto = z.infer<typeof MovementQuerySchema>
export type StockQueryDto    = z.infer<typeof StockQuerySchema>

// ─── Responses ────────────────────────────────────────────────────────────────

export interface StockRow {
  stock_id:     string
  product_id:   string
  product_name: string
  product_sku:  string | null
  branch_id:    string
  branch_name:  string
  quantity:     number
  min_quantity: number
  is_low:       boolean
  sync_version: number
  updated_at:   string
}

export interface StockMovementRow {
  id:           string
  stock_id:     string
  product_id:   string
  product_name: string
  branch_id:    string
  branch_name:  string
  type:         string
  quantity:     number
  reference_id: string | null
  note:         string | null
  created_by:   string | null
  created_at:   string
}

export interface StockAlert {
  product_id:   string
  product_name: string
  product_sku:  string | null
  branch_id:    string
  branch_name:  string
  quantity:     number
  min_quantity: number
  deficit:      number
}
