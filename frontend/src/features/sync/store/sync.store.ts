import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { syncApi } from '@/features/sync/api/sync.api'
import { getDeviceId } from '@/shared/utils/device'
import type { SyncableTable } from '@/shared/types'
import type { CreateSaleBody } from '@/features/sales/api/sales.api'

// ── Persistencia ─────────────────────────────────────────────────
// Los cursores y las ventas pendientes sobreviven recargas del browser.
// Son la fuente de verdad para la sincronización incremental.

const CURSORS_KEY = 'saas_sync_cursors'
const PENDING_KEY = 'saas_pending_sales'

function loadCursors(): Partial<Record<SyncableTable, number>> {
  try {
    return JSON.parse(localStorage.getItem(CURSORS_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function saveCursors(c: Partial<Record<SyncableTable, number>>) {
  localStorage.setItem(CURSORS_KEY, JSON.stringify(c))
}

function loadPending(): OfflineSale[] {
  try {
    return JSON.parse(localStorage.getItem(PENDING_KEY) ?? '[]')
  } catch {
    return []
  }
}

function savePending(queue: OfflineSale[]) {
  localStorage.setItem(PENDING_KEY, JSON.stringify(queue))
}

// ── Tipos ────────────────────────────────────────────────────────

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline'

export interface OfflineSale {
  sync_id:    string           // UUID generado en el cliente
  status:     'queued' | 'pushing' | 'applied' | 'conflict' | 'error'
  payload:    CreateSaleBody
  server_id?: string           // seteado tras 'applied'
  attempts:   number
  created_at: string           // ISO
  error?:     string
  // En caso de conflicto, guardamos el server_row para mostrar en UI
  conflict_row?: Record<string, unknown>
}

// Tablas que el cliente puede leer vía pull
const ALL_PULL_TABLES: SyncableTable[] = [
  'products', 'categories', 'branches', 'customers',
  'sales', 'sale_items', 'stock', 'stock_movements', 'employees',
]

interface SyncState {
  status:       SyncStatus
  cursors:      Partial<Record<SyncableTable, number>>
  behind:       Record<string, number>
  pendingSales: OfflineSale[]
  lastSyncAt:   string | null
  error:        string | null
  isOnline:     boolean
  // Listener cleanup refs (no reactivos, solo para teardown)
  _cleanupOnline:  (() => void) | null
  _cleanupOffline: (() => void) | null
}

interface SyncActions {
  // Ciclo de vida del engine
  init:     () => void
  teardown: () => void

  // Operaciones de sync
  pull:         (tables?: SyncableTable[]) => Promise<void>
  push:         () => Promise<void>
  flush:        () => Promise<void>
  checkBehind:  () => Promise<void>

  // Queue de ventas offline
  enqueueSale:        (payload: CreateSaleBody) => string
  dequeueSale:        (syncId: string) => void
  updateSaleStatus:   (
    syncId:    string,
    status:    OfflineSale['status'],
    extra?:    { serverId?: string; error?: string; conflictRow?: Record<string, unknown> }
  ) => void

  // Estado interno
  setStatus:   (s: SyncStatus) => void
  setCursors:  (c: Partial<Record<SyncableTable, number>>) => void
  setOnline:   (v: boolean) => void
}

// ── Store ────────────────────────────────────────────────────────

export const useSyncStore = create<SyncState & SyncActions>((set, get) => ({
  status:          navigator.onLine ? 'idle' : 'offline',
  cursors:         loadCursors(),
  behind:          {},
  pendingSales:    loadPending(),
  lastSyncAt:      null,
  error:           null,
  isOnline:        navigator.onLine,
  _cleanupOnline:  null,
  _cleanupOffline: null,

  // ── init ─────────────────────────────────────────────────────
  // Registra listeners de online/offline.
  // Cuando vuelve la conexión → intenta flush automático.

  init: () => {
    const { setOnline, flush } = get()

    function onOnline() {
      setOnline(true)
      // Flush en background al recuperar conexión
      void flush().catch(() => {/* el store ya actualiza el status */})
    }

    function onOffline() {
      setOnline(false)
    }

    window.addEventListener('online',  onOnline)
    window.addEventListener('offline', onOffline)

    set({
      _cleanupOnline:  () => window.removeEventListener('online',  onOnline),
      _cleanupOffline: () => window.removeEventListener('offline', onOffline),
    })
  },

  teardown: () => {
    get()._cleanupOnline?.()
    get()._cleanupOffline?.()
    set({ _cleanupOnline: null, _cleanupOffline: null })
  },

  // ── pull ──────────────────────────────────────────────────────
  //
  // Descarga cambios del servidor desde el último cursor conocido.
  // Si has_more = true en alguna tabla, sigue paginando hasta vaciar.
  //
  // Nota: el upsert real a IndexedDB/Dexie se haría dentro del loop;
  // aquí solo actualizamos cursores y estado. La integración con Dexie
  // se agrega en la capa sync/db/ sin modificar este store.

  pull: async (tables = ALL_PULL_TABLES) => {
    if (!get().isOnline) return
    set({ status: 'syncing', error: null })

    try {
      const deviceId   = getDeviceId()
      let   remaining  = [...tables]
      const newCursors = { ...get().cursors }

      while (remaining.length > 0) {
        const result = await syncApi.pull({
          device_id: deviceId,
          tables:    remaining,
          cursors:   Object.fromEntries(
            remaining.map(t => [t, newCursors[t] ?? 0]),
          ),
          page_size: 500,
        })

        const stillBehind: SyncableTable[] = []

        for (const [table, tableResult] of Object.entries(result.tables)) {
          const t = table as SyncableTable
          newCursors[t] = tableResult.cursor
          // TODO: upsert tableResult.rows en Dexie: db[t].bulkPut(rows)
          if (tableResult.has_more) stillBehind.push(t)
        }

        remaining = stillBehind
      }

      saveCursors(newCursors)
      set({
        cursors:    newCursors,
        status:     'idle',
        lastSyncAt: new Date().toISOString(),
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      set({ status: 'error', error: msg })
      throw err
    }
  },

  // ── push ──────────────────────────────────────────────────────
  //
  // Envía ventas generadas offline al servidor.
  // Solo procesa las que están en estado 'queued' o 'error' (reintento).
  // Las que están en 'conflict' requieren acción del usuario.

  push: async () => {
    const { pendingSales } = get()
    const toSend = pendingSales.filter(
      s => s.status === 'queued' || s.status === 'error',
    )
    if (toSend.length === 0) return
    if (!get().isOnline) return

    set({ status: 'syncing' })

    // Marcar como 'pushing' de inmediato
    get().pendingSales.forEach(s => {
      if (toSend.some(t => t.sync_id === s.sync_id)) {
        get().updateSaleStatus(s.sync_id, 'pushing')
      }
    })

    try {
      const result = await syncApi.push({
        device_id: getDeviceId(),
        changes:   toSend.map(sale => ({
          table:        'sales' as const,
          operation:    'INSERT' as const,
          sync_id:      sale.sync_id,
          base_version: 0,
          payload:      sale.payload,
        })),
      })

      for (const r of result.results) {
        switch (r.status) {
          case 'applied':
            // Venta confirmada por el servidor
            get().updateSaleStatus(r.sync_id, 'applied', { serverId: r.server_id })
            break

          case 'skipped':
            // Ya existía (idempotente) → tratar como aplicada
            get().updateSaleStatus(r.sync_id, 'applied', { serverId: r.server_id })
            break

          case 'conflict':
            // El servidor tiene un estado diferente; el usuario debe resolver
            get().updateSaleStatus(r.sync_id, 'conflict', {
              conflictRow: r.conflict?.server_row,
            })
            break

          case 'error':
            get().updateSaleStatus(r.sync_id, 'error', { error: r.error })
            break
        }
      }

      set({ status: 'idle' })
    } catch (err) {
      // Revertir pushing → error para que se reintente
      toSend.forEach(s => get().updateSaleStatus(s.sync_id, 'error'))
      const msg = err instanceof Error ? err.message : 'Error al sincronizar'
      set({ status: 'error', error: msg })
      throw err
    }
  },

  // ── flush ─────────────────────────────────────────────────────
  // Pull + push en secuencia. Punto de entrada al reconectar.

  flush: async () => {
    if (!get().isOnline) return
    await get().pull()
    await get().push()
  },

  // ── checkBehind ───────────────────────────────────────────────
  // Consulta cuántas filas le faltan al dispositivo en el servidor.

  checkBehind: async () => {
    try {
      const result = await syncApi.status(getDeviceId())
      set({ behind: result.behind })
    } catch {
      // No crítico; silencioso
    }
  },

  // ── enqueueSale ───────────────────────────────────────────────
  // Genera un sync_id en el cliente y encola la venta para sync.
  // Retorna el sync_id para que el POS lo use como referencia local.

  enqueueSale: (payload) => {
    const sync_id = crypto.randomUUID()
    const sale: OfflineSale = {
      sync_id,
      status:     'queued',
      payload,
      attempts:   0,
      created_at: new Date().toISOString(),
    }

    set(s => {
      const updated = [...s.pendingSales, sale]
      savePending(updated)
      return { pendingSales: updated }
    })

    return sync_id
  },

  dequeueSale: (syncId) => {
    set(s => {
      const updated = s.pendingSales.filter(s => s.sync_id !== syncId)
      savePending(updated)
      return { pendingSales: updated }
    })
  },

  updateSaleStatus: (syncId, status, extra = {}) => {
    set(s => {
      const updated = s.pendingSales.map(sale => {
        if (sale.sync_id !== syncId) return sale
        return {
          ...sale,
          status,
          attempts:     status === 'pushing' ? sale.attempts + 1 : sale.attempts,
          server_id:    extra.serverId     ?? sale.server_id,
          error:        extra.error        ?? sale.error,
          conflict_row: extra.conflictRow  ?? sale.conflict_row,
        }
      })
      savePending(updated)
      return { pendingSales: updated }
    })
  },

  // ── Estado interno ────────────────────────────────────────────

  setStatus: (status) => set({ status }),

  setCursors: (cursors) => {
    const merged = { ...get().cursors, ...cursors }
    saveCursors(merged)
    set({ cursors: merged })
  },

  setOnline: (isOnline) => {
    set({ isOnline, status: isOnline ? 'idle' : 'offline' })
  },
}))

// ── Selectores utilitarios ───────────────────────────────────────

/** Ventas offline pendientes de enviar (queued + error) */
export function usePendingSalesCount(): number {
  return useSyncStore(s =>
    s.pendingSales.filter(p => p.status === 'queued' || p.status === 'error').length,
  )
}

/** Ventas con conflicto que requieren resolución manual */
export function useConflictedSales(): OfflineSale[] {
  return useSyncStore(useShallow(s => s.pendingSales.filter(p => p.status === 'conflict')))
}

/** true cuando hay datos pendientes de sincronizar en el servidor */
export function useIsBehind(): boolean {
  return useSyncStore(s => Object.values(s.behind).some(v => v > 0))
}
