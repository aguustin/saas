import { http } from '@/shared/api/client'
import type {
  ProductResponse,
  ProductListResponse,
  ProductUnit,
} from '@/shared/types'

export interface ProductFilters {
  search?:      string
  category_id?: string
  is_active?:   boolean
  min_price?:   number
  max_price?:   number
  limit?:       number
  offset?:      number
  sort_by?:     'name' | 'price' | 'created_at' | 'updated_at'
  sort_dir?:    'asc' | 'desc'
}

export interface CreateProductBody {
  name:         string
  description?: string
  sku?:         string
  barcode?:     string
  price:        number
  cost?:        number
  tax_rate?:    number
  unit?:        ProductUnit
  category_id?: string
  image_url?:   string
  attributes?:  Record<string, unknown>
  is_active?:   boolean
}

export type UpdateProductBody = Partial<CreateProductBody>

export const productsApi = {
  list(filters: ProductFilters = {}): Promise<ProductListResponse> {
    return http.get<ProductListResponse>('/products', { params: filters }).then(r => r.data)
  },

  byId(id: string): Promise<ProductResponse> {
    return http.get<ProductResponse>(`/products/${id}`).then(r => r.data)
  },

  byBarcode(barcode: string): Promise<ProductResponse> {
    return http.get<ProductResponse>(`/products/barcode/${barcode}`).then(r => r.data)
  },

  create(body: CreateProductBody): Promise<ProductResponse> {
    return http.post<ProductResponse>('/products', body).then(r => r.data)
  },

  update(id: string, body: UpdateProductBody): Promise<ProductResponse> {
    return http.patch<ProductResponse>(`/products/${id}`, body).then(r => r.data)
  },

  patchActive(id: string, is_active: boolean): Promise<ProductResponse> {
    return http.patch<ProductResponse>(`/products/${id}/active`, { is_active }).then(r => r.data)
  },

  remove(id: string): Promise<void> {
    return http.delete(`/products/${id}`).then(() => undefined)
  },

  bulkRemove(ids: string[]): Promise<void> {
    return http.delete('/products/bulk', { data: { ids } }).then(() => undefined)
  },
}
