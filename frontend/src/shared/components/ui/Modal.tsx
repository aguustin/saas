import {
  useEffect,
  useRef,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full'

interface ModalProps {
  open:          boolean
  onClose:       () => void
  title?:        string
  description?:  string
  size?:         ModalSize
  children:      ReactNode
  footer?:       ReactNode
  closable?:     boolean
}

const SIZE_MAP: Record<ModalSize, string> = {
  sm:   'max-w-sm',
  md:   'max-w-md',
  lg:   'max-w-lg',
  xl:   'max-w-2xl',
  full: 'max-w-screen-lg',
}

export function Modal({
  open,
  onClose,
  title,
  description,
  size     = 'md',
  children,
  footer,
  closable = true,
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open || !closable) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, closable, onClose])

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return createPortal(
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={e => {
        if (closable && e.target === overlayRef.current) onClose()
      }}
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm"
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className={[
          'relative w-full rounded-2xl shadow-xl',
          'bg-surface',
          'border border-edge',
          'flex flex-col max-h-[90vh]',
          SIZE_MAP[size],
        ].join(' ')}
      >
        {/* Header */}
        {(title || closable) && (
          <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 shrink-0">
            <div>
              {title && (
                <h2
                  id="modal-title"
                  className="text-base font-semibold text-content"
                >
                  {title}
                </h2>
              )}
              {description && (
                <p className="mt-0.5 text-sm text-content-muted">
                  {description}
                </p>
              )}
            </div>
            {closable && (
              <button
                onClick={onClose}
                className="shrink-0 p-1.5 rounded-lg text-content-subtle
                           hover:text-content-2 hover:bg-surface-2 transition-colors"
                aria-label="Cerrar"
              >
                <X size={16} />
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div className="px-6 pb-4 overflow-y-auto flex-1 text-sm text-content-2">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div
            className="px-6 py-4 border-t border-surface-2
                       flex justify-end gap-3 shrink-0"
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

// ── Confirm dialog ──────────────────────────────────────────────

interface ConfirmProps {
  open:          boolean
  onClose:       () => void
  onConfirm:     () => void
  title:         string
  description?:  string
  confirmLabel?: string
  cancelLabel?:  string
  loading?:      boolean
  danger?:       boolean
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel  = 'Cancelar',
  loading      = false,
  danger       = false,
}: ConfirmProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-medium text-content-2
                       border border-edge-2 hover:bg-surface-2 transition-colors
                       disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={[
              'px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50',
              danger
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-brand-600 hover:bg-brand-700',
            ].join(' ')}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      {null}
    </Modal>
  )
}
