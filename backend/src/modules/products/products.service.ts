import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common'
import { ProductsRepository }  from './products.repository'
import { RedisService }        from '@database/redis.service'
import type {
  CreateProductDto,
  UpdateProductDto,
  ProductQueryDto,
  SetActiveDto,
  BulkDeleteDto,
} from './dto/product.dto'
import type { PlanName } from '@common/types/jwt-payload'

const PLAN_MAX_PRODUCTS: Record<PlanName, number | null> = {
  free:    100,
  pro:     null,
  premium: null,
  super:   null,
}

// TTL corto: el contador puede cambiar frecuentemente
const COUNT_CACHE_TTL = 30  // segundos

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name)

  constructor(
    private repo:  ProductsRepository,
    private redis: RedisService,
  ) {}

  // ─── Queries ──────────────────────────────────────────────────────────────

  async list(tenantId: string, query: ProductQueryDto) {
    return this.repo.findMany(tenantId, query)
  }

  async getById(tenantId: string, id: string) {
    const product = await this.repo.findById(tenantId, id)
    if (!product) throw new NotFoundException(`Product ${id} not found`)
    return product
  }

  async getByBarcode(tenantId: string, barcode: string) {
    const product = await this.repo.findByBarcode(tenantId, barcode)
    if (!product) throw new NotFoundException(`No product with barcode '${barcode}'`)
    return product
  }

  // ─── Mutations ────────────────────────────────────────────────────────────

  async create(tenantId: string, plan: PlanName, data: CreateProductDto) {
    await this.assertPlanLimit(tenantId, plan)

    const product = await this.repo.create(tenantId, data)
    await this.invalidateCount(tenantId)

    this.logger.log({ tenantId, productId: product.id }, 'Product created')
    return product
  }

  async update(tenantId: string, id: string, data: UpdateProductDto) {
    const product = await this.repo.update(tenantId, id, data)
    if (!product) throw new NotFoundException(`Product ${id} not found`)
    return product
  }

  async setActive(tenantId: string, id: string, dto: SetActiveDto) {
    const product = await this.repo.setActive(tenantId, id, dto.is_active)
    if (!product) throw new NotFoundException(`Product ${id} not found`)
    return product
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const deleted = await this.repo.softDelete(tenantId, id)
    if (!deleted) throw new NotFoundException(`Product ${id} not found`)
    await this.invalidateCount(tenantId)
    this.logger.log({ tenantId, productId: id }, 'Product deleted')
  }

  async bulkRemove(tenantId: string, dto: BulkDeleteDto): Promise<{ deleted: number }> {
    const count = await this.repo.bulkSoftDelete(tenantId, dto.ids)
    if (count > 0) await this.invalidateCount(tenantId)
    this.logger.log({ tenantId, count }, 'Bulk products deleted')
    return { deleted: count }
  }

  // ─── Plan limits ──────────────────────────────────────────────────────────

  private async assertPlanLimit(tenantId: string, plan: PlanName): Promise<void> {
    const max = PLAN_MAX_PRODUCTS[plan]
    if (max === null) return

    const count = await this.getCount(tenantId)
    if (count >= max) {
      throw new ForbiddenException({
        code:    'PLAN_LIMIT_REACHED',
        message: `Plan '${plan}' allows max ${max} products. Upgrade to add more.`,
        current: count,
        max,
      })
    }
  }

  private async getCount(tenantId: string): Promise<number> {
    const key    = `limit:${tenantId}:products`
    const cached = await this.redis.getJson<number>(key)
    if (cached !== null) return cached

    const count = await this.repo.countActive(tenantId)
    await this.redis.setJson(key, count, COUNT_CACHE_TTL)
    return count
  }

  private async invalidateCount(tenantId: string): Promise<void> {
    await this.redis.del(`limit:${tenantId}:products`)
  }
}
