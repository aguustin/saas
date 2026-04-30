import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { SubscriptionsService } from './subscriptions.service'

@Injectable()
export class BillingCronService {
  private readonly logger = new Logger(BillingCronService.name)

  constructor(private readonly subs: SubscriptionsService) {}

  /**
   * Every hour: check subscriptions in past_due state whose grace period expired.
   * Transitions them to 'unpaid' and suspends tenant access.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async expireGracePeriods(): Promise<void> {
    try {
      const count = await this.subs.expireOverdueGracePeriods()
      if (count > 0) {
        this.logger.warn({ count }, 'Grace periods expired — tenants suspended')
      }
    } catch (err) {
      this.logger.error({ err }, 'Failed to expire grace periods')
    }
  }
}
