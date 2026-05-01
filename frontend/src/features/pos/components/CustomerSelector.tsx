import { useState, useRef, useEffect, useCallback } from 'react'
import { User, X, ChevronDown, Loader2, WifiOff } from 'lucide-react'
import { customersApi } from '@/features/customers/api/customers.api'
import type { CustomerResponse } from '@/shared/types'

interface Props {
  value:     CustomerResponse | null
  onSelect:  (c: CustomerResponse | null) => void
  disabled?: boolean
  isOnline?: boolean
}

export function CustomerSelector({ value, onSelect, disabled, isOnline = true }: Props) {
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState<CustomerResponse[]>([])
  const [loading, setLoading] = useState(false)
  const [open,    setOpen]    = useState(false)
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const search = useCallback((q: string) => {
    setQuery(q)
    if (!q.trim()) {
      setResults([])
      setOpen(false)
      return
    }
    // Offline: mostrar el panel sin llamar al API
    if (!isOnline) {
      setResults([])
      setOpen(true)
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const data = await customersApi.list({ search: q.trim(), limit: 8 })
        setResults(data.items)
        setOpen(true)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)
  }, [isOnline])

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [])

  function handleSelect(c: CustomerResponse) {
    onSelect(c)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  function handleClear() {
    onSelect(null)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  // ── Cliente seleccionado ──────────────────────────────────────

  if (value) {
    return (
      <div className="flex items-center justify-between px-3 py-2 rounded-lg
                      border border-brand-500/40 bg-brand-500/5 text-sm min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <User size={13} className="text-brand-500 shrink-0" />
          <span className="text-content font-medium truncate">{value.name}</span>
          {value.email && (
            <span className="text-content-muted text-xs truncate hidden lg:inline">
              {value.email}
            </span>
          )}
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={handleClear}
            title="Quitar cliente"
            className="text-content-subtle hover:text-content-muted transition-colors shrink-0 ml-2"
          >
            <X size={13} />
          </button>
        )}
      </div>
    )
  }

  // ── Buscador ──────────────────────────────────────────────────

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <User size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2
                                   text-content-subtle pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={e => search(e.target.value)}
          onFocus={() => { if (results.length > 0) setOpen(true) }}
          placeholder="Cliente (opcional)"
          disabled={disabled}
          className="w-full h-9 pl-8 pr-8 text-sm rounded-lg border border-edge
                     bg-surface text-content placeholder:text-content-subtle
                     focus:outline-none focus:ring-2 focus:ring-brand-500
                     disabled:opacity-50 transition-colors"
        />
        {loading
          ? <Loader2 size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2
                                          text-content-subtle animate-spin" />
          : !isOnline
            ? <WifiOff size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2
                                            text-amber-500 dark:text-amber-400 pointer-events-none" />
            : <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2
                                                text-content-subtle pointer-events-none" />
        }
      </div>

      {/* Resultados online */}
      {open && isOnline && results.length > 0 && (
        <ul className="absolute z-30 w-full mt-1 rounded-lg border border-edge
                       bg-surface shadow-lg overflow-hidden">
          {results.map(c => (
            <li key={c.id}>
              <button
                type="button"
                onMouseDown={e => { e.preventDefault(); handleSelect(c) }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left
                           hover:bg-surface-2 transition-colors"
              >
                <User size={13} className="text-content-subtle shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-content font-medium truncate">{c.name}</p>
                  {(c.email || c.phone) && (
                    <p className="text-xs text-content-muted truncate">
                      {c.email ?? c.phone}
                    </p>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Sin resultados online */}
      {open && isOnline && !loading && query.trim() !== '' && results.length === 0 && (
        <div className="absolute z-30 w-full mt-1 rounded-lg border border-edge
                        bg-surface shadow-lg px-3 py-3 text-xs text-content-muted">
          Sin resultados para "{query}"
        </div>
      )}

      {/* Sin conexión */}
      {open && !isOnline && query.trim() !== '' && (
        <div className="absolute z-30 w-full mt-1 rounded-lg
                        border border-amber-200 dark:border-amber-800
                        bg-amber-50 dark:bg-amber-950/40
                        shadow-lg px-3 py-3 flex items-center gap-2">
          <WifiOff size={13} className="text-amber-500 dark:text-amber-400 shrink-0" />
          <span className="text-xs text-amber-700 dark:text-amber-300">
            Sin conexión — búsqueda no disponible
          </span>
        </div>
      )}
    </div>
  )
}
