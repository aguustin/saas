import { Search, Plus, Trash2, RefreshCw, ArrowUpDown } from 'lucide-react'
import { Button } from '@/shared/components/ui/Button'
import { Select } from '@/shared/components/ui/Select'
import type { ProductFilters } from '@/features/products/api/products.api'

interface Props {
  search:           string
  isActive:         boolean | undefined
  sortBy:           ProductFilters['sort_by']
  sortDir:          ProductFilters['sort_dir']
  selectedCount:    number
  loading:          boolean
  canCreate:        boolean
  onSearch:         (q: string) => void
  onIsActive:       (v: boolean | undefined) => void
  onSort:           (by: ProductFilters['sort_by']) => void
  onSortDir:        (dir: ProductFilters['sort_dir']) => void
  onNew:            () => void
  onBulkDelete:     () => void
  onRefresh:        () => void
}

const SORT_OPTIONS = [
  { value: 'name',       label: 'Nombre'         },
  { value: 'price',      label: 'Precio'         },
  { value: 'created_at', label: 'Fecha de alta'  },
  { value: 'updated_at', label: 'Última edición' },
]

const ACTIVE_OPTIONS = [
  { value: '',      label: 'Todos'      },
  { value: 'true',  label: 'Activos'   },
  { value: 'false', label: 'Inactivos' },
]

import { memo } from 'react'

export const ProductFiltersBar = memo(function ProductFiltersBar({
  search,
  isActive,
  sortBy,
  sortDir,
  selectedCount,
  loading,
  canCreate,
  onSearch,
  onIsActive,
  onSort,
  onSortDir,
  onNew,
  onBulkDelete,
  onRefresh,
}: Props) {
  const activeValue =
    isActive === true  ? 'true'  :
    isActive === false ? 'false' : ''

  return (
    <div className="flex flex-col gap-3">

      {/* Fila principal */}
      <div className="flex items-center gap-3 flex-wrap">

        {/* Búsqueda */}
        <div className="flex items-center gap-2 flex-1 min-w-48
                        bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600
                        rounded-lg px-3 h-9 focus-within:ring-2 focus-within:ring-brand-500
                        focus-within:border-brand-500 transition-colors">
          <Search size={15} className="text-gray-400 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={e => onSearch(e.target.value)}
            placeholder="Buscar por nombre, SKU o código de barras…"
            className="flex-1 bg-transparent text-sm text-gray-900 dark:text-gray-100
                       placeholder-gray-400 dark:placeholder-gray-500 outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearch('')}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filtro activo */}
        <Select
          fullWidth={false}
          options={ACTIVE_OPTIONS}
          value={activeValue}
          onChange={e => {
            const v = e.target.value
            onIsActive(v === '' ? undefined : v === 'true')
          }}
          className="w-32"
        />

        {/* Sort by */}
        <Select
          fullWidth={false}
          options={SORT_OPTIONS}
          value={sortBy ?? 'name'}
          onChange={e => onSort(e.target.value as ProductFilters['sort_by'])}
          className="w-40"
        />

        {/* Sort dir */}
        <button
          type="button"
          onClick={() => onSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
          title={sortDir === 'asc' ? 'Ascendente' : 'Descendente'}
          className="h-9 px-2.5 rounded-lg border border-gray-300 dark:border-gray-600
                     text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700
                     transition-colors flex items-center gap-1 text-xs font-medium"
        >
          <ArrowUpDown size={13} />
          {sortDir === 'asc' ? 'ASC' : 'DESC'}
        </button>

        {/* Refresh */}
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          title="Actualizar"
          className="h-9 w-9 flex items-center justify-center rounded-lg
                     border border-gray-300 dark:border-gray-600
                     text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700
                     disabled:opacity-50 transition-colors"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>

        {/* Nuevo producto */}
        <Button
          variant="primary"
          size="sm"
          leftIcon={<Plus size={15} />}
          onClick={onNew}
          disabled={!canCreate}
          title={!canCreate ? 'Límite de productos del plan alcanzado' : undefined}
        >
          Nuevo producto
        </Button>
      </div>

      {/* Fila de acciones bulk (solo visible si hay selección) */}
      {selectedCount > 0 && (
        <div className="flex items-center gap-3 px-3 py-2 bg-brand-50 dark:bg-brand-950/30
                        border border-brand-200 dark:border-brand-800 rounded-lg">
          <span className="text-sm font-medium text-brand-700 dark:text-brand-300">
            {selectedCount} {selectedCount === 1 ? 'producto seleccionado' : 'productos seleccionados'}
          </span>
          <Button
            variant="danger"
            size="xs"
            leftIcon={<Trash2 size={12} />}
            onClick={onBulkDelete}
          >
            Eliminar seleccionados
          </Button>
        </div>
      )}
    </div>
  )
})
