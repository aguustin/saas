import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy {

  private readonly logger = new Logger(PrismaService.name)

  constructor(config: ConfigService) {
    super({
      datasources: {
        db: { url: config.getOrThrow<string>('DATABASE_URL') },
      },
      log: config.get('app.isDev')
        ? [{ emit: 'event', level: 'query' }, 'warn', 'error']
        : ['warn', 'error'],
    })
  }

  async onModuleInit(): Promise<void> {
    await this.$connect()
    this.logger.log('Database connected')
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect()
    this.logger.log('Database disconnected')
  }

  // Helper para queries raw con schema de tenant
  tenantSchema(tenantId: string): string {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)) {
      throw new Error(`Invalid tenant ID format: ${tenantId}`)
    }
    return `tenant_${tenantId.replace(/-/g, '_')}`
  }
}
