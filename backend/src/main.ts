import { NestFactory } from '@nestjs/core'
import { VersioningType } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { Logger } from 'nestjs-pino'
import helmet from 'helmet'
import { AppModule } from './app.module'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true, rawBody: true })

  // ─── Logger ─────────────────────────────────────────────────────────
  app.useLogger(app.get(Logger))
  const logger = app.get(Logger)

  const config = app.get(ConfigService)
  const isDev  = config.get<boolean>('app.isDev')
  const port   = config.getOrThrow<number>('app.port')

  // ─── BigInt serialization ────────────────────────────────────────────
  // Prisma returns BIGINT columns (sync_version) as JS BigInt which
  // JSON.stringify can't handle. Convert to Number via Express replacer.
  app.getHttpAdapter().getInstance().set('json replacer', (_: string, v: unknown) =>
    typeof v === 'bigint' ? Number(v) : v,
  )

  // ─── Security ────────────────────────────────────────────────────────
  app.use(helmet())
  app.enableCors({
    origin:      config.get<string[]>('app.origins'),
    credentials: true,
    methods:     ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  })

  // ─── Versioning ──────────────────────────────────────────────────────
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })
  app.setGlobalPrefix('api')

  // ─── Swagger (dev only) ──────────────────────────────────────────────
  if (isDev) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('SaaS Tiendas API')
      .setVersion('1.0')
      .addBearerAuth()
      .build()
    const document = SwaggerModule.createDocument(app, swaggerConfig)
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    })
    logger.log('Swagger available at /api/docs')
  }

  // ─── Graceful shutdown ───────────────────────────────────────────────
  app.enableShutdownHooks()

  await app.listen(port)
  logger.log(`Application running on port ${port} [${config.get('app.nodeEnv')}]`)
}

bootstrap().catch((err) => {
  console.error('Bootstrap failed:', err)
  process.exit(1)
})
