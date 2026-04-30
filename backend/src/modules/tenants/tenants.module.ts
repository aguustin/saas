import { Global, Module } from '@nestjs/common'
import { TenantsService }         from './tenants.service'
import { TenantMigrationRunner }  from '@database/tenant-migration.runner'

@Global()
@Module({
  providers: [TenantsService, TenantMigrationRunner],
  exports:   [TenantsService, TenantMigrationRunner],
})
export class TenantsModule {}
