import { Injectable }         from '@nestjs/common'
import { Prisma }             from '@prisma/client'
import { PrismaTenantService }  from '@database/prisma-tenant.service'
import { TenantBaseRepository } from '@common/repositories/tenant-base.repository'

export interface BranchRow {
  id:        string
  name:      string
  address:   string | null
  phone:     string | null
  is_active: boolean
}

@Injectable()
export class BranchesRepository extends TenantBaseRepository {
  constructor(prisma: PrismaTenantService) {
    super(prisma)
  }

  async findAll(tenantId: string): Promise<BranchRow[]> {
    return this.rawQuery<BranchRow>(tenantId, (s) =>
      Prisma.sql`
        SELECT id, name, address, phone, is_active
        FROM ${Prisma.raw(s)}.branches
        WHERE deleted_at IS NULL AND is_active = true
        ORDER BY name ASC
      `
    )
  }
}
