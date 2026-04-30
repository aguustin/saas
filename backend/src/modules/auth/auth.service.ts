import {
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common'
import { PrismaService }  from '@database/prisma.service'
import { TokenService }   from './token.service'
import type { LoginDto, RefreshDto, TokenPair } from './dto/auth.dto'
import { compare } from 'bcryptjs'

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)

  constructor(
    private prisma:  PrismaService,
    private tokens:  TokenService,
  ) {}

  // ─── Login ────────────────────────────────────────────────────────────────

  async login(
    dto:       LoginDto,
    tenantId:  string,
    ipAddress: string,
    userAgent: string,
  ): Promise<TokenPair> {
    const schema = this.buildSchema(tenantId)

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
      this.logger.warn({ tenantId, email: dto.email, ip: ipAddress }, 'Failed login attempt')
      throw new UnauthorizedException('Invalid credentials')
    }

    // Obtener plan del tenant
    const tenantRows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT p.name AS plan_name
       FROM tenants t JOIN plans p ON p.id = t.plan_id
       WHERE t.id = $1
       LIMIT 1`,
      tenantId,
    )
    const planName = tenantRows[0]?.plan_name ?? 'free'

    const tokenPair = await this.tokens.generateTokenPair({
      userId:    user.id,
      tenantId,
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

    this.logger.log({ userId: user.id, tenantId, device: dto.device_id }, 'Login successful')
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

  private buildSchema(tenantId: string): string {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)) {
      throw new UnauthorizedException('Invalid tenant')
    }
    return `tenant_${tenantId.replace(/-/g, '_')}`
  }
}
