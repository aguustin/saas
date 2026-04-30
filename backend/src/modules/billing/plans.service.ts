import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService }                  from '@database/prisma.service'
import type { PlanDto }                   from './dto/billing.dto'

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  async listActive(): Promise<PlanDto[]> {
    const plans = await this.prisma.plan.findMany({
      where:   { isActive: true },
      orderBy: { sortOrder: 'asc' },
    })
    return plans.map(this.toDto)
  }

  async getByName(name: string): Promise<PlanDto> {
    const plan = await this.prisma.plan.findUnique({ where: { name: name as any } })
    if (!plan) throw new NotFoundException(`Plan '${name}' not found`)
    return this.toDto(plan)
  }

  async getById(id: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id } })
    if (!plan) throw new NotFoundException(`Plan ${id} not found`)
    return plan
  }

  private toDto(plan: any): PlanDto {
    return {
      id:              plan.id,
      name:            plan.name,
      display_name:    plan.displayName,
      price_ars:       Number(plan.priceArs),
      price_usd:       Number(plan.priceUsd),
      max_products:    plan.maxProducts  ?? null,
      max_branches:    plan.maxBranches  ?? null,
      max_users:       plan.maxUsers     ?? null,
      max_employees:   plan.maxEmployees ?? null,
      sync_enabled:    plan.syncEnabled,
      analytics_level: plan.analyticsLevel,
      api_access:      plan.apiAccess,
      sort_order:      plan.sortOrder,
    }
  }
}
