import { http } from '@/shared/api/client'
import type { LimitsDto, PlanDto, SubscriptionDto, BillingEventDto } from '@/shared/types'

export interface CheckoutStripeBody {
  plan_name:   string
  success_url: string
  cancel_url:  string
}

export interface CheckoutMpBody {
  plan_name:   string
  payer_email: string
  back_url:    string
}

export interface CancelBody {
  at_period_end: boolean
}

export const billingApi = {
  plans(): Promise<PlanDto[]> {
    return http.get<PlanDto[]>('/billing/plans').then(r => r.data)
  },

  subscription(): Promise<SubscriptionDto> {
    return http.get<SubscriptionDto>('/billing/subscription').then(r => r.data)
  },

  events(): Promise<BillingEventDto[]> {
    return http.get<BillingEventDto[]>('/billing/events').then(r => r.data)
  },

  limits(): Promise<LimitsDto> {
    return http.get<LimitsDto>('/billing/limits').then(r => r.data)
  },

  checkoutStripe(body: CheckoutStripeBody): Promise<{ checkout_url: string; session_id: string }> {
    return http.post('/billing/checkout/stripe', body).then(r => r.data)
  },

  checkoutMp(body: CheckoutMpBody): Promise<{ checkout_url: string; preapproval_id: string }> {
    return http.post('/billing/checkout/mp', body).then(r => r.data)
  },

  cancel(body: CancelBody): Promise<void> {
    return http.post('/billing/subscription/cancel', body).then(() => undefined)
  },

  portal(): Promise<{ url: string }> {
    return http.post('/billing/portal', {}).then(r => r.data)
  },
}
