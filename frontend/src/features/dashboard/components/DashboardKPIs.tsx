import {
  ShoppingBag, TrendingUp, ReceiptText,
  Banknote, CreditCard, Smartphone,
} from 'lucide-react'
import { SkeletonStatCard } from '@/shared/components/ui/Skeleton'
import type { DailySummary } from '@/shared/types'

interface Props {
  summary: DailySummary | undefined
  loading: boolean
}

interface KPI {
  label:  string
  value:  string
  sub?:   string
  icon:   React.ElementType
  accent: Accent
}

type Accent = 'brand' | 'green' | 'purple' | 'amber' | 'sky' | 'teal'

const ACCENT: Record<Accent, { bg: string; icon: string; border: string }> = {
  brand:  { bg: 'bg-brand-50  dark:bg-brand-950/30',  icon: 'text-brand-600  dark:text-brand-400',  border: 'border-brand-100  dark:border-brand-900'  },
  green:  { bg: 'bg-green-50  dark:bg-green-950/30',  icon: 'text-green-600  dark:text-green-400',  border: 'border-green-100  dark:border-green-900'  },
  purple: { bg: 'bg-purple-50 dark:bg-purple-950/30', icon: 'text-purple-600 dark:text-purple-400', border: 'border-purple-100 dark:border-purple-900' },
  amber:  { bg: 'bg-amber-50  dark:bg-amber-950/30',  icon: 'text-amber-600  dark:text-amber-400',  border: 'border-amber-100  dark:border-amber-900'  },
  sky:    { bg: 'bg-sky-50    dark:bg-sky-950/30',    icon: 'text-sky-600    dark:text-sky-400',    border: 'border-sky-100    dark:border-sky-900'    },
  teal:   { bg: 'bg-teal-50   dark:bg-teal-950/30',   icon: 'text-teal-600   dark:text-teal-400',   border: 'border-teal-100   dark:border-teal-900'   },
}

function buildKPIs(s: DailySummary): KPI[] {
  return [
    {
      label:  'Ventas hoy',
      value:  String(s.total_sales),
      sub:    s.total_sales === 1 ? 'transacción' : 'transacciones',
      icon:   ShoppingBag,
      accent: 'brand',
    },
    {
      label:  'Ingresos hoy',
      value:  `$${s.total_revenue.toFixed(2)}`,
      sub:    'total cobrado',
      icon:   TrendingUp,
      accent: 'green',
    },
    {
      label:  'Ticket promedio',
      value:  `$${s.avg_ticket.toFixed(2)}`,
      sub:    'por venta',
      icon:   ReceiptText,
      accent: 'purple',
    },
    {
      label:  'Efectivo',
      value:  `$${s.cash.toFixed(2)}`,
      sub:    s.total_revenue > 0 ? `${((s.cash / s.total_revenue) * 100).toFixed(0)}% del total` : undefined,
      icon:   Banknote,
      accent: 'amber',
    },
    {
      label:  'Tarjeta',
      value:  `$${s.card.toFixed(2)}`,
      sub:    s.total_revenue > 0 ? `${((s.card / s.total_revenue) * 100).toFixed(0)}% del total` : undefined,
      icon:   CreditCard,
      accent: 'sky',
    },
    {
      label:  'MP / Transferencia',
      value:  `$${(s.mp + s.transfer).toFixed(2)}`,
      sub:    s.total_revenue > 0 ? `${(((s.mp + s.transfer) / s.total_revenue) * 100).toFixed(0)}% del total` : undefined,
      icon:   Smartphone,
      accent: 'teal',
    },
  ]
}

export function DashboardKPIs({ summary, loading }: Props) {
  if (loading || !summary) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => <SkeletonStatCard key={i} />)}
      </div>
    )
  }

  const kpis = buildKPIs(summary)

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
      {kpis.map(kpi => (
        <KPICard key={kpi.label} kpi={kpi} />
      ))}
    </div>
  )
}

function KPICard({ kpi }: { kpi: KPI }) {
  const { bg, icon: iconColor, border } = ACCENT[kpi.accent]
  const Icon = kpi.icon

  return (
    <div className={`rounded-2xl border ${border} bg-white dark:bg-gray-900 p-5 flex flex-col gap-3`}>
      <div className={`w-9 h-9 rounded-xl ${bg} ${iconColor} flex items-center justify-center`}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{kpi.label}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 leading-none tabular-nums">
          {kpi.value}
        </p>
        {kpi.sub && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{kpi.sub}</p>
        )}
      </div>
    </div>
  )
}
