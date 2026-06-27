-- Tabla para placas subidas sin clasificar (lista de espera)
CREATE TABLE IF NOT EXISTS placas_sin_clasificar (
  id          BIGSERIAL PRIMARY KEY,
  photo_url   TEXT NOT NULL,
  public_id   TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.placas_sin_clasificar ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON TABLE public.placas_sin_clasificar TO anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'placas_sin_clasificar'
      AND policyname = 'Permitir lectura de placas_sin_clasificar'
  ) THEN
    CREATE POLICY "Permitir lectura de placas_sin_clasificar"
      ON public.placas_sin_clasificar
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
      AND tablename = 'placas_sin_clasificar'
      AND policyname = 'Permitir insercion de placas_sin_clasificar'
  ) THEN
    CREATE POLICY "Permitir insercion de placas_sin_clasificar"
      ON public.placas_sin_clasificar
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
      AND tablename = 'placas_sin_clasificar'
      AND policyname = 'Permitir eliminacion de placas_sin_clasificar'
  ) THEN
    CREATE POLICY "Permitir eliminacion de placas_sin_clasificar"
      ON public.placas_sin_clasificar
      FOR DELETE
      USING (true);
  END IF;
END $$;
