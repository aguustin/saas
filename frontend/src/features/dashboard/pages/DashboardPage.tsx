import { useDashboard } from '@/features/dashboard/hooks/useDashboard'
import { DashboardKPIs }            from '@/features/dashboard/components/DashboardKPIs'
import { DashboardPaymentBreakdown } from '@/features/dashboard/components/DashboardPaymentBreakdown'
import { DashboardRecentSales }     from '@/features/dashboard/components/DashboardRecentSales'
import { DashboardPlanUsage }       from '@/features/dashboard/components/DashboardPlanUsage'
import { DashboardSyncStatus }      from '@/features/dashboard/components/DashboardSyncStatus'
import { formatDate }               from '@/shared/utils/date'

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

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">

      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          Dashboard
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {formatDate(today).split(' ')[0]}
          {user && (
            <span className="ml-1">
              · Bienvenido
            </span>
          )}
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

      {/* KPIs row */}
      <DashboardKPIs summary={summary} loading={summaryLoading} />

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Recent sales — spans 2 cols on large screens */}
        <div className="lg:col-span-2">
          <DashboardRecentSales sales={recentSales} loading={salesLoading} />
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <DashboardPaymentBreakdown summary={summary} loading={summaryLoading} />

          {syncEnabled && (
            <DashboardSyncStatus />
          )}
        </div>
      </div>

      {/* Plan usage — full width */}
      <DashboardPlanUsage limits={limits} />

    </div>
  )
}
