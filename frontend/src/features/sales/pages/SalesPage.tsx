import { useCallback, useState } from 'react'
import { useSales } from '@/features/sales/hooks/useSales'
import { SaleFiltersBar } from '@/features/sales/components/SaleFiltersBar'
import { SaleSummaryCards } from '@/features/sales/components/SaleSummaryCards'
import { SaleTable } from '@/features/sales/components/SaleTable'
import { SaleDetailPanel } from '@/features/sales/components/SaleDetailPanel'
import { useToast } from '@/shared/components/ui/Toast'
import type { SaleResponse } from '@/shared/types'

export function SalesPage() {
  const { success } = useToast()

  const {
    items, total, loading,
    dateFrom, dateTo, saleStatus,
    changeDateFrom, changeDateTo, changeStatus,
    setRangeToday, setRangeLast7, setRangeThisMonth,
    page, pageCount, pageSize, goToPage,
    summary, summaryDate,
    refresh,
  } = useSales()

  const [selectedSale, setSelectedSale] = useState<SaleResponse | null>(null)

  const handleViewDetail = useCallback((sale: SaleResponse) => setSelectedSale(sale), [])
  const handleCloseDetail = useCallback(() => setSelectedSale(null), [])

  function handleRefundSuccess(message: string) {
    success(message)
    setSelectedSale(null)
    refresh()
  }

  return (
    <div className="p-6 space-y-5 max-w-screen-xl mx-auto">

      {/* Encabezado */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Ventas</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {total > 0
            ? `${total} venta${total !== 1 ? 's' : ''} en el período seleccionado`
            : 'Historial de transacciones'
          }
        </p>
      </div>

      {/* KPIs del día (solo cuando el rango apunta a un único día) */}
      {summaryDate && (
        <SaleSummaryCards
          summary={summary}
          loading={loading}
          date={summaryDate}
        />
      )}

      {/* Filtros */}
      <SaleFiltersBar
        dateFrom={dateFrom}
        dateTo={dateTo}
        saleStatus={saleStatus}
        loading={loading}
        onDateFrom={changeDateFrom}
        onDateTo={changeDateTo}
        onStatus={changeStatus}
        onRangeToday={setRangeToday}
        onRangeLast7={setRangeLast7}
        onRangeThisMonth={setRangeThisMonth}
        onRefresh={refresh}
      />

      {/* Tabla */}
      <SaleTable
        items={items}
        total={total}
        page={page}
        pageCount={pageCount}
        pageSize={pageSize}
        loading={loading}
        onViewDetail={handleViewDetail}
        onPageChange={goToPage}
      />

      {/* Panel lateral de detalle + reembolso */}
      <SaleDetailPanel
        saleId={selectedSale?.id ?? null}
        onClose={handleCloseDetail}
        onRefund={handleRefundSuccess}
      />
    </div>
  )
}
