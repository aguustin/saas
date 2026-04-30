import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { PlansService }         from './plans.service'
import { SubscriptionsService } from './subscriptions.service'
import { LimitsService }        from './limits.service'
import { StripeService }        from './providers/stripe.service'
import { MercadoPagoService }   from './providers/mercadopago.service'
import { TenantGuard }          from '@common/guards/tenant.guard'
import { RolesGuard }           from '@common/guards/roles.guard'
import { Roles }                from '@common/decorators/roles.decorator'
import { CurrentUser }          from '@common/decorators/current-user.decorator'
import { ZodValidationPipe }    from '@common/pipes/zod-validation.pipe'
import { PrismaService }        from '@database/prisma.service'
import type { JwtPayload }      from '@common/types/jwt-payload'
import {
  CheckoutStripeSchema,
  CheckoutMpSchema,
  CancelSchema,
  type CheckoutStripeDto,
  type CheckoutMpDto,
  type CancelDto,
} from './dto/billing.dto'

@UseGuards(TenantGuard, RolesGuard)
@Controller('billing')
export class BillingController {
  constructor(
    private readonly plans:  PlansService,
    private readonly subs:   SubscriptionsService,
    private readonly limits: LimitsService,
    private readonly stripe: StripeService,
    private readonly mp:     MercadoPagoService,
    private readonly prisma: PrismaService,
  ) {}

  // ─── Plans ─────────────────────────────────────────────────────────────────

  @Get('plans')
  @Roles('owner', 'admin', 'manager', 'cashier')
  listPlans() {
    return this.plans.listActive()
  }

  // ─── Subscription ──────────────────────────────────────────────────────────

  @Get('subscription')
  @Roles('owner', 'admin')
  getSubscription(@CurrentUser() actor: JwtPayload) {
    return this.subs.getCurrent(actor.tenant_id)
  }

  @Get('events')
  @Roles('owner', 'admin')
  getEvents(@CurrentUser() actor: JwtPayload) {
    return this.subs.getEvents(actor.tenant_id)
  }

  @Get('limits')
  @Roles('owner', 'admin', 'manager', 'cashier')
  getLimits(@CurrentUser() actor: JwtPayload) {
    return this.limits.getLimits(actor.tenant_id)
  }

  // ─── Checkout: Stripe ──────────────────────────────────────────────────────

  @Post('checkout/stripe')
  @Roles('owner', 'admin')
  async checkoutStripe(
    @CurrentUser() actor: JwtPayload,
    @Body(new ZodValidationPipe(CheckoutStripeSchema)) dto: CheckoutStripeDto,
  ) {
    const plan = await this.plans.getByName(dto.plan_name)
    if (!plan) throw new Error('Plan not found')

    // Get the raw plan with Stripe price ID
    const rawPlan = await this.prisma.plan.findUnique({ where: { id: plan.id } })
    if (!rawPlan?.stripePriceIdMonthly) {
      return { error: 'This plan is not available for Stripe checkout' }
    }

    const tenant = await this.prisma.tenant.findUnique({ where: { id: actor.tenant_id } })
    if (!tenant) throw new Error('Tenant not found')

    const customerId = await this.stripe.getOrCreateCustomer({
      email:              tenant.email,
      name:               tenant.name,
      tenantId:           actor.tenant_id,
      existingCustomerId: tenant.stripeCustomerId ?? undefined,
    })

    // Save customer ID if new
    if (!tenant.stripeCustomerId) {
      await this.prisma.tenant.update({
        where: { id: actor.tenant_id },
        data:  { stripeCustomerId: customerId },
      })
    }

    const session = await this.stripe.createCheckoutSession({
      customerId,
      priceId:    rawPlan.stripePriceIdMonthly,
      tenantId:   actor.tenant_id,
      successUrl: dto.success_url,
      cancelUrl:  dto.cancel_url,
    })

    return { checkout_url: session.url, session_id: session.sessionId }
  }

  // ─── Checkout: MercadoPago ─────────────────────────────────────────────────

  @Post('checkout/mp')
  @Roles('owner', 'admin')
  async checkoutMp(
    @CurrentUser() actor: JwtPayload,
    @Body(new ZodValidationPipe(CheckoutMpSchema)) dto: CheckoutMpDto,
  ) {
    const plan = await this.plans.getByName(dto.plan_name)
    const rawPlan = await this.prisma.plan.findUnique({ where: { id: plan.id } })

    if (!rawPlan?.mpPlanId) {
      return { error: 'This plan is not available for MercadoPago checkout' }
    }

    const result = await this.mp.createSubscriptionLink({
      mpPlanId:    rawPlan.mpPlanId,
      payerEmail:  dto.payer_email,
      tenantId:    actor.tenant_id,
      backUrl:     dto.back_url,
    })

    return { checkout_url: result.initPoint, preapproval_id: result.preapprovalId }
  }

  // ─── Cancel ────────────────────────────────────────────────────────────────

  @Post('subscription/cancel')
  @Roles('owner', 'admin')
  @HttpCode(HttpStatus.OK)
  async cancel(
    @CurrentUser() actor: JwtPayload,
    @Body(new ZodValidationPipe(CancelSchema)) dto: CancelDto,
  ) {
    const sub = await this.subs.getCurrent(actor.tenant_id)
    if (!sub) return { message: 'No active subscription' }

    // Cancel on provider side — sub.provider_sub_id is Stripe sub_xxx / MP preapproval ID
    if (sub.provider === 'stripe' && sub.provider_sub_id) {
      await this.stripe.cancelSubscription(sub.provider_sub_id, dto.at_period_end)
    } else if (sub.provider === 'mercadopago' && sub.provider_sub_id) {
      await this.mp.cancelPreapproval(sub.provider_sub_id)
    }

    return this.subs.cancel(actor.tenant_id, dto.at_period_end)
  }

  // ─── Customer portal (Stripe self-service) ─────────────────────────────────

  @Post('portal')
  @Roles('owner', 'admin')
  @HttpCode(HttpStatus.OK)
  async portal(
    @CurrentUser() actor: JwtPayload,
    @Body('return_url') returnUrl: string,
  ) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: actor.tenant_id } })
    if (!tenant?.stripeCustomerId) {
      return { error: 'No Stripe account associated with this tenant' }
    }

    const url = await this.stripe.createPortalSession({
      customerId: tenant.stripeCustomerId,
      returnUrl:  returnUrl ?? `${process.env.APP_URL}/billing`,
    })

    return { portal_url: url }
  }
}
