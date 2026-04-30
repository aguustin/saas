import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { Modal } from '@/shared/components/ui/Modal'
import { Input } from '@/shared/components/ui/Input'
import { Select } from '@/shared/components/ui/Select'
import { useMovementForm } from '@/features/stock/hooks/useMovementForm'
import { useProductStore } from '@/features/products/store/products.store'
import type { StockMovementRow, StockMovementType } from '@/shared/types'

// ── Tipos de movimiento ───────────────────────────────────────────

const TYPE_OPTIONS: Array<{ value: StockMovementType; label: string; hint: string }> = [
  { value: 'purchase',   label: 'Compra',        hint: 'Ingreso por compra a proveedor' },
  { value: 'adjustment', label: 'Ajuste',         hint: 'Corrección manual (positiva o negativa)' },
  { value: 'return',     label: 'Devolución',     hint: 'Devolución de cliente o proveedor' },
  { value: 'transfer',   label: 'Transferencia',  hint: 'Entrada por transferencia de sucursal' },
]

const TYPE_SELECT_OPTIONS = TYPE_OPTIONS.map(o => ({ value: o.value, label: o.label }))

// ── Búsqueda de producto ──────────────────────────────────────────

function ProductSearch({
  value, onChange, error,
}: {
  value:    string
  onChange: (id: string, name: string) => void
  error?:   string
}) {
  const fetchProducts  = useProductStore(s => s.fetch)
  const productItems   = useProductStore(s => s.items)

  const [query,    setQuery]    = useState(value)
  const [open,     setOpen]     = useState(false)
  const [searching,setSearching]= useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapperRef  = useRef<HTMLDivElement>(null)

  function doSearch(q: string) {
    setQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!q.trim()) { setOpen(false); return }
    setSearching(true)
    debounceRef.current = setTimeout(async () => {
      await fetchProducts({ search: q, is_active: true, limit: 8, offset: 0 })
      setSearching(false)
      setOpen(true)
    }, 250)
  }

  function select(id: string, name: string) {
    setQuery(name)
    setOpen(false)
    onChange(id, name)
  }

  function clear() {
    setQuery('')
    setOpen(false)
    onChange('', '')
  }

  // Cerrar al hacer click fuera
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={wrapperRef} className="relative w-full">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        Producto *
      </label>
      <div className={[
        'flex items-center gap-2 w-full rounded-lg border px-3 h-9 transition-colors bg-white',
        'focus-within:ring-2 focus-within:ring-brand-500 focus-within:border-brand-500',
        'dark:bg-gray-800',
        error
          ? 'border-red-400 dark:border-red-500'
          : 'border-gray-300 hover:border-gray-400 dark:border-gray-600 dark:hover:border-gray-500',
      ].join(' ')}>
        <Search size={13} className="text-gray-400 shrink-0" />
        <input
          type="text"
          value={query}
          onChange={e => doSearch(e.target.value)}
          placeholder="Buscar producto…"
          className="flex-1 min-w-0 bg-transparent text-sm text-gray-900 dark:text-gray-100
                     placeholder-gray-400 focus:outline-none"
        />
        {query && (
          <button onClick={clear} className="text-gray-400 hover:text-gray-600 shrink-0">
            <X size={13} />
          </button>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white dark:bg-gray-800
                        rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg
                        max-h-52 overflow-y-auto">
          {searching && (
            <p className="px-3 py-2.5 text-xs text-gray-400">Buscando…</p>
          )}
          {!searching && productItems.length === 0 && (
            <p className="px-3 py-2.5 text-xs text-gray-400">Sin resultados</p>
          )}
          {!searching && productItems.map(p => (
            <button
              key={p.id}
              type="button"
              onMouseDown={() => select(p.id, p.name)}
              className="w-full flex items-center justify-between px-3 py-2.5 text-left
                         hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{p.name}</p>
                {p.sku && <p className="text-xs text-gray-400 font-mono">{p.sku}</p>}
              </div>
              <span className="text-xs font-semibold text-gray-500 tabular-nums ml-3">
                ${p.price.toFixed(2)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Props del modal ───────────────────────────────────────────────

interface Props {
  open:              boolean
  onClose:           () => void
  onSuccess:         (mv: StockMovementRow) => void
  prefillStockId?:   string | null
  prefillProductId?: string | null
  prefillProductName?: string | null
}

// ── Modal ─────────────────────────────────────────────────────────

export function MovementForm({
  open, onClose, onSuccess,
  prefillStockId   = null,
  prefillProductId = null,
  prefillProductName = null,
}: Props) {

  const { fields, errors, submitting, set, setProduct, submit, reset } = useMovementForm(
    prefillStockId, prefillProductId, prefillProductName,
    (mv) => { onSuccess(mv) },
  )

  useEffect(() => {
    if (open) reset(prefillProductId ?? '', prefillProductName ?? '')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const typeHint = TYPE_OPTIONS.find(o => o.value === fields.type)?.hint

  const allowNegative = fields.type === 'adjustment'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await submit()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Registrar movimiento de stock"
      description="El stock se actualizará de forma inmediata."
      size="md"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700
                       border border-gray-300 hover:bg-gray-50 transition-colors
                       disabled:opacity-50
                       dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-800"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="movement-form"
            disabled={submitting}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white
                       bg-brand-600 hover:bg-brand-700 transition-colors disabled:opacity-50
                       flex items-center gap-2"
          >
            {submitting && (
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            Registrar
          </button>
        </>
      }
    >
      <form id="movement-form" onSubmit={handleSubmit} className="space-y-4">

        {/* Producto */}
        <ProductSearch
          value={fields.product_name}
          onChange={setProduct}
          error={errors.product_id}
        />

        {/* Tipo */}
        <div>
          <Select
            label="Tipo de movimiento"
            value={fields.type}
            onChange={e => set('type', e.target.value as StockMovementType)}
            options={TYPE_SELECT_OPTIONS}
          />
          {typeHint && (
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{typeHint}</p>
          )}
        </div>

        {/* Cantidad */}
        <Input
          label={`Cantidad ${allowNegative ? '(puede ser negativa para reducir)' : ''}`}
          type="number"
          step="1"
          value={fields.quantity}
          onChange={e => set('quantity', e.target.value)}
          error={errors.quantity}
          placeholder={allowNegative ? 'Ej: -5 para reducir, +10 para aumentar' : 'Ej: 50'}
        />

        {/* Referencia */}
        <Input
          label="Referencia"
          value={fields.reference_id}
          onChange={e => set('reference_id', e.target.value)}
          placeholder="N° de factura, remito…"
          hint="Opcional"
        />

        {/* Nota */}
        <div className="w-full">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Nota
          </label>
          <textarea
            value={fields.note}
            onChange={e => set('note', e.target.value)}
            rows={2}
            placeholder="Descripción adicional…"
            className="w-full text-sm rounded-lg border border-gray-300 px-3 py-2
                       focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500
                       bg-white dark:bg-gray-800 dark:border-gray-600
                       dark:text-gray-100 dark:placeholder-gray-500 resize-none"
          />
        </div>

        {errors.global && (
          <p className="text-sm text-red-600 dark:text-red-400">{errors.global}</p>
        )}
      </form>
    </Modal>
  )
}
