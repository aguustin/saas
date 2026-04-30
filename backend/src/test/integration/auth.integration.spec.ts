/**
 * Integration tests — Auth module
 *
 * Strategy: spin up the real NestJS application with TestingModule, but mock
 * PrismaService and TokenService so no real DB or Redis is needed.
 * Every test sends a real HTTP request through the full pipeline:
 *   Request → Guard → Controller → Service → (mocked) Repository
 *
 * Run: npm run test:integration
 */

import { Test, TestingModule }   from '@nestjs/testing'
import { INestApplication }      from '@nestjs/common'
import request from 'supertest'
import * as jwt                  from 'jsonwebtoken'
import { ConfigModule }          from '@nestjs/config'
import { APP_GUARD }             from '@nestjs/core'
import { AuthController }        from '@modules/auth/auth.controller'
import { AuthService }           from '@modules/auth/auth.service'
import { TokenService }          from '@modules/auth/token.service'
import { JwtAuthGuard }          from '@common/guards/jwt-auth.guard'
import { TENANT_ID, USER_ID }    from '../helpers/fixtures'

// ─── JWT helper ───────────────────────────────────────────────────────────────

const JWT_SECRET = 'test-secret-32-chars-min-length!!'

function signToken(overrides: Partial<object> = {}): string {
  return jwt.sign(
    { sub: USER_ID, tenant_id: TENANT_ID, role: 'owner', plan: 'pro', branch_id: null, ...overrides },
    JWT_SECRET,
    { expiresIn: 900 },
  )
}

// ─── Mock factories ───────────────────────────────────────────────────────────

const TOKEN_PAIR = { access_token: signToken(), refresh_token: 'raw-refresh-token', expires_in: 900 }

function makeAuthService(): jest.Mocked<AuthService> {
  return {
    login:         jest.fn().mockResolvedValue(TOKEN_PAIR),
    refresh:       jest.fn().mockResolvedValue(TOKEN_PAIR),
    logout:        jest.fn().mockResolvedValue(undefined),
    getSessions:   jest.fn().mockResolvedValue([]),
    revokeSession: jest.fn().mockResolvedValue(undefined),
  } as any
}

function makeTokenService(): jest.Mocked<Pick<TokenService, 'verifyAccessToken'>> {
  return {
    verifyAccessToken: jest.fn().mockImplementation((token: string) => {
      return jwt.verify(token, JWT_SECRET)  // real verify against test secret
    }),
  } as any
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('Auth — Integration (HTTP)', () => {
  let app:         INestApplication
  let authService: jest.Mocked<AuthService>

  beforeAll(async () => {
    authService = makeAuthService()
    const tokenService = makeTokenService()

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
      ],
      controllers: [AuthController],
      providers: [
        { provide: AuthService,  useValue: authService   },
        { provide: TokenService, useValue: tokenService  },
        { provide: APP_GUARD,    useClass: JwtAuthGuard  },
      ],
    }).compile()

    app = module.createNestApplication()
    await app.init()
  })

  afterAll(() => app.close())
  afterEach(() => jest.clearAllMocks())

  // ─── POST /auth/login ────────────────────────────────────────────────────────

  describe('POST /auth/login', () => {
    const body = {
      email:       'owner@acme.com',
      password:    'secret123',
      device_id:   'device-001',
      device_name: 'iPhone 15',
    }

    it('200 with token pair on valid credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .set('x-tenant-id', TENANT_ID)
        .send(body)

      expect(res.status).toBe(200)
      expect(res.body.data).toMatchObject({
        access_token:  expect.any(String),
        refresh_token: expect.any(String),
        expires_in:    900,
      })
    })

    it('calls authService.login with correct tenantId from header', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .set('x-tenant-id', TENANT_ID)
        .send(body)

      expect(authService.login).toHaveBeenCalledWith(
        expect.objectContaining({ email: body.email }),
        TENANT_ID,
        expect.any(String),   // ip
        expect.any(String),   // user-agent
      )
    })

    it('400 when body is missing required fields', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .set('x-tenant-id', TENANT_ID)
        .send({ email: 'bad' })  // missing password + device fields

      expect(res.status).toBe(400)
    })

    it('401 when authService throws UnauthorizedException', async () => {
      const { UnauthorizedException } = await import('@nestjs/common')
      authService.login.mockRejectedValueOnce(new UnauthorizedException('Invalid credentials'))

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .set('x-tenant-id', TENANT_ID)
        .send(body)

      expect(res.status).toBe(401)
    })
  })

  // ─── POST /auth/refresh ──────────────────────────────────────────────────────

  describe('POST /auth/refresh', () => {
    it('200 with new token pair', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refresh_token: 'old-token', device_id: 'device-001' })

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveProperty('access_token')
    })

    it('400 when refresh_token is missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ device_id: 'device-001' })

      expect(res.status).toBe(400)
    })
  })

  // ─── GET /auth/me ────────────────────────────────────────────────────────────

  describe('GET /auth/me', () => {
    it('200 with user payload for authenticated request', async () => {
      const token = signToken()
      const res   = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body.data).toMatchObject({
        user_id:   USER_ID,
        tenant_id: TENANT_ID,
        role:      'owner',
        plan:      'pro',
      })
    })

    it('401 without Authorization header', async () => {
      const res = await request(app.getHttpServer()).get('/auth/me')
      expect(res.status).toBe(401)
    })

    it('401 with invalid token', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer totally.invalid.token')
      expect(res.status).toBe(401)
    })

    it('401 with expired token', async () => {
      const expired = jwt.sign(
        { sub: USER_ID, tenant_id: TENANT_ID, role: 'owner', plan: 'pro' },
        JWT_SECRET,
        { expiresIn: -1 },  // already expired
      )
      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${expired}`)
      expect(res.status).toBe(401)
    })
  })

  // ─── POST /auth/logout ───────────────────────────────────────────────────────

  describe('POST /auth/logout', () => {
    it('204 on successful logout', async () => {
      const token = signToken()
      const res   = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .send({ device_id: 'device-001', all_devices: false })

      expect(res.status).toBe(204)
    })

    it('401 when not authenticated', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/logout')
        .send({ device_id: 'device-001' })

      expect(res.status).toBe(401)
    })
  })
})
