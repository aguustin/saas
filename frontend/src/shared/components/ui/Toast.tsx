import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { create } from 'zustand'
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  X,
} from 'lucide-react'

// ── Store ────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastItem {
  id:           string
  type:         ToastType
  title:        string
  description?: string
  duration?:    number  // ms; 0 = permanente hasta cierre manual
}

interface ToastState {
  toasts: ToastItem[]
  add:    (toast: Omit<ToastItem, 'id'>) => string
  remove: (id: string) => void
  clear:  () => void
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  add: (toast) => {
    const id = crypto.randomUUID()
    set(s => ({ toasts: [...s.toasts, { ...toast, id }] }))
    return id
  },

  remove: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),

  clear: () => set({ toasts: [] }),
}))

// ── Hook ─────────────────────────────────────────────────────────

export function useToast() {
  const { add, remove, clear } = useToastStore()

  function toast(type: ToastType, title: string, description?: string, duration = 4500) {
    return add({ type, title, description, duration })
  }

  return {
    toast,
    success: (title: string, description?: string) => toast('success', title, description),
    error:   (title: string, description?: string) => toast('error',   title, description, 6000),
    warning: (title: string, description?: string) => toast('warning', title, description, 5000),
    info:    (title: string, description?: string) => toast('info',    title, description),
    dismiss: remove,
    clear,
  }
}

// ── Componente individual ─────────────────────────────────────────

const TOAST_STYLES: Record<ToastType, { wrapper: string; icon: string; Icon: React.ElementType }> = {
  success: {
    wrapper: 'border-green-200  bg-green-50  dark:bg-green-950/80  dark:border-green-800',
    icon:    'text-green-600 dark:text-green-400',
    Icon:    CheckCircle2,
  },
  error: {
    wrapper: 'border-red-200    bg-red-50    dark:bg-red-950/80    dark:border-red-800',
    icon:    'text-red-600   dark:text-red-400',
    Icon:    XCircle,
  },
  warning: {
    wrapper: 'border-amber-200  bg-amber-50  dark:bg-amber-950/80  dark:border-amber-800',
    icon:    'text-amber-600 dark:text-amber-400',
    Icon:    AlertTriangle,
  },
  info: {
    wrapper: 'border-blue-200   bg-blue-50   dark:bg-blue-950/80   dark:border-blue-800',
    icon:    'text-blue-600  dark:text-blue-400',
    Icon:    Info,
  },
}

function ToastCard({ toast }: { toast: ToastItem }) {
  const remove  = useToastStore(s => s.remove)
  const { wrapper, icon, Icon } = TOAST_STYLES[toast.type]

  useEffect(() => {
    const duration = toast.duration ?? 4500
    if (duration === 0) return
    const timer = setTimeout(() => remove(toast.id), duration)
    return () => clearTimeout(timer)
  }, [toast.id, toast.duration, remove])

  return (
    <div
      role="alert"
      className={[
        'flex items-start gap-3 w-80 rounded-xl border px-4 py-3 shadow-lg',
        'animate-in slide-in-from-right-4 fade-in duration-200',
        wrapper,
      ].join(' ')}
    >
      <Icon size={18} className={`shrink-0 mt-0.5 ${icon}`} />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-content">
          {toast.title}
        </p>
        {toast.description && (
          <p className="mt-0.5 text-xs text-content-muted">
            {toast.description}
          </p>
        )}
      </div>

      <button
        onClick={() => remove(toast.id)}
        className="shrink-0 p-0.5 rounded text-content-subtle hover:text-content-2 transition-colors"
        aria-label="Cerrar"
      >
        <X size={14} />
      </button>
    </div>
  )
}

// ── Toaster (montar en Shell o Providers) ─────────────────────────

export function Toaster() {
  const toasts = useToastStore(s => s.toasts)

  return createPortal(
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 items-end"
    >
      {toasts.map(t => (
        <ToastCard key={t.id} toast={t} />
      ))}
    </div>,
    document.body,
  )
}
