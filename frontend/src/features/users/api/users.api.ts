import { http } from '@/shared/api/client'
import type { UserRow, UserRole, PaginatedResult } from '@/shared/types'

// ── Filtros ──────────────────────────────────────────────────────

export interface UserFilters {
  search?:    string
  role?:      UserRole
  is_active?: boolean
  limit?:     number
  offset?:    number
}

// ── Cuerpos de escritura ─────────────────────────────────────────

export interface CreateUserBody {
  email:       string
  password:    string
  role:        UserRole
  first_name:  string
  last_name?:  string | null
  branch_id?:  string | null
}

export interface UpdateUserBody {
  first_name?: string
  last_name?:  string | null
  branch_id?:  string | null
  role?:       UserRole
  is_active?:  boolean
}

// ── API ──────────────────────────────────────────────────────────

export const usersApi = {
  list(filters: UserFilters = {}): Promise<PaginatedResult<UserRow>> {
    return http.get<PaginatedResult<UserRow>>('/users', { params: filters }).then(r => r.data)
  },

  create(body: CreateUserBody): Promise<UserRow> {
    return http.post<UserRow>('/users', body).then(r => r.data)
  },

  update(id: string, body: UpdateUserBody): Promise<UserRow> {
    return http.patch<UserRow>(`/users/${id}`, body).then(r => r.data)
  },

  resetPassword(id: string, new_password: string): Promise<void> {
    return http.post(`/users/${id}/reset-password`, { new_password }).then(() => undefined)
  },

  remove(id: string): Promise<void> {
    return http.delete(`/users/${id}`).then(() => undefined)
  },
}
