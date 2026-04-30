import { Package } from 'lucide-react'
import type { ProductResponse } from '@/shared/types'

interface Props {
  product:              ProductResponse
  onSelect:             (product: ProductResponse) => void
  'data-pos-result'?:   string
  'data-highlighted'?:  string
}

const UNIT_LABEL: Record<string, string> = {
  unit: 'un', kg: 'kg', g: 'g', l: 'L', ml: 'ml', m: 'm', cm: 'cm',
}

export function POSProductCard({ product, onSelect, ...attrs }: Props) {
  return (
    <button
      type="button"
      onClick={() => onSelect(product)}
      className="w-full flex items-center gap-3 px-4 py-3 text-left
                 hover:bg-surface-2 transition-colors
                 data-[highlighted=true]:bg-surface-2
                 border-b border-edge last:border-0"
      {...(attrs['data-pos-result'] !== undefined ? { 'data-pos-result': attrs['data-pos-result'] } : {})}
      {...(attrs['data-highlighted'] !== undefined ? { 'data-highlighted': attrs['data-highlighted'] } : {})}
    >
      {/* Imagen / icono */}
      <div className="w-10 h-10 rounded-lg bg-surface-2 flex items-center justify-center shrink-0 overflow-hidden">
        {product.image_url
          ? <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
          : <Package size={18} className="text-content-muted" />
        }
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-content truncate">{product.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {product.sku && <span className="text-xs text-content-subtle">{product.sku}</span>}
          {product.barcode && <span className="text-xs text-content-subtle">{product.barcode}</span>}
        </div>
      </div>

      {/* Precio */}
      <div className="text-right shrink-0">
        <p className="text-sm font-semibold text-content">${product.price.toFixed(2)}</p>
        <p className="text-xs text-content-subtle">{UNIT_LABEL[product.unit] ?? product.unit}</p>
      </div>
    </button>
  )
}
