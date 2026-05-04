import { memo } from 'react'
import { PackageMinus, RefreshCw, Search, Download } from 'lucide-react'
import { exportMovementsToCsv } from '@/shared/utils/exportCsv'
import { Badge } from '@/shared/components/ui/Badge'
import { Pagination } from '@/shared/components/ui/Table'
import { Skeleton } from '@/shared/components/ui/Skeleton'
import { formatDate } from '@/shared/utils/date'
import { useMovementsPage } from '@/features/stock/hooks/useMovementsPage'
import type { StockMovementType } from '@/shared/types'

// ── Helpers de display ─────────────────────────────────────────────

const TYPE_META: Record<StockMovementType, { label: string; variant: 'success' | 'info' | 'purple' | 'warning' }> = {
  purchase:   { label: 'Compra',         variant: 'success' },
  return:     { label: 'Devolución',     variant: 'info'    },
  transfer:   { label: 'Transferencia',  variant: 'purple'  },
  adjustment: { label: 'Ajuste',         variant: 'warning' },
}

const TYPE_OPTIONS: Array<{ value: StockMovementType | ''; label: string }> = [
  { value: '',           label: 'Todos los tipos' },
  { value: 'purchase',   label: 'Compra'          },
  { value: 'adjustment', label: 'Ajuste'          },
  { value: 'transfer',   label: 'Transferencia'   },
  { value: 'return',     label: 'Devolución'      },
]

function userLabel(createdBy: string | null): string {
  if (!createdBy) return '—'
  return `#${createdBy.slice(-8).toUpperCase()}`
}

// ── Page ───────────────────────────────────────────────────────────

