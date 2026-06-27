-- Migracion unica para corregir RLS en tablas publicas expuestas por PostgREST
-- Ejecuta este script completo en el Editor SQL de Supabase Dashboard

-- ============================================================
-- classify_waiting_plate RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.classify_waiting_plate(
  p_waiting_id BIGINT,
  p_tema_id INTEGER,
  p_subtema_id INTEGER,
  p_aumento TEXT DEFAULT NULL,
  p_senalados TEXT[] DEFAULT NULL,
  p_senalados_meta JSONB DEFAULT NULL,
  p_comentario TEXT DEFAULT NULL,
  p_tincion TEXT DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_waiting RECORD;
  v_new_placa_id BIGINT;
  v_next_sort_order INTEGER;
BEGIN
  SELECT *
  INTO v_waiting
  FROM public.placas_sin_clasificar
  WHERE id = p_waiting_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe la placa en lista de espera: %', p_waiting_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.subtemas
    WHERE id = p_subtema_id
      AND tema_id = p_tema_id
  ) THEN
    RAISE EXCEPTION 'La combinación tema/subtema no es válida (tema %, subtema %)', p_tema_id, p_subtema_id;
  END IF;

  SELECT COALESCE(MAX(sort_order), -1) + 1
  INTO v_next_sort_order
  FROM public.placas
  WHERE subtema_id = p_subtema_id;

  INSERT INTO public.placas (
    photo_url,
    tema_id,
    subtema_id,
    aumento,
    senalados,
    senalados_meta,
    comentario,
    tincion,
    sort_order
  ) VALUES (
    v_waiting.photo_url,
    p_tema_id,
    p_subtema_id,
    p_aumento,
    p_senalados,
    p_senalados_meta,
    p_comentario,
    p_tincion,
    v_next_sort_order
  )
  RETURNING id INTO v_new_placa_id;

  DELETE FROM public.placas_sin_clasificar
  WHERE id = p_waiting_id;

  RETURN v_new_placa_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.classify_waiting_plate(BIGINT, INTEGER, INTEGER, TEXT, TEXT[], JSONB, TEXT, TEXT)
TO anon, authenticated;

-- ============================================================
-- placas
-- ============================================================
ALTER TABLE public.placas ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.placas TO anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'placas'
      AND policyname = 'Permitir lectura de placas'
  ) THEN
    CREATE POLICY "Permitir lectura de placas"
      ON public.placas
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
      AND tablename = 'placas'
      AND policyname = 'Permitir insercion de placas'
  ) THEN
    CREATE POLICY "Permitir insercion de placas"
      ON public.placas
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
      AND tablename = 'placas'
      AND policyname = 'Permitir actualizacion de placas'
  ) THEN
    CREATE POLICY "Permitir actualizacion de placas"
      ON public.placas
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
      AND tablename = 'placas'
      AND policyname = 'Permitir eliminacion de placas'
  ) THEN
    CREATE POLICY "Permitir eliminacion de placas"
      ON public.placas
      FOR DELETE
      USING (true);
  END IF;
END $$;

-- ============================================================
-- placas_sin_clasificar
-- ============================================================
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

-- ============================================================
-- tinciones
-- ============================================================
ALTER TABLE public.tinciones ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tinciones TO anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tinciones'
      AND policyname = 'Permitir lectura de tinciones'
  ) THEN
    CREATE POLICY "Permitir lectura de tinciones"
      ON public.tinciones
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
      AND tablename = 'tinciones'
      AND policyname = 'Permitir insercion de tinciones'
  ) THEN
    CREATE POLICY "Permitir insercion de tinciones"
      ON public.tinciones
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
      AND tablename = 'tinciones'
      AND policyname = 'Permitir actualizacion de tinciones'
  ) THEN
    CREATE POLICY "Permitir actualizacion de tinciones"
      ON public.tinciones
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
      AND tablename = 'tinciones'
      AND policyname = 'Permitir eliminacion de tinciones'
  ) THEN
    CREATE POLICY "Permitir eliminacion de tinciones"
      ON public.tinciones
      FOR DELETE
      USING (true);
  END IF;
END $$;

-- ============================================================
-- temas
-- ============================================================
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

-- ============================================================
-- subtemas
-- ============================================================
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

-- ============================================================
-- Inicializacion de sort_order para migraciones antiguas
-- ============================================================
ALTER TABLE public.temas ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
ALTER TABLE public.subtemas ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

WITH temas_ordenados AS (
  SELECT id,
    ROW_NUMBER() OVER (PARTITION BY parcial ORDER BY nombre ASC) - 1 AS nuevo_orden
  FROM public.temas
)
UPDATE public.temas
SET sort_order = temas_ordenados.nuevo_orden
FROM temas_ordenados
WHERE public.temas.id = temas_ordenados.id;

WITH subtemas_ordenados AS (
  SELECT id,
    ROW_NUMBER() OVER (PARTITION BY tema_id ORDER BY nombre ASC) - 1 AS nuevo_orden
  FROM public.subtemas
)
UPDATE public.subtemas
SET sort_order = subtemas_ordenados.nuevo_orden
FROM subtemas_ordenados
WHERE public.subtemas.id = subtemas_ordenados.id;