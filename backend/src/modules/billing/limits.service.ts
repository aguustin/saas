import { Injectable, ForbiddenException, Logger } from '@nestjs/common'
import { PrismaService }        from '@database/prisma.service'
import { PrismaTenantService }  from '@database/prisma-tenant.service'
import { RedisService }         from '@database/redis.service'
import type { LimitsDto, ResourceLimit } from './dto/billing.dto'

type ResourceKey = 'products' | 'branches' | 'users' | 'employees'

const CACHE_TTL = 30  // seconds
const TABLE_MAP: Record<ResourceKey, string> = {
  products:  'products',
  branches:  'branches',
  users:     'users',
  employees: 'employees',
}

@Injectable()
export class LimitsService {
  private readonly logger = new Logger(LimitsService.name)

  constructor(
    private readonly prisma:       PrismaService,
    private readonly tenantPrisma: PrismaTenantService,
    private readonly redis:        RedisService,
  ) {}

  // ─── Full limits snapshot ─────────────────────────────────────────────────

  async getLimits(tenantId: string): Promise<LimitsDto> {
    const tenant = await this.prisma.tenant.findUnique({
      where:   { id: tenantId },
      include: { plan: true },
    })
    if (!tenant) throw new Error(`Tenant ${tenantId} not found`)

    const plan = tenant.plan

    const [products, branches, users, employees] = await Promise.all([
      this.getCount(tenantId, 'products'),
      this.getCount(tenantId, 'branches'),
      this.getCount(tenantId, 'users'),
      this.getCount(tenantId, 'employees'),
    ])

    const build = (current: number, max: number | null): ResourceLimit => ({
      current,
      max,
      pct:     max !== null ? Math.round((current / max) * 100) : null,
      blocked: max !== null && current >= max,
    })

    return {
      plan_name: plan.name,
      resources: {
        products:  build(products,  plan.maxProducts  ?? null),
        branches:  build(branches,  plan.maxBranches  ?? null),
        users:     build(users,     plan.maxUsers     ?? null),
        employees: build(employees, plan.maxEmployees ?? null),
      },
      features: {
        sync_enabled:    plan.syncEnabled,
        analytics_level: plan.analyticsLevel,
        api_access:      plan.apiAccess,
      },
    }
  }

  // ─── Enforcement (called from feature services) ───────────────────────────

  async assertCanCreate(tenantId: string, resource: ResourceKey): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({
      where:   { id: tenantId },
      include: { plan: true },
    })
    if (!tenant) return

    const max = this.getMax(tenant.plan, resource)
    if (max === null) return  // unlimited

    const current = await this.getCount(tenantId, resource)
    if (current >= max) {
      throw new ForbiddenException({
        code:    'PLAN_LIMIT_REACHED',
        message: `Your plan allows up to ${max} ${resource}. Upgrade to add more.`,
        resource,
        current,
        max,
      })
    }
  }

  // ─── Cache management ─────────────────────────────────────────────────────

  async invalidate(tenantId: string, resource: ResourceKey): Promise<void> {
    await this.redis.del(this.cacheKey(tenantId, resource))
  }

  async invalidateAll(tenantId: string): Promise<void> {
    await Promise.all(
      (Object.keys(TABLE_MAP) as ResourceKey[]).map(r => this.invalidate(tenantId, r))
    )
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private async getCount(tenantId: string, resource: ResourceKey): Promise<number> {
    const key    = this.cacheKey(tenantId, resource)
    const cached = await this.redis.getJson<number>(key)
    if (cached !== null) return cached

    const table  = TABLE_MAP[resource]
    const schema = this.tenantPrisma.tenantSchema(tenantId).replace(/"/g, '')

    const deletedCond = ['users'].includes(table)
      ? ''               // users has no deleted_at
      : 'AND deleted_at IS NULL'

    const [{ count }] = await this.tenantPrisma.$queryRawUnsafe<Array<{ count: number }>>(
      `SELECT COUNT(*)::int AS count FROM "${schema}"."${table}" WHERE is_active = true ${deletedCond}`
    )

    await this.redis.setJson(key, count, CACHE_TTL)
    return count
  }

  private getMax(plan: any, resource: ResourceKey): number | null {
    const map: Record<ResourceKey, string> = {
      products:  'maxProducts',
      branches:  'maxBranches',
      users:     'maxUsers',
      employees: 'maxEmployees',
    }
    return plan[map[resource]] ?? null
  }

  private cacheKey(tenantId: string, resource: ResourceKey): string {
    return `limit:${tenantId}:${resource}`
  }
}
