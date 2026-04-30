import { Test }                from '@nestjs/testing'
import { ForbiddenException }   from '@nestjs/common'
import { SubscriptionsService } from '../subscriptions.service'
import { LimitsService }        from '../limits.service'
import { PrismaService }        from '@database/prisma.service'
import { PrismaTenantService }  from '@database/prisma-tenant.service'
import { RedisService }         from '@database/redis.service'

const TENANT  = 'aaaaaaaa-0000-0000-0000-000000000001'
const PLAN_ID = 'bbbbbbbb-0000-0000-0000-000000000001'

const mockPlan = {
  id: PLAN_ID, name: 'pro', displayName: 'Pro',
  maxProducts: 500, maxBranches: 1, maxUsers: 5, maxEmployees: 20,
  syncEnabled: true, analyticsLevel: 'basic', apiAccess: false,
}

const mockSub = {
  id: 'sub-1', tenantId: TENANT, status: 'active',
  provider: 'stripe', providerSubId: 'sub_stripe_1',
  currentPeriodStart: new Date(),
  currentPeriodEnd:   new Date(Date.now() + 30 * 86400000),
  gracePeriodEndsAt:  null, cancelAtPeriodEnd: false, cancelledAt: null,
  currency: 'USD', amount: { toNumber: () => 9.9 },
  plan: mockPlan,
  createdAt: new Date(),
}

// ─── Helper: build a typed prisma mock ───────────────────────────────────────
// Using Record<string, any> avoids "property does not exist on PrismaClient" TS errors
// while still providing full jest mock capabilities.

type PrismaMock = {
  subscription: Record<string, jest.Mock>
  billingEvent:  Record<string, jest.Mock>
  tenant:        Record<string, jest.Mock>
}

function makePrismaMock(): PrismaMock {
  return {
    subscription: {
      findFirst: jest.fn(),
      create:    jest.fn(),
      update:    jest.fn(),
      findMany:  jest.fn(),
    },
    billingEvent: {
      create:   jest.fn(),
      findMany: jest.fn(),
    },
    tenant: {
      update:     jest.fn(),
      findUnique: jest.fn(),
    },
  }
}

// ─── SubscriptionsService ─────────────────────────────────────────────────────

describe('SubscriptionsService', () => {
  let service: SubscriptionsService
  let prisma:  PrismaMock

  beforeEach(async () => {
    prisma = makePrismaMock()

    const module = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile()

    service = module.get(SubscriptionsService)
  })

  afterEach(() => jest.clearAllMocks())

  describe('activate()', () => {
    const activateArgs = {
      tenantId: TENANT, planId: PLAN_ID, provider: 'stripe' as const,
      providerSubId: 'sub_x', periodStart: new Date(), periodEnd: new Date(),
      currency: 'USD', amount: 9.9,
    }

    it('creates new subscription when none exists', async () => {
      prisma.subscription.findFirst.mockResolvedValue(null)
      prisma.subscription.create.mockResolvedValue(mockSub)
      prisma.tenant.update.mockResolvedValue({})

      await service.activate(activateArgs)

      expect(prisma.subscription.create).toHaveBeenCalled()
      expect(prisma.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'active' }) })
      )
    })

    it('updates existing subscription when one exists', async () => {
      prisma.subscription.findFirst.mockResolvedValue(mockSub)
      prisma.subscription.update.mockResolvedValue(mockSub)
      prisma.tenant.update.mockResolvedValue({})

      await service.activate(activateArgs)

      expect(prisma.subscription.update).toHaveBeenCalled()
      expect(prisma.subscription.create).not.toHaveBeenCalled()
    })
  })

  describe('failPayment()', () => {
    it('sets status to past_due and sets grace period', async () => {
      prisma.subscription.findFirst.mockResolvedValue(mockSub)
      prisma.subscription.update.mockResolvedValue({})
      prisma.tenant.update.mockResolvedValue({})

      await service.failPayment(TENANT)

      expect(prisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'past_due',
            gracePeriodEndsAt: expect.any(Date),
          }),
        })
      )
    })

    it('does nothing when no active subscription', async () => {
      prisma.subscription.findFirst.mockResolvedValue(null)
      await service.failPayment(TENANT)
      expect(prisma.subscription.update).not.toHaveBeenCalled()
    })
  })

  describe('logEvent() — idempotency', () => {
    const eventArgs = {
      tenantId: TENANT, eventType: 'payment_succeeded',
      provider: 'stripe' as const, providerEventId: 'evt_123',
      rawPayload: {},
    }

    it('returns true for new event', async () => {
      prisma.billingEvent.create.mockResolvedValue({})
      expect(await service.logEvent(eventArgs)).toBe(true)
    })

    it('returns false for duplicate event (P2002)', async () => {
      const err: any = new Error('Unique constraint failed')
      err.code = 'P2002'
      prisma.billingEvent.create.mockRejectedValue(err)
      expect(await service.logEvent(eventArgs)).toBe(false)
    })
  })

  describe('expireGracePeriod()', () => {
    it('sets status to unpaid and suspends tenant', async () => {
      prisma.subscription.findFirst.mockResolvedValue({ ...mockSub, status: 'past_due' })
      prisma.subscription.update.mockResolvedValue({})
      prisma.tenant.update.mockResolvedValue({})

      await service.expireGracePeriod(TENANT)

      expect(prisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'unpaid' } })
      )
      expect(prisma.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'suspended' } })
      )
    })
  })
})

