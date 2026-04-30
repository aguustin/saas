import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useProductStore } from './products.store'
import type { ProductResponse } from '@/shared/types'

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

vi.mock('@/features/billing/store/billing.store', () => ({
  useBillingStore: { getState: () => ({ refreshLimits: vi.fn() }) },
}))

import { productsApi } from '@/features/products/api/products.api'

const STORE_INITIAL = {
  items:    [],
  total:    0,
  limit:    50,
  offset:   0,
  filters:  { limit: 50, offset: 0, sort_by: 'name' as const, sort_dir: 'asc' as const },
  status:   'idle' as const,
  error:    null,
  mutating: false,
  byId:     {},
  byBarcode:{},
}

function resetStore() {
  useProductStore.setState(STORE_INITIAL)
  vi.clearAllMocks()
}

function makeProduct(overrides: Partial<ProductResponse> = {}): ProductResponse {
  return {
    id:           'prod-1',
    name:         'Coca Cola',
    description:  null,
    sku:          null,
    barcode:      '7790001001',
    price:        150,
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

describe('products.store — fetchBarcode', () => {
  beforeEach(resetStore)

  it('calls the API on cache miss', async () => {
    const product = makeProduct()
    vi.mocked(productsApi.byBarcode).mockResolvedValue(product)

    const result = await useProductStore.getState().fetchBarcode('7790001001')

    expect(vi.mocked(productsApi.byBarcode)).toHaveBeenCalledWith('7790001001')
    expect(result).toEqual(product)
  })

  it('stores the product in byBarcode and byId caches', async () => {
    const product = makeProduct()
    vi.mocked(productsApi.byBarcode).mockResolvedValue(product)

    await useProductStore.getState().fetchBarcode('7790001001')

    expect(useProductStore.getState().byBarcode['7790001001']).toEqual(product)
    expect(useProductStore.getState().byId['prod-1']).toEqual(product)
  })

  it('returns cached value on second call without hitting the API', async () => {
    const product = makeProduct()
    vi.mocked(productsApi.byBarcode).mockResolvedValue(product)

    await useProductStore.getState().fetchBarcode('7790001001')
    vi.clearAllMocks()

    const result = await useProductStore.getState().fetchBarcode('7790001001')

    expect(result).toEqual(product)
    expect(vi.mocked(productsApi.byBarcode)).not.toHaveBeenCalled()
  })

  it('propagates API errors', async () => {
    vi.mocked(productsApi.byBarcode).mockRejectedValue(new Error('Not found'))
    await expect(useProductStore.getState().fetchBarcode('9999')).rejects.toThrow('Not found')
  })
})

describe('products.store — toggleActive', () => {
  beforeEach(resetStore)

  it('applies optimistic update immediately', async () => {
    const product = makeProduct({ is_active: true })
    const updated = { ...product, is_active: false }
    useProductStore.setState({ items: [product], byId: { [product.id]: product } })
    vi.mocked(productsApi.patchActive).mockResolvedValue(updated)

    const promise = useProductStore.getState().toggleActive(product.id, false)
    // Optimistic update happens synchronously before await
    expect(useProductStore.getState().items[0].is_active).toBe(false)
    await promise
  })

  it('confirms with the server response', async () => {
    const product = makeProduct({ is_active: true })
    const updated = { ...product, is_active: false, sync_version: 2 }
    useProductStore.setState({ items: [product], byId: { [product.id]: product } })
    vi.mocked(productsApi.patchActive).mockResolvedValue(updated)

    await useProductStore.getState().toggleActive(product.id, false)

    expect(useProductStore.getState().items[0]).toEqual(updated)
    expect(useProductStore.getState().byId[product.id]).toEqual(updated)
  })

  it('rolls back optimistic update on API failure', async () => {
    const product = makeProduct({ is_active: true })
    useProductStore.setState({ items: [product], byId: { [product.id]: product } })
    vi.mocked(productsApi.patchActive).mockRejectedValue(new Error('Network error'))

    await expect(useProductStore.getState().toggleActive(product.id, false)).rejects.toThrow()

    expect(useProductStore.getState().items[0].is_active).toBe(true)
  })
})

describe('products.store — remove', () => {
  beforeEach(resetStore)

  it('optimistically removes product and decrements total', async () => {
    const product = makeProduct()
    useProductStore.setState({ items: [product], total: 1 })
    vi.mocked(productsApi.remove).mockResolvedValue(undefined)

    const promise = useProductStore.getState().remove(product.id)
    // Optimistic remove is immediate
    expect(useProductStore.getState().items).toHaveLength(0)
    expect(useProductStore.getState().total).toBe(0)
    await promise
  })

  it('removes product from byId cache on success', async () => {
    const product = makeProduct()
    useProductStore.setState({
      items: [product], total: 1,
      byId:  { [product.id]: product },
    })
    vi.mocked(productsApi.remove).mockResolvedValue(undefined)

    await useProductStore.getState().remove(product.id)

    expect(useProductStore.getState().byId[product.id]).toBeUndefined()
  })

  it('restores items and total on API failure', async () => {
    const product = makeProduct()
    useProductStore.setState({ items: [product], total: 1 })
    vi.mocked(productsApi.remove).mockRejectedValue(new Error('server error'))

    await expect(useProductStore.getState().remove(product.id)).rejects.toThrow()

    expect(useProductStore.getState().items).toHaveLength(1)
    expect(useProductStore.getState().total).toBe(1)
  })
})

describe('products.store — bulkRemove', () => {
  beforeEach(resetStore)

  it('removes all specified products optimistically', async () => {
    const p1 = makeProduct({ id: 'p1' })
    const p2 = makeProduct({ id: 'p2' })
    const p3 = makeProduct({ id: 'p3' })
    useProductStore.setState({ items: [p1, p2, p3], total: 3 })
    vi.mocked(productsApi.bulkRemove).mockResolvedValue(undefined)

    const promise = useProductStore.getState().bulkRemove(['p1', 'p2'])
    expect(useProductStore.getState().items).toHaveLength(1)
    expect(useProductStore.getState().items[0].id).toBe('p3')
    expect(useProductStore.getState().total).toBe(1)
    await promise
  })

  it('restores state on failure', async () => {
    const p1 = makeProduct({ id: 'p1' })
    const p2 = makeProduct({ id: 'p2' })
    useProductStore.setState({ items: [p1, p2], total: 2 })
    vi.mocked(productsApi.bulkRemove).mockRejectedValue(new Error('fail'))

    await expect(useProductStore.getState().bulkRemove(['p1', 'p2'])).rejects.toThrow()

    expect(useProductStore.getState().items).toHaveLength(2)
    expect(useProductStore.getState().total).toBe(2)
  })
})
