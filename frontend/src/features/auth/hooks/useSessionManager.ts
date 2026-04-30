import { useEffect } from 'react'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { getDeviceId } from '@/shared/utils/device'
import type { ActiveSession } from '@/shared/types'

// ── Hook ─────────────────────────────────────────────────────────

interface UseSessionManagerReturn {
  sessions:        ActiveSession[]
  loading:         boolean
  currentSession:  ActiveSession | null
  otherSessions:   ActiveSession[]
  currentDeviceId: string
  refresh:         () => Promise<void>
  revoke:          (sessionId: string) => Promise<void>
  revokeAll:       () => Promise<void>
}

export function useSessionManager(): UseSessionManagerReturn {
  const sessions        = useAuthStore(s => s.sessions)
  const sessionsLoading = useAuthStore(s => s.sessionsLoading)
  const fetchSessions   = useAuthStore(s => s.fetchSessions)
  const deleteSession   = useAuthStore(s => s.deleteSession)

  const currentDeviceId = getDeviceId()

  // Cargar sesiones al montar
  useEffect(() => {
    fetchSessions()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // La sesión actual es la que tiene el device_id de este navegador/app.
  // Si el backend no la retorna (no debería ocurrir), currentSession es null.
  const currentSession = sessions.find(s => s.device_id === currentDeviceId) ?? null
  const otherSessions  = sessions.filter(s => s.device_id !== currentDeviceId)

  async function revoke(sessionId: string) {
    await deleteSession(sessionId)
  }

  async function revokeAll() {
    // Revocar todas las otras sesiones. Las errores individuales no deben
    // detener el proceso; se lanzan todos y el store ya hace rollback si falla.
    const results = await Promise.allSettled(
      otherSessions.map(s => deleteSession(s.id)),
    )

    // Si alguna falló, refresca para mostrar el estado real del servidor.
    const anyFailed = results.some(r => r.status === 'rejected')
    if (anyFailed) {
      await fetchSessions()
    }
  }

  return {
    sessions,
    loading:        sessionsLoading,
    currentSession,
    otherSessions,
    currentDeviceId,
    refresh:        fetchSessions,
    revoke,
    revokeAll,
  }
}
