/**
 * Integration tests — Billing webhook pipeline
 *
 * Verifies the full HTTP path for Stripe and MP webhook endpoints:
 * signature validation → enqueue → 200 response.
 *
 * JobsService and payment SDKs are mocked; no BullMQ or Redis required.
 *
 * Run: npm run test:integration
 */

import { Test, TestingModule }   from '@nestjs/testing'
import { INestApplication }      from '@nestjs/common'
import request from 'supertest'
import * as crypto               from 'crypto'
import { ConfigModule }          from '@nestjs/config'
import { WebhooksController }    from '@modules/billing/webhooks.controller'
import { StripeService }         from '@modules/billing/providers/stripe.service'
import { MercadoPagoService }    from '@modules/billing/providers/mercadopago.service'
import { JobsService }           from '@modules/jobs/jobs.service'

// ─── Mock factories ───────────────────────────────────────────────────────────

const STRIPE_WEBHOOK_SECRET = 'whsec_test_secret'
const MP_WEBHOOK_SECRET     = 'mp_test_secret'

function makeStripeService() {
  return {
    constructWebhookEvent: jest.fn().mockReturnValue({
      id:   'evt_test_001',
      type: 'invoice.paid',
      data: { object: {} },
    }),
  }
}

function makeMpService() {
  return {
    validateSignature: jest.fn().mockReturnValue(true),
  }
}

function makeJobsService() {
  return {
    enqueueStripeEvent: jest.fn().mockResolvedValue(undefined),
    enqueueMpEvent:     jest.fn().mockResolvedValue(undefined),
  }
}

// ─── Stripe raw body + signature builder ──────────────────────────────────────

function buildStripeSignature(payload: string): string {
  const ts   = Math.floor(Date.now() / 1000)
  const sig  = crypto
    .createHmac('sha256', STRIPE_WEBHOOK_SECRET)
    .update(`${ts}.${payload}`)
    .digest('hex')
  return `t=${ts},v1=${sig}`
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('Billing Webhooks — Integration (HTTP)', () => {
  let app:         INestApplication
  let stripeService: ReturnType<typeof makeStripeService>
  let mpService:     ReturnType<typeof makeMpService>
  let jobsService:   ReturnType<typeof makeJobsService>

  beforeAll(async () => {
    stripeService = makeStripeService()
    mpService     = makeMpService()
    jobsService   = makeJobsService()

    const module: TestingModule = await Test.createTestingModule({
      imports:     [ConfigModule.forRoot({ isGlobal: true })],
      controllers: [WebhooksController],
      providers: [
        { provide: StripeService,    useValue: stripeService },
        { provide: MercadoPagoService, useValue: mpService  },
        { provide: JobsService,      useValue: jobsService  },
      ],
    }).compile()

    app = module.createNestApplication()

    // rawBody must be enabled for Stripe signature verification
    app.use(require('express').raw({ type: 'application/json' }))

    await app.init()
  })

  afterAll(() => app.close())
  afterEach(() => jest.clearAllMocks())

  // ─── POST /webhooks/stripe ───────────────────────────────────────────────────

  describe('POST /webhooks/stripe', () => {
    const payload = JSON.stringify({ id: 'evt_test_001', type: 'invoice.paid' })

    it('200 and enqueues event on valid signature', async () => {
      const sig = buildStripeSignature(payload)
      const res = await request(app.getHttpServer())
        .post('/webhooks/stripe')
        .set('Content-Type', 'application/json')
        .set('stripe-signature', sig)
        .send(payload)

      expect(res.status).toBe(200)
      expect(res.body).toEqual({ received: true })
      expect(jobsService.enqueueStripeEvent).toHaveBeenCalledWith({
        eventId:   'evt_test_001',
        eventType: 'invoice.paid',
        rawEvent:  expect.any(Object),
      })
    })

    it('400 when stripe-signature header is missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/webhooks/stripe')
        .set('Content-Type', 'application/json')
        .send(payload)

      expect(res.status).toBe(400)
      expect(jobsService.enqueueStripeEvent).not.toHaveBeenCalled()
    })

    it('400 when Stripe rejects signature', async () => {
      stripeService.constructWebhookEvent.mockImplementationOnce(() => {
        throw new Error('No signatures found matching the expected signature for payload.')
      })

      const res = await request(app.getHttpServer())
        .post('/webhooks/stripe')
        .set('Content-Type', 'application/json')
        .set('stripe-signature', 'invalid-signature')
        .send(payload)

      expect(res.status).toBe(400)
      expect(jobsService.enqueueStripeEvent).not.toHaveBeenCalled()
    })

    it('does NOT call enqueueMpEvent for Stripe webhooks', async () => {
      const sig = buildStripeSignature(payload)
      await request(app.getHttpServer())
        .post('/webhooks/stripe')
        .set('stripe-signature', sig)
        .send(payload)

      expect(jobsService.enqueueMpEvent).not.toHaveBeenCalled()
    })
  })

  // ─── POST /webhooks/mp ───────────────────────────────────────────────────────

  describe('POST /webhooks/mp', () => {
    const mpBody = {
      id:        '1234567',
      type:      'payment',
      data:      { id: '1234567' },
      action:    'payment.updated',
      live_mode: false,
    }

    it('200 and enqueues event on valid notification', async () => {
      const res = await request(app.getHttpServer())
        .post('/webhooks/mp')
        .set('x-signature',  'ts=1,v1=fakesig')
        .set('x-request-id', 'req-001')
        .send(mpBody)

      expect(res.status).toBe(200)
      expect(res.body).toEqual({ received: true })
      expect(jobsService.enqueueMpEvent).toHaveBeenCalledWith(
        expect.objectContaining({ body: expect.objectContaining({ id: '1234567' }) })
      )
    })

    it('200 and ignores ping with missing type', async () => {
      const res = await request(app.getHttpServer())
        .post('/webhooks/mp')
        .send({ id: 'ping' })  // no type or data.id

      expect(res.status).toBe(200)
      expect(jobsService.enqueueMpEvent).not.toHaveBeenCalled()
    })

    it('does NOT call enqueueStripeEvent for MP webhooks', async () => {
      await request(app.getHttpServer())
        .post('/webhooks/mp')
        .send(mpBody)

      expect(jobsService.enqueueStripeEvent).not.toHaveBeenCalled()
    })
  })
})
