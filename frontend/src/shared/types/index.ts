// ── Auth ────────────────────────────────────────────────────────

export interface TokenPair {
  access_token:  string
  refresh_token: string
  expires_in:    number
}

export type UserRole = 'owner' | 'admin' | 'manager' | 'cashier'
export type PlanName = 'free' | 'pro' | 'premium' | 'super'

export interface MeResponse {
  user_id:   string
  tenant_id: string
  role:      UserRole
  plan:      PlanName
  branch_id: string | null
}

export interface JwtPayload {
  sub:       string
  tenant_id: string
  role:      UserRole
  plan:      PlanName
  branch_id: string | null
  iat?:      number
  exp?:      number
}

export interface ActiveSession {
  id:           string
  device_id:    string
  device_name:  string | null
  ip_address:   string | null
  last_used_at: string
  created_at:   string
}

// ── Customers ───────────────────────────────────────────────────

export interface CustomerResponse {
  id:         string
  name:       string
  email:      string | null
  phone:      string | null
}

// ── Products ────────────────────────────────────────────────────

export type ProductUnit = 'unit' | 'kg' | 'g' | 'l' | 'ml' | 'm' | 'cm'

export interface ProductResponse {
  id:           string
  name:         string
  description:  string | null
  sku:          string | null
  barcode:      string | null
  price:        number
  cost:         number | null
  tax_rate:     number
  unit:         ProductUnit
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

// ── Sales ───────────────────────────────────────────────────────

export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'mp' | 'mixed'
export type SaleStatus    = 'pending' | 'completed' | 'cancelled' | 'refunded'

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
  status:          SaleStatus
  subtotal:        number
  discount:        number
  tax:             number
  total:           number
  payment_method:  PaymentMethod
  payment_details: {
    cash_received?:   number
    change?:          number
    card_last4?:      string
    installments?:    number
    transfer_ref?:    string
    mp_payment_id?:   string
    mixed_breakdown?: Array<{ method: PaymentMethod; amount: number }>
  }
  notes:           string | null
  items:           SaleItemResponse[]
  sync_id:         string
  sync_version:    number
  created_at:      string
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

// ── Stock ───────────────────────────────────────────────────────

export type StockMovementType = 'purchase' | 'adjustment' | 'transfer' | 'return'

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
  type:         StockMovementType
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

// ── Users ───────────────────────────────────────────────────────

export interface UserRow {
  id:            string
  email:         string
  role:          UserRole
  first_name:    string | null
  last_name:     string | null
  branch_id:     string | null
  branch_name:   string | null
  is_active:     boolean
  last_login_at: string | null
  created_at:    string
  updated_at:    string
}

// ── Employees ───────────────────────────────────────────────────

export interface EmployeeRow {
  id:           string
  user_id:      string | null
  branch_id:    string
  branch_name:  string
  first_name:   string
  last_name:    string
  dni:          string | null
  phone:        string | null
  email:        string | null
  role:         string
  salary:       number | null
  hired_at:     string | null
  is_active:    boolean
  notes:        string | null
  sync_version: number
  created_at:   string
  updated_at:   string
}

// ── Billing ─────────────────────────────────────────────────────

export type AnalyticsLevel = 'basic' | 'advanced' | 'full'
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'unpaid' | 'cancelled'
export type BillingProvider = 'stripe' | 'mercadopago' | 'manual'

export interface PlanDto {
  id:              string
  name:            PlanName
  display_name:    string
  price_ars:       number
  price_usd:       number
  max_products:    number | null
  max_branches:    number | null
  max_users:       number | null
  max_employees:   number | null
  sync_enabled:    boolean
  analytics_level: AnalyticsLevel
  api_access:      boolean
  sort_order:      number
}

export interface SubscriptionDto {
  id:                   string
  plan_name:            string
  plan_display_name:    string
  status:               SubscriptionStatus
  provider:             BillingProvider
  provider_sub_id:      string
  current_period_start: string
  current_period_end:   string
  grace_period_ends_at: string | null
  cancel_at_period_end: boolean
  cancelled_at:         string | null
  currency:             string
  amount:               number
}

export interface ResourceLimit {
  current: number
  max:     number | null
  pct:     number | null
  blocked: boolean
}

export interface LimitsDto {
  plan_name: string
  resources: {
    products:  ResourceLimit
    branches:  ResourceLimit
    users:     ResourceLimit
    employees: ResourceLimit
  }
  features: {
    sync_enabled:    boolean
    analytics_level: string
    api_access:      boolean
  }
}

export interface BillingEventDto {
  id:           string
  event_type:   string
  provider:     string
  amount:       number | null
  currency:     string | null
  status:       string | null
  processed_at: string
}

// ── Sync ────────────────────────────────────────────────────────

export type SyncableTable =
  | 'products' | 'categories' | 'branches' | 'customers'
  | 'sales' | 'sale_items' | 'stock' | 'stock_movements' | 'employees'

export interface TablePullResult {
  rows:     Record<string, unknown>[]
  cursor:   number
  has_more: boolean
}

export interface PullResponse {
  tables:    Partial<Record<SyncableTable, TablePullResult>>
  pulled_at: string
}

export interface PushResult {
  sync_id:    string
  table:      string
  status:     'applied' | 'skipped' | 'conflict' | 'error'
  server_id?: string
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
  cursors:      Record<string, number>
  server_heads: Record<string, number>
  behind:       Record<string, number>
}

// ── Pagination ──────────────────────────────────────────────────

export interface PaginatedResult<T> {
  items:  T[]
  total:  number
  limit:  number
  offset: number
}

// ── API Error ───────────────────────────────────────────────────

export interface ApiError {
  statusCode: number
  code:       string
  message:    string
  path?:      string
  timestamp?: string
  details?:   unknown
}
