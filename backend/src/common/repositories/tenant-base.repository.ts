import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaTenantService } from '@database/prisma-tenant.service'
import type { PaginatedResult, PaginationQuery } from '@common/types/pagination'

/**
 * Base para todos los repositorios que operan en schemas de tenant.
 * Nunca usa search_path — siempre schema explícito y parametrizado.
 */
@Injectable()
export abstract class TenantBaseRepository {
  constructor(protected prisma: PrismaTenantService) {}

  protected schema(tenantId: string): string {
    return this.prisma.tenantSchema(tenantId)
  }

  protected async rawQuery<T>(
    tenantId: string,
    sql: (schema: string) => Prisma.Sql,
  ): Promise<T[]> {
    return this.prisma.tenantQuery<T>(tenantId, sql)
  }

  protected async rawExecute(
    tenantId: string,
    sql: (schema: string) => Prisma.Sql,
  ): Promise<number> {
    return this.prisma.tenantExecute(tenantId, sql)
  }

  protected paginate<T>(
    items: T[],
    total: number,
    query: PaginationQuery,
  ): PaginatedResult<T> {
    return {
      items,
      total,
      limit:  query.limit  ?? 50,
      offset: query.offset ?? 0,
    }
  }
}
