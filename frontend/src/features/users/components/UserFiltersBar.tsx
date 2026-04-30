import { memo } from 'react'
import { Search, X, UserPlus } from 'lucide-react'
import type { UserRole } from '@/shared/types'

interface Props {
  search:            string
  onSearch:          (q: string) => void
  roleFilter:        UserRole | undefined
  onRoleFilter:      (r: UserRole | undefined) => void
  isActive:          boolean | undefined
  onIsActive:        (v: boolean | undefined) => void
  total:             number
  canCreate:         boolean
  onInvite:          () => void
}

const ROLE_OPTIONS: Array<{ value: UserRole | ''; label: string }> = [
  { value: '',        label: 'Todos los roles' },
  { value: 'owner',   label: 'Owner'           },
  { value: 'admin',   label: 'Admin'           },
  { value: 'manager', label: 'Manager'         },
  { value: 'cashier', label: 'Cajero'          },
]

const ACTIVE_OPTIONS = [
  { value: '',      label: 'Todos'    },
  { value: 'true',  label: 'Activos'  },
  { value: 'false', label: 'Inactivos'},
]

export const UserFiltersBar = memo(function UserFiltersBar({
  search, onSearch,
  roleFilter, onRoleFilter,
  isActive, onIsActive,
  total, canCreate, onInvite,
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
          placeholder="Buscar por nombre o email…"
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

      {/* Filtro por rol */}
      <select
        value={roleFilter ?? ''}
        onChange={e => onRoleFilter((e.target.value as UserRole) || undefined)}
        className="h-9 pl-3 pr-8 text-sm rounded-lg border border-gray-300
                   focus:outline-none focus:ring-2 focus:ring-brand-500
                   bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
      >
        {ROLE_OPTIONS.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {/* Filtro activo/inactivo */}
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

      {/* Total */}
      <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
        {total} usuario{total !== 1 ? 's' : ''}
      </span>

      <div className="flex-1" />

      {/* Botón invitar */}
      <button
        onClick={onInvite}
        disabled={!canCreate}
        title={canCreate ? undefined : 'Límite del plan alcanzado'}
        className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium
                   bg-brand-600 text-white hover:bg-brand-700 transition-colors
                   disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <UserPlus size={15} />
        Invitar usuario
      </button>
    </div>
  )
})
