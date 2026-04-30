import { useAuthStore } from '@/features/auth/store/auth.store'
import type { UserRole } from '@/shared/types'

// ── Jerarquía de roles ────────────────────────────────────────────
// cashier < manager < admin < owner

export const ROLE_LEVEL: Record<UserRole, number> = {
  cashier: 0,
  manager: 1,
  admin:   2,
  owner:   3,
}

// ── Rutas accesibles por rol ─────────────────────────────────────
// Fuente: sección 9 del contrato del sistema.

const ROUTE_ACCESS: Record<string, UserRole[]> = {
  '/app/pos':       ['cashier', 'manager', 'admin', 'owner'],
  '/app/sales':     ['cashier', 'manager', 'admin', 'owner'],
  '/app/products':  ['manager', 'admin', 'owner'],
  '/app/stock':     ['manager', 'admin', 'owner'],
  '/app/employees': ['manager', 'admin', 'owner'],
  '/app/users':     ['admin', 'owner'],
  '/app/billing':   ['owner', 'admin'],
}

// ── Hook principal ────────────────────────────────────────────────

export function useAuth() {
  const user           = useAuthStore(s => s.user)
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  const isBootstrapping = useAuthStore(s => s.isBootstrapping)

  const role     = user?.role      ?? null
  const plan     = user?.plan      ?? null
  const tenantId = user?.tenant_id ?? null
  const branchId = user?.branch_id ?? null

  /** El usuario tiene exactamente uno de los roles listados */
  function hasRole(...roles: UserRole[]): boolean {
    if (!role) return false
    return roles.includes(role)
  }

  /** El usuario tiene al menos el nivel mínimo de rol */
  function hasMinRole(min: UserRole): boolean {
    if (!role) return false
    return ROLE_LEVEL[role] >= ROLE_LEVEL[min]
  }

  /** El usuario puede acceder a la ruta indicada */
  function canAccess(path: string): boolean {
    if (!role) return false
    const allowed = ROUTE_ACCESS[path]
    if (!allowed) return true // ruta no en la tabla = accesible
    return allowed.includes(role)
  }

  /** Ruta de inicio por defecto (siempre POS — pantalla P0 del sistema) */
  const defaultRoute = '/app/pos'

  return {
    user,
    isAuthenticated,
    isBootstrapping,
    role,
    plan,
    tenantId,
    branchId,
    hasRole,
    hasMinRole,
    canAccess,
    defaultRoute,
  }
}
