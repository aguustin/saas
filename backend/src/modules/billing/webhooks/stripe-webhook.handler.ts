import { Injectable, Logger } from '@nestjs/common'
import type { Event as StripeEvent }              from 'stripe/cjs/resources/Events'
import type { Invoice as StripeInvoice }          from 'stripe/cjs/resources/Invoices'
import type { Subscription as StripeSubscription } from 'stripe/cjs/resources/Subscriptions'
import type { Price }                             from 'stripe/cjs/resources/Prices'
import { PrismaService }        from '@database/prisma.service'
import { SubscriptionsService } from '../subscriptions.service'

type StripeHandler = (event: StripeEvent) => Promise<void>

@Injectable()
export class StripeWebhookHandler {
  private readonly logger   = new Logger(StripeWebhookHandler.name)
  private readonly handlers: Map<string, StripeHandler>

  constructor(
    private readonly prisma: PrismaService,
    private readonly subs:   SubscriptionsService,
  ) {
    this.handlers = new Map<string, StripeHandler>([
      ['invoice.payment_succeeded',     this.onPaymentSucceeded.bind(this)],
      ['invoice.payment_failed',        this.onPaymentFailed.bind(this)],
      ['customer.subscription.updated', this.onSubscriptionUpdated.bind(this)],
      ['customer.subscription.deleted', this.onSubscriptionDeleted.bind(this)],
    ])
  }

  async handle(event: StripeEvent): Promise<void> {
    const handler = this.handlers.get(event.type)
    if (!handler) {
      this.logger.debug(`Unhandled Stripe event: ${event.type}`)
      return
    }
    this.logger.log({ eventId: event.id, type: event.type }, 'Processing Stripe webhook')
    await handler(event)
  }

  // ─── Handlers ─────────────────────────────────────────────────────────────

  private async onPaymentSucceeded(event: StripeEvent): Promise<void> {
    const invoice = event.data.object as StripeInvoice

    if (!['subscription_create', 'subscription_cycle'].includes(invoice.billing_reason ?? '')) {
      return
    }

    const tenantId = this.extractTenantId(invoice)
    if (!tenantId) return

    const idempotent = await this.subs.logEvent({
      tenantId,
      eventType:       'payment_succeeded',
      provider:        'stripe',
      providerEventId: event.id,
      amount:          invoice.amount_paid / 100,
      currency:        invoice.currency.toUpperCase(),
      status:          'paid',
      rawPayload:      invoice as any,
    })
    if (!idempotent) return

    const lineItem      = invoice.lines.data[0]
    // In Stripe API v2026-03-25 (dahlia), price moved under pricing.price_details.price
    const priceRef      = lineItem?.pricing?.price_details?.price
    const stripePriceId = typeof priceRef === 'string' ? priceRef : (priceRef as Price | undefined)?.id

    const plan = stripePriceId
      ? await this.prisma.plan.findFirst({ where: { stripePriceIdMonthly: stripePriceId } })
      : null

    if (!plan) {
      this.logger.warn({ tenantId, stripePriceId }, 'No plan found for Stripe price — skipping activation')
      return
    }

    // In v2026-03-25, subscription ID is on invoice.parent.subscription_details.subscription
    const providerSubId = invoice.parent?.subscription_details?.subscription as string | undefined
      ?? (invoice as any).subscription as string | undefined

    await this.subs.activate({
      tenantId,
      planId:             plan.id,
      provider:           'stripe',
      providerSubId:      providerSubId ?? '',
      providerCustomerId: invoice.customer as string,
      periodStart:        new Date((lineItem?.period?.start ?? 0) * 1000),
      periodEnd:          new Date((lineItem?.period?.end   ?? 0) * 1000),
      currency:           invoice.currency.toUpperCase(),
      amount:             invoice.amount_paid / 100,
    })
  }

  private async onPaymentFailed(event: StripeEvent): Promise<void> {
    const invoice  = event.data.object as StripeInvoice
    const tenantId = this.extractTenantId(invoice)
    if (!tenantId) return

    const idempotent = await this.subs.logEvent({
      tenantId,
      eventType:       'payment_failed',
      provider:        'stripe',
      providerEventId: event.id,
      amount:          invoice.amount_due / 100,
      currency:        invoice.currency.toUpperCase(),
      status:          'failed',
      rawPayload:      invoice as any,
    })
    if (!idempotent) return

    await this.subs.failPayment(tenantId)
  }

  private async onSubscriptionUpdated(event: StripeEvent): Promise<void> {
    const sub      = event.data.object as StripeSubscription
    const tenantId = sub.metadata?.tenant_id
    if (!tenantId) return

    if (sub.status === 'active') {
      // In v2026-03-25 (dahlia), current_period_end moved to subscription items
      const periodEndTs = sub.items.data[0]?.current_period_end ?? 0
      const periodEnd   = new Date(periodEndTs * 1000)
      await this.subs.recoverPayment(tenantId, periodEnd)
    }
  }

  private async onSubscriptionDeleted(event: StripeEvent): Promise<void> {
    const sub      = event.data.object as StripeSubscription
    const tenantId = sub.metadata?.tenant_id
    if (!tenantId) return

    const idempotent = await this.subs.logEvent({
      tenantId,
      eventType:       'subscription_deleted',
      provider:        'stripe',
      providerEventId: event.id,
      rawPayload:      sub as any,
    })
    if (!idempotent) return

    await this.subs.confirmCancellation(tenantId)
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private extractTenantId(invoice: StripeInvoice): string | null {
    return (
      invoice.parent?.subscription_details?.metadata?.tenant_id ??
      invoice.metadata?.tenant_id ??
      null
    )
  }
}
