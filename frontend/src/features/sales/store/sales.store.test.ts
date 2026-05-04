import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useSalesStore } from './sales.store'
import { API_CODES } from '@/shared/api/errors'
import type { SaleResponse, ApiError, DailySummary } from '@/shared/types'

vi.mock('@/features/sales/api/sales.api', () => ({
  salesApi: {
    create:  vi.fn(),
    list:    vi.fn(),
    byId:    vi.fn(),
    summary: vi.fn(),
    refund:  vi.fn(),
  },
}))

import { salesApi } from '@/features/sales/api/sales.api'

const STORE_INITIAL = {
  items:     [],
  total:     0,
  limit:     50,
  offset:    0,
  filters:   { limit: 50, offset: 0 },
  current:   null,
  summaries: {},
  status:    'idle'  as const,
  error:     null,
  creating:  false,
  refunding: false,
}

function resetStore() {
  useSalesStore.setState(STORE_INITIAL)
  vi.clearAllMocks()
}

function makeSale(overrides: Partial<SaleResponse> = {}): SaleResponse {
  return {
    id:              'sale-1',
    branch_id:       'branch-1',
    customer_id:     null,
    cashier_id:      null,
    status:          'completed',
    subtotal:        100,
    discount:        0,
    tax:             21,
    total:           121,
    payment_method:  'cash',
    payment_details: { cash_received: 121, change: 0 },
    notes:           null,
    items:           [],
    sync_id:         'sync-abc',
    sync_version:    1,
    created_at:      '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeRaceError(): ApiError {
  return { statusCode: 422, code: API_CODES.STOCK_RACE_CONDITION, message: 'race condition' }
}

const CREATE_BODY = {
  branch_id:       'branch-1',
  items:           [{ product_id: 'prod-1', quantity: 1, unit_price: 100 }],
  payment_method:  'cash' as const,
  payment_details: { cash_received: 121, change: 0 },
}

describe('sales.store — create', () => {
  beforeEach(resetStore)
  afterEach(() => vi.useRealTimers())

  it('prepends sale to items and increments total', async () => {
    const sale = makeSale()
    vi.mocked(salesApi.create).mockResolvedValue(sale)

    await useSalesStore.getState().create(CREATE_BODY)

    const state = useSalesStore.getState()
    expect(state.items[0]).toEqual(sale)
    expect(state.total).toBe(1)
  })

  it('sets creating=true during request and false on success', async () => {
    const sale = makeSale()
    let creatingDuring = false
    vi.mocked(salesApi.create).mockImplementation(async () => {
      creatingDuring = useSalesStore.getState().creating
      return sale
    })

    await useSalesStore.getState().create(CREATE_BODY)

    expect(creatingDuring).toBe(true)
    expect(useSalesStore.getState().creating).toBe(false)
  })

  it('retries STOCK_RACE_CONDITION exactly 3 times then throws', async () => {
    vi.useFakeTimers()
    vi.mocked(salesApi.create).mockRejectedValue(makeRaceError())

    const promise = useSalesStore.getState().create(CREATE_BODY)
    promise.catch(() => {}) // prevent unhandled rejection warning while timers run

    await vi.runAllTimersAsync()

    await expect(promise).rejects.toMatchObject({ code: API_CODES.STOCK_RACE_CONDITION })
    expect(vi.mocked(salesApi.create)).toHaveBeenCalledTimes(3)
    expect(useSalesStore.getState().creating).toBe(false)
  })

  it('succeeds on the second attempt after one race condition', async () => {
    vi.useFakeTimers()
    const sale = makeSale()
    vi.mocked(salesApi.create)
      .mockRejectedValueOnce(makeRaceError())
      .mockResolvedValue(sale)

    const promise = useSalesStore.getState().create(CREATE_BODY)
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result).toEqual(sale)
    expect(vi.mocked(salesApi.create)).toHaveBeenCalledTimes(2)
    expect(useSalesStore.getState().items[0]).toEqual(sale)
  })

  it('does NOT retry INSUFFICIENT_STOCK', async () => {
    const insufficientError: ApiError = {
      statusCode: 422,
      code:       API_CODES.INSUFFICIENT_STOCK,
      message:    'Sin stock',
      details:    [],
    }
    vi.mocked(salesApi.create).mockRejectedValue(insufficientError)

    await expect(useSalesStore.getState().create(CREATE_BODY)).rejects.toMatchObject({
      code: API_CODES.INSUFFICIENT_STOCK,
    })
    expect(vi.mocked(salesApi.create)).toHaveBeenCalledTimes(1)
    expect(useSalesStore.getState().creating).toBe(false)
  })

  it('invalidates today\'s summary cache for the sale branch on success', async () => {
    const sale    = makeSale()
    const today   = new Date().toISOString().slice(0, 10)
    const cacheKey = `${sale.branch_id}:${today}`
    const summary: DailySummary = {
      total_sales: 5, total_revenue: 500,
      cash: 300, card: 200, transfer: 0, mp: 0, avg_ticket: 100,
    }
    useSalesStore.setState({ summaries: { [cacheKey]: summary } })
    vi.mocked(salesApi.create).mockResolvedValue(sale)

    await useSalesStore.getState().create(CREATE_BODY)

    expect(useSalesStore.getState().summaries[cacheKey]).toBeUndefined()
  })

  it('preserves other branch summaries when invalidating', async () => {
    const sale     = makeSale({ branch_id: 'branch-1' })
    const today    = new Date().toISOString().slice(0, 10)
    const otherKey = `branch-other:${today}`
    useSalesStore.setState({ summaries: { [otherKey]: { total_sales: 3 } as DailySummary } })
    vi.mocked(salesApi.create).mockResolvedValue(sale)

    await useSalesStore.getState().create(CREATE_BODY)

    expect(useSalesStore.getState().summaries[otherKey]).toBeDefined()
  })
})

