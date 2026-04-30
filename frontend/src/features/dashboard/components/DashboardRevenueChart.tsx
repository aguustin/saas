import { useState } from 'react'
import { Skeleton } from '@/shared/components/ui/Skeleton'
import type { DayRevenue } from '../hooks/useDashboard30Days'

interface Props {
  data:    DayRevenue[]
  loading: boolean
}

const W   = 640
const H   = 220
const PAD = { top: 12, right: 10, bottom: 36, left: 52 }
const CW  = W - PAD.left - PAD.right   // 578
const CH  = H - PAD.top  - PAD.bottom  // 172

function shortDate(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

function niceMax(max: number): number {
  if (max === 0) return 100
  const mag  = Math.pow(10, Math.floor(Math.log10(max)))
  const norm = max / mag
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10
  return nice * mag
}

export function DashboardRevenueChart({ data, loading }: Props) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
        <Skeleton height={14} width="45%" rounded="md" />
        <div className="mt-4">
          <Skeleton height={172} width="100%" rounded="lg" />
        </div>
      </div>
    )
  }

  const maxRaw = Math.max(...data.map(d => d.revenue), 0)
  const maxVal = niceMax(maxRaw)
  const slotW  = CW / data.length
  const barW   = slotW * 0.72

  const GRID = [0.25, 0.5, 0.75, 1.0]

  const hovered = hoveredIdx !== null ? data[hoveredIdx] : null

  return (
    <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Ingresos diarios — últimos 30 días
      </h3>

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-auto"
        >
          {/* Y gridlines + labels */}
          {GRID.map(frac => {
            const y     = PAD.top + CH * (1 - frac)
            const label = frac * maxVal
            return (
              <g key={frac}>
                <line
                  x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
                  stroke="currentColor" strokeOpacity={0.08} strokeWidth={1}
                />
                <text
                  x={PAD.left - 6} y={y + 4}
                  textAnchor="end" fontSize={9}
                  fill="currentColor" fillOpacity={0.45}
                >
                  {label >= 1000 ? `${(label / 1000).toFixed(0)}k` : label.toFixed(0)}
                </text>
              </g>
            )
          })}

          {/* X baseline */}
          <line
            x1={PAD.left} y1={PAD.top + CH}
            x2={W - PAD.right} y2={PAD.top + CH}
            stroke="currentColor" strokeOpacity={0.1} strokeWidth={1}
          />

          {/* Bars */}
          {data.map((day, i) => {
            const barH = maxVal > 0 ? (day.revenue / maxVal) * CH : 0
            const x    = PAD.left + i * slotW + (slotW - barW) / 2
            const y    = PAD.top  + CH - barH
            const hov  = hoveredIdx === i

            return (
              <g
                key={day.date}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {/* Full-height hit area */}
                <rect
                  x={x} y={PAD.top}
                  width={barW} height={CH}
                  fill="transparent"
                />
                {/* Bar */}
                {day.revenue > 0 && (
                  <rect
                    x={x} y={y}
                    width={barW} height={Math.max(barH, 0)}
                    rx={2}
                    fill={hov ? '#0369a1' : '#0284c7'}
                    style={{ transition: 'fill 0.1s' }}
                  />
                )}
                {/* Zero tick */}
                {day.revenue === 0 && (
                  <rect
                    x={x} y={PAD.top + CH - 2}
                    width={barW} height={2}
                    rx={1}
                    fill="currentColor" fillOpacity={0.1}
                  />
                )}
                {/* X label every 7 days */}
                {i % 7 === 0 && (
                  <text
                    x={x + barW / 2} y={H - 8}
                    textAnchor="middle" fontSize={9}
                    fill="currentColor" fillOpacity={0.45}
                  >
                    {shortDate(day.date)}
                  </text>
                )}
              </g>
            )
          })}

          {/* Tooltip — rendered above bars to avoid hover flicker */}
          {hovered && hovered.revenue > 0 && hoveredIdx !== null && (() => {
            const i    = hoveredIdx
            const barH = maxVal > 0 ? (hovered.revenue / maxVal) * CH : 0
            const cx   = PAD.left + i * slotW + slotW / 2
            const ty   = PAD.top + CH - barH - 8
            const tipX = Math.max(PAD.left + 38, Math.min(cx, W - PAD.right - 38))
            const text = `${shortDate(hovered.date)}  $${hovered.revenue.toFixed(0)}`
            return (
              <g style={{ pointerEvents: 'none' }}>
                <rect
                  x={tipX - 38} y={ty - 18}
                  width={76} height={18}
                  rx={4} fill="#1e293b"
                />
                <text
                  x={tipX} y={ty - 5}
                  textAnchor="middle" fontSize={9}
                  fill="white"
                >
                  {text}
                </text>
              </g>
            )
          })()}
        </svg>

        {maxRaw === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-gray-400 dark:text-gray-500">Sin ventas en este período</p>
          </div>
        )}
      </div>
    </div>
  )
}
