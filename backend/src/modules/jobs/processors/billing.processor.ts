import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq'
import { Logger }    from '@nestjs/common'
import { Job }       from 'bullmq'
import { StripeService }           from '@modules/billing/providers/stripe.service'
import { MercadoPagoService }      from '@modules/billing/providers/mercadopago.service'
import { StripeWebhookHandler }    from '@modules/billing/webhooks/stripe-webhook.handler'
import { MpWebhookHandler }        from '@modules/billing/webhooks/mp-webhook.handler'
import { SubscriptionsService }    from '@modules/billing/subscriptions.service'
import { RedisService }            from '@database/redis.service'
import { QUEUE, BILLING_JOB }      from '../constants/queues'
import type { StripEventJobData, MpEventJobData } from '../jobs.service'

const WEBHOOK_LOCK_TTL = 30_000   // 30s — longer than max expected processing time

@Processor(QUEUE.BILLING, {
  concurrency: 3,   // billing events must be sequential per-event but parallel across events
})
export class BillingProcessor extends WorkerHost {
  private readonly logger = new Logger(BillingProcessor.name)

  constructor(
    private readonly stripe:        StripeService,
    private readonly mp:            MercadoPagoService,
    private readonly stripeHandler: StripeWebhookHandler,
    private readonly mpHandler:     MpWebhookHandler,
    private readonly subs:         SubscriptionsService,
    private readonly redis:         RedisService,
  ) {
    super()
  }

  async process(job: Job): Promise<unknown> {
    switch (job.name) {
      case BILLING_JOB.STRIPE_EVENT:
        return this.processStripeEvent(job)
      case BILLING_JOB.MP_EVENT:
        return this.processMpEvent(job)
      case BILLING_JOB.EXPIRE_GRACE:
        return this.processExpireGrace(job)
      default:
        this.logger.warn(`Unknown billing job: ${job.name}`)
        return null
    }
  }

  // ─── Stripe event ─────────────────────────────────────────────────────────

  private async processStripeEvent(job: Job<StripEventJobData>) {
    const { eventId, eventType, rawEvent } = job.data

    this.logger.log({ eventId, eventType, attempt: job.attemptsMade + 1 }, 'Processing Stripe event')

    // Distributed lock: prevents two workers processing the same event if Stripe retries
    // while the first attempt is still running
    const lockKey = `stripe-event:${eventId}`
    const lockToken = await this.redis.acquireLock(lockKey, WEBHOOK_LOCK_TTL)

    if (!lockToken) {
      this.logger.warn({ eventId }, 'Stripe event already being processed by another worker — skipping')
      return { skipped: true, reason: 'concurrent_processing' }
    }

    try {
      // Pass the raw event directly to handler (signature was verified in controller)
      await this.stripeHandler.handle(rawEvent as any)
      return { processed: true }
    } finally {
      await this.redis.releaseLock(lockKey, lockToken)
    }
  }

  // ─── MercadoPago event ────────────────────────────────────────────────────

  private async processMpEvent(job: Job<MpEventJobData>) {
    const { body } = job.data
    const eventKey = `${body.id}:${body.action}`

    this.logger.log({ eventKey, type: body.type, attempt: job.attemptsMade + 1 }, 'Processing MP event')

    const lockKey   = `mp-event:${eventKey}`
    const lockToken = await this.redis.acquireLock(lockKey, WEBHOOK_LOCK_TTL)

    if (!lockToken) {
      this.logger.warn({ eventKey }, 'MP event already being processed — skipping')
      return { skipped: true, reason: 'concurrent_processing' }
    }

    try {
      await this.mpHandler.handle(body)
      return { processed: true }
    } finally {
      await this.redis.releaseLock(lockKey, lockToken)
    }
  }

  // ─── Expire grace periods (repeating job) ─────────────────────────────────

  private async processExpireGrace(job: Job) {
    // Cluster-safe: only one instance should run this at a time
    const lockToken = await this.redis.acquireLock('expire-grace-periods', 60_000)
    if (!lockToken) {
      this.logger.debug('expire-grace skipped — another instance is running it')
      return { skipped: true }
    }

    try {
      const count = await this.subs.expireOverdueGracePeriods()
      if (count > 0) {
        this.logger.warn({ count }, 'Grace periods expired')
      }
      return { expired: count }
    } finally {
      await this.redis.releaseLock('expire-grace-periods', lockToken)
    }
  }

  // ─── Worker events ────────────────────────────────────────────────────────

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    const isLastAttempt = job.attemptsMade >= (job.opts.attempts ?? 1)
    const level         = isLastAttempt ? 'error' : 'warn'

    this.logger[level](
      { jobId: job.id, name: job.name, attempt: job.attemptsMade, err: err.message },
      isLastAttempt ? 'Billing job exhausted all retries' : 'Billing job failed — will retry'
    )
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log({ jobId: job.id, name: job.name }, 'Billing job completed')
  }

  @OnWorkerEvent('stalled')
  onStalled(jobId: string) {
    this.logger.error({ jobId }, 'Billing job stalled — manual review may be needed')
  }
}
