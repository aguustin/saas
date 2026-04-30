import { create } from 'zustand'
import { productsApi } from '@/features/products/api/products.api'
import type { ApiError, ProductResponse } from '@/shared/types'
import type { ProductFilters, CreateProductBody, UpdateProductBody } from '@/features/products/api/products.api'

// ── Tipos ────────────────────────────────────────────────────────

type LoadStatus = 'idle' | 'loading' | 'error'

interface ProductState {
  // Lista paginada
  items:   ProductResponse[]
  total:   number
  limit:   number
  offset:  number

  // Filtros activos (la fuente de verdad vive aquí, no en la URL)
  filters: ProductFilters

  // Estados de carga
  status:   LoadStatus
  error:    ApiError | null
  mutating: boolean // create / update / toggle / delete en curso

  // Caches de acceso rápido (usados por POS scan y navegación por ID)
  byId:      Record<string, ProductResponse>
  byBarcode: Record<string, ProductResponse>
}

interface ProductActions {
  // Lectura
  fetch:        (filters?: Partial<ProductFilters>) => Promise<void>
  fetchById:    (id: string) => Promise<ProductResponse>
  fetchBarcode: (barcode: string) => Promise<ProductResponse>

  // Escritura
  create:       (body: CreateProductBody) => Promise<ProductResponse>
  update:       (id: string, body: UpdateProductBody) => Promise<ProductResponse>
  toggleActive: (id: string, active: boolean) => Promise<void>
  remove:       (id: string) => Promise<void>
  bulkRemove:   (ids: string[]) => Promise<void>

  // Filtros
  setFilters:   (f: Partial<ProductFilters>) => void

  // Reset
  reset: () => void
}

// ── Estado inicial ───────────────────────────────────────────────

const DEFAULT_FILTERS: ProductFilters = {
  limit:    50,
  offset:   0,
  sort_by:  'name',
  sort_dir: 'asc',
}

const INITIAL: ProductState = {
  items:    [],
  total:    0,
  limit:    50,
  offset:   0,
  filters:  DEFAULT_FILTERS,
  status:   'idle',
  error:    null,
  mutating: false,
  byId:     {},
  byBarcode:{},
}

// ── Helpers ──────────────────────────────────────────────────────

function indexProducts(products: ProductResponse[]) {
  const byId:      Record<string, ProductResponse> = {}
  const byBarcode: Record<string, ProductResponse> = {}
  for (const p of products) {
    byId[p.id] = p
    if (p.barcode) byBarcode[p.barcode] = p
  }
  return { byId, byBarcode }
}

function mergeIntoCache(
  existing: Record<string, ProductResponse>,
  products: ProductResponse[],
): Record<string, ProductResponse> {
  const copy = { ...existing }
  for (const p of products) copy[p.id] = p
  return copy
}

// ── Store ────────────────────────────────────────────────────────

