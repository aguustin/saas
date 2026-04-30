import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { TokenService } from './token.service'

@Injectable()
export class AuthCleanupCron {
  private readonly logger = new Logger(AuthCleanupCron.name)

  constructor(private tokenService: TokenService) {}

  // Cada día a las 3AM — eliminar tokens expirados hace más de 7 días
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanExpiredTokens(): Promise<void> {
    const deleted = await this.tokenService.deleteExpiredTokens()
    this.logger.log(`Cleaned ${deleted} expired refresh tokens`)
  }
}
