import { Test, TestingModule }              from '@nestjs/testing'
import { NotFoundException, ForbiddenException } from '@nestjs/common'
import { ProductsService }                   from '../products.service'
import { ProductsRepository }                from '../products.repository'
import { RedisService }                      from '@database/redis.service'
import { TENANT_ID, PRODUCT_ID, mockProduct } from '../../../test/helpers/fixtures'
import { mockRedis }                          from '../../../test/helpers/mock-prisma'

describe('ProductsService', () => {
  let service: ProductsService
  let repo:    jest.Mocked<ProductsRepository>
  let redis:   ReturnType<typeof mockRedis>

  beforeEach(async () => {
    repo = {
      findMany:       jest.fn().mockResolvedValue({ data: [], total: 0 }),
      findById:       jest.fn(),
      findByBarcode:  jest.fn(),
      create:         jest.fn().mockResolvedValue(mockProduct),
      update:         jest.fn().mockResolvedValue(mockProduct),
      setActive:      jest.fn().mockResolvedValue(mockProduct),
      softDelete:     jest.fn().mockResolvedValue(true),
      bulkSoftDelete: jest.fn().mockResolvedValue(3),
      countActive:    jest.fn().mockResolvedValue(0),
    } as any

    redis = mockRedis()

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: ProductsRepository, useValue: repo  },
        { provide: RedisService,        useValue: redis },
      ],
    }).compile()

    service = module.get(ProductsService)
  })

  afterEach(() => jest.clearAllMocks())

  // ─── Plan limits ────────────────────────────────────────────────────────────

  describe('create() — plan limits', () => {
    it('allows creation when under free plan limit (99 < 100)', async () => {
      redis.getJson.mockResolvedValue(99)
      await expect(service.create(TENANT_ID, 'free', { name: 'New' } as any)).resolves.toBeDefined()
    })

    it('blocks creation at free plan limit (100 >= 100)', async () => {
      redis.getJson.mockResolvedValue(100)
      await expect(service.create(TENANT_ID, 'free', { name: 'New' } as any))
        .rejects.toThrow(ForbiddenException)
    })

    it('error body contains PLAN_LIMIT_REACHED code', async () => {
      redis.getJson.mockResolvedValue(100)
      const err = await service.create(TENANT_ID, 'free', { name: 'X' } as any).catch(e => e)
      expect(err.response.code).toBe('PLAN_LIMIT_REACHED')
      expect(err.response.max).toBe(100)
    })

    it('pro/premium/super plans have no product limit', async () => {
      redis.getJson.mockResolvedValue(99999)
      for (const plan of ['pro', 'premium', 'super'] as const) {
        await expect(service.create(TENANT_ID, plan, { name: 'X' } as any)).resolves.toBeDefined()
      }
    })

    it('uses cached count and does NOT call repo.countActive', async () => {
      redis.getJson.mockResolvedValue(50)
      await service.create(TENANT_ID, 'free', { name: 'X' } as any)
      expect(repo.countActive).not.toHaveBeenCalled()
    })

    it('falls back to repo.countActive on cache miss', async () => {
      redis.getJson.mockResolvedValue(null)
      repo.countActive.mockResolvedValue(10)
      await service.create(TENANT_ID, 'free', { name: 'X' } as any)
      expect(repo.countActive).toHaveBeenCalledWith(TENANT_ID)
    })

    it('stores count in Redis after cache miss', async () => {
      redis.getJson.mockResolvedValue(null)
      repo.countActive.mockResolvedValue(10)
      await service.create(TENANT_ID, 'free', { name: 'X' } as any)
      expect(redis.setJson).toHaveBeenCalledWith(
        `limit:${TENANT_ID}:products`, 10, 30
      )
    })

    it('invalidates cache after successful create', async () => {
      redis.getJson.mockResolvedValue(50)
      await service.create(TENANT_ID, 'free', { name: 'X' } as any)
      expect(redis.del).toHaveBeenCalledWith(`limit:${TENANT_ID}:products`)
    })
  })

  // ─── getById ────────────────────────────────────────────────────────────────

  describe('getById()', () => {
    it('returns product when found', async () => {
      repo.findById.mockResolvedValue(mockProduct)
      await expect(service.getById(TENANT_ID, PRODUCT_ID)).resolves.toEqual(mockProduct)
    })

    it('throws NotFoundException when not found', async () => {
      repo.findById.mockResolvedValue(null)
      await expect(service.getById(TENANT_ID, 'missing')).rejects.toThrow(NotFoundException)
    })
  })

  // ─── getByBarcode ───────────────────────────────────────────────────────────

  describe('getByBarcode()', () => {
    it('returns product when barcode matches', async () => {
      repo.findByBarcode.mockResolvedValue(mockProduct)
      await expect(service.getByBarcode(TENANT_ID, '7501234567890')).resolves.toEqual(mockProduct)
    })

    it('throws NotFoundException when barcode not found', async () => {
      repo.findByBarcode.mockResolvedValue(null)
      await expect(service.getByBarcode(TENANT_ID, '0000000000000'))
        .rejects.toThrow(NotFoundException)
    })
  })

  // ─── update ─────────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('returns updated product', async () => {
      repo.update.mockResolvedValue({ ...mockProduct, name: 'Updated' })
      const result = await service.update(TENANT_ID, PRODUCT_ID, { name: 'Updated' })
      expect(result.name).toBe('Updated')
    })

    it('throws NotFoundException when product does not exist', async () => {
      repo.update.mockResolvedValue(null)
      await expect(service.update(TENANT_ID, 'missing', { name: 'X' }))
        .rejects.toThrow(NotFoundException)
    })
  })

  // ─── remove ─────────────────────────────────────────────────────────────────

  describe('remove()', () => {
    it('soft-deletes and invalidates cache', async () => {
      repo.softDelete.mockResolvedValue(true)
      await service.remove(TENANT_ID, PRODUCT_ID)
      expect(repo.softDelete).toHaveBeenCalledWith(TENANT_ID, PRODUCT_ID)
      expect(redis.del).toHaveBeenCalledWith(`limit:${TENANT_ID}:products`)
    })

    it('throws NotFoundException when product does not exist', async () => {
      repo.softDelete.mockResolvedValue(false)
      await expect(service.remove(TENANT_ID, 'missing')).rejects.toThrow(NotFoundException)
    })
  })

  // ─── bulkRemove ─────────────────────────────────────────────────────────────

  describe('bulkRemove()', () => {
    it('returns count of deleted products', async () => {
      repo.bulkSoftDelete.mockResolvedValue(3)
      const result = await service.bulkRemove(TENANT_ID, { ids: ['a', 'b', 'c'] })
      expect(result).toEqual({ deleted: 3 })
    })

    it('does NOT invalidate cache when nothing was deleted', async () => {
      repo.bulkSoftDelete.mockResolvedValue(0)
      await service.bulkRemove(TENANT_ID, { ids: ['missing'] })
      expect(redis.del).not.toHaveBeenCalled()
    })

    it('invalidates cache when at least one product deleted', async () => {
      repo.bulkSoftDelete.mockResolvedValue(2)
      await service.bulkRemove(TENANT_ID, { ids: ['a', 'b'] })
      expect(redis.del).toHaveBeenCalledWith(`limit:${TENANT_ID}:products`)
    })
  })
})
