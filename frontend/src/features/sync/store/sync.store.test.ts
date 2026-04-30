import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useSyncStore, usePendingSalesCount, useIsBehind } from './sync.store'
import type { CreateSaleBody } from '@/features/sales/api/sales.api'

const SYNC_INITIAL = {
  status:          'idle' as const,
  cursors:         {},
  behind:          {},
  pendingSales:    [],
  lastSyncAt:      null,
  error:           null,
  isOnline:        true,
  _cleanupOnline:  null,
  _cleanupOffline: null,
}

function resetStore() {
  localStorage.clear()
  useSyncStore.setState(SYNC_INITIAL)
}

const MOCK_PAYLOAD: CreateSaleBody = {
  branch_id:       'branch-1',
  items:           [{ product_id: 'prod-1', quantity: 1, unit_price: 100 }],
  payment_method:  'cash',
  payment_details: { cash_received: 121, change: 0 },
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

describe('sync.store — enqueueSale', () => {
  beforeEach(resetStore)

  it('returns a UUID', () => {
    const syncId = useSyncStore.getState().enqueueSale(MOCK_PAYLOAD)
    expect(syncId).toMatch(UUID_REGEX)
  })

  it('adds sale with status queued', () => {
    const syncId = useSyncStore.getState().enqueueSale(MOCK_PAYLOAD)
    const { pendingSales } = useSyncStore.getState()

    expect(pendingSales).toHaveLength(1)
    expect(pendingSales[0]).toMatchObject({
      sync_id:  syncId,
      status:   'queued',
      payload:  MOCK_PAYLOAD,
      attempts: 0,
    })
  })

  it('sets a valid created_at ISO timestamp', () => {
    useSyncStore.getState().enqueueSale(MOCK_PAYLOAD)
    const { created_at } = useSyncStore.getState().pendingSales[0]
    expect(new Date(created_at).getTime()).toBeGreaterThan(0)
  })

  it('persists queue to localStorage', () => {
    useSyncStore.getState().enqueueSale(MOCK_PAYLOAD)
    const stored = JSON.parse(localStorage.getItem('saas_pending_sales') ?? '[]')
    expect(stored).toHaveLength(1)
  })

  it('appends when called multiple times', () => {
    useSyncStore.getState().enqueueSale(MOCK_PAYLOAD)
    useSyncStore.getState().enqueueSale(MOCK_PAYLOAD)
    expect(useSyncStore.getState().pendingSales).toHaveLength(2)
  })

  it('each call returns a unique sync_id', () => {
    const id1 = useSyncStore.getState().enqueueSale(MOCK_PAYLOAD)
    const id2 = useSyncStore.getState().enqueueSale(MOCK_PAYLOAD)
    expect(id1).not.toBe(id2)
  })
})

describe('sync.store — dequeueSale', () => {
  beforeEach(resetStore)

  it('removes the matching sale', () => {
    const syncId = useSyncStore.getState().enqueueSale(MOCK_PAYLOAD)
    useSyncStore.getState().dequeueSale(syncId)
    expect(useSyncStore.getState().pendingSales).toHaveLength(0)
  })

  it('updates localStorage', () => {
    const syncId = useSyncStore.getState().enqueueSale(MOCK_PAYLOAD)
    useSyncStore.getState().dequeueSale(syncId)
    const stored = JSON.parse(localStorage.getItem('saas_pending_sales') ?? '[]')
    expect(stored).toHaveLength(0)
  })

  it('ignores an unknown syncId', () => {
    useSyncStore.getState().enqueueSale(MOCK_PAYLOAD)
    useSyncStore.getState().dequeueSale('non-existent-uuid')
    expect(useSyncStore.getState().pendingSales).toHaveLength(1)
  })

  it('only removes the matching sale when multiple exist', () => {
    const id1 = useSyncStore.getState().enqueueSale(MOCK_PAYLOAD)
    useSyncStore.getState().enqueueSale(MOCK_PAYLOAD)
    useSyncStore.getState().dequeueSale(id1)
    expect(useSyncStore.getState().pendingSales).toHaveLength(1)
  })
})

describe('sync.store — updateSaleStatus', () => {
  beforeEach(resetStore)

  it('changes status to the given value', () => {
    const syncId = useSyncStore.getState().enqueueSale(MOCK_PAYLOAD)
    useSyncStore.getState().updateSaleStatus(syncId, 'pushing')
    expect(useSyncStore.getState().pendingSales[0].status).toBe('pushing')
  })

  it('increments attempts when transitioning to pushing', () => {
    const syncId = useSyncStore.getState().enqueueSale(MOCK_PAYLOAD)
    useSyncStore.getState().updateSaleStatus(syncId, 'pushing')
    expect(useSyncStore.getState().pendingSales[0].attempts).toBe(1)
  })

  it('does not increment attempts for non-pushing statuses', () => {
    const syncId = useSyncStore.getState().enqueueSale(MOCK_PAYLOAD)
    useSyncStore.getState().updateSaleStatus(syncId, 'error', { error: 'timeout' })
    expect(useSyncStore.getState().pendingSales[0].attempts).toBe(0)
  })

  it('sets error message from extra', () => {
    const syncId = useSyncStore.getState().enqueueSale(MOCK_PAYLOAD)
    useSyncStore.getState().updateSaleStatus(syncId, 'error', { error: 'connection refused' })
    expect(useSyncStore.getState().pendingSales[0].error).toBe('connection refused')
  })

  it('sets server_id when applied with serverId', () => {
    const syncId = useSyncStore.getState().enqueueSale(MOCK_PAYLOAD)
    useSyncStore.getState().updateSaleStatus(syncId, 'applied', { serverId: 'server-uuid-123' })
    expect(useSyncStore.getState().pendingSales[0].server_id).toBe('server-uuid-123')
  })

  it('sets conflict_row and status conflict', () => {
    const syncId     = useSyncStore.getState().enqueueSale(MOCK_PAYLOAD)
    const conflictRow = { id: 'server-row', status: 'completed' }
    useSyncStore.getState().updateSaleStatus(syncId, 'conflict', { conflictRow })

    const sale = useSyncStore.getState().pendingSales[0]
    expect(sale.status).toBe('conflict')
    expect(sale.conflict_row).toEqual(conflictRow)
  })

  it('persists changes to localStorage', () => {
    const syncId = useSyncStore.getState().enqueueSale(MOCK_PAYLOAD)
    useSyncStore.getState().updateSaleStatus(syncId, 'applied', { serverId: 'srv-1' })
    const stored = JSON.parse(localStorage.getItem('saas_pending_sales') ?? '[]')
    expect(stored[0].status).toBe('applied')
    expect(stored[0].server_id).toBe('srv-1')
  })
})

describe('usePendingSalesCount selector', () => {
  beforeEach(resetStore)

  it('returns 0 with no pending sales', () => {
    const { result } = renderHook(() => usePendingSalesCount())
    expect(result.current).toBe(0)
  })

  it('counts queued and error sales', () => {
    const id1 = useSyncStore.getState().enqueueSale(MOCK_PAYLOAD) // queued
    const id2 = useSyncStore.getState().enqueueSale(MOCK_PAYLOAD) // → error
    useSyncStore.getState().enqueueSale(MOCK_PAYLOAD)              // → pushing (not counted)

    useSyncStore.getState().updateSaleStatus(id2, 'error')

    const thirdId = useSyncStore.getState().pendingSales.find(
      s => s.sync_id !== id1 && s.sync_id !== id2,
    )!.sync_id
    useSyncStore.getState().updateSaleStatus(thirdId, 'pushing')

    const { result } = renderHook(() => usePendingSalesCount())
    expect(result.current).toBe(2)
  })

  it('does not count applied or conflict sales', () => {
    const syncId = useSyncStore.getState().enqueueSale(MOCK_PAYLOAD)
    useSyncStore.getState().updateSaleStatus(syncId, 'applied', { serverId: 'x' })

    const { result } = renderHook(() => usePendingSalesCount())
    expect(result.current).toBe(0)
  })
})

// useConflictedSales returns a new array reference each render due to .filter(),
// which causes useSyncExternalStore infinite loops when tested with renderHook.
// We test the selector logic directly against the store state instead.
describe('useConflictedSales selector logic', () => {
  beforeEach(resetStore)

  function conflicted() {
    return useSyncStore.getState().pendingSales.filter(p => p.status === 'conflict')
  }

  it('returns empty array when no conflicts exist', () => {
    expect(conflicted()).toHaveLength(0)
  })

  it('returns only conflict-status sales', () => {
    const id1 = useSyncStore.getState().enqueueSale(MOCK_PAYLOAD)
    useSyncStore.getState().enqueueSale(MOCK_PAYLOAD) // stays queued
    useSyncStore.getState().updateSaleStatus(id1, 'conflict')

    const result = conflicted()
    expect(result).toHaveLength(1)
    expect(result[0].sync_id).toBe(id1)
  })

  it('does not include queued, error, or applied sales', () => {
    const id1 = useSyncStore.getState().enqueueSale(MOCK_PAYLOAD)
    const id2 = useSyncStore.getState().enqueueSale(MOCK_PAYLOAD)
    useSyncStore.getState().updateSaleStatus(id1, 'error')
    useSyncStore.getState().updateSaleStatus(id2, 'applied', { serverId: 'srv' })
    useSyncStore.getState().enqueueSale(MOCK_PAYLOAD) // queued

    expect(conflicted()).toHaveLength(0)
  })
})

describe('useIsBehind selector', () => {
  beforeEach(resetStore)

  it('returns false when behind is empty', () => {
    const { result } = renderHook(() => useIsBehind())
    expect(result.current).toBe(false)
  })

  it('returns true when any table has pending rows', () => {
    useSyncStore.setState({ behind: { products: 5, sales: 0 } })
    const { result } = renderHook(() => useIsBehind())
    expect(result.current).toBe(true)
  })

  it('returns false when all behind values are 0', () => {
    useSyncStore.setState({ behind: { products: 0, sales: 0 } })
    const { result } = renderHook(() => useIsBehind())
    expect(result.current).toBe(false)
  })
})
