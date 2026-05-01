import type { SaleResponse, StockMovementRow, StockMovementType } from '@/shared/types'

// ── Helpers ───────────────────────────────────────────────────────

const METHOD_LABEL: Record<string, string> = {
  cash:     'Efectivo',
  card:     'Tarjeta',
  transfer: 'Transferencia',
  mp:       'Mercado Pago',
  mixed:    'Mixto',
}

const STATUS_LABEL: Record<string, string> = {
  completed: 'Completada',
  pending:   'Pendiente',
  cancelled: 'Cancelada',
  refunded:  'Reembolsada',
}

/**
 * Escapa una celda CSV según RFC 4180:
 * - Si contiene coma, comilla o salto de línea → envuelve en comillas
 * - Las comillas internas se duplican
 */
function cell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const s = String(value)
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s
}

function localDatetime(iso: string): string {
  return new Intl.DateTimeFormat('es', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))
}

function paymentDetail(sale: SaleResponse): string {
  const d = sale.payment_details
  switch (sale.payment_method) {
    case 'card': {
      const parts = []
      if (d.card_last4)   parts.push(`•••• ${d.card_last4}`)
      if (d.installments && d.installments > 1) parts.push(`${d.installments} cuotas`)
      return parts.join(' ')
    }
    case 'cash':
      return d.cash_received != null ? `Recibido $${d.cash_received.toFixed(2)}` : ''
    case 'transfer':
      return d.transfer_ref ? `Ref: ${d.transfer_ref}` : ''
    case 'mp':
      return d.mp_payment_id ? `ID: ${d.mp_payment_id}` : ''
    case 'mixed':
      return (d.mixed_breakdown ?? [])
        .map(b => `${METHOD_LABEL[b.method] ?? b.method} $${b.amount.toFixed(2)}`)
        .join(' + ')
    default:
      return ''
  }
}

function productsSummary(sale: SaleResponse): string {
  return sale.items
    .map(i => `${i.product_name} x${i.quantity} @ $${i.unit_price.toFixed(2)}`)
    .join(' | ')
}

// ── CSV builder ───────────────────────────────────────────────────

const HEADERS = [
  'n_venta',
  'fecha',
  'estado',
  'metodo_pago',
  'detalle_pago',
  'subtotal',
  'descuento',
  'impuesto',
  'total',
  'productos',
  'notas',
]

function buildRows(sales: SaleResponse[]): string[][] {
  return sales.map(s => [
    `#${s.id.slice(-8).toUpperCase()}`,
    localDatetime(s.created_at),
    STATUS_LABEL[s.status]  ?? s.status,
    METHOD_LABEL[s.payment_method] ?? s.payment_method,
    paymentDetail(s),
    s.subtotal.toFixed(2),
    s.discount.toFixed(2),
    s.tax.toFixed(2),
    s.total.toFixed(2),
    productsSummary(s),
    s.notes ?? '',
  ])
}

// ── Shared download trigger ───────────────────────────────────────

function triggerDownload(csv: string, filename: string): void {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── Movements CSV ─────────────────────────────────────────────────

const MOVEMENT_TYPE_LABEL: Record<StockMovementType, string> = {
  purchase:   'Compra',
  adjustment: 'Ajuste',
  transfer:   'Transferencia',
  return:     'Devolución',
}

const MOVEMENT_HEADERS = [
  'id',
  'fecha',
  'sucursal',
  'producto',
  'tipo',
  'cantidad',
  'referencia',
  'nota',
  'usuario',
]

function buildMovementRows(rows: StockMovementRow[]): string[][] {
  return rows.map(mv => [
    `#${mv.id.slice(-8).toUpperCase()}`,
    localDatetime(mv.created_at),
    mv.branch_name,
    mv.product_name,
    MOVEMENT_TYPE_LABEL[mv.type] ?? mv.type,
    mv.quantity > 0 ? `+${mv.quantity}` : String(mv.quantity),
    mv.reference_id ? `#${mv.reference_id.slice(-8).toUpperCase()}` : '',
    mv.note ?? '',
    mv.created_by ? `#${mv.created_by.slice(-8).toUpperCase()}` : '',
  ])
}

export function exportMovementsToCsv(
  movements: StockMovementRow[],
  filename = 'movimientos.csv',
): void {
  if (movements.length === 0) return
  const rows = [MOVEMENT_HEADERS, ...buildMovementRows(movements)]
  triggerDownload(rows.map(r => r.map(cell).join(',')).join('\r\n'), filename)
}

// ── Public API ────────────────────────────────────────────────────

export function exportSalesToCsv(sales: SaleResponse[], filename = 'ventas.csv'): void {
  if (sales.length === 0) return

  const rows = [HEADERS, ...buildRows(sales)]
  triggerDownload(rows.map(r => r.map(cell).join(',')).join('\r\n'), filename)
}
