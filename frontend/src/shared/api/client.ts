/**
 * HTTP client central.
 *
 * Responsabilidades:
 *  1. Inyectar Authorization: Bearer en rutas protegidas
 *  2. Inyectar X-Tenant-Id solo en /auth/login
 *  3. Desenvolver el envelope { data, timestamp } de forma transparente
 *  4. Silent refresh en 401 con mutex (una sola promesa en vuelo)
 *  5. Retry con backoff exponencial en errores de red y 5xx
 *  6. Normalizar todos los errores al tipo ApiError
 */

import axios, {
  type AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { getDeviceId } from '@/shared/utils/device'
import type { ApiError, TokenPair } from '@/shared/types'

// ── Configuración ────────────────────────────────────────────────

export const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4003/api/v1'

const TIMEOUT_MS  = 15_000  // 15 s
const MAX_RETRIES = 3
const BASE_DELAY  = 600     // ms — se duplica por intento: 600, 1200, 2400

/** Rutas que no llevan Bearer token */
const AUTH_BYPASS = new Set(['/auth/login', '/auth/refresh'])

/**
 * Estados HTTP que justifican un reintento automático:
 * errores transitorios del servidor.
 * 501 Not Implemented se excluye porque nunca va a cambiar.
 */
const RETRYABLE_STATUSES = new Set([500, 502, 503, 504])

// ── Augmentación de tipos de Axios ───────────────────────────────

declare module 'axios' {
  interface InternalAxiosRequestConfig {
    /** Marca que ya se intentó un refresh para este request */
    _retry?:      boolean
    /** Número de reintentos automáticos realizados */
    _retryCount?: number
    /** tenant_id a inyectar como X-Tenant-Id (solo /auth/login) */
    _tenantId?:   string
  }
}

// ── Instancia Axios ──────────────────────────────────────────────

export const http = axios.create({
  baseURL: BASE_URL,
  timeout: TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
})

// ── Mutex de refresh ─────────────────────────────────────────────
//
// Problema que resuelve:
//   Si 5 requests fallan con 401 simultáneamente, sin el mutex se
//   lanzarían 5 llamadas a /auth/refresh. El backend detecta el
//   reuse del mismo refresh_token y revoca TODOS los tokens.
//
// Solución:
//   La primera request que llega crea la promesa. Las siguientes
//   await la misma promesa. Cuando resuelve, todas retoman con el
//   mismo access_token nuevo.

let refreshPromise: Promise<string> | null = null

async function doRefresh(): Promise<string> {
  const { refresh_token, setTokens, logout } = useAuthStore.getState()

  if (!refresh_token) {
    logout()
    throw Object.assign(new Error('no_refresh_token'), { code: 'NO_REFRESH_TOKEN' })
  }

  try {
    // Usamos axios base (NO nuestro `http`) para evitar que el
    // interceptor de error vuelva a capturar un 401 aquí y genere
    // un bucle infinito.
    const res = await axios.post<{ data: TokenPair; timestamp: string }>(
      `${BASE_URL}/auth/refresh`,
      {
        refresh_token,
        device_id: getDeviceId(),
      },
      { timeout: TIMEOUT_MS },
    )

    const pair = res.data.data
    setTokens(pair.access_token, pair.refresh_token)
    return pair.access_token
  } catch {
    // El refresh falló (token expirado, revocado o reuse detectado).
    // Limpiamos la sesión y propagamos para que la request original rechace.
    logout()
    throw Object.assign(new Error('refresh_failed'), { code: 'REFRESH_FAILED' })
  }
}

// ── Helpers de retry ─────────────────────────────────────────────

function isRetryable(error: AxiosError, attempt: number): boolean {
  if (attempt >= MAX_RETRIES) return false
  // Sin respuesta = error de red (timeout, DNS, conexión rechazada)
  if (!error.response) return true
  return RETRYABLE_STATUSES.has(error.response.status)
}

function backoff(attempt: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, BASE_DELAY * 2 ** attempt))
}

// ── 1. Request interceptor ───────────────────────────────────────
//
// Reglas de headers:
//   /auth/login  → X-Tenant-Id: <uuid> (sin Bearer, no hay token aún)
//   /auth/refresh → sin headers especiales (es pública)
//   resto        → Authorization: Bearer <access_token>

