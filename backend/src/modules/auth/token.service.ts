import { Injectable, UnauthorizedException, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '@database/prisma.service'
import { createHash, randomBytes, timingSafeEqual } from 'crypto'
import * as jwt from 'jsonwebtoken'
import type { JwtPayload } from '@common/types/jwt-payload'
import type { TokenPair } from './dto/auth.dto'

const ACCESS_TOKEN_TTL  = 15 * 60            // 15 min en segundos
const REFRESH_TOKEN_TTL = 30 * 24 * 60 * 60  // 30 días en segundos

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name)

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  // ─── Generación ───────────────────────────────────────────────────────────

  async generateTokenPair(params: {
    userId:     string
    tenantId:   string
    role:       string
    plan:       string
    branchId:   string | null
    deviceId:   string
    deviceName?: string
    ipAddress?: string
    userAgent?: string
  }): Promise<TokenPair> {
    const payload: JwtPayload = {
      sub:       params.userId,
      tenant_id: params.tenantId,
      role:      params.role as any,
      plan:      params.plan as any,
      branch_id: params.branchId,
    }

    const accessToken = jwt.sign(payload, this.config.getOrThrow<string>('JWT_SECRET'), {
      expiresIn: ACCESS_TOKEN_TTL,
    })

    const rawRefresh  = randomBytes(48).toString('hex')   // 96 chars hex
    const tokenHash   = this.hashToken(rawRefresh)
    const expiresAt   = new Date(Date.now() + REFRESH_TOKEN_TTL * 1000)

    // Revocar token anterior del mismo device antes de crear el nuevo
    await this.revokeByDevice(params.userId, params.tenantId, params.deviceId)

    await this.prisma.$executeRaw`
      INSERT INTO refresh_tokens
        (id, user_id, tenant_id, token_hash, device_id, device_name, ip_address, user_agent, expires_at)
      VALUES (
        gen_random_uuid(),
        ${params.userId},
        ${params.tenantId},
        ${tokenHash},
        ${params.deviceId},
        ${params.deviceName ?? null},
        ${params.ipAddress  ?? null},
        ${params.userAgent  ?? null},
        ${expiresAt}
      )
    `

    return {
      access_token:  accessToken,
      refresh_token: rawRefresh,
      expires_in:    ACCESS_TOKEN_TTL,
    }
  }

  // ─── Rotación ─────────────────────────────────────────────────────────────

  async rotateRefreshToken(params: {
    rawToken:  string
    deviceId:  string
    ipAddress?: string
    userAgent?: string
  }): Promise<{ tokens: TokenPair; payload: JwtPayload }> {
    const tokenHash = this.hashToken(params.rawToken)

    // Buscar por hash (indexed, O(1))
    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT
        rt.id, rt.user_id, rt.tenant_id, rt.device_id,
        rt.device_name, rt.expires_at, rt.revoked_at,
        rt.last_used_at
      FROM refresh_tokens rt
      WHERE rt.token_hash = ${tokenHash}
      LIMIT 1
    `

    const record = rows[0]

    if (!record) {
      throw new UnauthorizedException('Invalid refresh token')
    }

    // Token ya fue revocado → posible reuse attack
    if (record.revoked_at) {
      this.logger.warn(
        { userId: record.user_id, deviceId: record.device_id },
        'Refresh token reuse detected — revoking all tokens for user'
      )
      // Revocar TODOS los tokens del usuario (familia comprometida)
      await this.revokeAllForUser(record.user_id, record.tenant_id)
      throw new UnauthorizedException('Token reuse detected. Please login again.')
    }

    if (new Date(record.expires_at) < new Date()) {
      throw new UnauthorizedException('Refresh token expired')
    }

    if (record.device_id !== params.deviceId) {
      this.logger.warn(
        { expected: record.device_id, got: params.deviceId, userId: record.user_id },
        'Device mismatch on refresh — possible token theft'
      )
      throw new UnauthorizedException('Device mismatch')
    }

    // Revocar el token actual (rotación)
    await this.prisma.$executeRaw`
      UPDATE refresh_tokens
      SET revoked_at = now()
      WHERE id = ${record.id}
    `

    // Recuperar datos completos del usuario para el nuevo JWT
    // $queryRawUnsafe: schemaName es seguro (UUID validado → solo hex + guiones bajos)
    const schemaName = `tenant_${record.tenant_id.replace(/-/g, '_')}`
    const userRows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT u.role, u.branch_id, t.plan_id, p.name AS plan_name
       FROM "${schemaName}".users u
       JOIN tenants t ON t.id = $1
       JOIN plans   p ON p.id = t.plan_id
       WHERE u.id = $2::uuid AND u.is_active = true
       LIMIT 1`,
      record.tenant_id,
      record.user_id,
    )

    if (!userRows[0]) {
      throw new UnauthorizedException('User no longer active')
    }

    const user = userRows[0]

    const tokens = await this.generateTokenPair({
      userId:    record.user_id,
      tenantId:  record.tenant_id,
      role:      user.role,
      plan:      user.plan_name,
      branchId:  user.branch_id ?? null,
      deviceId:  params.deviceId,
      deviceName: record.device_name,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    })

    const jwtPayload: JwtPayload = {
      sub:       record.user_id,
      tenant_id: record.tenant_id,
      role:      user.role,
      plan:      user.plan_name,
      branch_id: user.branch_id ?? null,
    }

    return { tokens, payload: jwtPayload }
  }

  // ─── Revocación ───────────────────────────────────────────────────────────

  async revokeByDevice(userId: string, tenantId: string, deviceId: string): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE refresh_tokens
      SET revoked_at = now()
      WHERE user_id   = ${userId}
        AND tenant_id = ${tenantId}
        AND device_id = ${deviceId}
        AND revoked_at IS NULL
    `
  }

  async revokeAllForUser(userId: string, tenantId: string): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE refresh_tokens
      SET revoked_at = now()
      WHERE user_id   = ${userId}
        AND tenant_id = ${tenantId}
        AND revoked_at IS NULL
    `
  }

  // ─── Listado de sesiones ──────────────────────────────────────────────────

  async getActiveSessions(userId: string, tenantId: string): Promise<ActiveSession[]> {
    return this.prisma.$queryRaw<ActiveSession[]>`
      SELECT
        id, device_id, device_name, ip_address,
        last_used_at, created_at
      FROM refresh_tokens
      WHERE user_id   = ${userId}
        AND tenant_id = ${tenantId}
        AND revoked_at IS NULL
        AND expires_at > now()
      ORDER BY last_used_at DESC
    `
  }

  async revokeSession(userId: string, tenantId: string, sessionId: string): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE refresh_tokens
      SET revoked_at = now()
      WHERE id        = ${sessionId}
        AND user_id   = ${userId}
        AND tenant_id = ${tenantId}
    `
  }

  // ─── Limpieza ─────────────────────────────────────────────────────────────

  async deleteExpiredTokens(): Promise<number> {
    const result = await this.prisma.$executeRaw`
      DELETE FROM refresh_tokens
      WHERE expires_at < now() - INTERVAL '7 days'
    `
    return result
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex')
  }

  verifyAccessToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, this.config.getOrThrow('JWT_SECRET')) as JwtPayload
    } catch {
      throw new UnauthorizedException('Invalid or expired access token')
    }
  }

  private tenantSchemaRaw(tenantId: string): any {
    // Validar UUID antes de usar en query raw
    if (!/^[0-9a-f-]{36}$/i.test(tenantId)) throw new Error('Invalid tenant ID')
    const schema = `tenant_${tenantId.replace(/-/g, '_')}`
    // Prisma.raw solo acepta strings literales en template tags,
    // usar $queryRawUnsafe solo cuando el schema ya está validado
    return { toString: () => `"${schema}"` }
  }
}

export interface ActiveSession {
  id:           string
  device_id:    string
  device_name:  string | null
  ip_address:   string | null
  last_used_at: Date
  created_at:   Date
}
