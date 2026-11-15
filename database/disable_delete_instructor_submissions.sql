-- Recuperacion sin perdida: desactiva nuevas eliminaciones. No recupera filas borradas.
-- Requiere autorizacion antes de ejecutarse en produccion.
BEGIN;
REVOKE ALL ON FUNCTION public.atlas_delete_instructor_submission(uuid,uuid,integer) FROM PUBLIC,anon,authenticated;
COMMIT;