describe('sales.store — refund', () => {
  beforeEach(resetStore)

  it('optimistically marks sale as refunded before API responds', async () => {
    const sale    = makeSale({ status: 'completed' })
    const refunded = makeSale({ status: 'refunded' })
    useSalesStore.setState({ items: [sale] })

    let statusDuringCall = ''
    vi.mocked(salesApi.refund).mockImplementation(async () => {
      statusDuringCall = useSalesStore.getState().items[0].status
      return refunded
    })

    await useSalesStore.getState().refund('sale-1', { reason: 'test' })

    expect(statusDuringCall).toBe('refunded')
    expect(useSalesStore.getState().items[0]).toEqual(refunded)
  })

  it('sets refunding=false on success', async () => {
    const sale    = makeSale({ status: 'completed' })
    const refunded = makeSale({ status: 'refunded' })
    useSalesStore.setState({ items: [sale] })
    vi.mocked(salesApi.refund).mockResolvedValue(refunded)

    await useSalesStore.getState().refund('sale-1', { reason: 'test' })

    expect(useSalesStore.getState().refunding).toBe(false)
  })

  it('updates current if the refunded sale is selected', async () => {
    const sale    = makeSale({ status: 'completed' })
    const refunded = makeSale({ status: 'refunded' })
    useSalesStore.setState({ items: [sale], current: sale })
    vi.mocked(salesApi.refund).mockResolvedValue(refunded)

    await useSalesStore.getState().refund('sale-1', { reason: 'test' })

    expect(useSalesStore.getState().current?.status).toBe('refunded')
  })

  it('leaves current unchanged if a different sale is selected', async () => {
    const sale       = makeSale({ id: 'sale-1', status: 'completed' })
    const otherSale  = makeSale({ id: 'sale-2', status: 'completed' })
    const refunded   = makeSale({ id: 'sale-1', status: 'refunded' })
    useSalesStore.setState({ items: [sale], current: otherSale })
    vi.mocked(salesApi.refund).mockResolvedValue(refunded)

    await useSalesStore.getState().refund('sale-1', { reason: 'test' })

    expect(useSalesStore.getState().current?.id).toBe('sale-2')
  })

  it('restores snapshot and sets refunding=false on API failure', async () => {
    const sale = makeSale({ status: 'completed' })
    useSalesStore.setState({ items: [sale] })
    vi.mocked(salesApi.refund).mockRejectedValue(new Error('server error'))

    await expect(useSalesStore.getState().refund('sale-1', { reason: 'test' })).rejects.toThrow()

    expect(useSalesStore.getState().items[0].status).toBe('completed')
    expect(useSalesStore.getState().refunding).toBe(false)
  })

  it('invalidates today\'s summary on successful refund', async () => {
    const sale    = makeSale({ status: 'completed' })
    const refunded = makeSale({ status: 'refunded' })
    const today   = new Date().toISOString().slice(0, 10)
    const cacheKey = `branch-1:${today}`
    useSalesStore.setState({
      items:     [sale],
      summaries: { [cacheKey]: { total_sales: 5 } as DailySummary },
    })
    vi.mocked(salesApi.refund).mockResolvedValue(refunded)

    await useSalesStore.getState().refund('sale-1', { reason: 'test' })

    expect(useSalesStore.getState().summaries[cacheKey]).toBeUndefined()
  })
})

describe('sales.store — fetchSummary', () => {
  beforeEach(resetStore)

  it('fetches from API on cache miss', async () => {
    const summary: DailySummary = {
      total_sales: 10, total_revenue: 1000,
      cash: 500, card: 500, transfer: 0, mp: 0, avg_ticket: 100,
    }
    vi.mocked(salesApi.summary).mockResolvedValue(summary)

    const result = await useSalesStore.getState().fetchSummary('branch-1', '2024-01-15')

    expect(result).toEqual(summary)
    expect(vi.mocked(salesApi.summary)).toHaveBeenCalledWith('branch-1', '2024-01-15')
  })

  it('returns cached value without calling API on second request', async () => {
    const summary: DailySummary = {
      total_sales: 10, total_revenue: 1000,
      cash: 500, card: 500, transfer: 0, mp: 0, avg_ticket: 100,
    }
    vi.mocked(salesApi.summary).mockResolvedValue(summary)

    await useSalesStore.getState().fetchSummary('branch-1', '2024-01-15')
    vi.clearAllMocks()

    const result = await useSalesStore.getState().fetchSummary('branch-1', '2024-01-15')

    expect(result).toEqual(summary)
    expect(vi.mocked(salesApi.summary)).not.toHaveBeenCalled()
  })
})
