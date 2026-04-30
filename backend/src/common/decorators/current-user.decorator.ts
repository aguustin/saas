import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import type { JwtPayload } from '@common/types/jwt-payload'

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): JwtPayload =>
    ctx.switchToHttp().getRequest().user
)
