import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common'
import { PrismaService } from '@database/prisma.service'
import { Prisma }        from '@prisma/client'
import type { SubscriptionDto, BillingEventDto } from './dto/billing.dto'

const GRACE_PERIOD_DAYS = 3

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name)

  constructor(private readonly prisma: PrismaService) {}

  // ─── Queries ──────────────────────────────────────────────────────────────

  async getCurrent(tenantId: string): Promise<SubscriptionDto | null> {
    const sub = await this.findActiveSub(tenantId)
    if (!sub) return null
    return this.toDto(sub)
  }

  async getEvents(tenantId: string, limit = 20): Promise<BillingEventDto[]> {
    const events = await this.prisma.billingEvent.findMany({
      where:   { tenantId },
      orderBy: { processedAt: 'desc' },
      take:    limit,
    })
    return events.map(e => ({
      id:           e.id,
      event_type:   e.eventType,
      provider:     e.provider,
      amount:       e.amount ? Number(e.amount) : null,
      currency:     e.currency   ?? null,
      status:       e.status     ?? null,
      processed_at: e.processedAt.toISOString(),
    }))
  }

  // ─── State transitions ────────────────────────────────────────────────────

  /**
   * Called when a new payment is confirmed (first activation or renewal).
   * Creates the subscription if it doesn't exist; updates it if it does.
   */
  async activate(params: {
    tenantId:          string
    planId:            string
    provider:          'stripe' | 'mercadopago' | 'manual'
    providerSubId:     string
    providerCustomerId?: string
    periodStart:       Date
    periodEnd:         Date
    currency:          string
    amount:            number
  }): Promise<void> {
    const existing = await this.findAnySub(params.tenantId)

    const data: Prisma.SubscriptionUpdateInput = {
      plan:                { connect: { id: params.planId } },
      status:              'active',
      provider:            params.provider as any,
      providerSubId:       params.providerSubId,
      providerCustomerId:  params.providerCustomerId ?? null,
      currentPeriodStart:  params.periodStart,
      currentPeriodEnd:    params.periodEnd,
      gracePeriodEndsAt:   null,
      cancelAtPeriodEnd:   false,
      cancelledAt:         null,
      currency:            params.currency,
      amount:              new Prisma.Decimal(params.amount),
    }

    if (existing) {
      await this.prisma.subscription.update({ where: { id: existing.id }, data })
    } else {
      await this.prisma.subscription.create({
        data: {
          ...data,
          tenant:  { connect: { id: params.tenantId } },
        } as any,
      })
    }

    // Sync tenant plan + status
    await this.prisma.tenant.update({
      where: { id: params.tenantId },
      data: {
        planId:        params.planId,
        planExpiresAt: params.periodEnd,
        status:        'active',
      },
    })

    this.logger.log({ tenantId: params.tenantId, provider: params.provider }, 'Subscription activated')
  }

  /**
   * Payment failed: start grace period. Tenant stays active during grace.
   */
  async failPayment(tenantId: string): Promise<void> {
    const sub = await this.findActiveSub(tenantId)
    if (!sub) return

    const gracePeriodEndsAt = new Date(Date.now() + GRACE_PERIOD_DAYS * 86_400_000)

    await this.prisma.subscription.update({
      where: { id: sub.id },
      data:  { status: 'past_due', gracePeriodEndsAt },
    })

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data:  { status: 'active' },  // still active during grace
    })

    this.logger.warn({ tenantId, gracePeriodEndsAt }, 'Payment failed — grace period started')
  }

  /**
   * Payment recovered after past_due: resume normal subscription.
   */
  async recoverPayment(tenantId: string, newPeriodEnd: Date): Promise<void> {
    const sub = await this.findActiveSub(tenantId)
    if (!sub) return

    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status:            'active',
        gracePeriodEndsAt: null,
        currentPeriodEnd:  newPeriodEnd,
      },
    })

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data:  { status: 'active', planExpiresAt: newPeriodEnd },
    })

    this.logger.log({ tenantId }, 'Payment recovered')
  }

  /**
   * Grace period expired without payment: suspend access.
   */
  async expireGracePeriod(tenantId: string): Promise<void> {
    const sub = await this.findActiveSub(tenantId)
    if (!sub) return

    await this.prisma.subscription.update({
      where: { id: sub.id },
      data:  { status: 'unpaid' },
    })

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data:  { status: 'suspended' },
    })

    this.logger.warn({ tenantId }, 'Grace period expired — tenant suspended')
  }

  /**
   * User-initiated cancellation.
   */
  async cancel(tenantId: string, atPeriodEnd: boolean): Promise<SubscriptionDto> {
    const sub = await this.findActiveSub(tenantId)
    if (!sub) throw new NotFoundException('No active subscription found')

    const now = new Date()

    if (atPeriodEnd) {
      await this.prisma.subscription.update({
        where: { id: sub.id },
        data:  { cancelAtPeriodEnd: true },
      })
    } else {
      await this.prisma.subscription.update({
        where: { id: sub.id },
        data: {
          status:           'cancelled',
          cancelledAt:      now,
          cancelAtPeriodEnd: false,
        },
      })
      await this.prisma.tenant.update({
        where: { id: tenantId },
        data:  { status: 'cancelled' },
      })
    }

    const updated = await this.findAnySub(tenantId)
    return this.toDto(updated!)
  }

  /**
   * Provider confirms cancellation (e.g. subscription.deleted from Stripe).
   */
  async confirmCancellation(tenantId: string): Promise<void> {
    const sub = await this.findAnySub(tenantId)
    if (!sub) return

    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status:            'cancelled',
        cancelledAt:       new Date(),
        cancelAtPeriodEnd: false,
      },
    })

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data:  { status: 'cancelled' },
    })

    this.logger.log({ tenantId }, 'Subscription cancelled by provider')
  }

  // ─── Idempotent billing event log ─────────────────────────────────────────

  async logEvent(params: {
    tenantId:        string
    subId?:          string
    eventType:       string
    provider:        string
    providerEventId: string
    amount?:         number
    currency?:       string
    status?:         string
    rawPayload:      Record<string, unknown>
  }): Promise<boolean> {
    try {
      await this.prisma.billingEvent.create({
        data: {
          tenantId:        params.tenantId,
          subId:           params.subId    ?? null,
          eventType:       params.eventType,
          provider:        params.provider,
          providerEventId: params.providerEventId,
          amount:          params.amount   ? new Prisma.Decimal(params.amount) : null,
          currency:        params.currency ?? null,
          status:          params.status   ?? null,
          rawPayload:      params.rawPayload as any,
        },
      })
      return true  // new event, should be processed
    } catch (err: any) {
      if (err?.code === 'P2002') return false  // duplicate — already processed
      throw err
    }
  }

  // ─── Lookup helpers ───────────────────────────────────────────────────────

  async findByProviderSubId(providerSubId: string) {
    return this.prisma.subscription.findFirst({
      where:   { providerSubId },
      include: { tenant: true, plan: true },
    })
  }

  async findByProviderCustomerId(providerCustomerId: string) {
    return this.prisma.subscription.findFirst({
      where:   { providerCustomerId },
      include: { tenant: true, plan: true },
    })
  }

  // ─── Cron: expire grace periods ───────────────────────────────────────────

  async expireOverdueGracePeriods(): Promise<number> {
    const now  = new Date()
    const subs = await this.prisma.subscription.findMany({
      where: {
        status:             'past_due',
        gracePeriodEndsAt:  { lte: now },
      },
      select: { tenantId: true },
    })

    for (const { tenantId } of subs) {
      await this.expireGracePeriod(tenantId)
    }

    return subs.length
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private findActiveSub(tenantId: string) {
    return this.prisma.subscription.findFirst({
      where: {
        tenantId,
        status: { in: ['trialing', 'active', 'past_due'] },
      },
      include: { plan: true },
    })
  }

  private findAnySub(tenantId: string) {
    return this.prisma.subscription.findFirst({
      where:   { tenantId },
      orderBy: { createdAt: 'desc' },
      include: { plan: true },
    })
  }

  private toDto(sub: any): SubscriptionDto {
    return {
      id:                   sub.id,
      plan_name:            sub.plan.name,
      plan_display_name:    sub.plan.displayName,
      status:               sub.status,
      provider:             sub.provider,
      provider_sub_id:      sub.providerSubId,
      current_period_start: sub.currentPeriodStart.toISOString(),
      current_period_end:   sub.currentPeriodEnd.toISOString(),
      grace_period_ends_at: sub.gracePeriodEndsAt?.toISOString() ?? null,
      cancel_at_period_end: sub.cancelAtPeriodEnd,
      cancelled_at:         sub.cancelledAt?.toISOString() ?? null,
      currency:             sub.currency,
      amount:               Number(sub.amount),
    }
  }
}
