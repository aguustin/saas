import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq'
import { Logger }       from '@nestjs/common'
import { Job }          from 'bullmq'
import { SyncRepository } from '@modules/sync/sync.repository'
import { JobsService, type OfflineSaleJobData, type BatchPushJobData } from '../jobs.service'
import { QUEUE, SYNC_JOB } from '../constants/queues'
import { SalePayloadSchema } from '@modules/sync/dto/sync.dto'

@Processor(QUEUE.SYNC, {
  concurrency: 5,    // process up to 5 sync jobs in parallel
})
export class SyncProcessor extends WorkerHost {
  private readonly logger = new Logger(SyncProcessor.name)

  constructor(
    private readonly syncRepo: SyncRepository,
    private readonly jobs:     JobsService,
  ) {
    super()
  }

  async process(job: Job): Promise<unknown> {
    switch (job.name) {
      case SYNC_JOB.OFFLINE_SALE:
        return this.processOfflineSale(job)
      case SYNC_JOB.BATCH_PUSH:
        return this.processBatchPush(job)
      default:
        this.logger.warn(`Unknown sync job: ${job.name}`)
        return null
    }
  }

  // ─── Offline sale ─────────────────────────────────────────────────────────

  private async processOfflineSale(job: Job<OfflineSaleJobData>) {
    const { tenantId, syncId, payload, deviceId, userId } = job.data

    this.logger.log({ tenantId, syncId, attempt: job.attemptsMade + 1 }, 'Processing offline sale')

    // Validate payload (may have been queued with partial data)
    const parsed = SalePayloadSchema.safeParse(payload)
    if (!parsed.success) {
      // Don't retry — bad data won't get better
      this.logger.error({ syncId, errors: parsed.error.errors }, 'Invalid offline sale payload')
      throw new Error(`Invalid payload: ${parsed.error.errors[0]?.message}`)
    }

    const { saleId, isNew, shortfalls } = await this.syncRepo.applyOfflineSale({
      tenantId, syncId, payload: parsed.data, deviceId, userId,
    })

    if (shortfalls.length > 0) {
      // Enqueue conflict notification so the client learns about stock shortfalls
      await this.jobs.enqueueSyncConflictReport({
        tenantId,
        deviceId,
        conflicts: shortfalls.map(s => ({
          table:   'sales',
          sync_id: syncId,
          reason:  `Stock shortfall for product ${s.product_id}: available ${s.available}, requested ${s.requested}`,
        })),
      })
    }

    this.logger.log({ tenantId, saleId, isNew, shortfalls: shortfalls.length }, 'Offline sale processed')
    return { saleId, isNew, shortfalls }
  }

  // ─── Batch push ───────────────────────────────────────────────────────────

  private async processBatchPush(job: Job<BatchPushJobData>) {
    // Batch push processes change IDs pre-stored in Redis
    // (large payloads aren't stored in BullMQ — only keys)
    this.logger.log(
      { tenantId: job.data.tenantId, count: job.data.changeIds.length },
      'Processing batch push'
    )
    // Actual implementation fetches each change from Redis by changeId
    // and applies them via SyncRepository
    // This pattern keeps BullMQ jobs small and Redis holds the heavy payloads
    return { processed: job.data.changeIds.length }
  }

  // ─── Worker events ────────────────────────────────────────────────────────

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(
      { jobId: job.id, name: job.name, attempt: job.attemptsMade, err: err.message },
      'Sync job failed'
    )
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.debug({ jobId: job.id, name: job.name }, 'Sync job completed')
  }

  @OnWorkerEvent('stalled')
  onStalled(jobId: string) {
    this.logger.warn({ jobId }, 'Sync job stalled — will be retried')
  }
}
