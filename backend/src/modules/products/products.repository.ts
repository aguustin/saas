import { Injectable, ConflictException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaTenantService }  from '@database/prisma-tenant.service'
import { TenantBaseRepository } from '@common/repositories/tenant-base.repository'
import type {
  CreateProductDto,
  UpdateProductDto,
  ProductQueryDto,
  ProductResponse,
  ProductListResponse,
} from './dto/product.dto'

@Injectable()
export class ProductsRepository extends TenantBaseRepository {
  constructor(prisma: PrismaTenantService) {
    super(prisma)
  }

  async findMany(tenantId: string, q: ProductQueryDto): Promise<ProductListResponse> {
    const limit  = q.limit  ?? 50
    const offset = q.offset ?? 0

    // Condiciones opcionales compuestas con Prisma.sql (siempre parametrizadas)
    const searchCondition = q.search
      ? Prisma.sql`AND (
          p.name    ILIKE ${'%' + q.search + '%'} OR
          p.sku     ILIKE ${'%' + q.search + '%'} OR
          p.barcode ILIKE ${'%' + q.search + '%'} OR
          p.description ILIKE ${'%' + q.search + '%'}
        )`
      : Prisma.sql``

    const categoryCondition = q.category_id
      ? Prisma.sql`AND p.category_id = ${q.category_id}::uuid`
      : Prisma.sql``

    const activeCondition = q.is_active !== undefined
      ? Prisma.sql`AND p.is_active = ${q.is_active}`
      : Prisma.sql``

    const minPriceCondition = q.min_price !== undefined
      ? Prisma.sql`AND p.price >= ${q.min_price}`
      : Prisma.sql``

    const maxPriceCondition = q.max_price !== undefined
      ? Prisma.sql`AND p.price <= ${q.max_price}`
      : Prisma.sql``

    const orderCol = {
      name:       'p.name',
      price:      'p.price',
      created_at: 'p.created_at',
      updated_at: 'p.updated_at',
    }[q.sort_by ?? 'name']

    const orderDir = (q.sort_dir ?? 'asc').toUpperCase() === 'DESC' ? 'DESC' : 'ASC'

    const schema = this.schema(tenantId)

    const items = await this.rawQuery<ProductResponse>(tenantId, (_s) =>
      Prisma.sql`
        SELECT
          p.id, p.name, p.description, p.sku, p.barcode,
          p.price::float,
          p.cost::float,
          p.tax_rate::float,
          p.unit,
          p.category_id,
          p.image_url,
          p.attributes,
          p.is_active,
          p.sync_id,
          p.sync_version,
          p.created_at,
          p.updated_at
        FROM ${Prisma.raw(schema)}.products p
        WHERE p.deleted_at IS NULL
          ${searchCondition}
          ${categoryCondition}
          ${activeCondition}
          ${minPriceCondition}
          ${maxPriceCondition}
        ORDER BY ${Prisma.raw(orderCol)} ${Prisma.raw(orderDir)}
        LIMIT  ${limit}
        OFFSET ${offset}
      `
    )

    const [count] = await this.rawQuery<{ total: number }>(tenantId, (_s) =>
      Prisma.sql`
        SELECT COUNT(*)::int AS total
        FROM ${Prisma.raw(schema)}.products p
        WHERE p.deleted_at IS NULL
          ${searchCondition}
          ${categoryCondition}
          ${activeCondition}
          ${minPriceCondition}
          ${maxPriceCondition}
      `
    )

    return { items, total: count.total, limit, offset }
  }

  async findById(tenantId: string, id: string): Promise<ProductResponse | null> {
    const schema = this.schema(tenantId)
    const rows = await this.rawQuery<ProductResponse>(tenantId, (_s) =>
      Prisma.sql`
        SELECT
          p.id, p.name, p.description, p.sku, p.barcode,
          p.price::float, p.cost::float, p.tax_rate::float,
          p.unit, p.category_id, p.image_url, p.attributes,
          p.is_active, p.sync_id, p.sync_version,
          p.created_at, p.updated_at
        FROM ${Prisma.raw(schema)}.products p
        WHERE p.id = ${id}::uuid AND p.deleted_at IS NULL
        LIMIT 1
      `
    )
    return rows[0] ?? null
  }

