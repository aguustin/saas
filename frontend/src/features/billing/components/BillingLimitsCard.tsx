import { Package, GitBranch, Users, UserCheck } from 'lucide-react'
import { Skeleton } from '@/shared/components/ui/Skeleton'
import { PlanBadge } from '@/shared/components/ui/Badge'
import type { LimitsDto, ResourceLimit } from '@/shared/types'

// ── Barra de recurso ──────────────────────────────────────────────

function ResourceBar({
  label, icon: Icon, resource,
}: {
  label:    string
  icon:     React.ElementType
  resource: ResourceLimit
}) {
  const unlimited = resource.max === null
  const pct       = resource.pct ?? 0
  const barColor  =
    resource.blocked ? 'bg-red-500' :
    pct >= 90        ? 'bg-amber-500' :
    pct >= 70        ? 'bg-yellow-400' :
    'bg-brand-500'

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <Icon size={14} className="text-gray-400" />
          <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
          {resource.blocked && (
            <span className="text-[10px] font-semibold text-red-600 dark:text-red-400
                             bg-red-50 dark:bg-red-950/40 px-1.5 py-0.5 rounded-full">
              LÍMITE
            </span>
          )}
        </div>
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 tabular-nums">
          {resource.current}
          {!unlimited && (
            <span className="font-normal text-gray-400"> / {resource.max}</span>
          )}
          {unlimited && (
            <span className="font-normal text-gray-400 ml-1 text-xs">∞</span>
          )}
        </span>
      </div>

      {!unlimited ? (
        <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
          <div
            className={`h-full rounded-full ${barColor} transition-all duration-500`}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
      ) : (
        <div className="h-2 rounded-full bg-brand-100 dark:bg-brand-900/30" />
      )}

      {!unlimited && pct > 0 && (
        <p className="text-right text-[10px] text-gray-400 mt-0.5">{pct.toFixed(0)}% usado</p>
      )}
    </div>
  )
}

// ── Feature chip ──────────────────────────────────────────────────

function FeatureChip({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className={[
      'flex items-center gap-2 px-3 py-2 rounded-xl border text-sm',
      enabled
        ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400'
        : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-gray-400 dark:text-gray-500',
    ].join(' ')}>
      <span className={`w-2 h-2 rounded-full shrink-0 ${enabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
      <span className={!enabled ? 'line-through' : ''}>{label}</span>
    </div>
  )
}

// ── Props ─────────────────────────────────────────────────────────

interface Props {
  limits: LimitsDto | null
}

const ANALYTICS_LABEL: Record<string, string> = {
  basic:    'Analytics básico',
  advanced: 'Analytics avanzado',
  full:     'Analytics completo',
}

// ── Componente ────────────────────────────────────────────────────

export function BillingLimitsCard({ limits }: Props) {
  return (
    <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">

      <div className="flex items-center justify-between mb-6">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          Uso del plan
        </h3>
        {limits && <PlanBadge plan={limits.plan_name} />}
      </div>

      {!limits ? (
        <div className="space-y-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton height={14} width="40%" />
              <Skeleton height={8}  width="100%" rounded="full" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-6">

          {/* Recursos */}
          <div className="space-y-5">
            <ResourceBar label="Productos"  icon={Package}   resource={limits.resources.products}  />
            <ResourceBar label="Sucursales" icon={GitBranch} resource={limits.resources.branches}  />
            <ResourceBar label="Usuarios"   icon={Users}     resource={limits.resources.users}     />
            <ResourceBar label="Empleados"  icon={UserCheck} resource={limits.resources.employees} />
          </div>

          {/* Funcionalidades */}
          <div className="pt-5 border-t border-gray-100 dark:border-gray-800">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Funcionalidades
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <FeatureChip
                label="Sincronización offline"
                enabled={limits.features.sync_enabled}
              />
              <FeatureChip
                label={ANALYTICS_LABEL[limits.features.analytics_level] ?? 'Analytics'}
                enabled={limits.features.analytics_level !== 'basic'}
              />
              <FeatureChip
                label="Acceso API"
                enabled={limits.features.api_access}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

