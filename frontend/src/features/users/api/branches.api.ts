import { http } from '@/shared/api/client'

export interface BranchOption {
  id:   string
  name: string
}

export const branchesApi = {
  list(): Promise<BranchOption[]> {
    return http.get<BranchOption[]>('/branches').then(r => r.data)
  },
}
