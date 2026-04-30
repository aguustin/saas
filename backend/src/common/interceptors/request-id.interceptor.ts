import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common'
import { Observable } from 'rxjs'
import { ulid } from 'ulidx'

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const req = ctx.switchToHttp().getRequest()
    req.id = req.headers['x-request-id'] ?? ulid()
    ctx.switchToHttp().getResponse().setHeader('x-request-id', req.id)
    return next.handle()
  }
}
