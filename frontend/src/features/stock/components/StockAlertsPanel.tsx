import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react'
import { Skeleton } from '@/shared/components/ui/Skeleton'
import { useStockStore } from '@/features/stock/store/stock.store'
import type { StockAlert } from '@/shared/types'

// ── Tarjeta de alerta ─────────────────────────────────────────────

function AlertCard({ alert, onMovement }: { alert: StockAlert; onMovement: (a: StockAlert) => void }) {
  const pct     = alert.min_quantity > 0
    ? Math.round((alert.quantity / alert.min_quantity) * 100)
    : 0
  const isEmpty = alert.quantity === 0

  return (
    <div className={[
      'rounded-2xl border p-4 flex flex-col gap-3',
      isEmpty
        ? 'border-red-200 dark:border-red-800 bg-red-50/60 dark:bg-red-950/20'
        : 'border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/20',
    ].join(' ')}>

      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">
            {alert.product_name}
          </p>
          {alert.product_sku && (
            <p className="text-[11px] font-mono text-gray-400 mt-0.5">{alert.product_sku}</p>
          )}
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {alert.branch_name}
          </p>
        </div>
        <AlertTriangle
          size={18}
          className={isEmpty ? 'text-red-500' : 'text-amber-500'}
        />
      </div>

      {/* Niveles */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs">
          <span className="text-gray-500 dark:text-gray-400">Stock actual</span>
          <span className={[
            'font-bold tabular-nums',
            isEmpty ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400',
          ].join(' ')}>
            {alert.quantity}
          </span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-500 dark:text-gray-400">Mínimo</span>
          <span className="font-medium text-gray-700 dark:text-gray-300 tabular-nums">
            {alert.min_quantity}
          </span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-500 dark:text-gray-400">Déficit</span>
          <span className="font-medium text-red-600 dark:text-red-400 tabular-nums">
            −{alert.deficit}
          </span>
        </div>

        {/* Barra */}
        <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden mt-1">
          <div
            className={[
              'h-full rounded-full transition-all',
              isEmpty ? 'bg-red-500' : 'bg-amber-500',
            ].join(' ')}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-[10px] text-gray-400 text-right">{pct}% del mínimo</p>
      </div>

      {/* Acción */}
      <button
        onClick={() => onMovement(alert)}
        className={[
          'w-full py-1.5 rounded-xl text-xs font-semibold transition-colors',
          isEmpty
            ? 'bg-red-600 hover:bg-red-700 text-white'
            : 'bg-amber-500 hover:bg-amber-600 text-white',
        ].join(' ')}
      >
        Reponer stock
      </button>
    </div>
  )
}

// ── Skeleton tarjeta ──────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-gray-100 dark:border-gray-800 p-4 space-y-3">
      <Skeleton height={16} width="70%" />
      <Skeleton height={12} width="40%" />
      <Skeleton height={8}  width="100%" rounded="full" />
    </div>
  )
}

// ── Panel ─────────────────────────────────────────────────────────

interface Props {
  onMovement: (productId: string, productName: string) => void
}

export function StockAlertsPanel({ onMovement }: Props) {
  const alerts       = useStockStore(s => s.alerts)
  const status       = useStockStore(s => s.alertsStatus)
  const fetchAlerts  = useStockStore(s => s.fetchAlerts)
  const loading      = status === 'loading'

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {loading
            ? 'Cargando…'
            : alerts.length === 0
              ? 'Sin alertas activas'
              : `${alerts.length} producto${alerts.length !== 1 ? 's' : ''} con stock bajo`}
        </p>
        <button
          onClick={() => void fetchAlerts()}
          disabled={loading}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-gray-300
                     text-xs text-gray-600 hover:bg-gray-50 dark:border-gray-600
                     dark:text-gray-400 dark:hover:bg-gray-800 transition-colors
                     disabled:opacity-40"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* Empty */}
      {!loading && alerts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
          <CheckCircle2 size={40} strokeWidth={1} className="text-green-400" />
          <p className="text-sm font-medium text-green-600 dark:text-green-400">
            Todo el stock está por encima del mínimo
          </p>
        </div>
      )}

      {/* Grid de alertas */}
      {!loading && alerts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {alerts.map(alert => (
            <AlertCard
              key={`${alert.product_id}-${alert.branch_id}`}
              alert={alert}
              onMovement={a => onMovement(a.product_id, a.product_name)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
