-- ============================================================
-- Atlas de Histologia - Auditoria de acciones sobre placas
-- Registra quien crea, edita/reasigna y elimina placas
-- ============================================================

CREATE TABLE IF NOT EXISTS public.placas_activity_logs (
  id BIGSERIAL PRIMARY KEY,
  action_type VARCHAR(50) NOT NULL,
  placa_id INTEGER NULL,
  waiting_plate_id INTEGER NULL,
  target_table VARCHAR(40) NOT NULL,
  actor_user_id INTEGER NULL,
  actor_username VARCHAR(120) NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT placas_activity_logs_action_type_check CHECK (
    action_type IN (
      'upload_classified',
      'upload_unclassified',
      'classify_waiting_plate',
      'edit_plate',
      'delete_classified',
      'delete_unclassified'
    )
  ),
  CONSTRAINT placas_activity_logs_target_table_check CHECK (
    target_table IN ('placas', 'placas_sin_clasificar')
  )
);

CREATE INDEX IF NOT EXISTS idx_placas_activity_logs_created_at
  ON public.placas_activity_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_placas_activity_logs_action_type
  ON public.placas_activity_logs (action_type);

CREATE INDEX IF NOT EXISTS idx_placas_activity_logs_placa_id
  ON public.placas_activity_logs (placa_id);

CREATE INDEX IF NOT EXISTS idx_placas_activity_logs_waiting_plate_id
  ON public.placas_activity_logs (waiting_plate_id);

CREATE INDEX IF NOT EXISTS idx_placas_activity_logs_actor_user_id
  ON public.placas_activity_logs (actor_user_id);

ALTER TABLE public.placas_activity_logs ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.placas_activity_logs TO anon;
GRANT SELECT, INSERT ON public.placas_activity_logs TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'placas_activity_logs'
      AND policyname = 'Permitir insercion de auditoria de placas'
  ) THEN
    CREATE POLICY "Permitir insercion de auditoria de placas"
      ON public.placas_activity_logs
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
      AND tablename = 'placas_activity_logs'
      AND policyname = 'Permitir lectura de auditoria de placas'
  ) THEN
    CREATE POLICY "Permitir lectura de auditoria de placas"
      ON public.placas_activity_logs
      FOR SELECT
      USING (true);
  END IF;
END $$;
