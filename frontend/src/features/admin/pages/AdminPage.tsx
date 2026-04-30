import { useRef, useState } from 'react'
import { Download, Upload, AlertTriangle, CheckCircle2, Loader2, Database } from 'lucide-react'
import { productsApi } from '@/features/products/api/products.api'
import { employeesApi } from '@/features/employees/api/employees.api'
import { ConfirmModal } from '@/shared/components/ui/Modal'
import { useToast } from '@/shared/components/ui/Toast'
import type { ProductResponse } from '@/shared/types'
import type { EmployeeRow } from '@/shared/types'

// ── Tipos del archivo de backup ──────────────────────────────────

const BACKUP_VERSION = 1

interface BackupFile {
  version:     number
  exported_at: string
  products:    ProductResponse[]
  employees:   EmployeeRow[]
}

// ── Helpers ──────────────────────────────────────────────────────

async function fetchAll<T>(
  fn: (params: { limit: number; offset: number }) => Promise<{ items: T[]; total: number }>,
): Promise<T[]> {
  const first = await fn({ limit: 200, offset: 0 })
  const items = [...first.items]
  let offset  = 200
  while (items.length < first.total) {
    const page = await fn({ limit: 200, offset })
    items.push(...page.items)
    offset += 200
  }
  return items
}

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function isValidBackup(data: unknown): data is BackupFile {
  if (typeof data !== 'object' || data === null) return false
  const b = data as Record<string, unknown>
  return (
    typeof b.version === 'number' &&
    typeof b.exported_at === 'string' &&
    Array.isArray(b.products) &&
    Array.isArray(b.employees)
  )
}

// ── Componente ───────────────────────────────────────────────────

type Phase = 'idle' | 'loading' | 'done' | 'error'

interface RestoreResult {
  products:  { ok: number; skipped: number }
  employees: { ok: number; skipped: number }
}

