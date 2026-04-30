import { memo, useRef } from 'react'
import { Pencil, Trash2, UserCog } from 'lucide-react'
import { RoleBadge } from '@/shared/components/ui/Badge'
import { Skeleton } from '@/shared/components/ui/Skeleton'
import { formatRelative, formatDate } from '@/shared/utils/date'
import type { UserRow, UserRole } from '@/shared/types'

// ── Paginación ────────────────────────────────────────────────────

function buildPageRange(current: number, total: number): Array<number | '…'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const range: Array<number | '…'> = [1]
  if (current > 3) range.push('…')
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) range.push(i)
  if (current < total - 2) range.push('…')
  range.push(total)
  return range
}

function PaginationButton({
  page, current, onClick,
}: { page: number | '…'; current: number; onClick: (p: number) => void }) {
  if (page === '…') return (
    <span className="px-2 py-1 text-xs text-gray-400">…</span>
  )
  const active = page === current
  return (
    <button
      onClick={() => onClick(page)}
      className={[
        'w-8 h-8 rounded-lg text-xs font-medium transition-colors',
        active
          ? 'bg-brand-600 text-white'
          : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700',
      ].join(' ')}
    >
      {page}
    </button>
  )
}

// ── Fila skeleton ─────────────────────────────────────────────────

function SkeletonRowEl() {
  return (
    <tr>
      {Array.from({ length: 6 }).map((_, i) => (
        <td key={i} className="px-5 py-3">
          <Skeleton height={14} width={i === 0 ? '70%' : '50%'} />
        </td>
      ))}
    </tr>
  )
}

// ── Toggle activo ─────────────────────────────────────────────────

const ActiveToggle = memo(function ActiveToggle({
  userId, active, disabled, onToggle,
}: {
  userId:   string
  active:   boolean
  disabled: boolean
  onToggle: (id: string, val: boolean) => void
}) {
  return (
    <button
      role="switch"
      aria-checked={active}
      disabled={disabled}
      onClick={() => onToggle(userId, !active)}
      title={disabled ? 'No puedes modificar este usuario' : undefined}
      className={[
        'relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        active ? 'bg-brand-500' : 'bg-gray-300 dark:bg-gray-600',
      ].join(' ')}
    >
      <span
        className={[
          'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow',
          'translate-y-0.5 transition-transform',
          active ? 'translate-x-4' : 'translate-x-0.5',
        ].join(' ')}
      />
    </button>
  )
})

// ── Role selector inline ──────────────────────────────────────────

const RoleSelect = memo(function RoleSelect({
  userId, current, assignableRoles, disabled, onChange,
}: {
  userId:          string
  current:         UserRole
  assignableRoles: UserRole[]
  disabled:        boolean
  onChange:        (id: string, role: UserRole) => void
}) {
  const canChange = assignableRoles.includes(current) && !disabled

  if (!canChange) return <RoleBadge role={current} />

  return (
    <select
      value={current}
      onChange={e => onChange(userId, e.target.value as UserRole)}
      className="text-xs rounded-lg border border-gray-300 px-2 py-1 h-7
                 focus:outline-none focus:ring-1 focus:ring-brand-500
                 bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
    >
      {assignableRoles.map(r => (
        <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
      ))}
    </select>
  )
})

// ── UserRow ───────────────────────────────────────────────────────

interface UserRowProps {
  user:            UserRow
  isMe:            boolean
  canEdit:         boolean
  canDeactivate:   boolean
  assignableRoles: UserRole[]
  onEdit:          (user: UserRow) => void
  onDelete:        (user: UserRow) => void
  onToggleActive:  (id: string, val: boolean) => void
  onChangeRole:    (id: string, role: UserRole) => void
}

