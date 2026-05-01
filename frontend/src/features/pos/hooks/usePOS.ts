import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useProductStore } from '@/features/products/store/products.store'
import { useSalesStore } from '@/features/sales/store/sales.store'
import { useSyncStore } from '@/features/sync/store/sync.store'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { isApiError, API_CODES, getStockDetails } from '@/shared/api/errors'
import { useToastStore } from '@/shared/components/ui/Toast'
import { paymentsApi } from '../api/payments.api'
import type { MpQRResponse } from '../api/payments.api'
import type { ProductResponse, SaleResponse, PaymentMethod, CustomerResponse } from '@/shared/types'
import type { CreateSaleBody, MixedBreakdown } from '@/features/sales/api/sales.api'
import type { InsufficientStockDetail } from '@/shared/api/errors'

// ── Tipos públicos ────────────────────────────────────────────────

export interface CartItem {
  product:    ProductResponse
  quantity:   number
  unit_price: number   // puede diferir del price del producto si se edita
  discount:   number   // descuento por línea en $
  subtotal:   number   // (unit_price * quantity) - discount
}

export interface POSTotals {
  subtotal:  number   // suma de (unit_price * qty) por línea
  discount:  number   // descuento global + suma de descuentos de línea
  taxable:   number   // subtotal - discount
  tax:       number   // taxable * 0.21
  total:     number   // taxable + tax
}

export type CheckoutStage = 'cart' | 'payment' | 'mp_qr' | 'ticket'

export interface POSTicketData {
  sale:       SaleResponse | null
  syncId:     string | null          // para ventas offline
  isOffline:  boolean
}

export interface InsufficientStockModal {
  open:    boolean
  details: InsufficientStockDetail[]
}

// ── Hook ──────────────────────────────────────────────────────────

