import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePOS } from './usePOS'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { useProductStore } from '@/features/products/store/products.store'
import { useSalesStore } from '@/features/sales/store/sales.store'
import { useSyncStore } from '@/features/sync/store/sync.store'
import type { MeResponse, ProductResponse } from '@/shared/types'

vi.mock('@/features/products/api/products.api', () => ({
  productsApi: {
    list:        vi.fn(),
    byId:        vi.fn(),
    byBarcode:   vi.fn(),
    create:      vi.fn(),
    update:      vi.fn(),
    patchActive: vi.fn(),
    remove:      vi.fn(),
    bulkRemove:  vi.fn(),
  },
}))

vi.mock('@/features/sales/api/sales.api', () => ({
  salesApi: {
    create:  vi.fn(),
    list:    vi.fn(),
    byId:    vi.fn(),
    summary: vi.fn(),
    refund:  vi.fn(),
  },
}))

vi.mock('@/features/billing/store/billing.store', () => ({
  useBillingStore: { getState: () => ({ refreshLimits: vi.fn() }) },
}))

import { productsApi } from '@/features/products/api/products.api'
import { salesApi } from '@/features/sales/api/sales.api'

const MOCK_USER: MeResponse = {
  user_id:   'user-1',
  tenant_id: 'tenant-1',
  role:      'cashier',
  plan:      'pro',
  branch_id: 'branch-1',
}

