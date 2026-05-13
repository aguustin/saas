import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '@/features/auth/api/auth.api'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { useBillingStore } from '@/features/billing/store/billing.store'
import { billingApi } from '@/features/billing/api/billing.api'
import { getDeviceId, getDeviceName } from '@/shared/utils/device'
import { isApiError } from '@/shared/api/errors'
import type { ApiError } from '@/shared/types'

interface RegisterForm {
  businessName:    string
  email:           string
  password:        string
  confirmPassword: string
}

type FieldErrors = Partial<Record<keyof RegisterForm, string>>

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validate(form: RegisterForm): FieldErrors {
  const errors: FieldErrors = {}

  if (!form.businessName.trim()) {
    errors.businessName = 'El nombre del negocio es requerido'
  } else if (form.businessName.trim().length < 2) {
    errors.businessName = 'Debe tener al menos 2 caracteres'
  }

  if (!form.email.trim()) {
    errors.email = 'El email es requerido'
  } else if (!EMAIL_RE.test(form.email.trim())) {
    errors.email = 'Ingresá un email válido'
  }

  if (!form.password) {
    errors.password = 'La contraseña es requerida'
  } else if (form.password.length < 8) {
    errors.password = 'Debe tener al menos 8 caracteres'
  }

  if (!form.confirmPassword) {
    errors.confirmPassword = 'Confirmá tu contraseña'
  } else if (form.password !== form.confirmPassword) {
    errors.confirmPassword = 'Las contraseñas no coinciden'
  }

  return errors
}

function mapRegisterError(err: ApiError): string {
  switch (err.statusCode) {
    case 409: return 'Ya existe una cuenta con ese email. Intentá iniciar sesión.'
    case 422: return err.message ?? 'Datos inválidos. Revisá los campos.'
    case 429: return 'Demasiados intentos. Esperá unos minutos.'
    default:  return err.message ?? 'Error al crear la cuenta. Intentá de nuevo.'
  }
}

const INITIAL: RegisterForm = { businessName: '', email: '', password: '', confirmPassword: '' }

export function useRegister() {
  const navigate  = useNavigate()
  const setTokens = useAuthStore(s => s.setTokens)
  const setUser   = useAuthStore(s => s.setUser)
  const setLimits = useBillingStore(s => s.setLimits)

  const [form,        setFormState]   = useState<RegisterForm>(INITIAL)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  function setField(key: keyof RegisterForm, value: string) {
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
      const result = await authApi.register({
        business_name: form.businessName.trim(),
        email:         form.email.trim(),
        password:      form.password,
        device_id:     getDeviceId(),
        device_name:   getDeviceName(),
      })

      // Guardar tenant_id para pre-rellenar el login en el futuro
      localStorage.setItem('saas_tenant_id', result.tenant_id)

      setTokens(result.access_token, result.refresh_token)

      const [user, limits] = await Promise.all([authApi.me(), billingApi.limits()])
      setUser(user)
      setLimits(limits)

      navigate('/app/pos', { replace: true })
    } catch (err) {
      setError(isApiError(err) ? mapRegisterError(err) : 'Error de conexión.')
      setLoading(false)
    }
  }

  return { form, loading, error, fieldErrors, setField, submit }
}
