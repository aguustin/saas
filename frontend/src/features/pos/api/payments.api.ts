import { http } from '@/shared/api/client'
import type { CreateSaleBody } from '@/features/sales/api/sales.api'

export interface MpQRResponse {
  sale_id:       string
  qr_data:       string
  preference_id: string
  amount:        number
}

export const paymentsApi = {
  createMpQR(body: CreateSaleBody): Promise<MpQRResponse> {
    return http.post<MpQRResponse>('/payments/mp/qr', body).then(r => r.data)
  },

  cancelMpQR(saleId: string): Promise<void> {
    return http.delete(`/payments/mp/qr/${saleId}`).then(() => undefined)
  },
}
