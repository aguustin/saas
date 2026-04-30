import { useEffect, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Modal } from '@/shared/components/ui/Modal'
import { Input } from '@/shared/components/ui/Input'
import { Select } from '@/shared/components/ui/Select'
import { useUserForm } from '@/features/users/hooks/useUserForm'
import { useBranches } from '@/features/users/hooks/useBranches'
import type { UserRow, UserRole } from '@/shared/types'

const ROLE_LABELS: Record<UserRole, string> = {
  owner:   'Owner',
  admin:   'Admin',
  manager: 'Manager',
  cashier: 'Cajero',
}

interface Props {
  open:            boolean
  onClose:         () => void
  onSuccess:       (user: UserRow) => void
  target:          UserRow | null
  assignableRoles: UserRole[]
}

export function UserForm({ open, onClose, onSuccess, target, assignableRoles }: Props) {
  const mode = target ? 'edit' : 'create'
  const [showPassword, setShowPassword] = useState(false)

  const { fields, errors, submitting, set, submit, reset } = useUserForm(
    mode, target, assignableRoles, onSuccess,
  )
  const { branches } = useBranches()

  useEffect(() => {
    if (open) { reset(); setShowPassword(false) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, target])

  const roleOptions = assignableRoles.map(r => ({ value: r, label: ROLE_LABELS[r] }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await submit()
  }

  const isPlanLimit = errors.global === 'PLAN_LIMIT_REACHED'

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'create' ? 'Nuevo usuario' : 'Editar usuario'}
      description={
        mode === 'create'
          ? 'Creá un usuario con acceso al sistema.'
          : 'Modificá los datos del usuario.'
      }
      size="md"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-lg text-sm font-medium text-content-2
                       border border-edge-2 hover:bg-surface-2 transition-colors
                       disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="user-form"
            disabled={submitting}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white
                       bg-brand-600 hover:bg-brand-700 transition-colors disabled:opacity-50
                       flex items-center gap-2"
          >
            {submitting && (
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {mode === 'create' ? 'Crear usuario' : 'Guardar cambios'}
          </button>
        </>
      }
    >
      {/* Plan limit warning */}
      {isPlanLimit && (
        <div className="mb-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200
                        dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          Alcanzaste el límite de usuarios de tu plan.{' '}
          <a href="/app/billing" className="underline font-medium">Mejorar plan</a>
        </div>
      )}

      <form id="user-form" onSubmit={handleSubmit} className="space-y-4">

        {/* Email — solo en create */}
        {mode === 'create' && (
          <Input
            label="Email *"
            type="email"
            value={fields.email}
            onChange={e => set('email', e.target.value)}
            error={errors.email}
            placeholder="usuario@empresa.com"
            autoComplete="off"
          />
        )}

        {/* Contraseña — solo en create */}
        {mode === 'create' && (
          <Input
            label="Contraseña *"
            type={showPassword ? 'text' : 'password'}
            value={fields.password}
            onChange={e => set('password', e.target.value)}
            error={errors.password}
            placeholder="Mínimo 8 caracteres"
            autoComplete="new-password"
            suffix={
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="text-content-subtle hover:text-content-muted transition-colors"
                tabIndex={-1}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            }
          />
        )}

        {/* Nombre y apellido */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label={mode === 'create' ? 'Nombre *' : 'Nombre'}
            value={fields.first_name}
            onChange={e => set('first_name', e.target.value)}
            error={errors.first_name}
            placeholder="Juan"
          />
          <Input
            label="Apellido"
            value={fields.last_name}
            onChange={e => set('last_name', e.target.value)}
            placeholder="Pérez"
          />
        </div>

        {/* Rol — solo en create */}
        {mode === 'create' && roleOptions.length > 0 && (
          <Select
            label="Rol *"
            value={fields.role}
            onChange={e => set('role', e.target.value as UserRole)}
            options={roleOptions}
            error={errors.role}
          />
        )}

        {/* Sucursal */}
        <Select
          label="Sucursal"
          value={fields.branch_id}
          onChange={e => set('branch_id', e.target.value)}
          hint="Requerida para roles manager y cajero"
          options={[
            { value: '', label: 'Sin sucursal (acceso global)' },
            ...branches.map(b => ({ value: b.id, label: b.name })),
          ]}
        />

        {/* Error global */}
        {errors.global && !isPlanLimit && (
          <p className="text-sm text-red-600 dark:text-red-400">{errors.global}</p>
        )}
      </form>
    </Modal>
  )
}
