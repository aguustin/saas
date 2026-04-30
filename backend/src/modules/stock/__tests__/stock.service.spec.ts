import { Test }                                 from '@nestjs/testing'
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common'
import { StockService }                           from '../stock.service'
import { StockRepository, InsufficientTransferStockError } from '../stock.repository'
import type { AddStockDto, AdjustStockDto, TransferStockDto, SetMinStockDto } from '../dto/stock.dto'

const TENANT_ID   = 'aaaaaaaa-0000-0000-0000-000000000001'
const USER_ID     = 'bbbbbbbb-0000-0000-0000-000000000001'
const BRANCH_A    = 'cccccccc-0000-0000-0000-000000000001'
const BRANCH_B    = 'cccccccc-0000-0000-0000-000000000002'
const PRODUCT_ID  = 'dddddddd-0000-0000-0000-000000000001'

const mockStockRow = {
  stock_id:     'eeeeeeee-0000-0000-0000-000000000001',
  product_id:   PRODUCT_ID,
  product_name: 'Remera',
  product_sku:  'REM-001',
  branch_id:    BRANCH_A,
  branch_name:  'Sucursal A',
  quantity:     10,
  min_quantity: 2,
  is_low:       false,
  sync_version: 1,
  updated_at:   new Date().toISOString(),
}

describe('StockService', () => {
  let service: StockService
  let repo:    jest.Mocked<StockRepository>

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        StockService,
        {
          provide: StockRepository,
          useValue: {
            findStock:          jest.fn(),
            findStockByProduct: jest.fn(),
            getAlerts:          jest.fn(),
            findMovements:      jest.fn(),
            upsertAndAdd:       jest.fn(),
            adjust:             jest.fn(),
            transfer:           jest.fn(),
            setMinQuantity:     jest.fn(),
          },
        },
      ],
    }).compile()

    service = module.get(StockService)
    repo    = module.get(StockRepository)
  })

  // ─── list ──────────────────────────────────────────────────────────────────

  describe('list', () => {
    it('delegates to repo.findStock', async () => {
      const expected = { items: [mockStockRow], total: 1, limit: 50, offset: 0 }
      repo.findStock.mockResolvedValue(expected)

      const result = await service.list(TENANT_ID, { limit: 50, offset: 0, low_stock_only: false })
      expect(result).toEqual(expected)
      expect(repo.findStock).toHaveBeenCalledWith(TENANT_ID, expect.any(Object))
    })
  })

  // ─── addStock ──────────────────────────────────────────────────────────────

  describe('addStock', () => {
    it('calls upsertAndAdd with correct params', async () => {
      repo.upsertAndAdd.mockResolvedValue(mockStockRow)

      const dto: AddStockDto = {
        product_id: PRODUCT_ID,
        branch_id:  BRANCH_A,
        quantity:   5,
        type:       'purchase',
        note:       'Compra inicial',
        unit_cost:  1000,
        reference_id: null,
      }

      const result = await service.addStock(TENANT_ID, USER_ID, dto)
      expect(result).toEqual(mockStockRow)
      expect(repo.upsertAndAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId:  TENANT_ID,
          productId: PRODUCT_ID,
          branchId:  BRANCH_A,
          quantity:  5,
          type:      'purchase',
          createdBy: USER_ID,
        })
      )
    })
  })

  // ─── adjustStock ───────────────────────────────────────────────────────────

  describe('adjustStock', () => {
    it('calls adjust and returns result', async () => {
      repo.adjust.mockResolvedValue({ stock: mockStockRow, delta: 5 })

      const dto: AdjustStockDto = {
        product_id:   PRODUCT_ID,
        branch_id:    BRANCH_A,
        new_quantity: 15,
        note:         'Conteo físico',
      }

      const result = await service.adjustStock(TENANT_ID, USER_ID, dto)
      expect(result.delta).toBe(5)
      expect(repo.adjust).toHaveBeenCalledWith(
        expect.objectContaining({ newQuantity: 15, note: 'Conteo físico' })
      )
    })
  })

  // ─── transferStock ─────────────────────────────────────────────────────────

  describe('transferStock', () => {
    it('transfers stock between branches', async () => {
      const fromRow = { ...mockStockRow, quantity: 5 }
      const toRow   = { ...mockStockRow, branch_id: BRANCH_B, quantity: 5 }
      repo.transfer.mockResolvedValue({ from: fromRow, to: toRow })

      const dto: TransferStockDto = {
        product_id:    PRODUCT_ID,
        from_branch_id: BRANCH_A,
        to_branch_id:   BRANCH_B,
        quantity:       5,
        note:           null,
      }

      const result = await service.transferStock(TENANT_ID, USER_ID, dto)
      expect(result.from.quantity).toBe(5)
      expect(result.to.branch_id).toBe(BRANCH_B)
    })

    it('wraps InsufficientTransferStockError as UnprocessableEntityException', async () => {
      repo.transfer.mockRejectedValue(new InsufficientTransferStockError(3, 10))

      const dto: TransferStockDto = {
        product_id:    PRODUCT_ID,
        from_branch_id: BRANCH_A,
        to_branch_id:   BRANCH_B,
        quantity:       10,
        note:           null,
      }

      const err = await service.transferStock(TENANT_ID, USER_ID, dto).catch(e => e)
      expect(err).toBeInstanceOf(UnprocessableEntityException)
      expect(err.response.code).toBe('INSUFFICIENT_TRANSFER_STOCK')
      expect(err.response.available).toBe(3)
    })
  })

  // ─── setMinStock ───────────────────────────────────────────────────────────

  describe('setMinStock', () => {
    it('returns updated stock row', async () => {
      repo.setMinQuantity.mockResolvedValue({ ...mockStockRow, min_quantity: 5 })

      const dto: SetMinStockDto = {
        product_id:   PRODUCT_ID,
        branch_id:    BRANCH_A,
        min_quantity: 5,
      }

      const result = await service.setMinStock(TENANT_ID, dto)
      expect(result.min_quantity).toBe(5)
    })

    it('throws NotFoundException when stock record does not exist', async () => {
      repo.setMinQuantity.mockResolvedValue(null)

      await expect(
        service.setMinStock(TENANT_ID, {
          product_id:   PRODUCT_ID,
          branch_id:    BRANCH_A,
          min_quantity: 5,
        })
      ).rejects.toThrow(NotFoundException)
    })
  })

  // ─── getAlerts ─────────────────────────────────────────────────────────────

  describe('getAlerts', () => {
    it('returns low stock alerts', async () => {
      const alert = {
        product_id:   PRODUCT_ID,
        product_name: 'Remera',
        product_sku:  null,
        branch_id:    BRANCH_A,
        branch_name:  'Sucursal A',
        quantity:     1,
        min_quantity: 5,
        deficit:      4,
      }
      repo.getAlerts.mockResolvedValue([alert])

      const result = await service.getAlerts(TENANT_ID, BRANCH_A)
      expect(result).toHaveLength(1)
      expect(result[0].deficit).toBe(4)
    })
  })
})
