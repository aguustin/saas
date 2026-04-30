import { useState } from 'react'
import { X, CreditCard, Banknote, Smartphone, Repeat2, ArrowRight, Loader2 } from 'lucide-react'
import type { POSTotals } from '../hooks/usePOS'
import type { PaymentMethod } from '@/shared/types'
import type { CreateSaleBody, MixedBreakdown } from '@/features/sales/api/sales.api'

interface Props {
  totals:       POSTotals
  submitting:   boolean
  onConfirm:    (method: PaymentMethod, details: CreateSaleBody['payment_details'], notes?: string) => void
  onClose:      () => void
  validateMixed:(breakdown: MixedBreakdown[]) => string | null
}

type Tab = PaymentMethod

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'cash',     label: 'Efectivo',      icon: <Banknote   size={16} /> },
  { id: 'card',     label: 'Tarjeta',       icon: <CreditCard size={16} /> },
  { id: 'transfer', label: 'Transferencia', icon: <ArrowRight size={16} /> },
  { id: 'mp',       label: 'Mercado Pago',  icon: <Smartphone size={16} /> },
  { id: 'mixed',    label: 'Mixto',         icon: <Repeat2    size={16} /> },
]

const MIXED_METHODS: Array<{ id: Exclude<PaymentMethod, 'mixed'>; label: string }> = [
  { id: 'cash',     label: 'Efectivo'      },
  { id: 'card',     label: 'Tarjeta'       },
  { id: 'transfer', label: 'Transferencia' },
  { id: 'mp',       label: 'Mercado Pago'  },
]

