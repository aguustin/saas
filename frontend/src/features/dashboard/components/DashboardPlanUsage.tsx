import { ArrowRight, Package, GitBranch, Users, UserCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Skeleton } from '@/shared/components/ui/Skeleton'
import { PlanBadge } from '@/shared/components/ui/Badge'
import type { LimitsDto, ResourceLimit } from '@/shared/types'

interface Props {
  limits: LimitsDto | null
}

interface ResourceRow {
  label:    string
  key:      keyof LimitsDto['resources']
  icon:     React.ElementType
}

const RESOURCES: ResourceRow[] = [
  { label: 'Productos',  key: 'products',  icon: Package    },
  { label: 'Sucursales', key: 'branches',  icon: GitBranch  },
  { label: 'Usuarios',   key: 'users',     icon: Users      },
  { label: 'Empleados',  key: 'employees', icon: UserCheck  },
]

export function DashboardPlanUsage({ limits }: Props) {
  return (
    <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Uso del plan</h3>
          {limits && <PlanBadge plan={limits.plan_name} />}
        </div>
        <Link
          to="/app/billing"
          className="flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400
                     hover:underline font-medium"
        >
          Gestionar
          <ArrowRight size={12} />
        </Link>
      </div>

      {/* Recursos */}
      {!limits ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton height={12} width="40%" rounded="sm" />
              <Skeleton height={6}  width="100%" rounded="full" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {RESOURCES.map(r => (
            <ResourceBar
              key={r.key}
              label={r.label}
              icon={r.icon}
              resource={limits.resources[r.key]}
            />
          ))}

          {/* Features del plan */}
          <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Funcionalidades</p>
            <div className="flex flex-wrap gap-2">
              <FeatureChip
                label="Sincronización"
                enabled={limits.features.sync_enabled}
              />
              <FeatureChip
                label="Acceso API"
                enabled={limits.features.api_access}
              />
              <FeatureChip
                label={`Analytics ${limits.features.analytics_level}`}
                enabled={limits.features.analytics_level !== 'basic'}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── ResourceBar ───────────────────────────────────────────────────

function ResourceBar({ label, icon: Icon, resource }: {
  label:    string
  icon:     React.ElementType
  resource: ResourceLimit
}) {
  const unlimited = resource.max === null
  const pct       = resource.pct ?? 0
  const blocked   = resource.blocked

  // Color de la barra según uso
  const barColor =
    blocked        ? 'bg-red-500' :
    pct >= 90      ? 'bg-amber-500' :
    pct >= 70      ? 'bg-yellow-400' :
    'bg-brand-500'

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <Icon size={13} className="text-gray-400" />
          <span className="text-xs text-gray-600 dark:text-gray-400">{label}</span>
          {blocked && (
            <span className="text-[10px] font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40
                             px-1.5 py-0.5 rounded-full">LÍMITE</span>
          )}
        </div>
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300 tabular-nums">
          {resource.current}
          {unlimited ? '' : ` / ${resource.max}`}
          {unlimited && <span className="text-gray-400 ml-1">(ilimitado)</span>}
        </span>
      </div>

      {!unlimited && (
        <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
          <div
            className={`h-full rounded-full ${barColor} transition-all duration-500`}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
      )}
    </div>
  )
}

// ── FeatureChip ───────────────────────────────────────────────────

function FeatureChip({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <span className={[
      'inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium',
      enabled
        ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400'
        : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 line-through',
    ].join(' ')}>
      {enabled && <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />}
      {label}
    </span>
  )
}
