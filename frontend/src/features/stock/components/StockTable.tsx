import { memo, useRef, useState } from 'react'
import { PackageOpen, Plus, Pencil, Check, X } from 'lucide-react'
import { Skeleton } from '@/shared/components/ui/Skeleton'
import { Pagination } from '@/shared/components/ui/Table'
import { formatDate } from '@/shared/utils/date'
import { useStockStore } from '@/features/stock/store/stock.store'
import { useToastStore } from '@/shared/components/ui/Toast'
import type { StockRow } from '@/shared/types'

// ── Indicador de nivel de stock ───────────────────────────────────

const StockLevel = memo(function StockLevel({ quantity, min }: { quantity: number; min: number }) {
  const pct    = min > 0 ? Math.min(100, (quantity / min) * 100) : 100
  const isLow  = quantity <= min
  const barColor =
    quantity === 0 ? 'bg-red-500' :
    isLow          ? 'bg-amber-500' :
    pct >= 200     ? 'bg-green-500' :
    'bg-brand-500'

  return (
    <div className="flex items-center gap-2">
      <span className={[
        'text-sm font-semibold tabular-nums',
        quantity === 0 ? 'text-red-600 dark:text-red-400'   :
        isLow          ? 'text-amber-600 dark:text-amber-400':
        'text-gray-900 dark:text-gray-100',
      ].join(' ')}>
        {quantity}
      </span>
      {min > 0 && (
        <div className="w-16 h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
          <div
            className={`h-full rounded-full ${barColor} transition-all`}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
      )}
    </div>
  )
})

// ── Inline edit del mínimo ────────────────────────────────────────

function MinQtyCell({ row }: { row: StockRow }) {
  const updateMinQty = useStockStore(s => s.updateMinQty)
  const addToast     = useToastStore(s => s.add)
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(String(row.min_quantity))
  const inputRef  = useRef<HTMLInputElement>(null)

  function startEdit() {
    setDraft(String(row.min_quantity))
    setEditing(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  async function save() {
    const val = Number(draft)
    if (isNaN(val) || val < 0) {
      addToast({ type: 'error', title: 'Cantidad inválida' })
      setEditing(false)
      return
    }
    if (val === row.min_quantity) { setEditing(false); return }
    try {
      await updateMinQty(row.stock_id, val)
    } catch {
      addToast({ type: 'error', title: 'No se pudo actualizar el mínimo' })
    }
    setEditing(false)
  }

  function cancel() {
    setEditing(false)
    setDraft(String(row.min_quantity))
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          type="number"
          min="0"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') void save(); if (e.key === 'Escape') cancel() }}
          className="w-16 h-7 px-2 text-sm rounded-lg border border-brand-400
                     focus:outline-none focus:ring-1 focus:ring-brand-500
                     bg-white dark:bg-gray-800 dark:text-gray-100"
        />
        <button onClick={() => void save()}    className="p-1 text-green-600 hover:bg-green-50 rounded"><Check size={13} /></button>
        <button onClick={cancel}               className="p-1 text-gray-400 hover:bg-gray-100 rounded"><X     size={13} /></button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5 group/min">
      <span className="text-sm text-gray-600 dark:text-gray-400 tabular-nums">
        {row.min_quantity}
      </span>
      <button
        onClick={startEdit}
        className="opacity-0 group-hover/min:opacity-100 transition-opacity p-0.5 rounded
                   text-gray-400 hover:text-brand-600"
      >
        <Pencil size={11} />
      </button>
    </div>
  )
}

// ── Fila skeleton ─────────────────────────────────────────────────

function SkeletonRowEl() {
  return (
    <tr>
      {Array.from({ length: 7 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton height={14} width={i === 0 ? '70%' : '50%'} />
        </td>
      ))}
    </tr>
  )
}

// ── StockRow ──────────────────────────────────────────────────────

interface RowProps {
  row:        StockRow
  onMovement: (row: StockRow) => void
}

const StockRow = memo(function StockRow({ row, onMovement }: RowProps) {
  return (
    <tr
      className={[
        'hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors group',
        row.is_low ? 'bg-red-50/30 dark:bg-red-950/10' : '',
      ].join(' ')}
    >
      {/* Producto */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {row.is_low && (
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
          )}
          <span className="font-medium text-gray-900 dark:text-gray-100">
            {row.product_name}
          </span>
        </div>
      </td>

      {/* SKU */}
      <td className="px-4 py-3 text-xs text-gray-400 dark:text-gray-500 font-mono">
        {row.product_sku ?? '—'}
      </td>

      {/* Sucursal */}
      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
        {row.branch_name}
      </td>

      {/* Cantidad */}
      <td className="px-4 py-3">
        <StockLevel quantity={row.quantity} min={row.min_quantity} />
      </td>

      {/* Mínimo (editable inline) */}
      <td className="px-4 py-3">
        <MinQtyCell row={row} />
      </td>

      {/* Actualizado */}
      <td className="px-4 py-3 text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
        {formatDate(row.updated_at)}
      </td>

      {/* Acción */}
      <td className="px-4 py-3 text-right">
        <button
          onClick={() => onMovement(row)}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium
                     text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-800
                     hover:bg-brand-50 dark:hover:bg-brand-950/30 transition-colors
                     opacity-0 group-hover:opacity-100"
        >
          <Plus size={11} />
          Movimiento
        </button>
      </td>
    </tr>
  )
})

// ── Props ─────────────────────────────────────────────────────────

interface Props {
  items:          StockRow[]
  loading:        boolean
  total:          number
  limit:          number
  offset:         number
  onOffsetChange: (o: number) => void
  onMovement:     (row: StockRow) => void
}

// ── Tabla ─────────────────────────────────────────────────────────

export function StockTable({
  items, loading, total, limit, offset, onOffsetChange, onMovement,
}: Props) {
  return (
    <div className="rounded-2xl border border-gray-100 dark:border-gray-800
                    bg-white dark:bg-gray-900 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/50
                           border-b border-gray-100 dark:border-gray-800">
              <th className="px-4 py-3 text-left font-medium">Producto</th>
              <th className="px-4 py-3 text-left font-medium">SKU</th>
              <th className="px-4 py-3 text-left font-medium">Sucursal</th>
              <th className="px-4 py-3 text-left font-medium">Cantidad</th>
              <th className="px-4 py-3 text-left font-medium">Mínimo</th>
              <th className="px-4 py-3 text-left font-medium">Actualizado</th>
              <th className="px-4 py-3 text-right font-medium">Movimiento</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">

            {loading && items.length === 0 && (
              Array.from({ length: 8 }).map((_, i) => <SkeletonRowEl key={i} />)
            )}

            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-14 text-center">
                  <PackageOpen size={36} className="mx-auto text-gray-200 dark:text-gray-700 mb-2" strokeWidth={1} />
                  <p className="text-sm text-gray-400">Sin productos en stock</p>
                </td>
              </tr>
            )}

            {items.map(row => (
              <StockRow
                key={row.stock_id}
                row={row}
                onMovement={onMovement}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {total > limit && (
        <div className="px-4 pb-3 border-t border-gray-100 dark:border-gray-800">
          <Pagination
            total={total}
            limit={limit}
            offset={offset}
            onChange={onOffsetChange}
          />
        </div>
      )}
    </div>
  )
}
