import { useState } from 'react'
import { Store, Eye, EyeOff } from 'lucide-react'
import { useLogin } from '@/features/auth/hooks/useLogin'
import { Input } from '@/shared/components/ui/Input'
import { Button } from '@/shared/components/ui/Button'

export function LoginPage() {
  const { form, loading, error, fieldErrors, setField, submit } = useLogin()
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4
                 bg-gray-50 dark:bg-gray-950"
    >
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-14 h-14 bg-brand-600 dark:bg-brand-500 rounded-2xl
                       flex items-center justify-center mb-3 shadow-lg"
          >
            <Store className="text-white" size={28} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            SaaS Tiendas
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Ingresá a tu cuenta
          </p>
        </div>

        {/* Card */}
        <div
          className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm
                     border border-gray-200 dark:border-gray-800 p-8"
        >
          <form onSubmit={submit} className="space-y-5" noValidate>

            <Input
              label="ID de Tienda"
              type="text"
              value={form.tenantId}
              onChange={e => setField('tenantId', e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              error={fieldErrors.tenantId}
              hint="UUID del tenant (visible en la URL de tu cuenta)"
              autoComplete="off"
              spellCheck={false}
            />

            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={e => setField('email', e.target.value)}
              placeholder="usuario@tienda.com"
              error={fieldErrors.email}
              autoComplete="email"
            />

            <Input
              label="Contraseña"
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={e => setField('password', e.target.value)}
              placeholder="••••••••"
              error={fieldErrors.password}
              autoComplete="current-password"
              suffix={
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300
                             transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              }
            />

            {/* Error global (no de campo) */}
            {error && (
              <div
                role="alert"
                className="bg-red-50 dark:bg-red-950/50 border border-red-200
                           dark:border-red-800 text-red-700 dark:text-red-400
                           text-sm px-4 py-3 rounded-lg"
              >
                {error}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              fullWidth
              loading={loading}
              size="lg"
            >
              Ingresar
            </Button>

          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 dark:text-gray-600 mt-6">
          ¿Problemas para ingresar? Contactá al administrador de tu tienda.
        </p>

      </div>
    </div>
  )
}
