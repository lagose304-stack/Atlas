-- Rollback del sistema de borrador y publicación de public.placas
-- Restaura la política SELECT abierta, la firma anterior de classify_waiting_plate
-- y elimina el índice y la columna is_published.

BEGIN;

DROP POLICY IF EXISTS atlas_public_read ON public.placas;
CREATE POLICY atlas_public_read ON public.placas
  FOR SELECT
  USING (true);

DROP FUNCTION IF EXISTS public.classify_waiting_plate(
  BIGINT, INTEGER, INTEGER, TEXT, TEXT[], JSONB, TEXT, TEXT, TEXT, BOOLEAN
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
  p_photo_url TEXT DEFAULT NULL
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
    sort_order
  ) VALUES (
    v_final_photo_url,
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

GRANT EXECUTE ON FUNCTION public.classify_waiting_plate(
  BIGINT, INTEGER, INTEGER, TEXT, TEXT[], JSONB, TEXT, TEXT, TEXT
) TO anon, authenticated;

DROP INDEX IF EXISTS public.idx_placas_subtema_published_sort;

ALTER TABLE public.placas
  DROP COLUMN IF EXISTS is_published;

COMMIT;
