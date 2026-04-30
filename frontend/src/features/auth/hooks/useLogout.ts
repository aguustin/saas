import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '@/features/auth/api/auth.api'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { getDeviceId } from '@/shared/utils/device'

// ── Hook ─────────────────────────────────────────────────────────

interface UseLogoutReturn {
  logout:  (allDevices?: boolean) => Promise<void>
  loading: boolean
}

export function useLogout(): UseLogoutReturn {
  const [loading, setLoading] = useState(false)
  const authLogout = useAuthStore(s => s.logout)
  const navigate   = useNavigate()

  async function logout(allDevices = false) {
    if (loading) return
    setLoading(true)

    try {
      // Intenta notificar al servidor. Si falla (ej. sin conexión o token
      // ya expirado), igual limpiamos el estado local.
      await authApi.logout({ device_id: getDeviceId(), all_devices: allDevices })
    } catch {
      // Error silencioso: el logout local siempre se ejecuta.
    }

    // Limpiar el estado de autenticación
    authLogout()

    // Limpiar stores de features para no dejar datos de la sesión anterior
    // visibles si otro usuario inicia sesión en el mismo dispositivo.
    resetFeatureStores()

    navigate('/login', { replace: true })
    setLoading(false)
  }

  return { logout, loading }
}

// ── Reset de stores de features ──────────────────────────────────
// Importaciones en función para evitar que este módulo forme parte
// del bundle principal antes de que los stores se inicialicen.

function resetFeatureStores() {
  // Los imports dinámicos no son necesarios aquí porque estos stores
  // ya están inicializados antes de que el usuario pueda hacer logout.
  // Usamos getState().reset() que no requiere re-render.
  import('@/features/products/store/products.store').then(m =>
    m.useProductStore.getState().reset(),
  )
  import('@/features/sales/store/sales.store').then(m =>
    m.useSalesStore.getState().reset(),
  )
  // El syncStore no tiene reset genérico: preservamos los cursores y
  // pending queue porque pertenecen al device, no al usuario.
  // En un escenario multi-usuario por device, habría que limpiarlos también.
}
