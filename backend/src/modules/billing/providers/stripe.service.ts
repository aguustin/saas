import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Stripe from 'stripe'
import type { Event as StripeEvent }        from 'stripe/cjs/resources/Events'
import type { Subscription as StripeSubscription } from 'stripe/cjs/resources/Subscriptions'

@Injectable()
export class StripeService {
  private readonly client: InstanceType<typeof Stripe>
  private readonly webhookSecret: string
  private readonly logger = new Logger(StripeService.name)

  constructor(private readonly config: ConfigService) {
    const secretKey = config.get<string>('STRIPE_SECRET_KEY')

    if (!secretKey) {
      this.logger.warn('STRIPE_SECRET_KEY not set — Stripe integration disabled')
    }

    this.client = new Stripe(secretKey ?? 'sk_test_placeholder', {
      apiVersion: '2026-03-25.dahlia',
    })

    this.webhookSecret = config.get<string>('STRIPE_WEBHOOK_SECRET') ?? ''
  }

  // ─── Customers ────────────────────────────────────────────────────────────

  async createCustomer(params: {
    email:    string
    name:     string
    tenantId: string
  }): Promise<string> {
    const customer = await this.client.customers.create({
      email:    params.email,
      name:     params.name,
      metadata: { tenant_id: params.tenantId },
    })
    return customer.id
  }

  async getOrCreateCustomer(params: {
    email:            string
    name:             string
    tenantId:         string
    existingCustomerId?: string
  }): Promise<string> {
    if (params.existingCustomerId) {
      return params.existingCustomerId
    }
    return this.createCustomer(params)
  }

  // ─── Checkout ─────────────────────────────────────────────────────────────

  async createCheckoutSession(params: {
    customerId:  string
    priceId:     string
    tenantId:    string
    successUrl:  string
    cancelUrl:   string
  }): Promise<{ url: string; sessionId: string }> {
    const session = await this.client.checkout.sessions.create({
      customer:   params.customerId,
      mode:       'subscription',
      line_items: [{ price: params.priceId, quantity: 1 }],
      success_url: params.successUrl + '?session_id={CHECKOUT_SESSION_ID}',
      cancel_url:  params.cancelUrl,
      metadata:    { tenant_id: params.tenantId },
      subscription_data: {
        metadata: { tenant_id: params.tenantId },
      },
    })

    if (!session.url) throw new InternalServerErrorException('Stripe returned no checkout URL')
    return { url: session.url, sessionId: session.id }
  }

  // ─── Subscriptions ────────────────────────────────────────────────────────

  async cancelSubscription(stripeSubId: string, atPeriodEnd: boolean): Promise<void> {
    if (atPeriodEnd) {
      await this.client.subscriptions.update(stripeSubId, { cancel_at_period_end: true })
    } else {
      await this.client.subscriptions.cancel(stripeSubId)
    }
  }

  async getSubscription(stripeSubId: string): Promise<StripeSubscription> {
    return this.client.subscriptions.retrieve(stripeSubId, {
      expand: ['latest_invoice.payment_intent'],
    })
  }

  // ─── Webhooks ─────────────────────────────────────────────────────────────

  constructWebhookEvent(rawBody: Buffer, signature: string): StripeEvent {
    try {
      return this.client.webhooks.constructEvent(rawBody, signature, this.webhookSecret)
    } catch (err: any) {
      throw new Error(`Stripe signature verification failed: ${err.message}`)
    }
  }

  // ─── Portal (customer self-service) ───────────────────────────────────────

  async createPortalSession(params: {
    customerId:  string
    returnUrl:   string
  }): Promise<string> {
    const session = await this.client.billingPortal.sessions.create({
      customer:   params.customerId,
      return_url: params.returnUrl,
    })
    return session.url
  }
}
