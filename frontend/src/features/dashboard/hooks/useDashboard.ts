import { useEffect } from 'react'
import { useSalesStore, useDailySummary } from '@/features/sales/store/sales.store'
import { useBillingStore } from '@/features/billing/store/billing.store'
import { useSyncStore, usePendingSalesCount } from '@/features/sync/store/sync.store'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { todayISO, localDayStart, localDayEnd } from '@/shared/utils/date'
import type { ResourceLimit } from '@/shared/types'

// ── Hook ──────────────────────────────────────────────────────────

export function useDashboard() {
  const { branchId, user, role, plan } = useAuth()
  const today = todayISO()

  // ── Resumen diario ────────────────────────────────────────────

  const fetchSummary = useSalesStore(s => s.fetchSummary)
  const summary      = useDailySummary(branchId ?? '', today)

  useEffect(() => {
    if (!branchId) return
    void fetchSummary(branchId, today)
  }, [branchId, today, fetchSummary])

  // ── Últimas ventas del día ────────────────────────────────────

  const fetchSales   = useSalesStore(s => s.fetch)
  const recentSales  = useSalesStore(s => s.items)
  const salesLoading = useSalesStore(s => s.status === 'loading')

  useEffect(() => {
    if (!branchId) return
    void fetchSales({
      branch_id: branchId,
      date_from: localDayStart(today),
      date_to:   localDayEnd(today),
      limit:     8,
      offset:    0,
    })
  }, [branchId, today, fetchSales])

  // ── Límites del plan ──────────────────────────────────────────
  // Ya cargados al boot por Providers → Shell. Solo leemos.

  const limits         = useBillingStore(s => s.limits)
  const refreshLimits  = useBillingStore(s => s.refreshLimits)
  const isStale        = useBillingStore(s => s.isStale)

  useEffect(() => {
    if (isStale()) void refreshLimits()
  }, [isStale, refreshLimits])

  // ── Sync ──────────────────────────────────────────────────────

  const isOnline      = useSyncStore(s => s.isOnline)
  const behind        = useSyncStore(s => s.behind)
  const pendingCount  = usePendingSalesCount()
  const syncEnabled   = limits?.features.sync_enabled ?? false
  const isBehind      = Object.values(behind).some(v => v > 0)

  // ── Recursos del plan (helper tipado) ─────────────────────────

  function getResource(key: keyof NonNullable<typeof limits>['resources']): ResourceLimit | null {
    return limits?.resources[key] ?? null
  }

  return {
    // Usuario
    user,
    role,
    plan,
    today,

    // Resumen del día
    summary,
    summaryLoading: !summary,

    // Ventas recientes
    recentSales: recentSales.slice(0, 8),
    salesLoading,

    // Plan
    limits,
    getResource,

    // Sync
    isOnline,
    isBehind,
    pendingCount,
    syncEnabled,
  }
}
