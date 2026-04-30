import { RouterProvider } from 'react-router-dom'
import { useEffect } from 'react'
import { router } from '@/app/router'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { useBillingStore } from '@/features/billing/store/billing.store'
import { useSyncStore } from '@/features/sync/store/sync.store'
import { authApi } from '@/features/auth/api/auth.api'
import { billingApi } from '@/features/billing/api/billing.api'
import { getDeviceId } from '@/shared/utils/device'

function Bootstrap({ children }: { children: React.ReactNode }) {
  const { refresh_token, setTokens, setUser, setBootstrapping, logout } = useAuthStore()
  const setLimits     = useBillingStore(s => s.setLimits)
  const syncInit      = useSyncStore(s => s.init)
  const syncTeardown  = useSyncStore(s => s.teardown)
  const syncEnabled   = useBillingStore(s => s.limits?.features.sync_enabled ?? false)

  useEffect(() => {
    async function boot() {
      if (!refresh_token) {
        setBootstrapping(false)
        return
      }

      try {
        const deviceId = getDeviceId()
        const tokens   = await authApi.refresh(refresh_token, deviceId)
        setTokens(tokens.access_token, tokens.refresh_token)

        const [user, limits] = await Promise.all([
          authApi.me(),
          billingApi.limits(),
        ])

        setUser(user)
        setLimits(limits)
      } catch {
        logout()
      } finally {
        setBootstrapping(false)
      }
    }

    boot()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Inicializar sync engine solo si el plan lo permite
  useEffect(() => {
    if (!syncEnabled) return
    syncInit()
    return () => syncTeardown()
  }, [syncEnabled]) // eslint-disable-line react-hooks/exhaustive-deps

  return <>{children}</>
}

export function Providers() {
  return (
    <Bootstrap>
      <RouterProvider router={router} />
    </Bootstrap>
  )
}
