import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common'
import { InjectQueue }  from '@nestjs/bullmq'
import { Queue }        from 'bullmq'
import {
  QUEUE,
  SYNC_JOB,
  BILLING_JOB,
  NOTIFICATION_JOB,
  MAINTENANCE_JOB,
  REPEATING_JOBS,
  JOB_OPTIONS,
} from './constants/queues'
import type { SalePayload } from '@modules/sync/dto/sync.dto'

// ─── Job payload types ────────────────────────────────────────────────────────

export interface OfflineSaleJobData {
  tenantId: string
  syncId:   string
  payload:  SalePayload
  deviceId: string
  userId:   string
}

export interface BatchPushJobData {
  tenantId: string
  userId:   string
  deviceId: string
  changeIds: string[]   // pre-validated change IDs stored in Redis
}

export interface StripEventJobData {
  eventId:   string
  eventType: string
  rawEvent:  Record<string, unknown>
}

export interface MpEventJobData {
  body: {
    id:     string
    type:   string
    data:   { id: string }
    action: string
    live_mode: boolean
  }
}

export interface StockAlertJobData {
  tenantId:    string
  productId:   string
  productName: string
  branchId:    string
  branchName:  string
  quantity:    number
  minQuantity: number
  deficit:     number
}

export interface SubWarningJobData {
  tenantId:        string
  tenantEmail:     string
  planName:        string
  daysUntilExpiry: number
  expiresAt:       string
}

export interface SyncConflictJobData {
  tenantId:  string
  deviceId:  string
  conflicts: Array<{ table: string; sync_id: string; reason: string }>
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class JobsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(JobsService.name)

  constructor(
    @InjectQueue(QUEUE.SYNC)          private readonly syncQueue:          Queue,
    @InjectQueue(QUEUE.BILLING)       private readonly billingQueue:       Queue,
    @InjectQueue(QUEUE.NOTIFICATIONS) private readonly notificationsQueue: Queue,
    @InjectQueue(QUEUE.MAINTENANCE)   private readonly maintenanceQueue:   Queue,
  ) {}

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  async onApplicationBootstrap(): Promise<void> {
    await this.registerRepeatingJobs()
  }

  private async registerRepeatingJobs(): Promise<void> {
    const queues: Record<string, Queue> = {
      [QUEUE.SYNC]:          this.syncQueue,
      [QUEUE.BILLING]:       this.billingQueue,
      [QUEUE.NOTIFICATIONS]: this.notificationsQueue,
      [QUEUE.MAINTENANCE]:   this.maintenanceQueue,
    }

    for (const job of REPEATING_JOBS) {
      const queue   = queues[job.queue]
      const options = JOB_OPTIONS[job.queue as keyof typeof JOB_OPTIONS] ?? JOB_OPTIONS.maintenance
      await queue.add(job.name, {}, { ...options, repeat: { pattern: job.pattern } })
      this.logger.log(`Registered repeating job: ${job.name} [${job.pattern}]`)
    }
  }

  // ─── Sync jobs ────────────────────────────────────────────────────────────

  async enqueueOfflineSale(data: OfflineSaleJobData): Promise<string> {
    const job = await this.syncQueue.add(
      SYNC_JOB.OFFLINE_SALE,
      data,
      {
        ...JOB_OPTIONS.sync,
        // Deduplicate: same syncId from same device never queued twice
        jobId: `offline-sale:${data.syncId}`,
      }
    )
    this.logger.log({ syncId: data.syncId, tenantId: data.tenantId }, 'Enqueued offline sale')
    return job.id ?? ''
  }

  async enqueueBatchPush(data: BatchPushJobData): Promise<string> {
    const job = await this.syncQueue.add(SYNC_JOB.BATCH_PUSH, data, JOB_OPTIONS.sync)
    return job.id ?? ''
  }

  // ─── Billing jobs ─────────────────────────────────────────────────────────

  async enqueueStripeEvent(data: StripEventJobData): Promise<void> {
    await this.billingQueue.add(
      BILLING_JOB.STRIPE_EVENT,
      data,
      {
        ...JOB_OPTIONS.billing,
        // Deduplicate: Stripe may retry the same event
        jobId: `stripe:${data.eventId}`,
      }
    )
    this.logger.log({ eventId: data.eventId, type: data.eventType }, 'Enqueued Stripe event')
  }

  async enqueueMpEvent(data: MpEventJobData): Promise<void> {
    const dedupeId = `${data.body.id}:${data.body.action}`
    await this.billingQueue.add(
      BILLING_JOB.MP_EVENT,
      data,
      {
        ...JOB_OPTIONS.billing,
        jobId: `mp:${dedupeId}`,
      }
    )
    this.logger.log({ id: data.body.id, type: data.body.type }, 'Enqueued MP event')
  }

  // ─── Notification jobs ────────────────────────────────────────────────────

  async enqueueStockAlert(data: StockAlertJobData): Promise<void> {
    // Deduplicate by product+branch — prevents alert spam on rapid writes
    const jobId = `stock-alert:${data.tenantId}:${data.productId}:${data.branchId}`
    await this.notificationsQueue.add(
      NOTIFICATION_JOB.STOCK_ALERT,
      data,
      {
        ...JOB_OPTIONS.notifications,
        jobId,
      }
    )
  }

  async enqueueSubWarning(data: SubWarningJobData): Promise<void> {
    const jobId = `sub-warning:${data.tenantId}:${data.daysUntilExpiry}`
    await this.notificationsQueue.add(
      NOTIFICATION_JOB.SUB_WARNING,
      data,
      {
        ...JOB_OPTIONS.notifications,
        jobId,
      }
    )
  }

  async enqueueSyncConflictReport(data: SyncConflictJobData): Promise<void> {
    await this.notificationsQueue.add(NOTIFICATION_JOB.SYNC_CONFLICT, data, JOB_OPTIONS.notifications)
  }

  // ─── Queue introspection (for monitoring endpoint) ────────────────────────

  async getQueueStats() {
    const [sync, billing, notifications, maintenance] = await Promise.all([
      this.getStats(this.syncQueue),
      this.getStats(this.billingQueue),
      this.getStats(this.notificationsQueue),
      this.getStats(this.maintenanceQueue),
    ])

    return { sync, billing, notifications, maintenance }
  }

  private async getStats(queue: Queue) {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ])
    return { waiting, active, completed, failed, delayed }
  }
}
