import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV:     z.enum(['development', 'test', 'production']).default('development'),
  PORT:         z.coerce.number().default(3000),
  APP_URL:      z.string().url(),

  DATABASE_URL: z.string().min(1),

  REDIS_HOST:   z.string().default('localhost'),
  REDIS_PORT:   z.coerce.number().default(6379),

  JWT_SECRET:          z.string().min(32),
  JWT_REFRESH_SECRET:  z.string().min(32),
  JWT_EXPIRES_IN:      z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  STRIPE_SECRET_KEY:      z.string().optional(),
  STRIPE_WEBHOOK_SECRET:  z.string().optional(),

  MP_ACCESS_TOKEN:   z.string().optional(),
  MP_WEBHOOK_SECRET: z.string().optional(),

  ALLOWED_ORIGINS: z.string().default('http://localhost:5173'),
})

export type EnvConfig = z.infer<typeof envSchema>

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config)
  if (!result.success) {
    const errors = result.error.errors
      .map(e => `  ${e.path.join('.')}: ${e.message}`)
      .join('\n')
    throw new Error(`Invalid environment variables:\n${errors}`)
  }
  return result.data
}
