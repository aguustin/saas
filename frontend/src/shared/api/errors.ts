/**
 * Sistema de manejo de errores del API.
 *
 * Exporta:
 *  - API_CODES       → constantes de todos los códigos semánticos del sistema
 *  - ApiError        → re-export del tipo (para imports desde un solo lugar)
 *  - isApiError      → type guard
 *  - classifyError   → mapea ApiError → ErrorAction (qué hacer en la UI)
 *  - useErrorHandler → hook que ejecuta la acción correspondiente
 */

import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { useToastStore } from '@/shared/components/ui/Toast'
import type { ApiError } from '@/shared/types'

// ── Códigos semánticos del sistema ───────────────────────────────
//
// Fuente de verdad: contrato del backend. Usar estas constantes en
// lugar de strings literales para evitar typos y facilitar búsquedas.

export const API_CODES = {
  // Stock
  INSUFFICIENT_STOCK:   'INSUFFICIENT_STOCK',
  STOCK_RACE_CONDITION: 'STOCK_RACE_CONDITION',

  // Plan / billing
  PLAN_LIMIT_REACHED:   'PLAN_LIMIT_REACHED',

  // Recursos
  DUPLICATE:            'DUPLICATE',
  NOT_FOUND:            'NOT_FOUND',
  FOREIGN_KEY_VIOLATION:'FOREIGN_KEY_VIOLATION',

  // Request
  VALIDATION_ERROR:     'VALIDATION_ERROR',
  HTTP_EXCEPTION:       'HTTP_EXCEPTION',

  // Servidor
  INTERNAL_ERROR:       'INTERNAL_ERROR',
  DB_ERROR:             'DB_ERROR',

  // Auth (derivados en el cliente, no vienen del backend)
  UNAUTHORIZED:         'UNAUTHORIZED',
  FORBIDDEN:            'FORBIDDEN',
  TIMEOUT:              'TIMEOUT',
  NETWORK_ERROR:        'NETWORK_ERROR',
  REFRESH_FAILED:       'REFRESH_FAILED',
} as const

export type ApiCode = (typeof API_CODES)[keyof typeof API_CODES]

// ── Tipo de detalle para INSUFFICIENT_STOCK ──────────────────────
// El backend devuelve un array en details[] con esta forma.

export interface InsufficientStockDetail {
  product_id:   string
  product_name: string
  available:    number
  requested:    number
}

// ── Type guard ───────────────────────────────────────────────────

export function isApiError(err: unknown): err is ApiError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'statusCode' in err &&
    'code'       in err &&
    'message'    in err
  )
}

// ── ErrorAction: qué debe hacer la UI ───────────────────────────
//
// El componente recibe una acción tipada en lugar de tomar decisiones
// sobre strings de mensajes. Esto permite testear la lógica sin UI.

export type ErrorAction =
  | { type: 'silent' }
  | { type: 'logout' }
  | { type: 'redirect';  to: string }
  | { type: 'toast';     severity: 'error' | 'warning' | 'info'; title: string; description?: string }
  | { type: 'inline';    message: string }
  | { type: 'modal';     code: string; title: string; message: string; details?: unknown }
  | { type: 'retry' }

// ── Clasificador central ──────────────────────────────────────────
//
// Orden: más específico primero, más genérico al final.
// Nunca retorna `undefined`; siempre hay una acción fallback.

