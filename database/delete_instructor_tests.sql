-- Requiere setup_instructor_question_bank.sql y resume_instructor_tests_by_account.sql.
-- La instalación solo añade la RPC. El borrado requiere confirmación en el listado.
BEGIN;

CREATE FUNCTION public.atlas_delete_instructor_test(p_id uuid, p_revision integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.instructor_tests%ROWTYPE;
BEGIN
  PERFORM public.atlas_require_instructor_manager();
  SELECT * INTO v FROM public.instructor_tests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', true); END IF;
  IF v.revision IS DISTINCT FROM p_revision THEN
    RAISE EXCEPTION 'Otra persona modificó esta prueba. Actualiza el listado antes de eliminarla.';
  END IF;
  IF (v.draft->>'mode') IS DISTINCT FROM 'bank' THEN
    RAISE EXCEPTION 'Solo se pueden eliminar pruebas configuradas desde el banco.';
  END IF;

  DELETE FROM public.instructor_test_access WHERE test_id = v.id;
  DELETE FROM public.instructor_test_progress WHERE test_id = v.id;
  DELETE FROM public.instructor_test_submissions WHERE test_id = v.id;
  -- La clave foránea elimina los intentos asociados al borrar la prueba.
  DELETE FROM public.instructor_tests WHERE id = v.id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.atlas_delete_instructor_test(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.atlas_delete_instructor_test(uuid, integer) TO anon, authenticated;

COMMIT;
