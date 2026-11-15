-- Respaldo de la definición remota leída el 14 de noviembre de 2026.
-- Solo para recuperación autorizada: restaura también el fallo de UPDATE sin WHERE.
-- CREATE OR REPLACE conserva los privilegios existentes.
BEGIN;
CREATE OR REPLACE FUNCTION public.atlas_set_microscopy_chief(p_user_id integer, p_revision bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_actor integer; v_state public.atlas_microscopy_chief%ROWTYPE;
BEGIN
  -- Serializa transferencias; comprobar permisos DESPUÉS de obtener el bloqueo.
  SELECT * INTO STRICT v_state FROM public.atlas_microscopy_chief FOR UPDATE;
  v_actor := public.atlas_session_user_id();
  IF v_actor IS NULL OR (v_actor <> v_state.owner_id AND v_actor IS DISTINCT FROM v_state.user_id) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;
  IF p_revision IS DISTINCT FROM v_state.revision THEN
    RAISE EXCEPTION 'La jefatura cambió. Recarga e intenta de nuevo.' USING ERRCODE = '40001';
  END IF;
  IF p_user_id IS NOT NULL THEN
    PERFORM 1 FROM public.usuarios WHERE id = p_user_id AND activo AND rol = 'Administrador' FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'El usuario debe ser un Administrador activo'; END IF;
  END IF;
  UPDATE public.atlas_microscopy_chief
    SET user_id = p_user_id, revision = revision + 1;
END;
$function$;

COMMIT;
