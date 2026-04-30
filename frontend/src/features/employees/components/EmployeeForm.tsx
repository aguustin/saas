import { useEffect } from 'react'
import { Modal } from '@/shared/components/ui/Modal'
import { Input } from '@/shared/components/ui/Input'
import { useEmployeeForm } from '@/features/employees/hooks/useEmployeeForm'
import type { EmployeeRow } from '@/shared/types'

// ── Props ────────────────────────────────────────────────────────

interface Props {
  open:            boolean
  onClose:         () => void
  onSuccess:       (emp: EmployeeRow) => void
  target:          EmployeeRow | null
  defaultBranchId: string | null
}

// ── Componente ───────────────────────────────────────────────────

export function EmployeeForm({ open, onClose, onSuccess, target, defaultBranchId }: Props) {
  const mode = target ? 'edit' : 'create'

  const { fields, errors, submitting, set, submit, reset } = useEmployeeForm(
    mode, target, defaultBranchId, onSuccess,
  )

  useEffect(() => {
    if (open) reset()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, target])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await submit()
  }

  const isPlanLimit = errors.global === 'PLAN_LIMIT_REACHED'

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'create' ? 'Nuevo empleado' : 'Editar empleado'}
      size="lg"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700
                       border border-gray-300 hover:bg-gray-50 transition-colors
                       disabled:opacity-50
                       dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-800"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="employee-form"
            disabled={submitting}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white
                       bg-brand-600 hover:bg-brand-700 transition-colors disabled:opacity-50
                       flex items-center gap-2"
          >
            {submitting && (
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {mode === 'create' ? 'Crear empleado' : 'Guardar cambios'}
          </button>
        </>
      }
    >
      {/* Plan limit warning */}
      {isPlanLimit && (
        <div className="mb-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200
                        dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          Alcanzaste el límite de empleados de tu plan.{' '}
          <a href="/app/billing" className="underline font-medium">Mejorar plan</a>
        </div>
      )}

      <form id="employee-form" onSubmit={handleSubmit} className="space-y-4">

        {/* Nombre y apellido */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Nombre *"
            value={fields.first_name}
            onChange={e => set('first_name', e.target.value)}
            error={errors.first_name}
            placeholder="Juan"
          />
          <Input
            label="Apellido *"
            value={fields.last_name}
            onChange={e => set('last_name', e.target.value)}
            error={errors.last_name}
            placeholder="Pérez"
          />
        </div>

        {/* Sucursal */}
        <Input
          label="ID de sucursal *"
          value={fields.branch_id}
          onChange={e => set('branch_id', e.target.value)}
          error={errors.branch_id}
          placeholder="branch-uuid"
        />

        {/* DNI y teléfono */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="DNI"
            value={fields.dni}
            onChange={e => set('dni', e.target.value)}
            placeholder="12345678"
          />
          <Input
            label="Teléfono"
            value={fields.phone}
            onChange={e => set('phone', e.target.value)}
            placeholder="+54 11 1234-5678"
          />
        </div>

        {/* Email personal */}
        <Input
          label="Email"
          type="email"
          value={fields.email}
          onChange={e => set('email', e.target.value)}
          placeholder="juan@ejemplo.com"
        />

        {/* Cargo y salario */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Cargo / Puesto"
            value={fields.role}
            onChange={e => set('role', e.target.value)}
            placeholder="Vendedor, Supervisor…"
          />
          <Input
            label="Salario"
            type="number"
            min="0"
            step="0.01"
            value={fields.salary}
            onChange={e => set('salary', e.target.value)}
            error={errors.salary}
            prefix="$"
            placeholder="0.00"
          />
        </div>

        {/* Fecha de ingreso */}
        <Input
          label="Fecha de ingreso"
          type="date"
          value={fields.hired_at}
          onChange={e => set('hired_at', e.target.value)}
        />

        {/* Notas */}
        <div className="w-full">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Notas
          </label>
          <textarea
            value={fields.notes}
            onChange={e => set('notes', e.target.value)}
            rows={3}
            placeholder="Información adicional…"
            className="w-full text-sm rounded-lg border border-gray-300 px-3 py-2
                       focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500
                       bg-white dark:bg-gray-800 dark:border-gray-600
                       dark:text-gray-100 dark:placeholder-gray-500 resize-none"
          />
        </div>

        {/* Activo */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Activo</span>
          <button
            type="button"
            role="switch"
            aria-checked={fields.is_active}
            onClick={() => set('is_active', !fields.is_active)}
            className={[
              'relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2',
              fields.is_active ? 'bg-brand-500' : 'bg-gray-300 dark:bg-gray-600',
            ].join(' ')}
          >
            <span
              className={[
                'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow',
                'translate-y-0.5 transition-transform',
                fields.is_active ? 'translate-x-5' : 'translate-x-0.5',
              ].join(' ')}
            />
          </button>
        </div>

        {/* Error global */}
        {errors.global && !isPlanLimit && (
          <p className="text-sm text-red-600 dark:text-red-400">{errors.global}</p>
        )}
      </form>
    </Modal>
  )
}
