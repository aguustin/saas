import { memo } from 'react'
import { Package, Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import { useProductStore } from '@/features/products/store/products.store'
import type { ProductResponse } from '@/shared/types'

// ── Tipos ─────────────────────────────────────────────────────────

interface Props {
  items:           ProductResponse[]
  total:           number
  page:            number
  pageCount:       number
  pageSize:        number
  loading:         boolean
  selected:        Set<string>
  onToggleSelect:  (id: string) => void
  onToggleAll:     () => void
  onEdit:          (product: ProductResponse) => void
  onDelete:        (product: ProductResponse) => void
  onPageChange:    (page: number) => void
}

const UNIT_LABEL: Record<string, string> = {
  unit: 'Unidad', kg: 'kg', g: 'g', l: 'Litro', ml: 'ml', m: 'm', cm: 'cm',
}

// ── Tabla ─────────────────────────────────────────────────────────

export function ProductTable({
  items,
  total,
  page,
  pageCount,
  pageSize,
  loading,
  selected,
  onToggleSelect,
  onToggleAll,
  onEdit,
  onDelete,
  onPageChange,
}: Props) {
  const toggleActive = useProductStore(s => s.toggleActive)
  const allSelected  = items.length > 0 && selected.size === items.length
  const anySelected  = selected.size > 0

  const from = (page - 1) * pageSize + 1
  const to   = Math.min(page * pageSize, total)

  return (
    <div className="flex flex-col gap-3">

      {/* Tabla */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <th className="w-10 px-3 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={el => { if (el) el.indeterminate = anySelected && !allSelected }}
                    onChange={onToggleAll}
                    className="rounded border-gray-300 dark:border-gray-600 text-brand-600
                               focus:ring-brand-500 focus:ring-offset-0"
                  />
                </th>
                <th className="px-3 py-3 text-left font-medium text-gray-500 dark:text-gray-400 w-10" />
                <th className="px-3 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Producto</th>
                <th className="px-3 py-3 text-left font-medium text-gray-500 dark:text-gray-400">SKU / Barcode</th>
                <th className="px-3 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Precio</th>
                <th className="px-3 py-3 text-center font-medium text-gray-500 dark:text-gray-400">Unidad</th>
                <th className="px-3 py-3 text-center font-medium text-gray-500 dark:text-gray-400">Estado</th>
                <th className="px-3 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Acciones</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading && items.length === 0 && (
                Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
              )}

              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-gray-400">
                    <Package size={40} className="mx-auto mb-3 opacity-30" strokeWidth={1} />
                    <p className="text-sm">No se encontraron productos</p>
                  </td>
                </tr>
              )}

              {items.map(product => (
                <ProductRow
                  key={product.id}
                  product={product}
                  isSelected={selected.has(product.id)}
                  onToggleSelect={onToggleSelect}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onToggleActive={toggleActive}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Paginación */}
      {total > 0 && (
        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
          <span>
            Mostrando {from}–{to} de {total} productos
          </span>

          <div className="flex items-center gap-1">
            <PaginationButton
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
              aria-label="Página anterior"
            >
              <ChevronLeft size={15} />
            </PaginationButton>

            {buildPageRange(page, pageCount).map((p, i) =>
              p === '…' ? (
                <span key={`ellipsis-${i}`} className="px-2 select-none">…</span>
              ) : (
                <PaginationButton
                  key={p}
                  active={p === page}
                  onClick={() => onPageChange(p as number)}
                >
                  {p}
                </PaginationButton>
              ),
            )}

            <PaginationButton
              onClick={() => onPageChange(page + 1)}
              disabled={page === pageCount}
              aria-label="Página siguiente"
            >
              <ChevronRight size={15} />
            </PaginationButton>
          </div>
        </div>
      )}
    </div>
  )
}

// ── ProductRow ────────────────────────────────────────────────────

interface RowProps {
  product:        ProductResponse
  isSelected:     boolean
  onToggleSelect: (id: string) => void
  onEdit:         (product: ProductResponse) => void
  onDelete:       (product: ProductResponse) => void
  onToggleActive: (id: string, active: boolean) => Promise<void>
}

