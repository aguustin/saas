import { Test, TestingModule }          from '@nestjs/testing'
import {
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { SalesService }                  from '../sales.service'
import { SalesRepository, InsufficientStockError } from '../sales.repository'
import {
  TENANT_ID, BRANCH_ID, USER_ID, PRODUCT_ID, SALE_ID,
  mockSale, mockDailySummary,
} from '../../../test/helpers/fixtures'
import type { CreateSaleDto } from '../dto/sale.dto'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeItem = (overrides: Partial<{ product_id: string; quantity: number; unit_price: number; discount: number }> = {}) => ({
  product_id: PRODUCT_ID,
  quantity:   2,
  unit_price: 100,
  discount:   0,
  ...overrides,
})

const makeDto = (overrides: Partial<CreateSaleDto> = {}): CreateSaleDto => ({
  branch_id:         BRANCH_ID,
  payment_method:    'cash',
  items:             [makeItem()],
  discount:          0,
  client_created_at: new Date().toISOString(),
  ...overrides,
} as CreateSaleDto)

const makeStockCheck = (available = 10, product_id = PRODUCT_ID) => ({
  product_id,
  product_name: 'Widget Pro',
  available,
  requested: 2,
})

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('SalesService', () => {
  let service: SalesService
  let repo:    jest.Mocked<SalesRepository>

  beforeEach(async () => {
    repo = {
      checkStock:            jest.fn(),
      createWithTransaction: jest.fn(),
      findById:              jest.fn(),
      findMany:              jest.fn(),
      refundSale:            jest.fn(),
      getDailySummary:       jest.fn(),
    } as any

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesService,
        { provide: SalesRepository, useValue: repo },
      ],
    }).compile()

    service = module.get(SalesService)
  })

  afterEach(() => jest.clearAllMocks())

  // ─── create ─────────────────────────────────────────────────────────────────

  describe('create()', () => {
    beforeEach(() => {
      repo.checkStock.mockResolvedValue([makeStockCheck()])
      repo.createWithTransaction.mockResolvedValue({ ...mockSale, total: 242 })
    })

    it('creates a sale and returns the result', async () => {
      const result = await service.create(TENANT_ID, USER_ID, makeDto())
      expect(repo.createWithTransaction).toHaveBeenCalledTimes(1)
      expect(result).toHaveProperty('id')
    })

    it('calculates totals: subtotal=200, discount=0, tax=42, total=242', async () => {
      await service.create(TENANT_ID, USER_ID, makeDto())
      const call = repo.createWithTransaction.mock.calls[0][0]
      expect(call.totals).toEqual({ subtotal: 200, discount: 0, tax: 42, total: 242 })
    })

    it('applies global discount before tax', async () => {
      await service.create(TENANT_ID, USER_ID, makeDto({ discount: 20 }))
      const { totals } = repo.createWithTransaction.mock.calls[0][0]
      // net = 200-20 = 180; tax = 180*0.21 = 37.80; total = 217.80
      expect(totals.discount).toBe(20)
      expect(totals.tax).toBeCloseTo(37.80)
      expect(totals.total).toBeCloseTo(217.80)
    })

    it('throws UnprocessableEntityException when stock insufficient', async () => {
      repo.checkStock.mockResolvedValue([makeStockCheck(1)])  // 1 available, 2 requested
      await expect(service.create(TENANT_ID, USER_ID, makeDto()))
        .rejects.toThrow(UnprocessableEntityException)
    })

    it('error body contains INSUFFICIENT_STOCK code and details', async () => {
      repo.checkStock.mockResolvedValue([makeStockCheck(0)])
      const err = await service.create(TENANT_ID, USER_ID, makeDto()).catch(e => e)
      expect(err.response.code).toBe('INSUFFICIENT_STOCK')
      expect(err.response.details).toHaveLength(1)
      expect(err.response.details[0].product_id).toBe(PRODUCT_ID)
    })

    it('throws BadRequestException on duplicate product_id in items', async () => {
      const dto = makeDto({ items: [makeItem(), makeItem()] })
      await expect(service.create(TENANT_ID, USER_ID, dto))
        .rejects.toThrow(BadRequestException)
    })

    it('wraps InsufficientStockError as STOCK_RACE_CONDITION', async () => {
      repo.createWithTransaction.mockRejectedValue(
        new InsufficientStockError(PRODUCT_ID, 'Widget Pro')
      )
      const err = await service.create(TENANT_ID, USER_ID, makeDto()).catch(e => e)
      expect(err).toBeInstanceOf(UnprocessableEntityException)
      expect(err.response.code).toBe('STOCK_RACE_CONDITION')
      expect(err.response.product_id).toBe(PRODUCT_ID)
    })

    it('re-throws unknown errors from createWithTransaction', async () => {
      repo.createWithTransaction.mockRejectedValue(new Error('DB exploded'))
      await expect(service.create(TENANT_ID, USER_ID, makeDto()))
        .rejects.toThrow('DB exploded')
    })

    describe('mixed payment', () => {
      it('accepts valid breakdown that sums to total', async () => {
        repo.checkStock.mockResolvedValue([makeStockCheck()])
        const dto = makeDto({
          payment_method:  'mixed',
          payment_details: {
            mixed_breakdown: [{ method: 'cash', amount: 100 }, { method: 'card', amount: 142 }],
          },
        })
        await expect(service.create(TENANT_ID, USER_ID, dto)).resolves.toBeDefined()
      })

      it('rejects breakdown that does not sum to total', async () => {
        const dto = makeDto({
          payment_method:  'mixed',
          payment_details: { mixed_breakdown: [{ method: 'cash', amount: 50 }] },
        })
        await expect(service.create(TENANT_ID, USER_ID, dto))
          .rejects.toThrow(BadRequestException)
      })

      it('tolerates $0.01 floating-point rounding', async () => {
        repo.checkStock.mockResolvedValue([makeStockCheck()])
        const dto = makeDto({
          payment_method:  'mixed',
          payment_details: {
            mixed_breakdown: [{ method: 'cash', amount: 100.005 }, { method: 'card', amount: 141.995 }],
          },
        })
        await expect(service.create(TENANT_ID, USER_ID, dto)).resolves.toBeDefined()
      })
    })
  })

  // ─── refund ─────────────────────────────────────────────────────────────────

  describe('refund()', () => {
    const dto = { reason: 'Customer returned', restock: true }

    it('refunds a completed sale', async () => {
      repo.findById.mockResolvedValue({ ...mockSale, status: 'completed' })
      repo.refundSale.mockResolvedValue({ ...mockSale, status: 'refunded' })

      const result = await service.refund(TENANT_ID, SALE_ID, USER_ID, dto)
      expect(result.status).toBe('refunded')
      expect(repo.refundSale).toHaveBeenCalledWith(
        TENANT_ID, SALE_ID, dto.reason, USER_ID, true, undefined
      )
    })

    it('throws NotFoundException when sale does not exist', async () => {
      repo.findById.mockResolvedValue(null)
      await expect(service.refund(TENANT_ID, SALE_ID, USER_ID, dto))
        .rejects.toThrow(NotFoundException)
    })

    it('throws BadRequestException when sale already refunded', async () => {
      repo.findById.mockResolvedValue({ ...mockSale, status: 'refunded' })
      await expect(service.refund(TENANT_ID, SALE_ID, USER_ID, dto))
        .rejects.toThrow(BadRequestException)
    })

    it('throws BadRequestException when sale is cancelled', async () => {
      repo.findById.mockResolvedValue({ ...mockSale, status: 'cancelled' })
      await expect(service.refund(TENANT_ID, SALE_ID, USER_ID, dto))
        .rejects.toThrow(BadRequestException)
    })

    it('rejects partial refund with invalid sale_item_id', async () => {
      repo.findById.mockResolvedValue({ ...mockSale, status: 'completed' })
      await expect(
        service.refund(TENANT_ID, SALE_ID, USER_ID, {
          ...dto,
          items: [{ sale_item_id: 'nonexistent-id', quantity: 1 }],
        })
      ).rejects.toThrow(BadRequestException)
    })

    it('passes partial refund item ids to repo', async () => {
      repo.findById.mockResolvedValue({ ...mockSale, status: 'completed' })
      repo.refundSale.mockResolvedValue({ ...mockSale, status: 'refunded' })

      await service.refund(TENANT_ID, SALE_ID, USER_ID, {
        ...dto,
        items: [{ sale_item_id: 'item-001', quantity: 1 }],
      })
      expect(repo.refundSale).toHaveBeenCalledWith(
        TENANT_ID, SALE_ID, dto.reason, USER_ID, true, ['item-001']
      )
    })
  })

  // ─── getById ────────────────────────────────────────────────────────────────

  describe('getById()', () => {
    it('returns sale when found', async () => {
      repo.findById.mockResolvedValue(mockSale)
      await expect(service.getById(TENANT_ID, SALE_ID)).resolves.toEqual(mockSale)
    })

    it('throws NotFoundException when not found', async () => {
      repo.findById.mockResolvedValue(null)
      await expect(service.getById(TENANT_ID, 'bad-id')).rejects.toThrow(NotFoundException)
    })
  })

  // ─── getDailySummary ────────────────────────────────────────────────────────

  describe('getDailySummary()', () => {
    it('uses today when date not provided', async () => {
      repo.getDailySummary.mockResolvedValue(mockDailySummary)
      const today = new Date().toISOString().split('T')[0]
      await service.getDailySummary(TENANT_ID, BRANCH_ID)
      expect(repo.getDailySummary).toHaveBeenCalledWith(TENANT_ID, BRANCH_ID, today)
    })

    it('passes explicit date to repo', async () => {
      repo.getDailySummary.mockResolvedValue(mockDailySummary)
      await service.getDailySummary(TENANT_ID, BRANCH_ID, '2024-12-25')
      expect(repo.getDailySummary).toHaveBeenCalledWith(TENANT_ID, BRANCH_ID, '2024-12-25')
    })
  })
})
