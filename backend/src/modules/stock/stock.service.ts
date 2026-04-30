import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { StockRepository, InsufficientTransferStockError } from './stock.repository'
import type {
  AddStockDto,
  AdjustStockDto,
  TransferStockDto,
  SetMinStockDto,
  MovementQueryDto,
  StockQueryDto,
} from './dto/stock.dto'

@Injectable()
export class StockService {
  constructor(private readonly repo: StockRepository) {}

  list(tenantId: string, q: StockQueryDto) {
    return this.repo.findStock(tenantId, q)
  }

  getByProduct(tenantId: string, productId: string) {
    return this.repo.findStockByProduct(tenantId, productId)
  }

  getAlerts(tenantId: string, branchId?: string) {
    return this.repo.getAlerts(tenantId, branchId)
  }

  listMovements(tenantId: string, q: MovementQueryDto) {
    return this.repo.findMovements(tenantId, q)
  }

  async addStock(tenantId: string, userId: string, dto: AddStockDto) {
    return this.repo.upsertAndAdd({
      tenantId:    tenantId,
      productId:   dto.product_id,
      branchId:    dto.branch_id,
      quantity:    dto.quantity,
      type:        dto.type,
      createdBy:   userId,
      note:        dto.note,
      referenceId: dto.reference_id,
    })
  }

  async adjustStock(tenantId: string, userId: string, dto: AdjustStockDto) {
    return this.repo.adjust({
      tenantId:    tenantId,
      productId:   dto.product_id,
      branchId:    dto.branch_id,
      newQuantity: dto.new_quantity,
      createdBy:   userId,
      note:        dto.note,
    })
  }

  async transferStock(tenantId: string, userId: string, dto: TransferStockDto) {
    try {
      return await this.repo.transfer({
        tenantId:     tenantId,
        productId:    dto.product_id,
        fromBranchId: dto.from_branch_id,
        toBranchId:   dto.to_branch_id,
        quantity:     dto.quantity,
        createdBy:    userId,
        note:         dto.note,
      })
    } catch (err) {
      if (err instanceof InsufficientTransferStockError) {
        throw new UnprocessableEntityException({
          code:      'INSUFFICIENT_TRANSFER_STOCK',
          message:   `Not enough stock to transfer: available ${err.available}, requested ${err.requested}`,
          available: err.available,
          requested: err.requested,
        })
      }
      throw err
    }
  }

  async createMovement(tenantId: string, userId: string, dto: import('./dto/stock.dto').CreateMovementDto) {
    return this.repo.upsertAndAddReturningMovement({
      tenantId:    tenantId,
      productId:   dto.product_id,
      branchId:    dto.branch_id,
      quantity:    dto.quantity,
      type:        dto.type,
      createdBy:   userId,
      note:        dto.note,
      referenceId: dto.reference_id,
    })
  }

  async setMinStock(tenantId: string, dto: SetMinStockDto) {
    const result = await this.repo.setMinQuantity({
      tenantId:    tenantId,
      productId:   dto.product_id,
      branchId:    dto.branch_id,
      minQuantity: dto.min_quantity,
    })
    if (!result) {
      throw new NotFoundException('Stock record not found for given product and branch')
    }
    return result
  }
}
