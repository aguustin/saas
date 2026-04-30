import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { StockService }       from './stock.service'
import { TenantGuard }        from '@common/guards/tenant.guard'
import { RolesGuard }         from '@common/guards/roles.guard'
import { Roles }              from '@common/decorators/roles.decorator'
import { CurrentUser }        from '@common/decorators/current-user.decorator'
import { ZodValidationPipe }  from '@common/pipes/zod-validation.pipe'
import type { JwtPayload }    from '@common/types/jwt-payload'
import {
  AddStockSchema,
  AdjustStockSchema,
  TransferStockSchema,
  SetMinStockSchema,
  MovementQuerySchema,
  StockQuerySchema,
  CreateMovementSchema,
  type AddStockDto,
  type AdjustStockDto,
  type TransferStockDto,
  type SetMinStockDto,
  type MovementQueryDto,
  type StockQueryDto,
  type CreateMovementDto,
} from './dto/stock.dto'

@UseGuards(TenantGuard, RolesGuard)
@Controller('stock')
export class StockController {
  constructor(private readonly svc: StockService) {}

  // ─── Lecturas ──────────────────────────────────────────────────────────────

  @Get()
  @Roles('owner', 'manager', 'cashier')
  list(
    @CurrentUser() user: JwtPayload,
    @Query(new ZodValidationPipe(StockQuerySchema)) q: StockQueryDto,
  ) {
    return this.svc.list(user.tenant_id, q)
  }

  @Get('alerts')
  @Roles('owner', 'manager')
  alerts(
    @CurrentUser() user: JwtPayload,
    @Query('branch_id') branchId?: string,
  ) {
    return this.svc.getAlerts(user.tenant_id, branchId)
  }

  @Get('movements')
  @Roles('owner', 'manager')
  movements(
    @CurrentUser() user: JwtPayload,
    @Query(new ZodValidationPipe(MovementQuerySchema)) q: MovementQueryDto,
  ) {
    return this.svc.listMovements(user.tenant_id, q)
  }

  @Get('product/:productId')
  @Roles('owner', 'manager')
  byProduct(
    @CurrentUser() user: JwtPayload,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    return this.svc.getByProduct(user.tenant_id, productId)
  }

  // ─── Mutaciones ────────────────────────────────────────────────────────────

  @Post('movements')
  @Roles('owner', 'manager')
  @HttpCode(HttpStatus.OK)
  createMovement(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(CreateMovementSchema)) dto: CreateMovementDto,
  ) {
    return this.svc.createMovement(user.tenant_id, user.sub, dto)
  }

  @Post('add')
  @Roles('owner', 'manager')
  @HttpCode(HttpStatus.OK)
  add(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(AddStockSchema)) dto: AddStockDto,
  ) {
    return this.svc.addStock(user.tenant_id, user.sub, dto)
  }

  @Post('adjust')
  @Roles('owner', 'manager')
  @HttpCode(HttpStatus.OK)
  adjust(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(AdjustStockSchema)) dto: AdjustStockDto,
  ) {
    return this.svc.adjustStock(user.tenant_id, user.sub, dto)
  }

  @Post('transfer')
  @Roles('owner', 'manager')
  @HttpCode(HttpStatus.OK)
  transfer(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(TransferStockSchema)) dto: TransferStockDto,
  ) {
    return this.svc.transferStock(user.tenant_id, user.sub, dto)
  }

  @Post('min')
  @Roles('owner', 'manager')
  @HttpCode(HttpStatus.OK)
  setMin(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(SetMinStockSchema)) dto: SetMinStockDto,
  ) {
    return this.svc.setMinStock(user.tenant_id, dto)
  }
}
