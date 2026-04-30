import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq'
import { Logger }    from '@nestjs/common'
import { Job }       from 'bullmq'
import { PrismaService }        from '@database/prisma.service'
import { PrismaTenantService }  from '@database/prisma-tenant.service'
import { RedisService }         from '@database/redis.service'
import { TokenService }         from '@modules/auth/token.service'
import { JobsService }          from '../jobs.service'
import { QUEUE, MAINTENANCE_JOB } from '../constants/queues'

@Processor(QUEUE.MAINTENANCE, {
  concurrency: 1,   // maintenance runs serially to avoid DB overload
})
export class MaintenanceProcessor extends WorkerHost {
  private readonly logger = new Logger(MaintenanceProcessor.name)

  constructor(
    private readonly prisma:       PrismaService,
    private readonly tenantPrisma: PrismaTenantService,
    private readonly redis:        RedisService,
    private readonly tokens:       TokenService,
    private readonly jobs:         JobsService,
  ) {
    super()
  }

  async process(job: Job): Promise<unknown> {
    switch (job.name) {
      case MAINTENANCE_JOB.CLEANUP_TOKENS:
        return this.cleanupTokens(job)
      case MAINTENANCE_JOB.CLEANUP_CHANGES_LOG:
        return this.cleanupChangesLog(job)
      case MAINTENANCE_JOB.DISPATCH_STOCK_ALERTS:
        return this.dispatchStockAlerts(job)
      default:
        this.logger.warn(`Unknown maintenance job: ${job.name}`)
        return null
    }
  }

  // ─── Cleanup expired refresh tokens ───────────────────────────────────────

  private async cleanupTokens(job: Job) {
    const lockToken = await this.redis.acquireLock('maintenance:cleanup-tokens', 120_000)
    if (!lockToken) return { skipped: true }

    try {
      const deleted = await this.tokens.deleteExpiredTokens()
      this.logger.log({ deleted }, 'Expired refresh tokens cleaned up')
      return { deleted }
    } finally {
      await this.redis.releaseLock('maintenance:cleanup-tokens', lockToken)
    }
  }

  // ─── Cleanup old changes_log entries ─────────────────────────────────────

  private async cleanupChangesLog(job: Job) {
    const lockToken = await this.redis.acquireLock('maintenance:cleanup-changes-log', 300_000)
    if (!lockToken) return { skipped: true }

    try {
      const RETENTION_DAYS = 90
      const tenants = await this.prisma.tenant.findMany({
        where:  { status: { in: ['trial', 'active', 'suspended'] } },
        select: { id: true },
      })

      let totalDeleted = 0
      for (const { id: tenantId } of tenants) {
        try {
          const schema = this.tenantPrisma.tenantSchema(tenantId).replace(/"/g, '')
          const result = await this.tenantPrisma.$executeRawUnsafe(`
            DELETE FROM "${schema}".changes_log
            WHERE created_at < now() - INTERVAL '${RETENTION_DAYS} days'
          `)
          totalDeleted += result
        } catch {
          // Skip individual tenant errors — log and continue
          this.logger.warn({ tenantId }, 'Failed to cleanup changes_log for tenant')
        }

        // Yield between tenants to avoid blocking the event loop
        await new Promise(r => setTimeout(r, 10))
      }

      this.logger.log({ totalDeleted, tenants: tenants.length }, 'Changes log cleaned up')
      return { totalDeleted, tenants: tenants.length }
    } finally {
      await this.redis.releaseLock('maintenance:cleanup-changes-log', lockToken)
    }
  }

  // ─── Dispatch stock alerts for all tenants ────────────────────────────────

  private async dispatchStockAlerts(job: Job) {
    const lockToken = await this.redis.acquireLock('maintenance:stock-alerts', 300_000)
    if (!lockToken) return { skipped: true }

    try {
      const tenants = await this.prisma.tenant.findMany({
        where:  { status: 'active' },
        select: { id: true },
      })

      let totalAlerts = 0

      for (const { id: tenantId } of tenants) {
        try {
          const schema = this.tenantPrisma.tenantSchema(tenantId).replace(/"/g, '')

          const alerts = await this.tenantPrisma.$queryRawUnsafe<Array<{
            product_id:   string
            product_name: string
            branch_id:    string
            branch_name:  string
            quantity:     number
            min_quantity: number
            deficit:      number
          }>>(`
            SELECT
              p.id   AS product_id,
              p.name AS product_name,
              b.id   AS branch_id,
              b.name AS branch_name,
              st.quantity::float,
              st.min_quantity::float,
              (st.min_quantity - st.quantity)::float AS deficit
            FROM "${schema}".stock st
            JOIN "${schema}".products p ON p.id = st.product_id
            JOIN "${schema}".branches  b ON b.id = st.branch_id
            WHERE st.quantity <= st.min_quantity
              AND st.min_quantity > 0
              AND p.deleted_at IS NULL
              AND b.deleted_at IS NULL
            ORDER BY deficit DESC
            LIMIT 50
          `)

          for (const alert of alerts) {
            await this.jobs.enqueueStockAlert({
              tenantId,
              productId:   alert.product_id,
              productName: alert.product_name,
              branchId:    alert.branch_id,
              branchName:  alert.branch_name,
              quantity:    alert.quantity,
              minQuantity: alert.min_quantity,
              deficit:     alert.deficit,
            })
            totalAlerts++
          }
        } catch {
          this.logger.warn({ tenantId }, 'Failed to dispatch stock alerts for tenant')
        }

        await new Promise(r => setTimeout(r, 10))
      }

      this.logger.log({ totalAlerts, tenants: tenants.length }, 'Stock alert dispatch completed')
      return { totalAlerts, tenants: tenants.length }
    } finally {
      await this.redis.releaseLock('maintenance:stock-alerts', lockToken)
    }
  }

  // ─── Worker events ────────────────────────────────────────────────────────

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error({ jobId: job.id, name: job.name, err: err.message }, 'Maintenance job failed')
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job, result: unknown) {
    this.logger.log({ jobId: job.id, name: job.name, result }, 'Maintenance job completed')
  }
}