export function POSCheckout({ totals, submitting, onConfirm, onClose, validateMixed }: Props) {
  const [tab,          setTab]          = useState<Tab>('cash')
  const [notes,        setNotes]        = useState('')
  const [cashReceived, setCashReceived] = useState('')
  const [card4,        setCard4]        = useState('')
  const [installments, setInstallments] = useState(1)
  const [transferRef,  setTransferRef]  = useState('')
  const [mpId,         setMpId]         = useState('')
  const [mixedAmounts, setMixedAmounts] = useState<Record<string, string>>({
    cash: '', card: '', transfer: '', mp: '',
  })
  const [mixedError, setMixedError] = useState<string | null>(null)
  const [formError,  setFormError]  = useState<string | null>(null)

  const cashChange =
    tab === 'cash' && parseFloat(cashReceived) > 0
      ? parseFloat(cashReceived) - totals.total
      : null

  function buildDetails(): CreateSaleBody['payment_details'] {
    switch (tab) {
      case 'cash':     return { cash_received: parseFloat(cashReceived) || undefined, change: cashChange != null && cashChange >= 0 ? cashChange : undefined }
      case 'card':     return { card_last4: card4.slice(-4) || undefined, installments: installments > 1 ? installments : undefined }
      case 'transfer': return { transfer_ref: transferRef || undefined }
      case 'mp':       return { mp_payment_id: mpId || undefined }
      case 'mixed': {
        const breakdown: MixedBreakdown[] = MIXED_METHODS
          .map(m => ({ method: m.id, amount: parseFloat(mixedAmounts[m.id] ?? '') || 0 }))
          .filter(b => b.amount > 0)
        return { mixed_breakdown: breakdown }
      }
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null); setMixedError(null)
    if (tab === 'cash') {
      const received = parseFloat(cashReceived) || 0
      if (received > 0 && received < totals.total) { setFormError('El monto recibido es menor al total.'); return }
    }
    if (tab === 'mixed') {
      const breakdown: MixedBreakdown[] = MIXED_METHODS.map(m => ({ method: m.id, amount: parseFloat(mixedAmounts[m.id] ?? '') || 0 }))
      const error = validateMixed(breakdown)
      if (error) { setMixedError(error); return }
    }
    onConfirm(tab, buildDetails(), notes || undefined)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="bg-surface border border-edge rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-edge">
          <div>
            <h2 className="text-content font-semibold text-lg">Cobrar</h2>
            <p className="text-content-muted text-sm">
              Total: <span className="text-content font-bold">${totals.total.toFixed(2)}</span>
            </p>
          </div>
          <button
            type="button" onClick={onClose} disabled={submitting}
            className="text-content-subtle hover:text-content transition-colors disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

            {/* Resumen */}
            <div className="bg-surface-2 rounded-xl p-4 space-y-1 text-sm">
              <div className="flex justify-between text-content-muted">
                <span>Subtotal</span><span>${totals.subtotal.toFixed(2)}</span>
              </div>
              {totals.discount > 0 && (
                <div className="flex justify-between text-green-500">
                  <span>Descuento</span><span>-${totals.discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-content-muted">
                <span>IVA 21%</span><span>${totals.tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-content font-bold text-base border-t border-edge pt-2 mt-1">
                <span>Total</span><span>${totals.total.toFixed(2)}</span>
              </div>
            </div>

            {/* Tabs de método de pago */}
            <div className="flex gap-1 bg-surface-2 rounded-xl p-1">
              {TABS.map(t => (
                <button
                  key={t.id} type="button"
                  onClick={() => { setTab(t.id); setFormError(null); setMixedError(null) }}
                  className={[
                    'flex-1 flex flex-col items-center gap-1 py-2 px-1 rounded-lg text-xs font-medium transition-colors',
                    tab === t.id
                      ? 'bg-brand-600 text-white'
                      : 'text-content-muted hover:text-content hover:bg-surface-3',
                  ].join(' ')}
                >
                  {t.icon}
                  <span className="hidden sm:block">{t.label}</span>
                </button>
              ))}
            </div>

            {tab === 'cash'     && <CashFields cashReceived={cashReceived} total={totals.total} change={cashChange} onChange={setCashReceived} />}
            {tab === 'card'     && <CardFields last4={card4} installments={installments} onLast4={setCard4} onInstallments={setInstallments} />}
            {tab === 'transfer' && <LabelField label="Referencia de transferencia" value={transferRef} placeholder="Número de operación (opcional)" onChange={setTransferRef} />}
            {tab === 'mp'       && <LabelField label="ID de pago MercadoPago" value={mpId} placeholder="ID del pago (opcional)" onChange={setMpId} />}
            {tab === 'mixed'    && <MixedFields amounts={mixedAmounts} total={totals.total} error={mixedError} onChange={(id, val) => setMixedAmounts(prev => ({ ...prev, [id]: val }))} />}

            {/* Nota */}
            <div>
              <label className="block text-xs text-content-subtle mb-1">Nota (opcional)</label>
              <input
                type="text" value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Ej: cliente recurrente" maxLength={120}
                className="w-full bg-surface-2 border border-edge rounded-lg px-3 py-2
                           text-sm text-content placeholder-content-subtle outline-none
                           focus:border-brand-500 transition-colors"
              />
            </div>

            {formError && (
              <p className="text-sm text-red-500 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                {formError}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-edge">
            <button
              type="submit" disabled={submitting}
              className="w-full bg-brand-600 hover:bg-brand-700 active:bg-brand-800
                         disabled:opacity-50 disabled:cursor-not-allowed
                         text-white font-semibold py-3 rounded-xl transition-colors
                         flex items-center justify-center gap-2"
            >
              {submitting
                ? <><Loader2 size={16} className="animate-spin" /> Procesando…</>
                : `Confirmar cobro $${totals.total.toFixed(2)}`
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Sub-formularios ───────────────────────────────────────────────

function inputCls() {
  return 'w-full bg-surface-2 border border-edge rounded-lg px-3 py-2 text-sm text-content placeholder-content-subtle outline-none focus:border-brand-500 transition-colors'
}

function CashFields({ cashReceived, total, change, onChange }: {
  cashReceived: string; total: number; change: number | null; onChange: (v: string) => void
}) {
  const quickAmounts = [total, Math.ceil(total / 10) * 10, Math.ceil(total / 50) * 50, Math.ceil(total / 100) * 100]
    .filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 4)

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-content-subtle mb-1">Efectivo recibido</label>
        <input type="number" min={0} step={0.01} value={cashReceived} onChange={e => onChange(e.target.value)} placeholder={total.toFixed(2)} autoFocus className={inputCls()} />
      </div>
      <div className="flex gap-2 flex-wrap">
        {quickAmounts.map(v => (
          <button key={v} type="button" onClick={() => onChange(String(v))}
            className="flex-1 min-w-[70px] bg-surface-3 hover:bg-edge text-content text-xs font-medium rounded-lg py-1.5 transition-colors">
            ${v}
          </button>
        ))}
      </div>
      {change !== null && change >= 0 && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-2 flex items-center justify-between">
          <span className="text-sm text-green-600 dark:text-green-400">Vuelto</span>
          <span className="text-lg font-bold text-green-600 dark:text-green-400">${change.toFixed(2)}</span>
        </div>
      )}
    </div>
  )
}

function CardFields({ last4, installments, onLast4, onInstallments }: {
  last4: string; installments: number; onLast4: (v: string) => void; onInstallments: (v: number) => void
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-content-subtle mb-1">Últimos 4 dígitos (opcional)</label>
        <input type="text" maxLength={4} inputMode="numeric" value={last4} onChange={e => onLast4(e.target.value.replace(/\D/g, ''))} placeholder="1234" className={inputCls()} />
      </div>
      <div>
        <label className="block text-xs text-content-subtle mb-1">Cuotas</label>
        <select value={installments} onChange={e => onInstallments(parseInt(e.target.value, 10))}
          className="w-full bg-surface-2 border border-edge rounded-lg px-3 py-2 text-sm text-content outline-none focus:border-brand-500 transition-colors">
          {[1, 3, 6, 9, 12, 18, 24].map(n => (
            <option key={n} value={n}>{n === 1 ? 'Sin cuotas' : `${n} cuotas`}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

function LabelField({ label, value, placeholder, onChange }: {
  label: string; value: string; placeholder: string; onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="block text-xs text-content-subtle mb-1">{label}</label>
      <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={inputCls()} />
    </div>
  )
}

function MixedFields({ amounts, total, error, onChange }: {
  amounts: Record<string, string>; total: number; error: string | null; onChange: (id: string, val: string) => void
}) {
  const sum = MIXED_METHODS.reduce((acc, m) => acc + (parseFloat(amounts[m.id] ?? '') || 0), 0)
  const remaining = total - sum

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {MIXED_METHODS.map(m => (
          <div key={m.id} className="flex items-center gap-3">
            <span className="text-sm text-content-muted w-28 shrink-0">{m.label}</span>
            <input type="number" min={0} step={0.01} value={amounts[m.id] ?? ''} onChange={e => onChange(m.id, e.target.value)} placeholder="0.00" className={inputCls()} />
          </div>
        ))}
      </div>

      <div className={[
        'flex items-center justify-between text-sm rounded-lg px-3 py-2',
        Math.abs(remaining) < 0.01
          ? 'bg-green-500/10 border border-green-500/30 text-green-600 dark:text-green-400'
          : 'bg-surface-2 border border-edge text-content-muted',
      ].join(' ')}>
        <span>Pendiente</span>
        <span className="font-medium">${Math.max(0, remaining).toFixed(2)}</span>
      </div>

      {error && (
        <p className="text-sm text-red-500 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
    </div>
  )
}
