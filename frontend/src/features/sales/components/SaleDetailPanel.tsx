import { useState } from 'react'
import { X, RotateCcw, AlertTriangle, Package } from 'lucide-react'
import { createPortal } from 'react-dom'
import { SaleStatusBadge } from '@/shared/components/ui/Badge'
import { Button } from '@/shared/components/ui/Button'
import { ConfirmModal } from '@/shared/components/ui/Modal'
import { Spinner } from '@/shared/components/ui/Skeleton'
import { formatDate } from '@/shared/utils/date'
import { isApiError } from '@/shared/api/errors'
import { useSaleDetail } from '@/features/sales/hooks/useSales'
import type { SaleResponse, SaleItemResponse } from '@/shared/types'
import type { RefundBody } from '@/features/sales/api/sales.api'

// ── Constantes de display ─────────────────────────────────────────

const METHOD_LABEL: Record<string, string> = {
  cash:     'Efectivo',
  card:     'Tarjeta',
  transfer: 'Transferencia',
  mp:       'Mercado Pago',
  mixed:    'Mixto',
}

// ── Panel principal ───────────────────────────────────────────────

interface Props {
  saleId:   string | null
  onClose:  () => void
  onRefund: (message: string) => void   // callback para toast de éxito
}

export function SaleDetailPanel({ saleId, onClose, onRefund }: Props) {
  const { sale, loading, error, refund, refunding } = useSaleDetail(saleId)

  // ── Estado de refund ──────────────────────────────────────────

  const [refundMode,    setRefundMode]    = useState<'none' | 'total' | 'partial'>('none')
  const [partialQtys,  setPartialQtys]   = useState<Record<string, number>>({})
  const [refundReason, setRefundReason]  = useState('')
  const [refundError,  setRefundError]   = useState<string | null>(null)
  const [confirmOpen,  setConfirmOpen]   = useState(false)

  function openTotalRefund() {
    setRefundMode('total')
    setRefundReason('')
    setRefundError(null)
  }

  function openPartialRefund() {
    if (!sale) return
    const initial: Record<string, number> = {}
    sale.items.forEach(item => { initial[item.id] = 0 })
    setPartialQtys(initial)
    setRefundMode('partial')
    setRefundReason('')
    setRefundError(null)
  }

  function cancelRefund() {
    setRefundMode('none')
    setPartialQtys({})
    setRefundReason('')
    setRefundError(null)
    setConfirmOpen(false)
  }

  function requestConfirm() {
    if (!refundReason.trim()) {
      setRefundError('El motivo del reembolso es requerido.')
      return
    }
    setRefundError(null)
    setConfirmOpen(true)
  }

  async function executeRefund() {
    if (!sale) return
    setRefundError(null)
    setConfirmOpen(false)

    let body: RefundBody = { reason: refundReason.trim(), restock: true }

    if (refundMode === 'partial') {
      const items = Object.entries(partialQtys)
        .filter(([, qty]) => qty > 0)
        .map(([sale_item_id, quantity]) => ({ sale_item_id, quantity }))

      if (items.length === 0) {
        setRefundError('Seleccioná al menos una unidad para reembolsar.')
        return
      }

      body = { reason: refundReason.trim(), restock: true, items }
    }

    try {
      await refund(sale.id, body)
      onRefund('Reembolso aplicado correctamente.')
      cancelRefund()
    } catch (err) {
      if (isApiError(err)) {
        setRefundError(err.message)
      } else {
        setRefundError('Error al procesar el reembolso.')
      }
    }
  }

  // ── Portal: panel deslizante desde la derecha ─────────────────

  if (!saleId) return null

  return createPortal(
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Detalle de venta"
        className="fixed inset-y-0 right-0 z-50 w-full max-w-lg
                   bg-white dark:bg-gray-900 shadow-2xl
                   flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4
                        border-b border-gray-100 dark:border-gray-800 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Detalle de venta
            </h2>
            {sale && (
              <p className="text-xs text-gray-400 font-mono mt-0.5">
                #{sale.id.slice(-8).toUpperCase()}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600
                       hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <Spinner size={28} />
            </div>
          )}

          {error && (
            <div className="flex items-center gap-3 text-sm text-red-600 dark:text-red-400
                            bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800
                            rounded-xl px-4 py-3">
              <AlertTriangle size={16} className="shrink-0" />
              {error}
            </div>
          )}

          {sale && !loading && (
            <>
              {/* Metadatos */}
              <MetaSection sale={sale} />

              {/* Ítems */}
              <ItemsSection items={sale.items} />

              {/* Totales */}
              <TotalsSection sale={sale} />

              {/* Detalles de pago */}
              <PaymentSection sale={sale} />

              {/* Notas */}
              {sale.notes && (
                <div className="rounded-xl bg-gray-50 dark:bg-gray-800 px-4 py-3">
                  <p className="text-xs text-gray-500 mb-1">Nota</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{sale.notes}</p>
                </div>
              )}

              {/* Reembolso total UI */}
              {refundMode === 'total' && (
                <TotalRefundSection
                  total={sale.total}
                  reason={refundReason}
                  onReasonChange={setRefundReason}
                  onConfirm={requestConfirm}
                  onCancel={cancelRefund}
                  loading={refunding}
                />
              )}

              {/* Reembolso parcial UI */}
              {refundMode === 'partial' && (
                <PartialRefundSection
                  items={sale.items}
                  qtys={partialQtys}
                  onChange={(id, qty) => setPartialQtys(prev => ({ ...prev, [id]: qty }))}
                  reason={refundReason}
                  onReasonChange={setRefundReason}
                  onConfirm={requestConfirm}
                  onCancel={cancelRefund}
                  loading={refunding}
                />
              )}

              {/* Error de reembolso */}
              {refundError && (
                <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40
                                border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
                  {refundError}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer: acciones de reembolso */}
        {sale?.status === 'completed' && refundMode === 'none' && (
          <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 shrink-0
                          flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<RotateCcw size={13} />}
              onClick={openTotalRefund}
              className="text-red-600 border-red-200 hover:bg-red-50
                         dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950/30"
            >
              Reembolso total
            </Button>
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<RotateCcw size={13} />}
              onClick={openPartialRefund}
              className="text-gray-600 dark:text-gray-400"
            >
              Parcial
            </Button>
          </div>
        )}
      </div>

      {/* Confirm modal */}
      <ConfirmModal
        open={confirmOpen}
        onClose={cancelRefund}
        onConfirm={() => void executeRefund()}
        title={refundMode === 'total' ? '¿Reembolso total?' : '¿Confirmar reembolso parcial?'}
        description={
          refundMode === 'total'
            ? `Se reembolsará el importe completo ($${sale?.total.toFixed(2)}) y el stock será repuesto.`
            : 'Se reembolsarán las cantidades seleccionadas y el stock será repuesto.'
        }
        confirmLabel="Confirmar reembolso"
        loading={refunding}
        danger
      />
    </>,
    document.body,
  )
}

// ── MetaSection ───────────────────────────────────────────────────

function MetaSection({ sale }: { sale: SaleResponse }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <MetaRow label="Fecha"   value={formatDate(sale.created_at)} />
      <MetaRow label="Estado"  value={<SaleStatusBadge status={sale.status} />} />
      <MetaRow label="Método"  value={METHOD_LABEL[sale.payment_method] ?? sale.payment_method} />
      <MetaRow label="Ítems"   value={`${sale.items.length} producto${sale.items.length !== 1 ? 's' : ''}`} />
    </div>
  )
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-gray-50 dark:bg-gray-800 px-4 py-3">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{label}</p>
      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{value}</div>
    </div>
  )
}

