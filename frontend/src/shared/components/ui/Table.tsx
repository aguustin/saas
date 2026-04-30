import { type ReactNode } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { SkeletonRow } from './Skeleton'

export type SortDir = 'asc' | 'desc'

export interface Column<T> {
  key:       string
  header:    string
  render?:   (row: T) => ReactNode
  sortable?: boolean
  align?:    'left' | 'center' | 'right'
  width?:    string
  className?: string
}

interface TableProps<T extends Record<string, unknown>> {
  columns:       Column<T>[]
  data:          T[]
  rowKey:        (row: T) => string
  loading?:      boolean
  skeletonRows?: number
  emptyMessage?: string
  emptyIcon?:    ReactNode
  sortKey?:      string
  sortDir?:      SortDir
  onSort?:       (key: string, dir: SortDir) => void
  onRowClick?:   (row: T) => void
  className?:    string
}

const ALIGN: Record<NonNullable<Column<never>['align']>, string> = {
  left:   'text-left',
  center: 'text-center',
  right:  'text-right',
}

function SortIcon({
  col,
  sortKey,
  sortDir,
}: {
  col:     string
  sortKey?: string
  sortDir?: SortDir
}) {
  if (col !== sortKey) {
    return <ChevronsUpDown size={13} className="opacity-40" />
  }
  return sortDir === 'asc'
    ? <ChevronUp  size={13} className="text-brand-500" />
    : <ChevronDown size={13} className="text-brand-500" />
}

export function Table<T extends Record<string, unknown>>({
  columns,
  data,
  rowKey,
  loading      = false,
  skeletonRows = 5,
  emptyMessage = 'Sin resultados',
  emptyIcon,
  sortKey,
  sortDir,
  onSort,
  onRowClick,
  className = '',
}: TableProps<T>) {
  function handleSort(col: Column<T>) {
    if (!col.sortable || !onSort) return
    const nextDir: SortDir =
      col.key === sortKey && sortDir === 'asc' ? 'desc' : 'asc'
    onSort(col.key, nextDir)
  }

  return (
    <div
      className={[
        'w-full overflow-x-auto rounded-xl border border-edge',
        className,
      ].join(' ')}
    >
      <table className="w-full text-sm">
        {/* HEAD */}
        <thead>
          <tr className="border-b border-edge">
            {columns.map(col => (
              <th
                key={col.key}
                style={col.width ? { width: col.width } : undefined}
                onClick={() => handleSort(col)}
                className={[
                  'px-4 py-3 font-medium text-content-muted',
                  'bg-surface-2',
                  'first:rounded-tl-xl last:rounded-tr-xl',
                  ALIGN[col.align ?? 'left'],
                  col.sortable ? 'cursor-pointer select-none hover:text-content' : '',
                  col.className ?? '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <span className="inline-flex items-center gap-1">
                  {col.header}
                  {col.sortable && (
                    <SortIcon col={col.key} sortKey={sortKey} sortDir={sortDir} />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>

        {/* BODY */}
        <tbody className="divide-y divide-surface-2">
          {loading ? (
            Array.from({ length: skeletonRows }).map((_, i) => (
              <SkeletonRow key={i} cols={columns.length} />
            ))
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>
                <div className="flex flex-col items-center justify-center py-14 text-content-subtle gap-2">
                  {emptyIcon}
                  <p className="text-sm">{emptyMessage}</p>
                </div>
              </td>
            </tr>
          ) : (
            data.map(row => (
              <tr
                key={rowKey(row)}
                onClick={() => onRowClick?.(row)}
                className={[
                  'bg-surface',
                  'hover:bg-surface-2',
                  'transition-colors',
                  onRowClick ? 'cursor-pointer' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {columns.map(col => (
                  <td
                    key={col.key}
                    className={[
                      'px-4 py-3 text-content',
                      ALIGN[col.align ?? 'left'],
                      col.className ?? '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {col.render
                      ? col.render(row)
                      : String(row[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

// ── Paginación companion ────────────────────────────────────────

interface PaginationProps {
  total:    number
  limit:    number
  offset:   number
  onChange: (offset: number) => void
}

export function Pagination({ total, limit, offset, onChange }: PaginationProps) {
  const currentPage = Math.floor(offset / limit) + 1
  const totalPages  = Math.max(1, Math.ceil(total / limit))
  const from        = total === 0 ? 0 : offset + 1
  const to          = Math.min(offset + limit, total)

  return (
    <div className="flex items-center justify-between px-1 pt-3 text-sm text-content-muted">
      <span>
        {total === 0
          ? 'Sin resultados'
          : `${from}–${to} de ${total}`}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(offset - limit)}
          disabled={offset === 0}
          className="px-2.5 py-1.5 rounded-lg border border-edge
                     disabled:opacity-40 hover:bg-surface-2
                     transition-colors disabled:pointer-events-none"
        >
          ‹
        </button>
        <span className="px-3 py-1.5 text-content-2">
          {currentPage} / {totalPages}
        </span>
        <button
          onClick={() => onChange(offset + limit)}
          disabled={offset + limit >= total}
          className="px-2.5 py-1.5 rounded-lg border border-edge
                     disabled:opacity-40 hover:bg-surface-2
                     transition-colors disabled:pointer-events-none"
        >
          ›
        </button>
      </div>
    </div>
  )
}
