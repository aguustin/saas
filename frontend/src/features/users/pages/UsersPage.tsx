import { useCallback, useState } from 'react'
import { useUsers } from '@/features/users/hooks/useUsers'
import { useUserStore } from '@/features/users/store/users.store'
import { useToastStore } from '@/shared/components/ui/Toast'
import { UserFiltersBar } from '@/features/users/components/UserFiltersBar'
import { UserTable }      from '@/features/users/components/UserTable'
import { UserForm }       from '@/features/users/components/UserForm'
import { ConfirmModal }   from '@/shared/components/ui/Modal'
import type { UserRow, UserRole } from '@/shared/types'

export function UsersPage() {
  const {
    items, total, loading,
    search, setSearch,
    roleFilter, changeRoleFilter,
    isActive, changeIsActive,
    page, pageCount, goToPage,
    canCreate, assignableRoles,
    canEditUser, canDeactivate,
    myUserId, refresh,
  } = useUsers()

  const changeRole    = useUserStore(s => s.changeRole)
  const toggleActive  = useUserStore(s => s.toggleActive)
  const remove        = useUserStore(s => s.remove)
  const addToast      = useToastStore(s => s.add)

  // ── Modal estado ──────────────────────────────────────────────

  const [formOpen,    setFormOpen]    = useState(false)
  const [editTarget,  setEditTarget]  = useState<UserRow | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null)
  const [deleting,     setDeleting]     = useState(false)

  // ── Handlers estables ─────────────────────────────────────────

  const openInvite = useCallback(() => {
    setEditTarget(null)
    setFormOpen(true)
  }, [])

  const openEdit = useCallback((user: UserRow) => {
    setEditTarget(user)
    setFormOpen(true)
  }, [])

  const handleFormClose = useCallback(() => setFormOpen(false), [])

  const handleDelete = useCallback((user: UserRow) => setDeleteTarget(user), [])

  const handleToggleActive = useCallback(async (id: string, val: boolean) => {
    try {
      await toggleActive(id, val)
    } catch {
      addToast({ type: 'error', title: 'No se pudo modificar el estado' })
    }
  }, [toggleActive, addToast])

  const handleChangeRole = useCallback(async (id: string, role: UserRole) => {
    try {
      await changeRole(id, role)
      addToast({ type: 'success', title: 'Rol actualizado' })
    } catch {
      addToast({ type: 'error', title: 'No se pudo cambiar el rol' })
      refresh()
    }
  }, [changeRole, addToast, refresh])

  function handleFormSuccess(user: UserRow) {
    setFormOpen(false)
    const isNew = !editTarget
    addToast({
      type:  'success',
      title: isNew ? `Usuario ${user.email} creado` : 'Usuario actualizado',
    })
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await remove(deleteTarget.id)
      addToast({ type: 'success', title: 'Usuario eliminado' })
    } catch {
      addToast({ type: 'error', title: 'No se pudo eliminar el usuario' })
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
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Usuarios</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Gestioná el acceso y los roles de los usuarios del sistema
        </p>
      </div>

      {/* Filtros */}
      <UserFiltersBar
        search={search}           onSearch={setSearch}
        roleFilter={roleFilter}   onRoleFilter={changeRoleFilter}
        isActive={isActive}       onIsActive={changeIsActive}
        total={total}
        canCreate={canCreate}
        onInvite={openInvite}
      />

      {/* Tabla */}
      <UserTable
        items={items}
        loading={loading}
        myUserId={myUserId}
        assignableRoles={assignableRoles}
        canEditUser={canEditUser}
        canDeactivate={canDeactivate}
        page={page}
        pageCount={pageCount}
        onPageChange={goToPage}
        onEdit={openEdit}
        onDelete={handleDelete}
        onToggleActive={handleToggleActive}
        onChangeRole={handleChangeRole}
      />

      {/* Modal invitar / editar */}
      <UserForm
        open={formOpen}
        onClose={handleFormClose}
        onSuccess={handleFormSuccess}
        target={editTarget}
        assignableRoles={assignableRoles}
      />

      {/* Confirm eliminar */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        loading={deleting}
        danger
        title="Eliminar usuario"
        description={`¿Eliminar a ${deleteTarget?.email}? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
      />
    </div>
  )
}
