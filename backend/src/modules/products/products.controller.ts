import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { ProductsService }   from './products.service'
import { TenantGuard }       from '@common/guards/tenant.guard'
import { RolesGuard }        from '@common/guards/roles.guard'
import { CurrentUser }       from '@common/decorators/current-user.decorator'
import { Roles }             from '@common/decorators/roles.decorator'
import { ZodValidationPipe } from '@common/pipes/zod-validation.pipe'
import {
  CreateProductSchema, CreateProductDto,
  UpdateProductSchema, UpdateProductDto,
  ProductQuerySchema,  ProductQueryDto,
  SetActiveSchema,     SetActiveDto,
  BulkDeleteSchema,    BulkDeleteDto,
} from './dto/product.dto'
import type { JwtPayload } from '@common/types/jwt-payload'

@ApiTags('Products')
@ApiBearerAuth()
@Controller('products')
@UseGuards(TenantGuard, RolesGuard)
// JwtAuthGuard aplica globalmente desde AppModule
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  // ─── GET /products ────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List products with filters and pagination' })
  list(
    @CurrentUser() user: JwtPayload,
    @Query(new ZodValidationPipe(ProductQuerySchema)) query: ProductQueryDto,
  ) {
    return this.productsService.list(user.tenant_id, query)
  }

  // ─── GET /products/barcode/:barcode ───────────────────────────────────────
  // Antes de /:id para que no colisione con el ParseUUIDPipe

  @Get('barcode/:barcode')
  @ApiOperation({ summary: 'Find product by barcode (POS scan)' })
  getByBarcode(
    @CurrentUser() user: JwtPayload,
    @Param('barcode') barcode: string,
  ) {
    return this.productsService.getByBarcode(user.tenant_id, barcode)
  }

  // ─── GET /products/:id ────────────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({ summary: 'Get product by ID' })
  getById(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.productsService.getById(user.tenant_id, id)
  }

  // ─── POST /products ───────────────────────────────────────────────────────

  @Post()
  @Roles('owner', 'admin', 'manager')
  @ApiOperation({ summary: 'Create product (enforces plan limits)' })
  create(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(CreateProductSchema)) dto: CreateProductDto,
  ) {
    return this.productsService.create(user.tenant_id, user.plan, dto)
  }

  // ─── PATCH /products/:id ──────────────────────────────────────────────────

  @Patch(':id')
  @Roles('owner', 'admin', 'manager')
  @ApiOperation({ summary: 'Update product fields' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateProductSchema)) dto: UpdateProductDto,
  ) {
    return this.productsService.update(user.tenant_id, id, dto)
  }

  // ─── PATCH /products/:id/active ───────────────────────────────────────────

  @Patch(':id/active')
  @Roles('owner', 'admin', 'manager')
  @ApiOperation({ summary: 'Enable or disable product' })
  setActive(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(SetActiveSchema)) dto: SetActiveDto,
  ) {
    return this.productsService.setActive(user.tenant_id, id, dto)
  }

  // ─── DELETE /products/:id ─────────────────────────────────────────────────

  @Delete(':id')
  @Roles('owner', 'admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete product' })
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.productsService.remove(user.tenant_id, id)
  }

  // ─── DELETE /products/bulk ────────────────────────────────────────────────

  @Delete('bulk')
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Soft-delete multiple products' })
  bulkRemove(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(BulkDeleteSchema)) dto: BulkDeleteDto,
  ) {
    return this.productsService.bulkRemove(user.tenant_id, dto)
  }
}