function makeProduct(overrides: Partial<ProductResponse> = {}): ProductResponse {
  return {
    id:           'prod-1',
    name:         'Agua Mineral',
    description:  null,
    sku:          null,
    barcode:      null,
    price:        100,
    cost:         null,
    tax_rate:     0.21,
    unit:         'unit',
    category_id:  null,
    image_url:    null,
    attributes:   {},
    is_active:    true,
    sync_id:      'sync-1',
    sync_version: 1,
    created_at:   '2024-01-01T00:00:00Z',
    updated_at:   '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

function resetStores() {
  localStorage.clear()
  vi.clearAllMocks()

  useAuthStore.setState({
    access_token: 'tok', refresh_token: null,
    user: MOCK_USER, sessions: [], sessionsLoading: false,
    pending_tenant_id: null, isAuthenticated: true, isBootstrapping: false,
  })

  useProductStore.setState({
    items: [], total: 0, limit: 50, offset: 0,
    filters: { limit: 50, offset: 0, sort_by: 'name', sort_dir: 'asc' },
    status: 'idle', error: null, mutating: false, byId: {}, byBarcode: {},
  })

  useSalesStore.setState({
    items: [], total: 0, limit: 50, offset: 0, filters: { limit: 50, offset: 0 },
    current: null, summaries: {}, status: 'idle', error: null,
    creating: false, refunding: false,
  })

  useSyncStore.setState({
    status: 'idle', cursors: {}, behind: {}, pendingSales: [],
    lastSyncAt: null, error: null, isOnline: true,
    _cleanupOnline: null, _cleanupOffline: null,
  })
}

beforeEach(resetStores)

// ── Cart ──────────────────────────────────────────────────────────

describe('usePOS — cart', () => {
  it('starts with an empty cart', () => {
    const { result } = renderHook(() => usePOS())
    expect(result.current.items).toHaveLength(0)
  })

  it('addToCart adds a new item with correct defaults', () => {
    const { result } = renderHook(() => usePOS())
    const product = makeProduct({ price: 150 })

    act(() => { result.current.addToCart(product) })

    expect(result.current.items).toHaveLength(1)
    const item = result.current.items[0]
    expect(item.product.id).toBe('prod-1')
    expect(item.quantity).toBe(1)
    expect(item.unit_price).toBe(150)
    expect(item.discount).toBe(0)
    expect(item.subtotal).toBe(150)
  })

  it('addToCart with explicit quantity', () => {
    const { result } = renderHook(() => usePOS())
    act(() => { result.current.addToCart(makeProduct({ price: 50 }), 3) })
    expect(result.current.items[0].quantity).toBe(3)
    expect(result.current.items[0].subtotal).toBe(150)
  })

  it('addToCart increments quantity when product already in cart', () => {
    const { result } = renderHook(() => usePOS())
    const product = makeProduct()

    act(() => { result.current.addToCart(product) })
    act(() => { result.current.addToCart(product) })

    expect(result.current.items).toHaveLength(1)
    expect(result.current.items[0].quantity).toBe(2)
  })

  it('addToCart clears search query', () => {
    const { result } = renderHook(() => usePOS())
    act(() => { result.current.search('agua') })
    act(() => { result.current.addToCart(makeProduct()) })
    expect(result.current.query).toBe('')
  })

  it('removeItem deletes the product from cart', () => {
    const { result } = renderHook(() => usePOS())
    act(() => { result.current.addToCart(makeProduct()) })
    act(() => { result.current.removeItem('prod-1') })
    expect(result.current.items).toHaveLength(0)
  })

  it('removeItem only removes the matching product', () => {
    const { result } = renderHook(() => usePOS())
    const p1 = makeProduct({ id: 'p1' })
    const p2 = makeProduct({ id: 'p2' })

    act(() => { result.current.addToCart(p1) })
    act(() => { result.current.addToCart(p2) })
    act(() => { result.current.removeItem('p1') })

    expect(result.current.items).toHaveLength(1)
    expect(result.current.items[0].product.id).toBe('p2')
  })

  it('clearCart empties items and resets global discount', () => {
    const { result } = renderHook(() => usePOS())
    act(() => { result.current.addToCart(makeProduct()) })
    act(() => { result.current.setGlobalDiscount(20) })
    act(() => { result.current.clearCart() })

    expect(result.current.items).toHaveLength(0)
    expect(result.current.globalDiscount).toBe(0)
  })
})

// ── updateItem ────────────────────────────────────────────────────

describe('usePOS — updateItem', () => {
  it('updates quantity and recalculates subtotal', () => {
    const { result } = renderHook(() => usePOS())
    act(() => { result.current.addToCart(makeProduct({ price: 50 })) })
    act(() => { result.current.updateItem('prod-1', { quantity: 4 }) })

    expect(result.current.items[0].quantity).toBe(4)
    expect(result.current.items[0].subtotal).toBe(200)
  })

  it('updates unit_price and recalculates subtotal', () => {
    const { result } = renderHook(() => usePOS())
    act(() => { result.current.addToCart(makeProduct({ price: 100 })) })
    act(() => { result.current.updateItem('prod-1', { unit_price: 80 }) })

    expect(result.current.items[0].unit_price).toBe(80)
    expect(result.current.items[0].subtotal).toBe(80)
  })

  it('applies line discount to subtotal', () => {
    const { result } = renderHook(() => usePOS())
    act(() => { result.current.addToCart(makeProduct({ price: 100 })) })
    act(() => { result.current.updateItem('prod-1', { discount: 25 }) })

    expect(result.current.items[0].discount).toBe(25)
    expect(result.current.items[0].subtotal).toBe(75) // 100*1 - 25
  })

  it('leaves other cart items unchanged', () => {
    const { result } = renderHook(() => usePOS())
    const p1 = makeProduct({ id: 'p1', price: 100 })
    const p2 = makeProduct({ id: 'p2', price: 200 })
    act(() => { result.current.addToCart(p1) })
    act(() => { result.current.addToCart(p2) })
    act(() => { result.current.updateItem('p1', { quantity: 3 }) })

    const p2Item = result.current.items.find(i => i.product.id === 'p2')!
    expect(p2Item.quantity).toBe(1)
    expect(p2Item.unit_price).toBe(200)
  })
})

// ── Totals ────────────────────────────────────────────────────────

describe('usePOS — totals', () => {
  it('are zero for an empty cart', () => {
    const { result } = renderHook(() => usePOS())
    const { totals } = result.current
    expect(totals.subtotal).toBe(0)
    expect(totals.tax).toBe(0)
    expect(totals.total).toBe(0)
  })

  it('calculates subtotal, 21% tax, and total correctly', () => {
    const { result } = renderHook(() => usePOS())
    act(() => { result.current.addToCart(makeProduct({ price: 100 }), 2) })

    const { totals } = result.current
    expect(totals.subtotal).toBe(200)
    expect(totals.discount).toBe(0)
    expect(totals.taxable).toBe(200)
    expect(totals.tax).toBeCloseTo(42)
    expect(totals.total).toBeCloseTo(242)
  })

  it('applies global discount before tax', () => {
    const { result } = renderHook(() => usePOS())
    act(() => { result.current.addToCart(makeProduct({ price: 100 })) })
    act(() => { result.current.setGlobalDiscount(10) })

    const { totals } = result.current
    expect(totals.taxable).toBe(90)
    expect(totals.tax).toBeCloseTo(18.9)
    expect(totals.total).toBeCloseTo(108.9)
  })

  it('sums line discounts and global discount', () => {
    const { result } = renderHook(() => usePOS())
    act(() => { result.current.addToCart(makeProduct({ price: 100 })) })
    act(() => { result.current.updateItem('prod-1', { discount: 5 }) })
    act(() => { result.current.setGlobalDiscount(5) })

    expect(result.current.totals.discount).toBe(10)
    expect(result.current.totals.taxable).toBe(90)
  })

  it('taxable is never negative (clamps to 0)', () => {
    const { result } = renderHook(() => usePOS())
    act(() => { result.current.addToCart(makeProduct({ price: 10 })) })
    act(() => { result.current.setGlobalDiscount(999) }) // discount > subtotal

    expect(result.current.totals.taxable).toBe(0)
    expect(result.current.totals.tax).toBe(0)
  })
})

// ── Search ────────────────────────────────────────────────────────

describe('usePOS — search barcode detection', () => {
  it('detects barcode pattern (≥6 digits, no spaces)', async () => {
    const product = makeProduct({ barcode: '7790001001', is_active: true })
    vi.mocked(productsApi.byBarcode).mockResolvedValue(product)

    const { result } = renderHook(() => usePOS())

    await act(async () => {
      result.current.search('7790001001')
    })

    expect(vi.mocked(productsApi.byBarcode)).toHaveBeenCalledWith('7790001001')
  })

  it('does not treat short numeric strings as barcodes', async () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => usePOS())

    act(() => { result.current.search('12345') }) // 5 digits — not a barcode
    await vi.runAllTimersAsync()

    expect(vi.mocked(productsApi.byBarcode)).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('clears results when query is empty', async () => {
    const { result } = renderHook(() => usePOS())

    act(() => { result.current.search('') })

    expect(result.current.searchResults).toHaveLength(0)
    expect(result.current.query).toBe('')
  })
})

// ── validateMixed ─────────────────────────────────────────────────

describe('usePOS — validateMixed', () => {
  function setupCart() {
    const { result } = renderHook(() => usePOS())
    act(() => { result.current.addToCart(makeProduct({ price: 100 })) })
    // total = 100 * 1.21 = 121
    return result
  }

  it('returns error when fewer than 2 active methods', () => {
    const result = setupCart()
    const err = result.current.validateMixed([
      { method: 'cash', amount: 121 },
      { method: 'card', amount: 0 },
    ])
    expect(err).toMatch(/al menos 2 métodos/)
  })

  it('returns error when sum doesn\'t match total', () => {
    const result = setupCart()
    const err = result.current.validateMixed([
      { method: 'cash', amount: 50 },
      { method: 'card', amount: 50 },
    ])
    expect(err).toMatch(/no coincide/)
  })

  it('returns null when amounts match total within tolerance', () => {
    const result = setupCart()
    const err = result.current.validateMixed([
      { method: 'cash', amount: 61 },
      { method: 'card', amount: 60 },
    ])
    expect(err).toBeNull()
  })
})

// ── Checkout offline ──────────────────────────────────────────────

describe('usePOS — checkout offline', () => {
  it('enqueues sale and moves to ticket stage without calling API', async () => {
    useSyncStore.setState({ isOnline: false })

    const { result } = renderHook(() => usePOS())
    act(() => { result.current.addToCart(makeProduct()) })

    await act(async () => {
      await result.current.checkout('cash', { cash_received: 121, change: 0 })
    })

    expect(result.current.stage).toBe('ticket')
    expect(result.current.ticket?.isOffline).toBe(true)
    expect(result.current.ticket?.syncId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )
    expect(result.current.ticket?.sale).toBeNull()
    expect(vi.mocked(salesApi.create)).not.toHaveBeenCalled()
  })

  it('clears cart after offline checkout', async () => {
    useSyncStore.setState({ isOnline: false })

    const { result } = renderHook(() => usePOS())
    act(() => { result.current.addToCart(makeProduct()) })

    await act(async () => {
      await result.current.checkout('cash', { cash_received: 121, change: 0 })
    })

    expect(result.current.items).toHaveLength(0)
  })

  it('persists offline sale to sync queue', async () => {
    useSyncStore.setState({ isOnline: false })

    const { result } = renderHook(() => usePOS())
    act(() => { result.current.addToCart(makeProduct()) })

    await act(async () => {
      await result.current.checkout('cash', { cash_received: 121, change: 0 })
    })

    expect(useSyncStore.getState().pendingSales).toHaveLength(1)
    expect(useSyncStore.getState().pendingSales[0].status).toBe('queued')
  })
})

// ── Checkout online ───────────────────────────────────────────────

describe('usePOS — checkout online', () => {
  it('calls API and shows ticket on success', async () => {
    const sale = {
      id: 'sale-1', branch_id: 'branch-1', customer_id: null, cashier_id: null,
      status: 'completed' as const, subtotal: 100, discount: 0, tax: 21, total: 121,
      payment_method: 'cash' as const, payment_details: { cash_received: 121, change: 0 },
      notes: null, items: [], sync_id: 'sync-1', sync_version: 1,
      created_at: '2024-01-01T00:00:00Z',
    }
    vi.mocked(salesApi.create).mockResolvedValue(sale)

    const { result } = renderHook(() => usePOS())
    act(() => { result.current.addToCart(makeProduct()) })

    await act(async () => {
      await result.current.checkout('cash', { cash_received: 121, change: 0 })
    })

    expect(result.current.stage).toBe('ticket')
    expect(result.current.ticket?.isOffline).toBe(false)
    expect(result.current.ticket?.sale).toEqual(sale)
    expect(result.current.ticket?.syncId).toBeNull()
  })

  it('clears cart on successful online checkout', async () => {
    const sale = {
      id: 'sale-1', branch_id: 'branch-1', customer_id: null, cashier_id: null,
      status: 'completed' as const, subtotal: 100, discount: 0, tax: 21, total: 121,
      payment_method: 'cash' as const, payment_details: {},
      notes: null, items: [], sync_id: 'sync-1', sync_version: 1,
      created_at: '2024-01-01T00:00:00Z',
    }
    vi.mocked(salesApi.create).mockResolvedValue(sale)

    const { result } = renderHook(() => usePOS())
    act(() => { result.current.addToCart(makeProduct()) })

    await act(async () => {
      await result.current.checkout('cash', {})
    })

    expect(result.current.items).toHaveLength(0)
  })

  it('opens stock modal on INSUFFICIENT_STOCK error', async () => {
    const { API_CODES } = await import('@/shared/api/errors')
    vi.mocked(salesApi.create).mockRejectedValue({
      statusCode: 422,
      code:       API_CODES.INSUFFICIENT_STOCK,
      message:    'Sin stock',
      details:    [{ product_id: 'prod-1', product_name: 'X', available: 0, requested: 1 }],
    })

    const { result } = renderHook(() => usePOS())
    act(() => { result.current.addToCart(makeProduct()) })

    await act(async () => {
      await result.current.checkout('cash', { cash_received: 121, change: 0 })
    })

    expect(result.current.stockModal.open).toBe(true)
    expect(result.current.stockModal.details).toHaveLength(1)
    expect(result.current.stage).toBe('cart') // stays on cart
  })

  it('does nothing if cart is empty', async () => {
    const { result } = renderHook(() => usePOS())

    await act(async () => {
      await result.current.checkout('cash', {})
    })

    expect(vi.mocked(salesApi.create)).not.toHaveBeenCalled()
    expect(result.current.stage).toBe('cart')
  })

  it('does nothing if branchId is null', async () => {
    useAuthStore.setState({ user: { ...MOCK_USER, branch_id: null } })

    const { result } = renderHook(() => usePOS())
    act(() => { result.current.addToCart(makeProduct()) })

    await act(async () => {
      await result.current.checkout('cash', {})
    })

    expect(vi.mocked(salesApi.create)).not.toHaveBeenCalled()
  })
})

// ── newSale ───────────────────────────────────────────────────────

describe('usePOS — newSale', () => {
  it('resets stage to cart and clears ticket', async () => {
    useSyncStore.setState({ isOnline: false })

    const { result } = renderHook(() => usePOS())
    act(() => { result.current.addToCart(makeProduct()) })

    await act(async () => {
      await result.current.checkout('cash', { cash_received: 121, change: 0 })
    })

    expect(result.current.stage).toBe('ticket')

    act(() => { result.current.newSale() })

    expect(result.current.stage).toBe('cart')
    expect(result.current.ticket).toBeNull()
  })
})