http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const url = config.url ?? ''

  if (AUTH_BYPASS.has(url)) {
    if (url === '/auth/login' && config._tenantId) {
      config.headers.set('X-Tenant-Id', config._tenantId)
    }
    return config
  }

  // `useAuthStore.getState()` es sincrónico; Zustand no necesita hook aquí.
  const token = useAuthStore.getState().access_token
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`)
  }

  return config
})

// ── 2. Response interceptor: desenvolver envelope ────────────────
//
// El backend SIEMPRE responde con { data: <payload>, timestamp: "..." }
// en los endpoints exitosos. Aquí lo desenvolvemos para que los
// callers reciban el payload directamente (sin .data.data).
//
// Excepción: 204 No Content (ej. logout) no tiene body → skip.

http.interceptors.response.use((response: AxiosResponse) => {
  const body = response.data

  if (
    body !== null &&
    body !== undefined &&
    typeof body === 'object' &&
    'data' in body &&
    'timestamp' in body
  ) {
    response.data = (body as { data: unknown; timestamp: string }).data
  }

  return response
})

// ── 3. Error interceptor ─────────────────────────────────────────
//
// Orden de evaluación:
//   a) 401 en ruta protegida → silent refresh → retry
//   b) Error de red o 5xx   → retry con backoff
//   c) Resto                → normalizar a ApiError y rechazar

http.interceptors.response.use(undefined, async (raw: AxiosError) => {
  const config = raw.config as InternalAxiosRequestConfig
  const status = raw.response?.status
  const url    = config?.url ?? ''

  // ── a) Silent refresh ──────────────────────────────────────────
  if (status === 401 && !config._retry && !AUTH_BYPASS.has(url)) {
    config._retry = true

    try {
      // Si ya hay un refresh en vuelo, esperamos el mismo.
      if (!refreshPromise) {
        refreshPromise = doRefresh().finally(() => {
          refreshPromise = null
        })
      }

      const newToken = await refreshPromise
      config.headers.set('Authorization', `Bearer ${newToken}`)
      // Retomar la request original con el nuevo token
      return http(config)
    } catch {
      // doRefresh ya llamó logout(); normalizamos y propagamos.
      return Promise.reject(buildApiError(raw))
    }
  }

  // ── b) Retry por error de red / 5xx ───────────────────────────
  const attempt = config._retryCount ?? 0

  if (isRetryable(raw, attempt)) {
    config._retryCount = attempt + 1
    await backoff(attempt)
    return http(config)
  }

  // ── c) Normalizar y propagar ───────────────────────────────────
  return Promise.reject(buildApiError(raw))
})

// ── Error builder ────────────────────────────────────────────────
//
// Garantiza que cualquier error que sale del cliente tenga la forma
// ApiError { statusCode, code, message, details }, sin importar si
// vino del backend o fue un error de red.

function buildApiError(error: AxiosError): ApiError {
  const body = error.response?.data as Record<string, unknown> | undefined

  return {
    statusCode: (body?.statusCode as number)  ?? error.response?.status ?? 0,
    code:       (body?.code       as string)  ?? deriveCode(error),
    message:    (body?.message    as string)  ?? error.message ?? 'Error desconocido',
    path:       (body?.path       as string)  ?? undefined,
    timestamp:  (body?.timestamp  as string)  ?? undefined,
    details:    body?.details,
  }
}

/**
 * Deriva un código semántico cuando el backend no envió uno.
 * Útil para errores de red, timeouts y respuestas HTTP sin body.
 */
function deriveCode(error: AxiosError): string {
  if (!error.response) {
    return error.code === 'ECONNABORTED' ? 'TIMEOUT' : 'NETWORK_ERROR'
  }

  const status = error.response.status
  const MAP: Record<number, string> = {
    400: 'VALIDATION_ERROR',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    409: 'DUPLICATE',
    422: 'HTTP_EXCEPTION',
    500: 'INTERNAL_ERROR',
  }

  return MAP[status] ?? (status >= 500 ? 'INTERNAL_ERROR' : 'HTTP_EXCEPTION')
}
