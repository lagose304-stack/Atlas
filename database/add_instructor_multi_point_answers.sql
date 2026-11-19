-- Preparacion local: no ejecutar sin revisar y autorizar produccion.
-- Requiere add_instructor_point_questions.sql. Permite uno (objeto {x,y,text}) o varios
-- senalados en orden (arreglo de 1 a 20 objetos {x,y,text}) en incisos image_point,
-- exigiendo una respuesta breve (text) ligada a cada senalado.
BEGIN;

CREATE OR REPLACE FUNCTION public.atlas_validate_instructor_point_answer(p_answer jsonb)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_item jsonb; v_key text;
BEGIN
  IF p_answer IS NULL THEN RAISE EXCEPTION 'Coloca al menos un señalado en la imagen'; END IF;
  IF jsonb_typeof(p_answer) = 'object' THEN
    FOREACH v_key IN ARRAY ARRAY['x','y'] LOOP
      IF jsonb_typeof(p_answer->v_key) IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Coloca al menos un señalado en la imagen'; END IF;
      IF (p_answer->>v_key)::numeric NOT BETWEEN 0 AND 1 THEN RAISE EXCEPTION 'El señalado debe quedar dentro de la imagen'; END IF;
    END LOOP;
    IF jsonb_typeof(p_answer->'text') IS DISTINCT FROM 'string' OR length(p_answer->>'text') > 1000 OR public.atlas_normalize_instructor_answer(p_answer->>'text') = '' THEN
      RAISE EXCEPTION 'Escribe una respuesta breve para cada señalado';
    END IF;
    RETURN;
  END IF;
  IF jsonb_typeof(p_answer) IS DISTINCT FROM 'array' OR jsonb_array_length(p_answer) NOT BETWEEN 1 AND 20 THEN
    RAISE EXCEPTION 'Coloca entre 1 y 20 señalados en la imagen';
  END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_answer) LOOP
    IF jsonb_typeof(v_item) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Señalado inválido en la respuesta'; END IF;
    FOREACH v_key IN ARRAY ARRAY['x','y'] LOOP
      IF jsonb_typeof(v_item->v_key) IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Señalado inválido en la respuesta'; END IF;
      IF (v_item->>v_key)::numeric NOT BETWEEN 0 AND 1 THEN RAISE EXCEPTION 'El señalado debe quedar dentro de la imagen'; END IF;
    END LOOP;
    IF jsonb_typeof(v_item->'text') IS DISTINCT FROM 'string' OR length(v_item->>'text') > 1000 OR public.atlas_normalize_instructor_answer(v_item->>'text') = '' THEN
      RAISE EXCEPTION 'Escribe una respuesta breve para cada señalado';
    END IF;
  END LOOP;
END;
$$;

COMMIT;
