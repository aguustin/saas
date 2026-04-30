import { PrismaClient, PlanName } from '@prisma/client'

const prisma = new PrismaClient()

async function main(): Promise<void> {
  console.log('🌱 Seeding plans...')

  const plans: Array<{
    name: PlanName
    displayName: string
    priceArs: number
    priceUsd: number
    maxProducts: number | null
    maxBranches: number | null
    maxUsers: number | null
    maxEmployees: number | null
    syncEnabled: boolean
    analyticsLevel: string
    apiAccess: boolean
    sortOrder: number
  }> = [
    {
      name: 'free',    displayName: 'Free',
      priceArs: 0,     priceUsd: 0,
      maxProducts: 100, maxBranches: 1, maxUsers: 2, maxEmployees: 5,
      syncEnabled: false, analyticsLevel: 'none', apiAccess: false, sortOrder: 1,
    },
    {
      name: 'pro',     displayName: 'Pro',
      priceArs: 9900,  priceUsd: 9.9,
      maxProducts: null, maxBranches: 1, maxUsers: 5, maxEmployees: 20,
      syncEnabled: true, analyticsLevel: 'basic', apiAccess: false, sortOrder: 2,
    },
    {
      name: 'premium', displayName: 'Premium',
      priceArs: 24900, priceUsd: 24.9,
      maxProducts: null, maxBranches: 5, maxUsers: 20, maxEmployees: 100,
      syncEnabled: true, analyticsLevel: 'advanced', apiAccess: false, sortOrder: 3,
    },
    {
      name: 'super',   displayName: 'Super',
      priceArs: 59900, priceUsd: 59.9,
      maxProducts: null, maxBranches: null, maxUsers: null, maxEmployees: null,
      syncEnabled: true, analyticsLevel: 'full', apiAccess: true, sortOrder: 4,
    },
  ]

  for (const plan of plans) {
    await prisma.plan.upsert({
      where:  { name: plan.name },
      update: plan,
      create: plan,
    })
    console.log(`  ✓ Plan ${plan.name}`)
  }

  console.log('✅ Seed complete')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