  async findByBarcode(tenantId: string, barcode: string): Promise<ProductResponse | null> {
    const schema = this.schema(tenantId)
    const rows = await this.rawQuery<ProductResponse>(tenantId, (_s) =>
      Prisma.sql`
        SELECT id, name, sku, barcode, price::float, is_active, sync_id
        FROM ${Prisma.raw(schema)}.products
        WHERE barcode = ${barcode} AND deleted_at IS NULL
        LIMIT 1
      `
    )
    return rows[0] ?? null
  }

  async findBySyncId(tenantId: string, syncId: string): Promise<ProductResponse | null> {
    const schema = this.schema(tenantId)
    const rows = await this.rawQuery<ProductResponse>(tenantId, (_s) =>
      Prisma.sql`
        SELECT * FROM ${Prisma.raw(schema)}.products
        WHERE sync_id = ${syncId}::uuid
        LIMIT 1
      `
    )
    return rows[0] ?? null
  }

  async create(tenantId: string, data: CreateProductDto): Promise<ProductResponse> {
    await this.assertNoDuplicate(tenantId, { sku: data.sku, barcode: data.barcode })

    const schema = this.schema(tenantId)
    const rows = await this.rawQuery<ProductResponse>(tenantId, (_s) =>
      Prisma.sql`
        INSERT INTO ${Prisma.raw(schema)}.products
          (name, description, sku, barcode, price, cost, tax_rate, unit,
           category_id, image_url, attributes, is_active, sync_version)
        VALUES (
          ${data.name},
          ${data.description   ?? null},
          ${data.sku           ?? null},
          ${data.barcode       ?? null},
          ${data.price},
          ${data.cost          ?? null},
          ${data.tax_rate      ?? 0.21},
          ${data.unit          ?? 'unit'},
          ${data.category_id   ? Prisma.sql`${data.category_id}::uuid` : Prisma.sql`NULL`},
          ${data.image_url     ?? null},
          ${JSON.stringify(data.attributes ?? {})}::jsonb,
          ${data.is_active     ?? true},
          nextval('public.sync_version_seq')
        )
        RETURNING
          id, name, description, sku, barcode,
          price::float, cost::float, tax_rate::float,
          unit, category_id, image_url, attributes, is_active,
          sync_id, sync_version, created_at, updated_at
      `
    )
    return rows[0]
  }

  async update(
    tenantId: string,
    id:       string,
    data:     UpdateProductDto,
  ): Promise<ProductResponse | null> {
    if (data.sku || data.barcode) {
      await this.assertNoDuplicate(tenantId, {
        sku:     data.sku,
        barcode: data.barcode,
        excludeId: id,
      })
    }

    const schema = this.schema(tenantId)
    const sets: Prisma.Sql[] = []

    if (data.name        !== undefined) sets.push(Prisma.sql`name        = ${data.name}`)
    if (data.description !== undefined) sets.push(Prisma.sql`description = ${data.description}`)
    if (data.sku         !== undefined) sets.push(Prisma.sql`sku         = ${data.sku}`)
    if (data.barcode     !== undefined) sets.push(Prisma.sql`barcode     = ${data.barcode}`)
    if (data.price       !== undefined) sets.push(Prisma.sql`price       = ${data.price}`)
    if (data.cost        !== undefined) sets.push(Prisma.sql`cost        = ${data.cost}`)
    if (data.tax_rate    !== undefined) sets.push(Prisma.sql`tax_rate    = ${data.tax_rate}`)
    if (data.unit        !== undefined) sets.push(Prisma.sql`unit        = ${data.unit}`)
    if (data.image_url   !== undefined) sets.push(Prisma.sql`image_url   = ${data.image_url}`)
    if (data.attributes  !== undefined) sets.push(Prisma.sql`attributes  = ${JSON.stringify(data.attributes)}::jsonb`)
    if (data.category_id !== undefined) {
      sets.push(
        data.category_id
          ? Prisma.sql`category_id = ${data.category_id}::uuid`
          : Prisma.sql`category_id = NULL`
      )
    }

    if (!sets.length) return this.findById(tenantId, id)

    sets.push(Prisma.sql`updated_at   = now()`)
    sets.push(Prisma.sql`sync_version = nextval('public.sync_version_seq')`)

    const rows = await this.rawQuery<ProductResponse>(tenantId, (_s) =>
      Prisma.sql`
        UPDATE ${Prisma.raw(schema)}.products
        SET ${Prisma.join(sets, ', ')}
        WHERE id = ${id}::uuid AND deleted_at IS NULL
        RETURNING
          id, name, description, sku, barcode,
          price::float, cost::float, tax_rate::float,
          unit, category_id, image_url, attributes, is_active,
          sync_id, sync_version, created_at, updated_at
      `
    )
    return rows[0] ?? null
  }

