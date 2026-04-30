import { Clock } from 'lucide-react'
import { Link } from 'react-router-dom'

export function ExpiredPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Clock size={32} className="text-amber-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Suscripción vencida</h1>
        <p className="text-gray-500 mb-6">
          Tu período de suscripción ha expirado. Renová tu plan para volver a acceder.
        </p>
        <Link
          to="/app/billing"
          className="inline-block bg-brand-600 text-white font-medium px-6 py-2.5
                     rounded-lg hover:bg-brand-700 transition-colors"
        >
          Renovar plan
        </Link>
      </div>
    </div>
  )
}
