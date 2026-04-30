import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
  ParseUUIDPipe,
  Headers,
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Request } from 'express'
import { AuthService }       from './auth.service'
import { JwtAuthGuard, Public } from '@common/guards/jwt-auth.guard'
import { TenantGuard }       from '@common/guards/tenant.guard'
import { CurrentUser }       from '@common/decorators/current-user.decorator'
import { ZodValidationPipe } from '@common/pipes/zod-validation.pipe'
import {
  LoginSchema,   LoginDto,
  RefreshSchema, RefreshDto,
  LogoutSchema,  LogoutDto,
} from './dto/auth.dto'
import type { JwtPayload } from '@common/types/jwt-payload'

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * Login — requiere tenant_id en header X-Tenant-Id
   * El tenant se resuelve por header (no por JWT, porque aún no hay token)
   */
  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(LoginSchema)) dto: LoginDto,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: Request,
  ) {
    if (!tenantId || !/^[0-9a-f-]{36}$/i.test(tenantId)) {
      throw new Error('Missing or invalid X-Tenant-Id header')
    }

    return this.authService.login(
      dto,
      tenantId,
      this.getIp(req),
      req.headers['user-agent'] ?? '',
    )
  }

  /**
   * Refresh — no requiere JWT válido (el AT puede estar expirado)
   */
  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body(new ZodValidationPipe(RefreshSchema)) dto: RefreshDto,
    @Req() req: Request,
  ) {
    return this.authService.refresh(
      dto,
      this.getIp(req),
      req.headers['user-agent'] ?? '',
    )
  }

  /**
   * Logout — requiere JWT válido
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(LogoutSchema)) dto: LogoutDto,
  ) {
    await this.authService.logout({
      userId:     user.sub,
      tenantId:   user.tenant_id,
      deviceId:   dto.device_id,
      allDevices: dto.all_devices ?? false,
    })
  }

  /**
   * Sesiones activas del usuario autenticado
   */
  @Get('sessions')
  @UseGuards(JwtAuthGuard, TenantGuard)
  getSessions(@CurrentUser() user: JwtPayload) {
    return this.authService.getSessions(user.sub, user.tenant_id)
  }

  /**
   * Revocar una sesión específica por ID
   */
  @Delete('sessions/:sessionId')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  revokeSession(
    @CurrentUser() user: JwtPayload,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    return this.authService.revokeSession(user.sub, user.tenant_id, sessionId)
  }

  /**
   * Verificar que el token actual es válido (útil para el cliente Electron al arrancar)
   */
  @Get('me')
  @UseGuards(JwtAuthGuard, TenantGuard)
  me(@CurrentUser() user: JwtPayload) {
    return {
      user_id:   user.sub,
      tenant_id: user.tenant_id,
      role:      user.role,
      plan:      user.plan,
      branch_id: user.branch_id,
    }
  }

  private getIp(req: Request): string {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
      req.socket.remoteAddress ??
      ''
    )
  }
}
