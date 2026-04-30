import { Injectable, NestMiddleware } from '@nestjs/common'
import { Request, Response, NextFunction } from 'express'

/**
 * Passthrough middleware — retained for future use (e.g. rate limiting, request logging).
 * Tenant context is now set via TenantContextStore.enterWith() in TenantGuard,
 * which runs after middleware and correctly propagates through the async pipeline.
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  use(_req: Request, _res: Response, next: NextFunction): void {
    next()
  }
}
