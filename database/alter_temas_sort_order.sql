-- Agregar columna sort_order a la tabla temas
-- Ejecuta este script en el Editor SQL de Supabase Dashboard

ALTER TABLE temas ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

ALTER TABLE public.temas ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.temas TO anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'temas'
      AND policyname = 'Permitir lectura de temas'
  ) THEN
    CREATE POLICY "Permitir lectura de temas"
      ON public.temas
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
      AND tablename = 'temas'
      AND policyname = 'Permitir insercion de temas'
  ) THEN
    CREATE POLICY "Permitir insercion de temas"
      ON public.temas
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
      AND tablename = 'temas'
      AND policyname = 'Permitir actualizacion de temas'
  ) THEN
    CREATE POLICY "Permitir actualizacion de temas"
      ON public.temas
      FOR UPDATE
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'temas'
      AND policyname = 'Permitir eliminacion de temas'
  ) THEN
    CREATE POLICY "Permitir eliminacion de temas"
      ON public.temas
      FOR DELETE
      USING (true);
  END IF;
END $$;

-- Inicializar sort_order con el orden actual (por nombre, dentro de cada parcial)
-- Esto asigna valores 0, 1, 2... a cada tema según su nombre, por parcial
WITH ordenados AS (
  SELECT id,
    ROW_NUMBER() OVER (PARTITION BY parcial ORDER BY nombre ASC) - 1 AS nuevo_orden
  FROM temas
)
UPDATE temas
SET sort_order = ordenados.nuevo_orden
FROM ordenados
WHERE temas.id = ordenados.id;
