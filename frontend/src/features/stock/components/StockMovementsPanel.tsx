import { PackageMinus, RefreshCw } from 'lucide-react'
import { Badge } from '@/shared/components/ui/Badge'
import { Pagination } from '@/shared/components/ui/Table'
import { Skeleton } from '@/shared/components/ui/Skeleton'
import { formatDate } from '@/shared/utils/date'
import { useStockMovements } from '@/features/stock/hooks/useStockMovements'
import type { StockMovementType } from '@/shared/types'

// ── Badge por tipo ────────────────────────────────────────────────

const TYPE_META: Record<StockMovementType, { label: string; variant: 'success' | 'info' | 'purple' | 'warning' }> = {
  purchase:   { label: 'Compra',      variant: 'success' },
  return:     { label: 'Devolución',  variant: 'info'    },
  transfer:   { label: 'Transferencia',variant: 'purple' },
  adjustment: { label: 'Ajuste',      variant: 'warning' },
}

function MovementTypeBadge({ type }: { type: StockMovementType }) {
  const { label, variant } = TYPE_META[type]
  return <Badge variant={variant} size="sm">{label}</Badge>
}

// ── Quantity cell (positivo/negativo) ─────────────────────────────

function QuantityCell({ qty, type }: { qty: number; type: StockMovementType }) {
  const negative  = type === 'adjustment' && qty < 0
  return (
    <span className={[
      'font-semibold tabular-nums',
      negative
        ? 'text-red-600 dark:text-red-400'
        : 'text-green-600 dark:text-green-400',
    ].join(' ')}>
      {negative ? '' : '+'}{qty}
    </span>
  )
}

// ── Filtros ───────────────────────────────────────────────────────

const TYPE_OPTIONS: Array<{ value: StockMovementType | ''; label: string }> = [
  { value: '',           label: 'Todos los tipos' },
  { value: 'purchase',   label: 'Compra'          },
  { value: 'adjustment', label: 'Ajuste'          },
  { value: 'transfer',   label: 'Transferencia'   },
  { value: 'return',     label: 'Devolución'      },
]

// ── Skeleton ──────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 6 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton height={14} width={i === 0 ? '60%' : '50%'} />
        </td>
      ))}
    </tr>
  )
}

// ── Panel ─────────────────────────────────────────────────────────

export function StockMovementsPanel() {
  const {
    movements, total, loading,
    type, changeType,
    dateFrom, dateTo, changeDate,
    setRangeToday, setRangeLast7, setRangeThisMonth,
    offset, limit, onOffsetChange,
    refresh,
  } = useStockMovements()

  return (
    <div className="space-y-4">

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3">

        {/* Tipo */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Tipo</label>
          <select
            value={type}
            onChange={e => changeType(e.target.value as StockMovementType | '')}
            className="h-9 pl-3 pr-8 text-sm rounded-lg border border-gray-300
                       focus:outline-none focus:ring-2 focus:ring-brand-500
                       bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
          >
            {TYPE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Desde */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Desde</label>
          <input
            type="date"
            value={dateFrom}
            onChange={e => changeDate('from', e.target.value)}
            max={dateTo || undefined}
            className="h-9 px-3 text-sm rounded-lg border border-gray-300 dark:border-gray-600
                       bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                       focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        {/* Hasta */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Hasta</label>
          <input
            type="date"
            value={dateTo}
            onChange={e => changeDate('to', e.target.value)}
            min={dateFrom || undefined}
            className="h-9 px-3 text-sm rounded-lg border border-gray-300 dark:border-gray-600
                       bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                       focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        {/* Presets */}
        <div className="flex gap-1">
          {[
            { label: 'Hoy',        action: setRangeToday      },
            { label: 'Últimos 7d', action: setRangeLast7      },
            { label: 'Este mes',   action: setRangeThisMonth  },
          ].map(p => (
            <button
              key={p.label}
              onClick={p.action}
              className="h-9 px-3 text-xs font-medium rounded-lg border border-gray-200
                         text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400
                         dark:hover:bg-gray-800 transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Refresh */}
        <button
          onClick={refresh}
          className="flex items-center gap-1.5 h-9 px-3 rounded-lg border border-gray-300
                     text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-600
                     dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      {/* Tabla */}
      <div className="rounded-2xl border border-gray-100 dark:border-gray-800
                      bg-white dark:bg-gray-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/50
                             border-b border-gray-100 dark:border-gray-800">
                <th className="px-4 py-3 text-left font-medium">Producto</th>
                <th className="px-4 py-3 text-left font-medium">Sucursal</th>
                <th className="px-4 py-3 text-left font-medium">Tipo</th>
                <th className="px-4 py-3 text-left font-medium">Cantidad</th>
                <th className="px-4 py-3 text-left font-medium">Referencia / Nota</th>
                <th className="px-4 py-3 text-left font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">

              {loading && movements.length === 0 && (
                Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
              )}

              {!loading && movements.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-14 text-center">
                    <PackageMinus size={36} className="mx-auto text-gray-200 dark:text-gray-700 mb-2" strokeWidth={1} />
                    <p className="text-sm text-gray-400">Sin movimientos en el período</p>
                  </td>
                </tr>
              )}

              {movements.map(mv => (
                <tr
                  key={mv.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                    {mv.product_name}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                    {mv.branch_name}
                  </td>
                  <td className="px-4 py-3">
                    <MovementTypeBadge type={mv.type} />
                  </td>
                  <td className="px-4 py-3">
                    <QuantityCell qty={mv.quantity} type={mv.type} />
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 max-w-[200px]">
                    {mv.reference_id && (
                      <span className="font-mono text-gray-600 dark:text-gray-300">
                        #{mv.reference_id}
                      </span>
                    )}
                    {mv.reference_id && mv.note && <span className="mx-1 text-gray-300">·</span>}
                    {mv.note && <span>{mv.note}</span>}
                    {!mv.reference_id && !mv.note && <span className="text-gray-300 dark:text-gray-600">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                    {formatDate(mv.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {total > limit && (
          <div className="px-4 pb-3 border-t border-gray-100 dark:border-gray-800">
            <Pagination total={total} limit={limit} offset={offset} onChange={onOffsetChange} />
          </div>
        )}
      </div>
    </div>
  )
}