// ── ItemsSection ──────────────────────────────────────────────────

function ItemsSection({ items }: { items: SaleItemResponse[] }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
        Productos
      </p>
      <div className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800 text-xs text-gray-400">
              <th className="px-4 py-2 text-left font-medium">Producto</th>
              <th className="px-4 py-2 text-right font-medium">Cant.</th>
              <th className="px-4 py-2 text-right font-medium">P. Unit.</th>
              <th className="px-4 py-2 text-right font-medium">Dto.</th>
              <th className="px-4 py-2 text-right font-medium">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {items.map(item => (
              <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <Package size={13} className="text-gray-400 shrink-0" />
                    <div>
                      <p className="text-gray-900 dark:text-gray-100">{item.product_name}</p>
                      {item.product_sku && (
                        <p className="text-xs text-gray-400 font-mono">{item.product_sku}</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-right text-gray-600 dark:text-gray-300">
                  {item.quantity}
                </td>
                <td className="px-4 py-2.5 text-right text-gray-600 dark:text-gray-300">
                  ${item.unit_price.toFixed(2)}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {item.discount > 0
                    ? <span className="text-green-600 dark:text-green-400">-${item.discount.toFixed(2)}</span>
                    : <span className="text-gray-300 dark:text-gray-600">—</span>
                  }
                </td>
                <td className="px-4 py-2.5 text-right font-medium text-gray-900 dark:text-gray-100">
                  ${item.subtotal.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── TotalsSection ─────────────────────────────────────────────────

function TotalsSection({ sale }: { sale: SaleResponse }) {
  return (
    <div className="space-y-1.5 text-sm">
      <TotalRow label="Subtotal" value={`$${sale.subtotal.toFixed(2)}`} />
      {sale.discount > 0 && (
        <TotalRow
          label="Descuento"
          value={`-$${sale.discount.toFixed(2)}`}
          valueClass="text-green-600 dark:text-green-400"
        />
      )}
      <TotalRow
        label="IVA (21%)"
        value={`$${sale.tax.toFixed(2)}`}
        labelClass="text-gray-400"
        valueClass="text-gray-500"
      />
      <div className="border-t border-gray-100 dark:border-gray-800 pt-1.5 mt-1.5">
        <TotalRow
          label="Total"
          value={`$${sale.total.toFixed(2)}`}
          labelClass="font-semibold text-gray-900 dark:text-gray-100"
          valueClass="font-bold text-gray-900 dark:text-gray-100 text-base"
        />
      </div>
    </div>
  )
}

function TotalRow({ label, value, labelClass = 'text-gray-500', valueClass = 'text-gray-700 dark:text-gray-300' }: {
  label:       string
  value:       string
  labelClass?: string
  valueClass?: string
}) {
  return (
    <div className="flex justify-between items-center">
      <span className={`text-sm ${labelClass}`}>{label}</span>
      <span className={`text-sm ${valueClass}`}>{value}</span>
    </div>
  )
}

// ── PaymentSection ────────────────────────────────────────────────

function PaymentSection({ sale }: { sale: SaleResponse }) {
  const pd = sale.payment_details

  const rows: Array<{ label: string; value: string }> = []

  if (pd.cash_received != null) {
    rows.push({ label: 'Recibido', value: `$${pd.cash_received.toFixed(2)}` })
  }
  if (pd.change != null) {
    rows.push({ label: 'Vuelto', value: `$${pd.change.toFixed(2)}` })
  }
  if (pd.card_last4) {
    rows.push({ label: 'Tarjeta', value: `•••• ${pd.card_last4}` })
  }
  if (pd.installments && pd.installments > 1) {
    rows.push({ label: 'Cuotas', value: String(pd.installments) })
  }
  if (pd.transfer_ref) {
    rows.push({ label: 'Ref. transferencia', value: pd.transfer_ref })
  }
  if (pd.mp_payment_id) {
    rows.push({ label: 'ID Mercado Pago', value: pd.mp_payment_id })
  }

  if (pd.mixed_breakdown && pd.mixed_breakdown.length > 0) {
    pd.mixed_breakdown.forEach(b => {
      rows.push({ label: METHOD_LABEL[b.method] ?? b.method, value: `$${b.amount.toFixed(2)}` })
    })
  }

  if (rows.length === 0) return null

  return (
    <div>
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
        Detalles de pago
      </p>
      <div className="rounded-xl bg-gray-50 dark:bg-gray-800 px-4 py-3 space-y-1.5">
        {rows.map(r => (
          <div key={r.label} className="flex justify-between items-center text-sm">
            <span className="text-gray-500 dark:text-gray-400">{r.label}</span>
            <span className="text-gray-900 dark:text-gray-100 font-medium">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── ReasonField — campo compartido entre total y parcial ──────────

function ReasonField({
  value, onChange,
}: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800">
      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
        Motivo del reembolso <span className="text-red-500 dark:text-red-400">*</span>
      </label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Ej: producto defectuoso, error en cobro..."
        rows={2}
        maxLength={200}
        className="w-full text-sm rounded-lg resize-none
                   border border-gray-300 dark:border-gray-600
                   bg-white dark:bg-gray-800
                   text-gray-900 dark:text-gray-100
                   placeholder:text-gray-400 dark:placeholder:text-gray-500
                   px-3 py-2
                   focus:outline-none focus:ring-2 focus:ring-brand-500
                   transition-colors"
      />
    </div>
  )
}

// ── TotalRefundSection ────────────────────────────────────────────

interface TotalRefundProps {
  total:          number
  reason:         string
  onReasonChange: (v: string) => void
  onConfirm:      () => void
  onCancel:       () => void
  loading:        boolean
}

function TotalRefundSection({ total, reason, onReasonChange, onConfirm, onCancel, loading }: TotalRefundProps) {
  return (
    <div className="border border-red-200 dark:border-red-800 rounded-xl overflow-hidden">
      <div className="bg-red-50 dark:bg-red-950/30 px-4 py-2.5 flex items-center gap-2">
        <RotateCcw size={13} className="text-red-600 dark:text-red-400" />
        <p className="text-sm font-medium text-red-700 dark:text-red-300">
          Reembolso total — ${total.toFixed(2)}
        </p>
      </div>

      <ReasonField value={reason} onChange={onReasonChange} />

      <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2">
        <Button
          variant="danger"
          size="sm"
          disabled={!reason.trim() || loading}
          loading={loading}
          onClick={onConfirm}
        >
          Confirmar reembolso
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={loading}>
          Cancelar
        </Button>
      </div>
    </div>
  )
}

// ── PartialRefundSection ──────────────────────────────────────────

interface PartialRefundProps {
  items:          SaleItemResponse[]
  qtys:           Record<string, number>
  onChange:       (id: string, qty: number) => void
  reason:         string
  onReasonChange: (v: string) => void
  onConfirm:      () => void
  onCancel:       () => void
  loading:        boolean
}

function PartialRefundSection({ items, qtys, onChange, reason, onReasonChange, onConfirm, onCancel, loading }: PartialRefundProps) {
  const hasSelection = Object.values(qtys).some(q => q > 0)

  return (
    <div className="border border-amber-200 dark:border-amber-800 rounded-xl overflow-hidden">
      <div className="bg-amber-50 dark:bg-amber-950/30 px-4 py-2.5 flex items-center gap-2">
        <RotateCcw size={13} className="text-amber-600 dark:text-amber-400" />
        <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
          Reembolso parcial — indicá las cantidades
        </p>
      </div>

      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {items.map(item => (
          <div key={item.id} className="flex items-center justify-between px-4 py-3 gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900 dark:text-gray-100 truncate">{item.product_name}</p>
              <p className="text-xs text-gray-400">Cant. original: {item.quantity}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-gray-400">Reembolsar:</span>
              <input
                type="number"
                min={0}
                max={item.quantity}
                value={qtys[item.id] ?? 0}
                onChange={e => {
                  const v = parseInt(e.target.value, 10)
                  onChange(item.id, Math.min(item.quantity, Math.max(0, isNaN(v) ? 0 : v)))
                }}
                className="w-16 text-center rounded-lg border border-gray-300 dark:border-gray-600
                           bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100
                           px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-500
                           transition-colors"
              />
            </div>
          </div>
        ))}
      </div>

      <ReasonField value={reason} onChange={onReasonChange} />

      <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2">
        <Button
          variant="danger"
          size="sm"
          disabled={!hasSelection || !reason.trim() || loading}
          loading={loading}
          onClick={onConfirm}
        >
          Confirmar reembolso
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={loading}>
          Cancelar
        </Button>
      </div>
    </div>
  )
}
