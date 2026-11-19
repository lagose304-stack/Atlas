-- Respaldo/reversion de setup_instructor_question_bank.sql.
-- No elimina datos de instructor_question_bank por seguridad (solo revoca acceso RPC).
BEGIN;

REVOKE ALL ON FUNCTION
  public.atlas_list_instructor_bank(),
  public.atlas_get_instructor_bank_topic(integer),
  public.atlas_save_instructor_bank_topic(integer,integer,jsonb),
  public.atlas_migrate_instructor_question_to_bank(uuid,integer,text,integer)
FROM PUBLIC, anon, authenticated;

DROP FUNCTION IF EXISTS public.atlas_draw_instructor_bank_content(jsonb);

CREATE OR REPLACE FUNCTION public.atlas_list_instructor_tests()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.atlas_require_instructor_manager();
  RETURN coalesce((SELECT jsonb_agg(x) FROM (
    SELECT id, draft->>'nombre' AS nombre, estado, revision, published_revision, updated_at
    FROM public.instructor_tests ORDER BY updated_at DESC, id LIMIT 100
  ) x), '[]'::jsonb);
END;
$$;

COMMIT;
