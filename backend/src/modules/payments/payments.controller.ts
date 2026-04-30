import {
  Controller,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { PaymentsService }    from './payments.service'
import { TenantGuard }        from '@common/guards/tenant.guard'
import { RolesGuard }         from '@common/guards/roles.guard'
import { CurrentUser }        from '@common/decorators/current-user.decorator'
import { Roles }              from '@common/decorators/roles.decorator'
import { ZodValidationPipe }  from '@common/pipes/zod-validation.pipe'
import { CreateSaleSchema, CreateSaleDto } from '@modules/sales/dto/sale.dto'
import type { JwtPayload }    from '@common/types/jwt-payload'

@ApiTags('Payments')
@ApiBearerAuth()
@Controller('payments')
@UseGuards(TenantGuard, RolesGuard)
export class PaymentsController {
  constructor(private readonly svc: PaymentsService) {}

  @Post('mp/qr')
  @Roles('owner', 'admin', 'manager', 'cashier')
  @ApiOperation({ summary: 'Create pending sale + MP QR preference for POS' })
  createMpQR(
    @Body(new ZodValidationPipe(CreateSaleSchema)) body: CreateSaleDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.svc.createMpQR({
      tenantId:  actor.tenant_id,
      cashierId: actor.sub,
      dto:       body,
    })
  }

  @Delete('mp/qr/:saleId')
  @Roles('owner', 'admin', 'manager', 'cashier')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancel pending MP QR payment and restore stock' })
  cancelMpQR(
    @Param('saleId', ParseUUIDPipe) saleId: string,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.svc.cancelMpQR(actor.tenant_id, saleId)
  }
}
