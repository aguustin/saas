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

export interface RegisterBody {
  business_name: string
  email:         string
  password:      string
  country?:      string
  device_id:     string
  device_name?:  string
}

export interface RegisterResponse extends TokenPair {
  tenant_id: string
}

export const authApi = {
  register(body: RegisterBody): Promise<RegisterResponse> {
    return http.post<RegisterResponse>('/auth/register', body).then(r => r.data)
  },

  login(body: LoginBody): Promise<TokenPair> {
    return http.post<TokenPair>('/auth/login', body).then(r => r.data)
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
