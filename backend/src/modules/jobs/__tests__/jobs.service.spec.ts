import { Test, TestingModule } from '@nestjs/testing'
import { getQueueToken }       from '@nestjs/bullmq'
import { JobsService }         from '../jobs.service'
import { QUEUE, SYNC_JOB, BILLING_JOB, NOTIFICATION_JOB } from '../constants/queues'

const makeQueue = () => ({
  add:                jest.fn().mockResolvedValue({ id: 'job-1' }),
  getWaitingCount:    jest.fn().mockResolvedValue(0),
  getActiveCount:     jest.fn().mockResolvedValue(0),
  getCompletedCount:  jest.fn().mockResolvedValue(0),
  getFailedCount:     jest.fn().mockResolvedValue(0),
  getDelayedCount:    jest.fn().mockResolvedValue(0),
  getRepeatableJobs:  jest.fn().mockResolvedValue([]),
  removeRepeatableByKey: jest.fn().mockResolvedValue(undefined),
})

describe('JobsService', () => {
  let service:  JobsService
  let syncQ:    ReturnType<typeof makeQueue>
  let billingQ: ReturnType<typeof makeQueue>
  let notifsQ:  ReturnType<typeof makeQueue>
  let maintQ:   ReturnType<typeof makeQueue>

  beforeEach(async () => {
    syncQ    = makeQueue()
    billingQ = makeQueue()
    notifsQ  = makeQueue()
    maintQ   = makeQueue()

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobsService,
        { provide: getQueueToken(QUEUE.SYNC),          useValue: syncQ    },
        { provide: getQueueToken(QUEUE.BILLING),       useValue: billingQ },
        { provide: getQueueToken(QUEUE.NOTIFICATIONS), useValue: notifsQ  },
        { provide: getQueueToken(QUEUE.MAINTENANCE),   useValue: maintQ   },
      ],
    }).compile()

    service = module.get(JobsService)
  })

  // ─── Bootstrap ─────────────────────────────────────────────────────────────

  describe('onApplicationBootstrap', () => {
    it('registers repeating jobs on all queues', async () => {
      await service.onApplicationBootstrap()
      // BILLING: expire-grace; MAINTENANCE: 3 jobs
      expect(billingQ.add).toHaveBeenCalledWith(
        BILLING_JOB.EXPIRE_GRACE,
        {},
        expect.objectContaining({ repeat: expect.objectContaining({ pattern: expect.any(String) }) }),
      )
      expect(maintQ.add).toHaveBeenCalledTimes(3)
    })
  })

  // ─── Sync jobs ──────────────────────────────────────────────────────────────

  describe('enqueueOfflineSale', () => {
    it('adds to sync queue with dedup jobId', async () => {
      const data = {
        tenantId: 't1', syncId: 'sync-abc', payload: {} as any,
        deviceId: 'd1', userId: 'u1',
      }
      const id = await service.enqueueOfflineSale(data)

      expect(syncQ.add).toHaveBeenCalledWith(
        SYNC_JOB.OFFLINE_SALE,
        data,
        expect.objectContaining({ jobId: 'offline-sale:sync-abc' }),
      )
      expect(id).toBe('job-1')
    })
  })

  describe('enqueueBatchPush', () => {
    it('adds to sync queue', async () => {
      await service.enqueueBatchPush({
        tenantId: 't1', userId: 'u1', deviceId: 'd1', changeIds: ['c1', 'c2'],
      })
      expect(syncQ.add).toHaveBeenCalledWith(SYNC_JOB.BATCH_PUSH, expect.any(Object), expect.any(Object))
    })
  })

  // ─── Billing jobs ───────────────────────────────────────────────────────────

  describe('enqueueStripeEvent', () => {
    it('deduplicates by eventId', async () => {
      await service.enqueueStripeEvent({ eventId: 'evt_123', eventType: 'invoice.paid', rawEvent: {} })
      expect(billingQ.add).toHaveBeenCalledWith(
        BILLING_JOB.STRIPE_EVENT,
        expect.any(Object),
        expect.objectContaining({ jobId: 'stripe:evt_123' }),
      )
    })
  })

  describe('enqueueMpEvent', () => {
    it('deduplicates by id:action', async () => {
      const body = { id: '99', type: 'payment', data: { id: '99' }, action: 'updated', live_mode: true }
      await service.enqueueMpEvent({ body })
      expect(billingQ.add).toHaveBeenCalledWith(
        BILLING_JOB.MP_EVENT,
        expect.any(Object),
        expect.objectContaining({ jobId: 'mp:99:updated' }),
      )
    })
  })

  // ─── Notification jobs ──────────────────────────────────────────────────────

  describe('enqueueStockAlert', () => {
    it('deduplicates by tenant+product+branch', async () => {
      const data = {
        tenantId: 't1', productId: 'p1', productName: 'Widget',
        branchId: 'b1', branchName: 'Main', quantity: 2, minQuantity: 10, deficit: 8,
      }
      await service.enqueueStockAlert(data)
      expect(notifsQ.add).toHaveBeenCalledWith(
        NOTIFICATION_JOB.STOCK_ALERT,
        data,
        expect.objectContaining({ jobId: 'stock-alert:t1:p1:b1' }),
      )
    })
  })

  describe('enqueueSubWarning', () => {
    it('deduplicates by tenant+days', async () => {
      const data = {
        tenantId: 't1', tenantEmail: 'a@b.com', planName: 'pro',
        daysUntilExpiry: 7, expiresAt: '2025-12-31',
      }
      await service.enqueueSubWarning(data)
      expect(notifsQ.add).toHaveBeenCalledWith(
        NOTIFICATION_JOB.SUB_WARNING,
        data,
        expect.objectContaining({ jobId: 'sub-warning:t1:7' }),
      )
    })
  })

  describe('enqueueSyncConflictReport', () => {
    it('adds to notifications queue (no dedup)', async () => {
      await service.enqueueSyncConflictReport({
        tenantId: 't1', deviceId: 'd1',
        conflicts: [{ table: 'sales', sync_id: 'x', reason: 'shortfall' }],
      })
      expect(notifsQ.add).toHaveBeenCalledWith(
        NOTIFICATION_JOB.SYNC_CONFLICT,
        expect.any(Object),
        expect.any(Object),
      )
    })
  })

  // ─── Queue stats ────────────────────────────────────────────────────────────

  describe('getQueueStats', () => {
    it('returns stats for all 4 queues', async () => {
      const stats = await service.getQueueStats()
      expect(stats).toHaveProperty('sync')
      expect(stats).toHaveProperty('billing')
      expect(stats).toHaveProperty('notifications')
      expect(stats).toHaveProperty('maintenance')
      expect(stats.sync).toMatchObject({
        waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0,
      })
    })
  })
})
