import { useCallback, useEffect, useState } from 'react'
import { LayoutList, ArrowLeftRight, AlertTriangle } from 'lucide-react'
import { useStock } from '@/features/stock/hooks/useStock'
import { useStockStore } from '@/features/stock/store/stock.store'
import { useToastStore } from '@/shared/components/ui/Toast'
import { StockFiltersBar }     from '@/features/stock/components/StockFiltersBar'
import { StockTable }          from '@/features/stock/components/StockTable'
import { StockMovementsPanel } from '@/features/stock/components/StockMovementsPanel'
import { StockAlertsPanel }    from '@/features/stock/components/StockAlertsPanel'
import { MovementForm }        from '@/features/stock/components/MovementForm'
import type { StockRow, StockMovementRow } from '@/shared/types'

// ── Tabs ──────────────────────────────────────────────────────────

type Tab = 'stock' | 'movements' | 'alerts'

interface TabItem {
  id:    Tab
  label: string
  icon:  React.ElementType
}

const TABS: TabItem[] = [
  { id: 'stock',     label: 'Inventario',  icon: LayoutList    },
  { id: 'movements', label: 'Movimientos', icon: ArrowLeftRight },
  { id: 'alerts',    label: 'Alertas',     icon: AlertTriangle  },
]

// ── Page ──────────────────────────────────────────────────────────

export function StockPage() {
  const [tab, setTab] = useState<Tab>('stock')

  const {
    items, total, loading,
    search, setSearch,
    isLow, changeIsLow,
    sortBy, sortDir, changeSort,
    offset, limit, onOffsetChange,
    alertCount, refresh,
  } = useStock()

  const fetchAlerts  = useStockStore(s => s.fetchAlerts)
  const alertsLoaded = useStockStore(s => s.alertsLoaded)
  const addToast     = useToastStore(s => s.add)

  // Cargar alertas al montar (una sola vez)
  useEffect(() => {
    if (!alertsLoaded) void fetchAlerts()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Movement form state ───────────────────────────────────────

  const [movFormOpen,         setMovFormOpen]         = useState(false)
  const [movPrefillStockId,   setMovPrefillStockId]   = useState<string | null>(null)
  const [movPrefillProductId, setMovPrefillProductId] = useState<string | null>(null)
  const [movPrefillName,      setMovPrefillName]      = useState<string | null>(null)

  const openMovementFromRow = useCallback((row: StockRow) => {
    setMovPrefillStockId(row.stock_id)
    setMovPrefillProductId(row.product_id)
    setMovPrefillName(row.product_name)
    setMovFormOpen(true)
  }, [])

  const openMovementFromAlert = useCallback((productId: string, productName: string) => {
    setMovPrefillStockId(null)
    setMovPrefillProductId(productId)
    setMovPrefillName(productName)
    setMovFormOpen(true)
    setTab('stock')
  }, [])

  const openMovementBlank = useCallback(() => {
    setMovPrefillStockId(null)
    setMovPrefillProductId(null)
    setMovPrefillName(null)
    setMovFormOpen(true)
  }, [])

  const handleMovementClose = useCallback(() => setMovFormOpen(false), [])

  function handleMovementSuccess(_mv: StockMovementRow) {
    setMovFormOpen(false)
    addToast({ type: 'success', title: 'Movimiento registrado', description: 'El stock fue actualizado.' })
    refresh()
  }

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-5 max-w-[1600px] mx-auto">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Stock</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Inventario, movimientos y alertas de stock
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {TABS.map(t => {
          const Icon   = t.icon
          const active = tab === t.id
          const badge  = t.id === 'alerts' && alertCount > 0 ? alertCount : null

          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={[
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
                active
                  ? 'border-brand-600 text-brand-600 dark:text-brand-400 dark:border-brand-400'
                  : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200',
              ].join(' ')}
            >
              <Icon size={15} />
              {t.label}
              {badge != null && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1
                                 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Tab: Inventario */}
      {tab === 'stock' && (
        <>
          <StockFiltersBar
            search={search}       onSearch={setSearch}
            isLow={isLow}         onIsLow={changeIsLow}
            sortBy={sortBy}       sortDir={sortDir}  onChangeSort={changeSort}
            total={total}
            alertCount={alertCount}
            onNewMovement={openMovementBlank}
          />
          <StockTable
            items={items}
            loading={loading}
            total={total}
            limit={limit}
            offset={offset}
            onOffsetChange={onOffsetChange}
            onMovement={openMovementFromRow}
          />
        </>
      )}

      {/* Tab: Movimientos */}
      {tab === 'movements' && (
        <StockMovementsPanel />
      )}

      {/* Tab: Alertas */}
      {tab === 'alerts' && (
        <StockAlertsPanel onMovement={openMovementFromAlert} />
      )}

      {/* Modal movimiento */}
      <MovementForm
        open={movFormOpen}
        onClose={handleMovementClose}
        onSuccess={handleMovementSuccess}
        prefillStockId={movPrefillStockId}
        prefillProductId={movPrefillProductId}
        prefillProductName={movPrefillName}
      />
    </div>
  )
}
