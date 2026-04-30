import { Skeleton } from '@/shared/components/ui/Skeleton'
import type { TopProduct } from '../hooks/useDashboard30Days'

interface Props {
  products: TopProduct[]
  loading:  boolean
}

export function DashboardTopProducts({ products, loading }: Props) {
  return (
    <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Top 5 productos — últimos 30 días
      </h3>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton height={12} width="60%" rounded="sm" />
              <Skeleton height={8}  width="100%" rounded="sm" />
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 py-4 text-center">
          Sin ventas registradas en este período
        </p>
      ) : (
        <div className="space-y-4">
          {products.map((p, i) => {
            const maxQty = products[0].quantity
            const pct    = maxQty > 0 ? (p.quantity / maxQty) * 100 : 0

            return (
              <div key={p.product_id}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold text-gray-400 dark:text-gray-500 w-4 shrink-0 tabular-nums">
                      {i + 1}
                    </span>
                    <span className="text-xs text-gray-700 dark:text-gray-300 truncate">
                      {p.product_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                      {p.quantity} uds
                    </span>
                    <span className="text-xs font-medium text-gray-900 dark:text-gray-100 tabular-nums">
                      ${p.revenue.toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-brand-500 transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
