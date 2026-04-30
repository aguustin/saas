import { CheckCircle, CloudOff, Printer, RotateCcw } from 'lucide-react'
import type { POSTicketData } from '../hooks/usePOS'
import type { SaleResponse } from '@/shared/types'

interface Props {
  ticket:   POSTicketData
  onNewSale: () => void
}

const METHOD_LABEL: Record<string, string> = {
  cash:     'Efectivo',
  card:     'Tarjeta',
  transfer: 'Transferencia',
  mp:       'Mercado Pago',
  mixed:    'Mixto',
}

export function POSTicket({ ticket, onNewSale }: Props) {
  const { sale, syncId, isOffline } = ticket

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 px-4 py-8 max-w-sm mx-auto">

      {/* Ícono de estado */}
      <div className={[
        'w-20 h-20 rounded-full flex items-center justify-center',
        isOffline
          ? 'bg-amber-950/50 border-2 border-amber-700'
          : 'bg-green-950/50 border-2 border-green-700',
      ].join(' ')}>
        {isOffline
          ? <CloudOff size={36} className="text-amber-400" />
          : <CheckCircle size={36} className="text-green-400" />
        }
      </div>

      {/* Título */}
      <div className="text-center">
        <h2 className="text-white font-bold text-xl mb-1">
          {isOffline ? 'Venta guardada offline' : 'Venta completada'}
        </h2>
        <p className="text-gray-400 text-sm">
          {isOffline
            ? 'Se sincronizará automáticamente cuando haya conexión.'
            : 'La venta fue procesada correctamente.'
          }
        </p>
      </div>

      {/* Comprobante */}
      <div className="w-full bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-3 text-sm">

        {sale ? <OnlineTicketBody sale={sale} /> : <OfflineTicketBody syncId={syncId} />}

      </div>

      {/* Acciones */}
      <div className="flex gap-3 w-full">
        {sale && (
          <button
            type="button"
            onClick={() => window.print()}
            className="flex-1 flex items-center justify-center gap-2 bg-gray-700
                       hover:bg-gray-600 text-gray-300 font-medium py-2.5 rounded-xl
                       transition-colors text-sm"
          >
            <Printer size={15} />
            Imprimir
          </button>
        )}
        <button
          type="button"
          onClick={onNewSale}
          className="flex-1 flex items-center justify-center gap-2 bg-brand-600
                     hover:bg-brand-700 text-white font-medium py-2.5 rounded-xl
                     transition-colors text-sm"
        >
          <RotateCcw size={15} />
          Nueva venta
        </button>
      </div>
    </div>
  )
}

// ── Cuerpo ticket online ──────────────────────────────────────────

function OnlineTicketBody({ sale }: { sale: SaleResponse }) {
  return (
    <>
      <TicketRow label="N° de venta" value={`#${sale.id.slice(-8).toUpperCase()}`} />
      <TicketRow label="Fecha"       value={new Date(sale.created_at).toLocaleString('es-AR')} />
      <TicketRow label="Método"      value={METHOD_LABEL[sale.payment_method] ?? sale.payment_method} />

      {/* Detalle de ítems */}
      <div className="border-t border-gray-700 pt-3">
        <p className="text-xs text-gray-500 mb-2">Productos</p>
        <div className="space-y-1">
          {sale.items.map(item => (
            <div key={item.id} className="flex items-center justify-between gap-2">
              <span className="text-gray-300 truncate flex-1">{item.quantity}× {item.product_name}</span>
              <span className="text-white shrink-0">${item.subtotal.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-gray-700 pt-3 space-y-1">
        {sale.discount > 0 && (
          <TicketRow label="Descuento" value={`-$${sale.discount.toFixed(2)}`} valueClass="text-green-400" />
        )}
        <TicketRow label="IVA 21%"   value={`$${sale.tax.toFixed(2)}`}   valueClass="text-gray-400" />
        <TicketRow
          label="Total"
          value={`$${sale.total.toFixed(2)}`}
          labelClass="font-bold text-white"
          valueClass="font-bold text-white"
        />
      </div>

      {/* Efectivo / vuelto */}
      {sale.payment_details.cash_received != null && (
        <>
          <TicketRow label="Recibido" value={`$${sale.payment_details.cash_received.toFixed(2)}`} />
          <TicketRow
            label="Vuelto"
            value={`$${(sale.payment_details.change ?? 0).toFixed(2)}`}
            valueClass="text-amber-400 font-bold"
          />
        </>
      )}

      {/* Mixto */}
      {sale.payment_details.mixed_breakdown && (
        <div className="border-t border-gray-700 pt-2">
          <p className="text-xs text-gray-500 mb-1">Desglose mixto</p>
          {sale.payment_details.mixed_breakdown.map(b => (
            <TicketRow
              key={b.method}
              label={METHOD_LABEL[b.method] ?? b.method}
              value={`$${b.amount.toFixed(2)}`}
            />
          ))}
        </div>
      )}
    </>
  )
}

// ── Cuerpo ticket offline ─────────────────────────────────────────

function OfflineTicketBody({ syncId }: { syncId: string | null }) {
  return (
    <>
      <TicketRow label="ID local"  value={syncId?.slice(-8).toUpperCase() ?? '—'} />
      <TicketRow label="Estado"    value="En cola de sincronización" valueClass="text-amber-400" />
      <p className="text-xs text-gray-500 pt-1">
        La venta se procesará en el servidor cuando se recupere la conexión a internet.
      </p>
    </>
  )
}

// ── TicketRow ─────────────────────────────────────────────────────

function TicketRow({ label, value, labelClass = 'text-gray-400', valueClass = 'text-white' }: {
  label:       string
  value:       string
  labelClass?: string
  valueClass?: string
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={`text-sm ${labelClass}`}>{label}</span>
      <span className={`text-sm ${valueClass}`}>{value}</span>
    </div>
  )
}
