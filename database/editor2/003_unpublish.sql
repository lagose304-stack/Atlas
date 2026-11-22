-- ============================================================
-- Atlas Editor de Páginas 2.0 (Fase 3 — Parte 4)
-- RPC para retirar la publicación v2 de una página y volver al
-- fallback v1 de forma instantánea, SIN borrar borrador ni versiones.
--
-- NO ejecutar en producción sin respaldo verificado y autorización explícita.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.editor2_unpublish_page(p_page_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = editor2, public
AS $$
DECLARE
  v_deleted integer := 0;
BEGIN
  PERFORM editor2.assert_session();

  IF p_page_key IS NULL OR btrim(p_page_key) = '' THEN
    RAISE EXCEPTION 'editor2_invalid_page_key: La clave de página es obligatoria.';
  END IF;

  DELETE FROM editor2.publications
  WHERE page_key = p_page_key;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok', true,
    'pageKey', p_page_key,
    'unpublished', (v_deleted > 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.editor2_unpublish_page(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.editor2_unpublish_page(text) TO anon, authenticated;

COMMIT;
