import { useState } from 'react'
import { useEmployeeStore } from '@/features/employees/store/employees.store'
import type { ApiError, EmployeeRow } from '@/shared/types'
import type { CreateEmployeeBody, UpdateEmployeeBody } from '@/features/employees/api/employees.api'

// ── Tipos ────────────────────────────────────────────────────────

export type EmployeeFormMode = 'create' | 'edit'

export interface EmployeeFormFields {
  first_name: string
  last_name:  string
  branch_id:  string
  dni:        string
  phone:      string
  email:      string
  role:       string
  salary:     string
  hired_at:   string
  notes:      string
  is_active:  boolean
}

export interface EmployeeFormErrors {
  first_name?: string
  last_name?:  string
  branch_id?:  string
  salary?:     string
  global?:     string
}

const BLANK: EmployeeFormFields = {
  first_name: '',
  last_name:  '',
  branch_id:  '',
  dni:        '',
  phone:      '',
  email:      '',
  role:       '',
  salary:     '',
  hired_at:   '',
  notes:      '',
  is_active:  true,
}

function employeeToFields(e: EmployeeRow): EmployeeFormFields {
  return {
    first_name: e.first_name,
    last_name:  e.last_name,
    branch_id:  e.branch_id,
    dni:        e.dni        ?? '',
    phone:      e.phone      ?? '',
    email:      e.email      ?? '',
    role:       e.role       ?? '',
    salary:     e.salary     != null ? String(e.salary) : '',
    hired_at:   e.hired_at   ? e.hired_at.slice(0, 10) : '',
    notes:      e.notes      ?? '',
    is_active:  e.is_active,
  }
}

// ── Hook ─────────────────────────────────────────────────────────

export function useEmployeeForm(
  mode: EmployeeFormMode,
  target: EmployeeRow | null,
  defaultBranchId: string | null,
  onSuccess: (emp: EmployeeRow) => void,
) {
  const create = useEmployeeStore(s => s.create)
  const update = useEmployeeStore(s => s.update)

  const [fields,     setFields]     = useState<EmployeeFormFields>(
    target ? employeeToFields(target)
           : { ...BLANK, branch_id: defaultBranchId ?? '' },
  )
  const [errors,     setErrors]     = useState<EmployeeFormErrors>({})
  const [submitting, setSubmitting] = useState(false)

  function set<K extends keyof EmployeeFormFields>(key: K, val: EmployeeFormFields[K]) {
    setFields(prev => ({ ...prev, [key]: val }))
    setErrors(prev => ({ ...prev, [key]: undefined, global: undefined }))
  }

  function validate(): boolean {
    const e: EmployeeFormErrors = {}
    if (!fields.first_name.trim()) e.first_name = 'El nombre es requerido'
    if (!fields.last_name.trim())  e.last_name  = 'El apellido es requerido'
    if (!fields.branch_id)         e.branch_id  = 'La sucursal es requerida'
    if (fields.salary && isNaN(Number(fields.salary)))
      e.salary = 'El salario debe ser un número'
    if (fields.salary && Number(fields.salary) < 0)
      e.salary = 'El salario no puede ser negativo'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function submit() {
    if (!validate()) return
    setSubmitting(true)
    try {
      let result: EmployeeRow
      const salary = fields.salary ? Number(fields.salary) : undefined

      if (mode === 'create') {
        const body: CreateEmployeeBody = {
          branch_id:  fields.branch_id,
          first_name: fields.first_name.trim(),
          last_name:  fields.last_name.trim(),
          dni:        fields.dni       || undefined,
          phone:      fields.phone     || undefined,
          email:      fields.email     || undefined,
          role:       fields.role      || undefined,
          salary,
          hired_at:   fields.hired_at  || undefined,
          notes:      fields.notes     || undefined,
          is_active:  fields.is_active,
        }
        result = await create(body)
      } else {
        if (!target) throw new Error('No target for edit')
        const body: UpdateEmployeeBody = {
          first_name: fields.first_name.trim() || undefined,
          last_name:  fields.last_name.trim()  || undefined,
          branch_id:  fields.branch_id          || undefined,
          dni:        fields.dni                || undefined,
          phone:      fields.phone              || undefined,
          email:      fields.email              || undefined,
          role:       fields.role               || undefined,
          salary,
          hired_at:   fields.hired_at           || undefined,
          notes:      fields.notes              || undefined,
          is_active:  fields.is_active,
        }
        result = await update(target.id, body)
      }
      onSuccess(result)
    } catch (err) {
      const apiErr = err as ApiError
      if (apiErr.code === 'VALIDATION_ERROR') {
        setErrors({ global: apiErr.message })
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
    setFields(target ? employeeToFields(target) : { ...BLANK, branch_id: defaultBranchId ?? '' })
    setErrors({})
  }

  return { fields, errors, submitting, set, submit, reset }
}
