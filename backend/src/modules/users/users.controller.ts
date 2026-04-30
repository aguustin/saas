import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { UsersService }      from './users.service'
import { TenantGuard }       from '@common/guards/tenant.guard'
import { RolesGuard }        from '@common/guards/roles.guard'
import { Roles }             from '@common/decorators/roles.decorator'
import { CurrentUser }       from '@common/decorators/current-user.decorator'
import { ZodValidationPipe } from '@common/pipes/zod-validation.pipe'
import type { JwtPayload }   from '@common/types/jwt-payload'
import {
  CreateUserSchema,
  UpdateUserSchema,
  ChangePasswordSchema,
  ResetPasswordSchema,
  UserQuerySchema,
  type CreateUserDto,
  type UpdateUserDto,
  type ChangePasswordDto,
  type ResetPasswordDto,
  type UserQueryDto,
} from './dto/user.dto'

@UseGuards(TenantGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly svc: UsersService) {}

  // ─── Queries ───────────────────────────────────────────────────────────────

  @Get()
  @Roles('owner', 'admin', 'manager')
  list(
    @CurrentUser() actor: JwtPayload,
    @Query(new ZodValidationPipe(UserQuerySchema)) q: UserQueryDto,
  ) {
    return this.svc.list(actor.tenant_id, actor.role, actor.branch_id, q)
  }

  @Get('me')
  @Roles('owner', 'admin', 'manager', 'cashier')
  getMe(@CurrentUser() actor: JwtPayload) {
    return this.svc.getById(actor.tenant_id, actor.sub, actor.role, actor.branch_id, actor.sub)
  }

  @Get(':id')
  @Roles('owner', 'admin', 'manager', 'cashier')
  getById(
    @CurrentUser() actor: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.getById(actor.tenant_id, actor.sub, actor.role, actor.branch_id, id)
  }

  // ─── Mutations ─────────────────────────────────────────────────────────────

  @Post()
  @Roles('owner', 'admin')
  create(
    @CurrentUser() actor: JwtPayload,
    @Body(new ZodValidationPipe(CreateUserSchema)) dto: CreateUserDto,
  ) {
    return this.svc.create(actor.tenant_id, actor.role, dto)
  }

  @Patch('me/password')
  @Roles('owner', 'admin', 'manager', 'cashier')
  @HttpCode(HttpStatus.NO_CONTENT)
  changePassword(
    @CurrentUser() actor: JwtPayload,
    @Body(new ZodValidationPipe(ChangePasswordSchema)) dto: ChangePasswordDto,
  ) {
    return this.svc.changePassword(actor.tenant_id, actor.sub, actor.sub, dto)
  }

  @Patch(':id')
  @Roles('owner', 'admin', 'manager', 'cashier')
  update(
    @CurrentUser() actor: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateUserSchema)) dto: UpdateUserDto,
  ) {
    return this.svc.update(actor.tenant_id, actor.sub, actor.role, id, dto)
  }

  @Post(':id/reset-password')
  @Roles('owner', 'admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  resetPassword(
    @CurrentUser() actor: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ResetPasswordSchema)) dto: ResetPasswordDto,
  ) {
    return this.svc.resetPassword(actor.tenant_id, actor.role, id, dto)
  }

  @Delete(':id')
  @Roles('owner', 'admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  deactivate(
    @CurrentUser() actor: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.deactivate(actor.tenant_id, actor.sub, actor.role, id)
  }
}
