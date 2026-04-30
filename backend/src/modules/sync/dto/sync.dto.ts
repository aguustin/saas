import { z } from 'zod'

// ─── Table registry ───────────────────────────────────────────────────────────

export const SYNCABLE_TABLES = [
  'products', 'categories', 'branches', 'customers',
  'sales', 'sale_items', 'stock', 'stock_movements', 'employees',
] as const

export const PUSH_ALLOWED_TABLES = ['customers', 'sales'] as const

export type SyncableTable = typeof SYNCABLE_TABLES[number]
export type PushableTable = typeof PUSH_ALLOWED_TABLES[number]

// Per-table metadata: drives pull queries and push validation
export const TABLE_META: Record<SyncableTable, {
  hasDeletedAt: boolean
  pushAllowed:  boolean
  allowedOps:   ('INSERT' | 'UPDATE' | 'DELETE')[]
}> = {
  products:        { hasDeletedAt: true,  pushAllowed: false, allowedOps: [] },
  categories:      { hasDeletedAt: true,  pushAllowed: false, allowedOps: [] },
  branches:        { hasDeletedAt: true,  pushAllowed: false, allowedOps: [] },
  employees:       { hasDeletedAt: true,  pushAllowed: false, allowedOps: [] },
  customers:       { hasDeletedAt: true,  pushAllowed: true,  allowedOps: ['INSERT', 'UPDATE', 'DELETE'] },
  sales:           { hasDeletedAt: true,  pushAllowed: true,  allowedOps: ['INSERT'] },
  sale_items:      { hasDeletedAt: false, pushAllowed: false, allowedOps: [] },
  stock:           { hasDeletedAt: false, pushAllowed: false, allowedOps: [] },
  stock_movements: { hasDeletedAt: false, pushAllowed: false, allowedOps: [] },
}

// ─── Push payload schemas ─────────────────────────────────────────────────────

export const SaleItemSyncSchema = z.object({
  sync_id:      z.string().uuid(),
  product_id:   z.string().uuid(),
  product_name: z.string().min(1).max(300),
  product_sku:  z.string().nullable().optional(),
  quantity:     z.number().positive(),
  unit_price:   z.number().nonnegative(),
  discount:     z.number().nonnegative().default(0),
  subtotal:     z.number().nonnegative(),
})

export const SalePayloadSchema = z.object({
  branch_id:         z.string().uuid(),
  cashier_id:        z.string().uuid(),
  customer_id:       z.string().uuid().nullable().optional(),
  subtotal:          z.number().nonnegative(),
  discount:          z.number().nonnegative().default(0),
  tax:               z.number().nonnegative(),
  total:             z.number().nonnegative(),
  payment_method:    z.enum(['cash', 'card', 'transfer', 'mp', 'mixed']),
  payment_details:   z.record(z.unknown()).default({}),
  notes:             z.string().max(500).nullable().optional(),
  client_created_at: z.string().datetime().optional(),
  items:             z.array(SaleItemSyncSchema).min(1).max(200),
})

export const CustomerPayloadSchema = z.object({
  first_name: z.string().max(100).nullable().optional(),
  last_name:  z.string().max(100).nullable().optional(),
  email:      z.string().email().max(200).nullable().optional(),
  phone:      z.string().max(30).nullable().optional(),
  tax_id:     z.string().max(30).nullable().optional(),
  address:    z.string().max(300).nullable().optional(),
  notes:      z.string().max(500).nullable().optional(),
})

// ─── Push request ─────────────────────────────────────────────────────────────

export const PushChangeSchema = z.object({
  table:        z.enum(PUSH_ALLOWED_TABLES),
  operation:    z.enum(['INSERT', 'UPDATE', 'DELETE']),
  sync_id:      z.string().uuid(),
  // Client's last known server version for this row (0 = new record)
  base_version: z.number().int().min(0).default(0),
  payload:      z.record(z.unknown()),
})

export const PushRequestSchema = z.object({
  device_id: z.string().min(1).max(200),
  changes:   z.array(PushChangeSchema).min(1).max(500),
})

// ─── Pull request ─────────────────────────────────────────────────────────────

export const PullRequestSchema = z.object({
  device_id: z.string().min(1).max(200),
  // Subset of tables to pull — omit to pull all
  tables:    z.array(z.enum(SYNCABLE_TABLES)).optional(),
  // Per-table cursor: last sync_version the device has (0 = full pull)
  cursors:   z.record(z.string(), z.coerce.number().int().min(0)).default({}),
  page_size: z.coerce.number().int().min(10).max(1000).default(500),
})

export type PullRequestDto  = z.infer<typeof PullRequestSchema>
export type PushRequestDto  = z.infer<typeof PushRequestSchema>
export type PushChange      = z.infer<typeof PushChangeSchema>
export type SalePayload     = z.infer<typeof SalePayloadSchema>
export type CustomerPayload = z.infer<typeof CustomerPayloadSchema>
export type SaleItemPayload = z.infer<typeof SaleItemSyncSchema>

// ─── Response shapes ──────────────────────────────────────────────────────────

export interface TablePullResult {
  rows:     Record<string, unknown>[]
  cursor:   number   // max sync_version in this batch; use as next cursor
  has_more: boolean  // true → client should pull again with updated cursor
}

export interface PullResponse {
  tables:    Partial<Record<SyncableTable, TablePullResult>>
  pulled_at: string
}

export interface PushResult {
  sync_id:    string
  table:      string
  status:     'applied' | 'skipped' | 'conflict' | 'error'
  server_id?: string  // server UUID of the created/updated row
  conflict?:  { reason: string; server_row: Record<string, unknown> }
  error?:     string
}

export interface PushResponse {
  results:     PushResult[]
  applied:     number
  skipped:     number
  conflicts:   number
  server_time: string
}

export interface SyncStatusResponse {
  device_id:    string
  cursors:      Record<string, number>  // current device cursors (what it has)
  server_heads: Record<string, number>  // current max version per table on server
  behind:       Record<string, number>  // delta: rows the device is missing
}
