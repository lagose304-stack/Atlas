-- Recuperación conservadora: deshabilita solo las RPC del sistema nuevo.
-- NO ejecutar sin autorización de producción. Conserva tablas, preguntas y resultados.
-- Para reactivar, restaurar los GRANT EXECUTE de setup_instructor_tests.sql;
-- no volver a ejecutar CREATE TABLE ni el script completo de instalación.
BEGIN;
REVOKE ALL ON FUNCTION public.atlas_list_instructor_tests(), public.atlas_get_instructor_test(uuid),
  public.atlas_save_instructor_test(uuid,integer,jsonb,text), public.atlas_publish_instructor_test(uuid,integer,boolean),
  public.atlas_public_instructor_tests(), public.atlas_unlock_instructor_test(uuid,text),
  public.atlas_grade_instructor_test(uuid,text,jsonb) FROM PUBLIC, anon, authenticated;
COMMIT;