// ─── LimitsService ────────────────────────────────────────────────────────────

describe('LimitsService', () => {
  let service:      LimitsService
  let tenantPrisma: { tenantSchema: jest.Mock; $queryRawUnsafe: jest.Mock }
  let redis:        { getJson: jest.Mock; setJson: jest.Mock; del: jest.Mock }
  let prismaMock:   { tenant: { findUnique: jest.Mock } }

  beforeEach(async () => {
    prismaMock = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue({ id: TENANT, plan: { ...mockPlan } }),
      },
    }
    tenantPrisma = {
      tenantSchema:    jest.fn().mockReturnValue('"tenant_test"'),
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ count: 10 }]),
    }
    redis = {
      getJson: jest.fn().mockResolvedValue(null),
      setJson: jest.fn(),
      del:     jest.fn(),
    }

    const module = await Test.createTestingModule({
      providers: [
        LimitsService,
        { provide: PrismaService,        useValue: prismaMock    },
        { provide: PrismaTenantService,   useValue: tenantPrisma },
        { provide: RedisService,          useValue: redis        },
      ],
    }).compile()

    service = module.get(LimitsService)
  })

  afterEach(() => jest.clearAllMocks())

  it('returns limits with current usage from DB', async () => {
    const result = await service.getLimits(TENANT)
    expect(result.plan_name).toBe('pro')
    expect(result.resources.products.current).toBe(10)
    expect(result.resources.products.max).toBe(500)
    expect(result.resources.products.blocked).toBe(false)
  })

  it('throws ForbiddenException when at limit', async () => {
    tenantPrisma.$queryRawUnsafe.mockResolvedValue([{ count: 500 }])
    await expect(service.assertCanCreate(TENANT, 'products')).rejects.toThrow(ForbiddenException)
  })

  it('does not throw when plan has unlimited resources (null max)', async () => {
    prismaMock.tenant.findUnique.mockResolvedValue({
      id: TENANT, plan: { ...mockPlan, maxProducts: null },
    })
    await expect(service.assertCanCreate(TENANT, 'products')).resolves.toBeUndefined()
  })

  it('uses Redis cache on second call — skips $queryRawUnsafe', async () => {
    redis.getJson.mockResolvedValue(42)
    await service.getLimits(TENANT)
    expect(tenantPrisma.$queryRawUnsafe).not.toHaveBeenCalled()
  })
})
