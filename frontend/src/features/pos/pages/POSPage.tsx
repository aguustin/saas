import { memo, useEffect, useRef } from 'react'
import { AlertTriangle, WifiOff, Wifi } from 'lucide-react'
import { usePOS } from '../hooks/usePOS'
import { POSSearch } from '../components/POSSearch'
import { POSCart } from '../components/POSCart'
import { POSCheckout } from '../components/POSCheckout'
import { POSTicket } from '../components/POSTicket'
import { PaymentQRModal } from '../components/PaymentQRModal'
import { usePendingSalesCount } from '@/features/sync/store/sync.store'

export function POSPage() {
  const inputRef = useRef<HTMLInputElement>(null)

  const {
    items, totals, globalDiscount, setGlobalDiscount,
    addToCart, updateItem, removeItem, clearCart,
    query, searchResults, searchLoading, search,
    stage, setStage, submitting, checkout, validateMixed,
    ticket, newSale, stockModal, setStockModal, isOnline,
    mpQRData, onMpApproved, cancelMpPayment,
  } = usePOS()

  const pendingCount = usePendingSalesCount()

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName.toLowerCase()
      const inInput = tag === 'input' || tag === 'textarea' || tag === 'select'

      if (e.key === 'F2') {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
        return
      }
      if (e.key === '/' && !inInput) {
        e.preventDefault()
        inputRef.current?.focus()
        return
      }
      if (e.key === 'F10' && stage === 'cart' && items.length > 0) {
        e.preventDefault()
        setStage('payment')
        return
      }
      if (e.key === 'Escape') {
        if (stockModal.open) { setStockModal({ open: false, details: [] }); return }
        if (stage === 'payment') { setStage('cart'); return }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [stage, items.length, stockModal.open, setStage, setStockModal])

  if (stage === 'ticket' && ticket) {
    return (
      <div className="h-full flex flex-col bg-page">
        <POSTicket ticket={ticket} onNewSale={newSale} />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-page overflow-hidden">

      <StatusBar isOnline={isOnline} pendingCount={pendingCount} />

      <div className="flex flex-1 overflow-hidden">

        {/* Panel izquierdo: búsqueda */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-edge p-4 gap-3">
          <POSSearch
            query={query}
            results={searchResults}
            loading={searchLoading}
            isOffline={!isOnline}
            onChange={search}
            onSelect={p => addToCart(p)}
            inputRef={inputRef}
          />

          <div className="flex items-center gap-4 text-xs text-content-subtle px-1">
            <KeyHint keys={['F2', '/']} label="buscar" />
            <KeyHint keys={['↑', '↓']}  label="navegar" />
            <KeyHint keys={['Enter']}    label="agregar" />
            <KeyHint keys={['F10']}      label="cobrar" />
          </div>

          {!query && items.length === 0 && (
            <EmptyState isOnline={isOnline} />
          )}
        </div>

        {/* Panel derecho: carrito */}
        <div className="w-80 xl:w-96 flex flex-col bg-surface p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-content">
              Carrito
              {items.length > 0 && (
                <span className="ml-2 text-xs bg-brand-600 text-white rounded-full px-1.5 py-0.5">
                  {items.length}
                </span>
              )}
            </h2>
            {items.length > 0 && (
              <button
                type="button"
                onClick={clearCart}
                className="text-xs text-content-subtle hover:text-red-500 transition-colors"
              >
                Vaciar
              </button>
            )}
          </div>

          <div className="flex-1 overflow-hidden">
            <POSCart
              items={items}
              totals={totals}
              globalDiscount={globalDiscount}
              onUpdateItem={updateItem}
              onRemoveItem={removeItem}
              onGlobalDiscount={setGlobalDiscount}
              onCheckout={() => setStage('payment')}
              disabled={submitting}
            />
          </div>
        </div>
      </div>

      {stage === 'payment' && (
        <POSCheckout
          totals={totals}
          submitting={submitting}
          validateMixed={validateMixed}
          onConfirm={checkout}
          onClose={() => setStage('cart')}
        />
      )}

      {stage === 'mp_qr' && mpQRData && (
        <PaymentQRModal
          qrData={mpQRData}
          onApproved={onMpApproved}
          onCancel={cancelMpPayment}
        />
      )}

      {stockModal.open && (
        <InsufficientStockModal
          details={stockModal.details}
          onClose={() => setStockModal({ open: false, details: [] })}
        />
      )}
    </div>
  )
}

// ── StatusBar ─────────────────────────────────────────────────────

const StatusBar = memo(function StatusBar({
  isOnline, pendingCount,
}: { isOnline: boolean; pendingCount: number }) {
  if (isOnline && pendingCount === 0) return null

  return (
    <div className={[
      'flex items-center gap-2 px-4 py-2 text-xs font-medium',
      !isOnline
        ? 'bg-amber-950/60 border-b border-amber-800 text-amber-300'
        : 'bg-blue-950/60 border-b border-blue-800 text-blue-300',
    ].join(' ')}>
      {!isOnline
        ? <><WifiOff size={13} /> Sin conexión — las ventas se guardarán localmente</>
        : <><Wifi size={13} /> {pendingCount} {pendingCount === 1 ? 'venta pendiente' : 'ventas pendientes'} de sincronizar</>
      }
    </div>
  )
})

// ── KeyHint ───────────────────────────────────────────────────────

const KeyHint = memo(function KeyHint({ keys, label }: { keys: string[]; label: string }) {
  return (
    <span className="flex items-center gap-1">
      {keys.map(k => (
        <kbd key={k} className="bg-surface-2 border border-edge rounded px-1 py-0.5 text-content-muted font-mono">
          {k}
        </kbd>
      ))}
      <span>{label}</span>
    </span>
  )
})

// ── EmptyState ────────────────────────────────────────────────────

const EmptyState = memo(function EmptyState({ isOnline }: { isOnline: boolean }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-content-subtle">
      <div className="text-6xl select-none">🛒</div>
      <p className="text-sm font-medium text-content-muted">
        {isOnline ? 'Buscá un producto para comenzar' : 'Modo offline activo'}
      </p>
      <p className="text-xs text-content-subtle text-center max-w-xs">
        {isOnline
          ? 'Escribí el nombre, SKU o escaneá el código de barras del producto'
          : 'Las ventas se guardarán localmente y se sincronizarán al recuperar la conexión'
        }
      </p>
    </div>
  )
})

// ── InsufficientStockModal ────────────────────────────────────────

interface StockDetail { product_id: string; product_name: string; available: number; requested: number }

function InsufficientStockModal({ details, onClose }: { details: StockDetail[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="bg-surface border border-red-500/40 rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
            <AlertTriangle size={20} className="text-red-500" />
          </div>
          <div>
            <h3 className="text-content font-semibold">Stock insuficiente</h3>
            <p className="text-content-muted text-sm mt-0.5">
              Los siguientes productos no tienen suficiente stock:
            </p>
          </div>
        </div>

        <div className="space-y-2 mb-5">
          {details.map(d => (
            <div key={d.product_id} className="bg-surface-2 rounded-lg px-4 py-3">
              <p className="text-sm text-content font-medium">{d.product_name}</p>
              <p className="text-xs text-content-muted mt-0.5">
                Disponible: <span className="text-amber-500">{d.available}</span>
                {' · '}
                Solicitado: <span className="text-red-500">{d.requested}</span>
              </p>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full bg-surface-3 hover:bg-edge text-content font-medium
                     py-2.5 rounded-xl transition-colors text-sm"
        >
          Ajustar cantidades
        </button>
      </div>
    </div>
  )
}
