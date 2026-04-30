import { Module }     from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { QUEUE }      from '@modules/jobs/constants/queues'
import { JobsModule } from '@modules/jobs/jobs.module'
import { SalesModule } from '@modules/sales/sales.module'

import { BillingController }    from './billing.controller'
import { WebhooksController }   from './webhooks.controller'
import { PlansService }         from './plans.service'
import { SubscriptionsService } from './subscriptions.service'
import { LimitsService }        from './limits.service'
import { StripeService }        from './providers/stripe.service'
import { MercadoPagoService }   from './providers/mercadopago.service'
import { StripeWebhookHandler } from './webhooks/stripe-webhook.handler'
import { MpWebhookHandler }     from './webhooks/mp-webhook.handler'
import { BillingProcessor }     from '@modules/jobs/processors/billing.processor'

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE.BILLING }),
    JobsModule,
    SalesModule,
  ],
  controllers: [
    BillingController,
    WebhooksController,
  ],
  providers: [
    PlansService,
    SubscriptionsService,
    LimitsService,
    StripeService,
    MercadoPagoService,
    StripeWebhookHandler,
    MpWebhookHandler,
    BillingProcessor,
  ],
  exports: [
    PlansService,
    SubscriptionsService,
    LimitsService,
    MercadoPagoService,
  ],
})
export class BillingModule {}
