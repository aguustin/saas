import {
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common'
import { PrismaService }   from '@database/prisma.service'
import { TokenService }    from './token.service'
import { TenantsService }  from '@modules/tenants/tenants.service'
import type { LoginDto, RefreshDto, RegisterDto, TokenPair } from './dto/auth.dto'
import { compare, hash } from 'bcryptjs'

export interface RegisterResponse extends TokenPair {
  tenant_id: string
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)

  constructor(
    private prisma:   PrismaService,
    private tokens:   TokenService,
    private tenants:  TenantsService,
  ) {}

  // ─── Register ─────────────────────────────────────────────────────────────

  async register(
    dto:       RegisterDto,
    ipAddress: string,
    userAgent: string,
  ): Promise<RegisterResponse> {
    // 1. Crear tenant (crea schema + tablas vía TenantMigrationRunner)
    const slug   = this.toSlug(dto.business_name) + '-' + Math.random().toString(36).slice(2, 7)
    const tenant = await this.tenants.create({
      name:    dto.business_name,
      email:   dto.email,
      slug,
      country: dto.country ?? 'AR',
    })

    const schema = this.buildSchema(tenant.id)

    // 2. Crear sucursal principal por defecto
    const branchRows = await this.prisma.$queryRawUnsafe<{ id: string }[]>(`
      INSERT INTO "${schema}".branches (name, is_active)
      VALUES ('Sucursal Principal', true)
      RETURNING id
    `)
    const branchId = branchRows[0].id

    // 3. Crear usuario owner vinculado a la sucursal
    const passwordHash = await hash(dto.password, 10)
    const userRows = await this.prisma.$queryRawUnsafe<{ id: string }[]>(`
      INSERT INTO "${schema}".users (email, password_hash, role, branch_id, is_active)
      VALUES ($1, $2, 'owner', $3::uuid, true)
      RETURNING id
    `, dto.email, passwordHash, branchId)

    const userId = userRows[0].id

    // 4. Obtener nombre del plan (siempre 'free' al registrarse)
    const planRows = await this.prisma.$queryRawUnsafe<{ plan_name: string }[]>(`
      SELECT p.name AS plan_name
      FROM tenants t JOIN plans p ON p.id = t.plan_id
      WHERE t.id = $1 LIMIT 1
    `, tenant.id)
    const planName = planRows[0]?.plan_name ?? 'free'

    // 5. Registrar email → tenant_id para login sin X-Tenant-Id
    await this.prisma.$executeRawUnsafe(`
      INSERT INTO user_tenant_map (email, tenant_id)
      VALUES ($1, $2)
      ON CONFLICT (email) DO UPDATE SET tenant_id = $2
    `, dto.email, tenant.id)

    // 6. Generar tokens → auto-login
    const tokenPair = await this.tokens.generateTokenPair({
      userId,
      tenantId:   tenant.id,
      role:       'owner',
      plan:       planName,
      branchId,
      deviceId:   dto.device_id,
      deviceName: dto.device_name,
      ipAddress,
      userAgent,
    })

    this.logger.log({ tenantId: tenant.id, userId, slug }, 'Tenant registered')
    return { tenant_id: tenant.id, ...tokenPair }
  }

  // ─── Login ────────────────────────────────────────────────────────────────

  async login(
    dto:       LoginDto,
    tenantId:  string | null,
    ipAddress: string,
    userAgent: string,
  ): Promise<TokenPair> {
    // Resolver tenant: por header explícito o por lookup email → tenant
    let resolvedTenantId = tenantId
    if (!resolvedTenantId) {
      const maps = await this.prisma.$queryRawUnsafe<{ tenant_id: string }[]>(
        `SELECT tenant_id FROM user_tenant_map WHERE email = $1 LIMIT 1`,
        dto.email,
      )
      if (!maps[0]) throw new UnauthorizedException('Invalid credentials')
      resolvedTenantId = maps[0].tenant_id
    }

    const finalTenantId = resolvedTenantId as string
    const schema = this.buildSchema(finalTenantId)

    // Query directa con schema validado
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT u.id, u.email, u.password_hash, u.role, u.branch_id, u.is_active
      FROM "${schema}".users u
      WHERE u.email = $1
      LIMIT 1
    `, dto.email)

    const user = rows[0]

    // Respuesta genérica para no revelar si el email existe
    if (!user || !user.is_active) {
      throw new UnauthorizedException('Invalid credentials')
    }

    const passwordValid = await compare(dto.password, user.password_hash)
    if (!passwordValid) {
      this.logger.warn({ tenantId: finalTenantId, email: dto.email, ip: ipAddress }, 'Failed login attempt')
      throw new UnauthorizedException('Invalid credentials')
    }

    // Obtener plan del tenant
    const tenantRows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT p.name AS plan_name
       FROM tenants t JOIN plans p ON p.id = t.plan_id
       WHERE t.id = $1
       LIMIT 1`,
      finalTenantId,
    )
    const planName = tenantRows[0]?.plan_name ?? 'free'

    const tokenPair = await this.tokens.generateTokenPair({
      userId:    user.id,
      tenantId:  finalTenantId,
      role:      user.role,
      plan:      planName,
      branchId:  user.branch_id ?? null,
      deviceId:  dto.device_id,
      deviceName: dto.device_name,
      ipAddress,
      userAgent,
    })

    // Actualizar last_login_at
    await this.prisma.$executeRawUnsafe(
      `UPDATE "${schema}".users SET last_login_at = now() WHERE id = $1::uuid`,
      user.id
    )

    this.logger.log({ userId: user.id, tenantId: finalTenantId, device: dto.device_id }, 'Login successful')
    return tokenPair
  }

  // ─── Refresh ──────────────────────────────────────────────────────────────

  async refresh(
    dto:       RefreshDto,
    ipAddress: string,
    userAgent: string,
  ): Promise<TokenPair> {
    const { tokens } = await this.tokens.rotateRefreshToken({
      rawToken:  dto.refresh_token,
      deviceId:  dto.device_id,
      ipAddress,
      userAgent,
    })
    return tokens
  }

  // ─── Logout ───────────────────────────────────────────────────────────────

  async logout(params: {
    userId:     string
    tenantId:   string
    deviceId:   string
    allDevices: boolean
  }): Promise<void> {
    if (params.allDevices) {
      await this.tokens.revokeAllForUser(params.userId, params.tenantId)
      this.logger.log({ userId: params.userId }, 'Logged out all devices')
    } else {
      await this.tokens.revokeByDevice(params.userId, params.tenantId, params.deviceId)
      this.logger.log({ userId: params.userId, device: params.deviceId }, 'Logged out device')
    }
  }

  // ─── Sesiones activas ─────────────────────────────────────────────────────

  async getSessions(userId: string, tenantId: string) {
    return this.tokens.getActiveSessions(userId, tenantId)
  }

  async revokeSession(userId: string, tenantId: string, sessionId: string): Promise<void> {
    await this.tokens.revokeSession(userId, tenantId, sessionId)
  }

  // ─── Helper ───────────────────────────────────────────────────────────────

  private toSlug(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40)
  }

  private buildSchema(tenantId: string): string {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)) {
      throw new UnauthorizedException('Invalid tenant')
    }
    return `tenant_${tenantId.replace(/-/g, '_')}`
  }
}
