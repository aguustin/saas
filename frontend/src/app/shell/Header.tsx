import { useLocation } from 'react-router-dom'
import { Bell, Copy, Check } from 'lucide-react'
import { useState, useCallback } from 'react'
import { useBillingStore } from '@/features/billing/store/billing.store'
import { SyncStatusIndicator } from '@/features/sync/components/SyncStatusIndicator'
import { LowStockBadge } from '@/features/stock/components/LowStockBadge'
import { ThemeToggle } from '@/shared/components/ui'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useToast } from '@/shared/components/ui/Toast'
import { ShiftCloseButton } from '@/features/sales/components/ShiftCloseButton'

const ROUTE_LABELS: Record<string, string> = {
  '/app/dashboard': 'Dashboard',
  '/app/pos':       'Punto de Venta',
  '/app/sales':     'Ventas',
  '/app/products':  'Productos',
  '/app/stock':           'Stock',
  '/app/stock/movements': 'Movimientos de Stock',
  '/app/employees': 'Empleados',
  '/app/users':     'Usuarios',
  '/app/billing':   'Facturación',
  '/app/admin':     'Administración',
}

function TrialBanner() {
  const sub = useBillingStore(s => s.limits?.plan_name)
  if (sub !== 'free') return null

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 flex items-center gap-2 text-amber-800 text-sm">
      <Bell size={14} />
      <span>
        Estás en el plan <strong>Free</strong>.{' '}
        <a href="/app/billing" className="underline font-medium">Upgradea tu plan</a>{' '}
        para desbloquear más funcionalidades.
      </span>
    </div>
  )
}

function CopyTenantButton({ tenantId }: { tenantId: string }) {
  const [copied, setCopied] = useState(false)
  const { success } = useToast()

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(tenantId)
      setCopied(true)
      success('ID de tienda copiado', tenantId)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback para contextos sin clipboard API
      const el = document.createElement('textarea')
      el.value = tenantId
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      success('ID de tienda copiado')
      setTimeout(() => setCopied(false), 2000)
    }
  }, [tenantId, success])

  return (
    <button
      onClick={handleCopy}
      title="Copiar ID de tienda"
      aria-label="Copiar ID de tienda"
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
                 text-content-muted hover:text-content hover:bg-surface-2 transition-colors"
    >
      {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
      <span className="hidden sm:inline">ID de tienda</span>
    </button>
  )
}

export function Header() {
  const location  = useLocation()
  const label     = ROUTE_LABELS[location.pathname] ?? ''
  const { hasMinRole, tenantId } = useAuth()
  const isAdmin   = hasMinRole('admin')

  return (
    <header className="h-16 bg-surface border-b border-edge flex items-center px-6 gap-4">
      <h2 className="text-lg font-semibold text-content flex-1">{label}</h2>
      <SyncStatusIndicator />
      <LowStockBadge />
      <ShiftCloseButton />
      {isAdmin && tenantId && <CopyTenantButton tenantId={tenantId} />}
      <ThemeToggle />
    </header>
  )
}

export { TrialBanner }
