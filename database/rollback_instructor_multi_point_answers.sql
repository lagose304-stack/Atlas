-- Respaldo/reversion de add_instructor_multi_point_answers.sql.
-- Restaura la validacion de un unico senalado {x,y} en incisos image_point.
BEGIN;

CREATE OR REPLACE FUNCTION public.atlas_validate_instructor_point_answer(p_answer jsonb)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_key text;
BEGIN
  IF p_answer IS NULL OR jsonb_typeof(p_answer) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Coloca un senalado en la imagen'; END IF;
  FOREACH v_key IN ARRAY ARRAY['x','y'] LOOP
    IF jsonb_typeof(p_answer->v_key) IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Coloca un senalado en la imagen'; END IF;
    IF (p_answer->>v_key)::numeric NOT BETWEEN 0 AND 1 THEN RAISE EXCEPTION 'El senalado debe quedar dentro de la imagen'; END IF;
  END LOOP;
END;
$$;

COMMIT;
