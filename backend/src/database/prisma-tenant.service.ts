import { Injectable, OnModuleInit, Logger } from '@nestjs/common'
import { PrismaClient, Prisma } from '@prisma/client'
import { ConfigService } from '@nestjs/config'
import { TenantContextStore } from '@common/context/tenant.context'

// Tablas que deben tener tenant_id filtrado automáticamente.
// Agregar aquí cuando se creen nuevas tablas tenant-scoped en el schema global.
const TENANT_SCOPED_MODELS = new Set([
  // En esta arquitectura las tablas tenant-scoped viven en schemas separados
  // y se acceden via $queryRaw con schema explícito.
  // Este middleware protege las tablas del schema global que tienen tenant_id.
  'subscription',
  'billingEvent',
])

@Injectable()
export class PrismaTenantService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaTenantService.name)

  constructor(config: ConfigService) {
    super({
      datasources: { db: { url: config.getOrThrow<string>('DATABASE_URL') } },
      log: config.get('app.isDev')
        ? [{ emit: 'event', level: 'query' }, 'warn', 'error']
        : ['warn', 'error'],
    })

    // Middleware de Prisma: inyecta tenant_id automáticamente en modelos scoped
    this.$use(this.tenantIsolationMiddleware())
  }

  async onModuleInit(): Promise<void> {
    await this.$connect()
    this.logger.log('PrismaTenantService connected')
  }

  // ─── Middleware de aislamiento ─────────────────────────────────────────────

  private tenantIsolationMiddleware(): Prisma.Middleware {
    return async (params, next) => {
      const model = params.model?.toLowerCase()
      if (!model || !TENANT_SCOPED_MODELS.has(params.model ?? '')) {
        return next(params)
      }

      const ctx = TenantContextStore.getOrNull()
      if (!ctx) return next(params)  // ruta pública o seed

      const tenantId = ctx.tenantId

      // ── Writes: inyectar tenant_id ──────────────────────────────────────────
      if (params.action === 'create') {
        params.args.data = { ...params.args.data, tenantId }
      }

      if (params.action === 'createMany') {
        params.args.data = (params.args.data as any[]).map(d => ({ ...d, tenantId }))
      }

      // ── Reads/Updates/Deletes: forzar filtro por tenant ─────────────────────
      const readActions  = ['findUnique', 'findFirst', 'findMany', 'count', 'aggregate', 'groupBy']
      const writeActions = ['update', 'updateMany', 'delete', 'deleteMany', 'upsert']

      if (readActions.includes(params.action) || writeActions.includes(params.action)) {
        params.args.where = {
          ...params.args.where,
          tenantId,                          // sobreescribe cualquier tenantId del caller
        }
      }

      const result = await next(params)

      // ── Verificación post-query para findUnique ──────────────────────────────
      // Si el resultado existe pero pertenece a otro tenant (edge case de race),
      // no devolver el resultado.
      if (params.action === 'findUnique' && result?.tenantId && result.tenantId !== tenantId) {
        this.logger.error(
          { expected: tenantId, got: result.tenantId, model: params.model },
          'CRITICAL: Cross-tenant data leak detected and blocked'
        )
        return null
      }

      return result
    }
  }

  // ─── Schema helper ─────────────────────────────────────────────────────────

  tenantSchema(tenantId: string): string {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)) {
      throw new Error(`Invalid tenant ID: ${tenantId}`)
    }
    return `"tenant_${tenantId.replace(/-/g, '_')}"`
  }

  // ─── Query helpers con schema explícito ────────────────────────────────────
  // Usar siempre estos métodos para queries en schemas de tenant,
  // NUNCA interpolar tenantId directamente en template strings de SQL.

  async tenantQuery<T>(
    tenantId: string,
    sql: (schema: string) => Prisma.Sql,
  ): Promise<T[]> {
    const schema = this.tenantSchema(tenantId)
    return this.$queryRaw<T[]>(sql(schema))
  }

  async tenantExecute(
    tenantId: string,
    sql: (schema: string) => Prisma.Sql,
  ): Promise<number> {
    const schema = this.tenantSchema(tenantId)
    const result = await this.$executeRaw(sql(schema))
    return result
  }
}
