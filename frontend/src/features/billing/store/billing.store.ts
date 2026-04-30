import { create } from 'zustand'
import { billingApi } from '@/features/billing/api/billing.api'
import type {
  LimitsDto,
  PlanDto,
  SubscriptionDto,
  BillingEventDto,
  ResourceLimit,
  SubscriptionStatus,
} from '@/shared/types'

// ── Configuración ────────────────────────────────────────────────
// TTL del cache de limits: si pasaron más de 5 min, se refresca
// automáticamente la próxima vez que el Shell se monta o cuando
// el usuario completa una acción que lo modifica (crear recurso).

const LIMITS_STALE_MS = 5 * 60 * 1_000  // 5 minutos

// ── Tipos ────────────────────────────────────────────────────────

interface BillingState {
  // Límites del plan — se carga al boot y se refresca periódicamente
  limits:           LimitsDto | null
  limits_fetched_at: number | null

  // Suscripción activa
  subscription:      SubscriptionDto | null
  subscriptionLoading: boolean

  // Planes disponibles (catálogo completo)
  plans:        PlanDto[]
  plansLoading: boolean

  // Historial de eventos
  events:        BillingEventDto[]
  eventsLoading: boolean
}

interface BillingActions {
  // Limits
  setLimits:     (limits: LimitsDto) => void
  refreshLimits: () => Promise<void>
  isBlocked:     (resource: keyof LimitsDto['resources']) => boolean
  isStale:       () => boolean

  // Subscription
  fetchSubscription: () => Promise<void>
  cancelSubscription: (atPeriodEnd: boolean) => Promise<void>

  // Plans
  fetchPlans: () => Promise<void>

  // Events
  fetchEvents: () => Promise<void>

  // Checkout
  checkoutStripe: (planName: string) => Promise<string>
  checkoutMp:     (planName: string, payerEmail: string) => Promise<string>
  openPortal:     () => Promise<string>
}

// ── Store ────────────────────────────────────────────────────────

export const useBillingStore = create<BillingState & BillingActions>((set, get) => ({
  limits:              null,
  limits_fetched_at:   null,
  subscription:        null,
  subscriptionLoading: false,
  plans:               [],
  plansLoading:        false,
  events:              [],
  eventsLoading:       false,

  // ── Limits ───────────────────────────────────────────────────

  setLimits: (limits) => set({ limits, limits_fetched_at: Date.now() }),

  refreshLimits: async () => {
    const limits = await billingApi.limits()
    set({ limits, limits_fetched_at: Date.now() })
  },

  isBlocked: (resource) => {
    return get().limits?.resources[resource]?.blocked ?? false
  },

  isStale: () => {
    const fetched = get().limits_fetched_at
    if (!fetched) return true
    return Date.now() - fetched > LIMITS_STALE_MS
  },

  // ── Subscription ─────────────────────────────────────────────

  fetchSubscription: async () => {
    set({ subscriptionLoading: true })
    try {
      const sub = await billingApi.subscription()
      set({ subscription: sub })
    } finally {
      set({ subscriptionLoading: false })
    }
  },

  cancelSubscription: async (atPeriodEnd) => {
    await billingApi.cancel({ at_period_end: atPeriodEnd })

    // Optimistic: actualizar estado local sin esperar refetch
    set(s => ({
      subscription: s.subscription
        ? {
            ...s.subscription,
            cancel_at_period_end: atPeriodEnd,
            status: atPeriodEnd
              ? s.subscription.status           // sigue activa hasta fin de período
              : 'cancelled' as SubscriptionStatus,
          }
        : null,
    }))

    // Refrescar límites ya que el plan puede haber cambiado
    void get().refreshLimits()
  },

  // ── Plans ────────────────────────────────────────────────────

  fetchPlans: async () => {
    set({ plansLoading: true })
    try {
      const plans = await billingApi.plans()
      set({ plans })
    } finally {
      set({ plansLoading: false })
    }
  },

  // ── Events ───────────────────────────────────────────────────

  fetchEvents: async () => {
    set({ eventsLoading: true })
    try {
      const events = await billingApi.events()
      set({ events })
    } finally {
      set({ eventsLoading: false })
    }
  },

  // ── Checkout ─────────────────────────────────────────────────
  // Retornan la URL de redirección; el componente es responsable
  // de abrir la ventana/tab.

  checkoutStripe: async (planName) => {
    const { checkout_url } = await billingApi.checkoutStripe({
      plan_name:   planName,
      success_url: `${window.location.origin}/app/billing?success=1`,
      cancel_url:  `${window.location.origin}/app/billing?cancelled=1`,
    })
    return checkout_url
  },

  checkoutMp: async (planName, payerEmail) => {
    const { checkout_url } = await billingApi.checkoutMp({
      plan_name:   planName,
      payer_email: payerEmail,
      back_url:    `${window.location.origin}/app/billing`,
    })
    return checkout_url
  },

  openPortal: async () => {
    const { url } = await billingApi.portal()
    return url
  },
}))

// ── Selectores utilitarios ───────────────────────────────────────

/** Límite tipado de un recurso específico */
export function useResourceLimit(resource: keyof LimitsDto['resources']): ResourceLimit | null {
  return useBillingStore(s => s.limits?.resources[resource] ?? null)
}

/** Features del plan activo (sync, analytics, api_access) */
export function usePlanFeatures() {
  return useBillingStore(s => s.limits?.features ?? null)
}

/** true si el tenant está en período de prueba */
export function useIsTrialing(): boolean {
  return useBillingStore(s => s.subscription?.status === 'trialing')
}

/** true si la suscripción tiene problemas de pago */
export function useHasPaymentIssue(): boolean {
  return useBillingStore(s =>
    s.subscription?.status === 'past_due' ||
    s.subscription?.status === 'unpaid',
  )
}
