import { Skeleton } from '@/shared/components/ui/Skeleton'
import type { DailySummary } from '@/shared/types'

interface Props {
  summary: DailySummary | undefined
  loading: boolean
}

interface Method {
  label:  string
  value:  number
  color:  string
  track:  string
}

function buildMethods(s: DailySummary): Method[] {
  return [
    { label: 'Efectivo',      value: s.cash,              color: 'bg-amber-500',  track: 'bg-amber-100  dark:bg-amber-900/30'  },
    { label: 'Tarjeta',       value: s.card,              color: 'bg-sky-500',    track: 'bg-sky-100    dark:bg-sky-900/30'    },
    { label: 'Mercado Pago',  value: s.mp,                color: 'bg-teal-500',   track: 'bg-teal-100   dark:bg-teal-900/30'   },
    { label: 'Transferencia', value: s.transfer,          color: 'bg-purple-500', track: 'bg-purple-100 dark:bg-purple-900/30' },
  ]
}

export function DashboardPaymentBreakdown({ summary, loading }: Props) {
  return (
    <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Ingresos por método de pago
      </h3>

      {loading || !summary ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton height={12} width="30%" rounded="sm" />
              <Skeleton height={8}  width="100%" rounded="sm" />
            </div>
          ))}
        </div>
      ) : (
        <BreakdownContent summary={summary} />
      )}
    </div>
  )
}

function BreakdownContent({ summary }: { summary: DailySummary }) {
  const methods  = buildMethods(summary)
  const total    = summary.total_revenue

  // Si no hay ingresos, mostrar estado vacío
  if (total === 0) {
    return (
      <p className="text-sm text-gray-400 dark:text-gray-500 py-4 text-center">
        Sin ventas registradas hoy
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {methods.map(m => {
        const pct = total > 0 ? (m.value / total) * 100 : 0
        if (m.value === 0) return null

        return (
          <div key={m.label}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-gray-500 dark:text-gray-400">{m.label}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-900 dark:text-gray-100 tabular-nums">
                  ${m.value.toFixed(2)}
                </span>
                <span className="text-xs text-gray-400 tabular-nums w-8 text-right">
                  {pct.toFixed(0)}%
                </span>
              </div>
            </div>
            {/* Barra de progreso */}
            <div className={`h-2 rounded-full ${m.track} overflow-hidden`}>
              <div
                className={`h-full rounded-full ${m.color} transition-all duration-500`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )
      })}

      {/* Total */}
      <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex justify-between">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Total</span>
        <span className="text-sm font-bold text-gray-900 dark:text-gray-100 tabular-nums">
          ${total.toFixed(2)}
        </span>
      </div>
    </div>
  )
}
