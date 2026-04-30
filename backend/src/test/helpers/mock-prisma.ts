// ─── Reusable Prisma mock factory ────────────────────────────────────────────
// Usage: const prisma = mockPrisma()
// Override per-test: prisma.$queryRawUnsafe.mockResolvedValueOnce([...])

export function mockPrisma() {
  return {
    $queryRaw:       jest.fn(),
    $queryRawUnsafe: jest.fn(),
    $executeRaw:     jest.fn(),
    $executeRawUnsafe: jest.fn(),
    $transaction:    jest.fn(),
    tenant:          { findMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn() },
    plan:            { findMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn() },
    refreshToken:    { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), deleteMany: jest.fn() },
  }
}

export function mockRedis() {
  return {
    get:           jest.fn().mockResolvedValue(null),
    set:           jest.fn().mockResolvedValue('OK'),
    del:           jest.fn().mockResolvedValue(1),
    getJson:       jest.fn().mockResolvedValue(null),
    setJson:       jest.fn().mockResolvedValue(undefined),
    incr:          jest.fn().mockResolvedValue(1),
    acquireLock:   jest.fn().mockResolvedValue('lock-token'),
    releaseLock:   jest.fn().mockResolvedValue(true),
    publishJson:   jest.fn().mockResolvedValue(0),
    checkRateLimit: jest.fn().mockResolvedValue(true),
  }
}

export type MockPrisma = ReturnType<typeof mockPrisma>
export type MockRedis  = ReturnType<typeof mockRedis>
