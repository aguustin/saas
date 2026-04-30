import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core'
import { BullModule } from '@nestjs/bullmq'
import { ScheduleModule } from '@nestjs/schedule'
import { LoggerModule } from 'nestjs-pino'

import { validateEnv } from '@config/env.validation'
import {
  appConfig,
  jwtConfig,
  redisConfig,
  stripeConfig,
  mpConfig,
} from '@config/app.config'

import { PrismaModule }          from './database/prisma.module'
import { RedisModule }           from './database/redis.module'
import { TenantsModule }           from '@modules/tenants/tenants.module'
import { ProductsModule }          from '@modules/products/products.module'
import { AuthModule }              from '@modules/auth/auth.module'
import { SalesModule }             from '@modules/sales/sales.module'
import { StockModule }             from '@modules/stock/stock.module'
import { UsersModule }             from '@modules/users/users.module'
import { EmployeesModule }         from '@modules/employees/employees.module'
import { SyncModule }              from '@modules/sync/sync.module'
import { BillingModule }           from '@modules/billing/billing.module'
import { JobsModule }              from '@modules/jobs/jobs.module'
import { BranchesModule }          from '@modules/branches/branches.module'
import { PaymentsModule }          from '@modules/payments/payments.module'
import { TenantContextMiddleware } from '@common/middleware/tenant-context.middleware'

import { GlobalExceptionFilter }        from '@common/filters/global-exception.filter'
import { RequestIdInterceptor }         from '@common/interceptors/request-id.interceptor'
import { ResponseTransformInterceptor } from '@common/interceptors/response-transform.interceptor'
import { JwtAuthGuard }                 from '@common/guards/jwt-auth.guard'
import { APP_GUARD }                    from '@nestjs/core'

@Module({
  imports: [
    // ─── Config ─────────────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal:     true,
      validate:     validateEnv,
      load:         [appConfig, jwtConfig, redisConfig, stripeConfig, mpConfig],
      envFilePath:  ['.env.local', '.env'],
      cache:        true,
    }),

    // ─── Logger (Pino) ───────────────────────────────────────────────
    LoggerModule.forRootAsync({
      inject:     [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level:     config.get('app.isDev') ? 'debug' : 'info',
          transport: config.get('app.isDev')
            ? { target: 'pino-pretty', options: { colorize: true, singleLine: true } }
            : undefined,
          redact:    ['req.headers.authorization', 'req.body.password'],
          customProps: (req: any) => ({ requestId: req.id }),
        },
      }),
    }),

    // ─── BullMQ ──────────────────────────────────────────────────────
    BullModule.forRootAsync({
      inject:     [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.getOrThrow('REDIS_HOST'),
          port: config.getOrThrow('REDIS_PORT'),
        },
        defaultJobOptions: {
          attempts:    3,
          backoff:     { type: 'exponential', delay: 1000 },
          removeOnComplete: { count: 100 },
          removeOnFail:     { count: 500 },
        },
      }),
    }),

    // ─── Scheduler ──────────────────────────────────────────────────
    ScheduleModule.forRoot(),

    // ─── Core ────────────────────────────────────────────────────────
    PrismaModule,
    RedisModule,

    // ─── Feature modules ──────────────────────────────────────────────
    TenantsModule,
    ProductsModule,
    AuthModule,
    SalesModule,
    StockModule,
    UsersModule,
    EmployeesModule,
    SyncModule,
    BillingModule,
    JobsModule,
    BranchesModule,
    PaymentsModule,
  ],
  providers: [
    { provide: APP_FILTER,      useClass: GlobalExceptionFilter },
    { provide: APP_GUARD,       useClass: JwtAuthGuard },       // global — usar @Public() para eximir
    { provide: APP_INTERCEPTOR, useClass: RequestIdInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ResponseTransformInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantContextMiddleware).forRoutes('*')
  }
}
