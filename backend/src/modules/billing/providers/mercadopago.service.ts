import { Injectable, Logger } from '@nestjs/common'
import { ConfigService }       from '@nestjs/config'
import { createHmac }          from 'crypto'
import MercadoPagoConfig, {
  PreApprovalPlan,
  PreApproval,
  Payment,
  Preference,
} from 'mercadopago'

@Injectable()
export class MercadoPagoService {
  private readonly cfg:           MercadoPagoConfig
  private readonly webhookSecret: string
  private readonly logger = new Logger(MercadoPagoService.name)

  constructor(private readonly config: ConfigService) {
    const accessToken = config.get<string>('MP_ACCESS_TOKEN')

    if (!accessToken) {
      this.logger.warn('MP_ACCESS_TOKEN not set — MercadoPago integration disabled')
    }

    this.cfg           = new MercadoPagoConfig({ accessToken: accessToken ?? '' })
    this.webhookSecret = config.get<string>('MP_WEBHOOK_SECRET') ?? ''
  }

  // ─── Checkout (PreApproval Plan link) ─────────────────────────────────────

  /**
   * Creates a subscription checkout link using a pre-existing MP plan.
   * The tenant subscribes by visiting the returned init_point URL.
   */
  async createSubscriptionLink(params: {
    mpPlanId:     string
    payerEmail:   string
    tenantId:     string
    backUrl?:     string
  }): Promise<{ initPoint: string; preapprovalId: string }> {
    const client = new PreApproval(this.cfg)

    const result = await client.create({
      body: {
        preapproval_plan_id: params.mpPlanId,
        payer_email:         params.payerEmail,
        back_url:            params.backUrl ?? '',
        external_reference:  params.tenantId,
        status:              'pending',
      },
    })

    return {
      initPoint:    (result as any).init_point,
      preapprovalId: (result as any).id,
    }
  }

  // ─── Subscriptions ────────────────────────────────────────────────────────

  async getPreapproval(preapprovalId: string): Promise<any> {
    const client = new PreApproval(this.cfg)
    return client.get({ id: preapprovalId })
  }

  async cancelPreapproval(preapprovalId: string): Promise<void> {
    const client = new PreApproval(this.cfg)
    await client.update({ id: preapprovalId, body: { status: 'cancelled' } as any })
  }

  // ─── QR Preference (POS dinámico) ────────────────────────────────────────

  async createPreference(params: {
    items: Array<{
      title:       string
      quantity:    number
      unit_price:  number
    }>
    externalReference: string
    notificationUrl:   string
  }): Promise<{ initPoint: string; preferenceId: string }> {
    const client = new Preference(this.cfg)
    const result = await client.create({
      body: {
        items:              params.items,
        external_reference: params.externalReference,
        notification_url:   params.notificationUrl || undefined,
        // Deshabilitar los métodos de pago que no son QR
        payment_methods: {
          excluded_payment_types: [{ id: 'ticket' }],
        },
      } as any,
    })
    return {
      initPoint:    (result as any).init_point,
      preferenceId: (result as any).id,
    }
  }

  // ─── Payments ─────────────────────────────────────────────────────────────

  async getPayment(paymentId: string): Promise<any> {
    const client = new Payment(this.cfg)
    return client.get({ id: paymentId })
  }

  // ─── Webhook signature validation ─────────────────────────────────────────

  /**
   * MP signature: HMAC-SHA256 of "id:{data.id};request-id:{x-request-id};ts:{ts};"
   * Header x-signature format: "ts=...,v1=..."
   */
  validateSignature(params: {
    dataId:      string
    xSignature:  string
    xRequestId:  string
  }): boolean {
    if (!this.webhookSecret) {
      this.logger.warn('MP_WEBHOOK_SECRET not set — skipping signature validation')
      return true
    }

    try {
      const parts: Record<string, string> = {}
      for (const part of params.xSignature.split(',')) {
        const [k, v] = part.split('=')
        if (k && v) parts[k.trim()] = v.trim()
      }

      const ts = parts['ts']
      const v1 = parts['v1']
      if (!ts || !v1) return false

      const manifest = `id:${params.dataId};request-id:${params.xRequestId};ts:${ts};`
      const expected = createHmac('sha256', this.webhookSecret)
        .update(manifest)
        .digest('hex')

      return expected === v1
    } catch {
      return false
    }
  }

  // ─── Status helpers ───────────────────────────────────────────────────────

  isApproved(preapproval: any): boolean {
    return preapproval?.status === 'authorized'
  }

  isCancelled(preapproval: any): boolean {
    return ['cancelled', 'ended'].includes(preapproval?.status)
  }

  isPaused(preapproval: any): boolean {
    return preapproval?.status === 'paused'
  }
}
