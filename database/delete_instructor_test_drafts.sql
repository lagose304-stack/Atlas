-- Requiere setup_instructor_question_bank.sql y sus dependencias.
-- Habilita la eliminación individual de configuraciones sin historial.
-- La instalación no elimina filas.
BEGIN;

CREATE OR REPLACE FUNCTION public.atlas_can_delete_instructor_draft(p_test public.instructor_tests)
RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT p_test.estado = 'borrador'
    AND p_test.published IS NULL
    AND p_test.published_revision IS NULL
    AND p_test.attempt_revision IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.instructor_test_access WHERE test_id = p_test.id)
    AND NOT EXISTS (SELECT 1 FROM public.instructor_test_attempts WHERE test_id = p_test.id)
    AND NOT EXISTS (SELECT 1 FROM public.instructor_test_progress WHERE test_id = p_test.id)
    AND NOT EXISTS (SELECT 1 FROM public.instructor_test_submissions WHERE test_id = p_test.id);
$$;
REVOKE ALL ON FUNCTION public.atlas_can_delete_instructor_draft(public.instructor_tests) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.atlas_delete_instructor_draft(p_id uuid, p_revision integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.instructor_tests%ROWTYPE;
BEGIN
  PERFORM public.atlas_require_instructor_manager();
  SELECT * INTO v FROM public.instructor_tests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', true); END IF;
  IF v.revision IS DISTINCT FROM p_revision THEN
    RAISE EXCEPTION 'Otra persona modificó esta prueba. Vuelve a abrirla.' USING ERRCODE = '40001';
  END IF;
  IF NOT public.atlas_can_delete_instructor_draft(v) THEN
    RAISE EXCEPTION 'Solo se puede eliminar un borrador sin historial de publicación, intentos ni entregas';
  END IF;
  DELETE FROM public.instructor_tests WHERE id = v.id;
  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE ALL ON FUNCTION public.atlas_delete_instructor_draft(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.atlas_delete_instructor_draft(uuid, integer) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.atlas_list_instructor_tests()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.atlas_require_instructor_manager();
  RETURN coalesce((SELECT jsonb_agg(x) FROM (
    SELECT t.id, t.draft->>'nombre' AS nombre, t.estado, t.revision, t.published_revision, t.updated_at,
      public.atlas_can_delete_instructor_draft(t) AS can_delete_draft,
      CASE WHEN t.draft->>'mode' = 'bank' THEN 'bank' ELSE 'legacy' END AS mode,
      CASE
        WHEN t.draft->>'mode' = 'bank' THEN 0
        WHEN jsonb_typeof(t.draft->'groups') = 'array' THEN jsonb_array_length(t.draft->'groups')
        WHEN jsonb_typeof(t.draft->'questions') = 'array' THEN jsonb_array_length(t.draft->'questions')
        ELSE 0
      END AS legacy_question_count
    FROM public.instructor_tests t ORDER BY t.updated_at DESC, t.id LIMIT 100
  ) x), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.atlas_get_instructor_test(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.instructor_tests%ROWTYPE;
BEGIN
  PERFORM public.atlas_require_instructor_manager();
  SELECT * INTO STRICT v FROM public.instructor_tests WHERE id = p_id;
  RETURN jsonb_build_object('id',v.id,'content',v.draft,'estado',v.estado,'revision',v.revision,
    'published_revision',v.published_revision,'has_code',v.code_hash IS NOT NULL,
    'can_delete_draft',public.atlas_can_delete_instructor_draft(v));
END;
$$;

CREATE OR REPLACE FUNCTION public.atlas_save_instructor_test(p_id uuid, p_revision integer, p_content jsonb, p_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v public.instructor_tests%ROWTYPE; v_actor integer; v_hash text;
BEGIN
  v_actor := public.atlas_require_instructor_manager();
  PERFORM public.atlas_validate_instructor_content(p_content, false);
  IF p_code IS NOT NULL AND p_code !~ '^[0-9]{6}$' THEN
    RAISE EXCEPTION 'El código debe tener exactamente 6 dígitos';
  END IF;
  IF p_code IS NOT NULL THEN v_hash := crypt(p_code, gen_salt('bf', 10)); END IF;
  IF p_id IS NULL THEN
    INSERT INTO public.instructor_tests(draft,code_hash,updated_by)
      VALUES (p_content,v_hash,v_actor) RETURNING * INTO v;
  ELSE
    SELECT * INTO STRICT v FROM public.instructor_tests WHERE id = p_id FOR UPDATE;
    IF p_revision IS DISTINCT FROM v.revision THEN
      RAISE EXCEPTION 'Otra persona modificó esta prueba. Vuelve a abrirla.' USING ERRCODE = '40001';
    END IF;
    UPDATE public.instructor_tests SET draft = p_content, revision = revision + 1,
      code_hash = coalesce(v_hash,code_hash), access_version = access_version + CASE WHEN v_hash IS NULL THEN 0 ELSE 1 END,
      updated_by = v_actor, updated_at = now() WHERE id = p_id RETURNING * INTO v;
  END IF;
  RETURN jsonb_build_object('id',v.id,'content',v.draft,'estado',v.estado,'revision',v.revision,
    'published_revision',v.published_revision,'has_code',v.code_hash IS NOT NULL,
    'can_delete_draft',public.atlas_can_delete_instructor_draft(v));
END;
$$;

COMMIT;
