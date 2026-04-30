import { Test }                    from '@nestjs/testing'
import { BadRequestException }       from '@nestjs/common'
import { SyncService }               from '../sync.service'
import { SyncRepository }            from '../sync.repository'
import type { PullRequestDto, PushRequestDto } from '../dto/sync.dto'

const TENANT   = 'aaaaaaaa-0000-0000-0000-000000000001'
const USER     = 'bbbbbbbb-0000-0000-0000-000000000001'
const DEVICE   = 'desktop-001'
const SYNC_ID  = 'cccccccc-0000-0000-0000-000000000001'
const PROD_ID  = 'dddddddd-0000-0000-0000-000000000001'
const BRANCH   = 'eeeeeeee-0000-0000-0000-000000000001'

const mockProductRow = { id: PROD_ID, name: 'Remera', sync_version: 100, deleted_at: null }

describe('SyncService', () => {
  let service: SyncService
  let repo:    jest.Mocked<SyncRepository>

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        SyncService,
        {
          provide: SyncRepository,
          useValue: {
            pullTable:            jest.fn(),
            upsertCursor:         jest.fn(),
            getCursors:           jest.fn(),
            getAllHeads:           jest.fn(),
            applyOfflineSale:     jest.fn(),
            applyCustomerInsert:  jest.fn(),
            applyCustomerUpdate:  jest.fn(),
            applyCustomerDelete:  jest.fn(),
          },
        },
      ],
    }).compile()

    service = module.get(SyncService)
    repo    = module.get(SyncRepository)
  })

  // ─── pull ──────────────────────────────────────────────────────────────────

  describe('pull', () => {
    it('returns rows and cursor for each requested table', async () => {
      repo.pullTable.mockResolvedValue({ rows: [mockProductRow as any], maxVersion: 100, hasMore: false })
      repo.upsertCursor.mockResolvedValue()

      const dto: PullRequestDto = {
        device_id: DEVICE,
        tables:    ['products'],
        cursors:   { products: 0 },
        page_size: 500,
      }

      const result = await service.pull(TENANT, USER, dto)

      expect(result.tables.products?.rows).toHaveLength(1)
      expect(result.tables.products?.cursor).toBe(100)
      expect(result.tables.products?.has_more).toBe(false)
      expect(repo.upsertCursor).toHaveBeenCalledWith(TENANT, DEVICE, 'products', 100)
    })

    it('does not update cursor when no rows returned', async () => {
      repo.pullTable.mockResolvedValue({ rows: [], maxVersion: 0, hasMore: false })

      await service.pull(TENANT, USER, {
        device_id: DEVICE, cursors: {}, page_size: 500,
        tables: ['products'],
      })

      expect(repo.upsertCursor).not.toHaveBeenCalled()
    })

    it('pulls all tables when no tables filter provided', async () => {
      repo.pullTable.mockResolvedValue({ rows: [], maxVersion: 0, hasMore: false })

      const dto: PullRequestDto = { device_id: DEVICE, cursors: {}, page_size: 500 }
      await service.pull(TENANT, USER, dto)

      // Should have called pullTable once per syncable table
      expect(repo.pullTable.mock.calls.length).toBe(9) // SYNCABLE_TABLES.length
    })
  })

  // ─── push — sale ───────────────────────────────────────────────────────────

  describe('push — sales', () => {
    const salePayload = {
      branch_id: BRANCH, cashier_id: USER,
      subtotal: 5000, discount: 0, tax: 1050, total: 6050,
      payment_method: 'cash', payment_details: {},
      items: [{
        sync_id: 'ffffffff-0000-0000-0000-000000000001',
        product_id: PROD_ID, product_name: 'Remera',
        quantity: 1, unit_price: 5000, discount: 0, subtotal: 5000,
      }],
    }

    it('applies new offline sale', async () => {
      repo.applyOfflineSale.mockResolvedValue({
        saleId: 'sale-id', isNew: true, shortfalls: [],
      })

      const dto: PushRequestDto = {
        device_id: DEVICE,
        changes: [{ table: 'sales', operation: 'INSERT', sync_id: SYNC_ID, base_version: 0, payload: salePayload }],
      }

      const result = await service.push(TENANT, USER, dto)
      expect(result.results[0].status).toBe('applied')
      expect(result.applied).toBe(1)
    })

    it('returns skipped for already-applied sale (idempotent)', async () => {
      repo.applyOfflineSale.mockResolvedValue({
        saleId: 'existing-id', isNew: false, shortfalls: [],
      })

      const dto: PushRequestDto = {
        device_id: DEVICE,
        changes: [{ table: 'sales', operation: 'INSERT', sync_id: SYNC_ID, base_version: 0, payload: salePayload }],
      }

      const result = await service.push(TENANT, USER, dto)
      expect(result.results[0].status).toBe('skipped')
      expect(result.skipped).toBe(1)
    })

    it('returns conflict status when stock insufficient', async () => {
      repo.applyOfflineSale.mockResolvedValue({
        saleId:     'sale-id',
        isNew:      true,
        shortfalls: [{ product_id: PROD_ID, requested: 5, available: 2 }],
      })

      const dto: PushRequestDto = {
        device_id: DEVICE,
        changes: [{ table: 'sales', operation: 'INSERT', sync_id: SYNC_ID, base_version: 0, payload: salePayload }],
      }

      const result = await service.push(TENANT, USER, dto)
      expect(result.results[0].status).toBe('conflict')
      expect(result.conflicts).toBe(1)
    })

    it('returns error for invalid sale payload', async () => {
      const dto: PushRequestDto = {
        device_id: DEVICE,
        changes: [{
          table: 'sales', operation: 'INSERT', sync_id: SYNC_ID, base_version: 0,
          payload: { branch_id: 'not-a-uuid' },  // invalid
        }],
      }

      const result = await service.push(TENANT, USER, dto)
      expect(result.results[0].status).toBe('error')
      expect(repo.applyOfflineSale).not.toHaveBeenCalled()
    })
  })

  // ─── push — customers ──────────────────────────────────────────────────────

  describe('push — customers', () => {
    it('applies customer INSERT', async () => {
      repo.applyCustomerInsert.mockResolvedValue({ id: 'cust-id', syncVersion: 200, isNew: true })

      const dto: PushRequestDto = {
        device_id: DEVICE,
        changes: [{
          table: 'customers', operation: 'INSERT', sync_id: SYNC_ID, base_version: 0,
          payload: { first_name: 'Ana', last_name: 'García' },
        }],
      }

      const result = await service.push(TENANT, USER, dto)
      expect(result.results[0].status).toBe('applied')
    })

    it('returns conflict on UPDATE when server version advanced', async () => {
      repo.applyCustomerUpdate.mockResolvedValue({
        id: 'cust-id', syncVersion: 300, conflict: true, serverRow: { first_name: 'Server' },
      })

      const dto: PushRequestDto = {
        device_id: DEVICE,
        changes: [{
          table: 'customers', operation: 'UPDATE', sync_id: SYNC_ID, base_version: 150,
          payload: { first_name: 'Client' },
        }],
      }

      const result = await service.push(TENANT, USER, dto)
      expect(result.results[0].status).toBe('conflict')
      expect(result.results[0].conflict?.server_row).toMatchObject({ first_name: 'Server' })
    })
  })

  // ─── push — rejected tables ────────────────────────────────────────────────

  describe('push — rejected tables', () => {
    it('rejects push to read-only table via DTO validation', () => {
      // Zod enum will reject 'products' before reaching service
      const schema = require('../dto/sync.dto').PushRequestSchema
      const result = schema.safeParse({
        device_id: DEVICE,
        changes: [{ table: 'products', operation: 'INSERT', sync_id: SYNC_ID, base_version: 0, payload: {} }],
      })
      expect(result.success).toBe(false)
    })
  })

  // ─── status ────────────────────────────────────────────────────────────────

  describe('getStatus', () => {
    it('returns cursors, server heads and behind delta', async () => {
      repo.getCursors.mockResolvedValue({ products: 50, sales: 30 })
      repo.getAllHeads.mockResolvedValue({ products: 100, sales: 30, customers: 0 } as any)

      const status = await service.getStatus(TENANT, DEVICE)

      expect(status.cursors).toEqual({ products: 50, sales: 30 })
      expect(status.server_heads.products).toBe(100)
      expect(status.behind.products).toBe(50)
      expect(status.behind.sales).toBeUndefined()  // not behind
    })
  })
})
