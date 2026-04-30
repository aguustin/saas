import { registerAs } from '@nestjs/config'

export const appConfig = registerAs('app', () => ({
  nodeEnv:  process.env.NODE_ENV ?? 'development',
  port:     parseInt(process.env.PORT ?? '3000', 10),
  appUrl:   process.env.APP_URL ?? 'http://localhost:3000',
  origins:  (process.env.ALLOWED_ORIGINS ?? '').split(',').map(s => s.trim()),
  isDev:    process.env.NODE_ENV === 'development',
  isProd:   process.env.NODE_ENV === 'production',
}))

export const jwtConfig = registerAs('jwt', () => ({
  secret:         process.env.JWT_SECRET,
  refreshSecret:  process.env.JWT_REFRESH_SECRET,
  expiresIn:      process.env.JWT_EXPIRES_IN      ?? '15m',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
}))

export const redisConfig = registerAs('redis', () => ({
  host: process.env.REDIS_HOST ?? 'localhost',
  port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
}))

export const stripeConfig = registerAs('stripe', () => ({
  secretKey:      process.env.STRIPE_SECRET_KEY,
  webhookSecret:  process.env.STRIPE_WEBHOOK_SECRET,
}))

export const mpConfig = registerAs('mp', () => ({
  accessToken:    process.env.MP_ACCESS_TOKEN,
  webhookSecret:  process.env.MP_WEBHOOK_SECRET,
}))
