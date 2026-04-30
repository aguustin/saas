import { useNavigate } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { useLowStock } from '../hooks/useLowStock'

/**
 * Badge global de stock bajo para el header de la aplicación.
 * Desacoplado: gestiona su propio estado, no toca el store de stock.
 * Se oculta cuando count === 0 → no ocupa espacio cuando todo está bien.
 */
export function LowStockBadge() {
  const { count } = useLowStock()
  const navigate  = useNavigate()

  if (count === 0) return null

  const label = count === 1
    ? '1 producto con stock bajo'
    : `${count} productos con stock bajo`

  return (
    <button
      type="button"
      onClick={() => navigate('/app/stock')}
      title={label}
      aria-label={label}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg
                 text-xs font-medium
                 text-amber-700 dark:text-amber-400
                 bg-amber-50 dark:bg-amber-950/30
                 border border-amber-200 dark:border-amber-800
                 hover:bg-amber-100 dark:hover:bg-amber-900/40
                 transition-colors shrink-0"
    >
      <AlertTriangle size={13} className="shrink-0" />
      <span className="hidden sm:inline">Stock bajo</span>
      <span
        className="inline-flex items-center justify-center
                   min-w-[18px] h-[18px] px-1 rounded-full
                   bg-red-500 text-white text-[10px] font-bold leading-none"
      >
        {count > 99 ? '99+' : count}
      </span>
    </button>
  )
}
