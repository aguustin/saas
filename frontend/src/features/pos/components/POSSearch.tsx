import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { Search, Loader2, WifiOff } from 'lucide-react'
import type { ProductResponse } from '@/shared/types'
import { POSProductCard } from './POSProductCard'

interface Props {
  query:         string
  results:       ProductResponse[]
  loading:       boolean
  isOffline:     boolean
  onChange:      (q: string) => void
  onSelect:      (product: ProductResponse) => void
  inputRef?:     RefObject<HTMLInputElement>
}

export function POSSearch({ query, results, loading, isOffline, onChange, onSelect, inputRef }: Props) {
  const internalRef  = useRef<HTMLInputElement>(null)
  const ref          = inputRef ?? internalRef
  const listRef      = useRef<HTMLDivElement>(null)
  const selectedIdx  = useRef(-1)

  function setSelectedIdx(idx: number) { selectedIdx.current = idx }

  useEffect(() => { ref.current?.focus() }, [])

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!results.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const next = Math.min(selectedIdx.current + 1, results.length - 1)
      setSelectedIdx(next); highlightItem(next)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const prev = Math.max(selectedIdx.current - 1, 0)
      setSelectedIdx(prev); highlightItem(prev)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const idx = selectedIdx.current >= 0 ? selectedIdx.current : 0
      if (results[idx]) { setSelectedIdx(-1); onSelect(results[idx]) }
    } else if (e.key === 'Escape') {
      onChange(''); setSelectedIdx(-1)
    }
  }

  function highlightItem(idx: number) {
    const list = listRef.current
    if (!list) return
    const items = list.querySelectorAll('[data-pos-result]')
    items.forEach((el, i) => el.setAttribute('data-highlighted', i === idx ? 'true' : 'false'))
    items[idx]?.scrollIntoView({ block: 'nearest' })
  }

  function handleItemSelect(product: ProductResponse) {
    setSelectedIdx(-1); onSelect(product); ref.current?.focus()
  }

  return (
    <div className="relative">
      {/* Input */}
      <div className="flex items-center gap-2 bg-surface-2 border border-edge rounded-xl px-4 py-3
                      focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500/30
                      transition-colors">
        {loading
          ? <Loader2 size={20} className="text-content-subtle shrink-0 animate-spin" />
          : <Search size={20} className="text-content-subtle shrink-0" />
        }
        <input
          ref={ref}
          type="text"
          value={query}
          onChange={e => { setSelectedIdx(-1); onChange(e.target.value) }}
          onKeyDown={handleKeyDown}
          placeholder="Buscar producto o escanear código de barras…"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className="flex-1 bg-transparent text-content placeholder-content-subtle text-sm outline-none"
        />
        {isOffline && (
          <span className="flex items-center gap-1 text-xs text-amber-500 shrink-0">
            <WifiOff size={13} />
            sin conexión
          </span>
        )}
      </div>

      {/* Resultados */}
      {results.length > 0 && (
        <div
          ref={listRef}
          className="absolute top-full left-0 right-0 mt-1 bg-surface border border-edge
                     rounded-xl shadow-2xl overflow-hidden z-50 max-h-80 overflow-y-auto"
        >
          {results.map((product, idx) => (
            <POSProductCard
              key={product.id}
              product={product}
              onSelect={handleItemSelect}
              data-pos-result="true"
              data-highlighted={String(idx === selectedIdx.current)}
            />
          ))}
        </div>
      )}

      {/* Sin resultados */}
      {!loading && query.trim() && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-edge
                        rounded-xl shadow-2xl z-50 px-4 py-6 text-center">
          <p className="text-sm text-content-muted">
            No se encontraron productos para <span className="text-content">"{query}"</span>
          </p>
        </div>
      )}
    </div>
  )
}
