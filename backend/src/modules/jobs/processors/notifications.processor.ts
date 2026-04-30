import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq'
import { Logger }    from '@nestjs/common'
import { Job }       from 'bullmq'
import { RedisService }          from '@database/redis.service'
import { QUEUE, NOTIFICATION_JOB } from '../constants/queues'
import type {
  StockAlertJobData,
  SubWarningJobData,
  SyncConflictJobData,
} from '../jobs.service'

// ─── Notification channels ───────────────────────────────────────────────────
// Redis pub/sub channels used for real-time delivery

export const CHANNELS = {
  STOCK_ALERT:    (tenantId: string) => `tenant:${tenantId}:stock-alerts`,
  SUB_WARNING:    (tenantId: string) => `tenant:${tenantId}:sub-warning`,
  SYNC_CONFLICT:  (tenantId: string) => `tenant:${tenantId}:sync-conflicts`,
}

@Processor(QUEUE.NOTIFICATIONS, {
  concurrency: 10,   // notifications are lightweight
})
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name)

  constructor(private readonly redis: RedisService) {
    super()
  }

  async process(job: Job): Promise<unknown> {
    switch (job.name) {
      case NOTIFICATION_JOB.STOCK_ALERT:
        return this.processStockAlert(job)
      case NOTIFICATION_JOB.SUB_WARNING:
        return this.processSubWarning(job)
      case NOTIFICATION_JOB.SYNC_CONFLICT:
        return this.processSyncConflict(job)
      default:
        this.logger.warn(`Unknown notification job: ${job.name}`)
        return null
    }
  }

  // ─── Stock alert ──────────────────────────────────────────────────────────

  private async processStockAlert(job: Job<StockAlertJobData>) {
    const data = job.data

    this.logger.warn(
      { tenantId: data.tenantId, productId: data.productId, branchId: data.branchId, deficit: data.deficit },
      `Low stock: "${data.productName}" at "${data.branchName}"`
    )

    // 1. Publish via Redis pub/sub for real-time dashboard update
    await this.redis.publishJson(CHANNELS.STOCK_ALERT(data.tenantId), {
      type:         'stock_alert',
      product_id:   data.productId,
      product_name: data.productName,
      branch_id:    data.branchId,
      branch_name:  data.branchName,
      quantity:     data.quantity,
      min_quantity: data.minQuantity,
      deficit:      data.deficit,
      timestamp:    new Date().toISOString(),
    })

    // 2. Persist alert counter in Redis (for badge counts in UI)
    const alertKey = `alerts:${data.tenantId}:low-stock`
    await this.redis.incr(alertKey, 86_400)   // 24h TTL on the counter

    // 3. Placeholder: send email/push notification
    // In production, inject an EmailService or PushService here
    this.logger.log({ tenantId: data.tenantId }, 'Stock alert published')

    return { published: true, channel: CHANNELS.STOCK_ALERT(data.tenantId) }
  }

  // ─── Subscription expiry warning ──────────────────────────────────────────

  private async processSubWarning(job: Job<SubWarningJobData>) {
    const data = job.data

    this.logger.warn(
      { tenantId: data.tenantId, daysUntilExpiry: data.daysUntilExpiry, plan: data.planName },
      'Subscription expiring soon'
    )

    await this.redis.publishJson(CHANNELS.SUB_WARNING(data.tenantId), {
      type:             'sub_expiry_warning',
      plan_name:        data.planName,
      days_until_expiry: data.daysUntilExpiry,
      expires_at:       data.expiresAt,
      timestamp:        new Date().toISOString(),
    })

    // Placeholder: email notification to tenant owner
    // EmailService.send({ to: data.tenantEmail, template: 'sub-expiry-warning', data })

    return { published: true }
  }

  // ─── Sync conflict report ─────────────────────────────────────────────────

  private async processSyncConflict(job: Job<SyncConflictJobData>) {
    const data = job.data

    this.logger.warn(
      { tenantId: data.tenantId, deviceId: data.deviceId, conflicts: data.conflicts.length },
      'Sync conflicts detected'
    )

    await this.redis.publishJson(CHANNELS.SYNC_CONFLICT(data.tenantId), {
      type:      'sync_conflict',
      device_id: data.deviceId,
      conflicts: data.conflicts,
      timestamp: new Date().toISOString(),
    })

    return { published: true, count: data.conflicts.length }
  }

  // ─── Worker events ────────────────────────────────────────────────────────

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    // Notification failures are non-critical — warn only
    this.logger.warn(
      { jobId: job.id, name: job.name, err: err.message },
      'Notification job failed'
    )
  }
}
