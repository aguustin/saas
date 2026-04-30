import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from './auth.store'
import type { MeResponse } from '@/shared/types'

const INITIAL_STATE = {
  access_token:      null,
  refresh_token:     null,
  user:              null,
  sessions:          [],
  sessionsLoading:   false,
  pending_tenant_id: null,
  isAuthenticated:   false,
  isBootstrapping:   true,
}

function resetStore() {
  localStorage.clear()
  useAuthStore.setState(INITIAL_STATE)
}

const MOCK_USER: MeResponse = {
  user_id:   'user-1',
  tenant_id: 'tenant-1',
  role:      'cashier',
  plan:      'pro',
  branch_id: 'branch-1',
}

describe('auth.store — setTokens', () => {
  beforeEach(resetStore)

  it('stores access and refresh tokens in state', () => {
    useAuthStore.getState().setTokens('access-abc', 'refresh-xyz')

    const state = useAuthStore.getState()
    expect(state.access_token).toBe('access-abc')
    expect(state.refresh_token).toBe('refresh-xyz')
  })

  it('marks user as authenticated', () => {
    useAuthStore.getState().setTokens('access-abc', 'refresh-xyz')
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
  })

  it('persists refresh token to localStorage', () => {
    useAuthStore.getState().setTokens('access-abc', 'refresh-xyz')
    expect(localStorage.getItem('saas_refresh_token')).toBe('refresh-xyz')
  })
})

describe('auth.store — setUser', () => {
  beforeEach(resetStore)

  it('stores user in state', () => {
    useAuthStore.getState().setUser(MOCK_USER)
    expect(useAuthStore.getState().user).toEqual(MOCK_USER)
  })

  it('marks user as authenticated', () => {
    useAuthStore.getState().setUser(MOCK_USER)
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
  })

  it('persists tenant_id to localStorage', () => {
    useAuthStore.getState().setUser(MOCK_USER)
    expect(localStorage.getItem('saas_tenant_id')).toBe('tenant-1')
  })
})

describe('auth.store — logout', () => {
  beforeEach(resetStore)

  it('clears tokens and user from state', () => {
    useAuthStore.getState().setTokens('access-abc', 'refresh-xyz')
    useAuthStore.getState().setUser(MOCK_USER)

    useAuthStore.getState().logout()

    const state = useAuthStore.getState()
    expect(state.access_token).toBeNull()
    expect(state.refresh_token).toBeNull()
    expect(state.user).toBeNull()
  })

  it('sets isAuthenticated to false', () => {
    useAuthStore.getState().setTokens('access-abc', 'refresh-xyz')
    useAuthStore.getState().logout()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })

  it('removes refresh token from localStorage', () => {
    useAuthStore.getState().setTokens('access-abc', 'refresh-xyz')
    useAuthStore.getState().logout()
    expect(localStorage.getItem('saas_refresh_token')).toBeNull()
  })

  it('clears sessions', () => {
    useAuthStore.setState({ sessions: [{ id: 's1', device_id: 'd1', device_name: null, ip_address: null, last_used_at: '', created_at: '' }] })
    useAuthStore.getState().logout()
    expect(useAuthStore.getState().sessions).toHaveLength(0)
  })
})

describe('auth.store — selectors', () => {
  beforeEach(resetStore)

  it('role() returns null when no user', () => {
    expect(useAuthStore.getState().role()).toBeNull()
  })

  it('role() returns the user role', () => {
    useAuthStore.getState().setUser(MOCK_USER)
    expect(useAuthStore.getState().role()).toBe('cashier')
  })

  it('plan() returns the user plan', () => {
    useAuthStore.getState().setUser(MOCK_USER)
    expect(useAuthStore.getState().plan()).toBe('pro')
  })

  it('branchId() returns null when no user', () => {
    expect(useAuthStore.getState().branchId()).toBeNull()
  })

  it('branchId() returns branch_id', () => {
    useAuthStore.getState().setUser(MOCK_USER)
    expect(useAuthStore.getState().branchId()).toBe('branch-1')
  })

  it('tenantId() returns tenant_id', () => {
    useAuthStore.getState().setUser(MOCK_USER)
    expect(useAuthStore.getState().tenantId()).toBe('tenant-1')
  })

  it('branchId() returns null when user has null branch_id', () => {
    useAuthStore.getState().setUser({ ...MOCK_USER, branch_id: null })
    expect(useAuthStore.getState().branchId()).toBeNull()
  })
})

describe('auth.store — setPendingTenantId', () => {
  beforeEach(resetStore)

  it('stores pending tenant id and persists it', () => {
    useAuthStore.getState().setPendingTenantId('tenant-pending')
    expect(useAuthStore.getState().pending_tenant_id).toBe('tenant-pending')
    expect(localStorage.getItem('saas_tenant_id')).toBe('tenant-pending')
  })
})
