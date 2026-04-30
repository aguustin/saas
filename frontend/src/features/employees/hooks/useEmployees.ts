import { useCallback, useEffect, useRef, useState } from 'react'
import { useEmployeeStore } from '@/features/employees/store/employees.store'
import { useBillingStore } from '@/features/billing/store/billing.store'
import { useAuth } from '@/features/auth/hooks/useAuth'
import type { EmployeeFilters } from '@/features/employees/api/employees.api'

const PAGE_SIZE          = 20
const SEARCH_DEBOUNCE_MS = 300

export function useEmployees() {
  const fetch       = useEmployeeStore(s => s.fetch)
  const items       = useEmployeeStore(s => s.items)
  const total       = useEmployeeStore(s => s.total)
  const status      = useEmployeeStore(s => s.status)
  const error       = useEmployeeStore(s => s.error)
  const isBlocked   = useBillingStore(s => s.isBlocked)
  const { branchId } = useAuth()

  // ── Filtros locales ───────────────────────────────────────────

  const [search,   setSearchRaw] = useState('')
  const [isActive, setIsActive]  = useState<boolean | undefined>(undefined)
  const [sortBy,   setSortBy]    = useState<EmployeeFilters['sort_by']>('first_name')
  const [sortDir,  setSortDir]   = useState<EmployeeFilters['sort_dir']>('asc')
  const [page,     setPage]      = useState(1)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const doFetch = useCallback((overrides: Partial<EmployeeFilters> = {}) => {
    const base: EmployeeFilters = {
      search:    search || undefined,
      is_active: isActive,
      sort_by:   sortBy,
      sort_dir:  sortDir,
      limit:     PAGE_SIZE,
      offset:    (page - 1) * PAGE_SIZE,
      ...overrides,
    }
    void fetch(base)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, isActive, sortBy, sortDir, page])

  useEffect(() => {
    doFetch()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, sortBy, sortDir, page])

  const setSearch = useCallback((q: string) => {
    setSearchRaw(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setPage(1)
      doFetch({ search: q || undefined, offset: 0 })
    }, SEARCH_DEBOUNCE_MS)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doFetch])

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
  }, [])

  // ── Setters con reset de página ───────────────────────────────

  function changeIsActive(val: boolean | undefined) {
    setIsActive(val)
    setPage(1)
  }

  function changeSort(by: EmployeeFilters['sort_by']) {
    if (by === sortBy) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(by)
      setSortDir('asc')
    }
    setPage(1)
  }

  // ── Paginación ────────────────────────────────────────────────

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  function goToPage(p: number) {
    if (p < 1 || p > pageCount) return
    setPage(p)
  }

  return {
    items,
    total,
    loading: status === 'loading',
    error,

    search,
    setSearch,
    isActive,
    changeIsActive,
    sortBy,
    sortDir,
    changeSort,

    page,
    pageCount,
    pageSize: PAGE_SIZE,
    goToPage,

    canCreate: !isBlocked('employees'),
    defaultBranchId: branchId,

    refresh: () => doFetch(),
  }
}
