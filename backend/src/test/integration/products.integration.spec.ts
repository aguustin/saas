/**
 * Integration tests — Products module
 *
 * Full HTTP pipeline test. ProductsService is mocked; the test exercises
 * validation, auth guard, roles guard, and response shaping.
 *
 * Run: npm run test:integration
 */

import { Test, TestingModule }   from '@nestjs/testing'
import { INestApplication }      from '@nestjs/common'
import request from 'supertest'
import * as jwt                  from 'jsonwebtoken'
import { ConfigModule }          from '@nestjs/config'
import { Reflector }             from '@nestjs/core'
import { APP_GUARD }             from '@nestjs/core'
import { ProductsController }    from '@modules/products/products.controller'
import { ProductsService }       from '@modules/products/products.service'
import { JwtAuthGuard }          from '@common/guards/jwt-auth.guard'
import { TenantGuard }           from '@common/guards/tenant.guard'
import { RolesGuard }            from '@common/guards/roles.guard'
import { TokenService }          from '@modules/auth/token.service'
import { TENANT_ID, PRODUCT_ID, mockProduct } from '../helpers/fixtures'

const JWT_SECRET = 'test-secret-32-chars-min-length!!'

function signToken(role = 'owner', plan = 'pro'): string {
  return jwt.sign(
    { sub: 'user-001', tenant_id: TENANT_ID, role, plan, branch_id: null },
    JWT_SECRET,
    { expiresIn: 900 },
  )
}

function bearer(role = 'owner', plan = 'pro') {
  return { Authorization: `Bearer ${signToken(role, plan)}` }
}

