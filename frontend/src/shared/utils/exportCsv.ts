import * as XLSX from 'xlsx'
import type { SaleResponse, StockMovementRow, StockMovementType } from '@/shared/types'

type CellValue = string | number

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
      if (d.card_last4)                     parts.push(`•••• ${d.card_last4}`)
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

// ── Shared XLSX download ──────────────────────────────────────────

function triggerDownload(rows: CellValue[][], filename: string): void {
  const ws = XLSX.utils.aoa_to_sheet(rows)

  // Ancho de columna automático basado en el contenido más largo
  ws['!cols'] = rows[0].map((_, colIdx) => ({
    wch: Math.min(60, Math.max(
      8,
      ...rows.map(row => String(row[colIdx] ?? '').length),
    )) + 1,
  }))

  const wb  = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Datos')

  const buf  = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href     = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── Sales XLSX ────────────────────────────────────────────────────

const SALES_HEADERS: CellValue[] = [
  'N° Venta', 'Fecha', 'Estado', 'Método de pago', 'Detalle pago',
  'Subtotal', 'Descuento', 'Impuesto', 'Total', 'Productos', 'Notas',
]

function buildSalesRows(sales: SaleResponse[]): CellValue[][] {
  return sales.map(s => [
    `#${s.id.slice(-8).toUpperCase()}`,
    localDatetime(s.created_at),
    STATUS_LABEL[s.status]  ?? s.status,
    METHOD_LABEL[s.payment_method] ?? s.payment_method,
    paymentDetail(s),
    s.subtotal,
    s.discount,
    s.tax,
    s.total,
    productsSummary(s),
    s.notes ?? '',
  ])
}

export function exportSalesToCsv(sales: SaleResponse[], filename = 'ventas.xlsx'): void {
  if (sales.length === 0) return
  triggerDownload([SALES_HEADERS, ...buildSalesRows(sales)], filename)
}

// ── Movements XLSX ────────────────────────────────────────────────

const MOVEMENT_TYPE_LABEL: Record<StockMovementType, string> = {
  purchase:   'Compra',
  adjustment: 'Ajuste',
  transfer:   'Transferencia',
  return:     'Devolución',
}

const MOVEMENTS_HEADERS: CellValue[] = [
  'ID', 'Fecha', 'Sucursal', 'Producto', 'Tipo',
  'Cantidad', 'Referencia', 'Nota', 'Usuario',
]

function buildMovementRows(rows: StockMovementRow[]): CellValue[][] {
  return rows.map(mv => [
    `#${mv.id.slice(-8).toUpperCase()}`,
    localDatetime(mv.created_at),
    mv.branch_name,
    mv.product_name,
    MOVEMENT_TYPE_LABEL[mv.type] ?? mv.type,
    mv.quantity,
    mv.reference_id ? `#${mv.reference_id.slice(-8).toUpperCase()}` : '',
    mv.note ?? '',
    mv.created_by ? `#${mv.created_by.slice(-8).toUpperCase()}` : '',
  ])
}

export function exportMovementsToCsv(
  movements: StockMovementRow[],
  filename = 'movimientos.xlsx',
): void {
  if (movements.length === 0) return
  triggerDownload([MOVEMENTS_HEADERS, ...buildMovementRows(movements)], filename)
}
