import { Injectable } from '@nestjs/common'
import { Prisma }     from '@prisma/client'
import { PrismaTenantService }  from '@database/prisma-tenant.service'
import { TenantBaseRepository } from '@common/repositories/tenant-base.repository'
import type { EmployeeRow, EmployeeQueryDto, CreateEmployeeDto } from './dto/employee.dto'

@Injectable()
export class EmployeesRepository extends TenantBaseRepository {
  constructor(prisma: PrismaTenantService) {
    super(prisma)
  }

  private selectCols(s: string) {
    return Prisma.sql`
      e.id, e.user_id,
      e.branch_id, b.name AS branch_name,
      e.first_name, e.last_name, e.dni, e.phone, e.email,
      e.role, e.salary::float,
      e.hired_at::text,
      e.is_active, e.notes,
      e.sync_version,
      e.created_at::text, e.updated_at::text
    `
  }

  // ─── Queries ──────────────────────────────────────────────────────────────

  async findMany(tenantId: string, q: EmployeeQueryDto): Promise<{
    items: EmployeeRow[]
    total: number
    limit:  number
    offset: number
  }> {
    const s      = this.schema(tenantId)
    const limit  = q.limit  ?? 50
    const offset = q.offset ?? 0

    const branchCond   = q.branch_id ? Prisma.sql`AND e.branch_id = ${q.branch_id}::uuid` : Prisma.sql``
    const roleCond     = q.role      ? Prisma.sql`AND e.role = ${q.role}`                  : Prisma.sql``
    const activeCond   = q.is_active !== undefined
      ? Prisma.sql`AND e.is_active = ${q.is_active}`
      : Prisma.sql`AND e.deleted_at IS NULL`
    const deletedCond  = q.is_active !== undefined
      ? Prisma.sql``
      : Prisma.sql``
    const searchCond   = q.search
      ? Prisma.sql`AND (e.first_name ILIKE ${'%' + q.search + '%'} OR e.last_name ILIKE ${'%' + q.search + '%'} OR e.email ILIKE ${'%' + q.search + '%'} OR e.dni ILIKE ${'%' + q.search + '%'})`
      : Prisma.sql``

    const items = await this.rawQuery<EmployeeRow>(tenantId, (_s) =>
      Prisma.sql`
        SELECT ${this.selectCols(s)}
        FROM ${Prisma.raw(s)}.employees e
        JOIN ${Prisma.raw(s)}.branches b ON b.id = e.branch_id
        WHERE e.deleted_at IS NULL
          ${branchCond} ${roleCond} ${activeCond} ${searchCond}
        ORDER BY e.last_name ASC, e.first_name ASC
        LIMIT ${limit} OFFSET ${offset}
      `
    )

    const [{ total }] = await this.rawQuery<{ total: number }>(tenantId, (_s) =>
      Prisma.sql`
        SELECT COUNT(*)::int AS total
        FROM ${Prisma.raw(s)}.employees e
        WHERE e.deleted_at IS NULL
          ${branchCond} ${roleCond} ${activeCond} ${searchCond}
      `
    )

    return { items, total, limit, offset }
  }

  async findById(tenantId: string, id: string): Promise<EmployeeRow | null> {
    const s    = this.schema(tenantId)
    const rows = await this.rawQuery<EmployeeRow>(tenantId, (_s) =>
      Prisma.sql`
        SELECT ${this.selectCols(s)}
        FROM ${Prisma.raw(s)}.employees e
        JOIN ${Prisma.raw(s)}.branches b ON b.id = e.branch_id
        WHERE e.id = ${id}::uuid AND e.deleted_at IS NULL
        LIMIT 1
      `
    )
    return rows[0] ?? null
  }

  // ─── Mutations ────────────────────────────────────────────────────────────

  async create(tenantId: string, data: CreateEmployeeDto): Promise<EmployeeRow> {
    const schema = this.schema(tenantId).replace(/"/g, '')

    const rows = await this.prisma.$queryRawUnsafe<{ id: string }[]>(`
      INSERT INTO "${schema}".employees
        (first_name, last_name, branch_id, role, user_id, dni, phone, email, salary, hired_at, notes, sync_version)
      VALUES ($1, $2, $3::uuid, $4, $5::uuid, $6, $7, $8, $9, $10::date, $11, nextval('public.sync_version_seq'))
      RETURNING id
    `,
      data.first_name,
      data.last_name,
      data.branch_id,
      data.role,
      data.user_id    ?? null,
      data.dni        ?? null,
      data.phone      ?? null,
      data.email      ?? null,
      data.salary     ?? null,
      data.hired_at   ?? null,
      data.notes      ?? null,
    )

    return this.findById(tenantId, rows[0].id) as Promise<EmployeeRow>
  }

  async update(tenantId: string, id: string, data: Partial<{
    firstName:  string
    lastName:   string
    branchId:   string
    role:       string
    userId:     string | null
    dni:        string | null
    phone:      string | null
    email:      string | null
    salary:     number | null
    hiredAt:    string | null
    notes:      string | null
    isActive:   boolean
  }>): Promise<EmployeeRow | null> {
    const schema = this.schema(tenantId).replace(/"/g, '')

    const sets: string[] = ['updated_at = now()', 'sync_version = nextval(\'public.sync_version_seq\')']
    const vals: unknown[] = []
    let   i = 1

    if (data.firstName !== undefined) { sets.push(`first_name = $${i++}`);        vals.push(data.firstName) }
    if (data.lastName  !== undefined) { sets.push(`last_name  = $${i++}`);        vals.push(data.lastName) }
    if (data.branchId  !== undefined) { sets.push(`branch_id  = $${i++}::uuid`);  vals.push(data.branchId) }
    if (data.role      !== undefined) { sets.push(`role       = $${i++}`);        vals.push(data.role) }
    if ('userId'   in data)           { sets.push(`user_id    = $${i++}::uuid`);  vals.push(data.userId ?? null) }
    if ('dni'      in data)           { sets.push(`dni        = $${i++}`);        vals.push(data.dni    ?? null) }
    if ('phone'    in data)           { sets.push(`phone      = $${i++}`);        vals.push(data.phone  ?? null) }
    if ('email'    in data)           { sets.push(`email      = $${i++}`);        vals.push(data.email  ?? null) }
    if ('salary'   in data)           { sets.push(`salary     = $${i++}`);        vals.push(data.salary ?? null) }
    if ('hiredAt'  in data)           { sets.push(`hired_at   = $${i++}::date`);  vals.push(data.hiredAt ?? null) }
    if ('notes'    in data)           { sets.push(`notes      = $${i++}`);        vals.push(data.notes  ?? null) }
    if (data.isActive !== undefined)  { sets.push(`is_active  = $${i++}`);        vals.push(data.isActive) }

    if (sets.length <= 2) return this.findById(tenantId, id)

    vals.push(id)
    await this.prisma.$executeRawUnsafe(
      `UPDATE "${schema}".employees SET ${sets.join(', ')} WHERE id = $${i}::uuid AND deleted_at IS NULL`,
      ...vals,
    )

    return this.findById(tenantId, id)
  }

  async softDelete(tenantId: string, id: string): Promise<boolean> {
    const schema = this.schema(tenantId).replace(/"/g, '')
    const count  = await this.prisma.$executeRawUnsafe(`
      UPDATE "${schema}".employees
      SET deleted_at = now(), updated_at = now(), sync_version = nextval('public.sync_version_seq')
      WHERE id = $1::uuid AND deleted_at IS NULL
    `, id)
    return count > 0
  }
}
