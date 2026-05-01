import { useState, useCallback } from 'react'
import { ClipboardCheck, X, Printer } from 'lucide-react'
import { useSalesStore, useDailySummary } from '@/features/sales/store/sales.store'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { todayISO } from '@/shared/utils/date'
import type { DailySummary } from '@/shared/types'

// ── Configuración de métodos de pago ──────────────────────────────

const METHODS: Array<{
  key:    keyof Pick<DailySummary, 'cash' | 'card' | 'mp' | 'transfer'>
  label:  string
}> = [
  { key: 'cash',     label: 'Efectivo'      },
  { key: 'card',     label: 'Tarjeta'       },
  { key: 'mp',       label: 'Mercado Pago'  },
  { key: 'transfer', label: 'Transferencia' },
]

// ── Componente principal ──────────────────────────────────────────

export function ShiftCloseButton() {
  const [open,       setOpen]       = useState(false)
  const [fetching,   setFetching]   = useState(false)
  const [actualCash, setActualCash] = useState('')

  const fetchSummary = useSalesStore(s => s.fetchSummary)
  const { branchId, hasMinRole } = useAuth()
  const today        = todayISO()
  const summary      = useDailySummary(branchId ?? '', today)

  // Solo manager+ puede ver el cierre de turno (datos financieros del día)
  if (!hasMinRole('manager')) return null

  const handleOpen = useCallback(async () => {
    setOpen(true)
    setActualCash('')
    if (!branchId || summary) return   // ya cacheado
    setFetching(true)
    try {
      await fetchSummary(branchId, today)
    } finally {
      setFetching(false)
    }
  }, [branchId, summary, fetchSummary, today])

  function handleClose() {
    setOpen(false)
    setActualCash('')
  }

  // ── Cálculos de arqueo ────────────────────────────────────────

  const cashExpected = summary?.cash ?? 0
  const cashActual   = parseFloat(actualCash.replace(',', '.')) || 0
  const cashDiff     = cashActual - cashExpected
  const hasDiff      = actualCash.trim() !== ''

  const printedAt = new Intl.DateTimeFormat('es', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date())

  return (
    <>
      {/* ── Botón disparador ─────────────────────────────────── */}
      <button
        type="button"
        onClick={handleOpen}
        title="Cierre de turno"
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg
                   text-xs font-medium text-content-muted
                   hover:text-content hover:bg-surface-2
                   transition-colors"
      >
        <ClipboardCheck size={14} />
        <span className="hidden md:inline">Cierre</span>
      </button>

      {/* ── Modal ────────────────────────────────────────────── */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center
                     bg-black/60 backdrop-blur-sm px-4"
          onClick={e => { if (e.target === e.currentTarget) handleClose() }}
        >
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl
                          w-full max-w-md border border-gray-200 dark:border-gray-700">

            {/* ════ Área imprimible (#shift-close-print) ════ */}
            <div id="shift-close-print">

              {/* Cabecera */}
              <div className="flex items-start justify-between px-6 pt-5 pb-4
                              border-b border-gray-100 dark:border-gray-800">
                <div>
                  <div className="flex items-center gap-2">
                    <ClipboardCheck size={16} className="text-brand-600 dark:text-brand-400 shrink-0" />
                    <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
                      Cierre de Turno
                    </h2>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 capitalize">
                    {printedAt}
                  </p>
                </div>
                <button
                  type="button"
                  data-noprint
                  onClick={handleClose}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300
                             transition-colors mt-0.5 shrink-0"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Loading */}
              {fetching && !summary && (
                <div className="px-6 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
                  Cargando resumen…
                </div>
              )}

              {!fetching && !summary && !open && null}

              {/* ── Contenido (solo si hay summary) ─────────── */}
              {summary && (
                <>
                  {/* KPIs del día */}
                  <div className="grid grid-cols-3 divide-x divide-gray-100 dark:divide-gray-800
                                  border-b border-gray-100 dark:border-gray-800">
                    <KPICell label="Ventas"       value={String(summary.total_sales)} />
                    <KPICell label="Total del día" value={`$${summary.total_revenue.toFixed(2)}`} accent />
                    <KPICell label="Ticket prom." value={`$${summary.avg_ticket.toFixed(2)}`} />
                  </div>

                  {/* Desglose por método */}
                  <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-widest
                                  text-gray-400 dark:text-gray-500">
                      Desglose por método
                    </p>

                    {METHODS.map(({ key, label }) => {
                      const value = summary[key] as number
                      if (value === 0) return null
                      const pct = summary.total_revenue > 0
                        ? ((value / summary.total_revenue) * 100).toFixed(0)
                        : '0'

                      return (
                        <div key={key} className="flex items-center justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">{label}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums w-8 text-right">
                              {pct}%
                            </span>
                            <span className="font-medium tabular-nums text-gray-900 dark:text-gray-100 w-28 text-right">
                              ${value.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      )
                    })}

                    {/* Fila total */}
                    <div className="flex items-center justify-between text-sm pt-2
                                    border-t border-gray-200 dark:border-gray-700">
                      <span className="font-semibold text-gray-900 dark:text-gray-100">Total</span>
                      <span className="font-bold tabular-nums text-gray-900 dark:text-gray-100 w-28 text-right">
                        ${summary.total_revenue.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Arqueo de caja */}
                  <div className="px-6 py-4 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-widest
                                  text-gray-400 dark:text-gray-500">
                      Arqueo de caja
                    </p>

                    {/* Efectivo esperado */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Efectivo esperado</span>
                      <span className="font-medium tabular-nums text-gray-900 dark:text-gray-100">
                        ${cashExpected.toFixed(2)}
                      </span>
                    </div>

                    {/* Input: efectivo contado */}
                    <div className="flex items-center justify-between text-sm">
                      <label
                        htmlFor="shift-actual-cash"
                        className="text-gray-600 dark:text-gray-400"
                      >
                        Efectivo contado
                      </label>
                      {/* Input → visible en pantalla y en impresión (muestra el valor ingresado) */}
                      <input
                        id="shift-actual-cash"
                        type="number"
                        min="0"
                        step="0.01"
                        value={actualCash}
                        onChange={e => setActualCash(e.target.value)}
                        placeholder="0.00"
                        className="w-32 h-8 px-2 text-right text-sm tabular-nums rounded-lg
                                   border border-gray-300 dark:border-gray-600
                                   bg-white dark:bg-gray-800
                                   text-gray-900 dark:text-gray-100
                                   focus:outline-none focus:ring-2 focus:ring-brand-500
                                   transition-colors"
                      />
                    </div>

                    {/* Diferencia */}
                    {hasDiff && (
                      <div className="flex items-center justify-between text-sm
                                      pt-3 border-t border-gray-100 dark:border-gray-800">
                        <span className="font-semibold text-gray-800 dark:text-gray-200">
                          Diferencia
                        </span>
                        <span className={[
                          'font-bold text-base tabular-nums',
                          cashDiff === 0
                            ? 'text-green-600 dark:text-green-400'
                            : cashDiff > 0
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-red-600 dark:text-red-400',
                        ].join(' ')}>
                          {cashDiff > 0 ? '+' : ''}${cashDiff.toFixed(2)}
                          {cashDiff === 0 && (
                            <span className="ml-1 text-xs font-normal">✓ cuadra</span>
                          )}
                          {cashDiff > 0 && (
                            <span className="ml-1 text-xs font-normal text-blue-500">sobrante</span>
                          )}
                          {cashDiff < 0 && (
                            <span className="ml-1 text-xs font-normal text-red-500">faltante</span>
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                </>
              )}

            </div>
            {/* ════ Fin área imprimible ════ */}

            {/* Botones de acción — FUERA del área imprimible */}
            <div className="flex gap-3 px-6 pb-5 pt-2
                            border-t border-gray-100 dark:border-gray-800">
              {summary && (
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center justify-center gap-2 flex-1
                             border border-gray-300 dark:border-gray-600
                             text-gray-700 dark:text-gray-300 text-sm font-medium
                             py-2.5 rounded-xl
                             hover:bg-gray-50 dark:hover:bg-gray-800
                             transition-colors"
                >
                  <Printer size={14} />
                  Imprimir
                </button>
              )}
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 bg-brand-600 hover:bg-brand-700 text-white
                           text-sm font-medium py-2.5 rounded-xl transition-colors"
              >
                Cerrar
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  )
}

// ── KPICell ───────────────────────────────────────────────────────

function KPICell({
  label, value, accent = false,
}: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="px-4 py-4 text-center">
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">{label}</p>
      <p className={[
        'font-bold tabular-nums',
        accent
          ? 'text-lg text-gray-900 dark:text-gray-100'
          : 'text-sm text-gray-700 dark:text-gray-300',
      ].join(' ')}>
        {value}
      </p>
    </div>
  )
}