export function AdminPage() {
  const { success, error: toastError } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Backup ────────────────────────────────────────────────────
  const [backupPhase, setBackupPhase] = useState<Phase>('idle')

  async function handleExport() {
    setBackupPhase('loading')
    try {
      const [products, employees] = await Promise.all([
        fetchAll((p) => productsApi.list(p) as Promise<{ items: ProductResponse[]; total: number }>),
        fetchAll((p) => employeesApi.list(p)),
      ])

      const backup: BackupFile = {
        version:     BACKUP_VERSION,
        exported_at: new Date().toISOString(),
        products,
        employees,
      }

      const date     = new Date().toISOString().slice(0, 10)
      downloadJson(backup, `backup-${date}.json`)
      setBackupPhase('done')
      success('Backup exportado', `${products.length} productos, ${employees.length} empleados`)
      setTimeout(() => setBackupPhase('idle'), 3000)
    } catch {
      setBackupPhase('error')
      toastError('Error al exportar el backup')
      setTimeout(() => setBackupPhase('idle'), 3000)
    }
  }

  // ── Restore ───────────────────────────────────────────────────
  const [pendingBackup,  setPendingBackup]  = useState<BackupFile | null>(null)
  const [restorePhase,   setRestorePhase]   = useState<Phase>('idle')
  const [restoreResult,  setRestoreResult]  = useState<RestoreResult | null>(null)
  const [confirmOpen,    setConfirmOpen]    = useState(false)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string)
        if (!isValidBackup(data)) {
          toastError('Archivo inválido', 'El archivo no es un backup válido de esta aplicación.')
          return
        }
        setPendingBackup(data)
        setConfirmOpen(true)
      } catch {
        toastError('Error al leer el archivo', 'El archivo no es un JSON válido.')
      }
    }
    reader.readAsText(file)
  }

  async function handleRestore() {
    if (!pendingBackup) return
    setConfirmOpen(false)
    setRestorePhase('loading')
    setRestoreResult(null)

    const result: RestoreResult = {
      products:  { ok: 0, skipped: 0 },
      employees: { ok: 0, skipped: 0 },
    }

    // Restaurar productos
    for (const p of pendingBackup.products) {
      try {
        await productsApi.create({
          name:        p.name,
          description: p.description ?? undefined,
          sku:         p.sku         ?? undefined,
          barcode:     p.barcode     ?? undefined,
          price:       p.price,
          cost:        p.cost        ?? undefined,
          tax_rate:    p.tax_rate    ?? undefined,
          unit:        p.unit,
          category_id: p.category_id ?? undefined,
          image_url:   p.image_url   ?? undefined,
          is_active:   p.is_active,
        })
        result.products.ok++
      } catch {
        result.products.skipped++
      }
    }

    // Restaurar empleados
    for (const emp of pendingBackup.employees) {
      try {
        await employeesApi.create({
          branch_id:  emp.branch_id,
          first_name: emp.first_name,
          last_name:  emp.last_name,
          dni:        emp.dni        ?? undefined,
          phone:      emp.phone      ?? undefined,
          email:      emp.email      ?? undefined,
          role:       emp.role,
          salary:     emp.salary     ?? undefined,
          hired_at:   emp.hired_at   ?? undefined,
          notes:      emp.notes      ?? undefined,
        })
        result.employees.ok++
      } catch {
        result.employees.skipped++
      }
    }

    setRestoreResult(result)
    setRestorePhase('done')
    setPendingBackup(null)

    const totalOk = result.products.ok + result.employees.ok
    const totalSkipped = result.products.skipped + result.employees.skipped
    if (totalOk > 0) {
      success('Restore completado', `${totalOk} registros restaurados, ${totalSkipped} omitidos por duplicados.`)
    } else {
      toastError('Restore sin cambios', 'Todos los registros ya existen o fallaron.')
    }
  }

  const exportedAt = pendingBackup
    ? new Date(pendingBackup.exported_at).toLocaleString('es-AR')
    : null

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">

      <div>
        <h1 className="text-xl font-bold text-content">Administración</h1>
        <p className="text-sm text-content-muted mt-0.5">Herramientas de backup y restauración de datos</p>
      </div>

      {/* Backup */}
      <Section
        icon={<Database size={20} className="text-brand-500" />}
        title="Exportar backup"
        description="Descargá un archivo JSON con todos tus productos y empleados. Podés usarlo para restaurar datos en caso de necesidad."
      >
        <ul className="text-sm text-content-muted space-y-1 mb-4 list-disc list-inside">
          <li>Productos (nombre, precio, SKU, etc.)</li>
          <li>Empleados (nombre, sucursal, rol, etc.)</li>
        </ul>

        <button
          onClick={handleExport}
          disabled={backupPhase === 'loading'}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                     bg-brand-600 hover:bg-brand-700 text-white transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {backupPhase === 'loading' ? (
            <><Loader2 size={15} className="animate-spin" /> Exportando…</>
          ) : backupPhase === 'done' ? (
            <><CheckCircle2 size={15} /> Exportado</>
          ) : (
            <><Download size={15} /> Exportar backup</>
          )}
        </button>
      </Section>

      {/* Restore */}
      <Section
        icon={<Upload size={20} className="text-amber-500" />}
        title="Importar backup"
        description="Restaurá datos desde un archivo de backup exportado previamente."
      >
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3 mb-4 flex items-start gap-2">
          <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-600 dark:text-amber-400">
            Los registros ya existentes (mismo SKU, email, etc.) serán omitidos para evitar duplicados.
            Esta operación <strong>no borra</strong> datos existentes.
          </p>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          onChange={handleFileChange}
          className="hidden"
        />

        <button
          onClick={() => fileRef.current?.click()}
          disabled={restorePhase === 'loading'}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                     border border-edge-2 text-content-2 hover:bg-surface-2 transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {restorePhase === 'loading' ? (
            <><Loader2 size={15} className="animate-spin" /> Restaurando…</>
          ) : (
            <><Upload size={15} /> Seleccionar archivo de backup</>
          )}
        </button>

        {/* Resultado del restore */}
        {restoreResult && restorePhase === 'done' && (
          <div className="mt-4 bg-surface-2 rounded-xl p-4 text-sm space-y-1">
            <p className="font-medium text-content mb-2 flex items-center gap-1.5">
              <CheckCircle2 size={15} className="text-green-500" /> Resultado
            </p>
            <ResultRow label="Productos" ok={restoreResult.products.ok} skipped={restoreResult.products.skipped} />
            <ResultRow label="Empleados" ok={restoreResult.employees.ok} skipped={restoreResult.employees.skipped} />
          </div>
        )}
      </Section>

      {/* Confirm modal */}
      <ConfirmModal
        open={confirmOpen}
        onClose={() => { setConfirmOpen(false); setPendingBackup(null) }}
        onConfirm={handleRestore}
        title="Confirmar importación"
        description={
          pendingBackup
            ? `Backup del ${exportedAt} con ${pendingBackup.products.length} productos y ${pendingBackup.employees.length} empleados. ¿Continuar?`
            : ''
        }
        confirmLabel="Importar"
      />
    </div>
  )
}

// ── Sub-componentes ───────────────────────────────────────────────

function Section({ icon, title, description, children }: {
  icon:        React.ReactNode
  title:       string
  description: string
  children:    React.ReactNode
}) {
  return (
    <div className="bg-surface border border-edge rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-2">
        {icon}
        <h2 className="text-base font-semibold text-content">{title}</h2>
      </div>
      <p className="text-sm text-content-muted mb-4">{description}</p>
      {children}
    </div>
  )
}

function ResultRow({ label, ok, skipped }: { label: string; ok: number; skipped: number }) {
  return (
    <div className="flex items-center justify-between text-content-muted">
      <span>{label}</span>
      <span>
        <span className="text-green-500 font-medium">{ok} restaurados</span>
        {skipped > 0 && <span className="ml-2 text-content-subtle">{skipped} omitidos</span>}
      </span>
    </div>
  )
}
