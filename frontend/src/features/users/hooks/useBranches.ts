import { useEffect, useState } from 'react'
import { branchesApi, type BranchOption } from '@/features/users/api/branches.api'

export function useBranches() {
  const [branches, setBranches] = useState<BranchOption[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    let cancelled = false
    branchesApi.list()
      .then(data => { if (!cancelled) setBranches(data) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return { branches, loading }
}