export const ProductRow = memo(function ProductRow({
  product, isSelected, onToggleSelect, onEdit, onDelete, onToggleActive,
}: RowProps) {
  return (
    <tr
      className={[
        'group transition-colors',
        isSelected
          ? 'bg-brand-50 dark:bg-brand-950/20'
          : 'hover:bg-gray-50 dark:hover:bg-gray-800/50',
      ].join(' ')}
    >
      {/* Checkbox */}
      <td className="px-3 py-2.5">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(product.id)}
          className="rounded border-gray-300 dark:border-gray-600 text-brand-600
                     focus:ring-brand-500 focus:ring-offset-0"
        />
      </td>

      {/* Imagen */}
      <td className="px-3 py-2.5">
        <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800
                        flex items-center justify-center overflow-hidden shrink-0">
          {product.image_url
            ? <img src={product.image_url} alt={product.name}
                   className="w-full h-full object-cover" />
            : <Package size={14} className="text-gray-400" />
          }
        </div>
      </td>

      {/* Nombre + descripción */}
      <td className="px-3 py-2.5 max-w-xs">
        <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
          {product.name}
        </p>
        {product.description && (
          <p className="text-xs text-gray-400 truncate mt-0.5">{product.description}</p>
        )}
      </td>

      {/* SKU / Barcode */}
      <td className="px-3 py-2.5">
        <div className="space-y-0.5">
          {product.sku && (
            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
              {product.sku}
            </p>
          )}
          {product.barcode && (
            <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">
              {product.barcode}
            </p>
          )}
          {!product.sku && !product.barcode && (
            <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
          )}
        </div>
      </td>

      {/* Precio */}
      <td className="px-3 py-2.5 text-right">
        <span className="font-semibold text-gray-900 dark:text-gray-100">
          ${product.price.toFixed(2)}
        </span>
        {product.cost != null && (
          <p className="text-xs text-gray-400">costo: ${product.cost.toFixed(2)}</p>
        )}
      </td>

      {/* Unidad */}
      <td className="px-3 py-2.5 text-center">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {UNIT_LABEL[product.unit] ?? product.unit}
        </span>
      </td>

      {/* Toggle activo */}
      <td className="px-3 py-2.5 text-center">
        <button
          type="button"
          onClick={() => void onToggleActive(product.id, !product.is_active)}
          className="relative inline-flex items-center"
          aria-label={product.is_active ? 'Desactivar' : 'Activar'}
        >
          <Toggle active={product.is_active} />
        </button>
      </td>

      {/* Acciones */}
      <td className="px-3 py-2.5">
        <div className="flex items-center justify-end gap-1
                        opacity-0 group-hover:opacity-100 transition-opacity">
          <ActionButton onClick={() => onEdit(product)} label="Editar" title="Editar">
            <Pencil size={13} />
          </ActionButton>
          <ActionButton onClick={() => onDelete(product)} label="Eliminar" danger title="Eliminar">
            <Trash2 size={13} />
          </ActionButton>
        </div>
      </td>
    </tr>
  )
})

// ── Toggle switch ─────────────────────────────────────────────────

const Toggle = memo(function Toggle({ active }: { active: boolean }) {
  return (
    <span className={[
      'w-8 h-4 rounded-full flex items-center transition-colors px-0.5',
      active ? 'bg-brand-500' : 'bg-gray-300 dark:bg-gray-600',
    ].join(' ')}>
      <span className={[
        'w-3 h-3 rounded-full bg-white shadow transition-transform',
        active ? 'translate-x-4' : 'translate-x-0',
      ].join(' ')} />
    </span>
  )
})

// ── ActionButton ──────────────────────────────────────────────────

function ActionButton({ children, onClick, label, danger = false, title }: {
  children: React.ReactNode
  onClick:  () => void
  label:    string
  danger?:  boolean
  title?:   string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title ?? label}
      aria-label={label}
      className={[
        'w-7 h-7 rounded-md flex items-center justify-center transition-colors',
        danger
          ? 'text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30'
          : 'text-gray-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/30',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

// ── SkeletonRow ───────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {[10, 10, 200, 100, 60, 50, 50, 60].map((w, i) => (
        <td key={i} className="px-3 py-3">
          <div className={`h-4 bg-gray-100 dark:bg-gray-800 rounded w-${w === 200 ? 'full' : w}`} />
        </td>
      ))}
    </tr>
  )
}

// ── PaginationButton ──────────────────────────────────────────────

function PaginationButton({
  children, onClick, disabled = false, active = false,
  ...rest
}: {
  children:  React.ReactNode
  onClick:   () => void
  disabled?: boolean
  active?:   boolean
  [k: string]: unknown
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'min-w-[28px] h-7 px-1.5 rounded-md text-xs font-medium transition-colors',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        active
          ? 'bg-brand-600 text-white'
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700',
      ].join(' ')}
      {...rest}
    >
      {children}
    </button>
  )
}

// ── Rango de páginas ──────────────────────────────────────────────

function buildPageRange(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const pages: (number | '…')[] = [1]

  if (current > 3)             pages.push('…')
  if (current > 2)             pages.push(current - 1)
  if (current > 1 && current < total) pages.push(current)
  if (current < total - 1)    pages.push(current + 1)
  if (current < total - 2)    pages.push('…')

  pages.push(total)
  return [...new Set(pages)]
}
