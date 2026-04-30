import { z } from 'zod'

// ─── Request DTOs ────────────────────────────────────────────────────────────

export const CreateProductSchema = z.object({
  name:        z.string().min(1, 'Name is required').max(200),
  description: z.string().max(1000).optional().nullable(),
  sku:         z.string().max(100).optional().nullable(),
  barcode:     z.string().max(100).optional().nullable(),
  price:       z.number({ required_error: 'Price is required' }).positive('Price must be positive'),
  cost:        z.number().positive().optional().nullable(),
  tax_rate:    z.number().min(0).max(1).optional().default(0.21),
  unit:        z.enum(['unit','kg','g','l','ml','m','cm']).optional().default('unit'),
  category_id: z.string().uuid().optional().nullable(),
  image_url:   z.string().url().max(500).optional().nullable(),
  attributes:  z.record(z.unknown()).optional().default({}),
  is_active:   z.boolean().optional().default(true),
})

export const UpdateProductSchema = CreateProductSchema
  .partial()
  .omit({ is_active: true })  // is_active se maneja con endpoint dedicado

export const ProductQuerySchema = z.object({
  search:      z.string().max(200).optional(),
  category_id: z.string().uuid().optional(),
  is_active:   z.coerce.boolean().optional(),
  min_price:   z.coerce.number().positive().optional(),
  max_price:   z.coerce.number().positive().optional(),
  limit:       z.coerce.number().int().min(1).max(200).optional().default(50),
  offset:      z.coerce.number().int().min(0).optional().default(0),
  sort_by:     z.enum(['name','price','created_at','updated_at']).optional().default('name'),
  sort_dir:    z.enum(['asc','desc']).optional().default('asc'),
})

export const SetActiveSchema = z.object({
  is_active: z.boolean(),
})

export const BulkDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
})

export type CreateProductDto = z.infer<typeof CreateProductSchema>
export type UpdateProductDto = z.infer<typeof UpdateProductSchema>
export type ProductQueryDto  = z.infer<typeof ProductQuerySchema>
export type SetActiveDto     = z.infer<typeof SetActiveSchema>
export type BulkDeleteDto    = z.infer<typeof BulkDeleteSchema>

// ─── Response DTOs ────────────────────────────────────────────────────────────

export interface ProductResponse {
  id:           string
  name:         string
  description:  string | null
  sku:          string | null
  barcode:      string | null
  price:        number
  cost:         number | null
  tax_rate:     number
  unit:         string
  category_id:  string | null
  image_url:    string | null
  attributes:   Record<string, unknown>
  is_active:    boolean
  sync_id:      string
  sync_version: number
  created_at:   string
  updated_at:   string
}

export interface ProductListResponse {
  items:  ProductResponse[]
  total:  number
  limit:  number
  offset: number
}