  async setActive(tenantId: string, id: string, isActive: boolean): Promise<ProductResponse | null> {
    const schema = this.schema(tenantId)
    const rows = await this.rawQuery<ProductResponse>(tenantId, (_s) =>
      Prisma.sql`
        UPDATE ${Prisma.raw(schema)}.products
        SET is_active    = ${isActive},
            updated_at   = now(),
            sync_version = nextval('public.sync_version_seq')
        WHERE id = ${id}::uuid AND deleted_at IS NULL
        RETURNING
          id, name, sku, barcode, price::float, is_active,
          sync_id, sync_version, updated_at
      `
    )
    return rows[0] ?? null
  }

  async softDelete(tenantId: string, id: string): Promise<boolean> {
    const schema = this.schema(tenantId)
    const count  = await this.rawExecute(tenantId, (_s) =>
      Prisma.sql`
        UPDATE ${Prisma.raw(schema)}.products
        SET deleted_at   = now(),
            updated_at   = now(),
            sync_version = nextval('public.sync_version_seq')
        WHERE id = ${id}::uuid AND deleted_at IS NULL
      `
    )
    return count > 0
  }

  async bulkSoftDelete(tenantId: string, ids: string[]): Promise<number> {
    if (!ids.length) return 0
    const schema   = this.schema(tenantId)
    const uuidList = Prisma.join(ids.map(id => Prisma.sql`${id}::uuid`))

    return this.rawExecute(tenantId, (_s) =>
      Prisma.sql`
        UPDATE ${Prisma.raw(schema)}.products
        SET deleted_at   = now(),
            updated_at   = now(),
            sync_version = nextval('public.sync_version_seq')
        WHERE id IN (${uuidList}) AND deleted_at IS NULL
      `
    )
  }

  async countActive(tenantId: string): Promise<number> {
    const schema = this.schema(tenantId)
    const [row]  = await this.rawQuery<{ total: number }>(tenantId, (_s) =>
      Prisma.sql`
        SELECT COUNT(*)::int AS total
        FROM ${Prisma.raw(schema)}.products
        WHERE deleted_at IS NULL AND is_active = true
      `
    )
    return row.total
  }

  // ─── Helpers privados ──────────────────────────────────────────────────────

  private async assertNoDuplicate(
    tenantId:  string,
    fields:    { sku?: string | null; barcode?: string | null; excludeId?: string },
  ): Promise<void> {
    const schema = this.schema(tenantId)

    if (fields.sku) {
      const excludeClause = fields.excludeId
        ? Prisma.sql`AND id != ${fields.excludeId}::uuid`
        : Prisma.sql``

      const [row] = await this.rawQuery<{ exists: boolean }>(tenantId, (_s) =>
        Prisma.sql`
          SELECT EXISTS(
            SELECT 1 FROM ${Prisma.raw(schema)}.products
            WHERE sku = ${fields.sku} AND deleted_at IS NULL
              ${excludeClause}
          ) AS exists
        `
      )
      if (row.exists) throw new ConflictException(`SKU '${fields.sku}' already exists`)
    }

    if (fields.barcode) {
      const excludeClause = fields.excludeId
        ? Prisma.sql`AND id != ${fields.excludeId}::uuid`
        : Prisma.sql``

      const [row] = await this.rawQuery<{ exists: boolean }>(tenantId, (_s) =>
        Prisma.sql`
          SELECT EXISTS(
            SELECT 1 FROM ${Prisma.raw(schema)}.products
            WHERE barcode = ${fields.barcode} AND deleted_at IS NULL
              ${excludeClause}
          ) AS exists
        `
      )
      if (row.exists) throw new ConflictException(`Barcode '${fields.barcode}' already exists`)
    }
  }
}