export function classifyError(error: ApiError): ErrorAction {
  const { statusCode, code, message, details } = error

  // ── Auth ────────────────────────────────────────────────────────
  if (statusCode === 401) {
    return { type: 'logout' }
  }

  // ── Tenant suspendido / expirado ─────────────────────────────────
  if (statusCode === 403) {
    const msg = message.toLowerCase()
    if (msg.includes('suspended') || msg.includes('suspendida')) {
      return { type: 'redirect', to: '/suspended' }
    }
    if (msg.includes('expired') || msg.includes('expirada') || msg.includes('subscription')) {
      return { type: 'redirect', to: '/expired' }
    }
    if (code === API_CODES.PLAN_LIMIT_REACHED) {
      return {
        type:    'modal',
        code,
        title:   'Límite del plan alcanzado',
        message: 'Actualizá tu plan para continuar creando recursos.',
        details,
      }
    }
    return {
      type:        'toast',
      severity:    'error',
      title:       'Acceso denegado',
      description: message,
    }
  }

  // ── Stock ────────────────────────────────────────────────────────
  if (statusCode === 422) {
    if (code === API_CODES.INSUFFICIENT_STOCK) {
      return {
        type:    'modal',
        code,
        title:   'Stock insuficiente',
        message,
        details,  // InsufficientStockDetail[]
      }
    }
    if (code === API_CODES.STOCK_RACE_CONDITION) {
      return { type: 'retry' }
    }
  }

  // ── Conflictos de recursos ───────────────────────────────────────
  if (statusCode === 409 && code === API_CODES.DUPLICATE) {
    return { type: 'inline', message }
  }

  // ── Not found ────────────────────────────────────────────────────
  if (statusCode === 404) {
    return { type: 'inline', message: 'No encontrado.' }
  }

  // ── Validación ───────────────────────────────────────────────────
  if (statusCode === 400 && code === API_CODES.VALIDATION_ERROR) {
    return { type: 'inline', message }
  }

  // ── Foreign key ──────────────────────────────────────────────────
  if (statusCode === 400 && code === API_CODES.FOREIGN_KEY_VIOLATION) {
    return {
      type:        'toast',
      severity:    'error',
      title:       'Referencia inválida',
      description: message,
    }
  }

  // ── Red / timeout ────────────────────────────────────────────────
  if (statusCode === 0) {
    if (code === API_CODES.TIMEOUT) {
      return {
        type:        'toast',
        severity:    'warning',
        title:       'La solicitud tardó demasiado',
        description: 'Verificá tu conexión e intentá de nuevo.',
      }
    }
    return {
      type:        'toast',
      severity:    'warning',
      title:       'Sin conexión',
      description: 'No se pudo contactar al servidor.',
    }
  }

  // ── Errores de servidor ──────────────────────────────────────────
  if (statusCode >= 500) {
    return {
      type:        'toast',
      severity:    'error',
      title:       'Error del servidor',
      description: 'Intentá de nuevo en unos momentos.',
    }
  }

  // ── Fallback ─────────────────────────────────────────────────────
  return {
    type:        'toast',
    severity:    'error',
    title:       'Error inesperado',
    description: message ?? undefined,
  }
}

// ── useErrorHandler ──────────────────────────────────────────────
//
// Hook que recibe un ApiError y ejecuta la acción de UI correspondiente.
//
// Uso:
//   const { handle } = useErrorHandler()
//   try { ... } catch (err) {
//     if (isApiError(err)) handle(err)
//   }
//
// Para casos que necesitan UI propia (modal de INSUFFICIENT_STOCK,
// inline de DUPLICATE), el hook retorna la acción para que el
// componente la maneje directamente.

export function useErrorHandler() {
  const navigate = useNavigate()
  const logout   = useAuthStore(s => s.logout)
  const addToast = useToastStore(s => s.add)

  function handle(error: ApiError): ErrorAction {
    const action = classifyError(error)

    switch (action.type) {
      case 'logout':
        logout()
        navigate('/login', { replace: true })
        break

      case 'redirect':
        navigate(action.to, { replace: true })
        break

      case 'toast':
        addToast({
          type:        action.severity === 'warning' ? 'warning' : 'error',
          title:       action.title,
          description: action.description,
        })
        break

      case 'retry':
        addToast({
          type:        'warning',
          title:       'Stock ocupado',
          description: 'Reintentando automáticamente...',
          duration:    2000,
        })
        break

      // 'modal', 'inline', 'silent' → el componente los maneja
      default:
        break
    }

    return action
  }

  return { handle, classifyError }
}

// ── Helpers puntuales ────────────────────────────────────────────

/** Extrae los detalles tipados de un error INSUFFICIENT_STOCK. */
export function getStockDetails(error: ApiError): InsufficientStockDetail[] {
  if (error.code !== API_CODES.INSUFFICIENT_STOCK) return []
  if (!Array.isArray(error.details)) return []
  return error.details as InsufficientStockDetail[]
}

/**
 * Convierte errores de validación del backend (VALIDATION_ERROR)
 * en un mapa field → mensaje para poblar formularios.
 *
 * Espera details con forma: Array<{ field: string; message: string }>
 * o un objeto { field: message }.
 */
export function getValidationMap(error: ApiError): Record<string, string> {
  if (error.code !== API_CODES.VALIDATION_ERROR || !error.details) return {}

  if (Array.isArray(error.details)) {
    return Object.fromEntries(
      (error.details as Array<{ field: string; message: string }>)
        .filter(d => d.field && d.message)
        .map(d => [d.field, d.message]),
    )
  }

  if (typeof error.details === 'object') {
    return error.details as Record<string, string>
  }

  return {}
}
