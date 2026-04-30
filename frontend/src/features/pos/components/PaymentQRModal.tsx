import { useEffect, useRef, useState } from 'react'
import QRCode from 'react-qr-code'
import { X, CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react'
import { salesApi } from '@/features/sales/api/sales.api'
import type { MpQRResponse } from '../api/payments.api'
import type { SaleResponse } from '@/shared/types'

interface Props {
  qrData:      MpQRResponse
  onApproved:  (sale: SaleResponse) => void
  onCancel:    () => void
}

type PollStatus = 'waiting' | 'approved' | 'cancelled' | 'timeout'

const POLL_INTERVAL_MS = 3_000
const TIMEOUT_MS       = 10 * 60 * 1_000   // 10 min

export function PaymentQRModal({ qrData, onApproved, onCancel }: Props) {
  const [pollStatus,   setPollStatus]   = useState<PollStatus>('waiting')
  const [elapsed,      setElapsed]      = useState(0)     // seconds
  const [approvedSale, setApprovedSale] = useState<SaleResponse | null>(null)

  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout>  | null>(null)
  const tickRef    = useRef<ReturnType<typeof setInterval> | null>(null)

  const stop = () => {
    if (pollRef.current)    clearInterval(pollRef.current)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    if (tickRef.current)    clearInterval(tickRef.current)
  }

  useEffect(() => {
    // Reloj de tiempo transcurrido
    tickRef.current = setInterval(() => setElapsed(s => s + 1), 1_000)

    // Polling del estado de la venta
    pollRef.current = setInterval(async () => {
      try {
        const sale = await salesApi.byId(qrData.sale_id)
        if (sale.status === 'completed') {
          stop()
          setApprovedSale(sale)
          setPollStatus('approved')
        } else if (sale.status === 'cancelled') {
          stop()
          setPollStatus('cancelled')
        }
      } catch {
        // ignorar errores transitorios de red
      }
    }, POLL_INTERVAL_MS)

    // Timeout global
    timeoutRef.current = setTimeout(() => {
      stop()
      setPollStatus('timeout')
    }, TIMEOUT_MS)

    return stop
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrData.sale_id])

  // Auto-avanzar al ticket tras mostrar el check 1.2s
  useEffect(() => {
    if (pollStatus === 'approved' && approvedSale) {
      const t = setTimeout(() => onApproved(approvedSale), 1_200)
      return () => clearTimeout(t)
    }
  }, [pollStatus, approvedSale, onApproved])

  const minutes = String(Math.floor((TIMEOUT_MS / 1_000 - elapsed) / 60)).padStart(2, '0')
  const seconds = String((TIMEOUT_MS / 1_000 - elapsed) % 60).padStart(2, '0')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm px-4">
      <div className="bg-surface border border-edge rounded-2xl shadow-2xl w-full max-w-sm">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-edge">
          <div>
            <h2 className="text-content font-semibold">Pago con Mercado Pago</h2>
            <p className="text-content-muted text-sm">
              Total: <span className="text-content font-bold">${qrData.amount.toFixed(2)}</span>
            </p>
          </div>
          {pollStatus === 'waiting' && (
            <button
              type="button"
              onClick={onCancel}
              className="text-content-subtle hover:text-content transition-colors"
              title="Cancelar pago"
            >
              <X size={20} />
            </button>
          )}
        </div>

        <div className="px-6 py-6 flex flex-col items-center gap-5">

          {pollStatus === 'waiting' && (
            <>
              {/* QR */}
              <div className="bg-white p-3 rounded-xl shadow-inner">
                <QRCode
                  value={qrData.qr_data}
                  size={200}
                  level="M"
                />
              </div>

              <div className="text-center space-y-1">
                <p className="text-sm text-content font-medium flex items-center gap-2 justify-center">
                  <Loader2 size={14} className="animate-spin text-brand-500" />
                  Esperando pago…
                </p>
                <p className="text-xs text-content-muted">
                  Abrí Mercado Pago y escaneá el código
                </p>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-content-subtle">
                <Clock size={12} />
                <span>Expira en {minutes}:{seconds}</span>
              </div>

              <button
                type="button"
                onClick={onCancel}
                className="w-full text-sm text-content-muted hover:text-red-500
                           border border-edge hover:border-red-500/40
                           rounded-xl py-2.5 transition-colors"
              >
                Cancelar y volver
              </button>
            </>
          )}

          {pollStatus === 'approved' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle2 size={56} className="text-green-500" />
              <p className="text-content font-semibold text-lg">¡Pago recibido!</p>
              <p className="text-content-muted text-sm">Generando ticket…</p>
            </div>
          )}

          {(pollStatus === 'cancelled' || pollStatus === 'timeout') && (
            <div className="flex flex-col items-center gap-4 py-4">
              <XCircle size={56} className="text-red-500" />
              <div className="text-center">
                <p className="text-content font-semibold">
                  {pollStatus === 'timeout' ? 'Pago expirado' : 'Pago cancelado'}
                </p>
                <p className="text-content-muted text-sm mt-1">
                  {pollStatus === 'timeout'
                    ? 'El QR venció sin recibir pago.'
                    : 'El pago fue rechazado o cancelado.'}
                </p>
              </div>
              <button
                type="button"
                onClick={onCancel}
                className="w-full bg-surface-3 hover:bg-edge text-content font-medium
                           py-2.5 rounded-xl transition-colors text-sm"
              >
                Volver al cobro
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
