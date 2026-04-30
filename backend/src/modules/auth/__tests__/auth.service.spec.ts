import { Test, TestingModule }  from '@nestjs/testing'
import { UnauthorizedException } from '@nestjs/common'
import { AuthService }           from '../auth.service'
import { TokenService }          from '../token.service'
import { PrismaService }         from '@database/prisma.service'
import { mockPrisma }            from '../../../test/helpers/mock-prisma'
import { TENANT_ID, USER_ID }    from '../../../test/helpers/fixtures'
import * as bcrypt               from 'bcryptjs'

jest.mock('bcryptjs')
const bcryptCompare = bcrypt.compare as jest.Mock

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ACTIVE_USER = {
  id:            USER_ID,
  email:         'owner@acme.com',
  password_hash: '$2b$10$hashedpassword',
  role:          'owner',
  branch_id:     null,
  is_active:     true,
}

const TOKEN_PAIR = { access_token: 'access.jwt', refresh_token: 'refresh.jwt', expires_in: 900 }
const LOGIN_DTO  = { email: 'owner@acme.com', password: 'secret', device_id: 'device-001', device_name: 'iPhone' }
const IP         = '127.0.0.1'
const UA         = 'TestAgent/1.0'

// ─── Helper: set up a standard happy-path login sequence ─────────────────────
// prisma.$queryRawUnsafe is called twice: (1) SELECT user, (2) UPDATE last_login_at
// prisma.$queryRaw is called once: SELECT plan

