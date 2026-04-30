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
import { EmployeesService }  from './employees.service'
import { TenantGuard }       from '@common/guards/tenant.guard'
import { RolesGuard }        from '@common/guards/roles.guard'
import { Roles }             from '@common/decorators/roles.decorator'
import { CurrentUser }       from '@common/decorators/current-user.decorator'
import { ZodValidationPipe } from '@common/pipes/zod-validation.pipe'
import type { JwtPayload }   from '@common/types/jwt-payload'
import {
  CreateEmployeeSchema,
  UpdateEmployeeSchema,
  EmployeeQuerySchema,
  type CreateEmployeeDto,
  type UpdateEmployeeDto,
  type EmployeeQueryDto,
} from './dto/employee.dto'

@UseGuards(TenantGuard, RolesGuard)
@Controller('employees')
export class EmployeesController {
  constructor(private readonly svc: EmployeesService) {}

  @Get()
  @Roles('owner', 'admin', 'manager')
  list(
    @CurrentUser() actor: JwtPayload,
    @Query(new ZodValidationPipe(EmployeeQuerySchema)) q: EmployeeQueryDto,
  ) {
    return this.svc.list(actor.tenant_id, actor.role, actor.branch_id, q)
  }

  @Get(':id')
  @Roles('owner', 'admin', 'manager')
  getById(
    @CurrentUser() actor: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.getById(actor.tenant_id, actor.role, actor.branch_id, id)
  }

  @Post()
  @Roles('owner', 'admin', 'manager')
  create(
    @CurrentUser() actor: JwtPayload,
    @Body(new ZodValidationPipe(CreateEmployeeSchema)) dto: CreateEmployeeDto,
  ) {
    return this.svc.create(actor.tenant_id, actor.role, actor.branch_id, dto)
  }

  @Patch(':id')
  @Roles('owner', 'admin', 'manager')
  update(
    @CurrentUser() actor: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateEmployeeSchema)) dto: UpdateEmployeeDto,
  ) {
    return this.svc.update(actor.tenant_id, actor.role, actor.branch_id, id, dto)
  }

  @Delete(':id')
  @Roles('owner', 'admin', 'manager')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() actor: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.remove(actor.tenant_id, actor.role, actor.branch_id, id)
  }
}
