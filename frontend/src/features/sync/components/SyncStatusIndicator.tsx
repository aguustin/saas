import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Wifi, WifiOff, RefreshCw, AlertTriangle,
  CheckCircle2, CloudUpload, Clock, AlertCircle,
  X, Siren,
} from 'lucide-react'
import {
  useSyncStore,
  usePendingSalesCount,
  useConflictedSales,
  useIsBehind,
} from '@/features/sync/store/sync.store'
import { formatRelative } from '@/shared/utils/date'
import type { SyncStatus } from '@/features/sync/store/sync.store'

// ── Estado derivado ───────────────────────────────────────────────

type VisualState = 'ok' | 'syncing' | 'offline' | 'error' | 'behind' | 'pending'

function deriveVisual(
  status:       SyncStatus,
  isOnline:     boolean,
  pendingCount: number,
  isBehind:     boolean,
): VisualState {
  if (!isOnline || status === 'offline') return 'offline'
  if (status === 'syncing')             return 'syncing'
  if (status === 'error')               return 'error'
  if (isBehind)                         return 'behind'
  if (pendingCount > 0)                 return 'pending'
  return 'ok'
}

// ── Config visual por estado ──────────────────────────────────────

interface StateConfig {
  icon:    React.ElementType
  label:   string
  pill:    string
  dot:     string
  spin?:   boolean
}

const STATE_CONFIG: Record<VisualState, StateConfig> = {
  ok: {
    icon:  CheckCircle2,
    label: 'Sincronizado',
    pill:  'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800',
    dot:   'bg-green-500',
  },
  syncing: {
    icon:  RefreshCw,
    label: 'Sincronizando…',
    pill:  'text-brand-700 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/40 border-brand-200 dark:border-brand-700',
    dot:   'bg-brand-500',
    spin:  true,
  },
  offline: {
    icon:  WifiOff,
    label: 'Sin conexión',
    pill:  'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600',
    dot:   'bg-gray-400',
  },
  error: {
    icon:  AlertTriangle,
    label: 'Error de sync',
    pill:  'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800',
    dot:   'bg-red-500',
  },
  behind: {
    icon:  AlertCircle,
    label: 'Datos atrasados',
    pill:  'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800',
    dot:   'bg-amber-500',
  },
  pending: {
    icon:  CloudUpload,
    label: 'Cola pendiente',
    pill:  'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800',
    dot:   'bg-amber-500',
  },
}

// ── Secciones del panel ───────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
      {children}
    </p>
  )
}

function Row({ label, value, valueClass = '' }: { label: string; value: React.ReactNode; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className={`font-medium text-gray-800 dark:text-gray-200 tabular-nums ${valueClass}`}>{value}</span>
    </div>
  )
}

// ── Table names en español ────────────────────────────────────────

const TABLE_LABELS: Record<string, string> = {
  products:        'Productos',
  categories:      'Categorías',
  branches:        'Sucursales',
  customers:       'Clientes',
  sales:           'Ventas',
  sale_items:      'Líneas de venta',
  stock:           'Stock',
  stock_movements: 'Movimientos',
  employees:       'Empleados',
}

// ── Panel expandido ───────────────────────────────────────────────

interface PanelProps {
  triggerRect: DOMRect
  onClose:     () => void
}

