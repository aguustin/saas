import { Module }          from '@nestjs/common'
import { AuthController }  from './auth.controller'
import { AuthService }     from './auth.service'
import { TokenService }    from './token.service'
import { AuthCleanupCron } from './auth-cleanup.cron'

@Module({
  controllers: [AuthController],
  providers:   [AuthService, TokenService, AuthCleanupCron],
  exports:     [TokenService],
})
export class AuthModule {}
