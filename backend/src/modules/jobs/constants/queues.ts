// ─── Queue names ──────────────────────────────────────────────────────────────

export const QUEUE = {
  SYNC:          'sync',
  BILLING:       'billing',
  NOTIFICATIONS: 'notifications',
  MAINTENANCE:   'maintenance',
} as const

export type QueueName = (typeof QUEUE)[keyof typeof QUEUE]

// ─── Job names ────────────────────────────────────────────────────────────────

export const SYNC_JOB = {
  OFFLINE_SALE:    'sync.offline-sale',
  BATCH_PUSH:      'sync.batch-push',
} as const

export const BILLING_JOB = {
  STRIPE_EVENT:    'billing.stripe-event',
  MP_EVENT:        'billing.mp-event',
  EXPIRE_GRACE:    'billing.expire-grace',
} as const

export const NOTIFICATION_JOB = {
  STOCK_ALERT:     'notifications.stock-alert',
  SUB_WARNING:     'notifications.sub-expiry-warning',
  SYNC_CONFLICT:   'notifications.sync-conflict',
} as const

export const MAINTENANCE_JOB = {
  CLEANUP_TOKENS:       'maintenance.cleanup-tokens',
  CLEANUP_CHANGES_LOG:  'maintenance.cleanup-changes-log',
  DISPATCH_STOCK_ALERTS: 'maintenance.dispatch-stock-alerts',
} as const

// ─── Default job options per queue ────────────────────────────────────────────

export const JOB_OPTIONS = {
  // Webhook events must be reliable — 5 attempts, exponential backoff
  billing: {
    attempts: 5,
    backoff:  { type: 'exponential' as const, delay: 2_000 },
    removeOnComplete: { count: 200 },
    removeOnFail:     { count: 500 },
  },
  // Sync jobs are large but less critical — 3 attempts
  sync: {
    attempts: 3,
    backoff:  { type: 'exponential' as const, delay: 5_000 },
    removeOnComplete: { count: 100 },
    removeOnFail:     { count: 200 },
  },
  // Notifications: debounce-like delay, 3 attempts
  notifications: {
    attempts: 3,
    backoff:  { type: 'exponential' as const, delay: 3_000 },
    delay:    2_000,
    removeOnComplete: { count: 50 },
    removeOnFail:     { count: 100 },
  },
  // Maintenance: fire-and-forget, 1 attempt
  maintenance: {
    attempts: 1,
    removeOnComplete: { count: 20 },
    removeOnFail:     { count: 50 },
  },
} as const

// ─── Repeating job schedules (cron patterns) ──────────────────────────────────

export const REPEATING_JOBS = [
  {
    name:    MAINTENANCE_JOB.CLEANUP_TOKENS,
    queue:   QUEUE.MAINTENANCE,
    pattern: '0 3 * * *',     // daily 03:00
  },
  {
    name:    MAINTENANCE_JOB.CLEANUP_CHANGES_LOG,
    queue:   QUEUE.MAINTENANCE,
    pattern: '0 4 * * 0',     // weekly Sunday 04:00
  },
  {
    name:    MAINTENANCE_JOB.DISPATCH_STOCK_ALERTS,
    queue:   QUEUE.MAINTENANCE,
    pattern: '0 */6 * * *',   // every 6 hours
  },
  {
    name:    BILLING_JOB.EXPIRE_GRACE,
    queue:   QUEUE.BILLING,
    pattern: '0 * * * *',     // every hour
  },
] as const
