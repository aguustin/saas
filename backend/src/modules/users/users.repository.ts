import { Injectable } from '@nestjs/common'
import { Prisma }     from '@prisma/client'
import { PrismaTenantService }  from '@database/prisma-tenant.service'
import { TenantBaseRepository } from '@common/repositories/tenant-base.repository'
import type { UserRow, UserQueryDto, CreateUserDto } from './dto/user.dto'

@Injectable()
export class UsersRepository extends TenantBaseRepository {
  constructor(prisma: PrismaTenantService) {
    super(prisma)
  }

  // ─── SELECT helper (no expone password_hash) ──────────────────────────────

  private selectCols = Prisma.sql`
    u.id, u.email, u.role,
    u.first_name, u.last_name,
    u.branch_id,
    b.name AS branch_name,
    u.is_active,
    u.last_login_at::text,
    u.created_at::text,
    u.updated_at::text
  `

  // ─── Queries ──────────────────────────────────────────────────────────────

  async findMany(tenantId: string, q: UserQueryDto): Promise<{
    items: UserRow[]
    total: number
    limit:  number
    offset: number
  }> {
    const s      = this.schema(tenantId)
    const limit  = q.limit  ?? 50
    const offset = q.offset ?? 0

    const roleCond     = q.role      ? Prisma.sql`AND u.role = ${q.role}`                     : Prisma.sql``
    const branchCond   = q.branch_id ? Prisma.sql`AND u.branch_id = ${q.branch_id}::uuid`     : Prisma.sql``
    const activeCond   = q.is_active !== undefined
      ? Prisma.sql`AND u.is_active = ${q.is_active}`
      : Prisma.sql``
    const searchCond   = q.search
      ? Prisma.sql`AND (u.email ILIKE ${'%' + q.search + '%'} OR u.first_name ILIKE ${'%' + q.search + '%'} OR u.last_name ILIKE ${'%' + q.search + '%'})`
      : Prisma.sql``

    const items = await this.rawQuery<UserRow>(tenantId, (_s) =>
      Prisma.sql`
        SELECT ${this.selectCols}
        FROM ${Prisma.raw(s)}.users u
        LEFT JOIN ${Prisma.raw(s)}.branches b ON b.id = u.branch_id
        WHERE true
          ${roleCond} ${branchCond} ${activeCond} ${searchCond}
        ORDER BY u.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
    )

    const [{ total }] = await this.rawQuery<{ total: number }>(tenantId, (_s) =>
      Prisma.sql`
        SELECT COUNT(*)::int AS total
        FROM ${Prisma.raw(s)}.users u
        WHERE true ${roleCond} ${branchCond} ${activeCond} ${searchCond}
      `
    )

    return { items, total, limit, offset }
  }

  async findById(tenantId: string, id: string): Promise<UserRow | null> {
    const s    = this.schema(tenantId)
    const rows = await this.rawQuery<UserRow>(tenantId, (_s) =>
      Prisma.sql`
        SELECT ${this.selectCols}
        FROM ${Prisma.raw(s)}.users u
        LEFT JOIN ${Prisma.raw(s)}.branches b ON b.id = u.branch_id
        WHERE u.id = ${id}::uuid
        LIMIT 1
      `
    )
    return rows[0] ?? null
  }

  async findByEmail(tenantId: string, email: string): Promise<{ id: string; password_hash: string; role: string; branch_id: string | null; is_active: boolean } | null> {
    const s    = this.schema(tenantId)
    const rows = await this.rawQuery<any>(tenantId, (_s) =>
      Prisma.sql`
        SELECT id, email, password_hash, role, branch_id, is_active
        FROM ${Prisma.raw(s)}.users
        WHERE email = ${email}
        LIMIT 1
      `
    )
    return rows[0] ?? null
  }

  async emailExists(tenantId: string, email: string, excludeId?: string): Promise<boolean> {
    const s           = this.schema(tenantId)
    const excludeCond = excludeId
      ? Prisma.sql`AND id <> ${excludeId}::uuid`
      : Prisma.sql``

    const [{ count }] = await this.rawQuery<{ count: number }>(tenantId, (_s) =>
      Prisma.sql`
        SELECT COUNT(*)::int AS count
        FROM ${Prisma.raw(s)}.users
        WHERE email = ${email} ${excludeCond}
      `
    )
    return count > 0
  }

  // ─── Mutations ────────────────────────────────────────────────────────────

  async create(tenantId: string, data: {
    email:        string
    passwordHash: string
    role:         string
    firstName:    string
    lastName?:    string | null
    branchId?:    string | null
  }): Promise<UserRow> {
    const schema = this.schema(tenantId).replace(/"/g, '')

    await this.prisma.$executeRawUnsafe(`
      INSERT INTO "${schema}".users
        (email, password_hash, role, first_name, last_name, branch_id)
      VALUES ($1, $2, $3, $4, $5, $6::uuid)
    `,
      data.email,
      data.passwordHash,
      data.role,
      data.firstName,
      data.lastName    ?? null,
      data.branchId    ?? null,
    )

    const user = await this.findByEmail(tenantId, data.email)
    return this.findById(tenantId, user!.id) as Promise<UserRow>
  }

  async update(tenantId: string, id: string, data: {
    firstName?:  string
    lastName?:   string | null
    role?:       string
    branchId?:   string | null
    isActive?:   boolean
  }): Promise<UserRow | null> {
    const schema = this.schema(tenantId).replace(/"/g, '')

    const sets: string[] = ['updated_at = now()']
    const vals: unknown[] = []
    let   i = 1

    if (data.firstName  !== undefined) { sets.push(`first_name = $${i++}`);  vals.push(data.firstName) }
    if (data.lastName   !== undefined) { sets.push(`last_name  = $${i++}`);  vals.push(data.lastName ?? null) }
    if (data.role       !== undefined) { sets.push(`role       = $${i++}`);  vals.push(data.role) }
    if (data.isActive   !== undefined) { sets.push(`is_active  = $${i++}`);  vals.push(data.isActive) }
    if ('branchId' in data)            { sets.push(`branch_id  = $${i++}::uuid`); vals.push(data.branchId ?? null) }

    if (sets.length === 1) return this.findById(tenantId, id)

    vals.push(id)
    await this.prisma.$executeRawUnsafe(
      `UPDATE "${schema}".users SET ${sets.join(', ')} WHERE id = $${i}::uuid`,
      ...vals,
    )

    return this.findById(tenantId, id)
  }

  async changePassword(tenantId: string, id: string, newHash: string): Promise<void> {
    const schema = this.schema(tenantId).replace(/"/g, '')
    await this.prisma.$executeRawUnsafe(`
      UPDATE "${schema}".users SET password_hash = $1, updated_at = now() WHERE id = $2::uuid
    `, newHash, id)
  }

  async getPasswordHash(tenantId: string, id: string): Promise<string | null> {
    const schema = this.schema(tenantId).replace(/"/g, '')
    const rows   = await this.prisma.$queryRawUnsafe<{ password_hash: string }[]>(`
      SELECT password_hash FROM "${schema}".users WHERE id = $1::uuid LIMIT 1
    `, id)
    return rows[0]?.password_hash ?? null
  }
}
