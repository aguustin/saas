import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useBilling } from '@/features/billing/hooks/useBilling'
import { BillingSubscriptionCard } from '@/features/billing/components/BillingSubscriptionCard'
import { BillingLimitsCard }       from '@/features/billing/components/BillingLimitsCard'
import { BillingPlanGrid }         from '@/features/billing/components/BillingPlanGrid'
import { BillingEventsTable }      from '@/features/billing/components/BillingEventsTable'
import { CheckoutModal }           from '@/features/billing/components/CheckoutModal'
import type { PlanDto } from '@/shared/types'

export function BillingPage() {
  const {
    subscription, subscriptionLoading,
    plans, plansLoading,
    events, eventsLoading,
    limits,
    hasPaymentIssue,
    currentPlanName,
    handleCheckoutStripe,
    handleCheckoutMp,
    handleOpenPortal,
    handleCancel,
    refreshAll,
  } = useBilling()

  const [checkoutPlan, setCheckoutPlan] = useState<PlanDto | null>(null)

  return (
    <div className="p-6 space-y-8 max-w-[1400px] mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Facturación</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Gestioná tu plan, pagos y límites
          </p>
        </div>
        <button
          onClick={refreshAll}
          className="flex items-center gap-1.5 h-9 px-3 rounded-lg border border-gray-300
                     text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-600
                     dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
        >
          <RefreshCw size={13} />
          Actualizar
        </button>
      </div>

      {/* Fila superior: suscripción + límites */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BillingSubscriptionCard
          subscription={subscription}
          loading={subscriptionLoading}
          hasPaymentIssue={hasPaymentIssue}
          onOpenPortal={handleOpenPortal}
          onCancel={handleCancel}
        />

        <BillingLimitsCard limits={limits} />
      </div>

      {/* Planes */}
      <BillingPlanGrid
        plans={plans}
        loading={plansLoading}
        currentPlanName={currentPlanName}
        onUpgrade={plan => setCheckoutPlan(plan)}
      />

      {/* Historial */}
      <BillingEventsTable
        events={events}
        loading={eventsLoading}
      />

      {/* Modal checkout */}
      <CheckoutModal
        open={checkoutPlan !== null}
        onClose={() => setCheckoutPlan(null)}
        plan={checkoutPlan}
        onCheckoutStripe={handleCheckoutStripe}
        onCheckoutMp={handleCheckoutMp}
      />
    </div>
  )
}
