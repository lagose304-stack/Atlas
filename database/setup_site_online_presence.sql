-- ============================================================
-- Atlas de Histologia - Presencia en linea del sitio
-- Cuenta usuarios activos en cualquier parte del sitio
-- ============================================================

CREATE TABLE IF NOT EXISTS public.site_online_presence (
  visitor_id VARCHAR(120) PRIMARY KEY,
  last_seen TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_site_online_presence_last_seen
  ON public.site_online_presence (last_seen DESC);

ALTER TABLE public.site_online_presence ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'site_online_presence'
      AND policyname = 'Permitir lectura de presencia'
  ) THEN
    CREATE POLICY "Permitir lectura de presencia"
      ON public.site_online_presence
      FOR SELECT
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'site_online_presence'
      AND policyname = 'Permitir insercion de presencia'
  ) THEN
    CREATE POLICY "Permitir insercion de presencia"
      ON public.site_online_presence
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
      AND tablename = 'site_online_presence'
      AND policyname = 'Permitir actualizacion de presencia'
  ) THEN
    CREATE POLICY "Permitir actualizacion de presencia"
      ON public.site_online_presence
      FOR UPDATE
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