export const useProductStore = create<ProductState & ProductActions>((set, get) => ({
  ...INITIAL,

  // ── fetch ──────────────────────────────────────────────────────
  // Aplica nuevos filtros al estado antes de llamar al API.
  // Permite hacer fetch({ search: 'cola' }) sin pasar todos los filtros.

  fetch: async (newFilters = {}) => {
    const filters = { ...get().filters, ...newFilters }
    set({ status: 'loading', error: null, filters })

    try {
      const result = await productsApi.list(filters)
      const { byId, byBarcode } = indexProducts(result.items)

      set({
        items:    result.items,
        total:    result.total,
        limit:    result.limit,
        offset:   result.offset,
        status:   'idle',
        byId:     mergeIntoCache(get().byId, result.items),
        byBarcode: { ...get().byBarcode, ...byBarcode },
      })
    } catch (err) {
      set({ status: 'error', error: err as ApiError })
    }
  },

  // ── fetchById ─────────────────────────────────────────────────
  // Sirve cache si ya está disponible y no está desactualizado.

  fetchById: async (id) => {
    const cached = get().byId[id]
    if (cached) return cached

    try {
      const product = await productsApi.byId(id)
      set(s => ({
        byId: { ...s.byId, [id]: product },
      }))
      return product
    } catch (err) {
      throw err
    }
  },

  // ── fetchBarcode ──────────────────────────────────────────────
  // Ruta crítica del POS (< 200ms requerido por el sistema).
  // Sirve desde cache local si ya se escaneó este barcode antes.

  fetchBarcode: async (barcode) => {
    const cached = get().byBarcode[barcode]
    if (cached) return cached

    const product = await productsApi.byBarcode(barcode)

    set(s => ({
      byId:      { ...s.byId,      [product.id]: product },
      byBarcode: { ...s.byBarcode, [barcode]:    product },
    }))

    return product
  },

  // ── create ────────────────────────────────────────────────────

  create: async (body) => {
    set({ mutating: true })
    try {
      const product = await productsApi.create(body)

      // Prepend al listado; actualizar caches
      set(s => ({
        items:     [product, ...s.items],
        total:     s.total + 1,
        byId:      { ...s.byId,      [product.id]: product },
        byBarcode: product.barcode
          ? { ...s.byBarcode, [product.barcode]: product }
          : s.byBarcode,
        mutating:  false,
      }))

      // Los límites del plan cambiaron (usamos un producto más)
      void refreshBillingLimits()

      return product
    } catch (err) {
      set({ mutating: false })
      throw err
    }
  },

  // ── update ────────────────────────────────────────────────────

  update: async (id, body) => {
    set({ mutating: true })
    try {
      const updated = await productsApi.update(id, body)

      set(s => ({
        items: s.items.map(p => p.id === id ? updated : p),
        byId:  { ...s.byId, [id]: updated },
        byBarcode: updated.barcode
          ? { ...s.byBarcode, [updated.barcode]: updated }
          : s.byBarcode,
        mutating: false,
      }))

      return updated
    } catch (err) {
      set({ mutating: false })
      throw err
    }
  },

  // ── toggleActive ─────────────────────────────────────────────
  // Optimistic: el cambio se refleja de inmediato en la lista.
  // Si el API falla, se revierte al estado previo.

  toggleActive: async (id, active) => {
    const snapshot = get().items

    // Optimistic update
    set(s => ({
      items: s.items.map(p =>
        p.id === id ? { ...p, is_active: active } : p,
      ),
      byId: {
        ...s.byId,
        ...(s.byId[id] ? { [id]: { ...s.byId[id], is_active: active } } : {}),
      },
    }))

    try {
      const updated = await productsApi.patchActive(id, active)
      // Reemplazar con la respuesta real del servidor
      set(s => ({
        items: s.items.map(p => p.id === id ? updated : p),
        byId:  { ...s.byId, [id]: updated },
      }))
    } catch (err) {
      // Rollback completo
      set(s => ({
        items: snapshot,
        byId:  { ...s.byId, ...(snapshot.find(p => p.id === id) ? { [id]: snapshot.find(p => p.id === id)! } : {}) },
      }))
      throw err
    }
  },

  // ── remove ────────────────────────────────────────────────────
  // Optimistic: quita de la lista de inmediato.
  // El backend hace soft-delete (sets deleted_at, no borra de DB).

  remove: async (id) => {
    const snapshot      = get().items
    const snapshotTotal = get().total

    set(s => ({
      items: s.items.filter(p => p.id !== id),
      total: s.total - 1,
    }))

    try {
      await productsApi.remove(id)
      // Quitar del cache también
      set(s => {
        const { [id]: _removed, ...restById } = s.byId
        return { byId: restById }
      })
      void refreshBillingLimits()
    } catch (err) {
      set({ items: snapshot, total: snapshotTotal })
      throw err
    }
  },

  // ── bulkRemove ────────────────────────────────────────────────
  // Optimistic igual que remove individual.

  bulkRemove: async (ids) => {
    const idSet         = new Set(ids)
    const snapshot      = get().items
    const snapshotTotal = get().total

    set(s => ({
      items: s.items.filter(p => !idSet.has(p.id)),
      total: s.total - ids.length,
    }))

    try {
      await productsApi.bulkRemove(ids)
      set(s => {
        const byId = { ...s.byId }
        ids.forEach(id => delete byId[id])
        return { byId }
      })
      void refreshBillingLimits()
    } catch (err) {
      set({ items: snapshot, total: snapshotTotal })
      throw err
    }
  },

  // ── setFilters ────────────────────────────────────────────────
  // Actualiza filtros localmente; el componente debe llamar fetch()
  // para aplicarlos (permite debounce en el input de búsqueda).

  setFilters: (f) => set(s => ({ filters: { ...s.filters, ...f } })),

  reset: () => set(INITIAL),
}))

// ── Selector utilitario ──────────────────────────────────────────

export function useProduct(id: string): ProductResponse | undefined {
  return useProductStore(s => s.byId[id])
}

export function useProductByBarcode(barcode: string): ProductResponse | undefined {
  return useProductStore(s => s.byBarcode[barcode])
}

// ── Lazy refresh de límites ──────────────────────────────────────
// Evitar import circular: billing no importa products, y viceversa.

async function refreshBillingLimits() {
  const { useBillingStore } = await import('@/features/billing/store/billing.store')
  useBillingStore.getState().refreshLimits()
}
