import { http } from '@/shared/api/client'
import type {
  SaleResponse,
  DailySummary,
  PaymentMethod,
  SaleStatus,
  PaginatedResult,
} from '@/shared/types'

export interface SaleItemInput {
  product_id: string
  quantity:   number
  unit_price: number
  discount?:  number
}

export interface MixedBreakdown {
  method: PaymentMethod
  amount: number
}

export interface CreateSaleBody {
  branch_id:       string
  customer_id?:    string
  items:           SaleItemInput[]
  payment_method:  PaymentMethod
  payment_details: {
    cash_received?:   number
    change?:          number
    card_last4?:      string
    installments?:    number
    transfer_ref?:    string
    mp_payment_id?:   string
    mixed_breakdown?: MixedBreakdown[]
  }
  discount?: number
  notes?:    string
}

export interface SalesFilters {
  branch_id?:   string
  cashier_id?:  string
  customer_id?: string
  status?:      SaleStatus
  date_from?:   string
  date_to?:     string
  limit?:       number
  offset?:      number
}

export interface RefundBody {
  reason:   string
  restock?: boolean
  items?:   Array<{ sale_item_id: string; quantity: number }>
}

export const salesApi = {
  list(filters: SalesFilters = {}): Promise<PaginatedResult<SaleResponse>> {
    return http.get<PaginatedResult<SaleResponse>>('/sales', { params: filters }).then(r => r.data)
  },

  byId(id: string): Promise<SaleResponse> {
    return http.get<SaleResponse>(`/sales/${id}`).then(r => r.data)
  },

  summary(branchId: string, date: string): Promise<DailySummary> {
    return http
      .get<DailySummary>('/sales/summary', { params: { branch_id: branchId, date } })
      .then(r => r.data)
  },

  create(body: CreateSaleBody): Promise<SaleResponse> {
    return http.post<SaleResponse>('/sales', body).then(r => r.data)
  },

  refund(id: string, body: RefundBody): Promise<SaleResponse> {
    return http.post<SaleResponse>(`/sales/${id}/refund`, body).then(r => r.data)
  },
}
