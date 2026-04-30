import { create } from 'zustand'
import { usersApi } from '@/features/users/api/users.api'
import type { ApiError, UserRow, UserRole } from '@/shared/types'
import type { UserFilters, CreateUserBody, UpdateUserBody } from '@/features/users/api/users.api'

// ── Tipos ────────────────────────────────────────────────────────

type LoadStatus = 'idle' | 'loading' | 'error'

interface UserState {
  items:    UserRow[]
  total:    number
  limit:    number
  offset:   number
  filters:  UserFilters
  status:   LoadStatus
  error:    ApiError | null
  mutating: boolean
}

interface UserActions {
  fetch:        (filters?: Partial<UserFilters>) => Promise<void>
  setFilters:   (f: Partial<UserFilters>) => void
  create:       (body: CreateUserBody) => Promise<UserRow>
  update:       (id: string, body: UpdateUserBody) => Promise<UserRow>
  changeRole:   (id: string, role: UserRole) => Promise<void>
  toggleActive: (id: string, active: boolean) => Promise<void>
  remove:       (id: string) => Promise<void>
  reset:        () => void
}

// ── Estado inicial ───────────────────────────────────────────────

const INITIAL_FILTERS: UserFilters = { limit: 20, offset: 0 }

const INITIAL: UserState = {
  items:    [],
  total:    0,
  limit:    20,
  offset:   0,
  filters:  INITIAL_FILTERS,
  status:   'idle',
  error:    null,
  mutating: false,
}


// ── Store ────────────────────────────────────────────────────────

export const useUserStore = create<UserState & UserActions>((set, get) => ({
  ...INITIAL,

  fetch: async (newFilters = {}) => {
    const filters = { ...get().filters, ...newFilters }
    set({ status: 'loading', error: null, filters })
    try {
      const result = await usersApi.list(filters)
      set({ items: result.items, total: result.total, limit: result.limit, offset: result.offset, status: 'idle' })
    } catch (err) {
      set({ status: 'error', error: err as ApiError })
    }
  },

  setFilters: (f) => set(s => ({ filters: { ...s.filters, ...f } })),

  create: async (body) => {
    set({ mutating: true })
    try {
      const user = await usersApi.create(body)
      set(s => ({ items: [user, ...s.items], total: s.total + 1, mutating: false }))
      return user
    } catch (err) {
      set({ mutating: false })
      throw err
    }
  },

  update: async (id, body) => {
    set({ mutating: true })
    const snapshot = get().items.find(u => u.id === id)
    try {
      const user = await usersApi.update(id, body)
      set(s => ({ items: s.items.map(u => u.id === id ? user : u), mutating: false }))
      return user
    } catch (err) {
      if (snapshot) set(s => ({ items: s.items.map(u => u.id === id ? snapshot : u) }))
      set({ mutating: false })
      throw err
    }
  },

  changeRole: async (id, role) => {
    set({ mutating: true })
    const snapshot = get().items.find(u => u.id === id)
    set(s => ({ items: s.items.map(u => u.id === id ? { ...u, role } : u) }))
    try {
      const user = await usersApi.update(id, { role })
      set(s => ({ items: s.items.map(u => u.id === id ? user : u), mutating: false }))
    } catch (err) {
      if (snapshot) set(s => ({ items: s.items.map(u => u.id === id ? snapshot : u) }))
      set({ mutating: false })
      throw err
    }
  },

  toggleActive: async (id, active) => {
    set({ mutating: true })
    const snapshot = get().items.find(u => u.id === id)
    set(s => ({ items: s.items.map(u => u.id === id ? { ...u, is_active: active } : u) }))
    try {
      const user = await usersApi.update(id, { is_active: active })
      set(s => ({ items: s.items.map(u => u.id === id ? user : u), mutating: false }))
    } catch (err) {
      if (snapshot) set(s => ({ items: s.items.map(u => u.id === id ? snapshot : u) }))
      set({ mutating: false })
      throw err
    }
  },

  remove: async (id) => {
    set({ mutating: true })
    const snapshot = get().items.find(u => u.id === id)
    set(s => ({ items: s.items.filter(u => u.id !== id), total: s.total - 1 }))
    try {
      await usersApi.remove(id)
      set({ mutating: false })
    } catch (err) {
      if (snapshot) set(s => ({ items: [snapshot, ...s.items], total: s.total + 1 }))
      set({ mutating: false })
      throw err
    }
  },

  reset: () => set(INITIAL),
}))
