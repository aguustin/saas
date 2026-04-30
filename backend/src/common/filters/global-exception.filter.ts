import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import { Request, Response } from 'express'
import { Prisma } from '@prisma/client'

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx  = host.switchToHttp()
    const req  = ctx.getRequest<Request>()
    const res  = ctx.getResponse<Response>()

    const { status, message, code } = this.resolve(exception)

    if (status >= 500) {
      this.logger.error(
        { err: exception, req: { method: req.method, url: req.url } },
        'Unhandled exception'
      )
    }

    res.status(status).json({
      statusCode: status,
      code,
      message,
      path:      req.url,
      timestamp: new Date().toISOString(),
    })
  }

  private resolve(exception: unknown): { status: number; message: string; code: string } {
    if (exception instanceof HttpException) {
      const res     = exception.getResponse()
      const message = typeof res === 'object' && 'message' in res
        ? (res as any).message
        : exception.message
      const code = typeof res === 'object' && 'code' in res
        ? (res as any).code
        : 'HTTP_EXCEPTION'
      return { status: exception.getStatus(), message, code }
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.resolvePrismaError(exception)
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      return { status: 400, message: 'Invalid data provided', code: 'VALIDATION_ERROR' }
    }

    return { status: 500, message: 'Internal server error', code: 'INTERNAL_ERROR' }
  }

  private resolvePrismaError(
    err: Prisma.PrismaClientKnownRequestError
  ): { status: number; message: string; code: string } {
    switch (err.code) {
      case 'P2002':
        return { status: 409, message: 'Resource already exists', code: 'DUPLICATE' }
      case 'P2025':
        return { status: 404, message: 'Resource not found', code: 'NOT_FOUND' }
      case 'P2003':
        return { status: 400, message: 'Related resource not found', code: 'FOREIGN_KEY_VIOLATION' }
      default:
        return { status: 500, message: 'Database error', code: 'DB_ERROR' }
    }
  }
}
