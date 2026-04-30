import { useCallback, useState } from 'react'
import { useEmployees } from '@/features/employees/hooks/useEmployees'
import { useEmployeeStore } from '@/features/employees/store/employees.store'
import { useToastStore } from '@/shared/components/ui/Toast'
import { EmployeeFiltersBar } from '@/features/employees/components/EmployeeFiltersBar'
import { EmployeeTable }      from '@/features/employees/components/EmployeeTable'
import { EmployeeForm }       from '@/features/employees/components/EmployeeForm'
import { ConfirmModal }       from '@/shared/components/ui/Modal'
import type { EmployeeRow } from '@/shared/types'

export function EmployeesPage() {
  const {
    items, total, loading,
    search, setSearch,
    isActive, changeIsActive,
    sortBy, sortDir, changeSort,
    page, pageCount, goToPage,
    canCreate, defaultBranchId,
    refresh,
  } = useEmployees()

  const toggleActive = useEmployeeStore(s => s.toggleActive)
  const remove       = useEmployeeStore(s => s.remove)
  const addToast     = useToastStore(s => s.add)

  // ── Modal estado ──────────────────────────────────────────────

  const [formOpen,     setFormOpen]     = useState(false)
  const [editTarget,   setEditTarget]   = useState<EmployeeRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<EmployeeRow | null>(null)
  const [deleting,     setDeleting]     = useState(false)

  // ── Handlers estables ─────────────────────────────────────────

  const openCreate = useCallback(() => {
    setEditTarget(null)
    setFormOpen(true)
  }, [])

  const openEdit = useCallback((emp: EmployeeRow) => {
    setEditTarget(emp)
    setFormOpen(true)
  }, [])

  const handleDelete = useCallback((emp: EmployeeRow) => setDeleteTarget(emp), [])

  const handleFormClose = useCallback(() => setFormOpen(false), [])

  const handleToggleActive = useCallback(async (id: string, val: boolean) => {
    try {
      await toggleActive(id, val)
    } catch {
      addToast({ type: 'error', title: 'No se pudo modificar el estado' })
      refresh()
    }
  }, [toggleActive, addToast, refresh])

  function handleFormSuccess(emp: EmployeeRow) {
    setFormOpen(false)
    const isNew = !editTarget
    addToast({
      type:  'success',
      title: isNew
        ? `${emp.first_name} ${emp.last_name} agregado`
        : 'Empleado actualizado',
    })
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await remove(deleteTarget.id)
      addToast({ type: 'success', title: 'Empleado eliminado' })
    } catch {
      addToast({ type: 'error', title: 'No se pudo eliminar el empleado' })
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Empleados</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Gestioná el personal de tus sucursales
        </p>
      </div>

      {/* Filtros */}
      <EmployeeFiltersBar
        search={search}       onSearch={setSearch}
        isActive={isActive}   onIsActive={changeIsActive}
        sortBy={sortBy}       sortDir={sortDir}  onChangeSort={changeSort}
        total={total}
        canCreate={canCreate}
        onCreate={openCreate}
      />

      {/* Tabla */}
      <EmployeeTable
        items={items}
        loading={loading}
        page={page}
        pageCount={pageCount}
        onPageChange={goToPage}
        onEdit={openEdit}
        onDelete={handleDelete}
        onToggleActive={handleToggleActive}
      />

      {/* Modal crear / editar */}
      <EmployeeForm
        open={formOpen}
        onClose={handleFormClose}
        onSuccess={handleFormSuccess}
        target={editTarget}
        defaultBranchId={defaultBranchId}
      />

      {/* Confirm eliminar */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        loading={deleting}
        danger
        title="Eliminar empleado"
        description={
          deleteTarget
            ? `¿Eliminar a ${deleteTarget.first_name} ${deleteTarget.last_name}? Esta acción no se puede deshacer.`
            : ''
        }
        confirmLabel="Eliminar"
      />
    </div>
  )
}
