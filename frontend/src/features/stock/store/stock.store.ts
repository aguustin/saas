import { create } from 'zustand'
import { stockApi } from '@/features/stock/api/stock.api'
import type { ApiError, StockRow, StockMovementRow, StockAlert } from '@/shared/types'
import type {
  StockFilters,
  MovementFilters,
  CreateMovementBody,
} from '@/features/stock/api/stock.api'

// ── Tipos ────────────────────────────────────────────────────────

type LoadStatus = 'idle' | 'loading' | 'error'

interface StockState {
  // Inventario
  items:          StockRow[]
  itemsTotal:     number
  itemsLimit:     number
  itemsOffset:    number
  itemsStatus:    LoadStatus
  itemsError:     ApiError | null
  byStockId:      Record<string, StockRow>

  // Movimientos
  movements:      StockMovementRow[]
  movementsTotal: number
  movementsLimit: number
  movementsOffset:number
  movStatus:      LoadStatus

  // Alertas
  alerts:         StockAlert[]
  alertsStatus:   LoadStatus
  alertsLoaded:   boolean

  // Estado de mutación
  mutating: boolean
}

interface StockActions {
  // Inventario
  fetchStock:     (filters?: Partial<StockFilters>) => Promise<void>
  updateMinQty:   (stockId: string, minQty: number) => Promise<void>

  // Movimientos
  fetchMovements: (filters?: Partial<MovementFilters>) => Promise<void>
  createMovement: (body: CreateMovementBody) => Promise<StockMovementRow>

  // Alertas
  fetchAlerts:    () => Promise<void>

  reset: () => void
}

// ── Estado inicial ───────────────────────────────────────────────

const INITIAL: StockState = {
  items:           [],
  itemsTotal:      0,
  itemsLimit:      25,
  itemsOffset:     0,
  itemsStatus:     'idle',
  itemsError:      null,
  byStockId:       {},
  movements:       [],
  movementsTotal:  0,
  movementsLimit:  25,
  movementsOffset: 0,
  movStatus:       'idle',
  alerts:          [],
  alertsStatus:    'idle',
  alertsLoaded:    false,
  mutating:        false,
}

function indexByStockId(rows: StockRow[]): Record<string, StockRow> {
  const m: Record<string, StockRow> = {}
  for (const r of rows) m[r.stock_id] = r
  return m
}

// ── Store ────────────────────────────────────────────────────────

export const useStockStore = create<StockState & StockActions>((set, get) => ({
  ...INITIAL,

  // ── Inventario ────────────────────────────────────────────────

  fetchStock: async (filters = {}) => {
    set({ itemsStatus: 'loading', itemsError: null })
    try {
      const result = await stockApi.list(filters)
      set({
        items:        result.items,
        itemsTotal:   result.total,
        itemsLimit:   result.limit,
        itemsOffset:  result.offset,
        itemsStatus:  'idle',
        byStockId:    { ...get().byStockId, ...indexByStockId(result.items) },
      })
    } catch (err) {
      set({ itemsStatus: 'error', itemsError: err as ApiError })
    }
  },

  updateMinQty: async (stockId, minQty) => {
    set({ mutating: true })
    const snapshot = get().byStockId[stockId]
    // optimistic
    set(s => ({
      items:     s.items.map(r => r.stock_id === stockId ? { ...r, min_quantity: minQty } : r),
      byStockId: { ...s.byStockId, [stockId]: { ...s.byStockId[stockId]!, min_quantity: minQty } },
    }))
    try {
      const updated = await stockApi.updateMinQty(stockId, { min_quantity: minQty })
      set(s => ({
        items:     s.items.map(r => r.stock_id === stockId ? updated : r),
        byStockId: { ...s.byStockId, [stockId]: updated },
        mutating:  false,
      }))
    } catch {
      if (snapshot) set(s => ({
        items:     s.items.map(r => r.stock_id === stockId ? snapshot : r),
        byStockId: { ...s.byStockId, [stockId]: snapshot },
      }))
      set({ mutating: false })
      throw new Error('Error al actualizar mínimo')
    }
  },

  // ── Movimientos ───────────────────────────────────────────────

  fetchMovements: async (filters = {}) => {
    set({ movStatus: 'loading' })
    try {
      const result = await stockApi.movements(filters)
      set({
        movements:       result.items,
        movementsTotal:  result.total,
        movementsLimit:  result.limit,
        movementsOffset: result.offset,
        movStatus:       'idle',
      })
    } catch {
      set({ movStatus: 'error' })
    }
  },

  createMovement: async (body) => {
    set({ mutating: true })
    try {
      const movement = await stockApi.createMovement(body)
      set(s => ({
        movements: [movement, ...s.movements],
        movementsTotal: s.movementsTotal + 1,
        mutating: false,
      }))
      // Refrescar stock e alertas tras el movimiento
      void get().fetchStock()
      void get().fetchAlerts()
      return movement
    } catch (err) {
      set({ mutating: false })
      throw err
    }
  },

  // ── Alertas ───────────────────────────────────────────────────

  fetchAlerts: async () => {
    set({ alertsStatus: 'loading' })
    try {
      const alerts = await stockApi.alerts()
      set({ alerts, alertsStatus: 'idle', alertsLoaded: true })
    } catch {
      set({ alertsStatus: 'error' })
    }
  },

  reset: () => set(INITIAL),
}))
