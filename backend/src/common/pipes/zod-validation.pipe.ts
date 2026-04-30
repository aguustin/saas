import { PipeTransform, BadRequestException } from '@nestjs/common'
import { ZodSchema, ZodError } from 'zod'

export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value)
    if (!result.success) {
      throw new BadRequestException({
        code:    'VALIDATION_ERROR',
        message: this.formatErrors(result.error),
      })
    }
    return result.data
  }

  private formatErrors(error: ZodError): string {
    return error.errors
      .map(e => `${e.path.join('.')}: ${e.message}`)
      .join(', ')
  }
}
