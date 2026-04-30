import { ArrowRight, Receipt } from 'lucide-react'
import { Link } from 'react-router-dom'
import { SaleStatusBadge } from '@/shared/components/ui/Badge'
import { SkeletonRow } from '@/shared/components/ui/Skeleton'
import { formatDate } from '@/shared/utils/date'
import type { SaleResponse } from '@/shared/types'

interface Props {
  sales:   SaleResponse[]
  loading: boolean
}

const METHOD_LABEL: Record<string, string> = {
  cash:     'Efectivo',
  card:     'Tarjeta',
  transfer: 'Transf.',
  mp:       'Mercado Pago',
  mixed:    'Mixto',
}

export function DashboardRecentSales({ sales, loading }: Props) {
  return (
    <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col">

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Últimas ventas del día
        </h3>
        <Link
          to="/app/sales"
          className="flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400
                     hover:underline font-medium"
        >
          Ver todas
          <ArrowRight size={12} />
        </Link>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-800">
              <th className="px-5 py-2.5 text-left font-medium">N°</th>
              <th className="px-5 py-2.5 text-left font-medium">Hora</th>
              <th className="px-5 py-2.5 text-left font-medium">Estado</th>
              <th className="px-5 py-2.5 text-left font-medium">Método</th>
              <th className="px-5 py-2.5 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
            {loading && sales.length === 0 && (
              Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={5} />)
            )}

            {!loading && sales.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center">
                  <Receipt size={32} className="mx-auto text-gray-200 dark:text-gray-700 mb-2" strokeWidth={1} />
                  <p className="text-xs text-gray-400">Sin ventas registradas hoy</p>
                </td>
              </tr>
            )}

            {sales.map(sale => (
              <tr
                key={sale.id}
                className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
              >
                <td className="px-5 py-3 font-mono text-xs text-gray-400 dark:text-gray-500">
                  #{sale.id.slice(-6).toUpperCase()}
                </td>
                <td className="px-5 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap text-xs">
                  {formatDate(sale.created_at).split(' ')[1] /* solo HH:MM */}
                </td>
                <td className="px-5 py-3">
                  <SaleStatusBadge status={sale.status} />
                </td>
                <td className="px-5 py-3 text-gray-500 dark:text-gray-400 text-xs">
                  {METHOD_LABEL[sale.payment_method] ?? sale.payment_method}
                </td>
                <td className="px-5 py-3 text-right font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
                  ${sale.total.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
