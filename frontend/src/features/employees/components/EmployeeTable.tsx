import { memo } from 'react'
import { Pencil, Trash2, Users } from 'lucide-react'
import { Badge } from '@/shared/components/ui/Badge'
import { Skeleton } from '@/shared/components/ui/Skeleton'
import { formatDateShort, formatRelative } from '@/shared/utils/date'
import type { EmployeeRow } from '@/shared/types'

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
  if (page === '…') return <span className="px-2 py-1 text-xs text-gray-400">…</span>
  return (
    <button
      onClick={() => onClick(page)}
      className={[
        'w-8 h-8 rounded-lg text-xs font-medium transition-colors',
        page === current
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
      {Array.from({ length: 7 }).map((_, i) => (
        <td key={i} className="px-5 py-3">
          <Skeleton height={14} width={i === 0 ? '70%' : '50%'} />
        </td>
      ))}
    </tr>
  )
}

// ── Toggle activo ─────────────────────────────────────────────────

const ActiveToggle = memo(function ActiveToggle({
  empId, active, onToggle,
}: { empId: string; active: boolean; onToggle: (id: string, val: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={active}
      onClick={() => onToggle(empId, !active)}
      className={[
        'relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1',
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

// ── EmployeeRow ───────────────────────────────────────────────────

interface RowProps {
  emp:            EmployeeRow
  onEdit:         (emp: EmployeeRow) => void
  onDelete:       (emp: EmployeeRow) => void
  onToggleActive: (id: string, val: boolean) => void
}

const EmployeeRow = memo(function EmployeeRow({ emp, onEdit, onDelete, onToggleActive }: RowProps) {
  return (
    <tr
      className={[
        'hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors',
        !emp.is_active ? 'opacity-60' : '',
      ].join(' ')}
    >
      {/* Nombre */}
      <td className="px-5 py-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-teal-100 dark:bg-teal-950/40
                          flex items-center justify-center shrink-0">
            <span className="text-xs font-semibold text-teal-600 dark:text-teal-400">
              {emp.first_name[0].toUpperCase()}
            </span>
          </div>
          <div>
            <p className="font-medium text-gray-900 dark:text-gray-100">
              {emp.first_name} {emp.last_name}
            </p>
            {emp.dni && (
              <p className="text-[10px] text-gray-400">DNI {emp.dni}</p>
            )}
          </div>
        </div>
      </td>

      {/* Sucursal */}
      <td className="px-5 py-3 text-xs text-gray-500 dark:text-gray-400">
        {emp.branch_name}
      </td>

      {/* Cargo */}
      <td className="px-5 py-3">
        {emp.role ? (
          <Badge variant="teal" size="sm">{emp.role}</Badge>
        ) : (
          <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>
        )}
      </td>

      {/* Contacto */}
      <td className="px-5 py-3 text-xs text-gray-500 dark:text-gray-400">
        <div className="space-y-0.5">
          {emp.phone && <p>{emp.phone}</p>}
          {emp.email && <p className="truncate max-w-[140px]">{emp.email}</p>}
          {!emp.phone && !emp.email && <span className="text-gray-300 dark:text-gray-600">—</span>}
        </div>
      </td>

      {/* Ingreso */}
      <td className="px-5 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
        {emp.hired_at ? formatDateShort(emp.hired_at) : '—'}
      </td>

      {/* Salario */}
      <td className="px-5 py-3 text-xs font-medium text-gray-700 dark:text-gray-300 tabular-nums">
        {emp.salary != null ? `$${emp.salary.toFixed(2)}` : '—'}
      </td>

      {/* Toggle activo */}
      <td className="px-5 py-3 text-center">
        <ActiveToggle empId={emp.id} active={emp.is_active} onToggle={onToggleActive} />
      </td>

      {/* Acciones */}
      <td className="px-5 py-3">
        <div className="flex items-center justify-end gap-1
                        opacity-0 [tr:hover_&]:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(emp)}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700
                       text-gray-400 hover:text-brand-600 transition-colors"
            title="Editar"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => onDelete(emp)}
            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30
                       text-gray-400 hover:text-red-600 transition-colors"
            title="Eliminar"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  )
})

// ── Props ────────────────────────────────────────────────────────

interface Props {
  items:          EmployeeRow[]
  loading:        boolean
  page:           number
  pageCount:      number
  onPageChange:   (p: number) => void
  onEdit:         (emp: EmployeeRow) => void
  onDelete:       (emp: EmployeeRow) => void
  onToggleActive: (id: string, val: boolean) => void
}

// ── Tabla ────────────────────────────────────────────────────────

export function EmployeeTable({
  items, loading, page, pageCount, onPageChange,
  onEdit, onDelete, onToggleActive,
}: Props) {
  return (
    <div className="rounded-2xl border border-gray-100 dark:border-gray-800
                    bg-white dark:bg-gray-900 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-400 dark:text-gray-500
                           border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
              <th className="px-5 py-3 text-left font-medium">Empleado</th>
              <th className="px-5 py-3 text-left font-medium">Sucursal</th>
              <th className="px-5 py-3 text-left font-medium">Cargo</th>
              <th className="px-5 py-3 text-left font-medium">Contacto</th>
              <th className="px-5 py-3 text-left font-medium">Ingreso</th>
              <th className="px-5 py-3 text-left font-medium">Salario</th>
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
                <td colSpan={8} className="px-5 py-14 text-center">
                  <Users size={32} className="mx-auto text-gray-200 dark:text-gray-700 mb-2" strokeWidth={1} />
                  <p className="text-sm text-gray-400">No hay empleados que coincidan</p>
                </td>
              </tr>
            )}

            {items.map(emp => (
              <EmployeeRow
                key={emp.id}
                emp={emp}
                onEdit={onEdit}
                onDelete={onDelete}
                onToggleActive={onToggleActive}
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
