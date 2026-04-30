import { Outlet } from 'react-router-dom'
import { useEffect } from 'react'
import { Sidebar } from './Sidebar'
import { Header, TrialBanner } from './Header'
import { useBillingStore } from '@/features/billing/store/billing.store'
import { Toaster } from '@/shared/components/ui'

export function Shell() {
  const { isStale, refreshLimits } = useBillingStore()

  // Refrescar limits si están stale al montar el shell
  useEffect(() => {
    if (isStale()) {
      refreshLimits().catch(() => {/* silencioso */})
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex min-h-screen bg-page">
      <Sidebar />
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        <TrialBanner />
        <Header />
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
      <Toaster />
    </div>
  )
}
