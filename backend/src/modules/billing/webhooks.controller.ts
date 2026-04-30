import {
  Controller,
  Post,
  Headers,
  RawBodyRequest,
  Req,
  Body,
  BadRequestException,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import { Request }            from 'express'
import { Public }             from '@common/guards/jwt-auth.guard'
import { StripeService }      from './providers/stripe.service'
import { MercadoPagoService } from './providers/mercadopago.service'
import { JobsService }        from '@modules/jobs/jobs.service'
import type { MpWebhookBody } from './webhooks/mp-webhook.handler'

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name)

  constructor(
    private readonly stripe:  StripeService,
    private readonly mp:      MercadoPagoService,
    private readonly jobs:    JobsService,
  ) {}

  /**
   * POST /webhooks/stripe
   * Verifies signature synchronously, then hands off to the billing queue.
   * Fast response prevents Stripe from retrying prematurely.
   */
  @Public()
  @Post('stripe')
  @HttpCode(HttpStatus.OK)
  async stripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!signature) throw new BadRequestException('Missing stripe-signature header')

    const rawBody = req.rawBody
    if (!rawBody) throw new BadRequestException('Raw body not available')

    let event: any
    try {
      event = this.stripe.constructWebhookEvent(rawBody, signature)
    } catch (err: any) {
      this.logger.warn(`Stripe signature rejected: ${err.message}`)
      throw new BadRequestException('Webhook signature verification failed')
    }

    await this.jobs.enqueueStripeEvent({
      eventId:   event.id,
      eventType: event.type,
      rawEvent:  event,
    })

    return { received: true }
  }

  /**
   * POST /webhooks/mp
   * Validates MP signature (production only), then enqueues for async processing.
   */
  @Public()
  @Post('mp')
  @HttpCode(HttpStatus.OK)
  async mpWebhook(
    @Body() body: MpWebhookBody,
    @Headers('x-signature')  xSignature:  string,
    @Headers('x-request-id') xRequestId:  string,
  ) {
    if (process.env.NODE_ENV === 'production') {
      const dataId = body?.data?.id?.toString() ?? ''
      const valid  = this.mp.validateSignature({
        dataId,
        xSignature:  xSignature  ?? '',
        xRequestId:  xRequestId  ?? '',
      })

      if (!valid) {
        this.logger.warn({ xSignature, body }, 'MP signature rejected')
        throw new BadRequestException('Invalid MercadoPago signature')
      }
    }

    if (!body?.type || !body?.data?.id) {
      return { received: true }   // ping / malformed — ignore
    }

    await this.jobs.enqueueMpEvent({ body })
    return { received: true }
  }
}
