const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })

const DIVISIONS: Array<{ amount: number; unit: Intl.RelativeTimeFormatUnit }> = [
  { amount: 60,          unit: 'seconds' },
  { amount: 3_600,       unit: 'minutes' },
  { amount: 86_400,      unit: 'hours'   },
  { amount: 86_400 * 7,  unit: 'days'    },
  { amount: 86_400 * 30, unit: 'weeks'   },
  { amount: 86_400 * 365,unit: 'months'  },
  { amount: Infinity,    unit: 'years'   },
]

/** "hace 5 minutos", "ayer", "hace 3 días" */
export function formatRelative(isoDate: string): string {
  const date    = new Date(isoDate)
  const seconds = (date.getTime() - Date.now()) / 1_000

  for (const div of DIVISIONS) {
    if (Math.abs(seconds) < div.amount) {
      const prev = DIVISIONS[DIVISIONS.indexOf(div) - 1]
      const unit = prev?.unit ?? 'seconds'
      const divisor = prev?.amount ?? 1
      return rtf.format(Math.round(seconds / divisor), unit)
    }
  }
  return formatDate(isoDate)
}

/** "20/04/2026 15:30" */
export function formatDate(isoDate: string): string {
  return new Intl.DateTimeFormat('es', {
    day:    '2-digit',
    month:  '2-digit',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  }).format(new Date(isoDate))
}

/** "20/04/2026" */
export function formatDateShort(isoDate: string): string {
  return new Intl.DateTimeFormat('es', {
    day:   '2-digit',
    month: '2-digit',
    year:  'numeric',
  }).format(new Date(isoDate))
}

/** Hoy en formato YYYY-MM-DD local (para input[type=date] y filtros) */
export function todayISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Convierte "YYYY-MM-DD" al inicio del día en hora local → ISO UTC.
 * Ej. "2026-04-21" en UTC-3 → "2026-04-21T03:00:00.000Z"
 * Necesario porque z.string().datetime() rechaza strings de solo fecha.
 */
export function localDayStart(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toISOString()
}

/**
 * Convierte "YYYY-MM-DD" al fin del día en hora local → ISO UTC.
 * Ej. "2026-04-21" en UTC-3 → "2026-04-22T02:59:59.999Z"
 * Garantiza que el rango incluye toda la jornada local.
 */
export function localDayEnd(dateStr: string): string {
  return new Date(`${dateStr}T23:59:59.999`).toISOString()
}
