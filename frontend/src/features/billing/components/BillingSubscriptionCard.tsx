import { useState } from 'react'
import {
  CreditCard, Calendar, AlertTriangle,
  ExternalLink, Clock, Ban, RefreshCw,
} from 'lucide-react'
import { SubscriptionBadge } from '@/shared/components/ui/Badge'
import { Skeleton } from '@/shared/components/ui/Skeleton'
import { ConfirmModal } from '@/shared/components/ui/Modal'
import { formatDateShort } from '@/shared/utils/date'
import type { SubscriptionDto } from '@/shared/types'

// ── Helpers ───────────────────────────────────────────────────────

const PROVIDER_LABEL: Record<string, string> = {
  stripe:       'Stripe',
  mercadopago:  'Mercado Pago',
  manual:       'Manual',
}

function daysUntil(isoDate: string): number {
  return Math.ceil((new Date(isoDate).getTime() - Date.now()) / 86_400_000)
}

// ── Props ─────────────────────────────────────────────────────────

interface Props {
  subscription:   SubscriptionDto | null
  loading:        boolean
  hasPaymentIssue: boolean
  onOpenPortal:   () => Promise<void>
  onCancel:       (atPeriodEnd: boolean) => Promise<void>
}

// ── Componente ────────────────────────────────────────────────────

