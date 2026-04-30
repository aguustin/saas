import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from './prisma.service'
import * as fs from 'fs'
import * as path from 'path'

@Injectable()
export class TenantMigrationRunner {
  private readonly logger = new Logger(TenantMigrationRunner.name)
  private readonly templateSql: string

  constructor(private prisma: PrismaService) {
    this.templateSql = fs.readFileSync(
      path.join(__dirname, '../../prisma/tenant-schema.sql'),
      'utf8'
    )
  }

  async run(tenantId: string): Promise<void> {
    const schemaName = this.buildSchemaName(tenantId)

    // Crear schema si no existe
    await this.prisma.$executeRawUnsafe(
      `CREATE SCHEMA IF NOT EXISTS "${schemaName}"`
    )

    // Reemplazar placeholder y ejecutar.
    // Dos pasadas: primero `:schema.` (referencias de tabla, necesitan comillas),
    // luego `:schema` sin punto (nombres de índice, sin comillas).
    const sql = this.templateSql
      .replaceAll(':schema.', `"${schemaName}".`)
      .replaceAll(':schema',   schemaName)

    // Ejecutar statement por statement — $executeRawUnsafe no acepta multi-statement
    const statements = sql
      .split(';')
      .map(s =>
        s.split('\n')
          .filter(line => !line.trim().startsWith('--'))
          .join('\n')
          .trim(),
      )
      .filter(s => s.length > 0)

    for (const stmt of statements) {
      await this.prisma.$executeRawUnsafe(stmt)
    }

    this.logger.log({ tenantId, schema: schemaName }, 'Tenant schema migrated')
  }

  // Correr en todos los tenants existentes (al aplicar migraciones nuevas)
  async runAll(): Promise<void> {
    const tenants = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM tenants WHERE status != 'cancelled'
    `

    this.logger.log(`Running tenant migrations for ${tenants.length} tenants`)

    // Concurrencia controlada: máximo 5 en paralelo para no saturar DB
    const BATCH = 5
    for (let i = 0; i < tenants.length; i += BATCH) {
      const batch = tenants.slice(i, i + BATCH)
      await Promise.all(batch.map(t => this.run(t.id).catch(err => {
        this.logger.error({ tenantId: t.id, err }, 'Failed to migrate tenant schema')
      })))
    }

    this.logger.log('All tenant migrations complete')
  }

  private buildSchemaName(tenantId: string): string {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)) {
      throw new Error(`Invalid tenant ID format: ${tenantId}`)
    }
    return `tenant_${tenantId.replace(/-/g, '_')}`
  }
}
