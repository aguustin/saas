import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ROLES_KEY } from '@common/decorators/roles.decorator'
import type { UserRole, JwtPayload } from '@common/types/jwt-payload'

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ])
    if (!required?.length) return true

    const user: JwtPayload = ctx.switchToHttp().getRequest().user
    if (!required.includes(user.role)) {
      throw new ForbiddenException(`Role '${user.role}' is not allowed. Required: ${required.join(', ')}`)
    }

    return true
  }
}
