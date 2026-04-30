import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './useAuth'
import type { UserRole } from '@/shared/types'

// ── Hook ─────────────────────────────────────────────────────────
//
// Redirige si el usuario no está autenticado o no tiene el rol requerido.
// Equivalente imperativo a <ProtectedRoute> para usarse dentro de páginas
// que necesitan lógica de acceso más fina.
//
// Uso:
//   function BillingPage() {
//     const { allowed } = useRequireRole(['owner', 'admin'])
//     if (!allowed) return null   // el hook ya está redirigiendo
//     return <BillingContent />
//   }

interface UseRequireRoleReturn {
  allowed:        boolean
  isBootstrapping: boolean
}

export function useRequireRole(allowedRoles: UserRole[]): UseRequireRoleReturn {
  const { isAuthenticated, isBootstrapping, role, defaultRoute } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (isBootstrapping) return

    if (!isAuthenticated) {
      navigate('/login', { replace: true })
      return
    }

    if (role && !allowedRoles.includes(role)) {
      navigate(defaultRoute, { replace: true })
    }
  // Recalcular cuando cambia el estado de auth o el rol
  }, [isAuthenticated, isBootstrapping, role]) // eslint-disable-line react-hooks/exhaustive-deps

  const allowed =
    !isBootstrapping &&
    isAuthenticated &&
    (role ? allowedRoles.includes(role) : false)

  return { allowed, isBootstrapping }
}
