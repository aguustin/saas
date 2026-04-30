import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Redis             from 'ioredis'
import { randomBytes }   from 'crypto'

const LOCK_PREFIX = 'lock:'
const RL_PREFIX   = 'rl:'

// Lua script: release lock only if token matches (atomic check-and-delete)
const RELEASE_LOCK_SCRIPT = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  else
    return 0
  end
`

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name)
  private client: Redis
  private subscriber: Redis   // dedicated connection for pub/sub

  constructor(private config: ConfigService) {
    const opts = {
      host:                 config.getOrThrow('REDIS_HOST'),
      port:                 config.getOrThrow('REDIS_PORT'),
      maxRetriesPerRequest: 3,
      enableReadyCheck:     true,
      lazyConnect:          true,
    }
    this.client     = new Redis(opts)
    this.subscriber = new Redis(opts)   // separate client — subscribe() blocks

    this.client.on('error',     (err) => this.logger.error({ err }, 'Redis client error'))
    this.subscriber.on('error', (err) => this.logger.error({ err }, 'Redis subscriber error'))
  }

  async onModuleInit(): Promise<void> {
    await this.client.connect()
    await this.subscriber.connect()
    this.logger.log('Redis connected (client + subscriber)')
  }

  async onModuleDestroy(): Promise<void> {
    await this.subscriber.quit()
    await this.client.quit()
  }

  // ─── Basic key-value ──────────────────────────────────────────────────────

  async get(key: string): Promise<string | null> {
    return this.client.get(key)
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.set(key, value, 'EX', ttlSeconds)
    } else {
      await this.client.set(key, value)
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key)
  }

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key)
    return raw ? JSON.parse(raw) : null
  }

  async setJson<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlSeconds)
  }

  // ─── Distributed lock (SET NX PX + Lua release) ───────────────────────────

  /**
   * Try to acquire a lock. Returns a token if acquired, null if already held.
   * Always release with releaseLock(key, token) — do NOT just DEL the key.
   *
   * @param key    Resource identifier (e.g. "webhook:evt_123")
   * @param ttlMs  Maximum lock hold time in ms (safety release on crash)
   */
  async acquireLock(key: string, ttlMs: number): Promise<string | null> {
    const token  = randomBytes(16).toString('hex')
    const result = await this.client.set(`${LOCK_PREFIX}${key}`, token, 'PX', ttlMs, 'NX')
    return result === 'OK' ? token : null
  }

  /**
   * Release a lock. No-op if the token doesn't match (already expired/released).
   * Returns true if released, false if not held by this caller.
   */
  async releaseLock(key: string, token: string): Promise<boolean> {
    const result = await this.client.eval(RELEASE_LOCK_SCRIPT, 1, `${LOCK_PREFIX}${key}`, token)
    return result === 1
  }

  /**
   * Execute fn while holding a lock. Throws if lock cannot be acquired.
   * Automatically releases even on error.
   */
  async withLock<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
    const token = await this.acquireLock(key, ttlMs)
    if (!token) throw new Error(`Could not acquire lock for key: ${key}`)
    try {
      return await fn()
    } finally {
      await this.releaseLock(key, token)
    }
  }

  // ─── Sliding window rate limiter ──────────────────────────────────────────

  /**
   * Sliding window rate limiter using a sorted set.
   * Returns whether the request is allowed and how many remain in the window.
   *
   * @param key       Identifier (e.g. "rate:tenant:uuid:sync-push")
   * @param limit     Max requests in the window
   * @param windowMs  Window size in milliseconds
   */
  async checkRateLimit(
    key: string,
    limit: number,
    windowMs: number,
  ): Promise<{ allowed: boolean; remaining: number; resetMs: number }> {
    const now      = Date.now()
    const windowStart = now - windowMs
    const fullKey  = `${RL_PREFIX}${key}`

    const pipeline = this.client.pipeline()
    pipeline.zremrangebyscore(fullKey, 0, windowStart)        // prune old entries
    pipeline.zadd(fullKey, now, `${now}-${randomBytes(4).toString('hex')}`) // add current
    pipeline.zcard(fullKey)                                   // count current window
    pipeline.pexpire(fullKey, windowMs)                       // TTL = window size

    const results = await pipeline.exec()
    const count   = (results?.[2]?.[1] as number) ?? 0
    const allowed = count <= limit

    return {
      allowed,
      remaining: Math.max(0, limit - count),
      resetMs:   windowMs,
    }
  }

  // ─── Pub / Sub ────────────────────────────────────────────────────────────

  async publish(channel: string, message: string): Promise<void> {
    await this.client.publish(channel, message)
  }

  async publishJson<T>(channel: string, data: T): Promise<void> {
    await this.publish(channel, JSON.stringify(data))
  }

  subscribe(channel: string, handler: (message: string) => void): void {
    this.subscriber.subscribe(channel).catch((err) =>
      this.logger.error({ err, channel }, 'Redis subscribe error')
    )
    this.subscriber.on('message', (ch, msg) => {
      if (ch === channel) handler(msg)
    })
  }

  unsubscribe(channel: string): void {
    this.subscriber.unsubscribe(channel).catch((err) =>
      this.logger.error({ err, channel }, 'Redis unsubscribe error')
    )
  }

  // ─── Increment / counter ──────────────────────────────────────────────────

  async incr(key: string, ttlSeconds?: number): Promise<number> {
    const val = await this.client.incr(key)
    if (ttlSeconds && val === 1) {
      await this.client.expire(key, ttlSeconds)
    }
    return val
  }

  // ─── Raw client access (BullMQ needs this) ────────────────────────────────

  getClient(): Redis {
    return this.client
  }
}
