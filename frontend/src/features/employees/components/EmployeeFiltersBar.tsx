import { memo } from 'react'
import { Search, X, UserPlus, ArrowUpDown } from 'lucide-react'
import type { EmployeeFilters } from '@/features/employees/api/employees.api'

interface Props {
  search:       string
  onSearch:     (q: string) => void
  isActive:     boolean | undefined
  onIsActive:   (v: boolean | undefined) => void
  sortBy:       EmployeeFilters['sort_by']
  sortDir:      EmployeeFilters['sort_dir']
  onChangeSort: (by: EmployeeFilters['sort_by']) => void
  total:        number
  canCreate:    boolean
  onCreate:     () => void
}

const ACTIVE_OPTIONS = [
  { value: '',      label: 'Todos'     },
  { value: 'true',  label: 'Activos'   },
  { value: 'false', label: 'Inactivos' },
]

const SORT_OPTIONS: Array<{ value: EmployeeFilters['sort_by']; label: string }> = [
  { value: 'first_name', label: 'Nombre'     },
  { value: 'last_name',  label: 'Apellido'   },
  { value: 'hired_at',   label: 'Ingreso'    },
  { value: 'created_at', label: 'Registro'   },
]

export const EmployeeFiltersBar = memo(function EmployeeFiltersBar({
  search, onSearch,
  isActive, onIsActive,
  sortBy, sortDir, onChangeSort,
  total, canCreate, onCreate,
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
          placeholder="Buscar empleado…"
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

      {/* Activo/Inactivo */}
      <select
        value={isActive === undefined ? '' : String(isActive)}
        onChange={e => {
          const v = e.target.value
          onIsActive(v === '' ? undefined : v === 'true')
        }}
        className="h-9 pl-3 pr-8 text-sm rounded-lg border border-gray-300
                   focus:outline-none focus:ring-2 focus:ring-brand-500
                   bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
      >
        {ACTIVE_OPTIONS.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {/* Ordenar por */}
      <div className="flex items-center gap-1">
        <select
          value={sortBy}
          onChange={e => onChangeSort(e.target.value as EmployeeFilters['sort_by'])}
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
          title={sortDir === 'asc' ? 'Ascendente' : 'Descendente'}
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
        {total} empleado{total !== 1 ? 's' : ''}
      </span>

      <div className="flex-1" />

      {/* Botón nuevo */}
      <button
        onClick={onCreate}
        disabled={!canCreate}
        title={canCreate ? undefined : 'Límite del plan alcanzado'}
        className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium
                   bg-brand-600 text-white hover:bg-brand-700 transition-colors
                   disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <UserPlus size={15} />
        Nuevo empleado
      </button>
    </div>
  )
})
