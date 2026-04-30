import {
  TrendingUp, ShoppingBag, Banknote, CreditCard,
  Smartphone, ArrowRight, ReceiptText,
} from 'lucide-react'
import { SkeletonStatCard } from '@/shared/components/ui/Skeleton'
import type { DailySummary } from '@/shared/types'

interface Props {
  summary:  DailySummary | undefined
  loading:  boolean
  date:     string   // "YYYY-MM-DD" — para el título
}

export function SaleSummaryCards({ summary, loading, date }: Props) {
  const label = formatDateLabel(date)

  if (loading && !summary) {
    return (
      <div>
        <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-3 uppercase tracking-wide">
          Resumen — {label}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonStatCard key={i} />)}
        </div>
      </div>
    )
  }

  if (!summary) return null

  return (
    <div>
      <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-3 uppercase tracking-wide">
        Resumen — {label}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          icon={<ShoppingBag size={16} />}
          label="Ventas"
          value={String(summary.total_sales)}
          accent="brand"
        />
        <StatCard
          icon={<TrendingUp size={16} />}
          label="Ingresos"
          value={`$${summary.total_revenue.toFixed(2)}`}
          accent="green"
        />
        <StatCard
          icon={<ReceiptText size={16} />}
          label="Ticket prom."
          value={`$${summary.avg_ticket.toFixed(2)}`}
          accent="purple"
        />
        <StatCard
          icon={<Banknote size={16} />}
          label="Efectivo"
          value={`$${summary.cash.toFixed(2)}`}
          accent="amber"
        />
        <StatCard
          icon={<CreditCard size={16} />}
          label="Tarjeta"
          value={`$${summary.card.toFixed(2)}`}
          accent="blue"
        />
        <StatCard
          icon={<Smartphone size={16} />}
          label="MP / Transfer."
          value={`$${(summary.mp + summary.transfer).toFixed(2)}`}
          accent="teal"
        />
      </div>
    </div>
  )
}

// ── StatCard ──────────────────────────────────────────────────────

type Accent = 'brand' | 'green' | 'purple' | 'amber' | 'blue' | 'teal'

const ACCENT_STYLES: Record<Accent, { icon: string; bg: string }> = {
  brand:  { icon: 'text-brand-600  dark:text-brand-400',  bg: 'bg-brand-50  dark:bg-brand-950/30'  },
  green:  { icon: 'text-green-600  dark:text-green-400',  bg: 'bg-green-50  dark:bg-green-950/30'  },
  purple: { icon: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-950/30' },
  amber:  { icon: 'text-amber-600  dark:text-amber-400',  bg: 'bg-amber-50  dark:bg-amber-950/30'  },
  blue:   { icon: 'text-blue-600   dark:text-blue-400',   bg: 'bg-blue-50   dark:bg-blue-950/30'   },
  teal:   { icon: 'text-teal-600   dark:text-teal-400',   bg: 'bg-teal-50   dark:bg-teal-950/30'   },
}

interface StatCardProps {
  icon:   React.ReactNode
  label:  string
  value:  string
  accent: Accent
}

function StatCard({ icon, label, value, accent }: StatCardProps) {
  const { icon: iconClass, bg } = ACCENT_STYLES[accent]

  return (
    <div className="rounded-xl border border-gray-100 dark:border-gray-800
                    bg-white dark:bg-gray-900 p-4 space-y-2">
      <div className={`w-8 h-8 rounded-lg ${bg} ${iconClass} flex items-center justify-center`}>
        {icon}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-lg font-bold text-gray-900 dark:text-gray-100 leading-none">
        {value}
      </p>
    </div>
  )
}

// ── Helper ────────────────────────────────────────────────────────

function formatDateLabel(iso: string): string {
  const today     = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
  if (iso === today)     return 'Hoy'
  if (iso === yesterday) return 'Ayer'
  return new Intl.DateTimeFormat('es', { day: '2-digit', month: 'long', year: 'numeric' })
    .format(new Date(iso + 'T12:00:00'))
}
