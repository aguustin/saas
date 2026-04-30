import { useCallback, useEffect, useRef, useState } from 'react'
import { useStockStore } from '@/features/stock/store/stock.store'
import { useAuth } from '@/features/auth/hooks/useAuth'
import type { StockFilters } from '@/features/stock/api/stock.api'

const PAGE_SIZE          = 25
const SEARCH_DEBOUNCE_MS = 300

export function useStock() {
  const fetchStock  = useStockStore(s => s.fetchStock)
  const items       = useStockStore(s => s.items)
  const total       = useStockStore(s => s.itemsTotal)
  const status      = useStockStore(s => s.itemsStatus)
  const alerts      = useStockStore(s => s.alerts)
  const { branchId } = useAuth()

  // ── Filtros locales ───────────────────────────────────────────

  const [search,   setSearchRaw] = useState('')
  const [isLow,    setIsLow]     = useState<boolean | undefined>(undefined)
  const [sortBy,   setSortBy]    = useState<StockFilters['sort_by']>('product_name')
  const [sortDir,  setSortDir]   = useState<StockFilters['sort_dir']>('asc')
  const [offset,   setOffset]    = useState(0)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const doFetch = useCallback((overrides: Partial<StockFilters> = {}) => {
    void fetchStock({
      search:    search || undefined,
      branch_id: branchId ?? undefined,
      is_low:    isLow,
      sort_by:   sortBy,
      sort_dir:  sortDir,
      limit:     PAGE_SIZE,
      offset,
      ...overrides,
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, isLow, sortBy, sortDir, offset, branchId])

  useEffect(() => {
    doFetch()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLow, sortBy, sortDir, offset])

  const setSearch = useCallback((q: string) => {
    setSearchRaw(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setOffset(0)
      doFetch({ search: q || undefined, offset: 0 })
    }, SEARCH_DEBOUNCE_MS)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doFetch])

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
  }, [])

  function changeIsLow(val: boolean | undefined) {
    setIsLow(val)
    setOffset(0)
  }

  function changeSort(by: StockFilters['sort_by']) {
    if (by === sortBy) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(by)
      setSortDir('asc')
    }
    setOffset(0)
  }

  return {
    items,
    total,
    loading: status === 'loading',
    alertCount: alerts.length,

    search,    setSearch,
    isLow,     changeIsLow,
    sortBy,    sortDir,  changeSort,

    offset,
    limit: PAGE_SIZE,
    onOffsetChange: (o: number) => setOffset(o),

    refresh: () => doFetch(),
  }
}
