import { History } from 'lucide-react'
import { Badge } from '@/shared/components/ui/Badge'
import { Skeleton } from '@/shared/components/ui/Skeleton'
import { formatDate } from '@/shared/utils/date'
import type { BillingEventDto } from '@/shared/types'

// ── Formato de tipo de evento ─────────────────────────────────────

const EVENT_LABELS: Record<string, string> = {
  payment_succeeded:      'Pago exitoso',
  payment_failed:         'Pago fallido',
  subscription_created:   'Suscripción creada',
  subscription_updated:   'Suscripción actualizada',
  subscription_cancelled: 'Suscripción cancelada',
  subscription_renewed:   'Renovación automática',
  trial_started:          'Período de prueba',
  trial_ended:            'Prueba finalizada',
  refund_issued:          'Reembolso emitido',
}

function formatEventType(type: string): string {
  return EVENT_LABELS[type] ?? type.replace(/_/g, ' ')
}

// ── Status badge ──────────────────────────────────────────────────

function EventStatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-gray-400 text-xs">—</span>

  const variant =
    status === 'succeeded' || status === 'paid' || status === 'applied' ? 'success' :
    status === 'failed'    || status === 'error'                         ? 'danger'  :
    status === 'pending'                                                  ? 'warning' :
    'gray'

  return <Badge variant={variant} size="sm">{status}</Badge>
}

// ── Proveedor chip ────────────────────────────────────────────────

const PROVIDER_STYLE: Record<string, string> = {
  stripe:      'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30',
  mercadopago: 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/30',
  manual:      'text-gray-500 bg-gray-100 dark:bg-gray-800',
}

function ProviderChip({ provider }: { provider: string }) {
  const style = PROVIDER_STYLE[provider] ?? PROVIDER_STYLE.manual
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${style}`}>
      {provider === 'mercadopago' ? 'Mercado Pago' : provider.charAt(0).toUpperCase() + provider.slice(1)}
    </span>
  )
}

// ── Skeleton row ──────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 5 }).map((_, i) => (
        <td key={i} className="px-5 py-3">
          <Skeleton height={13} width={i === 0 ? '60%' : '40%'} />
        </td>
      ))}
    </tr>
  )
}

// ── Props ─────────────────────────────────────────────────────────

interface Props {
  events:  BillingEventDto[]
  loading: boolean
}

// ── Componente ────────────────────────────────────────────────────

export function BillingEventsTable({ events, loading }: Props) {
  return (
    <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">

      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          Historial de facturación
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/50
                           border-b border-gray-100 dark:border-gray-800">
              <th className="px-5 py-3 text-left font-medium">Evento</th>
              <th className="px-5 py-3 text-left font-medium">Proveedor</th>
              <th className="px-5 py-3 text-right font-medium">Monto</th>
              <th className="px-5 py-3 text-left font-medium">Estado</th>
              <th className="px-5 py-3 text-left font-medium">Fecha</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">

            {loading && events.length === 0 && (
              Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
            )}

            {!loading && events.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-14 text-center">
                  <History size={32} className="mx-auto text-gray-200 dark:text-gray-700 mb-2" strokeWidth={1} />
                  <p className="text-sm text-gray-400">Sin eventos de facturación</p>
                </td>
              </tr>
            )}

            {events.map(ev => (
              <tr
                key={ev.id}
                className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
              >
                <td className="px-5 py-3 font-medium text-gray-800 dark:text-gray-200">
                  {formatEventType(ev.event_type)}
                </td>
                <td className="px-5 py-3">
                  <ProviderChip provider={ev.provider} />
                </td>
                <td className="px-5 py-3 text-right tabular-nums font-medium text-gray-700 dark:text-gray-300">
                  {ev.amount != null && ev.currency
                    ? `${ev.currency.toUpperCase()} ${ev.amount.toFixed(2)}`
                    : '—'}
                </td>
                <td className="px-5 py-3">
                  <EventStatusBadge status={ev.status} />
                </td>
                <td className="px-5 py-3 text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                  {formatDate(ev.processed_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
