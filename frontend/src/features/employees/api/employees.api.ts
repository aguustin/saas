import { http } from '@/shared/api/client'
import type { EmployeeRow, PaginatedResult } from '@/shared/types'

// ── Filtros ──────────────────────────────────────────────────────

export interface EmployeeFilters {
  search?:    string
  branch_id?: string
  is_active?: boolean
  sort_by?:   'first_name' | 'last_name' | 'hired_at' | 'created_at'
  sort_dir?:  'asc' | 'desc'
  limit?:     number
  offset?:    number
}

// ── Cuerpos de escritura ─────────────────────────────────────────

export interface CreateEmployeeBody {
  branch_id:   string
  first_name:  string
  last_name:   string
  dni?:        string
  phone?:      string
  email?:      string
  role?:       string
  salary?:     number
  hired_at?:   string
  notes?:      string
  is_active?:  boolean
}

export type UpdateEmployeeBody = Partial<CreateEmployeeBody>

// ── API ──────────────────────────────────────────────────────────

export const employeesApi = {
  list(filters: EmployeeFilters = {}): Promise<PaginatedResult<EmployeeRow>> {
    return http.get<PaginatedResult<EmployeeRow>>('/employees', { params: filters }).then(r => r.data)
  },

  create(body: CreateEmployeeBody): Promise<EmployeeRow> {
    return http.post<EmployeeRow>('/employees', body).then(r => r.data)
  },

  update(id: string, body: UpdateEmployeeBody): Promise<EmployeeRow> {
    return http.patch<EmployeeRow>(`/employees/${id}`, body).then(r => r.data)
  },

  patchActive(id: string, is_active: boolean): Promise<EmployeeRow> {
    return http.patch<EmployeeRow>(`/employees/${id}/active`, { is_active }).then(r => r.data)
  },

  remove(id: string): Promise<void> {
    return http.delete(`/employees/${id}`).then(() => undefined)
  },
}
