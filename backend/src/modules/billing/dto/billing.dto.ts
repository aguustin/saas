import { z } from 'zod'

// ─── Checkout ─────────────────────────────────────────────────────────────────

export const CheckoutStripeSchema = z.object({
  plan_name:   z.enum(['pro', 'premium', 'super']),
  success_url: z.string().url(),
  cancel_url:  z.string().url(),
})

export const CheckoutMpSchema = z.object({
  plan_name:   z.enum(['pro', 'premium', 'super']),
  payer_email: z.string().email(),
  back_url:    z.string().url().optional(),
})

export const CancelSchema = z.object({
  at_period_end: z.boolean().default(true),
})

export type CheckoutStripeDto = z.infer<typeof CheckoutStripeSchema>
export type CheckoutMpDto     = z.infer<typeof CheckoutMpSchema>
export type CancelDto         = z.infer<typeof CancelSchema>

// ─── Responses ────────────────────────────────────────────────────────────────

export interface PlanDto {
  id:              string
  name:            string
  display_name:    string
  price_ars:       number
  price_usd:       number
  max_products:    number | null
  max_branches:    number | null
  max_users:       number | null
  max_employees:   number | null
  sync_enabled:    boolean
  analytics_level: string
  api_access:      boolean
  sort_order:      number
}

export interface SubscriptionDto {
  id:                   string
  plan_name:            string
  plan_display_name:    string
  status:               string
  provider:             string
  provider_sub_id:      string   // Stripe sub_xxx / MP preapproval ID — needed for provider-side cancel
  current_period_start: string
  current_period_end:   string
  grace_period_ends_at: string | null
  cancel_at_period_end: boolean
  cancelled_at:         string | null
  currency:             string
  amount:               number
}

export interface ResourceLimit {
  current: number
  max:     number | null
  pct:     number | null   // null when unlimited
  blocked: boolean         // true = at limit, next create will fail
}

export interface LimitsDto {
  plan_name: string
  resources: {
    products:  ResourceLimit
    branches:  ResourceLimit
    users:     ResourceLimit
    employees: ResourceLimit
  }
  features: {
    sync_enabled:    boolean
    analytics_level: string
    api_access:      boolean
  }
}

export interface BillingEventDto {
  id:           string
  event_type:   string
  provider:     string
  amount:       number | null
  currency:     string | null
  status:       string | null
  processed_at: string
}
