import { Injectable, Logger } from '@nestjs/common'
import { PrismaService }          from '@database/prisma.service'
import { SubscriptionsService }   from '../subscriptions.service'
import { MercadoPagoService }     from '../providers/mercadopago.service'
import { SalesService }           from '@modules/sales/sales.service'

export interface MpWebhookBody {
  id:     string
  type:   string    // 'subscription_preapproval' | 'payment'
  data:   { id: string }
  action: string    // 'created' | 'updated'
  live_mode: boolean
}

@Injectable()
export class MpWebhookHandler {
  private readonly logger = new Logger(MpWebhookHandler.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly subs:   SubscriptionsService,
    private readonly mp:     MercadoPagoService,
    private readonly sales:  SalesService,
  ) {}

  async handle(body: MpWebhookBody): Promise<void> {
    this.logger.log({ type: body.type, id: body.data?.id }, 'Processing MP webhook')

    switch (body.type) {
      case 'subscription_preapproval':
        await this.onPreapproval(body)
        break
      case 'payment':
        await this.onPayment(body)
        break
      default:
        this.logger.debug(`Unhandled MP event type: ${body.type}`)
    }
  }

  // ─── Preapproval (subscription status change) ─────────────────────────────

  private async onPreapproval(body: MpWebhookBody): Promise<void> {
    const preapprovalId = body.data?.id
    if (!preapprovalId) return

    const preapproval = await this.mp.getPreapproval(preapprovalId)
    const tenantId    = preapproval.external_reference as string

    if (!tenantId) {
      this.logger.warn({ preapprovalId }, 'No external_reference on preapproval — skipping')
      return
    }

    const idempotent = await this.subs.logEvent({
      tenantId,
      eventType:       `preapproval_${preapproval.status}`,
      provider:        'mercadopago',
      providerEventId: `${body.id}_${body.action}`,
      rawPayload:      preapproval as any,
    })
    if (!idempotent) return

    if (this.mp.isApproved(preapproval)) {
      await this.activateFromPreapproval(tenantId, preapproval)
    } else if (this.mp.isPaused(preapproval)) {
      await this.subs.failPayment(tenantId)
    } else if (this.mp.isCancelled(preapproval)) {
      await this.subs.confirmCancellation(tenantId)
    }
  }

  // ─── Payment (individual charge) ─────────────────────────────────────────

  private async onPayment(body: MpWebhookBody): Promise<void> {
    const paymentId = body.data?.id
    if (!paymentId) return

    const payment = await this.mp.getPayment(paymentId)
    const extRef   = payment.external_reference as string | undefined

    // ── POS QR payment ────────────────────────────────────────────
    if (extRef?.startsWith('SALE:')) {
      await this.onPosPayment(payment, paymentId, extRef)
      return
    }

    // ── Subscription payment ──────────────────────────────────────
    if (!payment.subscription_id) return

    const tenantId = extRef
    if (!tenantId) return

    if (payment.status === 'approved') {
      const idempotent = await this.subs.logEvent({
        tenantId,
        eventType:       'payment_approved',
        provider:        'mercadopago',
        providerEventId: `pay_${paymentId}`,
        amount:          payment.transaction_amount,
        currency:        payment.currency_id,
        status:          'approved',
        rawPayload:      payment as any,
      })
      if (!idempotent) return

      const periodEnd = new Date()
      periodEnd.setMonth(periodEnd.getMonth() + 1)
      await this.subs.recoverPayment(tenantId, periodEnd)

    } else if (['rejected', 'cancelled'].includes(payment.status)) {
      const idempotent = await this.subs.logEvent({
        tenantId,
        eventType:       'payment_failed',
        provider:        'mercadopago',
        providerEventId: `pay_${paymentId}`,
        amount:          payment.transaction_amount,
        currency:        payment.currency_id,
        status:          payment.status,
        rawPayload:      payment as any,
      })
      if (!idempotent) return

      await this.subs.failPayment(tenantId)
    }
  }

  // ─── POS QR payment handler ───────────────────────────────────────────────

  private async onPosPayment(
    payment:   any,
    paymentId: string,
    extRef:    string,
  ): Promise<void> {
    // extRef format: "SALE:{tenantId}:{saleId}"
    const parts = extRef.split(':')
    if (parts.length !== 3) {
      this.logger.warn({ extRef }, 'Malformed SALE external_reference — skipping')
      return
    }
    const [, tenantId, saleId] = parts

    if (payment.status === 'approved') {
      try {
        await this.sales.completePendingSale(tenantId, saleId, String(paymentId))
        this.logger.log({ tenantId, saleId, paymentId }, 'POS sale completed via MP webhook')
      } catch (err) {
        this.logger.error({ tenantId, saleId, paymentId, err }, 'Failed to complete POS sale')
      }
    } else if (['rejected', 'cancelled'].includes(payment.status)) {
      try {
        await this.sales.cancelPendingSale(tenantId, saleId)
        this.logger.log({ tenantId, saleId, paymentId }, 'POS sale cancelled via MP webhook')
      } catch (err) {
        this.logger.error({ tenantId, saleId, err }, 'Failed to cancel POS sale')
      }
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async activateFromPreapproval(tenantId: string, preapproval: any): Promise<void> {
    const mpPlanId = preapproval.preapproval_plan_id as string

    const plan = mpPlanId
      ? await this.prisma.plan.findFirst({ where: { mpPlanId } })
      : null

    if (!plan) {
      this.logger.warn({ tenantId, mpPlanId }, 'No plan found for MP plan ID — skipping activation')
      return
    }

    const periodEnd = new Date()
    periodEnd.setMonth(periodEnd.getMonth() + 1)

    await this.subs.activate({
      tenantId,
      planId:             plan.id,
      provider:           'mercadopago',
      providerSubId:      preapproval.id,
      providerCustomerId: preapproval.payer_id?.toString(),
      periodStart:        new Date(),
      periodEnd,
      currency:           preapproval.auto_recurring?.currency_id ?? 'ARS',
      amount:             preapproval.auto_recurring?.transaction_amount ?? 0,
    })
  }
}