export function MovementsPage() {
  const {
    movements, total, loading,
    type, changeType,
    dateFrom, dateTo, changeDate,
    setRangeToday, setRangeLast7, setRangeThisMonth,
    offset, limit, onOffsetChange,
    productSearch, setProductSearch,
    refresh,
  } = useMovementsPage()

  function handleExport() {
    const filename = [
      'movimientos',
      dateFrom,
      dateTo !== dateFrom ? dateTo : null,
      productSearch || null,
    ].filter(Boolean).join('_') + '.xlsx'

    exportMovementsToCsv(movements, filename)
  }

  return (
    <div className="p-6 space-y-5 max-w-screen-xl mx-auto">

      {/* Encabezado */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Movimientos de Stock</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {total > 0
              ? `${total} movimiento${total !== 1 ? 's' : ''} en el período seleccionado`
              : 'Historial de entradas, ajustes y transferencias'
            }
          </p>
        </div>

        <div className="flex flex-col items-end gap-0.5 shrink-0">
          <button
            type="button"
            onClick={handleExport}
            disabled={movements.length === 0 || loading}
            title={
              total > limit
                ? `Exporta los ${movements.length} movimientos de esta página (${total} en total)`
                : `Exporta los ${movements.length} movimientos a CSV`
            }
            className="flex items-center gap-2 h-9 px-3 text-sm font-medium rounded-lg
                       border border-gray-300 dark:border-gray-600
                       text-gray-700 dark:text-gray-300
                       bg-white dark:bg-gray-800
                       hover:bg-gray-50 dark:hover:bg-gray-700
                       disabled:opacity-40 disabled:cursor-not-allowed
                       transition-colors"
          >
            <Download size={14} />
            {total > limit ? 'Exportar página' : 'Exportar CSV'}
          </button>
          {total > limit && movements.length > 0 && (
            <span className="text-[11px] text-amber-600 dark:text-amber-400">
              {movements.length} de {total} filas
            </span>
          )}
        </div>
      </div>

      {/* Filtros */}
      <FiltersBar
        type={type}             onType={changeType}
        dateFrom={dateFrom}     dateTo={dateTo}     onDate={changeDate}
        productSearch={productSearch}               onProductSearch={setProductSearch}
        loading={loading}
        onRangeToday={setRangeToday}
        onRangeLast7={setRangeLast7}
        onRangeThisMonth={setRangeThisMonth}
        onRefresh={refresh}
      />

      {/* Tabla */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700
                      bg-white dark:bg-gray-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700
                             text-xs font-medium text-gray-500 dark:text-gray-400">
                <th className="px-4 py-3 text-left">Producto</th>
                <th className="px-4 py-3 text-left">Sucursal</th>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-right">Cantidad</th>
                <th className="px-4 py-3 text-left">Ref. / Nota</th>
                <th className="px-4 py-3 text-left">Usuario</th>
                <th className="px-4 py-3 text-left">Fecha</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">

              {loading && movements.length === 0 && (
                Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
              )}

              {!loading && movements.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <PackageMinus size={36} className="mx-auto text-gray-200 dark:text-gray-700 mb-2" strokeWidth={1} />
                    <p className="text-sm text-gray-400 dark:text-gray-500">
                      {productSearch
                        ? `Sin resultados para "${productSearch}"`
                        : 'Sin movimientos en el período seleccionado'
                      }
                    </p>
                  </td>
                </tr>
              )}

              {movements.map(mv => (
                <MovementRow key={mv.id} mv={mv} />
              ))}
            </tbody>
          </table>
        </div>

        {/* Paginación + contador */}
        <div className="px-4 py-3 flex items-center justify-between border-t
                        border-gray-100 dark:border-gray-800
                        text-sm text-gray-500 dark:text-gray-400">
          <span>
            {total === 0
              ? 'Sin resultados'
              : `Mostrando ${Math.min(offset + 1, total)}–${Math.min(offset + limit, total)} de ${total}`
            }
            {productSearch && movements.length < limit && (
              <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">
                · filtrado por producto en esta página
              </span>
            )}
          </span>
          {total > limit && (
            <Pagination total={total} limit={limit} offset={offset} onChange={onOffsetChange} />
          )}
        </div>
      </div>
    </div>
  )
}

// ── FiltersBar ─────────────────────────────────────────────────────

interface FiltersBarProps {
  type:            StockMovementType | ''
  onType:          (v: StockMovementType | '') => void
  dateFrom:        string
  dateTo:          string
  onDate:          (field: 'from' | 'to', v: string) => void
  productSearch:   string
  onProductSearch: (v: string) => void
  loading:         boolean
  onRangeToday:    () => void
  onRangeLast7:    () => void
  onRangeThisMonth:() => void
  onRefresh:       () => void
}

const FiltersBar = memo(function FiltersBar({
  type, onType,
  dateFrom, dateTo, onDate,
  productSearch, onProductSearch,
  loading,
  onRangeToday, onRangeLast7, onRangeThisMonth,
  onRefresh,
}: FiltersBarProps) {
  const inputCls = `h-9 px-3 text-sm rounded-lg border border-gray-300 dark:border-gray-600
                    bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                    focus:outline-none focus:ring-2 focus:ring-brand-500 transition-colors`

  return (
    <div className="flex flex-col gap-3">

      {/* Fila principal */}
      <div className="flex items-end gap-3 flex-wrap">

        {/* Producto */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Producto
          </label>
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2
                                         text-gray-400 dark:text-gray-500 pointer-events-none" />
            <input
              type="text"
              value={productSearch}
              onChange={e => onProductSearch(e.target.value)}
              placeholder="Buscar producto…"
              className={`${inputCls} pl-8 w-48`}
            />
          </div>
        </div>

        {/* Tipo */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Tipo
          </label>
          <select
            value={type}
            onChange={e => onType(e.target.value as StockMovementType | '')}
            className={`${inputCls} w-40`}
          >
            {TYPE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Desde */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Desde
          </label>
          <input
            type="date"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={e => onDate('from', e.target.value)}
            className={inputCls}
          />
        </div>

        {/* Hasta */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Hasta
          </label>
          <input
            type="date"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={e => onDate('to', e.target.value)}
            className={inputCls}
          />
        </div>

        {/* Refresh */}
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          title="Actualizar"
          className="h-9 w-9 flex items-center justify-center rounded-lg mt-auto
                     border border-gray-300 dark:border-gray-600
                     text-gray-500 dark:text-gray-400
                     hover:bg-gray-50 dark:hover:bg-gray-700
                     disabled:opacity-50 transition-colors"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Atajos de rango */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400 dark:text-gray-500 mr-1">Rápido:</span>
        {([
          { label: 'Hoy',        fn: onRangeToday     },
          { label: 'Últimos 7d', fn: onRangeLast7     },
          { label: 'Este mes',   fn: onRangeThisMonth },
        ] as const).map(p => (
          <button
            key={p.label}
            type="button"
            onClick={p.fn}
            className="text-xs px-2.5 py-1 rounded-full border border-gray-300 dark:border-gray-600
                       text-gray-600 dark:text-gray-400
                       hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-gray-400
                       transition-colors"
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  )
})

// ── MovementRow ────────────────────────────────────────────────────

interface RowProps {
  mv: import('@/shared/types').StockMovementRow
}

const MovementRow = memo(function MovementRow({ mv }: RowProps) {
  const { label, variant } = TYPE_META[mv.type]
  const negative = mv.type === 'adjustment' && mv.quantity < 0

  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">

      {/* Producto */}
      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
        {mv.product_name}
      </td>

      {/* Sucursal */}
      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
        {mv.branch_name}
      </td>

      {/* Tipo */}
      <td className="px-4 py-3">
        <Badge variant={variant} size="sm">{label}</Badge>
      </td>

      {/* Cantidad */}
      <td className="px-4 py-3 text-right">
        <span className={[
          'font-semibold tabular-nums',
          negative
            ? 'text-red-600 dark:text-red-400'
            : 'text-green-600 dark:text-green-400',
        ].join(' ')}>
          {negative ? '' : '+'}{mv.quantity}
        </span>
      </td>

      {/* Referencia / Nota */}
      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 max-w-[180px]">
        {mv.reference_id && (
          <span className="font-mono text-gray-600 dark:text-gray-300">
            #{mv.reference_id.slice(-8).toUpperCase()}
          </span>
        )}
        {mv.reference_id && mv.note && (
          <span className="mx-1 text-gray-300 dark:text-gray-600">·</span>
        )}
        {mv.note && <span className="truncate">{mv.note}</span>}
        {!mv.reference_id && !mv.note && (
          <span className="text-gray-300 dark:text-gray-600">—</span>
        )}
      </td>

      {/* Usuario */}
      <td className="px-4 py-3 text-xs font-mono text-gray-500 dark:text-gray-400">
        {userLabel(mv.created_by)}
      </td>

      {/* Fecha */}
      <td className="px-4 py-3 text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
        {formatDate(mv.created_at)}
      </td>
    </tr>
  )
})

// ── SkeletonRow ────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr>
      {[55, 40, 30, 20, 50, 25, 40].map((w, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton height={14} width={`${w}%`} />
        </td>
      ))}
    </tr>
  )
}
