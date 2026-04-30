import { useState } from 'react'
import { useStockStore } from '@/features/stock/store/stock.store'
import { useAuth } from '@/features/auth/hooks/useAuth'
import type { ApiError, StockMovementRow, StockMovementType } from '@/shared/types'

// ── Tipos ────────────────────────────────────────────────────────

export interface MovementFormFields {
  product_id:   string
  product_name: string  // solo para mostrar en el input de búsqueda
  branch_id:    string
  type:         StockMovementType
  quantity:     string  // string para el input, se convierte al enviar
  reference_id: string
  note:         string
}

export interface MovementFormErrors {
  product_id?:  string
  quantity?:    string
  global?:      string
}

// ── Hook ─────────────────────────────────────────────────────────

export function useMovementForm(
  prefillStockId:  string | null,
  prefillProductId:string | null,
  prefillProductName: string | null,
  onSuccess: (mv: StockMovementRow) => void,
) {
  const createMovement = useStockStore(s => s.createMovement)
  const { branchId }   = useAuth()

  const [fields, setFields] = useState<MovementFormFields>({
    product_id:   prefillProductId   ?? '',
    product_name: prefillProductName ?? '',
    branch_id:    branchId           ?? '',
    type:         'purchase',
    quantity:     '',
    reference_id: '',
    note:         '',
  })
  const [errors,     setErrors]     = useState<MovementFormErrors>({})
  const [submitting, setSubmitting] = useState(false)

  function set<K extends keyof MovementFormFields>(key: K, val: MovementFormFields[K]) {
    setFields(prev => ({ ...prev, [key]: val }))
    setErrors(prev => ({ ...prev, [key]: undefined, global: undefined }))
  }

  function setProduct(id: string, name: string) {
    setFields(prev => ({ ...prev, product_id: id, product_name: name }))
    setErrors(prev => ({ ...prev, product_id: undefined }))
  }

  function reset(productId = '', productName = '') {
    setFields({
      product_id:   productId,
      product_name: productName,
      branch_id:    branchId ?? '',
      type:         'purchase',
      quantity:     '',
      reference_id: '',
      note:         '',
    })
    setErrors({})
  }

  function validate(): boolean {
    const e: MovementFormErrors = {}
    if (!fields.product_id)  e.product_id = 'Seleccioná un producto'
    const qty = Number(fields.quantity)
    if (!fields.quantity || isNaN(qty)) e.quantity = 'Ingresá una cantidad válida'
    else if (fields.type !== 'adjustment' && qty <= 0)
      e.quantity = 'La cantidad debe ser positiva'
    else if (qty === 0)
      e.quantity = 'La cantidad no puede ser cero'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function submit() {
    if (!validate()) return
    setSubmitting(true)
    try {
      const mv = await createMovement({
        product_id:   fields.product_id,
        branch_id:    fields.branch_id || branchId || '',
        type:         fields.type,
        quantity:     Number(fields.quantity),
        reference_id: fields.reference_id || undefined,
        note:         fields.note         || undefined,
      })
      onSuccess(mv)
    } catch (err) {
      const apiErr = err as ApiError
      if (apiErr.code === 'INSUFFICIENT_STOCK') {
        setErrors({ quantity: 'Stock insuficiente para este movimiento' })
      } else {
        setErrors({ global: apiErr.message ?? 'Error al registrar movimiento' })
      }
    } finally {
      setSubmitting(false)
    }
  }

  return { fields, errors, submitting, set, setProduct, submit, reset }
}
