import { useState } from 'react'
import { useUserStore } from '@/features/users/store/users.store'
import type { ApiError, UserRow, UserRole } from '@/shared/types'
import type { CreateUserBody, UpdateUserBody } from '@/features/users/api/users.api'

// ── Tipos ────────────────────────────────────────────────────────

export type UserFormMode = 'create' | 'edit'

export interface UserFormFields {
  email:      string
  password:   string
  first_name: string
  last_name:  string
  role:       UserRole
  branch_id:  string
}

export interface UserFormErrors {
  email?:      string
  password?:   string
  first_name?: string
  role?:       string
  global?:     string
}

const BLANK: UserFormFields = {
  email:      '',
  password:   '',
  first_name: '',
  last_name:  '',
  role:       'cashier',
  branch_id:  '',
}

function userToFields(user: UserRow): UserFormFields {
  return {
    email:      user.email,
    password:   '',
    first_name: user.first_name ?? '',
    last_name:  user.last_name  ?? '',
    role:       user.role,
    branch_id:  user.branch_id  ?? '',
  }
}

// ── Hook ────────────────────────────────────────────────────────

export function useUserForm(
  mode: UserFormMode,
  target: UserRow | null,
  assignableRoles: UserRole[],
  onSuccess: (user: UserRow) => void,
) {
  const createUser = useUserStore(s => s.create)
  const update     = useUserStore(s => s.update)

  const [fields,     setFields]     = useState<UserFormFields>(
    target ? userToFields(target) : { ...BLANK, role: assignableRoles[0] ?? 'cashier' },
  )
  const [errors,     setErrors]     = useState<UserFormErrors>({})
  const [submitting, setSubmitting] = useState(false)

  function set<K extends keyof UserFormFields>(key: K, val: UserFormFields[K]) {
    setFields(prev => ({ ...prev, [key]: val }))
    setErrors(prev => ({ ...prev, [key]: undefined, global: undefined }))
  }

  function validate(): boolean {
    const e: UserFormErrors = {}
    if (mode === 'create') {
      if (!fields.email.trim()) e.email = 'El email es requerido'
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) e.email = 'Email inválido'
      if (!fields.password) e.password = 'La contraseña es requerida'
      else if (fields.password.length < 8) e.password = 'Mínimo 8 caracteres'
      if (!fields.first_name.trim()) e.first_name = 'El nombre es requerido'
    }
    if (!fields.role) e.role = 'El rol es requerido'
    if (fields.role && !assignableRoles.includes(fields.role))
      e.role = 'No tenés permisos para asignar este rol'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function submit() {
    if (!validate()) return
    setSubmitting(true)
    try {
      let result: UserRow
      if (mode === 'create') {
        const body: CreateUserBody = {
          email:      fields.email.trim(),
          password:   fields.password,
          role:       fields.role,
          first_name: fields.first_name.trim(),
          last_name:  fields.last_name  || null,
          branch_id:  fields.branch_id  || null,
        }
        result = await createUser(body)
      } else {
        if (!target) throw new Error('No target user for edit')
        const body: UpdateUserBody = {
          first_name: fields.first_name || undefined,
          last_name:  fields.last_name  || null,
          branch_id:  fields.branch_id  || null,
        }
        result = await update(target.id, body)
      }
      onSuccess(result)
    } catch (err) {
      const apiErr = err as ApiError
      if (apiErr.code === 'VALIDATION_ERROR') {
        setErrors({ global: apiErr.message })
      } else if (apiErr.code === 'DUPLICATE') {
        setErrors({ email: 'Ya existe un usuario con este email' })
      } else if (apiErr.code === 'PLAN_LIMIT_REACHED') {
        setErrors({ global: 'PLAN_LIMIT_REACHED' })
      } else {
        setErrors({ global: apiErr.message ?? 'Error al guardar' })
      }
    } finally {
      setSubmitting(false)
    }
  }

  function reset() {
    setFields(target ? userToFields(target) : { ...BLANK, role: assignableRoles[0] ?? 'cashier' })
    setErrors({})
  }

  return { fields, errors, submitting, set, submit, reset }
}
