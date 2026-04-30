import { http } from '@/shared/api/client'
import type { TokenPair, MeResponse, ActiveSession } from '@/shared/types'

export interface LoginBody {
  email:       string
  password:    string
  device_id:   string
  device_name: string
}

export interface LogoutBody {
  device_id:   string
  all_devices: boolean
}

export const authApi = {
  login(body: LoginBody, tenantId: string): Promise<TokenPair> {
    // _tenantId es consumido por el request interceptor para inyectar
    // el header X-Tenant-Id en lugar de Authorization: Bearer.
    return http
      .post<TokenPair>('/auth/login', body, { _tenantId: tenantId } as never)
      .then(r => r.data)
  },

  refresh(refreshToken: string, deviceId: string): Promise<TokenPair> {
    return http
      .post<TokenPair>('/auth/refresh', { refresh_token: refreshToken, device_id: deviceId })
      .then(r => r.data)
  },

  logout(body: LogoutBody): Promise<void> {
    return http.post('/auth/logout', body).then(() => undefined)
  },

  me(): Promise<MeResponse> {
    return http.get<MeResponse>('/auth/me').then(r => r.data)
  },

  sessions(): Promise<ActiveSession[]> {
    return http.get<ActiveSession[]>('/auth/sessions').then(r => r.data)
  },

  deleteSession(sessionId: string): Promise<void> {
    return http.delete(`/auth/sessions/${sessionId}`).then(() => undefined)
  },
}
