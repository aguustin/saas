import { Loader2 } from 'lucide-react'

interface Props {
  size?: number
  className?: string
}

export function Spinner({ size = 24, className = '' }: Props) {
  return (
    <Loader2
      size={size}
      className={`animate-spin text-brand-600 ${className}`}
    />
  )
}

export function FullPageSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Spinner size={36} />
    </div>
  )
}
