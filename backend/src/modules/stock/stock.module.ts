import { Module }          from '@nestjs/common'
import { StockController } from './stock.controller'
import { StockService }    from './stock.service'
import { StockRepository } from './stock.repository'

@Module({
  controllers: [StockController],
  providers:   [StockService, StockRepository],
  exports:     [StockService],
})
export class StockModule {}
