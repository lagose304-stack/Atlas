-- ============================================================
-- Atlas de Histologia - Auditoria de seguridad
-- Crea tabla para registrar eventos de autenticacion y acceso
-- ============================================================

CREATE TABLE IF NOT EXISTS public.security_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  event_type VARCHAR(60) NOT NULL,
  user_id INTEGER NULL,
  username VARCHAR(255) NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_audit_logs_created_at
  ON public.security_audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_audit_logs_event_type
  ON public.security_audit_logs (event_type);

CREATE INDEX IF NOT EXISTS idx_security_audit_logs_user_id
  ON public.security_audit_logs (user_id);

ALTER TABLE public.security_audit_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'security_audit_logs'
      AND policyname = 'Permitir insercion de auditoria'
  ) THEN
    CREATE POLICY "Permitir insercion de auditoria"
      ON public.security_audit_logs
      FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'security_audit_logs'
      AND policyname = 'Permitir lectura de auditoria'
  ) THEN
    CREATE POLICY "Permitir lectura de auditoria"
      ON public.security_audit_logs
      FOR SELECT
      USING (true);
  END IF;
END $$;
