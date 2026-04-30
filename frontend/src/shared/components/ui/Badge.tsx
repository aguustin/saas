import type { ReactNode } from 'react'
import type {
  SaleStatus,
  SubscriptionStatus,
  UserRole,
  PushResult,
} from '@/shared/types'

// ── Base variant ─────────────────────────────────────────────────

export type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'purple'
  | 'teal'
  | 'gray'

export type BadgeSize = 'sm' | 'md'

interface BadgeProps {
  variant?:  BadgeVariant
  size?:     BadgeSize
  dot?:      boolean
  children:  ReactNode
  className?: string
}

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  default:
    'bg-brand-100  text-brand-700  dark:bg-brand-900/50  dark:text-brand-300',
  success:
    'bg-green-100  text-green-700  dark:bg-green-900/50  dark:text-green-300',
  warning:
    'bg-amber-100  text-amber-700  dark:bg-amber-900/50  dark:text-amber-300',
  danger:
    'bg-red-100    text-red-700    dark:bg-red-900/50    dark:text-red-300',
  info:
    'bg-blue-100   text-blue-700   dark:bg-blue-900/50   dark:text-blue-300',
  purple:
    'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300',
  teal:
    'bg-teal-100   text-teal-700   dark:bg-teal-900/50   dark:text-teal-300',
  gray:
    'bg-gray-100   text-gray-600   dark:bg-gray-700      dark:text-gray-300',
}

const DOT_STYLES: Record<BadgeVariant, string> = {
  default: 'bg-brand-500',
  success: 'bg-green-500',
  warning: 'bg-amber-500',
  danger:  'bg-red-500',
  info:    'bg-blue-500',
  purple:  'bg-purple-500',
  teal:    'bg-teal-500',
  gray:    'bg-gray-400',
}

const SIZE_STYLES: Record<BadgeSize, string> = {
  sm: 'px-1.5 py-0.5 text-[11px]',
  md: 'px-2   py-0.5 text-xs',
}

export function Badge({
  variant   = 'default',
  size      = 'md',
  dot       = false,
  children,
  className = '',
}: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 font-medium rounded-full',
        VARIANT_STYLES[variant],
        SIZE_STYLES[size],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${DOT_STYLES[variant]}`}
        />
      )}
      {children}
    </span>
  )
}

// ── SaleStatus Badge ─────────────────────────────────────────────

const SALE_STATUS_MAP: Record<SaleStatus, { variant: BadgeVariant; label: string }> = {
  pending:   { variant: 'warning', label: 'Pendiente'  },
  completed: { variant: 'success', label: 'Completada' },
  cancelled: { variant: 'gray',    label: 'Cancelada'  },
  refunded:  { variant: 'info',    label: 'Reembolsada' },
}

export function SaleStatusBadge({ status }: { status: SaleStatus }) {
  const { variant, label } = SALE_STATUS_MAP[status]
  return <Badge variant={variant} dot>{label}</Badge>
}

// ── SubscriptionStatus Badge ─────────────────────────────────────

const SUB_STATUS_MAP: Record<SubscriptionStatus, { variant: BadgeVariant; label: string }> = {
  trialing: { variant: 'info',    label: 'Prueba'        },
  active:   { variant: 'success', label: 'Activa'        },
  past_due: { variant: 'warning', label: 'Vencida'       },
  unpaid:   { variant: 'danger',  label: 'Sin pago'      },
  cancelled:{ variant: 'gray',    label: 'Cancelada'     },
}

export function SubscriptionBadge({ status }: { status: SubscriptionStatus }) {
  const { variant, label } = SUB_STATUS_MAP[status]
  return <Badge variant={variant} dot>{label}</Badge>
}

// ── UserRole Badge ────────────────────────────────────────────────

const ROLE_MAP: Record<UserRole, { variant: BadgeVariant; label: string }> = {
  owner:   { variant: 'purple',  label: 'Owner'   },
  admin:   { variant: 'default', label: 'Admin'   },
  manager: { variant: 'teal',    label: 'Manager' },
  cashier: { variant: 'gray',    label: 'Cajero'  },
}

export function RoleBadge({ role }: { role: UserRole }) {
  const { variant, label } = ROLE_MAP[role]
  return <Badge variant={variant}>{label}</Badge>
}

// ── Stock Badge ───────────────────────────────────────────────────

export function StockBadge({ isLow }: { isLow: boolean }) {
  return isLow
    ? <Badge variant="danger" dot>Stock bajo</Badge>
    : <Badge variant="success" dot>Normal</Badge>
}

// ── Sync Result Badge ─────────────────────────────────────────────

const SYNC_STATUS_MAP: Record<PushResult['status'], { variant: BadgeVariant; label: string }> = {
  applied:  { variant: 'success', label: 'Aplicado'   },
  skipped:  { variant: 'gray',    label: 'Ignorado'   },
  conflict: { variant: 'warning', label: 'Conflicto'  },
  error:    { variant: 'danger',  label: 'Error'       },
}

export function SyncResultBadge({ status }: { status: PushResult['status'] }) {
  const { variant, label } = SYNC_STATUS_MAP[status]
  return <Badge variant={variant} dot>{label}</Badge>
}

// ── Plan Badge ────────────────────────────────────────────────────

const PLAN_MAP: Record<string, BadgeVariant> = {
  free:    'gray',
  pro:     'default',
  premium: 'purple',
  super:   'warning',
}

export function PlanBadge({ plan }: { plan: string }) {
  return (
    <Badge variant={PLAN_MAP[plan] ?? 'gray'}>
      {plan.charAt(0).toUpperCase() + plan.slice(1)}
    </Badge>
  )
}
