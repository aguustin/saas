import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  useBillingStore,
  useIsTrialing,
  useHasPaymentIssue,
} from '@/features/billing/store/billing.store'
import { useToastStore } from '@/shared/components/ui/Toast'

export function useBilling() {
  const fetchSubscription  = useBillingStore(s => s.fetchSubscription)
  const fetchPlans         = useBillingStore(s => s.fetchPlans)
  const fetchEvents        = useBillingStore(s => s.fetchEvents)
  const refreshLimits      = useBillingStore(s => s.refreshLimits)
  const cancelSubscription = useBillingStore(s => s.cancelSubscription)
  const checkoutStripe     = useBillingStore(s => s.checkoutStripe)
  const checkoutMp         = useBillingStore(s => s.checkoutMp)
  const openPortal         = useBillingStore(s => s.openPortal)

  const subscription        = useBillingStore(s => s.subscription)
  const subscriptionLoading = useBillingStore(s => s.subscriptionLoading)
  const plans               = useBillingStore(s => s.plans)
  const plansLoading        = useBillingStore(s => s.plansLoading)
  const events              = useBillingStore(s => s.events)
  const eventsLoading       = useBillingStore(s => s.eventsLoading)
  const limits              = useBillingStore(s => s.limits)

  const isTrialing     = useIsTrialing()
  const hasPaymentIssue = useHasPaymentIssue()

  const addToast       = useToastStore(s => s.add)
  const [searchParams, setSearchParams] = useSearchParams()

  // ── Carga inicial ─────────────────────────────────────────────

  useEffect(() => {
    void fetchSubscription()
    void fetchEvents()
    void refreshLimits()
    if (plans.length === 0) void fetchPlans()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Resultado del checkout (URL params) ───────────────────────

  useEffect(() => {
    if (searchParams.get('success') === '1') {
      addToast({ type: 'success', title: '¡Suscripción activada!', description: 'Tu plan fue actualizado correctamente.' })
      void fetchSubscription()
      void refreshLimits()
      setSearchParams({})
    }
    if (searchParams.get('cancelled') === '1') {
      addToast({ type: 'info', title: 'Pago cancelado', description: 'Podés reintentar cuando quieras.' })
      setSearchParams({})
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Acciones ──────────────────────────────────────────────────

  async function handleCheckoutStripe(planName: string): Promise<void> {
    const url = await checkoutStripe(planName)
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  async function handleCheckoutMp(planName: string, payerEmail: string): Promise<void> {
    const url = await checkoutMp(planName, payerEmail)
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  async function handleOpenPortal(): Promise<void> {
    const url = await openPortal()
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  async function handleCancel(atPeriodEnd: boolean): Promise<void> {
    await cancelSubscription(atPeriodEnd)
    addToast({
      type:        'success',
      title:       atPeriodEnd ? 'Cancelación programada' : 'Suscripción cancelada',
      description: atPeriodEnd
        ? 'Tu plan seguirá activo hasta el fin del período.'
        : 'Tu acceso fue removido de forma inmediata.',
    })
  }

  // ── Datos derivados ───────────────────────────────────────────

  const currentPlanName = subscription?.plan_name ?? limits?.plan_name ?? null

  const sortedPlans = [...plans].sort((a, b) => a.sort_order - b.sort_order)

  return {
    subscription,
    subscriptionLoading,
    plans: sortedPlans,
    plansLoading,
    events,
    eventsLoading,
    limits,
    isTrialing,
    hasPaymentIssue,
    currentPlanName,
    handleCheckoutStripe,
    handleCheckoutMp,
    handleOpenPortal,
    handleCancel,
    refreshAll: () => {
      void fetchSubscription()
      void fetchEvents()
      void refreshLimits()
    },
  }
}
