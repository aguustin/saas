import { Injectable, Logger, ConflictException } from '@nestjs/common'
import { PrismaService }          from '@database/prisma.service'
import { RedisService }           from '@database/redis.service'
import { TenantMigrationRunner }  from '@database/tenant-migration.runner'
import { Tenant }                 from '@prisma/client'

const TENANT_CACHE_TTL = 300  // 5 minutos

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name)

  constructor(
    private prisma:    PrismaService,
    private redis:     RedisService,
    private migRunner: TenantMigrationRunner,
  ) {}

  async findActiveById(tenantId: string): Promise<Tenant | null> {
    const cacheKey = `tenant:${tenantId}`
    const cached   = await this.redis.getJson<Tenant>(cacheKey)

    if (cached) return cached

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    })

    if (tenant) {
      await this.redis.setJson(cacheKey, tenant, TENANT_CACHE_TTL)
    }

    return tenant
  }

  async findBySlug(slug: string): Promise<Tenant | null> {
    return this.prisma.tenant.findUnique({ where: { slug } })
  }

  async create(data: {
    name:    string
    email:   string
    slug:    string
    country?: string
  }): Promise<Tenant> {
    const freePlan = await this.prisma.plan.findUnique({ where: { name: 'free' } })
    if (!freePlan) throw new Error('Free plan not found — run seeds first')

    const existing = await this.prisma.tenant.findFirst({
      where: { OR: [{ email: data.email }, { slug: data.slug }] },
    })
    if (existing) throw new ConflictException('Email or slug already in use')

    const tenant = await this.prisma.tenant.create({
      data: {
        name:         data.name,
        email:        data.email,
        slug:         data.slug,
        country:      data.country ?? 'AR',
        planId:       freePlan.id,
        status:       'trial',
        trialEndsAt:  new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),  // 14 días
      },
    })

    // Crear schema PostgreSQL + todas las tablas del tenant
    await this.migRunner.run(tenant.id)
    this.logger.log({ tenantId: tenant.id, slug: tenant.slug }, 'Tenant created')

    return tenant
  }

  async invalidateCache(tenantId: string): Promise<void> {
    await this.redis.del(`tenant:${tenantId}`)
  }

  // ─── Schema management ──────────────────────────────────────────────────

  async runTenantMigrations(schema: string): Promise<void> {
    // Todas las tablas tenant-scoped se crean aquí.
    // Se ejecuta también al aplicar nuevas migraciones (runner externo).
    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${schema}".branches (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name        TEXT NOT NULL,
        address     TEXT,
        phone       TEXT,
        is_active   BOOLEAN DEFAULT true,
        created_at  TIMESTAMPTZ DEFAULT now(),
        updated_at  TIMESTAMPTZ DEFAULT now(),
        deleted_at  TIMESTAMPTZ,
        sync_id     UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
        sync_version BIGINT NOT NULL DEFAULT 0
      )
    `)

    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${schema}".users (
        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email          TEXT NOT NULL UNIQUE,
        password_hash  TEXT NOT NULL,
        role           TEXT NOT NULL CHECK (role IN ('owner','admin','manager','cashier')),
        branch_id      UUID REFERENCES "${schema}".branches(id),
        is_active      BOOLEAN DEFAULT true,
        last_login_at  TIMESTAMPTZ,
        created_at     TIMESTAMPTZ DEFAULT now(),
        updated_at     TIMESTAMPTZ DEFAULT now()
      )
    `)

    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${schema}".products (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name          TEXT NOT NULL,
        sku           TEXT,
        barcode       TEXT,
        price         NUMERIC(12,2) NOT NULL,
        cost          NUMERIC(12,2),
        tax_rate      NUMERIC(5,4) DEFAULT 0.21,
        category_id   UUID,
        attributes    JSONB DEFAULT '{}',
        is_active     BOOLEAN DEFAULT true,
        created_at    TIMESTAMPTZ DEFAULT now(),
        updated_at    TIMESTAMPTZ DEFAULT now(),
        deleted_at    TIMESTAMPTZ,
        sync_id       UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
        sync_version  BIGINT NOT NULL DEFAULT 0
      )
    `)

    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${schema}".stock (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id    UUID NOT NULL REFERENCES "${schema}".products(id),
        branch_id     UUID NOT NULL REFERENCES "${schema}".branches(id),
        quantity      NUMERIC(12,3) NOT NULL DEFAULT 0
                        CHECK (quantity >= 0),
        min_quantity  NUMERIC(12,3) DEFAULT 0,
        updated_at    TIMESTAMPTZ DEFAULT now(),
        sync_id       UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
        sync_version  BIGINT NOT NULL DEFAULT 0,
        UNIQUE (product_id, branch_id)
      )
    `)

    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${schema}".sales (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        branch_id       UUID NOT NULL REFERENCES "${schema}".branches(id),
        customer_id     UUID,
        cashier_id      UUID REFERENCES "${schema}".users(id),
        status          TEXT NOT NULL DEFAULT 'completed'
                          CHECK (status IN ('pending','completed','cancelled','refunded')),
        subtotal        NUMERIC(12,2) NOT NULL,
        discount        NUMERIC(12,2) DEFAULT 0,
        tax             NUMERIC(12,2) DEFAULT 0,
        total           NUMERIC(12,2) NOT NULL,
        payment_method  TEXT NOT NULL,
        payment_details JSONB DEFAULT '{}',
        notes           TEXT,
        created_at      TIMESTAMPTZ DEFAULT now(),
        updated_at      TIMESTAMPTZ DEFAULT now(),
        deleted_at      TIMESTAMPTZ,
        sync_id         UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
        sync_version    BIGINT NOT NULL DEFAULT 0,
        client_created_at TIMESTAMPTZ
      )
    `)

    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${schema}".sale_items (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sale_id       UUID NOT NULL REFERENCES "${schema}".sales(id) ON DELETE CASCADE,
        product_id    UUID NOT NULL REFERENCES "${schema}".products(id),
        product_name  TEXT NOT NULL,
        product_sku   TEXT,
        quantity      NUMERIC(12,3) NOT NULL,
        unit_price    NUMERIC(12,2) NOT NULL,
        discount      NUMERIC(12,2) DEFAULT 0,
        subtotal      NUMERIC(12,2) NOT NULL,
        sync_id       UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
        sync_version  BIGINT NOT NULL DEFAULT 0
      )
    `)

    // Índices comunes
    await this.prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "idx_${schema}_products_sync"
        ON "${schema}".products(sync_id)
    `)
    await this.prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "idx_${schema}_sales_created"
        ON "${schema}".sales(created_at DESC) WHERE status = 'completed'
    `)
  }

  private sanitizeSchemaName(tenantId: string): string {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)) {
      throw new Error(`Invalid tenant ID: ${tenantId}`)
    }
    return `tenant_${tenantId.replace(/-/g, '_')}`
  }
}
