import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { SalesService }      from './sales.service'
import { TenantGuard }       from '@common/guards/tenant.guard'
import { RolesGuard }        from '@common/guards/roles.guard'
import { CurrentUser }       from '@common/decorators/current-user.decorator'
import { Roles }             from '@common/decorators/roles.decorator'
import { ZodValidationPipe } from '@common/pipes/zod-validation.pipe'
import {
  CreateSaleSchema, CreateSaleDto,
  SaleQuerySchema,  SaleQueryDto,
  RefundSchema,     RefundDto,
} from './dto/sale.dto'
import type { JwtPayload } from '@common/types/jwt-payload'

@ApiTags('Sales')
@ApiBearerAuth()
@Controller('sales')
@UseGuards(TenantGuard, RolesGuard)
export class SalesController {
  constructor(private salesService: SalesService) {}

  // ─── POST /sales ──────────────────────────────────────────────────────────

  @Post()
  @Roles('owner', 'admin', 'manager', 'cashier')
  @ApiOperation({ summary: 'Create sale — atomic stock decrement + sale record' })
  create(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(CreateSaleSchema)) dto: CreateSaleDto,
  ) {
    return this.salesService.create(user.tenant_id, user.sub, dto)
  }

  // ─── GET /sales ───────────────────────────────────────────────────────────

  @Get()
  @Roles('owner', 'admin', 'manager', 'cashier')
  @ApiOperation({ summary: 'List sales with filters' })
  list(
    @CurrentUser() user: JwtPayload,
    @Query(new ZodValidationPipe(SaleQuerySchema)) query: SaleQueryDto,
  ) {
    return this.salesService.list(user.tenant_id, query)
  }

  // ─── GET /sales/summary ───────────────────────────────────────────────────

  @Get('summary')
  @Roles('owner', 'admin', 'manager', 'cashier')
  @ApiOperation({ summary: 'Daily sales summary for POS dashboard' })
  getDailySummary(
    @CurrentUser() user: JwtPayload,
    @Query('branch_id', ParseUUIDPipe) branchId: string,
    @Query('date') date?: string,
  ) {
    return this.salesService.getDailySummary(user.tenant_id, branchId, date)
  }

  // ─── GET /sales/:id ───────────────────────────────────────────────────────

  @Get(':id')
  @Roles('owner', 'admin', 'manager', 'cashier')
  @ApiOperation({ summary: 'Get sale detail with items' })
  getById(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.salesService.getById(user.tenant_id, id)
  }

  // ─── POST /sales/:id/refund ───────────────────────────────────────────────

  @Post(':id/refund')
  @Roles('owner', 'admin', 'manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refund sale (full or partial) — optionally restocks items' })
  refund(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(RefundSchema)) dto: RefundDto,
  ) {
    return this.salesService.refund(user.tenant_id, id, user.sub, dto)
  }
}
