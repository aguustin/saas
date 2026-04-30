import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  Package,
  Warehouse,
  Users,
  UserCog,
  CreditCard,
  Store,
  LogOut,
  Settings2,
} from 'lucide-react'
import type { UserRole } from '@/shared/types'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useLogout } from '@/features/auth/hooks/useLogout'

interface NavItem {
  path:         string
  label:        string
  icon:         React.ElementType
  allowedRoles: UserRole[]
}

const NAV_ITEMS: NavItem[] = [
  {
    path:         '/app/dashboard',
    label:        'Dashboard',
    icon:         LayoutDashboard,
    allowedRoles: ['manager', 'admin', 'owner'],
  },
  {
    path:         '/app/pos',
    label:        'Punto de Venta',
    icon:         ShoppingCart,
    allowedRoles: ['cashier', 'manager', 'admin', 'owner'],
  },
  {
    path:         '/app/sales',
    label:        'Ventas',
    icon:         Receipt,
    allowedRoles: ['cashier', 'manager', 'admin', 'owner'],
  },
  {
    path:         '/app/products',
    label:        'Productos',
    icon:         Package,
    allowedRoles: ['manager', 'admin', 'owner'],
  },
  {
    path:         '/app/stock',
    label:        'Stock',
    icon:         Warehouse,
    allowedRoles: ['manager', 'admin', 'owner'],
  },
  {
    path:         '/app/employees',
    label:        'Empleados',
    icon:         Users,
    allowedRoles: ['manager', 'admin', 'owner'],
  },
  {
    path:         '/app/users',
    label:        'Usuarios',
    icon:         UserCog,
    allowedRoles: ['admin', 'owner'],
  },
  {
    path:         '/app/billing',
    label:        'Facturación',
    icon:         CreditCard,
    allowedRoles: ['owner', 'admin'],
  },
  {
    path:         '/app/admin',
    label:        'Administración',
    icon:         Settings2,
    allowedRoles: ['owner', 'admin'],
  },
]

export function Sidebar() {
  const { role, user }   = useAuth()
  const { logout, loading: loggingOut } = useLogout()

  const visibleItems = NAV_ITEMS.filter(
    item => role && item.allowedRoles.includes(role),
  )

  async function handleLogout() {
    await logout(false)
  }

  return (
    <aside className="fixed inset-y-0 left-0 w-64 bg-gray-900 flex flex-col z-10">

      {/* Logo */}
      <div className="h-16 flex items-center gap-3 px-5 border-b border-gray-800">
        <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center shrink-0">
          <Store size={16} className="text-white" />
        </div>
        <span className="text-white font-semibold text-sm truncate">
          SaaS Tiendas
        </span>
      </div>

      {/* Navegación */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {visibleItems.map(({ path, label, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Usuario + Logout */}
      <div className="px-3 pb-4 border-t border-gray-800 pt-3">
        <div className="px-3 py-2 mb-1">
          <p className="text-white text-sm font-medium truncate">
            {user?.user_id ? `${user.user_id.slice(0, 8)}...` : '—'}
          </p>
          <p className="text-gray-500 text-xs capitalize">{role ?? '—'}</p>
        </div>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
                     font-medium text-gray-400 hover:bg-gray-800 hover:text-white
                     transition-colors disabled:opacity-50"
        >
          <LogOut size={18} />
          {loggingOut ? 'Saliendo...' : 'Cerrar sesión'}
        </button>
      </div>

    </aside>
  )
}
