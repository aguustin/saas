import { http } from '@/shared/api/client'
import type {
  StockRow,
  StockMovementRow,
  StockAlert,
  StockMovementType,
  PaginatedResult,
} from '@/shared/types'

// ── Filtros ──────────────────────────────────────────────────────

export interface StockFilters {
  search?:    string
  branch_id?: string
  is_low?:    boolean
  sort_by?:   'product_name' | 'quantity' | 'updated_at'
  sort_dir?:  'asc' | 'desc'
  limit?:     number
  offset?:    number
}

export interface MovementFilters {
  branch_id?:   string
  product_id?:  string
  type?:        StockMovementType
  date_from?:   string
  date_to?:     string
  limit?:       number
  offset?:      number
}

// ── Cuerpos de escritura ─────────────────────────────────────────

export interface CreateMovementBody {
  stock_id?:    string
  product_id:   string
  branch_id:    string
  type:         StockMovementType
  quantity:     number
  reference_id?: string
  note?:         string
}

export interface UpdateMinQtyBody {
  min_quantity: number
}

// ── API ──────────────────────────────────────────────────────────

export const stockApi = {
  list(filters: StockFilters = {}): Promise<PaginatedResult<StockRow>> {
    return http.get<PaginatedResult<StockRow>>('/stock', { params: filters }).then(r => r.data)
  },

  alerts(): Promise<StockAlert[]> {
    return http.get<StockAlert[]>('/stock/alerts').then(r => r.data)
  },

  movements(filters: MovementFilters = {}): Promise<PaginatedResult<StockMovementRow>> {
    return http.get<PaginatedResult<StockMovementRow>>('/stock/movements', { params: filters }).then(r => r.data)
  },

  createMovement(body: CreateMovementBody): Promise<StockMovementRow> {
    return http.post<StockMovementRow>('/stock/movements', body).then(r => r.data)
  },

  updateMinQty(stockId: string, body: UpdateMinQtyBody): Promise<StockRow> {
    return http.patch<StockRow>(`/stock/${stockId}/min-quantity`, body).then(r => r.data)
  },
}
