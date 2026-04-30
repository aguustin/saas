import { Wifi, WifiOff, RefreshCw, AlertTriangle } from 'lucide-react'
import { useSyncStore, usePendingSalesCount } from '@/features/sync/store/sync.store'

export function DashboardSyncStatus() {
  const isOnline     = useSyncStore(s => s.isOnline)
  const behind       = useSyncStore(s => s.behind)
  const flush        = useSyncStore(s => s.flush)
  const syncing      = useSyncStore(s => s.status === 'syncing')
  const pendingCount = usePendingSalesCount()

  const behindCount  = Object.values(behind).reduce((a, b) => a + b, 0)
  const hasBehind    = behindCount > 0

  return (
    <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Estado de sincronización
      </h3>

      <div className="space-y-3">

        {/* Online / Offline */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isOnline ? (
              <Wifi size={16} className="text-green-500" />
            ) : (
              <WifiOff size={16} className="text-red-500" />
            )}
            <span className="text-sm text-gray-700 dark:text-gray-300">Conexión</span>
          </div>
          <span className={[
            'text-xs font-medium px-2 py-0.5 rounded-full',
            isOnline
              ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400'
              : 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400',
          ].join(' ')}>
            {isOnline ? 'En línea' : 'Sin conexión'}
          </span>
        </div>

        {/* Ventas pendientes (cola offline) */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Ventas en cola
          </span>
          <div className="flex items-center gap-2">
            <span className={[
              'text-xs font-semibold tabular-nums px-2 py-0.5 rounded-full',
              pendingCount > 0
                ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
            ].join(' ')}>
              {pendingCount}
            </span>
            {pendingCount > 0 && isOnline && (
              <button
                onClick={() => void flush()}
                disabled={syncing}
                title="Sincronizar ahora"
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800
                           text-brand-600 dark:text-brand-400 disabled:opacity-40 transition-colors"
              >
                <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
              </button>
            )}
          </div>
        </div>

        {/* Datos desactualizados */}
        {hasBehind && (
          <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/20
                          border border-amber-200 dark:border-amber-800 rounded-xl p-3">
            <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                Datos pendientes de sincronizar
              </p>
              <ul className="mt-1 space-y-0.5">
                {Object.entries(behind).map(([resource, count]) =>
                  count > 0 ? (
                    <li key={resource} className="text-xs text-amber-700 dark:text-amber-400">
                      {resource}: {count} pendiente{count !== 1 ? 's' : ''}
                    </li>
                  ) : null,
                )}
              </ul>
            </div>
          </div>
        )}

        {!hasBehind && isOnline && pendingCount === 0 && (
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center pt-1">
            Todo sincronizado
          </p>
        )}
      </div>
    </div>
  )
}
