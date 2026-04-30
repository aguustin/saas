import { memo } from 'react'
import { Eye, ChevronLeft, ChevronRight } from 'lucide-react'
import { SaleStatusBadge } from '@/shared/components/ui/Badge'
import { SkeletonRow } from '@/shared/components/ui/Skeleton'
import { formatDate } from '@/shared/utils/date'
import type { SaleResponse } from '@/shared/types'

// ── Mapas de display ──────────────────────────────────────────────

const METHOD_LABEL: Record<string, string> = {
  cash:     'Efectivo',
  card:     'Tarjeta',
  transfer: 'Transferencia',
  mp:       'Mercado Pago',
  mixed:    'Mixto',
}

// ── Tabla ─────────────────────────────────────────────────────────

interface Props {
  items:        SaleResponse[]
  total:        number
  page:         number
  pageCount:    number
  pageSize:     number
  loading:      boolean
  onViewDetail: (sale: SaleResponse) => void
  onPageChange: (p: number) => void
}

export function SaleTable({
  items, total, page, pageCount, pageSize, loading,
  onViewDetail, onPageChange,
}: Props) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to   = Math.min(page * pageSize, total)

  return (
    <div className="flex flex-col gap-3">

      {/* Tabla */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">N° Venta</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Fecha</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Estado</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Método</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Subtotal</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Dto.</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">IVA</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Total</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500 dark:text-gray-400 w-12" />
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading && items.length === 0 && (
                Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={9} />)
              )}

              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-gray-400 text-sm">
                    No se encontraron ventas para el período seleccionado.
                  </td>
                </tr>
              )}

              {items.map(sale => (
                <SaleRow
                  key={sale.id}
                  sale={sale}
                  onViewDetail={onViewDetail}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Paginación + contador */}
      <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
        <span>
          {total === 0 ? 'Sin resultados' : `Mostrando ${from}–${to} de ${total} ventas`}
        </span>

        {pageCount > 1 && (
          <div className="flex items-center gap-1">
            <PageBtn
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
              aria-label="Anterior"
            >
              <ChevronLeft size={15} />
            </PageBtn>

            {buildRange(page, pageCount).map((p, i) =>
              p === '…' ? (
                <span key={`el-${i}`} className="px-1 select-none">…</span>
              ) : (
                <PageBtn
                  key={p}
                  active={p === page}
                  onClick={() => onPageChange(p as number)}
                >
                  {p}
                </PageBtn>
              ),
            )}

            <PageBtn
              onClick={() => onPageChange(page + 1)}
              disabled={page === pageCount}
              aria-label="Siguiente"
            >
              <ChevronRight size={15} />
            </PageBtn>
          </div>
        )}
      </div>
    </div>
  )
}

// ── SaleRow ───────────────────────────────────────────────────────

interface RowProps {
  sale:         SaleResponse
  onViewDetail: (sale: SaleResponse) => void
}

const SaleRow = memo(function SaleRow({ sale, onViewDetail }: RowProps) {
  return (
    <tr
      onClick={() => onViewDetail(sale)}
      className="group cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50
                 transition-colors"
    >
      <td className="px-4 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">
        #{sale.id.slice(-8).toUpperCase()}
      </td>
      <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
        {formatDate(sale.created_at)}
      </td>
      <td className="px-4 py-3">
        <SaleStatusBadge status={sale.status} />
      </td>
      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
        <div className="flex flex-col gap-0.5">
          <span>{METHOD_LABEL[sale.payment_method] ?? sale.payment_method}</span>
          {sale.payment_method === 'card' && sale.payment_details.card_last4 && (
            <span className="text-xs text-gray-400 font-mono">
              •••• {sale.payment_details.card_last4}
            </span>
          )}
          {sale.payment_method === 'card' && sale.payment_details.installments && sale.payment_details.installments > 1 && (
            <span className="text-xs text-gray-400">
              {sale.payment_details.installments} cuotas
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
        ${sale.subtotal.toFixed(2)}
      </td>
      <td className="px-4 py-3 text-right">
        {sale.discount > 0
          ? <span className="text-green-600 dark:text-green-400">-${sale.discount.toFixed(2)}</span>
          : <span className="text-gray-300 dark:text-gray-600">—</span>
        }
      </td>
      <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400">
        ${sale.tax.toFixed(2)}
      </td>
      <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-gray-100">
        ${sale.total.toFixed(2)}
      </td>
      <td className="px-4 py-3 text-center">
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onViewDetail(sale) }}
          title="Ver detalle"
          className="opacity-0 group-hover:opacity-100 transition-opacity
                     w-7 h-7 rounded-md flex items-center justify-center mx-auto
                     text-gray-400 hover:text-brand-600 hover:bg-brand-50
                     dark:hover:bg-brand-950/30"
        >
          <Eye size={14} />
        </button>
      </td>
    </tr>
  )
})

// ── Helpers ───────────────────────────────────────────────────────

function PageBtn({ children, onClick, disabled = false, active = false, ...rest }: {
  children:  React.ReactNode
  onClick:   () => void
  disabled?: boolean
  active?:   boolean
  [k: string]: unknown
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'min-w-[28px] h-7 px-1.5 rounded-md text-xs font-medium transition-colors',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        active
          ? 'bg-brand-600 text-white'
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700',
      ].join(' ')}
      {...rest}
    >
      {children}
    </button>
  )
}

function buildRange(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | '…')[] = [1]
  if (current > 3)             pages.push('…')
  if (current > 2)             pages.push(current - 1)
  if (current > 1 && current < total) pages.push(current)
  if (current < total - 1)    pages.push(current + 1)
  if (current < total - 2)    pages.push('…')
  pages.push(total)
  return [...new Set(pages)]
}
