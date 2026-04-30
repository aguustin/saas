import { useState } from 'react'
import { Check, Zap, BarChart2, Code2, GitBranch, Package, Users, UserCheck } from 'lucide-react'
import { Skeleton } from '@/shared/components/ui/Skeleton'
import type { PlanDto } from '@/shared/types'

// ── Helpers ───────────────────────────────────────────────────────

function fmtLimit(val: number | null): string {
  return val === null ? 'Ilimitado' : String(val)
}

const ANALYTICS_LABEL: Record<string, string> = {
  basic:    'Básico',
  advanced: 'Avanzado',
  full:     'Completo',
}

const PLAN_ACCENT: Record<string, { ring: string; badge: string; btn: string }> = {
  free:    {
    ring:  'ring-gray-200  dark:ring-gray-700',
    badge: 'bg-gray-100    text-gray-600    dark:bg-gray-700     dark:text-gray-300',
    btn:   'bg-gray-200    text-gray-700    hover:bg-gray-300    dark:bg-gray-700    dark:text-gray-200    dark:hover:bg-gray-600',
  },
  pro:     {
    ring:  'ring-brand-300 dark:ring-brand-700',
    badge: 'bg-brand-100   text-brand-700   dark:bg-brand-900/50 dark:text-brand-300',
    btn:   'bg-brand-600   text-white        hover:bg-brand-700',
  },
  premium: {
    ring:  'ring-purple-300 dark:ring-purple-700',
    badge: 'bg-purple-100  text-purple-700  dark:bg-purple-900/50 dark:text-purple-300',
    btn:   'bg-purple-600  text-white        hover:bg-purple-700',
  },
  super:   {
    ring:  'ring-amber-300 dark:ring-amber-700',
    badge: 'bg-amber-100   text-amber-700   dark:bg-amber-900/50  dark:text-amber-300',
    btn:   'bg-amber-500   text-white        hover:bg-amber-600',
  },
}

function accent(planName: string) {
  return PLAN_ACCENT[planName] ?? PLAN_ACCENT.pro
}

// ── Feature list dentro de la tarjeta ────────────────────────────

function PlanFeature({ label, available }: { label: string; available: boolean }) {
  return (
    <div className={`flex items-center gap-2 text-sm ${available ? 'text-gray-700 dark:text-gray-300' : 'text-gray-300 dark:text-gray-600'}`}>
      <Check size={13} className={available ? 'text-green-500' : 'opacity-30'} />
      {label}
    </div>
  )
}

// ── Tarjeta de plan ───────────────────────────────────────────────

interface PlanCardProps {
  plan:        PlanDto
  isCurrent:   boolean
  onUpgrade:   (plan: PlanDto) => void
}

function PlanCard({ plan, isCurrent, onUpgrade }: PlanCardProps) {
  const ac = accent(plan.name)

  return (
    <div className={[
      'relative rounded-2xl border bg-white dark:bg-gray-900 p-6 flex flex-col gap-5',
      'transition-shadow hover:shadow-md',
      isCurrent
        ? `ring-2 ${ac.ring} border-transparent`
        : 'border-gray-100 dark:border-gray-800',
    ].join(' ')}>

      {/* Etiqueta plan actual */}
      {isCurrent && (
        <span className={`absolute -top-3 left-5 text-xs font-semibold px-2.5 py-1 rounded-full ${ac.badge}`}>
          Plan actual
        </span>
      )}

      {/* Header */}
      <div>
        <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
          {plan.display_name}
        </h3>
        <div className="mt-2">
          {plan.price_ars > 0 ? (
            <>
              <span className="text-3xl font-extrabold text-gray-900 dark:text-gray-100 tabular-nums">
                ${plan.price_ars.toLocaleString('es-AR')}
              </span>
              <span className="text-sm text-gray-400 ml-1">ARS/mes</span>
              {plan.price_usd > 0 && (
                <p className="text-xs text-gray-400 mt-0.5">
                  ≈ USD {plan.price_usd.toFixed(0)}/mes
                </p>
              )}
            </>
          ) : (
            <span className="text-3xl font-extrabold text-gray-900 dark:text-gray-100">Gratis</span>
          )}
        </div>
      </div>

      {/* Límites de recursos */}
      <div className="space-y-2">
        <LimitRow icon={Package}   label="Productos"  value={fmtLimit(plan.max_products)} />
        <LimitRow icon={GitBranch} label="Sucursales" value={fmtLimit(plan.max_branches)} />
        <LimitRow icon={Users}     label="Usuarios"   value={fmtLimit(plan.max_users)} />
        <LimitRow icon={UserCheck} label="Empleados"  value={fmtLimit(plan.max_employees)} />
      </div>

      {/* Features */}
      <div className="space-y-2">
        <PlanFeature label="Sincronización offline"           available={plan.sync_enabled} />
        <PlanFeature label={`Analytics ${ANALYTICS_LABEL[plan.analytics_level] ?? ''}`} available={plan.analytics_level !== 'basic'} />
        <PlanFeature label="Acceso API"                       available={plan.api_access} />
      </div>

      {/* Botón */}
      <div className="mt-auto pt-2">
        {isCurrent ? (
          <div className={`w-full py-2 rounded-xl text-sm font-semibold text-center ${ac.badge}`}>
            Plan actual
          </div>
        ) : (
          <button
            onClick={() => onUpgrade(plan)}
            className={[
              'w-full py-2 rounded-xl text-sm font-semibold transition-colors',
              ac.btn,
            ].join(' ')}
          >
            {plan.price_ars === 0 ? 'Seleccionar' : 'Upgradar'}
          </button>
        )}
      </div>
    </div>
  )
}

function LimitRow({
  icon: Icon, label, value,
}: {
  icon:  React.ElementType
  label: string
  value: string
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
        <Icon size={12} />
        {label}
      </div>
      <span className="font-medium text-gray-800 dark:text-gray-200">{value}</span>
    </div>
  )
}

// ── Props & Grid ──────────────────────────────────────────────────

interface Props {
  plans:          PlanDto[]
  loading:        boolean
  currentPlanName: string | null
  onUpgrade:      (plan: PlanDto) => void
}

export function BillingPlanGrid({ plans, loading, currentPlanName, onUpgrade }: Props) {
  return (
    <div>
      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Planes disponibles
      </h3>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-gray-100 dark:border-gray-800 p-6 space-y-4">
              <Skeleton height={20} width="50%" />
              <Skeleton height={36} width="60%" />
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, j) => (
                  <Skeleton key={j} height={14} width="80%" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {plans.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isCurrent={plan.name === currentPlanName}
              onUpgrade={onUpgrade}
            />
          ))}
        </div>
      )}
    </div>
  )
}
