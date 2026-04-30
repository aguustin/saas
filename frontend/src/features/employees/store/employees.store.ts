import { create } from 'zustand'
import { employeesApi } from '@/features/employees/api/employees.api'
import type { ApiError, EmployeeRow } from '@/shared/types'
import type {
  EmployeeFilters,
  CreateEmployeeBody,
  UpdateEmployeeBody,
} from '@/features/employees/api/employees.api'

// ── Tipos ────────────────────────────────────────────────────────

type LoadStatus = 'idle' | 'loading' | 'error'

interface EmployeeState {
  items:    EmployeeRow[]
  total:    number
  limit:    number
  offset:   number
  filters:  EmployeeFilters
  status:   LoadStatus
  error:    ApiError | null
  mutating: boolean
  byId:     Record<string, EmployeeRow>
}

interface EmployeeActions {
  fetch:        (filters?: Partial<EmployeeFilters>) => Promise<void>
  setFilters:   (f: Partial<EmployeeFilters>) => void
  create:       (body: CreateEmployeeBody) => Promise<EmployeeRow>
  update:       (id: string, body: UpdateEmployeeBody) => Promise<EmployeeRow>
  toggleActive: (id: string, active: boolean) => Promise<void>
  remove:       (id: string) => Promise<void>
  reset:        () => void
}

// ── Estado inicial ───────────────────────────────────────────────

const INITIAL_FILTERS: EmployeeFilters = {
  limit:    20,
  offset:   0,
  sort_by:  'first_name',
  sort_dir: 'asc',
}

const INITIAL: EmployeeState = {
  items:    [],
  total:    0,
  limit:    20,
  offset:   0,
  filters:  INITIAL_FILTERS,
  status:   'idle',
  error:    null,
  mutating: false,
  byId:     {},
}

function index(employees: EmployeeRow[]): Record<string, EmployeeRow> {
  const m: Record<string, EmployeeRow> = {}
  for (const e of employees) m[e.id] = e
  return m
}

// ── Store ────────────────────────────────────────────────────────

export const useEmployeeStore = create<EmployeeState & EmployeeActions>((set, get) => ({
  ...INITIAL,

  fetch: async (newFilters = {}) => {
    const filters = { ...get().filters, ...newFilters }
    set({ status: 'loading', error: null, filters })
    try {
      const result = await employeesApi.list(filters)
      set({
        items:  result.items,
        total:  result.total,
        limit:  result.limit,
        offset: result.offset,
        status: 'idle',
        byId:   { ...get().byId, ...index(result.items) },
      })
    } catch (err) {
      set({ status: 'error', error: err as ApiError })
    }
  },

  setFilters: (f) => set(s => ({ filters: { ...s.filters, ...f } })),

  create: async (body) => {
    set({ mutating: true })
    try {
      const emp = await employeesApi.create(body)
      set(s => ({
        items:    [emp, ...s.items],
        total:    s.total + 1,
        byId:     { ...s.byId, [emp.id]: emp },
        mutating: false,
      }))
      return emp
    } catch (err) {
      set({ mutating: false })
      throw err
    }
  },

  update: async (id, body) => {
    set({ mutating: true })
    const snapshot = get().byId[id]
    try {
      const emp = await employeesApi.update(id, body)
      set(s => ({
        items:    s.items.map(e => e.id === id ? emp : e),
        byId:     { ...s.byId, [id]: emp },
        mutating: false,
      }))
      return emp
    } catch (err) {
      if (snapshot) set(s => ({
        items: s.items.map(e => e.id === id ? snapshot : e),
        byId:  { ...s.byId, [id]: snapshot },
      }))
      set({ mutating: false })
      throw err
    }
  },

  toggleActive: async (id, active) => {
    set({ mutating: true })
    const snapshot = get().byId[id]
    set(s => ({
      items: s.items.map(e => e.id === id ? { ...e, is_active: active } : e),
      byId:  { ...s.byId, [id]: { ...s.byId[id]!, is_active: active } },
    }))
    try {
      const emp = await employeesApi.patchActive(id, active)
      set(s => ({
        items:    s.items.map(e => e.id === id ? emp : e),
        byId:     { ...s.byId, [id]: emp },
        mutating: false,
      }))
    } catch (err) {
      if (snapshot) set(s => ({
        items: s.items.map(e => e.id === id ? snapshot : e),
        byId:  { ...s.byId, [id]: snapshot },
      }))
      set({ mutating: false })
      throw err
    }
  },

  remove: async (id) => {
    set({ mutating: true })
    const snapshot = get().items.find(e => e.id === id)
    set(s => ({
      items: s.items.filter(e => e.id !== id),
      total: s.total - 1,
    }))
    try {
      await employeesApi.remove(id)
      set({ mutating: false })
    } catch (err) {
      if (snapshot) set(s => ({
        items: [snapshot, ...s.items],
        total: s.total + 1,
      }))
      set({ mutating: false })
      throw err
    }
  },

  reset: () => set(INITIAL),
}))
