import { useState } from 'react'
import { CreditCard, Smartphone, Loader2, ArrowLeft } from 'lucide-react'
import { Modal } from '@/shared/components/ui/Modal'
import { Input } from '@/shared/components/ui/Input'
import type { PlanDto } from '@/shared/types'

// ── Tipos internos ────────────────────────────────────────────────

type Provider = 'stripe' | 'mp'
type Step     = 'choose' | 'mp-email' | 'processing'

// ── Props ─────────────────────────────────────────────────────────

interface Props {
  open:            boolean
  onClose:         () => void
  plan:            PlanDto | null
  onCheckoutStripe:(planName: string) => Promise<void>
  onCheckoutMp:    (planName: string, email: string) => Promise<void>
}

// ── Componente ────────────────────────────────────────────────────

export function CheckoutModal({
  open, onClose, plan,
  onCheckoutStripe, onCheckoutMp,
}: Props) {
  const [step,     setStep]     = useState<Step>('choose')
  const [email,    setEmail]    = useState('')
  const [emailErr, setEmailErr] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  function handleClose() {
    if (loading) return
    setStep('choose')
    setEmail('')
    setEmailErr('')
    setError('')
    onClose()
  }

  async function handleStripe() {
    if (!plan) return
    setLoading(true)
    setError('')
    try {
      await onCheckoutStripe(plan.name)
      handleClose()
    } catch {
      setError('No se pudo iniciar el pago con Stripe. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  function handleMpContinue() {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailErr('Ingresá un email válido')
      return
    }
    setEmailErr('')
    void handleMpConfirm()
  }

  async function handleMpConfirm() {
    if (!plan) return
    setLoading(true)
    setError('')
    try {
      await onCheckoutMp(plan.name, email.trim())
      handleClose()
    } catch {
      setError('No se pudo iniciar el pago con Mercado Pago. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  if (!plan) return null

  const title =
    step === 'choose'    ? `Activar ${plan.display_name}` :
    step === 'mp-email'  ? 'Mercado Pago — Email' :
    'Procesando…'

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={title}
      size="sm"
      closable={!loading}
      footer={
        step === 'choose' ? (
          <button
            onClick={handleClose}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600
                       border border-gray-300 hover:bg-gray-50 transition-colors
                       dark:text-gray-400 dark:border-gray-600 dark:hover:bg-gray-800"
          >
            Cancelar
          </button>
        ) : step === 'mp-email' ? (
          <div className="flex gap-2">
            <button
              onClick={() => { setStep('choose'); setError('') }}
              disabled={loading}
              className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium
                         text-gray-600 border border-gray-300 hover:bg-gray-50 transition-colors
                         dark:text-gray-400 dark:border-gray-600 dark:hover:bg-gray-800"
            >
              <ArrowLeft size={13} /> Volver
            </button>
            <button
              onClick={handleMpContinue}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg
                         text-sm font-semibold text-white bg-sky-500 hover:bg-sky-600
                         transition-colors disabled:opacity-50"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              Continuar a Mercado Pago
            </button>
          </div>
        ) : null
      }
    >
      <div className="space-y-4">

        {/* Plan resumen */}
        <div className="flex items-center justify-between rounded-xl bg-gray-50 dark:bg-gray-800/60 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {plan.display_name}
            </p>
            {plan.price_ars > 0 && (
              <p className="text-xs text-gray-500 mt-0.5">
                ARS {plan.price_ars.toLocaleString('es-AR')} / mes
              </p>
            )}
          </div>
          <CreditCard size={20} className="text-gray-400" />
        </div>

        {/* STEP: choose provider */}
        {step === 'choose' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Elegí cómo querés pagar:
            </p>

            {/* Stripe */}
            <ProviderButton
              icon={<CreditCard size={20} className="text-indigo-600" />}
              title="Stripe"
              description="Tarjeta de crédito / débito internacional"
              color="indigo"
              loading={loading}
              onClick={handleStripe}
            />

            {/* Mercado Pago */}
            <ProviderButton
              icon={<Smartphone size={20} className="text-sky-500" />}
              title="Mercado Pago"
              description="Tarjeta, efectivo, transferencia bancaria"
              color="sky"
              loading={false}
              onClick={() => { setStep('mp-email'); setError('') }}
            />

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400 text-center">{error}</p>
            )}
          </div>
        )}

        {/* STEP: mp email */}
        {step === 'mp-email' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Ingresá el email asociado a tu cuenta de Mercado Pago:
            </p>
            <Input
              type="email"
              label="Email de Mercado Pago"
              value={email}
              onChange={e => { setEmail(e.target.value); setEmailErr('') }}
              error={emailErr}
              placeholder="tu@email.com"
              autoComplete="email"
            />
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
          </div>
        )}

        {/* STEP: processing */}
        {step === 'processing' && (
          <div className="flex flex-col items-center gap-3 py-4">
            <Loader2 size={32} className="animate-spin text-brand-500" />
            <p className="text-sm text-gray-500">Redirigiendo al proveedor de pago…</p>
          </div>
        )}
      </div>
    </Modal>
  )
}

// ── Provider button helper ────────────────────────────────────────

function ProviderButton({
  icon, title, description, color, loading, onClick,
}: {
  icon:        React.ReactNode
  title:       string
  description: string
  color:       'indigo' | 'sky'
  loading:     boolean
  onClick:     () => void
}) {
  const border = color === 'indigo'
    ? 'border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/20'
    : 'border-sky-200    dark:border-sky-800    hover:bg-sky-50    dark:hover:bg-sky-950/20'

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={[
        'w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-colors text-left',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        border,
      ].join(' ')}
    >
      <div className="shrink-0">{icon}</div>
      <div>
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
      </div>
      {loading && <Loader2 size={14} className="ml-auto animate-spin text-gray-400" />}
    </button>
  )
}
