import { Module }       from '@nestjs/common'
import { PaymentsController } from './payments.controller'
import { PaymentsService }    from './payments.service'
import { BillingModule }      from '@modules/billing/billing.module'
import { SalesModule }        from '@modules/sales/sales.module'

@Module({
  imports:     [BillingModule, SalesModule],
  controllers: [PaymentsController],
  providers:   [PaymentsService],
})
export class PaymentsModule {}