export function BillingSubscriptionCard({
  subscription, loading, hasPaymentIssue, onOpenPortal, onCancel,
}: Props) {
  const [portalLoading,  setPortalLoading]  = useState(false)
  const [cancelOpen,     setCancelOpen]     = useState(false)
  const [cancelEnd,      setCancelEnd]      = useState(true)   // true = at period end
  const [cancelling,     setCancelling]     = useState(false)

  async function handlePortal() {
    setPortalLoading(true)
    try { await onOpenPortal() } finally { setPortalLoading(false) }
  }

  async function handleConfirmCancel() {
    setCancelling(true)
    try {
      await onCancel(cancelEnd)
      setCancelOpen(false)
    } finally {
      setCancelling(false)
    }
  }

  if (loading && !subscription) {
    return (
      <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
        <div className="space-y-3">
          <Skeleton height={20} width="40%" />
          <Skeleton height={14} width="60%" />
          <Skeleton height={14} width="50%" />
        </div>
      </div>
    )
  }

  if (!subscription) return null

  const periodEnd   = subscription.current_period_end
  const gracePeriod = subscription.grace_period_ends_at
  const daysLeft    = daysUntil(periodEnd)
  const isActive    = subscription.status === 'active' || subscription.status === 'trialing'
  const canCancel   = isActive && !subscription.cancel_at_period_end

  return (
    <>
      <div className={[
        'rounded-2xl border bg-white dark:bg-gray-900 p-6',
        hasPaymentIssue
          ? 'border-red-200 dark:border-red-800'
          : 'border-gray-100 dark:border-gray-800',
      ].join(' ')}>

        {/* Banner pago vencido */}
        {hasPaymentIssue && (
          <div className="flex items-center gap-2 mb-5 rounded-xl bg-red-50 dark:bg-red-950/30
                          border border-red-200 dark:border-red-800 px-4 py-3">
            <AlertTriangle size={16} className="text-red-600 dark:text-red-400 shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-300 font-medium">
              Hay un problema con tu pago. Regularizá tu cuenta para evitar la suspensión.
            </p>
          </div>
        )}

        {/* Banner cancelación programada */}
        {subscription.cancel_at_period_end && (
          <div className="flex items-center gap-2 mb-5 rounded-xl bg-amber-50 dark:bg-amber-950/20
                          border border-amber-200 dark:border-amber-800 px-4 py-3">
            <Clock size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Tu suscripción se cancelará el{' '}
              <strong>{formatDateShort(periodEnd)}</strong>.
              Después pasarás al plan Free.
            </p>
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-950/40
                              flex items-center justify-center">
                <CreditCard size={20} className="text-brand-600 dark:text-brand-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  {subscription.plan_display_name}
                </h3>
                <SubscriptionBadge status={subscription.status} />
              </div>
            </div>
          </div>

          {/* Monto */}
          {subscription.amount > 0 && (
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                {subscription.currency.toUpperCase()} {subscription.amount.toFixed(2)}
              </p>
              <p className="text-xs text-gray-400">por mes</p>
            </div>
          )}
        </div>

        {/* Meta grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-6">
          <MetaItem
            icon={Calendar}
            label="Próxima renovación"
            value={formatDateShort(periodEnd)}
            subtext={daysLeft > 0 ? `en ${daysLeft} días` : 'hoy'}
          />
          <MetaItem
            icon={Calendar}
            label="Inicio del período"
            value={formatDateShort(subscription.current_period_start)}
          />
          <MetaItem
            icon={CreditCard}
            label="Proveedor"
            value={PROVIDER_LABEL[subscription.provider] ?? subscription.provider}
          />
        </div>

        {/* Gracia */}
        {gracePeriod && (
          <div className="mt-4 text-xs text-amber-600 dark:text-amber-400">
            Período de gracia hasta {formatDateShort(gracePeriod)}
          </div>
        )}

        {/* Acciones */}
        <div className="flex flex-wrap gap-2 mt-6 pt-5 border-t border-gray-100 dark:border-gray-800">
          {subscription.provider !== 'manual' && (
            <button
              onClick={handlePortal}
              disabled={portalLoading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium
                         border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300
                         hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {portalLoading
                ? <RefreshCw size={14} className="animate-spin" />
                : <ExternalLink size={14} />}
              Portal de pagos
            </button>
          )}

          {canCancel && (
            <button
              onClick={() => setCancelOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium
                         text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800
                         hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
            >
              <Ban size={14} />
              Cancelar suscripción
            </button>
          )}
        </div>
      </div>

      {/* Modal cancelar */}
      <ConfirmModal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={handleConfirmCancel}
        loading={cancelling}
        danger
        title="Cancelar suscripción"
        confirmLabel={cancelEnd ? 'Cancelar al vencer' : 'Cancelar ahora'}
        description=""
      >
        <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
          <p>¿Cómo querés cancelar tu suscripción?</p>
          <label className="flex items-start gap-3 p-3 rounded-xl border border-gray-200
                             dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
            <input
              type="radio"
              checked={cancelEnd}
              onChange={() => setCancelEnd(true)}
              className="mt-0.5"
            />
            <div>
              <p className="font-medium text-gray-800 dark:text-gray-200">Al finalizar el período</p>
              <p className="text-xs text-gray-500">Seguís con acceso hasta el {formatDateShort(periodEnd)}.</p>
            </div>
          </label>
          <label className="flex items-start gap-3 p-3 rounded-xl border border-red-200
                             dark:border-red-800 cursor-pointer hover:bg-red-50 dark:hover:bg-red-950/20">
            <input
              type="radio"
              checked={!cancelEnd}
              onChange={() => setCancelEnd(false)}
              className="mt-0.5"
            />
            <div>
              <p className="font-medium text-red-700 dark:text-red-400">Inmediatamente</p>
              <p className="text-xs text-gray-500">Perdés acceso de forma instantánea.</p>
            </div>
          </label>
        </div>
      </ConfirmModal>
    </>
  )
}

// ── MetaItem helper ───────────────────────────────────────────────

function MetaItem({
  icon: Icon, label, value, subtext,
}: {
  icon:     React.ElementType
  label:    string
  value:    string
  subtext?: string
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon size={14} className="text-gray-400 mt-0.5 shrink-0" />
      <div>
        <p className="text-xs text-gray-400 dark:text-gray-500">{label}</p>
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{value}</p>
        {subtext && <p className="text-xs text-gray-400">{subtext}</p>}
      </div>
    </div>
  )
}
