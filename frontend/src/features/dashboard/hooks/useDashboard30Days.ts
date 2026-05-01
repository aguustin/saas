import { useState, useEffect, useMemo } from 'react'
import { salesApi } from '@/features/sales/api/sales.api'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { localDayStart, localDayEnd, todayISO } from '@/shared/utils/date'
import type { SaleResponse } from '@/shared/types'

export interface DayRevenue {
  date:    string   // YYYY-MM-DD
  revenue: number
}

export interface TopProduct {
  product_id:   string
  product_name: string
  quantity:     number
  revenue:      number
}

export interface Stats30 {
  revenue:   number
  count:     number
  avgTicket: number
  cash:      number
  card:      number
  transfer:  number
  mp:        number
}

function isoNDaysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  const y   = d.getFullYear()
  const m   = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function toLocalDate(isoString: string): string {
  const d = new Date(isoString)
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

function buildDayRevenue(sales: SaleResponse[], fromDate: string): DayRevenue[] {
  const map = new Map<string, number>()
  for (const sale of sales) {
    const day = toLocalDate(sale.created_at)
    map.set(day, (map.get(day) ?? 0) + sale.total)
  }

  const result: DayRevenue[] = []
  const base = new Date(`${fromDate}T00:00:00`)
  for (let i = 0; i < 30; i++) {
    const d = new Date(base)
    d.setDate(d.getDate() + i)
    const key = [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0'),
    ].join('-')
    result.push({ date: key, revenue: map.get(key) ?? 0 })
  }
  return result
}

function buildTopProducts(sales: SaleResponse[]): TopProduct[] {
  const map = new Map<string, TopProduct>()
  for (const sale of sales) {
    for (const item of sale.items) {
      const existing = map.get(item.product_id)
      if (existing) {
        existing.quantity += item.quantity
        existing.revenue  += item.subtotal
      } else {
        map.set(item.product_id, {
          product_id:   item.product_id,
          product_name: item.product_name,
          quantity:     item.quantity,
          revenue:      item.subtotal,
        })
      }
    }
  }
  return [...map.values()]
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5)
}

function buildStats(sales: SaleResponse[]): Stats30 {
  let revenue = 0, count = 0, cash = 0, card = 0, transfer = 0, mp = 0

  for (const sale of sales) {
    revenue += sale.total
    count   += 1

    switch (sale.payment_method) {
      case 'cash':     cash     += sale.total; break
      case 'card':     card     += sale.total; break
      case 'transfer': transfer += sale.total; break
      case 'mp':       mp       += sale.total; break
      case 'mixed':
        for (const b of sale.payment_details.mixed_breakdown ?? []) {
          if (b.method === 'cash')     cash     += b.amount
          if (b.method === 'card')     card     += b.amount
          if (b.method === 'transfer') transfer += b.amount
          if (b.method === 'mp')       mp       += b.amount
        }
        break
    }
  }

  return {
    revenue,
    count,
    avgTicket: count > 0 ? revenue / count : 0,
    cash,
    card,
    transfer,
    mp,
  }
}

// Descarga todas las páginas del endpoint para evitar el corte en N ventas.
// Usa páginas de 500 para minimizar round-trips sin exceder timeouts típicos.
async function fetchAllSales(
  params: Parameters<typeof salesApi.list>[0],
): Promise<SaleResponse[]> {
  const PAGE  = 500
  const all: SaleResponse[] = []
  let   offset = 0

  while (true) {
    const res = await salesApi.list({ ...params, limit: PAGE, offset })
    all.push(...res.items)
    if (all.length >= res.total || res.items.length < PAGE) break
    offset += PAGE
  }

  return all
}

export function useDashboard30Days() {
  const { branchId }  = useAuth()
  const [sales,   setSales]   = useState<SaleResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  // today como estado: se actualiza al recuperar el foco de pestaña.
  // Esto desliza la ventana de 30 días si el usuario deja la app abierta
  // durante la noche y vuelve al día siguiente.
  const [today, setToday] = useState<string>(todayISO())

  useEffect(() => {
    const checkDate = () => {
      const current = todayISO()
      setToday(prev => (prev !== current ? current : prev))
    }
    window.addEventListener('focus', checkDate)
    return () => window.removeEventListener('focus', checkDate)
  }, [])

  const fromDate = useMemo(() => isoNDaysAgo(29), [today])

  useEffect(() => {
    if (!branchId) return
    setLoading(true)
    setError(null)

    fetchAllSales({
      branch_id: branchId,
      status:    'completed',
      date_from: localDayStart(fromDate),
      date_to:   localDayEnd(today),
    })
      .then(setSales)
      .catch(err => setError(err instanceof Error ? err.message : 'Error al cargar datos'))
      .finally(() => setLoading(false))
  }, [branchId, fromDate, today])

  const dailyRevenue = useMemo(() => buildDayRevenue(sales, fromDate), [sales, fromDate])
  const topProducts  = useMemo(() => buildTopProducts(sales), [sales])
  const total30      = useMemo(() => buildStats(sales), [sales])

  return { dailyRevenue, topProducts, total30, loading, error }
}
