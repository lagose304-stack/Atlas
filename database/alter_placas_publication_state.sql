-- Sistema de borrador y publicación para public.placas
-- 1) Las placas existentes conservan is_published = true (publicadas).
-- 2) Las nuevas placas nacen con is_published = false (borrador por defecto).
-- 3) Actualiza classify_waiting_plate con p_is_published BOOLEAN DEFAULT false.
-- 4) Refuerza RLS SELECT en public.placas para que usuarios sin rol editorial
--    solo lean placas publicadas.

BEGIN;

-- 1. Agregar columna con DEFAULT true para conservar publicadas todas las placas ya clasificadas
ALTER TABLE public.placas
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT true;

-- 2. Cambiar el valor por defecto para nuevas inserciones a borrador (false)
ALTER TABLE public.placas
  ALTER COLUMN is_published SET DEFAULT false;

-- 3. Índice compuesto para consultas públicas por subtema y orden
CREATE INDEX IF NOT EXISTS idx_placas_subtema_published_sort
  ON public.placas (subtema_id, is_published, sort_order);

-- 4. Reforzar política SELECT de public.placas (Opción A)
--    Elimina cualquier política SELECT previa (incluidas políticas legadas permisivas)
--    para garantizar que ninguna haga OR y exponga borradores.
ALTER TABLE public.placas ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'placas'
      AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.placas', r.policyname);
  END LOOP;
END $$;

CREATE POLICY atlas_public_read ON public.placas
  FOR SELECT
  USING (
    is_published = true
    OR public.atlas_has_role(ARRAY['Administrador', 'Microscopía'])
  );

-- 5. Reemplazar classify_waiting_plate añadiendo p_is_published BOOLEAN DEFAULT false
--    Se elimina primero la firma anterior de 9 argumentos para evitar sobrecargas ambiguas.
DROP FUNCTION IF EXISTS public.classify_waiting_plate(
  BIGINT, INTEGER, INTEGER, TEXT, TEXT[], JSONB, TEXT, TEXT, TEXT
);

CREATE OR REPLACE FUNCTION public.classify_waiting_plate(
  p_waiting_id BIGINT,
  p_tema_id INTEGER,
  p_subtema_id INTEGER,
  p_aumento TEXT DEFAULT NULL,
  p_senalados TEXT[] DEFAULT NULL,
  p_senalados_meta JSONB DEFAULT NULL,
  p_comentario TEXT DEFAULT NULL,
  p_tincion TEXT DEFAULT NULL,
  p_photo_url TEXT DEFAULT NULL,
  p_is_published BOOLEAN DEFAULT false
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
  v_final_photo_url TEXT;
BEGIN
  IF NOT public.atlas_has_role(ARRAY['Administrador', 'Microscopía']) THEN
    RAISE EXCEPTION 'No autorizado para clasificar placas.' USING ERRCODE = '42501';
  END IF;

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

  v_final_photo_url := COALESCE(NULLIF(TRIM(p_photo_url), ''), v_waiting.photo_url);

  INSERT INTO public.placas (
    photo_url,
    tema_id,
    subtema_id,
    aumento,
    senalados,
    senalados_meta,
    comentario,
    tincion,
    sort_order,
    is_published
  ) VALUES (
    v_final_photo_url,
    p_tema_id,
    p_subtema_id,
    p_aumento,
    p_senalados,
    p_senalados_meta,
    p_comentario,
    p_tincion,
    v_next_sort_order,
    COALESCE(p_is_published, false)
  )
  RETURNING id INTO v_new_placa_id;

  DELETE FROM public.placas_sin_clasificar
  WHERE id = p_waiting_id;

  RETURN v_new_placa_id;
END;
$$;

REVOKE ALL ON FUNCTION public.classify_waiting_plate(
  BIGINT, INTEGER, INTEGER, TEXT, TEXT[], JSONB, TEXT, TEXT, TEXT, BOOLEAN
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.classify_waiting_plate(
  BIGINT, INTEGER, INTEGER, TEXT, TEXT[], JSONB, TEXT, TEXT, TEXT, BOOLEAN
) TO anon, authenticated;

COMMIT;
