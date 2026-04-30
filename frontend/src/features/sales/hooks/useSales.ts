import { useCallback, useEffect, useState } from 'react'
import { useSalesStore, useDailySummary } from '@/features/sales/store/sales.store'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { todayISO, localDayStart, localDayEnd } from '@/shared/utils/date'
import type { SalesFilters } from '@/features/sales/api/sales.api'
import type { SaleStatus } from '@/shared/types'

const PAGE_SIZE = 25

// ── Hook principal ────────────────────────────────────────────────

export function useSales() {
  const fetch       = useSalesStore(s => s.fetch)
  const items       = useSalesStore(s => s.items)
  const total       = useSalesStore(s => s.total)
  const status      = useSalesStore(s => s.status)
  const fetchSummary = useSalesStore(s => s.fetchSummary)

  const { branchId } = useAuth()

  // ── Filtros locales ───────────────────────────────────────────

  const [dateFrom,   setDateFrom]   = useState(todayISO())
  const [dateTo,     setDateTo]     = useState(todayISO())
  const [saleStatus, setSaleStatus] = useState<SaleStatus | ''>('')
  const [page,       setPage]       = useState(1)

  // ── Resumen diario ────────────────────────────────────────────
  // Solo se muestra cuando los filtros apuntan a un único día (hoy).

  const summaryDate = dateFrom === dateTo ? dateFrom : null
  const summary = useDailySummary(branchId ?? '', summaryDate ?? '')

  useEffect(() => {
    if (summaryDate && branchId) {
      void fetchSummary(branchId, summaryDate)
    }
  }, [summaryDate, branchId, fetchSummary])

  // ── Fetch central ─────────────────────────────────────────────

  const doFetch = useCallback((overrides: Partial<SalesFilters> = {}) => {
    const base: SalesFilters = {
      branch_id: branchId ?? undefined,
      // Convertir "YYYY-MM-DD" a ISO datetime completo para pasar la validación
      // z.string().datetime() del backend y cubrir toda la jornada local.
      date_from: dateFrom ? localDayStart(dateFrom) : undefined,
      date_to:   dateTo   ? localDayEnd(dateTo)     : undefined,
      status:    saleStatus || undefined,
      limit:     PAGE_SIZE,
      offset:    (page - 1) * PAGE_SIZE,
      ...overrides,
    }
    void fetch(base)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, saleStatus, page, branchId])

  useEffect(() => {
    doFetch()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, saleStatus, page, branchId])

  // ── Setters con reset de página ───────────────────────────────

  function changeDateFrom(v: string) {
    setDateFrom(v)
    // Si la nueva fecha desde supera la fecha hasta, ajustar hasta = desde
    if (dateTo && v > dateTo) setDateTo(v)
    setPage(1)
  }

  function changeDateTo(v: string) {
    setDateTo(v)
    // Si la nueva fecha hasta es anterior a la fecha desde, ajustar desde = hasta
    if (dateFrom && v < dateFrom) setDateFrom(v)
    setPage(1)
  }

  function changeStatus(v: SaleStatus | '') { setSaleStatus(v); setPage(1) }

  // Atajos rápidos de rango
  function setRangeToday() {
    const today = todayISO()
    setDateFrom(today)
    setDateTo(today)
    setPage(1)
  }

  function setRangeThisMonth() {
    const now = new Date()
    const y   = now.getFullYear()
    const m   = String(now.getMonth() + 1).padStart(2, '0')
    setDateFrom(`${y}-${m}-01`)
    setDateTo(todayISO())
    setPage(1)
  }

  function setRangeLast7() {
    const d = new Date()
    d.setDate(d.getDate() - 6)
    const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    setDateFrom(from)
    setDateTo(todayISO())
    setPage(1)
  }

  // ── Paginación ────────────────────────────────────────────────

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  function goToPage(p: number) {
    if (p >= 1 && p <= pageCount) setPage(p)
  }

  return {
    // Datos
    items,
    total,
    loading: status === 'loading',

    // Filtros
    dateFrom,
    dateTo,
    saleStatus,
    changeDateFrom,
    changeDateTo,
    changeStatus,
    setRangeToday,
    setRangeLast7,
    setRangeThisMonth,

    // Paginación
    page,
    pageCount,
    pageSize: PAGE_SIZE,
    goToPage,

    // Resumen diario
    summary,
    summaryDate,

    // Refresh
    refresh: () => doFetch(),
  }
}

// ── Hook de detalle + reembolso ───────────────────────────────────

export function useSaleDetail(saleId: string | null) {
  const fetchById  = useSalesStore(s => s.fetchById)
  const refund     = useSalesStore(s => s.refund)
  const refunding  = useSalesStore(s => s.refunding)
  const current    = useSalesStore(s => s.current)

  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    if (!saleId) return
    setLoading(true)
    setError(null)
    fetchById(saleId)
      .catch(() => setError('No se pudo cargar el detalle de la venta.'))
      .finally(() => setLoading(false))
  }, [saleId, fetchById])

  const sale = saleId && current?.id === saleId ? current : null

  return { sale, loading, error, refund, refunding }
}
