import { create } from 'zustand'

// ── Persistencia ─────────────────────────────────────────────────

const DARK_KEY    = 'saas_dark_mode'
const SIDEBAR_KEY = 'saas_sidebar_collapsed'

function loadDark(): boolean {
  const stored = localStorage.getItem(DARK_KEY)
  if (stored !== null) return stored === 'true'
  // Default: preferencia del sistema operativo
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function loadSidebarCollapsed(): boolean {
  return localStorage.getItem(SIDEBAR_KEY) === 'true'
}

// Aplica/quita la clase 'dark' en <html> para que Tailwind active
// los estilos dark:. Se llama al inicializar y al togglear.
function applyDarkClass(isDark: boolean) {
  document.documentElement.classList.toggle('dark', isDark)
}

// Inicializar clase dark antes del primer render para evitar flash
applyDarkClass(loadDark())

// ── Tipos ────────────────────────────────────────────────────────

/**
 * Registry de modales activos.
 * En lugar de booleanos sueltos, usamos un Set de IDs.
 * Permite apilar modales (ej. confirm encima de un form modal).
 *
 * Uso:
 *   openModal('delete-product')
 *   isModalOpen('delete-product')  // true
 *   closeModal('delete-product')
 */
type ModalId = string

interface UIState {
  isDark:            boolean
  sidebarCollapsed:  boolean   // colapsar sidebar en pantallas pequeñas
  globalLoading:     boolean   // overlay de carga global (ej. logout, cambio de plan)
  openModals:        Set<ModalId>
  // Datos opcionales que un modal puede necesitar (ej. el ID del recurso a eliminar)
  modalData:         Record<ModalId, unknown>
}

interface UIActions {
  // Dark mode
  toggleDark:  () => void
  setDark:     (v: boolean) => void

  // Sidebar
  toggleSidebar:    () => void
  setSidebarCollapsed: (v: boolean) => void

  // Loading global
  setGlobalLoading: (v: boolean) => void

  // Modal registry
  openModal:    (id: ModalId, data?: unknown) => void
  closeModal:   (id: ModalId) => void
  closeAllModals: () => void
  isModalOpen:  (id: ModalId) => boolean
  getModalData: <T = unknown>(id: ModalId) => T | undefined
}

// ── Store ────────────────────────────────────────────────────────

export const useUIStore = create<UIState & UIActions>((set, get) => ({
  isDark:           loadDark(),
  sidebarCollapsed: loadSidebarCollapsed(),
  globalLoading:    false,
  openModals:       new Set(),
  modalData:        {},

  // ── Dark mode ────────────────────────────────────────────────

  toggleDark: () => {
    const next = !get().isDark
    localStorage.setItem(DARK_KEY, String(next))
    applyDarkClass(next)
    set({ isDark: next })
  },

  setDark: (v) => {
    localStorage.setItem(DARK_KEY, String(v))
    applyDarkClass(v)
    set({ isDark: v })
  },

  // ── Sidebar ──────────────────────────────────────────────────

  toggleSidebar: () => {
    const next = !get().sidebarCollapsed
    localStorage.setItem(SIDEBAR_KEY, String(next))
    set({ sidebarCollapsed: next })
  },

  setSidebarCollapsed: (v) => {
    localStorage.setItem(SIDEBAR_KEY, String(v))
    set({ sidebarCollapsed: v })
  },

  // ── Global loading ───────────────────────────────────────────

  setGlobalLoading: (v) => set({ globalLoading: v }),

  // ── Modal registry ───────────────────────────────────────────
  //
  // Inmutabilidad: Zustand trackea cambios por referencia.
  // Set/Map mutables no triggean re-renders, hay que crear nuevas
  // instancias en cada actualización.

  openModal: (id, data) => {
    set(s => ({
      openModals: new Set([...s.openModals, id]),
      modalData:  data !== undefined
        ? { ...s.modalData, [id]: data }
        : s.modalData,
    }))
  },

  closeModal: (id) => {
    set(s => {
      const next = new Set(s.openModals)
      next.delete(id)
      const { [id]: _removed, ...restData } = s.modalData
      return { openModals: next, modalData: restData }
    })
  },

  closeAllModals: () => set({ openModals: new Set(), modalData: {} }),

  isModalOpen: (id) => get().openModals.has(id),

  getModalData: <T>(id: ModalId) => get().modalData[id] as T | undefined,
}))

// ── Selectores utilitarios ───────────────────────────────────────

/**
 * Hook de conveniencia para manejar un modal específico.
 *
 * Uso:
 *   const { isOpen, open, close, data } = useModal<{ id: string }>('delete-product')
 *   open({ id: product.id })
 */
export function useModal<TData = unknown>(id: ModalId) {
  const openModal  = useUIStore(s => s.openModal)
  const closeModal = useUIStore(s => s.closeModal)
  const isOpen     = useUIStore(s => s.openModals.has(id))
  const data       = useUIStore(s => s.modalData[id] as TData | undefined)

  return {
    isOpen,
    data,
    open:  (d?: TData) => openModal(id, d),
    close: ()          => closeModal(id),
  }
}
