import { Modal } from '@/shared/components/ui/Modal'
import { Button } from '@/shared/components/ui/Button'
import { Input } from '@/shared/components/ui/Input'
import { Select } from '@/shared/components/ui/Select'
import { useProductForm } from '@/features/products/hooks/useProductForm'
import type { ProductResponse, ProductUnit } from '@/shared/types'

// ── Tipos ─────────────────────────────────────────────────────────

interface Props {
  open:       boolean
  onClose:    () => void
  onSuccess:  (product: ProductResponse) => void
  product?:   ProductResponse    // presente → modo edición
}

// ── Opciones de selects ───────────────────────────────────────────

const UNIT_OPTIONS: { value: ProductUnit; label: string }[] = [
  { value: 'unit', label: 'Unidad'  },
  { value: 'kg',   label: 'kg'      },
  { value: 'g',    label: 'g'       },
  { value: 'l',    label: 'Litro'   },
  { value: 'ml',   label: 'ml'      },
  { value: 'm',    label: 'Metro'   },
  { value: 'cm',   label: 'cm'      },
]

// ── Componente ────────────────────────────────────────────────────

export function ProductForm({ open, onClose, onSuccess, product }: Props) {
  const {
    fields,
    setField,
    fieldErrors,
    globalError,
    mutating,
    submit,
    reset,
    isEdit,
  } = useProductForm({
    product,
    onSuccess: (p) => {
      onSuccess(p)
      reset()
    },
  })

  function handleClose() {
    if (!mutating) {
      reset()
      onClose()
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={isEdit ? 'Editar producto' : 'Nuevo producto'}
      description={isEdit ? `Editando "${product?.name}"` : 'Completá los datos del nuevo producto.'}
      size="lg"
      closable={!mutating}
      footer={
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClose}
            disabled={mutating}
          >
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="sm"
            loading={mutating}
            onClick={e => void submit(e as unknown as React.FormEvent)}
          >
            {isEdit ? 'Guardar cambios' : 'Crear producto'}
          </Button>
        </>
      }
    >
      <form
        id="product-form"
        onSubmit={submit}
        className="space-y-4 py-1"
        noValidate
      >

        {/* Nombre */}
        <Input
          label="Nombre *"
          value={fields.name}
          onChange={e => setField('name', e.target.value)}
          error={fieldErrors.name}
          placeholder="Ej: Leche entera 1L"
          autoFocus
        />

        {/* Descripción */}
        <div className="w-full">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Descripción
          </label>
          <textarea
            value={fields.description}
            onChange={e => setField('description', e.target.value)}
            placeholder="Descripción opcional del producto"
            rows={2}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2
                       text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                       placeholder-gray-400 dark:placeholder-gray-500
                       focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500
                       transition-colors resize-none"
          />
        </div>

        {/* SKU / Barcode */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="SKU"
            value={fields.sku}
            onChange={e => setField('sku', e.target.value)}
            error={fieldErrors.sku}
            placeholder="ABC-001"
          />
          <Input
            label="Código de barras"
            value={fields.barcode}
            onChange={e => setField('barcode', e.target.value)}
            error={fieldErrors.barcode}
            placeholder="7790000000000"
          />
        </div>

        {/* Precio / Costo / IVA */}
        <div className="grid grid-cols-3 gap-3">
          <Input
            label="Precio *"
            type="number"
            min={0}
            step={0.01}
            value={fields.price}
            onChange={e => setField('price', e.target.value)}
            error={fieldErrors.price}
            placeholder="0.00"
            prefix="$"
          />
          <Input
            label="Costo"
            type="number"
            min={0}
            step={0.01}
            value={fields.cost}
            onChange={e => setField('cost', e.target.value)}
            error={fieldErrors.cost}
            placeholder="0.00"
            prefix="$"
          />
          <Input
            label="IVA %"
            type="number"
            min={0}
            max={100}
            step={0.01}
            value={fields.tax_rate}
            onChange={e => setField('tax_rate', e.target.value)}
            error={fieldErrors.tax_rate}
            placeholder="21"
            suffix="%"
          />
        </div>

        {/* Unidad */}
        <Select
          label="Unidad de medida"
          options={UNIT_OPTIONS}
          value={fields.unit}
          onChange={e => setField('unit', e.target.value as ProductUnit)}
          error={fieldErrors.unit}
        />

        {/* URL de imagen */}
        <Input
          label="URL de imagen"
          type="url"
          value={fields.image_url}
          onChange={e => setField('image_url', e.target.value)}
          error={fieldErrors.image_url}
          placeholder="https://ejemplo.com/imagen.jpg"
        />

        {/* Vista previa de imagen */}
        {fields.image_url && (
          <div className="flex items-center gap-3">
            <img
              src={fields.image_url}
              alt="Preview"
              className="w-16 h-16 rounded-lg object-cover border border-gray-200 dark:border-gray-700"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
            <p className="text-xs text-gray-400">Vista previa de la imagen</p>
          </div>
        )}

        {/* Activo */}
        <div className="flex items-center justify-between py-1">
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Producto activo
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              Los productos inactivos no aparecen en el POS
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={fields.is_active}
            onClick={() => setField('is_active', !fields.is_active)}
            className={[
              'relative w-10 h-5 rounded-full transition-colors focus-visible:ring-2',
              'focus-visible:ring-brand-500 focus-visible:ring-offset-2',
              fields.is_active ? 'bg-brand-500' : 'bg-gray-300 dark:bg-gray-600',
            ].join(' ')}
          >
            <span className={[
              'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow',
              'transition-transform',
              fields.is_active ? 'translate-x-5' : 'translate-x-0',
            ].join(' ')} />
          </button>
        </div>

        {/* Error global */}
        {globalError && (
          <div
            role="alert"
            className="text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/40
                       border border-red-200 dark:border-red-800 rounded-lg px-4 py-3"
          >
            {globalError}
          </div>
        )}
      </form>
    </Modal>
  )
}
