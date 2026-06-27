-- Agregar columna sort_order a la tabla subtemas
-- Ejecuta este script en el Editor SQL de Supabase Dashboard

ALTER TABLE subtemas ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

ALTER TABLE public.subtemas ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.subtemas TO anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'subtemas'
      AND policyname = 'Permitir lectura de subtemas'
  ) THEN
    CREATE POLICY "Permitir lectura de subtemas"
      ON public.subtemas
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
      AND tablename = 'subtemas'
      AND policyname = 'Permitir insercion de subtemas'
  ) THEN
    CREATE POLICY "Permitir insercion de subtemas"
      ON public.subtemas
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
      AND tablename = 'subtemas'
      AND policyname = 'Permitir actualizacion de subtemas'
  ) THEN
    CREATE POLICY "Permitir actualizacion de subtemas"
      ON public.subtemas
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
      AND tablename = 'subtemas'
      AND policyname = 'Permitir eliminacion de subtemas'
  ) THEN
    CREATE POLICY "Permitir eliminacion de subtemas"
      ON public.subtemas
      FOR DELETE
      USING (true);
  END IF;
END $$;

-- Inicializar sort_order con el orden actual (por nombre, dentro de cada tema)
WITH ordenados AS (
  SELECT id,
    ROW_NUMBER() OVER (PARTITION BY tema_id ORDER BY nombre ASC) - 1 AS nuevo_orden
  FROM subtemas
)
UPDATE subtemas
SET sort_order = ordenados.nuevo_orden
FROM ordenados
WHERE subtemas.id = ordenados.id;
