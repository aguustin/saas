import { useState } from 'react'
import { Monitor, Smartphone, Globe, Trash2, LogOut, RefreshCw } from 'lucide-react'
import { useSessionManager } from '@/features/auth/hooks/useSessionManager'
import { useLogout } from '@/features/auth/hooks/useLogout'
import { Button } from '@/shared/components/ui/Button'
import { Badge } from '@/shared/components/ui/Badge'
import { Spinner } from '@/shared/components/ui/Skeleton'
import { ConfirmModal } from '@/shared/components/ui/Modal'
import { formatRelative } from '@/shared/utils/date'
import type { ActiveSession } from '@/shared/types'

// ── Helpers ──────────────────────────────────────────────────────

function deviceIcon(name: string | null) {
  if (!name) return <Globe size={16} />
  const n = name.toLowerCase()
  if (n.includes('android') || n.includes('ios') || n.includes('mobile')) {
    return <Smartphone size={16} />
  }
  return <Monitor size={16} />
}

// ── Componente de sesión individual ──────────────────────────────

interface SessionRowProps {
  session:   ActiveSession
  isCurrent: boolean
  onRevoke:  (id: string) => Promise<void>
}

function SessionRow({ session, isCurrent, onRevoke }: SessionRowProps) {
  const [revoking, setRevoking] = useState(false)
  const [confirm,  setConfirm]  = useState(false)

  async function handleRevoke() {
    setConfirm(false)
    setRevoking(true)
    try {
      await onRevoke(session.id)
    } finally {
      setRevoking(false)
    }
  }

  return (
    <>
      <div
        className={[
          'flex items-center gap-4 px-4 py-3 rounded-xl border transition-colors',
          isCurrent
            ? 'border-brand-200 bg-brand-50 dark:bg-brand-950/30 dark:border-brand-800'
            : 'border-gray-100 bg-white dark:bg-gray-900 dark:border-gray-800',
        ].join(' ')}
      >
        {/* Ícono de dispositivo */}
        <div
          className={[
            'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
            isCurrent
              ? 'bg-brand-100 text-brand-600 dark:bg-brand-900 dark:text-brand-400'
              : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
          ].join(' ')}
        >
          {deviceIcon(session.device_name)}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {session.device_name ?? 'Dispositivo desconocido'}
            </span>
            {isCurrent && (
              <Badge variant="default" size="sm">Esta sesión</Badge>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
            {session.ip_address && (
              <span>{session.ip_address}</span>
            )}
            <span>
              Último acceso: {formatRelative(session.last_used_at)}
            </span>
          </div>
        </div>

        {/* Acción */}
        {!isCurrent && (
          <Button
            variant="ghost"
            size="sm"
            loading={revoking}
            onClick={() => setConfirm(true)}
            leftIcon={<Trash2 size={14} />}
            className="text-red-500 hover:text-red-700 hover:bg-red-50
                       dark:hover:bg-red-950/30 shrink-0"
          >
            Revocar
          </Button>
        )}
      </div>

      <ConfirmModal
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={handleRevoke}
        title="¿Revocar esta sesión?"
        description={`Se cerrará la sesión en "${session.device_name ?? 'este dispositivo'}". Deberá iniciar sesión de nuevo en ese dispositivo.`}
        confirmLabel="Revocar"
        danger
      />
    </>
  )
}

// ── Componente principal ──────────────────────────────────────────

export function SessionList() {
  const {
    sessions,
    loading,
    currentSession,
    otherSessions,
    revoke,
    revokeAll,
    refresh,
  } = useSessionManager()

  const { logout } = useLogout()

  const [confirmRevokeAll, setConfirmRevokeAll] = useState(false)
  const [revokingAll,      setRevokingAll]      = useState(false)

  async function handleRevokeAll() {
    setConfirmRevokeAll(false)
    setRevokingAll(true)
    try {
      await revokeAll()
    } finally {
      setRevokingAll(false)
    }
  }

  if (loading && sessions.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size={24} />
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* Header con acciones globales */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Sesiones activas
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {sessions.length} {sessions.length === 1 ? 'dispositivo conectado' : 'dispositivos conectados'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            loading={loading}
            onClick={refresh}
            leftIcon={<RefreshCw size={14} />}
          >
            Actualizar
          </Button>

          {otherSessions.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              loading={revokingAll}
              onClick={() => setConfirmRevokeAll(true)}
              leftIcon={<LogOut size={14} />}
              className="text-red-600 border-red-200 hover:bg-red-50
                         dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950/30"
            >
              Revocar otros ({otherSessions.length})
            </Button>
          )}
        </div>
      </div>

      {/* Lista de sesiones: primero la actual */}
      <div className="space-y-2">
        {currentSession && (
          <SessionRow
            key={currentSession.id}
            session={currentSession}
            isCurrent
            onRevoke={revoke}
          />
        )}

        {otherSessions.map(session => (
          <SessionRow
            key={session.id}
            session={session}
            isCurrent={false}
            onRevoke={revoke}
          />
        ))}

        {sessions.length === 0 && (
          <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">
            No hay sesiones activas.
          </p>
        )}
      </div>

      {/* Cerrar sesión en este dispositivo */}
      <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => logout(false)}
          leftIcon={<LogOut size={14} />}
          className="text-gray-500 hover:text-red-600 dark:hover:text-red-400"
        >
          Cerrar sesión en este dispositivo
        </Button>
      </div>

      {/* Confirm revocar todo */}
      <ConfirmModal
        open={confirmRevokeAll}
        onClose={() => setConfirmRevokeAll(false)}
        onConfirm={handleRevokeAll}
        title={`¿Revocar ${otherSessions.length} sesión${otherSessions.length !== 1 ? 'es' : ''}?`}
        description="Se cerrarán todas las sesiones activas en otros dispositivos. Deberán iniciar sesión de nuevo."
        confirmLabel="Revocar todas"
        loading={revokingAll}
        danger
      />

    </div>
  )
}
