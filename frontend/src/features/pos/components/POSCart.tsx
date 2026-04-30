import { memo } from 'react'
import { Minus, Plus, Trash2, Tag, ShoppingCart } from 'lucide-react'
import type { CartItem, POSTotals } from '../hooks/usePOS'

interface Props {
  items:            CartItem[]
  totals:           POSTotals
  globalDiscount:   number
  onUpdateItem:     (productId: string, changes: Partial<Pick<CartItem, 'quantity' | 'unit_price' | 'discount'>>) => void
  onRemoveItem:     (productId: string) => void
  onGlobalDiscount: (v: number) => void
  onCheckout:       () => void
  disabled?:        boolean
}

export function POSCart({
  items, totals, globalDiscount,
  onUpdateItem, onRemoveItem, onGlobalDiscount, onCheckout,
  disabled = false,
}: Props) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-content-subtle">
        <ShoppingCart size={48} strokeWidth={1} />
        <p className="text-sm">El carrito está vacío</p>
        <p className="text-xs text-content-subtle">Buscá un producto o escaneá un código</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">

      {/* Lista de ítems */}
      <div className="flex-1 overflow-y-auto space-y-1 pr-1">
        {items.map(item => (
          <CartRow key={item.product.id} item={item} onUpdateItem={onUpdateItem} onRemoveItem={onRemoveItem} />
        ))}
      </div>

      {/* Descuento global */}
      <div className="border-t border-edge pt-3 mt-2">
        <div className="flex items-center gap-2 mb-3">
          <Tag size={14} className="text-content-subtle shrink-0" />
          <span className="text-xs text-content-subtle flex-1">Descuento global ($)</span>
          <input
            type="number"
            min={0}
            max={totals.subtotal}
            step={0.01}
            value={globalDiscount || ''}
            onChange={e => onGlobalDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
            placeholder="0.00"
            className="w-24 bg-surface-2 border border-edge rounded-lg px-2 py-1
                       text-sm text-right text-content placeholder-content-subtle outline-none
                       focus:border-brand-500 transition-colors"
          />
        </div>

        {/* Resumen de totales */}
        <div className="space-y-1 text-sm">
          <TotalRow label="Subtotal"  value={totals.subtotal} />
          {totals.discount > 0 && (
            <TotalRow label="Descuento" value={-totals.discount} className="text-green-500" />
          )}
          <TotalRow label="IVA (21%)" value={totals.tax} className="text-content-subtle text-xs" />
          <div className="border-t border-edge pt-2 mt-1">
            <TotalRow label="Total" value={totals.total} className="text-content font-bold text-base" />
          </div>
        </div>

        {/* Botón cobrar */}
        <button
          type="button"
          onClick={onCheckout}
          disabled={disabled || items.length === 0}
          className="w-full mt-4 bg-brand-600 hover:bg-brand-700 active:bg-brand-800
                     disabled:opacity-50 disabled:cursor-not-allowed
                     text-white font-semibold py-3 rounded-xl transition-colors
                     flex items-center justify-center gap-2 text-sm"
        >
          Cobrar ${totals.total.toFixed(2)}
        </button>
      </div>
    </div>
  )
}

// ── CartRow ───────────────────────────────────────────────────────

interface CartRowProps {
  item:         CartItem
  onUpdateItem: (productId: string, changes: Partial<Pick<CartItem, 'quantity' | 'unit_price' | 'discount'>>) => void
  onRemoveItem: (productId: string) => void
}

const CartRow = memo(function CartRow({ item, onUpdateItem, onRemoveItem }: CartRowProps) {
  const id = item.product.id

  function handleQty(delta: number) {
    const next = item.quantity + delta
    if (next <= 0) onRemoveItem(id)
    else onUpdateItem(id, { quantity: next })
  }

  return (
    <div className="group flex items-start gap-3 px-2 py-2 rounded-lg hover:bg-surface-2 transition-colors">
      {/* Info producto */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-content font-medium truncate">{item.product.name}</p>

        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-xs text-content-subtle">Precio:</span>
          <input
            type="number" min={0} step={0.01} value={item.unit_price}
            onChange={e => onUpdateItem(id, { unit_price: parseFloat(e.target.value) || 0 })}
            className="w-20 bg-surface-2 border border-edge rounded px-2 py-0.5
                       text-xs text-content outline-none focus:border-brand-500 transition-colors"
          />
          <span className="text-xs text-content-subtle">Dto:</span>
          <input
            type="number" min={0} step={0.01} value={item.discount || ''}
            onChange={e => onUpdateItem(id, { discount: parseFloat(e.target.value) || 0 })}
            placeholder="0"
            className="w-16 bg-surface-2 border border-edge rounded px-2 py-0.5
                       text-xs text-content placeholder-content-subtle outline-none focus:border-brand-500 transition-colors"
          />
        </div>
      </div>

      {/* Controles de cantidad */}
      <div className="flex items-center gap-1 shrink-0 mt-0.5">
        <button
          type="button" onClick={() => handleQty(-1)}
          className="w-6 h-6 flex items-center justify-center rounded bg-surface-3
                     hover:bg-edge text-content-2 transition-colors"
          aria-label="Reducir cantidad"
        >
          <Minus size={12} />
        </button>
        <input
          type="number" min={1} value={item.quantity}
          onChange={e => { const v = parseInt(e.target.value, 10); if (v > 0) onUpdateItem(id, { quantity: v }) }}
          className="w-10 text-center bg-surface-2 border border-edge rounded px-1 py-0.5
                     text-sm text-content outline-none focus:border-brand-500 transition-colors"
        />
        <button
          type="button" onClick={() => handleQty(1)}
          className="w-6 h-6 flex items-center justify-center rounded bg-surface-3
                     hover:bg-edge text-content-2 transition-colors"
          aria-label="Aumentar cantidad"
        >
          <Plus size={12} />
        </button>
      </div>

      {/* Subtotal + eliminar */}
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="text-sm font-medium text-content">${item.subtotal.toFixed(2)}</span>
        <button
          type="button" onClick={() => onRemoveItem(id)}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-content-subtle hover:text-red-500"
          aria-label="Eliminar producto"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
})

// ── TotalRow ──────────────────────────────────────────────────────

function TotalRow({ label, value, className = 'text-content-muted' }: {
  label: string; value: number; className?: string
}) {
  return (
    <div className={`flex items-center justify-between ${className}`}>
      <span>{label}</span>
      <span>${Math.abs(value).toFixed(2)}{value < 0 ? ' ↓' : ''}</span>
    </div>
  )
}
