ALTER TABLE public.prueba_preguntas
  ADD COLUMN IF NOT EXISTS retroalimentacion TEXT NOT NULL DEFAULT '';

ALTER TABLE public.prueba_preguntas
  DROP COLUMN IF EXISTS descripcion;

DROP FUNCTION IF EXISTS public.guardar_prueba_completa(UUID, TEXT, TEXT, JSONB);

-- Añade columna para asociar una imagen a la prueba
ALTER TABLE public.pruebas
  ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT '';

CREATE OR REPLACE FUNCTION public.guardar_prueba_completa(
  p_prueba_id UUID,
  p_nombre TEXT,
  p_instrucciones TEXT,
  p_preguntas JSONB
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_pregunta JSONB;
  v_pregunta_id UUID;
  v_opcion JSONB;
BEGIN
  UPDATE public.pruebas
  SET nombre = p_nombre,
      instrucciones = p_instrucciones
  WHERE id = p_prueba_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe la prueba %', p_prueba_id;
  END IF;

  DELETE FROM public.prueba_preguntas
  WHERE prueba_id = p_prueba_id;

  FOR v_pregunta IN
    SELECT *
    FROM jsonb_array_elements(COALESCE(p_preguntas, '[]'::jsonb))
  LOOP
    INSERT INTO public.prueba_preguntas (
      prueba_id,
      sort_order,
      tipo,
      titulo,
      retroalimentacion,
      required,
      reference_placa_id,
      reference_photo_url,
      reference_tema_name,
      reference_subtema_name,
      reference_senalado_x,
      reference_senalado_y,
      reference_senalado_start_x,
      reference_senalado_start_y
    )
    VALUES (
      p_prueba_id,
      COALESCE((v_pregunta->>'sortOrder')::integer, 0),
      'single_choice',
      COALESCE(v_pregunta->>'title', ''),
      COALESCE(v_pregunta->>'retroalimentacion', ''),
      COALESCE((v_pregunta->>'required')::boolean, TRUE),
      NULLIF(v_pregunta->>'referencePlacaId', '')::integer,
      NULLIF(v_pregunta->>'referencePhotoUrl', ''),
      NULLIF(v_pregunta->>'referenceTemaName', ''),
      NULLIF(v_pregunta->>'referenceSubtemaName', ''),
      NULLIF(v_pregunta->'referenceSenaladoLocation'->>'x', '')::numeric,
      NULLIF(v_pregunta->'referenceSenaladoLocation'->>'y', '')::numeric,
      NULLIF(v_pregunta->'referenceSenaladoLocation'->>'startX', '')::numeric,
      NULLIF(v_pregunta->'referenceSenaladoLocation'->>'startY', '')::numeric
    )
    RETURNING id INTO v_pregunta_id;

    FOR v_opcion IN
      SELECT *
      FROM jsonb_array_elements(COALESCE(v_pregunta->'options', '[]'::jsonb))
    LOOP
      INSERT INTO public.prueba_pregunta_opciones (
        pregunta_id,
        sort_order,
        texto,
        is_correct
      )
      VALUES (
        v_pregunta_id,
        COALESCE((v_opcion->>'sortOrder')::integer, 0),
        COALESCE(v_opcion->>'text', ''),
        COALESCE((v_opcion->>'isCorrect')::boolean, FALSE)
      );
    END LOOP;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.guardar_prueba_completa(UUID, TEXT, TEXT, JSONB) TO anon, authenticated;
