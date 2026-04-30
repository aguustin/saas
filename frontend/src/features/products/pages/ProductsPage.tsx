import { useCallback, useState } from 'react'
import { useProductStore } from '@/features/products/store/products.store'
import { useProducts } from '@/features/products/hooks/useProducts'
import { ProductFiltersBar } from '@/features/products/components/ProductFiltersBar'
import { ProductTable } from '@/features/products/components/ProductTable'
import { ProductForm } from '@/features/products/components/ProductForm'
import { ConfirmModal } from '@/shared/components/ui/Modal'
import { useToast } from '@/shared/components/ui/Toast'
import type { ProductResponse } from '@/shared/types'

export function ProductsPage() {
  const remove     = useProductStore(s => s.remove)
  const bulkRemove = useProductStore(s => s.bulkRemove)
  const { success, error: toastError } = useToast()

  // ── Datos + filtros ───────────────────────────────────────────

  const {
    items, total, loading,
    search, setSearch,
    isActive, changeIsActive,
    sortBy, sortDir, changeSort, changeSortDir,
    page, pageCount, pageSize, goToPage,
    selected, toggleSelect, toggleSelectAll, clearSelection,
    canCreate,
    refresh,
  } = useProducts()

  // ── Estado de modales ─────────────────────────────────────────

  const [formOpen,    setFormOpen]    = useState(false)
  const [editProduct, setEditProduct] = useState<ProductResponse | undefined>()

  const [deleteTarget, setDeleteTarget] = useState<ProductResponse | null>(null)
  const [deleting,     setDeleting]     = useState(false)

  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkDeleting,   setBulkDeleting]   = useState(false)

  // ── Acciones estables ─────────────────────────────────────────

  const handleNew = useCallback(() => {
    setEditProduct(undefined)
    setFormOpen(true)
  }, [])

  const handleEdit = useCallback((product: ProductResponse) => {
    setEditProduct(product)
    setFormOpen(true)
  }, [])

  const handleDelete = useCallback((product: ProductResponse) => {
    setDeleteTarget(product)
  }, [])

  const handleBulkDelete = useCallback(() => setBulkDeleteOpen(true), [])

  const handleFormClose = useCallback(() => {
    setFormOpen(false)
    setEditProduct(undefined)
  }, [])

  function handleFormSuccess(product: ProductResponse) {
    setFormOpen(false)
    setEditProduct(undefined)
    success(
      editProduct ? 'Producto actualizado' : 'Producto creado',
      product.name,
    )
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await remove(deleteTarget.id)
      success('Producto eliminado', deleteTarget.name)
      setDeleteTarget(null)
      clearSelection()
    } catch {
      toastError('No se pudo eliminar el producto.')
    } finally {
      setDeleting(false)
    }
  }

  async function handleConfirmBulkDelete() {
    if (selected.size === 0) return
    setBulkDeleting(true)
    try {
      await bulkRemove([...selected])
      success(
        `${selected.size} ${selected.size === 1 ? 'producto eliminado' : 'productos eliminados'}`,
      )
      clearSelection()
      setBulkDeleteOpen(false)
    } catch {
      toastError('No se pudieron eliminar los productos seleccionados.')
    } finally {
      setBulkDeleting(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-5 max-w-screen-xl mx-auto">

      {/* Encabezado */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Productos</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {total > 0
            ? `${total} producto${total !== 1 ? 's' : ''} en total`
            : 'Gestioná el catálogo de tu tienda'
          }
        </p>
      </div>

      {/* Filtros y acciones */}
      <ProductFiltersBar
        search={search}
        isActive={isActive}
        sortBy={sortBy}
        sortDir={sortDir}
        selectedCount={selected.size}
        loading={loading}
        canCreate={canCreate}
        onSearch={setSearch}
        onIsActive={changeIsActive}
        onSort={changeSort}
        onSortDir={changeSortDir}
        onNew={handleNew}
        onBulkDelete={handleBulkDelete}
        onRefresh={refresh}
      />

      {/* Tabla con paginación */}
      <ProductTable
        items={items}
        total={total}
        page={page}
        pageCount={pageCount}
        pageSize={pageSize}
        loading={loading}
        selected={selected}
        onToggleSelect={toggleSelect}
        onToggleAll={toggleSelectAll}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onPageChange={goToPage}
      />

      {/* Modal crear / editar */}
      <ProductForm
        open={formOpen}
        product={editProduct}
        onClose={handleFormClose}
        onSuccess={handleFormSuccess}
      />

      {/* Confirm eliminar individual */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleConfirmDelete()}
        title="¿Eliminar producto?"
        description={`"${deleteTarget?.name}" será eliminado. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        loading={deleting}
        danger
      />

      {/* Confirm eliminar masivo */}
      <ConfirmModal
        open={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        onConfirm={() => void handleConfirmBulkDelete()}
        title={`¿Eliminar ${selected.size} ${selected.size === 1 ? 'producto' : 'productos'}?`}
        description="Los productos seleccionados serán eliminados. Esta acción no se puede deshacer."
        confirmLabel={`Eliminar ${selected.size}`}
        loading={bulkDeleting}
        danger
      />
    </div>
  )
}
