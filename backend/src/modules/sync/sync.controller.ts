import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { SyncService }       from './sync.service'
import { TenantGuard }       from '@common/guards/tenant.guard'
import { RolesGuard }        from '@common/guards/roles.guard'
import { Roles }             from '@common/decorators/roles.decorator'
import { CurrentUser }       from '@common/decorators/current-user.decorator'
import { ZodValidationPipe } from '@common/pipes/zod-validation.pipe'
import type { JwtPayload }   from '@common/types/jwt-payload'
import {
  PullRequestSchema,
  PushRequestSchema,
  type PullRequestDto,
  type PushRequestDto,
} from './dto/sync.dto'

@UseGuards(TenantGuard, RolesGuard)
@Controller('sync')
export class SyncController {
  constructor(private readonly svc: SyncService) {}

  /**
   * GET /sync/pull
   * Returns delta rows since last cursor for each requested table.
   * Client should call repeatedly while has_more=true per table.
   */
  @Get('pull')
  @Roles('owner', 'admin', 'manager', 'cashier')
  pull(
    @CurrentUser() actor: JwtPayload,
    @Query(new ZodValidationPipe(PullRequestSchema)) dto: PullRequestDto,
  ) {
    return this.svc.pull(actor.tenant_id, actor.sub, dto)
  }

  /**
   * POST /sync/push
   * Applies client-generated changes (offline sales, customer edits).
   * Each change returns applied/skipped/conflict/error status.
   */
  @Post('push')
  @Roles('owner', 'admin', 'manager', 'cashier')
  @HttpCode(HttpStatus.OK)
  push(
    @CurrentUser() actor: JwtPayload,
    @Body(new ZodValidationPipe(PushRequestSchema)) dto: PushRequestDto,
  ) {
    return this.svc.push(actor.tenant_id, actor.sub, dto)
  }

  /**
   * GET /sync/status/:deviceId
   * Returns cursor state vs server heads — tells client how far behind it is.
   * Useful for showing sync status indicator in the UI.
   */
  @Get('status/:deviceId')
  @Roles('owner', 'admin', 'manager', 'cashier')
  status(
    @CurrentUser() actor: JwtPayload,
    @Param('deviceId') deviceId: string,
  ) {
    return this.svc.getStatus(actor.tenant_id, deviceId)
  }
}
