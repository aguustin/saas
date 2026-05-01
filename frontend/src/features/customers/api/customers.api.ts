import { http } from '@/shared/api/client'
import type { CustomerResponse, PaginatedResult } from '@/shared/types'

export interface CustomersFilters {
  search?: string
  limit?:  number
  offset?: number
}

export const customersApi = {
  list(filters: CustomersFilters = {}): Promise<PaginatedResult<CustomerResponse>> {
    return http.get<PaginatedResult<CustomerResponse>>('/customers', { params: filters }).then(r => r.data)
  },
}
