import { useCallback, useEffect, useRef, useState } from 'react'
import { useProductStore } from '@/features/products/store/products.store'
import { useBillingStore } from '@/features/billing/store/billing.store'
import type { ProductFilters } from '@/features/products/api/products.api'

const PAGE_SIZE = 20
const SEARCH_DEBOUNCE_MS = 300

// ── Hook principal ────────────────────────────────────────────────

export function useProducts() {
  const fetch       = useProductStore(s => s.fetch)
  const items       = useProductStore(s => s.items)
  const total       = useProductStore(s => s.total)
  const status      = useProductStore(s => s.status)
  const error       = useProductStore(s => s.error)
  const storeFilters = useProductStore(s => s.filters)
  const setFilters  = useProductStore(s => s.setFilters)

  const isBlocked   = useBillingStore(s => s.isBlocked)

  // ── Filtros locales ───────────────────────────────────────────

  const [search,    setSearchRaw]  = useState(storeFilters.search ?? '')
  const [isActive,  setIsActive]   = useState<boolean | undefined>(storeFilters.is_active)
  const [sortBy,    setSortBy]     = useState<ProductFilters['sort_by']>(storeFilters.sort_by ?? 'name')
  const [sortDir,   setSortDir]    = useState<ProductFilters['sort_dir']>(storeFilters.sort_dir ?? 'asc')
  const [page,      setPage]       = useState(1)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Fetch central ─────────────────────────────────────────────
  // Cualquier cambio de filtros llama a este fetch.
  // `page` se calcula a partir del pageSize fijo.

  const doFetch = useCallback((overrides: Partial<ProductFilters> = {}) => {
    const base: ProductFilters = {
      search:    search || undefined,
      is_active: isActive,
      sort_by:   sortBy,
      sort_dir:  sortDir,
      limit:     PAGE_SIZE,
      offset:    (page - 1) * PAGE_SIZE,
      ...overrides,
    }
    setFilters(base)
    void fetch(base)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, isActive, sortBy, sortDir, page])

  // Fetch inicial y cuando cambian filtros que no son search
  useEffect(() => {
    doFetch()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, sortBy, sortDir, page])

  // ── Búsqueda con debounce ─────────────────────────────────────

  const setSearch = useCallback((q: string) => {
    setSearchRaw(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setPage(1)   // resetear a página 1 al buscar
      doFetch({ search: q || undefined, offset: 0 })
    }, SEARCH_DEBOUNCE_MS)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doFetch])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  // ── Setters con reset de página ───────────────────────────────

  function changeIsActive(val: boolean | undefined) {
    setIsActive(val)
    setPage(1)
  }

  function changeSortBy(val: ProductFilters['sort_by']) {
    setSortBy(val)
    setPage(1)
  }

  function changeSortDir(val: ProductFilters['sort_dir']) {
    setSortDir(val)
    setPage(1)
  }

  function changeSort(by: ProductFilters['sort_by']) {
    if (by === sortBy) {
      changeSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      changeSortBy(by)
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

  // ── Selección masiva ──────────────────────────────────────────

  const [selected, setSelected] = useState<Set<string>>(new Set())

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selected.size === items.length && items.length > 0) {
      setSelected(new Set())
    } else {
      setSelected(new Set(items.map(p => p.id)))
    }
  }

  function clearSelection() {
    setSelected(new Set())
  }

  // Limpiar selección al cambiar página o filtros
  useEffect(() => {
    setSelected(new Set())
  }, [page, isActive, search])

  return {
    // Datos
    items,
    total,
    loading: status === 'loading',
    error,

    // Filtros
    search,
    setSearch,
    isActive,
    changeIsActive,
    sortBy,
    sortDir,
    changeSort,

    // Paginación
    page,
    pageCount,
    pageSize: PAGE_SIZE,
    goToPage,

    // Selección masiva
    selected,
    toggleSelect,
    toggleSelectAll,
    clearSelection,

    // Billing
    canCreate: !isBlocked('products'),

    // Refresh manual
    refresh: () => doFetch(),
  }
}
