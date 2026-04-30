import { useMemo, useState } from 'react'
import { useStockMovements } from './useStockMovements'

/**
 * Extiende useStockMovements con búsqueda de producto client-side.
 * No modifica el hook base para no romper StockMovementsPanel.
 */
export function useMovementsPage() {
  const base = useStockMovements()

  const [productSearch, setProductSearch] = useState('')

  const movements = useMemo(() => {
    const q = productSearch.trim().toLowerCase()
    if (!q) return base.movements
    return base.movements.filter(m =>
      m.product_name.toLowerCase().includes(q)
    )
  }, [base.movements, productSearch])

  return {
    ...base,
    movements,          // override: filtered list
    productSearch,
    setProductSearch,
  }
}
