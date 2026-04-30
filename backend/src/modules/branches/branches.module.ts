import { Module }              from '@nestjs/common'
import { BranchesController } from './branches.controller'
import { BranchesRepository } from './branches.repository'

@Module({
  controllers: [BranchesController],
  providers:   [BranchesRepository],
  exports:     [BranchesRepository],
})
export class BranchesModule {}
