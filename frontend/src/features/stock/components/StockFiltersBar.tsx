import { memo } from 'react'
import { Search, X, AlertTriangle, ArrowUpDown, Plus } from 'lucide-react'
import type { StockFilters } from '@/features/stock/api/stock.api'

interface Props {
  search:       string
  onSearch:     (q: string) => void
  isLow:        boolean | undefined
  onIsLow:      (v: boolean | undefined) => void
  sortBy:       StockFilters['sort_by']
  sortDir:      StockFilters['sort_dir']
  onChangeSort: (by: StockFilters['sort_by']) => void
  total:        number
  alertCount:   number
  onNewMovement: () => void
}

const SORT_OPTIONS: Array<{ value: StockFilters['sort_by']; label: string }> = [
  { value: 'product_name', label: 'Producto'      },
  { value: 'quantity',     label: 'Cantidad'      },
  { value: 'updated_at',   label: 'Actualización' },
]

export const StockFiltersBar = memo(function StockFiltersBar({
  search, onSearch,
  isLow, onIsLow,
  sortBy, sortDir, onChangeSort,
  total, alertCount, onNewMovement,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3">

      {/* Buscador */}
      <div className="relative flex-1 min-w-[200px] max-w-xs">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          type="search"
          value={search}
          onChange={e => onSearch(e.target.value)}
          placeholder="Buscar producto…"
          className="w-full h-9 pl-8 pr-8 text-sm rounded-lg border border-gray-300
                     focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500
                     bg-white dark:bg-gray-800 dark:border-gray-600
                     dark:text-gray-100 dark:placeholder-gray-500"
        />
        {search && (
          <button
            onClick={() => onSearch('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Filtro stock bajo */}
      <button
        onClick={() => onIsLow(isLow === true ? undefined : true)}
        className={[
          'flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium border transition-colors',
          isLow === true
            ? 'bg-red-50 border-red-300 text-red-700 dark:bg-red-950/30 dark:border-red-700 dark:text-red-400'
            : 'border-gray-300 text-gray-600 hover:border-gray-400 dark:border-gray-600 dark:text-gray-400',
        ].join(' ')}
      >
        <AlertTriangle size={13} />
        Stock bajo
        {alertCount > 0 && (
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full
                           bg-red-500 text-white text-[10px] font-bold leading-none">
            {alertCount > 9 ? '9+' : alertCount}
          </span>
        )}
      </button>

      {/* Ordenar */}
      <div className="flex items-center gap-1">
        <select
          value={sortBy}
          onChange={e => onChangeSort(e.target.value as StockFilters['sort_by'])}
          className="h-9 pl-3 pr-8 text-sm rounded-lg border border-gray-300
                     focus:outline-none focus:ring-2 focus:ring-brand-500
                     bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
        >
          {SORT_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button
          onClick={() => onChangeSort(sortBy)}
          className="h-9 w-9 flex items-center justify-center rounded-lg border border-gray-300
                     hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 transition-colors"
        >
          <ArrowUpDown
            size={14}
            className={sortDir === 'asc' ? 'text-brand-600' : 'text-gray-400 rotate-180'}
          />
        </button>
      </div>

      {/* Total */}
      <span className="text-xs text-gray-500 dark:text-gray-400">
        {total} producto{total !== 1 ? 's' : ''}
      </span>

      <div className="flex-1" />

      {/* Registrar movimiento */}
      <button
        onClick={onNewMovement}
        className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium
                   bg-brand-600 text-white hover:bg-brand-700 transition-colors"
      >
        <Plus size={15} />
        Registrar movimiento
      </button>
    </div>
  )
})
