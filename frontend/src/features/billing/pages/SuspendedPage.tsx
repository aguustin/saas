import { AlertTriangle } from 'lucide-react'
import { Link } from 'react-router-dom'

export function SuspendedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle size={32} className="text-red-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Cuenta suspendida</h1>
        <p className="text-gray-500 mb-6">
          Tu suscripción está suspendida por falta de pago. Regularizá tu cuenta para
          continuar usando el sistema.
        </p>
        <Link
          to="/app/billing"
          className="inline-block bg-brand-600 text-white font-medium px-6 py-2.5
                     rounded-lg hover:bg-brand-700 transition-colors"
        >
          Ir a Facturación
        </Link>
      </div>
    </div>
  )
}
