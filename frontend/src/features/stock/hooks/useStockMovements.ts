import { useCallback, useEffect, useState } from 'react'
import { useStockStore } from '@/features/stock/store/stock.store'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { todayISO } from '@/shared/utils/date'
import type { MovementFilters } from '@/features/stock/api/stock.api'
import type { StockMovementType } from '@/shared/types'

const PAGE_SIZE = 25

export function useStockMovements() {
  const fetchMovements = useStockStore(s => s.fetchMovements)
  const movements      = useStockStore(s => s.movements)
  const total          = useStockStore(s => s.movementsTotal)
  const status         = useStockStore(s => s.movStatus)
  const { branchId }   = useAuth()

  const today = todayISO()

  // ── Filtros locales ───────────────────────────────────────────

  const [type,     setType]     = useState<StockMovementType | ''>('')
  const [dateFrom, setDateFrom] = useState(today)
  const [dateTo,   setDateTo]   = useState(today)
  const [offset,   setOffset]   = useState(0)

  const doFetch = useCallback((overrides: Partial<MovementFilters> = {}) => {
    void fetchMovements({
      branch_id: branchId ?? undefined,
      type:      type      || undefined,
      date_from: dateFrom  || undefined,
      date_to:   dateTo    || undefined,
      limit:     PAGE_SIZE,
      offset,
      ...overrides,
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, dateFrom, dateTo, offset, branchId])

  useEffect(() => {
    doFetch()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, dateFrom, dateTo, offset])

  function changeType(val: StockMovementType | '') {
    setType(val)
    setOffset(0)
  }

  function changeDate(field: 'from' | 'to', val: string) {
    if (field === 'from') setDateFrom(val)
    else                  setDateTo(val)
    setOffset(0)
  }

  function setRangeToday() {
    setDateFrom(today)
    setDateTo(today)
    setOffset(0)
  }

  function setRangeLast7() {
    const from = new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10)
    setDateFrom(from)
    setDateTo(today)
    setOffset(0)
  }

  function setRangeThisMonth() {
    const d    = new Date()
    const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
    setDateFrom(from)
    setDateTo(today)
    setOffset(0)
  }

  return {
    movements,
    total,
    loading: status === 'loading',

    type,     changeType,
    dateFrom, dateTo, changeDate,
    setRangeToday, setRangeLast7, setRangeThisMonth,

    offset,
    limit: PAGE_SIZE,
    onOffsetChange: (o: number) => setOffset(o),

    refresh: () => doFetch(),
  }
}
