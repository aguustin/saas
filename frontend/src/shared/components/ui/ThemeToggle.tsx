import { Sun, Moon } from 'lucide-react'
import { useUIStore } from '@/shared/store/ui.store'

export function ThemeToggle() {
  const isDark     = useUIStore(s => s.isDark)
  const toggleDark = useUIStore(s => s.toggleDark)

  return (
    <button
      onClick={toggleDark}
      aria-label={isDark ? 'Activar modo claro' : 'Activar modo oscuro'}
      className="p-2 rounded-lg text-content-muted hover:text-content hover:bg-surface-2 transition-colors"
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  )
}