function setupHappyPath(prisma: ReturnType<typeof mockPrisma>, userOverride = ACTIVE_USER) {
  prisma.$queryRawUnsafe.mockReset()
  prisma.$queryRaw.mockReset()
  prisma.$executeRawUnsafe.mockReset()
  prisma.$queryRawUnsafe.mockResolvedValueOnce([userOverride])  // SELECT user
  prisma.$queryRaw.mockResolvedValue([{ plan_name: 'pro' }])    // SELECT plan
  // $executeRawUnsafe for UPDATE last_login_at — default mock returns undefined
  bcryptCompare.mockResolvedValue(true)
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('AuthService', () => {
  let service: AuthService
  let prisma:  ReturnType<typeof mockPrisma>
  let tokens:  jest.Mocked<Partial<TokenService>> & {
    generateTokenPair:  jest.Mock
    rotateRefreshToken: jest.Mock
    revokeAllForUser:   jest.Mock
    revokeByDevice:     jest.Mock
    getActiveSessions:  jest.Mock
    revokeSession:      jest.Mock
  }

  beforeEach(async () => {
    prisma = mockPrisma()
    tokens = {
      generateTokenPair:  jest.fn().mockResolvedValue(TOKEN_PAIR),
      rotateRefreshToken: jest.fn().mockResolvedValue({ tokens: TOKEN_PAIR }),
      revokeAllForUser:   jest.fn().mockResolvedValue(undefined),
      revokeByDevice:     jest.fn().mockResolvedValue(undefined),
      getActiveSessions:  jest.fn().mockResolvedValue([]),
      revokeSession:      jest.fn().mockResolvedValue(undefined),
    } as any

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma  },
        { provide: TokenService,  useValue: tokens  },
      ],
    }).compile()

    service = module.get(AuthService)
  })

  afterEach(() => jest.clearAllMocks())

  // ─── login ──────────────────────────────────────────────────────────────────

  describe('login()', () => {
    it('returns token pair on valid credentials', async () => {
      setupHappyPath(prisma)
      const result = await service.login(LOGIN_DTO, TENANT_ID, IP, UA)
      expect(result).toEqual(TOKEN_PAIR)
      expect(tokens.generateTokenPair).toHaveBeenCalledWith(
        expect.objectContaining({ userId: USER_ID, tenantId: TENANT_ID, role: 'owner', plan: 'pro' })
      )
    })

    it('updates last_login_at after successful login', async () => {
      setupHappyPath(prisma)
      await service.login(LOGIN_DTO, TENANT_ID, IP, UA)
      expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('last_login_at'),
        USER_ID,
      )
    })

    it('defaults plan to "free" when tenant has no plan row', async () => {
      setupHappyPath(prisma)
      prisma.$queryRaw.mockResolvedValueOnce([])  // override: no plan
      await service.login(LOGIN_DTO, TENANT_ID, IP, UA)
      expect(tokens.generateTokenPair).toHaveBeenCalledWith(
        expect.objectContaining({ plan: 'free' })
      )
    })

    it('throws UnauthorizedException when user not found', async () => {
      prisma.$queryRawUnsafe.mockResolvedValue([])  // empty result — no user
      await expect(service.login(LOGIN_DTO, TENANT_ID, IP, UA))
        .rejects.toThrow(UnauthorizedException)
    })

    it('throws UnauthorizedException when user is inactive', async () => {
      prisma.$queryRawUnsafe.mockResolvedValue([{ ...ACTIVE_USER, is_active: false }])
      await expect(service.login(LOGIN_DTO, TENANT_ID, IP, UA))
        .rejects.toThrow(UnauthorizedException)
    })

    it('throws UnauthorizedException on wrong password', async () => {
      prisma.$queryRawUnsafe.mockResolvedValue([ACTIVE_USER])
      bcryptCompare.mockResolvedValue(false)
      await expect(service.login(LOGIN_DTO, TENANT_ID, IP, UA))
        .rejects.toThrow(UnauthorizedException)
    })

    it('throws UnauthorizedException on invalid tenantId format', async () => {
      await expect(service.login(LOGIN_DTO, 'not-a-uuid', IP, UA))
        .rejects.toThrow(UnauthorizedException)
    })

    it('does NOT reveal whether email exists (same error for both failure cases)', async () => {
      // Case 1: user not found
      prisma.$queryRawUnsafe.mockResolvedValueOnce([])
      const errNotFound = await service.login(LOGIN_DTO, TENANT_ID, IP, UA).catch(e => e)

      // Case 2: wrong password
      prisma.$queryRawUnsafe.mockResolvedValueOnce([ACTIVE_USER])
      bcryptCompare.mockResolvedValueOnce(false)
      const errBadPassword = await service.login(LOGIN_DTO, TENANT_ID, IP, UA).catch(e => e)

      expect(errNotFound.message).toBe(errBadPassword.message)
    })

    it('uses underscores in schema name (not hyphens — SQL injection guard)', async () => {
      setupHappyPath(prisma)
      await service.login(LOGIN_DTO, TENANT_ID, IP, UA)
      const sqlCall: string = prisma.$queryRawUnsafe.mock.calls[0][0]
      expect(sqlCall).toContain('tenant_aaaaaaaa_0000_0000_0000_000000000001')
      expect(sqlCall).not.toMatch(/tenant_[a-f0-9]+-/)
    })
  })

  // ─── refresh ────────────────────────────────────────────────────────────────

  describe('refresh()', () => {
    it('delegates to tokens.rotateRefreshToken and returns the pair', async () => {
      const dto    = { refresh_token: 'old.refresh', device_id: 'device-001' }
      const result = await service.refresh(dto, IP, UA)

      expect(result).toEqual(TOKEN_PAIR)
      expect(tokens.rotateRefreshToken).toHaveBeenCalledWith({
        rawToken: dto.refresh_token, deviceId: dto.device_id, ipAddress: IP, userAgent: UA,
      })
    })
  })

  // ─── logout ─────────────────────────────────────────────────────────────────

  describe('logout()', () => {
    it('revokes single device when allDevices=false', async () => {
      await service.logout({ userId: USER_ID, tenantId: TENANT_ID, deviceId: 'dev-1', allDevices: false })
      expect(tokens.revokeByDevice).toHaveBeenCalledWith(USER_ID, TENANT_ID, 'dev-1')
      expect(tokens.revokeAllForUser).not.toHaveBeenCalled()
    })

    it('revokes all devices when allDevices=true', async () => {
      await service.logout({ userId: USER_ID, tenantId: TENANT_ID, deviceId: 'dev-1', allDevices: true })
      expect(tokens.revokeAllForUser).toHaveBeenCalledWith(USER_ID, TENANT_ID)
      expect(tokens.revokeByDevice).not.toHaveBeenCalled()
    })
  })
})
