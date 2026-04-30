import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common'
import { Reflector }    from '@nestjs/core'
import { TokenService } from '@modules/auth/token.service'

export const IS_PUBLIC_KEY = 'isPublic'

/**
 * Decorator para marcar endpoints públicos que no requieren JWT.
 * Uso: @Public() en controller o handler.
 */
export function Public(): MethodDecorator & ClassDecorator {
  return (target: any, key?: string | symbol, descriptor?: any) => {
    const obj = descriptor ?? target
    Reflect.defineMetadata(IS_PUBLIC_KEY, true, obj.value ?? obj)
    return descriptor
  }
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private tokens:    TokenService,
    private reflector: Reflector,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ])
    if (isPublic) return true

    const request = ctx.switchToHttp().getRequest()
    const token   = this.extractBearerToken(request)

    if (!token) throw new UnauthorizedException('Missing access token')

    const payload = this.tokens.verifyAccessToken(token)  // lanza si inválido
    request.user  = payload

    return true
  }

  private extractBearerToken(request: any): string | null {
    const auth = request.headers?.authorization ?? ''
    const [type, token] = auth.split(' ')
    return type === 'Bearer' && token ? token : null
  }
}
