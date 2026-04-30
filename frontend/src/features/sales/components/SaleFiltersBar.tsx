import { memo } from 'react'
import { RefreshCw } from 'lucide-react'
import { Select } from '@/shared/components/ui/Select'
import type { SaleStatus } from '@/shared/types'

interface Props {
  dateFrom:         string
  dateTo:           string
  saleStatus:       SaleStatus | ''
  loading:          boolean
  onDateFrom:       (v: string) => void
  onDateTo:         (v: string) => void
  onStatus:         (v: SaleStatus | '') => void
  onRangeToday:     () => void
  onRangeLast7:     () => void
  onRangeThisMonth: () => void
  onRefresh:        () => void
}

const STATUS_OPTIONS = [
  { value: '',           label: 'Todos los estados' },
  { value: 'completed',  label: 'Completadas'       },
  { value: 'pending',    label: 'Pendientes'        },
  { value: 'refunded',   label: 'Reembolsadas'      },
  { value: 'cancelled',  label: 'Canceladas'        },
]

const RANGE_PRESETS = [
  { label: 'Hoy',         action: 'today'      },
  { label: 'Últimos 7d',  action: 'last7'      },
  { label: 'Este mes',    action: 'thisMonth'  },
] as const

type PresetAction = typeof RANGE_PRESETS[number]['action']

export const SaleFiltersBar = memo(function SaleFiltersBar({
  dateFrom, dateTo, saleStatus, loading,
  onDateFrom, onDateTo, onStatus,
  onRangeToday, onRangeLast7, onRangeThisMonth,
  onRefresh,
}: Props) {
  function handlePreset(action: PresetAction) {
    if (action === 'today')     onRangeToday()
    if (action === 'last7')     onRangeLast7()
    if (action === 'thisMonth') onRangeThisMonth()
  }

  return (
    <div className="flex flex-col gap-3">

      {/* Fila de filtros */}
      <div className="flex items-end gap-3 flex-wrap">

        {/* Fecha desde */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Desde
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={e => onDateFrom(e.target.value)}
            max={dateTo || undefined}
            className="h-9 px-3 text-sm rounded-lg border border-gray-300 dark:border-gray-600
                       bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                       focus:outline-none focus:ring-2 focus:ring-brand-500
                       focus:border-brand-500 transition-colors"
          />
        </div>

        {/* Fecha hasta */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Hasta
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={e => onDateTo(e.target.value)}
            min={dateFrom || undefined}
            className="h-9 px-3 text-sm rounded-lg border border-gray-300 dark:border-gray-600
                       bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                       focus:outline-none focus:ring-2 focus:ring-brand-500
                       focus:border-brand-500 transition-colors"
          />
        </div>

        {/* Estado */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Estado
          </label>
          <Select
            fullWidth={false}
            options={STATUS_OPTIONS}
            value={saleStatus}
            onChange={e => onStatus(e.target.value as SaleStatus | '')}
            className="w-44"
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
        {RANGE_PRESETS.map(p => (
          <button
            key={p.action}
            type="button"
            onClick={() => handlePreset(p.action)}
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
