import { useState, useEffect, useCallback } from 'react'
import { stockApi } from '@/features/stock/api/stock.api'
import { useAuth } from '@/features/auth/hooks/useAuth'

const POLL_MS = 5 * 60 * 1_000  // 5 min

/**
 * Hook autónomo para el badge global de stock bajo.
 * Usa estado local propio — no depende del stock store ni de StockPage.
 * Solo activo para roles con acceso a /app/stock (manager +).
 */
export function useLowStock() {
  const { hasMinRole } = useAuth()
  const canView = hasMinRole('manager')

  const [count,   setCount]   = useState(0)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!canView) return
    setLoading(true)
    try {
      const alerts = await stockApi.alerts()
      setCount(alerts.length)
    } catch {
      // no crítico — el badge simplemente no muestra nada
    } finally {
      setLoading(false)
    }
  }, [canView])

  // Carga inicial + polling
  useEffect(() => {
    void refresh()
    const id = setInterval(() => void refresh(), POLL_MS)
    return () => clearInterval(id)
  }, [refresh])

  // Refetch al volver la pestaña al foco
  useEffect(() => {
    const onFocus = () => void refresh()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refresh])

  return { count, loading }
}
