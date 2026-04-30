import { Injectable, Logger } from '@nestjs/common'
import { ConfigService }       from '@nestjs/config'
import { MercadoPagoService }  from '@modules/billing/providers/mercadopago.service'
import { SalesService }        from '@modules/sales/sales.service'
import type { CreateSaleDto }  from '@modules/sales/dto/sale.dto'

export interface MpQRResult {
  sale_id:        string
  qr_data:        string
  preference_id:  string
  amount:         number
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name)

  constructor(
    private readonly mp:     MercadoPagoService,
    private readonly sales:  SalesService,
    private readonly config: ConfigService,
  ) {}

  async createMpQR(params: {
    tenantId:  string
    cashierId: string
    dto:       CreateSaleDto
  }): Promise<MpQRResult> {
    // 1. Crear venta pendiente (reserva stock atómicamente)
    const sale = await this.sales.createPending(params.tenantId, params.cashierId, params.dto)

    // 2. Crear preferencia MP usando los datos ya calculados por el servicio
    const notificationUrl = this.config.get<string>('MP_WEBHOOK_URL') ?? ''
    const externalRef     = `SALE:${params.tenantId}:${sale.id}`

    try {
      const { initPoint, preferenceId } = await this.mp.createPreference({
        items: sale.items.map(i => ({
          title:      i.product_name,
          quantity:   i.quantity,
          unit_price: i.unit_price,
        })),
        externalReference: externalRef,
        notificationUrl,
      })

      this.logger.log({ saleId: sale.id, preferenceId }, 'MP QR preference created')

      return {
        sale_id:       sale.id,
        qr_data:       initPoint,
        preference_id: preferenceId,
        amount:        sale.total,
      }
    } catch (err) {
      // Si falla MP, cancelar la venta pendiente para liberar stock
      await this.sales.cancelPendingSale(params.tenantId, sale.id)
      throw err
    }
  }

  async cancelMpQR(tenantId: string, saleId: string): Promise<void> {
    await this.sales.cancelPendingSale(tenantId, saleId)
    this.logger.log({ tenantId, saleId }, 'MP QR payment cancelled by cashier')
  }
}
