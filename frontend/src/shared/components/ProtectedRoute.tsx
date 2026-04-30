import { Navigate, useLocation } from 'react-router-dom'
import type { UserRole } from '@/shared/types'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { FullPageLoader } from '@/shared/components/ui/Skeleton'

interface Props {
  children:      React.ReactNode
  allowedRoles?: UserRole[]
}

export function ProtectedRoute({ children, allowedRoles }: Props) {
  const { isAuthenticated, isBootstrapping, role, defaultRoute } = useAuth()
  const location = useLocation()

  if (isBootstrapping) return <FullPageLoader />

  // No autenticado → redirigir a login guardando la ruta original
  // en el navigation state para volver después del login exitoso.
  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        state={{ from: location.pathname }}
        replace
      />
    )
  }

  // Autenticado pero sin el rol requerido → redirigir al default del sistema
  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return <Navigate to={defaultRoute} replace />
  }

  return <>{children}</>
}