describe('Products — Integration (HTTP)', () => {
  let app:     INestApplication
  let service: jest.Mocked<ProductsService>

  beforeAll(async () => {
    service = {
      list:       jest.fn().mockResolvedValue({ data: [mockProduct], total: 1, page: 1, limit: 20 }),
      getById:    jest.fn().mockResolvedValue(mockProduct),
      getByBarcode: jest.fn().mockResolvedValue(mockProduct),
      create:     jest.fn().mockResolvedValue(mockProduct),
      update:     jest.fn().mockResolvedValue(mockProduct),
      setActive:  jest.fn().mockResolvedValue(mockProduct),
      remove:     jest.fn().mockResolvedValue(undefined),
      bulkRemove: jest.fn().mockResolvedValue({ deleted: 2 }),
    } as any

    const tokenService = {
      verifyAccessToken: jest.fn().mockImplementation((token: string) =>
        jwt.verify(token, JWT_SECRET)
      ),
    }

    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      controllers: [ProductsController],
      providers: [
        { provide: ProductsService, useValue: service      },
        { provide: TokenService,    useValue: tokenService },
        { provide: APP_GUARD,       useClass: JwtAuthGuard },
        TenantGuard,
        RolesGuard,
        Reflector,
      ],
    }).compile()

    app = module.createNestApplication()
    await app.init()
  })

  afterAll(() => app.close())
  afterEach(() => jest.clearAllMocks())

  // ─── GET /products ───────────────────────────────────────────────────────────

  describe('GET /products', () => {
    it('200 with paginated list for authenticated user', async () => {
      const res = await request(app.getHttpServer())
        .get('/products')
        .set(bearer())

      expect(res.status).toBe(200)
      expect(res.body.data.data).toHaveLength(1)
      expect(res.body.data.data[0].id).toBe(PRODUCT_ID)
    })

    it('401 without token', async () => {
      const res = await request(app.getHttpServer()).get('/products')
      expect(res.status).toBe(401)
    })

    it('passes tenant_id from JWT to service', async () => {
      await request(app.getHttpServer()).get('/products').set(bearer())
      expect(service.list).toHaveBeenCalledWith(TENANT_ID, expect.any(Object))
    })
  })

  // ─── GET /products/:id ───────────────────────────────────────────────────────

  describe('GET /products/:id', () => {
    it('200 returns product', async () => {
      const res = await request(app.getHttpServer())
        .get(`/products/${PRODUCT_ID}`)
        .set(bearer())

      expect(res.status).toBe(200)
      expect(res.body.data.id).toBe(PRODUCT_ID)
    })

    it('404 when service throws NotFoundException', async () => {
      const { NotFoundException } = await import('@nestjs/common')
      service.getById.mockRejectedValueOnce(new NotFoundException('Product not found'))

      const res = await request(app.getHttpServer())
        .get(`/products/${PRODUCT_ID}`)
        .set(bearer())

      expect(res.status).toBe(404)
    })
  })

  // ─── POST /products ──────────────────────────────────────────────────────────

  describe('POST /products', () => {
    const body = { name: 'New Widget', price: 99.99, cost: 50.00 }

    it('201 creates product for owner/admin/manager', async () => {
      for (const role of ['owner', 'admin', 'manager']) {
        service.create.mockResolvedValueOnce(mockProduct)
        const res = await request(app.getHttpServer())
          .post('/products')
          .set(bearer(role))
          .send(body)

        expect(res.status).toBe(201)
      }
    })

    it('403 for cashier role', async () => {
      const res = await request(app.getHttpServer())
        .post('/products')
        .set(bearer('cashier'))
        .send(body)

      expect(res.status).toBe(403)
    })

    it('400 when price is missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/products')
        .set(bearer())
        .send({ name: 'No price' })

      expect(res.status).toBe(400)
    })

    it('400 when price is negative', async () => {
      const res = await request(app.getHttpServer())
        .post('/products')
        .set(bearer())
        .send({ name: 'Neg', price: -1, cost: 0 })

      expect(res.status).toBe(400)
    })

    it('403 when plan limit reached', async () => {
      const { ForbiddenException } = await import('@nestjs/common')
      service.create.mockRejectedValueOnce(new ForbiddenException({ code: 'PLAN_LIMIT_REACHED' }))

      const res = await request(app.getHttpServer())
        .post('/products')
        .set(bearer('owner', 'free'))
        .send(body)

      expect(res.status).toBe(403)
    })
  })

  // ─── PATCH /products/:id ─────────────────────────────────────────────────────

  describe('PATCH /products/:id', () => {
    it('200 updates product', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/products/${PRODUCT_ID}`)
        .set(bearer())
        .send({ name: 'Updated Widget' })

      expect(res.status).toBe(200)
    })

    it('403 for cashier', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/products/${PRODUCT_ID}`)
        .set(bearer('cashier'))
        .send({ name: 'X' })

      expect(res.status).toBe(403)
    })
  })

  // ─── DELETE /products/:id ────────────────────────────────────────────────────

  describe('DELETE /products/:id', () => {
    it('204 on successful delete', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/products/${PRODUCT_ID}`)
        .set(bearer('owner'))

      expect(res.status).toBe(204)
    })

    it('403 for manager and below', async () => {
      for (const role of ['manager', 'cashier']) {
        const res = await request(app.getHttpServer())
          .delete(`/products/${PRODUCT_ID}`)
          .set(bearer(role))

        expect(res.status).toBe(403)
      }
    })
  })

  // ─── DELETE /products/bulk ───────────────────────────────────────────────────

  describe('DELETE /products/bulk', () => {
    it('200 returns deleted count for owner/admin', async () => {
      const res = await request(app.getHttpServer())
        .delete('/products/bulk')
        .set(bearer('owner'))
        .send({ ids: [PRODUCT_ID, 'other-id'] })

      expect(res.status).toBe(200)
      expect(res.body.data).toEqual({ deleted: 2 })
    })

    it('400 when ids array is empty', async () => {
      const res = await request(app.getHttpServer())
        .delete('/products/bulk')
        .set(bearer())
        .send({ ids: [] })

      expect(res.status).toBe(400)
    })
  })
})
