import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common'
import { TenantContextStore } from '@common/context/tenant.context'
import { TenantsService }     from '@modules/tenants/tenants.service'
import type { JwtPayload }    from '@common/types/jwt-payload'

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private tenantsService: TenantsService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const request = ctx.switchToHttp().getRequest()
    const user    = request.user as JwtPayload | undefined

    if (!user?.tenant_id) throw new UnauthorizedException('No tenant in token')

    const tenant = await this.tenantsService.findActiveById(user.tenant_id)
    if (!tenant)                       throw new ForbiddenException('Tenant not found')
    if (tenant.status === 'suspended') throw new ForbiddenException('Account suspended')
    if (tenant.status === 'cancelled') throw new ForbiddenException('Account cancelled')
    if (
      tenant.planExpiresAt &&
      tenant.planExpiresAt < new Date() &&
      tenant.status !== 'trial'
    ) {
      throw new ForbiddenException('Subscription expired')
    }

    // enterWith() sets the AsyncLocalStorage context for the current async chain
    // and all continuations (controller, service calls, etc.) without a callback wrapper.
    // This is the correct pattern for guards — run() would scope out before the pipeline continues.
    TenantContextStore.enterWith({
      tenantId:  user.tenant_id,
      userId:    user.sub,
      role:      user.role,
      plan:      user.plan,
      branchId:  user.branch_id,
      requestId: request.id ?? '',
    })

    return true
  }
}
