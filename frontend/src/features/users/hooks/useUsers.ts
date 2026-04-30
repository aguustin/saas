import { useCallback, useEffect, useRef, useState } from 'react'
import { useUserStore } from '@/features/users/store/users.store'
import { useBillingStore } from '@/features/billing/store/billing.store'
import { useAuth } from '@/features/auth/hooks/useAuth'
import type { UserFilters } from '@/features/users/api/users.api'
import type { UserRole } from '@/shared/types'

const PAGE_SIZE          = 20
const SEARCH_DEBOUNCE_MS = 300

// ── Roles que el actor actual puede asignar ──────────────────────

const ASSIGNABLE_ROLES: Record<UserRole, UserRole[]> = {
  owner:   ['owner', 'admin', 'manager', 'cashier'],
  admin:   ['manager', 'cashier'],
  manager: [],
  cashier: [],
}

export function useUsers() {
  const fetch       = useUserStore(s => s.fetch)
  const items       = useUserStore(s => s.items)
  const total       = useUserStore(s => s.total)
  const status      = useUserStore(s => s.status)
  const error       = useUserStore(s => s.error)
  const isBlocked   = useBillingStore(s => s.isBlocked)
  const { role: myRole, user: me } = useAuth()

  // ── Filtros locales ───────────────────────────────────────────

  const [search,   setSearchRaw] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | undefined>(undefined)
  const [isActive,   setIsActive]   = useState<boolean | undefined>(true)
  const [page,       setPage]       = useState(1)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const doFetch = useCallback((overrides: Partial<UserFilters> = {}) => {
    const base: UserFilters = {
      search:    search || undefined,
      role:      roleFilter,
      is_active: isActive,
      limit:     PAGE_SIZE,
      offset:    (page - 1) * PAGE_SIZE,
      ...overrides,
    }
    void fetch(base)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, roleFilter, isActive, page])

  useEffect(() => {
    doFetch()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleFilter, isActive, page])

  const setSearch = useCallback((q: string) => {
    setSearchRaw(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setPage(1)
      doFetch({ search: q || undefined, offset: 0 })
    }, SEARCH_DEBOUNCE_MS)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doFetch])

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
  }, [])

  // ── Setters con reset de página ───────────────────────────────

  function changeRoleFilter(val: UserRole | undefined) {
    setRoleFilter(val)
    setPage(1)
  }

  function changeIsActive(val: boolean | undefined) {
    setIsActive(val)
    setPage(1)
  }

  // ── Paginación ────────────────────────────────────────────────

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  function goToPage(p: number) {
    if (p < 1 || p > pageCount) return
    setPage(p)
  }

  // ── Permisos derivados ────────────────────────────────────────

  const assignableRoles: UserRole[] = myRole ? ASSIGNABLE_ROLES[myRole] : []
  const canCreate                   = !isBlocked('users') && assignableRoles.length > 0

  function canEditUser(targetRole: UserRole): boolean {
    if (!myRole) return false
    return ASSIGNABLE_ROLES[myRole].includes(targetRole)
  }

  function canDeactivate(targetId: string, targetRole: UserRole): boolean {
    if (!me || targetId === me.user_id) return false
    return canEditUser(targetRole)
  }

  return {
    items,
    total,
    loading: status === 'loading',
    error,

    search,
    setSearch,
    roleFilter,
    changeRoleFilter,
    isActive,
    changeIsActive,

    page,
    pageCount,
    pageSize: PAGE_SIZE,
    goToPage,

    canCreate,
    assignableRoles,
    canEditUser,
    canDeactivate,
    myUserId: me?.user_id,

    refresh: () => doFetch(),
  }
}
