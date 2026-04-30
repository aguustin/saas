import { AsyncLocalStorage } from 'async_hooks'

export interface TenantContext {
  tenantId:  string
  userId:    string
  role:      string
  plan:      string
  branchId:  string | null
  requestId: string
}

const storage = new AsyncLocalStorage<TenantContext>()

export const TenantContextStore = {
  /** Scoped run — use in tests or wrapping a specific callback. */
  run<T>(ctx: TenantContext, fn: () => T): T {
    return storage.run(ctx, fn)
  },

  /**
   * Sets the context for the current async execution chain and all continuations.
   * Use in guards so the context propagates to controllers and services downstream.
   */
  enterWith(ctx: TenantContext): void {
    storage.enterWith(ctx)
  },

  get(): TenantContext {
    const ctx = storage.getStore()
    if (!ctx) throw new Error('TenantContext not initialized — request outside tenant scope')
    return ctx
  },

  getOrNull(): TenantContext | null {
    return storage.getStore() ?? null
  },

  getTenantId(): string {
    return TenantContextStore.get().tenantId
  },
}
