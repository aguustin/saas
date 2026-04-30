import { useState } from 'react'
import { useProductStore } from '@/features/products/store/products.store'
import { isApiError, API_CODES, getValidationMap } from '@/shared/api/errors'
import type { ProductResponse, ProductUnit } from '@/shared/types'
import type { CreateProductBody } from '@/features/products/api/products.api'

// ── Tipos ─────────────────────────────────────────────────────────

export interface ProductFormFields {
  name:        string
  description: string
  sku:         string
  barcode:     string
  price:       string      // string para el input; convertido a number al submit
  cost:        string
  tax_rate:    string
  unit:        ProductUnit
  category_id: string
  image_url:   string
  is_active:   boolean
}

type FieldErrors = Partial<Record<keyof ProductFormFields, string>>

const EMPTY: ProductFormFields = {
  name:        '',
  description: '',
  sku:         '',
  barcode:     '',
  price:       '',
  cost:        '',
  tax_rate:    '21',
  unit:        'unit',
  category_id: '',
  image_url:   '',
  is_active:   true,
}

function productToFields(p: ProductResponse): ProductFormFields {
  return {
    name:        p.name,
    description: p.description ?? '',
    sku:         p.sku         ?? '',
    barcode:     p.barcode     ?? '',
    price:       String(p.price),
    cost:        p.cost != null ? String(p.cost) : '',
    // API stores as decimal (0.21); form shows as percentage (21)
    tax_rate:    String(Math.round(p.tax_rate * 10000) / 100),
    unit:        p.unit,
    category_id: p.category_id ?? '',
    image_url:   p.image_url   ?? '',
    is_active:   p.is_active,
  }
}

// ── Validación frontend ───────────────────────────────────────────

function validate(fields: ProductFormFields): FieldErrors {
  const errors: FieldErrors = {}

  if (!fields.name.trim()) {
    errors.name = 'El nombre es obligatorio.'
  }

  const price = parseFloat(fields.price)
  if (!fields.price || isNaN(price) || price < 0) {
    errors.price = 'Ingresá un precio válido (≥ 0).'
  }

  const taxRate = parseFloat(fields.tax_rate)
  if (fields.tax_rate && (isNaN(taxRate) || taxRate < 0 || taxRate > 100)) {
    errors.tax_rate = 'La alícuota debe estar entre 0 y 100.'
  }

  return errors
}

// ── Hook ──────────────────────────────────────────────────────────

interface UseProductFormOptions {
  product?:  ProductResponse          // si está presente → modo edición
  onSuccess: (product: ProductResponse) => void
}

export function useProductForm({ product, onSuccess }: UseProductFormOptions) {
  const create  = useProductStore(s => s.create)
  const update  = useProductStore(s => s.update)
  const mutating = useProductStore(s => s.mutating)

  const [fields,      setFields]      = useState<ProductFormFields>(
    product ? productToFields(product) : EMPTY,
  )
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [globalError, setGlobalError] = useState<string | null>(null)

  function setField<K extends keyof ProductFormFields>(key: K, value: ProductFormFields[K]) {
    setFields(prev => ({ ...prev, [key]: value }))
    if (fieldErrors[key]) setFieldErrors(prev => ({ ...prev, [key]: undefined }))
    setGlobalError(null)
  }

  function buildBody(): CreateProductBody {
    return {
      name:        fields.name.trim(),
      description: fields.description.trim() || undefined,
      sku:         fields.sku.trim()         || undefined,
      barcode:     fields.barcode.trim()     || undefined,
      price:       parseFloat(fields.price),
      cost:        fields.cost ? parseFloat(fields.cost) : undefined,
      // Form is in percentage (21); API expects decimal (0.21)
      tax_rate:    fields.tax_rate ? parseFloat(fields.tax_rate) / 100 : undefined,
      unit:        fields.unit,
      category_id: fields.category_id.trim() || undefined,
      image_url:   fields.image_url.trim()   || undefined,
      is_active:   fields.is_active,
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setGlobalError(null)

    const errors = validate(fields)
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    try {
      const body    = buildBody()
      const result  = product
        ? await update(product.id, body)
        : await create(body)
      onSuccess(result)
    } catch (err) {
      if (isApiError(err)) {
        if (err.code === API_CODES.VALIDATION_ERROR) {
          const map = getValidationMap(err) as FieldErrors
          if (Object.keys(map).length > 0) {
            setFieldErrors(map)
          } else {
            setGlobalError(err.message)
          }
        } else if (err.code === API_CODES.DUPLICATE) {
          setGlobalError('Ya existe un producto con ese SKU o código de barras.')
        } else if (err.code === API_CODES.PLAN_LIMIT_REACHED) {
          setGlobalError('Límite de productos del plan alcanzado. Actualizá tu suscripción.')
        } else {
          setGlobalError(err.message)
        }
      } else {
        setGlobalError('Error inesperado. Intentá de nuevo.')
      }
    }
  }

  function reset() {
    setFields(product ? productToFields(product) : EMPTY)
    setFieldErrors({})
    setGlobalError(null)
  }

  return {
    fields,
    setField,
    fieldErrors,
    globalError,
    mutating,
    submit,
    reset,
    isEdit: !!product,
  }
}
