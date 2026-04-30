import { Controller, Get, UseGuards } from '@nestjs/common'
import { TenantGuard }    from '@common/guards/tenant.guard'
import { RolesGuard }     from '@common/guards/roles.guard'
import { Roles }          from '@common/decorators/roles.decorator'
import { CurrentUser }    from '@common/decorators/current-user.decorator'
import { BranchesRepository } from './branches.repository'
import type { JwtPayload } from '@common/types/jwt-payload'

@UseGuards(TenantGuard, RolesGuard)
@Controller('branches')
export class BranchesController {
  constructor(private readonly repo: BranchesRepository) {}

  @Get()
  @Roles('owner', 'admin', 'manager', 'cashier')
  list(@CurrentUser() actor: JwtPayload) {
    return this.repo.findAll(actor.tenant_id)
  }
}
