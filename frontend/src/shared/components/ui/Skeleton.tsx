import type { CSSProperties } from 'react'

// ── Pulso base ────────────────────────────────────────────────────

interface SkeletonProps {
  width?:     string | number
  height?:    string | number
  rounded?:   'sm' | 'md' | 'lg' | 'full'
  className?: string
  style?:     CSSProperties
}

const ROUNDED = {
  sm:   'rounded',
  md:   'rounded-lg',
  lg:   'rounded-xl',
  full: 'rounded-full',
}

export function Skeleton({
  width,
  height,
  rounded   = 'md',
  className = '',
  style,
}: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={[
        'animate-pulse bg-gray-200 dark:bg-gray-700',
        ROUNDED[rounded],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        width:  width  !== undefined ? width  : undefined,
        height: height !== undefined ? height : undefined,
        ...style,
      }}
    />
  )
}

// ── Líneas de texto ───────────────────────────────────────────────

interface SkeletonTextProps {
  lines?:    number
  lastLineW?: string  // ancho de la última línea (ej. '60%')
}

export function SkeletonText({ lines = 3, lastLineW = '60%' }: SkeletonTextProps) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={14}
          width={i === lines - 1 && lines > 1 ? lastLineW : '100%'}
          rounded="sm"
        />
      ))}
    </div>
  )
}

// ── Fila de tabla (usada internamente por Table) ──────────────────

export function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr aria-hidden="true">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton height={14} width="80%" rounded="sm" />
        </td>
      ))}
    </tr>
  )
}

// ── Card skeleton ─────────────────────────────────────────────────

interface SkeletonCardProps {
  lines?:    number
  hasImage?: boolean
  className?: string
}

export function SkeletonCard({ lines = 3, hasImage = false, className = '' }: SkeletonCardProps) {
  return (
    <div
      aria-hidden="true"
      className={[
        'p-4 rounded-xl border border-gray-100 dark:border-gray-800 space-y-3',
        className,
      ].join(' ')}
    >
      {hasImage && (
        <Skeleton height={120} width="100%" rounded="lg" />
      )}
      <SkeletonText lines={lines} />
    </div>
  )
}

// ── Stat card skeleton (para el dashboard de ventas) ─────────────

export function SkeletonStatCard() {
  return (
    <div
      aria-hidden="true"
      className="p-5 rounded-xl border border-gray-100 dark:border-gray-800 space-y-2"
    >
      <Skeleton height={12} width="40%" rounded="sm" />
      <Skeleton height={28} width="55%" rounded="sm" />
      <Skeleton height={10} width="30%" rounded="sm" />
    </div>
  )
}

// ── Inline spinner ────────────────────────────────────────────────

import { Loader2 } from 'lucide-react'

interface SpinnerProps {
  size?:      number
  className?: string
}

export function Spinner({ size = 20, className = '' }: SpinnerProps) {
  return (
    <Loader2
      size={size}
      className={`animate-spin text-brand-600 dark:text-brand-400 ${className}`}
    />
  )
}

// ── Full page loader ──────────────────────────────────────────────

export function FullPageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <Spinner size={36} />
    </div>
  )
}

// ── Overlay loader (sobre un contenedor relativo) ────────────────

export function OverlayLoader() {
  return (
    <div
      aria-label="Cargando"
      className="absolute inset-0 z-10 flex items-center justify-center
                 bg-white/70 dark:bg-gray-900/70 rounded-xl backdrop-blur-sm"
    >
      <Spinner size={28} />
    </div>
  )
}
