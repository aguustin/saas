// ─── Shared test fixtures ─────────────────────────────────────────────────────

export const TENANT_ID  = 'aaaaaaaa-0000-0000-0000-000000000001'
export const BRANCH_ID  = 'bbbbbbbb-0000-0000-0000-000000000001'
export const USER_ID    = 'cccccccc-0000-0000-0000-000000000001'
export const PRODUCT_ID = 'dddddddd-0000-0000-0000-000000000001'
export const SALE_ID    = 'eeeeeeee-0000-0000-0000-000000000001'
export const DEVICE_ID  = 'test-device-001'

export const mockProduct = {
  id:           PRODUCT_ID,
  name:         'Widget Pro',
  sku:          'WGT-001',
  barcode:      '7501234567890',
  description:  null,
  price:        100.00,
  cost:         60.00,
  tax_rate:     0.21,
  unit:         'unit',
  category_id:  null,
  image_url:    null,
  attributes:   {},
  is_active:    true,
  sync_id:      'sync-prod-001',
  sync_version: 1,
  created_at:   '2024-01-01T00:00:00.000Z',
  updated_at:   '2024-01-01T00:00:00.000Z',
}

export const mockSale = {
  id:              SALE_ID,
  branch_id:       BRANCH_ID,
  cashier_id:      USER_ID,
  customer_id:     null,
  status:          'completed' as const,
  payment_method:  'cash' as const,
  payment_details: {},
  subtotal:        100.00,
  discount:        0,
  tax:             21.00,
  total:           121.00,
  notes:           null,
  sync_id:         'sync-sale-001',
  sync_version:    1,
  created_at:      '2024-06-01T00:00:00.000Z',
  items: [
    {
      id:           'item-001',
      product_id:   PRODUCT_ID,
      product_name: 'Widget Pro',
      product_sku:  'WGT-001',
      quantity:     1,
      unit_price:   100.00,
      discount:     0,
      subtotal:     100.00,
    },
  ],
}

export const mockDailySummary = {
  total_sales:   5,
  total_revenue: 605.00,
  cash:          300.00,
  card:          305.00,
  transfer:      0,
  mp:            0,
  avg_ticket:    121.00,
}

export const mockJwtPayload = {
  sub:       USER_ID,
  tenant_id: TENANT_ID,
  role:      'owner' as const,
  plan:      'pro' as const,
  branch_id: null,
}
