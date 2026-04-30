import { useDashboard }      from '@/features/dashboard/hooks/useDashboard'
import { useDashboard30Days } from '@/features/dashboard/hooks/useDashboard30Days'
import { DashboardKPIs }             from '@/features/dashboard/components/DashboardKPIs'
import { DashboardPaymentBreakdown } from '@/features/dashboard/components/DashboardPaymentBreakdown'
import { DashboardRecentSales }      from '@/features/dashboard/components/DashboardRecentSales'
import { DashboardPlanUsage }        from '@/features/dashboard/components/DashboardPlanUsage'
import { DashboardSyncStatus }       from '@/features/dashboard/components/DashboardSyncStatus'
import { DashboardRevenueChart }     from '@/features/dashboard/components/DashboardRevenueChart'
import { DashboardTopProducts }      from '@/features/dashboard/components/DashboardTopProducts'
import { Skeleton }                  from '@/shared/components/ui/Skeleton'
import { formatDate }                from '@/shared/utils/date'
import type { DailySummary }         from '@/shared/types'

export function DashboardPage() {
  const {
    user,
    today,
    summary,
    summaryLoading,
    recentSales,
    salesLoading,
    limits,
    isOnline,
    syncEnabled,
  } = useDashboard()

  const { dailyRevenue, topProducts, total30, loading: loading30 } = useDashboard30Days()

  // Construct a DailySummary-shaped object from the 30-day aggregation
  // so we can reuse DashboardPaymentBreakdown without modification
  const summary30: DailySummary | undefined = loading30 ? undefined : {
    total_sales:   total30.count,
    total_revenue: total30.revenue,
    avg_ticket:    total30.avgTicket,
    cash:          total30.cash,
    card:          total30.card,
    transfer:      total30.transfer,
    mp:            total30.mp,
  }

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">

      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          Dashboard
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {formatDate(today).split(' ')[0]}
          {user && <span className="ml-1">· Bienvenido</span>}
        </p>
      </div>

      {/* Offline banner */}
      {!isOnline && (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200
                        dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300
                        flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
          Trabajando sin conexión. Los datos pueden estar desactualizados.
        </div>
      )}

      {/* ── Hoy ─────────────────────────────────────────────────── */}
      <section className="space-y-6">
        <SectionLabel>Hoy</SectionLabel>

        <DashboardKPIs summary={summary} loading={summaryLoading} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <DashboardRecentSales sales={recentSales} loading={salesLoading} />
          </div>
          <div className="space-y-6">
            <DashboardPaymentBreakdown summary={summary} loading={summaryLoading} />
            {syncEnabled && <DashboardSyncStatus />}
          </div>
        </div>
      </section>

      {/* ── Últimos 30 días ─────────────────────────────────────── */}
      <section className="space-y-6">
        <SectionLabel>Últimos 30 días</SectionLabel>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard30
            label="Ingresos totales"
            value={loading30 ? null : `$${total30.revenue.toFixed(2)}`}
            sub="en 30 días"
          />
          <StatCard30
            label="Ventas realizadas"
            value={loading30 ? null : String(total30.count)}
            sub={total30.count === 1 ? 'transacción' : 'transacciones'}
          />
          <StatCard30
            label="Ticket promedio"
            value={loading30 ? null : `$${total30.avgTicket.toFixed(2)}`}
            sub="por venta"
          />
        </div>

        {/* Revenue chart */}
        <DashboardRevenueChart data={dailyRevenue} loading={loading30} />

        {/* Top products + payment breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DashboardTopProducts products={topProducts} loading={loading30} />
          <DashboardPaymentBreakdown summary={summary30} loading={loading30} />
        </div>
      </section>

      {/* Plan usage — full width */}
      <DashboardPlanUsage limits={limits} />

    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
      {children}
    </p>
  )
}

interface StatCard30Props {
  label: string
  value: string | null   // null = loading
  sub?:  string
}

function StatCard30({ label, value, sub }: StatCard30Props) {
  return (
    <div className="rounded-2xl border border-gray-100 dark:border-gray-800
                    bg-white dark:bg-gray-900 p-5 flex flex-col gap-2">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      {value === null ? (
        <Skeleton height={24} width="55%" rounded="md" />
      ) : (
        <>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums leading-none">
            {value}
          </p>
          {sub && (
            <p className="text-xs text-gray-400 dark:text-gray-500">{sub}</p>
          )}
        </>
      )}
    </div>
  )
}
