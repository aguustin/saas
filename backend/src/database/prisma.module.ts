import { Global, Module } from '@nestjs/common'
import { PrismaService }       from './prisma.service'
import { PrismaTenantService } from './prisma-tenant.service'

@Global()
@Module({
  providers: [PrismaService, PrismaTenantService],
  exports:   [PrismaService, PrismaTenantService],
})
export class PrismaModule {}
