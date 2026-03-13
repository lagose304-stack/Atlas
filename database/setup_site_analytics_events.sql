-- ============================================================
-- Atlas de Histologia - Analitica de visitas y consultas
-- Registra visitas del sitio y consultas de tema/subtema/placa
-- ============================================================

CREATE TABLE IF NOT EXISTS public.site_analytics_events (
  id BIGSERIAL PRIMARY KEY,
  event_type VARCHAR(40) NOT NULL,
  visitor_id VARCHAR(120) NOT NULL,
  tema_id INTEGER NULL,
  subtema_id INTEGER NULL,
  placa_id INTEGER NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT site_analytics_events_event_type_check CHECK (
    event_type IN ('site_visit', 'tema_view', 'subtema_view', 'placa_view')
  )
);

CREATE INDEX IF NOT EXISTS idx_site_analytics_events_created_at
  ON public.site_analytics_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_site_analytics_events_event_type
  ON public.site_analytics_events (event_type);

CREATE INDEX IF NOT EXISTS idx_site_analytics_events_tema_id
  ON public.site_analytics_events (tema_id);

CREATE INDEX IF NOT EXISTS idx_site_analytics_events_subtema_id
  ON public.site_analytics_events (subtema_id);

CREATE INDEX IF NOT EXISTS idx_site_analytics_events_placa_id
  ON public.site_analytics_events (placa_id);

ALTER TABLE public.site_analytics_events ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON public.site_analytics_events TO anon;
GRANT SELECT, INSERT, DELETE ON public.site_analytics_events TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'site_analytics_events'
      AND policyname = 'Permitir insercion de analitica'
  ) THEN
    CREATE POLICY "Permitir insercion de analitica"
      ON public.site_analytics_events
      FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.reset_site_analytics_events()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.site_analytics_events;
  ALTER SEQUENCE IF EXISTS public.site_analytics_events_id_seq RESTART WITH 1;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_site_analytics_events() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_site_analytics_events() TO anon;
GRANT EXECUTE ON FUNCTION public.reset_site_analytics_events() TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'site_analytics_events'
      AND policyname = 'Permitir borrado de analitica'
  ) THEN
    CREATE POLICY "Permitir borrado de analitica"
      ON public.site_analytics_events
      FOR DELETE
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'site_analytics_events'
      AND policyname = 'Permitir lectura de analitica'
  ) THEN
    CREATE POLICY "Permitir lectura de analitica"
      ON public.site_analytics_events
      FOR SELECT
      USING (true);
  END IF;
END $$;
