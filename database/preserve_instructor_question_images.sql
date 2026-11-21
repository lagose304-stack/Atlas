-- Requiere add_instructor_question_images.sql.
-- Conserva las imágenes al cambiar el formato, sin alterar la proyección pública.
BEGIN;

CREATE OR REPLACE FUNCTION public.atlas_validate_instructor_reference_image(p_question jsonb)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_type text := coalesce(p_question->>'type', 'single_choice');
BEGIN
  IF v_type = 'image_versus' THEN
    IF p_question ?| ARRAY['image', 'alternate_image'] THEN
      RAISE EXCEPTION 'El versus de imágenes usa image_a e image_b';
    END IF;
    IF p_question ? 'image_a' THEN PERFORM public.atlas_validate_instructor_image_object(p_question->'image_a', true); END IF;
    IF p_question ? 'image_b' THEN PERFORM public.atlas_validate_instructor_image_object(p_question->'image_b', true); END IF;
    RETURN;
  END IF;

  IF p_question ?| ARRAY['image_a', 'image_b'] THEN
    RAISE EXCEPTION 'Solo el versus de imágenes admite image_a e image_b';
  END IF;
  IF NOT (p_question ?| ARRAY['image', 'alternate_image']) THEN RETURN; END IF;
  IF v_type NOT IN ('single_choice', 'short_answer', 'completion', 'matching', 'image_point') THEN
    RAISE EXCEPTION 'La imagen debe ser una referencia válida de R2';
  END IF;
  -- En Señalar en imagen, la proyección pública usa solo la URL de image.
  IF p_question ? 'image' THEN PERFORM public.atlas_validate_instructor_image_object(p_question->'image', true); END IF;
  IF p_question ? 'alternate_image' THEN
    PERFORM public.atlas_validate_instructor_image_object(p_question->'alternate_image', true);
  END IF;
END;
$$;

COMMIT;
