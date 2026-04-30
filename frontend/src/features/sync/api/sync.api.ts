import { http } from '@/shared/api/client'
import type {
  PullResponse,
  PushResponse,
  SyncStatusResponse,
  SyncableTable,
} from '@/shared/types'
import type { CreateSaleBody } from '@/features/sales/api/sales.api'

export interface SyncPullParams {
  device_id:  string
  tables:     SyncableTable[]
  cursors:    Partial<Record<SyncableTable, number>>
  page_size?: number
}

export type SyncOperation = 'INSERT' | 'UPDATE' | 'DELETE'

export interface SyncChange {
  table:        SyncableTable
  operation:    SyncOperation
  sync_id:      string
  base_version: number
  payload:      CreateSaleBody | Record<string, unknown>
}

export interface SyncPushParams {
  device_id: string
  changes:   SyncChange[]
}

export const syncApi = {
  pull(params: SyncPullParams): Promise<PullResponse> {
    // Transforma el objeto cursors a cursors[table]=N para query string
    const { device_id, tables, cursors, page_size } = params
    const queryParams: Record<string, unknown> = {
      device_id,
      tables: tables.join(','),
      page_size,
    }
    for (const [table, cursor] of Object.entries(cursors)) {
      queryParams[`cursors[${table}]`] = cursor
    }
    return http.get<PullResponse>('/sync/pull', { params: queryParams }).then(r => r.data)
  },

  push(params: SyncPushParams): Promise<PushResponse> {
    return http.post<PushResponse>('/sync/push', params).then(r => r.data)
  },

  status(deviceId: string): Promise<SyncStatusResponse> {
    return http.get<SyncStatusResponse>(`/sync/status/${deviceId}`).then(r => r.data)
  },
}
