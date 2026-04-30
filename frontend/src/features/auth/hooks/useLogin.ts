import { useState, type FormEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { authApi } from '@/features/auth/api/auth.api'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { useBillingStore } from '@/features/billing/store/billing.store'
import { billingApi } from '@/features/billing/api/billing.api'
import { getDeviceId, getDeviceName } from '@/shared/utils/device'
import { isApiError } from '@/shared/api/errors'
import type { ApiError } from '@/shared/types'

// ── Tipos ────────────────────────────────────────────────────────

interface LoginForm {
  tenantId: string
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

// ── Validación ───────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validate(form: LoginForm): FieldErrors {
  const errors: FieldErrors = {}

  if (!form.tenantId.trim()) {
    errors.tenantId = 'El ID de tienda es requerido'
  } else if (!UUID_RE.test(form.tenantId.trim())) {
    errors.tenantId = 'Debe ser un UUID válido (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)'
  }

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

// ── Mapeo de errores API → mensajes de usuario ───────────────────
// Los mensajes son explícitos pero no revelan información de seguridad.

function mapLoginError(err: ApiError): string {
  switch (err.statusCode) {
    case 401:
      return 'Email o contraseña incorrectos.'
    case 403:
      return 'Tu cuenta no tiene acceso. Contactá al administrador.'
    case 404:
      return 'ID de tienda no encontrado. Verificá el dato ingresado.'
    case 422:
      return err.message ?? 'Datos de login inválidos.'
    case 429:
      return 'Demasiados intentos. Esperá unos minutos e intentá de nuevo.'
    default:
      break
  }

  switch (err.code) {
    case 'TIMEOUT':
      return 'El servidor tardó demasiado. Verificá tu conexión.'
    case 'NETWORK_ERROR':
      return 'Sin conexión a internet. Verificá tu red.'
    default:
      return err.message ?? 'Error al iniciar sesión. Intentá de nuevo.'
  }
}

// ── Hook ─────────────────────────────────────────────────────────

const INITIAL_FORM: LoginForm = {
  // Pre-llenar el tenantId si ya se usó en una sesión anterior.
  tenantId: localStorage.getItem('saas_tenant_id') ?? '',
  email:    '',
  password: '',
}

export function useLogin(): UseLoginReturn {
  const navigate = useNavigate()
  const location = useLocation()

  const setTokens = useAuthStore(s => s.setTokens)
  const setUser   = useAuthStore(s => s.setUser)
  const setLimits = useBillingStore(s => s.setLimits)

  const [form,        setFormState]  = useState<LoginForm>(INITIAL_FORM)
  const [loading,     setLoading]    = useState(false)
  const [error,       setError]      = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  function setField(key: keyof LoginForm, value: string) {
    setFormState(f => ({ ...f, [key]: value }))
    // Limpiar error de campo al modificarlo
    if (fieldErrors[key]) setFieldErrors(e => ({ ...e, [key]: undefined }))
    // Limpiar error global al empezar a escribir
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
      const deviceId   = getDeviceId()
      const deviceName = getDeviceName()

      // 1. Login → obtener tokens
      const tokens = await authApi.login(
        {
          email:       form.email.trim(),
          password:    form.password,
          device_id:   deviceId,
          device_name: deviceName,
        },
        form.tenantId.trim(),
      )

      setTokens(tokens.access_token, tokens.refresh_token)

      // 2. Cargar perfil y límites del plan en paralelo
      const [user, limits] = await Promise.all([
        authApi.me(),
        billingApi.limits(),
      ])

      setUser(user)
      setLimits(limits)

      // 3. Redirigir al destino original (si venía de una ruta protegida)
      //    o al default del sistema (POS).
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
