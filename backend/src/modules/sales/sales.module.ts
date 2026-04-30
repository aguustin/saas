import { Module }         from '@nestjs/common'
import { SalesController } from './sales.controller'
import { SalesService }    from './sales.service'
import { SalesRepository } from './sales.repository'

@Module({
  controllers: [SalesController],
  providers:   [SalesService, SalesRepository],
  exports:     [SalesService],
})
export class SalesModule {}