export function usePOS() {
  const { branchId } = useAuth()
  const fetchBarcode  = useProductStore(s => s.fetchBarcode)
  const productsByName = useProductStore(s => s.items)
  const fetchProducts  = useProductStore(s => s.fetch)
  const createSale     = useSalesStore(s => s.create)
  const enqueueSale    = useSyncStore(s => s.enqueueSale)
  const isOnline       = useSyncStore(s => s.isOnline)
  const addToast       = useToastStore(s => s.add)

  // ── Carrito ───────────────────────────────────────────────────

  const [items,            setItems]            = useState<CartItem[]>([])
  const [globalDiscount,   setGlobalDiscount]   = useState(0)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerResponse | null>(null)

  // ── Búsqueda ──────────────────────────────────────────────────

  const [query,          setQuery]          = useState('')
  const [searchResults,  setSearchResults]  = useState<ProductResponse[]>([])
  const [searchLoading,  setSearchLoading]  = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Flujo de pago ─────────────────────────────────────────────

  const [stage,          setStage]          = useState<CheckoutStage>('cart')
  const [submitting,     setSubmitting]     = useState(false)
  const [ticket,         setTicket]         = useState<POSTicketData | null>(null)
  const [mpQRData,       setMpQRData]       = useState<MpQRResponse | null>(null)

  // ── Errores stock ─────────────────────────────────────────────

  const [stockModal, setStockModal] = useState<InsufficientStockModal>({
    open:    false,
    details: [],
  })

  // ── Totales (derivados) ───────────────────────────────────────

  const totals = useMemo<POSTotals>(() => {
    const subtotal       = items.reduce((acc, i) => acc + i.unit_price * i.quantity, 0)
    const lineDiscounts  = items.reduce((acc, i) => acc + i.discount, 0)
    const discount       = lineDiscounts + globalDiscount
    const taxable        = Math.max(0, subtotal - discount)
    const tax            = taxable * 0.21
    const total          = taxable + tax
    return { subtotal, discount, taxable, tax, total }
  }, [items, globalDiscount])

  // ── Búsqueda de productos ─────────────────────────────────────
  //
  // Si parece un barcode (≥ 6 dígitos, sin espacios), llama
  // fetchBarcode (cache-first, < 200ms). Si no, debounce 250ms
  // y filtra sobre la lista cargada en memoria o llama al API.

  const BARCODE_RE = /^\d{6,}$/

  const search = useCallback((q: string) => {
    setQuery(q)
    const trimmed = q.trim()

    if (!trimmed) {
      setSearchResults([])
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (BARCODE_RE.test(trimmed)) {
      setSearchLoading(true)
      fetchBarcode(trimmed)
        .then(product => {
          if (product.is_active) {
            setSearchResults([product])
            setSearchLoading(false)
          } else {
            setSearchResults([])
            setSearchLoading(false)
          }
        })
        .catch(() => {
          setSearchResults([])
          setSearchLoading(false)
        })
      return
    }

    debounceRef.current = setTimeout(() => {
      const lower = trimmed.toLowerCase()

      // Buscar offline primero en la caché ya cargada
      if (!isOnline || productsByName.length > 0) {
        const filtered = productsByName
          .filter(p => p.is_active && (
            p.name.toLowerCase().includes(lower) ||
            (p.sku  && p.sku.toLowerCase().includes(lower)) ||
            (p.barcode && p.barcode.includes(trimmed))
          ))
          .slice(0, 8)
        setSearchResults(filtered)
        if (filtered.length === 0 && isOnline) {
          // Fallback: llamar API si no hay resultados locales
          setSearchLoading(true)
          fetchProducts({ search: trimmed, limit: 8, offset: 0 })
            .then(() => {
              setSearchResults(
                useProductStore.getState().items.filter(p =>
                  p.is_active && p.name.toLowerCase().includes(lower),
                ).slice(0, 8),
              )
              setSearchLoading(false)
            })
            .catch(() => setSearchLoading(false))
        }
      } else if (isOnline) {
        setSearchLoading(true)
        fetchProducts({ search: trimmed, limit: 8, offset: 0 })
          .then(() => {
            setSearchResults(
              useProductStore.getState().items
                .filter(p => p.is_active && p.name.toLowerCase().includes(lower))
                .slice(0, 8),
            )
            setSearchLoading(false)
          })
          .catch(() => setSearchLoading(false))
      }
    }, 250)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchBarcode, fetchProducts, isOnline, productsByName])

  // ── Agregar al carrito ────────────────────────────────────────

  const addToCart = useCallback((product: ProductResponse, qty = 1) => {
    setItems(prev => {
      const idx = prev.findIndex(i => i.product.id === product.id)
      if (idx >= 0) {
        return prev.map((item, i) => {
          if (i !== idx) return item
          const quantity = item.quantity + qty
          return {
            ...item,
            quantity,
            subtotal: item.unit_price * quantity - item.discount,
          }
        })
      }
      const newItem: CartItem = {
        product,
        quantity:   qty,
        unit_price: product.price,
        discount:   0,
        subtotal:   product.price * qty,
      }
      return [...prev, newItem]
    })
    setQuery('')
    setSearchResults([])
  }, [])

  // ── Modificar ítem del carrito ────────────────────────────────

  const updateItem = useCallback((productId: string, changes: Partial<Pick<CartItem, 'quantity' | 'unit_price' | 'discount'>>) => {
    setItems(prev => prev.map(item => {
      if (item.product.id !== productId) return item
      const qty        = changes.quantity   ?? item.quantity
      const unitPrice  = changes.unit_price ?? item.unit_price
      const discount   = changes.discount   ?? item.discount
      return {
        ...item,
        quantity:   qty,
        unit_price: unitPrice,
        discount:   discount,
        subtotal:   unitPrice * qty - discount,
      }
    }))
  }, [])

  const removeItem = useCallback((productId: string) => {
    setItems(prev => prev.filter(i => i.product.id !== productId))
  }, [])

  const clearCart = useCallback(() => {
    setItems([])
    setGlobalDiscount(0)
    setSelectedCustomer(null)
    setQuery('')
    setSearchResults([])
  }, [])

  // ── Checkout ──────────────────────────────────────────────────

  async function checkout(
    method:  PaymentMethod,
    details: CreateSaleBody['payment_details'],
    notes?:  string,
  ) {
    if (!branchId || items.length === 0) return
    setSubmitting(true)

    const body: CreateSaleBody = {
      branch_id:       branchId,
      customer_id:     selectedCustomer?.id ?? undefined,
      items:           items.map(i => ({
        product_id: i.product.id,
        quantity:   i.quantity,
        unit_price: i.unit_price,
        discount:   i.discount > 0 ? i.discount : undefined,
      })),
      payment_method:  method,
      payment_details: details,
      discount:        globalDiscount > 0 ? globalDiscount : undefined,
      notes:           notes || undefined,
    }

    // ── MP QR dinámico ────────────────────────────────────────────
    if (method === 'mp' && isOnline) {
      try {
        const qrData = await paymentsApi.createMpQR(body)
        setMpQRData(qrData)
        setStage('mp_qr')
      } catch (err) {
        handleCheckoutError(err)
      } finally {
        setSubmitting(false)
      }
      return
    }

    if (!isOnline) {
      const syncId = enqueueSale(body)
      setTicket({ sale: null, syncId, isOffline: true })
      setStage('ticket')
      setSubmitting(false)
      clearCart()
      return
    }

    try {
      const sale = await createSale(body)
      setTicket({ sale, syncId: null, isOffline: false })
      setStage('ticket')
      clearCart()
    } catch (err) {
      handleCheckoutError(err)
    } finally {
      setSubmitting(false)
    }
  }

  function handleCheckoutError(err: unknown) {
    if (isApiError(err)) {
      if (err.code === API_CODES.INSUFFICIENT_STOCK) {
        setStockModal({ open: true, details: getStockDetails(err) })
      } else if (err.code === API_CODES.STOCK_RACE_CONDITION) {
        addToast({
          type:        'error',
          title:       'Conflicto de stock',
          description: 'Otro cajero modificó el stock. Verificá las cantidades e intentá de nuevo.',
        })
      } else if (err.code === API_CODES.PLAN_LIMIT_REACHED) {
        addToast({
          type:        'warning',
          title:       'Límite del plan alcanzado',
          description: 'Actualizá tu plan para procesar más ventas.',
        })
      } else {
        addToast({
          type:        'error',
          title:       'Error al procesar la venta',
          description: err.message,
        })
      }
    } else {
      addToast({ type: 'error', title: 'Error inesperado' })
    }
  }

  function onMpApproved(sale: SaleResponse) {
    setMpQRData(null)
    setTicket({ sale, syncId: null, isOffline: false })
    setStage('ticket')
    clearCart()
  }

  async function cancelMpPayment() {
    if (mpQRData) {
      try { await paymentsApi.cancelMpQR(mpQRData.sale_id) } catch { /* best effort */ }
      setMpQRData(null)
    }
    setStage('payment')
  }

  // ── Limpiar debounce al desmontar ─────────────────────────────

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  // ── Validación de pago mixto ──────────────────────────────────

  function validateMixed(breakdown: MixedBreakdown[]): string | null {
    const activeMethods = breakdown.filter(b => b.amount > 0)
    if (activeMethods.length < 2) return 'El pago mixto requiere al menos 2 métodos.'
    const sum = activeMethods.reduce((acc, b) => acc + b.amount, 0)
    if (Math.abs(sum - totals.total) > 0.01) {
      return `La suma ($${sum.toFixed(2)}) no coincide con el total ($${totals.total.toFixed(2)}).`
    }
    return null
  }

  // ── Nuevo ticket ──────────────────────────────────────────────

  function newSale() {
    setTicket(null)
    setStage('cart')
  }

  return {
    // Carrito
    items,
    globalDiscount,
    setGlobalDiscount,
    addToCart,
    updateItem,
    removeItem,
    clearCart,
    totals,

    // Cliente
    selectedCustomer,
    setSelectedCustomer,

    // Búsqueda
    query,
    searchResults,
    searchLoading,
    search,

    // Flujo
    stage,
    setStage,
    submitting,
    checkout,
    validateMixed,

    // Ticket
    ticket,
    newSale,

    // MP QR
    mpQRData,
    onMpApproved,
    cancelMpPayment,

    // Errores
    stockModal,
    setStockModal,

    // Estado de conexión
    isOnline,
  }
}
