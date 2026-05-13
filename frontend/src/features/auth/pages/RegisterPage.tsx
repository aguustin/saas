import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Store, Eye, EyeOff } from 'lucide-react'
import { useRegister } from '@/features/auth/hooks/useRegister'
import { Input } from '@/shared/components/ui/Input'
import { Button } from '@/shared/components/ui/Button'

export function RegisterPage() {
  const { form, loading, error, fieldErrors, setField, submit } = useRegister()
  const [showPassword, setShowPassword]               = useState(false)
  const [showConfirm,  setShowConfirm]                = useState(false)

  return (
    <div className="min-h-screen flex items-center justify-center px-4
                    bg-gray-50 dark:bg-gray-950">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-brand-600 dark:bg-brand-500 rounded-2xl
                          flex items-center justify-center mb-3 shadow-lg">
            <Store className="text-white" size={28} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            SaaS Tiendas
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Creá tu cuenta gratis
          </p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm
                        border border-gray-200 dark:border-gray-800 p-8">
          <form onSubmit={submit} className="space-y-5" noValidate>

            <Input
              label="Nombre del negocio"
              type="text"
              value={form.businessName}
              onChange={e => setField('businessName', e.target.value)}
              placeholder="Mi Tienda"
              error={fieldErrors.businessName}
              autoComplete="organization"
              autoFocus
            />

            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={e => setField('email', e.target.value)}
              placeholder="vos@tunegocio.com"
              error={fieldErrors.email}
              autoComplete="email"
            />

            <Input
              label="Contraseña"
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={e => setField('password', e.target.value)}
              placeholder="Mínimo 8 caracteres"
              error={fieldErrors.password}
              autoComplete="new-password"
              suffix={
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              }
            />

            <Input
              label="Confirmá la contraseña"
              type={showConfirm ? 'text' : 'password'}
              value={form.confirmPassword}
              onChange={e => setField('confirmPassword', e.target.value)}
              placeholder="Repetí la contraseña"
              error={fieldErrors.confirmPassword}
              autoComplete="new-password"
              suffix={
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  tabIndex={-1}
                  aria-label={showConfirm ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              }
            />

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

            <Button type="submit" variant="primary" fullWidth loading={loading} size="lg">
              Crear cuenta
            </Button>

          </form>
        </div>

        {/* Link a login */}
        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
          ¿Ya tenés cuenta?{' '}
          <Link
            to="/login"
            className="font-medium text-brand-600 dark:text-brand-400
                       hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
          >
            Iniciá sesión
          </Link>
        </p>

      </div>
    </div>
  )
}
