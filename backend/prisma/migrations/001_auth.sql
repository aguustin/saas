-- Tabla de refresh tokens (schema global, no por tenant)
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL,
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL UNIQUE,          -- sha256(raw_token)
  device_id    TEXT NOT NULL,                 -- fingerprint del dispositivo
  device_name  TEXT,                          -- "Chrome en Windows", "Electron v1.2"
  ip_address   TEXT,
  user_agent   TEXT,
  expires_at   TIMESTAMPTZ NOT NULL,
  revoked_at   TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ DEFAULT now(),
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rt_user_tenant
  ON refresh_tokens(user_id, tenant_id)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_rt_token_hash
  ON refresh_tokens(token_hash)
  WHERE revoked_at IS NULL;

-- Una sola secuencia global para sync_version
CREATE SEQUENCE IF NOT EXISTS public.sync_version_seq
  START 1 INCREMENT 1 CACHE 100;