const UserRowItem = memo(function UserRowItem({
  user, isMe, canEdit, canDeactivate, assignableRoles,
  onEdit, onDelete, onToggleActive, onChangeRole,
}: UserRowProps) {
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || '—'

  return (
    <tr
      className={[
        'hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors',
        !user.is_active ? 'opacity-60' : '',
      ].join(' ')}
    >
      {/* Nombre */}
      <td className="px-5 py-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-brand-100 dark:bg-brand-950/40
                          flex items-center justify-center shrink-0">
            <span className="text-xs font-semibold text-brand-600 dark:text-brand-400 uppercase">
              {(user.first_name?.[0] ?? user.email[0]).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{fullName}</p>
            {isMe && (
              <span className="text-[10px] text-brand-500 font-medium">Tú</span>
            )}
          </div>
        </div>
      </td>

      {/* Email */}
      <td className="px-5 py-3 text-gray-600 dark:text-gray-400 text-xs">
        {user.email}
      </td>

      {/* Rol */}
      <td className="px-5 py-3">
        <RoleSelect
          userId={user.id}
          current={user.role}
          assignableRoles={assignableRoles}
          disabled={isMe || !canEdit}
          onChange={onChangeRole}
        />
      </td>

      {/* Sucursal */}
      <td className="px-5 py-3 text-xs text-gray-500 dark:text-gray-400">
        {user.branch_name ?? <span className="text-gray-300 dark:text-gray-600">—</span>}
      </td>

      {/* Último acceso */}
      <td className="px-5 py-3 text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap"
          title={user.last_login_at ? formatDate(user.last_login_at) : undefined}>
        {user.last_login_at ? formatRelative(user.last_login_at) : '—'}
      </td>

      {/* Toggle activo */}
      <td className="px-5 py-3 text-center">
        <ActiveToggle
          userId={user.id}
          active={user.is_active}
          disabled={!canDeactivate}
          onToggle={onToggleActive}
        />
      </td>

      {/* Acciones */}
      <td className="px-5 py-3">
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100
                        [tr:hover_&]:opacity-100 transition-opacity">
          {canEdit && (
            <button
              onClick={() => onEdit(user)}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700
                         text-gray-400 hover:text-brand-600 transition-colors"
              title="Editar"
            >
              <Pencil size={14} />
            </button>
          )}
          {canEdit && !isMe && (
            <button
              onClick={() => onDelete(user)}
              className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30
                         text-gray-400 hover:text-red-600 transition-colors"
              title="Eliminar"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </td>
    </tr>
  )
})

// ── Props ────────────────────────────────────────────────────────

interface Props {
  items:           UserRow[]
  loading:         boolean
  myUserId:        string | undefined
  assignableRoles: UserRole[]
  canEditUser:     (role: UserRole) => boolean
  canDeactivate:   (id: string, role: UserRole) => boolean
  page:            number
  pageCount:       number
  onPageChange:    (p: number) => void
  onEdit:          (user: UserRow) => void
  onDelete:        (user: UserRow) => void
  onToggleActive:  (id: string, val: boolean) => void
  onChangeRole:    (id: string, role: UserRole) => void
}

// ── Tabla ────────────────────────────────────────────────────────

export function UserTable({
  items, loading, myUserId, assignableRoles, canEditUser, canDeactivate,
  page, pageCount, onPageChange,
  onEdit, onDelete, onToggleActive, onChangeRole,
}: Props) {
  const headerRef = useRef<HTMLTableCellElement>(null)

  return (
    <div className="rounded-2xl border border-gray-100 dark:border-gray-800
                    bg-white dark:bg-gray-900 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-400 dark:text-gray-500
                           border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
              <th ref={headerRef} className="px-5 py-3 text-left font-medium">Usuario</th>
              <th className="px-5 py-3 text-left font-medium">Email</th>
              <th className="px-5 py-3 text-left font-medium">Rol</th>
              <th className="px-5 py-3 text-left font-medium">Sucursal</th>
              <th className="px-5 py-3 text-left font-medium">Último acceso</th>
              <th className="px-5 py-3 text-center font-medium">Activo</th>
              <th className="px-5 py-3 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">

            {loading && items.length === 0 && (
              Array.from({ length: 8 }).map((_, i) => <SkeletonRowEl key={i} />)
            )}

            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-14 text-center">
                  <UserCog size={32} className="mx-auto text-gray-200 dark:text-gray-700 mb-2" strokeWidth={1} />
                  <p className="text-sm text-gray-400">No hay usuarios que coincidan</p>
                </td>
              </tr>
            )}

            {items.map(user => (
              <UserRowItem
                key={user.id}
                user={user}
                isMe={user.id === myUserId}
                canEdit={canEditUser(user.role)}
                canDeactivate={canDeactivate(user.id, user.role)}
                assignableRoles={assignableRoles}
                onEdit={onEdit}
                onDelete={onDelete}
                onToggleActive={onToggleActive}
                onChangeRole={onChangeRole}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-1 px-5 py-3
                        border-t border-gray-100 dark:border-gray-800">
          {buildPageRange(page, pageCount).map((p, i) => (
            <PaginationButton key={i} page={p} current={page} onClick={onPageChange} />
          ))}
        </div>
      )}
    </div>
  )
}