function SyncPanel({ triggerRect, onClose }: PanelProps) {
  const status       = useSyncStore(s => s.status)
  const isOnline     = useSyncStore(s => s.isOnline)
  const behind       = useSyncStore(s => s.behind)
  const lastSyncAt   = useSyncStore(s => s.lastSyncAt)
  const error        = useSyncStore(s => s.error)
  const flush        = useSyncStore(s => s.flush)
  const pull         = useSyncStore(s => s.pull)
  const pendingCount = usePendingSalesCount()
  const conflicts    = useConflictedSales()
  const isBehind     = useIsBehind()
  const pendingSales = useSyncStore(s => s.pendingSales)

  const [flushing, setFlushing] = useState(false)

  const visual = deriveVisual(status, isOnline, pendingCount, isBehind)
  const cfg    = STATE_CONFIG[visual]
  const Icon   = cfg.icon

  const behindEntries = Object.entries(behind).filter(([, v]) => v > 0)

  async function handleFlush() {
    setFlushing(true)
    try { await flush() } finally { setFlushing(false) }
  }

  async function handlePull() {
    setFlushing(true)
    try { await pull() } finally { setFlushing(false) }
  }

  // Posición: debajo del trigger, alineado a la derecha
  const panelStyle: React.CSSProperties = {
    position: 'fixed',
    top:      triggerRect.bottom + 8,
    right:    window.innerWidth - triggerRect.right,
    zIndex:   9999,
    width:    320,
  }

  return createPortal(
    <>
      {/* Overlay semitransparente para cerrar */}
      <div className="fixed inset-0 z-[9998]" onClick={onClose} />

      {/* Panel */}
      <div
        style={panelStyle}
        className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700
                   shadow-xl overflow-hidden"
      >
        {/* Header del panel */}
        <div className={[
          'flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800',
        ].join(' ')}>
          <div className="flex items-center gap-2.5">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${cfg.pill}`}>
              <Icon size={14} className={cfg.spin ? 'animate-spin' : ''} />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {cfg.label}
              </p>
              <p className="text-xs text-gray-400">
                {isOnline ? 'En línea' : 'Modo offline'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100
                       dark:hover:bg-gray-800 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Cuerpo */}
        <div className="p-4 space-y-5 max-h-[480px] overflow-y-auto">

          {/* Última sincronización */}
          <div>
            <SectionTitle>Última sincronización</SectionTitle>
            <Row
              label="Hace"
              value={lastSyncAt ? formatRelative(lastSyncAt) : '—'}
            />
          </div>

          {/* Error */}
          {status === 'error' && error && (
            <div className="rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200
                            dark:border-red-800 px-3 py-3 space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} className="text-red-500 shrink-0" />
                <p className="text-xs font-semibold text-red-700 dark:text-red-400">
                  Error de sincronización
                </p>
              </div>
              <p className="text-xs text-red-600 dark:text-red-400 break-words">{error}</p>
              {isOnline && (
                <button
                  onClick={() => void handleFlush()}
                  disabled={flushing}
                  className="flex items-center gap-1.5 text-xs font-semibold text-red-700
                             dark:text-red-400 hover:underline disabled:opacity-50"
                >
                  <RefreshCw size={11} className={flushing ? 'animate-spin' : ''} />
                  Reintentar
                </button>
              )}
            </div>
          )}

          {/* Ventas pendientes */}
          {pendingCount > 0 && (
            <div>
              <SectionTitle>Cola offline</SectionTitle>
              <div className="space-y-2">
                <Row
                  label="Ventas pendientes"
                  value={pendingCount}
                  valueClass="text-amber-600 dark:text-amber-400"
                />
                {pendingSales.filter(s => s.status === 'error').length > 0 && (
                  <Row
                    label="Con error"
                    value={pendingSales.filter(s => s.status === 'error').length}
                    valueClass="text-red-600 dark:text-red-400"
                  />
                )}
                {isOnline && (
                  <button
                    onClick={() => void handleFlush()}
                    disabled={flushing || status === 'syncing'}
                    className="mt-1 w-full flex items-center justify-center gap-2 py-2 rounded-xl
                               text-xs font-semibold bg-brand-600 text-white hover:bg-brand-700
                               transition-colors disabled:opacity-50"
                  >
                    <RefreshCw size={12} className={flushing || status === 'syncing' ? 'animate-spin' : ''} />
                    {flushing ? 'Enviando…' : 'Sincronizar ahora'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Conflictos */}
          {conflicts.length > 0 && (
            <div className="rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200
                            dark:border-red-800 px-3 py-3">
              <div className="flex items-center gap-2 mb-2">
                <Siren size={14} className="text-red-500 shrink-0" />
                <p className="text-xs font-semibold text-red-700 dark:text-red-400">
                  {conflicts.length} venta{conflicts.length !== 1 ? 's' : ''} con conflicto
                </p>
              </div>
              <p className="text-xs text-red-600 dark:text-red-400">
                Estas ventas necesitan resolución manual. Revisalas en el módulo de ventas.
              </p>
            </div>
          )}

          {/* Datos atrasados */}
          {behindEntries.length > 0 && (
            <div>
              <SectionTitle>Datos pendientes de descargar</SectionTitle>
              <div className="space-y-1.5">
                {behindEntries.map(([table, count]) => (
                  <Row
                    key={table}
                    label={TABLE_LABELS[table] ?? table}
                    value={`${count} fila${count !== 1 ? 's' : ''}`}
                    valueClass="text-amber-600 dark:text-amber-400"
                  />
                ))}
              </div>
              {isOnline && (
                <button
                  onClick={() => void handlePull()}
                  disabled={flushing || status === 'syncing'}
                  className="mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-xl
                             text-xs font-semibold border border-amber-300 dark:border-amber-700
                             text-amber-700 dark:text-amber-400 hover:bg-amber-50
                             dark:hover:bg-amber-950/30 transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={12} className={flushing || status === 'syncing' ? 'animate-spin' : ''} />
                  Descargar actualizaciones
                </button>
              )}
            </div>
          )}

          {/* Estado limpio */}
          {visual === 'ok' && (
            <div className="flex flex-col items-center gap-2 py-4">
              <CheckCircle2 size={28} className="text-green-500" strokeWidth={1.5} />
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                Todo sincronizado correctamente
              </p>
              {isOnline && (
                <button
                  onClick={() => void handleFlush()}
                  disabled={flushing}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-brand-600
                             transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={11} className={flushing ? 'animate-spin' : ''} />
                  Forzar sincronización
                </button>
              )}
            </div>
          )}

          {/* Offline: información */}
          {visual === 'offline' && (
            <div className="flex flex-col items-center gap-2 py-2">
              <WifiOff size={28} className="text-gray-400" strokeWidth={1.5} />
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                Trabajando sin conexión. Los datos se sincronizarán cuando vuelva la red.
              </p>
              {pendingCount > 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium text-center">
                  {pendingCount} venta{pendingCount !== 1 ? 's' : ''} guardada{pendingCount !== 1 ? 's' : ''} localmente
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </>,
    document.body,
  )
}

// ── Botón indicador (siempre visible en el header) ────────────────

export function SyncStatusIndicator() {
  const status       = useSyncStore(s => s.status)
  const isOnline     = useSyncStore(s => s.isOnline)
  const pendingCount = usePendingSalesCount()
  const isBehind     = useIsBehind()

  const [open,        setOpen]        = useState(false)
  const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const visual = deriveVisual(status, isOnline, pendingCount, isBehind)
  const cfg    = STATE_CONFIG[visual]
  const Icon   = cfg.icon

  function toggle() {
    if (!open && buttonRef.current) {
      setTriggerRect(buttonRef.current.getBoundingClientRect())
    }
    setOpen(prev => !prev)
  }

  // Cerrar el panel si el estado cambia a 'ok' y no hay nada relevante
  useEffect(() => {
    if (open && visual === 'ok') setOpen(false)
  }, [visual, open])

  // Badge: cuenta de ventas pendientes o errores de sync
  const badgeCount = pendingCount > 0 ? pendingCount : null

  return (
    <>
      <button
        ref={buttonRef}
        onClick={toggle}
        aria-label={`Estado de sincronización: ${cfg.label}`}
        aria-expanded={open}
        className={[
          'relative flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-xs font-medium',
          'transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500',
          cfg.pill,
        ].join(' ')}
      >
        {/* Dot animado para offline / error */}
        {(visual === 'offline' || visual === 'error') && (
          <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${cfg.dot} ring-1 ring-white dark:ring-gray-900`} />
        )}

        <Icon size={13} className={cfg.spin ? 'animate-spin' : ''} />

        {/* Label — siempre visible en estados no-ok */}
        {visual !== 'ok' && (
          <span className="hidden sm:inline">{cfg.label}</span>
        )}

        {/* Badge de ventas pendientes */}
        {badgeCount != null && (
          <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1
                           rounded-full bg-amber-500 text-white text-[10px] font-bold leading-none">
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
        )}
      </button>

      {open && triggerRect && (
        <SyncPanel
          triggerRect={triggerRect}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
