import { useState, type FormEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { authApi } from '@/features/auth/api/auth.api'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { useBillingStore } from '@/features/billing/store/billing.store'
import { billingApi } from '@/features/billing/api/billing.api'
import { getDeviceId, getDeviceName } from '@/shared/utils/device'
import { isApiError } from '@/shared/api/errors'
import type { ApiError } from '@/shared/types'

interface LoginForm {
  email:    string
  password: string
}

type FieldErrors = Partial<Record<keyof LoginForm, string>>

interface UseLoginReturn {
  form:        LoginForm
  loading:     boolean
  error:       string | null
  fieldErrors: FieldErrors
  setField:    (key: keyof LoginForm, value: string) => void
  submit:      (e: FormEvent) => Promise<void>
  reset:       () => void
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validate(form: LoginForm): FieldErrors {
  const errors: FieldErrors = {}

  if (!form.email.trim()) {
    errors.email = 'El email es requerido'
  } else if (!EMAIL_RE.test(form.email.trim())) {
    errors.email = 'Ingresá un email válido'
  }

  if (!form.password) {
    errors.password = 'La contraseña es requerida'
  }

  return errors
}

function mapLoginError(err: ApiError): string {
  switch (err.statusCode) {
    case 401: return 'Email o contraseña incorrectos.'
    case 403: return 'Tu cuenta no tiene acceso. Contactá al administrador.'
    case 422: return err.message ?? 'Datos de login inválidos.'
    case 429: return 'Demasiados intentos. Esperá unos minutos e intentá de nuevo.'
    default:  break
  }
  switch (err.code) {
    case 'TIMEOUT':       return 'El servidor tardó demasiado. Verificá tu conexión.'
    case 'NETWORK_ERROR': return 'Sin conexión a internet. Verificá tu red.'
    default:              return err.message ?? 'Error al iniciar sesión. Intentá de nuevo.'
  }
}

const INITIAL_FORM: LoginForm = { email: '', password: '' }

export function useLogin(): UseLoginReturn {
  const navigate = useNavigate()
  const location = useLocation()

  const setTokens = useAuthStore(s => s.setTokens)
  const setUser   = useAuthStore(s => s.setUser)
  const setLimits = useBillingStore(s => s.setLimits)

  const [form,        setFormState]   = useState<LoginForm>(INITIAL_FORM)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  function setField(key: keyof LoginForm, value: string) {
    setFormState(f => ({ ...f, [key]: value }))
    if (fieldErrors[key]) setFieldErrors(e => ({ ...e, [key]: undefined }))
    if (error) setError(null)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()

    const errors = validate(form)
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setLoading(true)
    setError(null)
    setFieldErrors({})

    try {
      const tokens = await authApi.login({
        email:       form.email.trim(),
        password:    form.password,
        device_id:   getDeviceId(),
        device_name: getDeviceName(),
      })

      setTokens(tokens.access_token, tokens.refresh_token)

      const [user, limits] = await Promise.all([authApi.me(), billingApi.limits()])
      setUser(user)
      setLimits(limits)

      const from = (location.state as { from?: string } | null)?.from ?? '/app/pos'
      navigate(from, { replace: true })
    } catch (err) {
      setError(isApiError(err) ? mapLoginError(err) : 'Error de conexión.')
      setLoading(false)
    }
  }

  function reset() {
    setFormState(INITIAL_FORM)
    setError(null)
    setFieldErrors({})
    setLoading(false)
  }

  return { form, loading, error, fieldErrors, setField, submit, reset }
}
