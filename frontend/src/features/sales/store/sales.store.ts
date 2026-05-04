import { create } from 'zustand'
import { salesApi } from '@/features/sales/api/sales.api'
import { API_CODES, isApiError } from '@/shared/api/errors'
import type { ApiError, SaleResponse, DailySummary } from '@/shared/types'
import type { CreateSaleBody, SalesFilters, RefundBody } from '@/features/sales/api/sales.api'

// ── Configuración ────────────────────────────────────────────────

// Cuántas veces reintentar automáticamente ante STOCK_RACE_CONDITION
// antes de propagar el error al componente.
const MAX_RACE_RETRIES = 3
const RACE_RETRY_DELAY = 400 // ms

// ── Tipos ────────────────────────────────────────────────────────

type LoadStatus = 'idle' | 'loading' | 'error'

interface SalesState {
  // Lista
  items:   SaleResponse[]
  total:   number
  limit:   number
  offset:  number
  filters: SalesFilters

  // Detalle
  current: SaleResponse | null

  // Cache de resúmenes diarios: key = `${branch_id}:${date}`
  summaries: Record<string, DailySummary>

  // Estados
  status:    LoadStatus
  error:     ApiError | null
  creating:  boolean
  refunding: boolean
}

interface SalesActions {
  // Lectura
  fetch:        (filters?: Partial<SalesFilters>) => Promise<void>
  fetchById:    (id: string) => Promise<SaleResponse>
  fetchSummary: (branchId: string, date: string) => Promise<DailySummary>

  // Escritura
  create: (body: CreateSaleBody) => Promise<SaleResponse>
  refund: (id: string, body: RefundBody) => Promise<SaleResponse>

  // Filtros
  setFilters: (f: Partial<SalesFilters>) => void

  reset: () => void
}

// ── Estado inicial ───────────────────────────────────────────────

const DEFAULT_FILTERS: SalesFilters = { limit: 50, offset: 0 }

const INITIAL: SalesState = {
  items:     [],
  total:     0,
  limit:     50,
  offset:    0,
  filters:   DEFAULT_FILTERS,
  current:   null,
  summaries: {},
  status:    'idle',
  error:     null,
  creating:  false,
  refunding: false,
}

// ── Store ────────────────────────────────────────────────────────

export const useSalesStore = create<SalesState & SalesActions>((set, get) => ({
  ...INITIAL,

  // ── fetch ─────────────────────────────────────────────────────

  fetch: async (newFilters = {}) => {
    const filters = { ...get().filters, ...newFilters }
    set({ status: 'loading', error: null, filters, items: [], total: 0 })

    try {
      const result = await salesApi.list(filters)
      set({
        items:  result.items,
        total:  result.total,
        limit:  result.limit,
        offset: result.offset,
        status: 'idle',
      })
    } catch (err) {
      set({ status: 'error', error: err as ApiError, items: [], total: 0 })
    }
  },

  // ── fetchById ─────────────────────────────────────────────────

  fetchById: async (id) => {
    const cached = get().items.find(s => s.id === id)
    if (cached) {
      set({ current: cached })
      return cached
    }

    const sale = await salesApi.byId(id)
    set({ current: sale })
    return sale
  },

  // ── fetchSummary ─────────────────────────────────────────────
  // Cache en memoria: no hay invalidación automática (se refresca
  // al navegar al día o al finalizar una venta exitosa).

  fetchSummary: async (branchId, date) => {
    const key    = `${branchId}:${date}`
    const cached = get().summaries[key]
    if (cached) return cached

    const summary = await salesApi.summary(branchId, date)
    set(s => ({ summaries: { ...s.summaries, [key]: summary } }))
    return summary
  },

  // ── create ────────────────────────────────────────────────────
  //
  // Reglas críticas del sistema:
  //   - INSUFFICIENT_STOCK (422) → NO reintentar, propagar con details
  //   - STOCK_RACE_CONDITION (422) → reintentar hasta MAX_RACE_RETRIES
  //     con backoff lineal (dos cajeros simultáneos en el mismo producto)
  //
  // Al completar exitosamente:
  //   - Prepend a la lista local (sin refetch)
  //   - Invalidar el resumen del día para la sucursal afectada

  create: async (body) => {
    set({ creating: true, error: null })
    let attempt = 0

    while (true) {
      try {
        const sale = await salesApi.create(body)

        set(s => ({
          items:    [sale, ...s.items],
          total:    s.total + 1,
          creating: false,
        }))

        // Invalidar resumen del día para que se recalcule
        invalidateSummary(sale.branch_id)

        return sale
      } catch (err) {
        const isRace =
          isApiError(err) && err.code === API_CODES.STOCK_RACE_CONDITION

        if (isRace && attempt < MAX_RACE_RETRIES - 1) {
          attempt++
          await delay(RACE_RETRY_DELAY * attempt)
          continue
        }

        set({ creating: false, error: isApiError(err) ? err : null })
        throw err
      }
    }
  },

  // ── refund ────────────────────────────────────────────────────
  //
  // Refund total: body vacío (el backend devuelve todas las unidades)
  // Refund parcial: body con items: [{ sale_item_id, quantity }]
  // restock: true por defecto (el backend lo asume así)
  //
  // Optimistic: marcamos el item como 'refunded' en la lista antes
  // de que el servidor confirme, revertimos en error.

  refund: async (id, body) => {
    const snapshot = get().items
    set(s => ({
      items:     s.items.map(sale =>
        sale.id === id ? { ...sale, status: 'refunded' as const } : sale,
      ),
      refunding: true,
    }))

    try {
      const updated = await salesApi.refund(id, body)

      set(s => ({
        items:     s.items.map(sale => sale.id === id ? updated : sale),
        current:   s.current?.id === id ? updated : s.current,
        refunding: false,
      }))

      // Invalidar resumen del día
      invalidateSummary(updated.branch_id)

      return updated
    } catch (err) {
      set({ items: snapshot, refunding: false })
      throw err
    }
  },

  setFilters: (f) => set(s => ({ filters: { ...s.filters, ...f } })),

  reset: () => set(INITIAL),
}))

// ── Selector utilitario ──────────────────────────────────────────

export function useDailySummary(branchId: string, date: string): DailySummary | undefined {
  return useSalesStore(s => s.summaries[`${branchId}:${date}`])
}

// ── Helpers ──────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

// Quitar la clave del cache para que el próximo fetchSummary llame al API
function invalidateSummary(branchId: string) {
  const today = new Date().toISOString().slice(0, 10)
  const key   = `${branchId}:${today}`
  useSalesStore.setState(s => {
    const { [key]: _, ...rest } = s.summaries
    return { summaries: rest }
  })
}
