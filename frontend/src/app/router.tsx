import { createBrowserRouter, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { Shell } from '@/app/shell/Shell'
import { ProtectedRoute } from '@/shared/components/ProtectedRoute'
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { SuspendedPage } from '@/features/billing/pages/SuspendedPage'
import { ExpiredPage } from '@/features/billing/pages/ExpiredPage'
import { Spinner } from '@/shared/components/Spinner'

// ── Lazy pages (code-split por ruta) ─────────────────────────────

const DashboardPage = lazy(() =>
  import('@/features/dashboard/pages/DashboardPage').then(m => ({ default: m.DashboardPage })),
)
const POSPage = lazy(() =>
  import('@/features/pos/pages/POSPage').then(m => ({ default: m.POSPage })),
)
const SalesPage = lazy(() =>
  import('@/features/sales/pages/SalesPage').then(m => ({ default: m.SalesPage })),
)
const ProductsPage = lazy(() =>
  import('@/features/products/pages/ProductsPage').then(m => ({ default: m.ProductsPage })),
)
const StockPage = lazy(() =>
  import('@/features/stock/pages/StockPage').then(m => ({ default: m.StockPage })),
)
const EmployeesPage = lazy(() =>
  import('@/features/employees/pages/EmployeesPage').then(m => ({ default: m.EmployeesPage })),
)
const UsersPage = lazy(() =>
  import('@/features/users/pages/UsersPage').then(m => ({ default: m.UsersPage })),
)
const BillingPage = lazy(() =>
  import('@/features/billing/pages/BillingPage').then(m => ({ default: m.BillingPage })),
)
const AdminPage = lazy(() =>
  import('@/features/admin/pages/AdminPage').then(m => ({ default: m.AdminPage })),
)

// ── Fallback inline ───────────────────────────────────────────────

function PageFallback() {
  return (
    <div className="flex items-center justify-center h-64">
      <Spinner size={28} />
    </div>
  )
}

function wrap(el: React.ReactNode) {
  return <Suspense fallback={<PageFallback />}>{el}</Suspense>
}

// ── Router ────────────────────────────────────────────────────────

export const router = createBrowserRouter([
  {
    path:    '/',
    element: <Navigate to="/app/pos" replace />,
  },
  {
    path:    '/login',
    element: <LoginPage />,
  },
  {
    path:    '/suspended',
    element: <SuspendedPage />,
  },
  {
    path:    '/expired',
    element: <ExpiredPage />,
  },
  {
    path:    '/app',
    element: (
      <ProtectedRoute>
        <Shell />
      </ProtectedRoute>
    ),
    children: [
      {
        index:   true,
        element: <Navigate to="pos" replace />,
      },
      {
        path:    'dashboard',
        element: (
          <ProtectedRoute allowedRoles={['manager', 'admin', 'owner']}>
            {wrap(<DashboardPage />)}
          </ProtectedRoute>
        ),
      },
      {
        path:    'pos',
        element: (
          <ProtectedRoute allowedRoles={['cashier', 'manager', 'admin', 'owner']}>
            {wrap(<POSPage />)}
          </ProtectedRoute>
        ),
      },
      {
        path:    'sales',
        element: (
          <ProtectedRoute allowedRoles={['cashier', 'manager', 'admin', 'owner']}>
            {wrap(<SalesPage />)}
          </ProtectedRoute>
        ),
      },
      {
        path:    'products',
        element: (
          <ProtectedRoute allowedRoles={['manager', 'admin', 'owner']}>
            {wrap(<ProductsPage />)}
          </ProtectedRoute>
        ),
      },
      {
        path:    'stock',
        element: (
          <ProtectedRoute allowedRoles={['manager', 'admin', 'owner']}>
            {wrap(<StockPage />)}
          </ProtectedRoute>
        ),
      },
      {
        path:    'employees',
        element: (
          <ProtectedRoute allowedRoles={['manager', 'admin', 'owner']}>
            {wrap(<EmployeesPage />)}
          </ProtectedRoute>
        ),
      },
      {
        path:    'users',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'owner']}>
            {wrap(<UsersPage />)}
          </ProtectedRoute>
        ),
      },
      {
        path:    'billing',
        element: (
          <ProtectedRoute allowedRoles={['owner', 'admin']}>
            {wrap(<BillingPage />)}
          </ProtectedRoute>
        ),
      },
      {
        path:    'admin',
        element: (
          <ProtectedRoute allowedRoles={['owner', 'admin']}>
            {wrap(<AdminPage />)}
          </ProtectedRoute>
        ),
      },
    ],
  },
])
