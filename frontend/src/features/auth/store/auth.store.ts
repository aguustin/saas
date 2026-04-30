import { create } from 'zustand'
import type { MeResponse, UserRole, PlanName, ActiveSession } from '@/shared/types'

// ── Persistencia ─────────────────────────────────────────────────
// access_token: NUNCA en localStorage (vulnerabilidad XSS)
// refresh_token: localStorage (necesario para restaurar sesión entre recargas)
// tenant_id: localStorage (evita pedirlo de nuevo en login)

const RT_KEY        = 'saas_refresh_token'
const TENANT_ID_KEY = 'saas_tenant_id'

// ── Tipos ────────────────────────────────────────────────────────

interface AuthState {
  access_token:      string | null
  refresh_token:     string | null
  user:              MeResponse | null
  sessions:          ActiveSession[]
  sessionsLoading:   boolean
  pending_tenant_id: string | null
  isAuthenticated:   boolean
  isBootstrapping:   boolean
}

interface AuthActions {
  // Tokens
  setTokens:          (access: string, refresh: string) => void
  setUser:            (user: MeResponse) => void
  setPendingTenantId: (id: string) => void
  logout:             () => void
  setBootstrapping:   (v: boolean) => void

  // Sessions
  fetchSessions:   () => Promise<void>
  deleteSession:   (sessionId: string) => Promise<void>

  // Selectores derivados (no triggerean re-render por sí solos)
  role:     () => UserRole | null
  plan:     () => PlanName | null
  tenantId: () => string | null
  branchId: () => string | null
}

// ── Store ────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState & AuthActions>((set, get) => ({
  access_token:      null,
  refresh_token:     localStorage.getItem(RT_KEY),
  user:              null,
  sessions:          [],
  sessionsLoading:   false,
  pending_tenant_id: localStorage.getItem(TENANT_ID_KEY),
  isAuthenticated:   false,
  isBootstrapping:   true,

  // ── Tokens ───────────────────────────────────────────────────

  setTokens: (access, refresh) => {
    localStorage.setItem(RT_KEY, refresh)
    set({ access_token: access, refresh_token: refresh, isAuthenticated: true })
  },

  setUser: (user) => {
    localStorage.setItem(TENANT_ID_KEY, user.tenant_id)
    set({ user, isAuthenticated: true })
  },

  setPendingTenantId: (id) => {
    localStorage.setItem(TENANT_ID_KEY, id)
    set({ pending_tenant_id: id })
  },

  logout: () => {
    localStorage.removeItem(RT_KEY)
    set({
      access_token:    null,
      refresh_token:   null,
      user:            null,
      sessions:        [],
      isAuthenticated: false,
    })
  },

  setBootstrapping: (v) => set({ isBootstrapping: v }),

  // ── Sessions ─────────────────────────────────────────────────

  fetchSessions: async () => {
    set({ sessionsLoading: true })
    try {
      const { authApi } = await import('@/features/auth/api/auth.api')
      const sessions = await authApi.sessions()
      set({ sessions })
    } finally {
      set({ sessionsLoading: false })
    }
  },

  deleteSession: async (sessionId) => {
    // Optimistic: quitar de la lista de inmediato
    const snapshot = get().sessions
    set(s => ({ sessions: s.sessions.filter(s => s.id !== sessionId) }))
    try {
      const { authApi } = await import('@/features/auth/api/auth.api')
      await authApi.deleteSession(sessionId)
    } catch (err) {
      // Rollback si falló
      set({ sessions: snapshot })
      throw err
    }
  },

  // ── Selectores ───────────────────────────────────────────────

  role:     () => get().user?.role      ?? null,
  plan:     () => get().user?.plan      ?? null,
  tenantId: () => get().user?.tenant_id ?? null,
  branchId: () => get().user?.branch_id ?? null,
}))
