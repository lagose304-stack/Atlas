-- Preparacion local. Requiere resume_instructor_tests_by_account.sql.
-- Crea el control, NO borra datos al instalarse. Autorizar antes de aplicar en produccion.
BEGIN;
CREATE FUNCTION public.atlas_delete_instructor_submission(p_test_id uuid,p_id uuid,p_revision integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.instructor_test_submissions%ROWTYPE;
BEGIN
  PERFORM public.atlas_require_instructor_manager();
  -- Serializa la eliminacion con inicios, recuperaciones, guardados y entregas de esta prueba.
  PERFORM 1 FROM public.instructor_tests WHERE id=p_test_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Prueba no disponible'; END IF;
  SELECT * INTO s FROM public.instructor_test_submissions WHERE id=p_id AND test_id=p_test_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',true); END IF;
  IF p_revision IS DISTINCT FROM s.revision THEN
    RAISE EXCEPTION 'La entrega cambio. Actualiza el listado antes de eliminarla' USING ERRCODE='40001';
  END IF;
  DELETE FROM public.instructor_test_access WHERE test_id=p_test_id AND
    (token_hash=s.token_hash OR progress_id IN (SELECT id FROM public.instructor_test_progress WHERE submission_id=s.id AND test_id=p_test_id));
  DELETE FROM public.instructor_test_progress WHERE submission_id=s.id AND test_id=p_test_id;
  DELETE FROM public.instructor_test_submissions WHERE id=s.id AND test_id=p_test_id;
  RETURN jsonb_build_object('ok',true);
END;
$$;
REVOKE ALL ON FUNCTION public.atlas_delete_instructor_submission(uuid,uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.atlas_delete_instructor_submission(uuid,uuid,integer) TO anon,authenticated;
COMMIT;
