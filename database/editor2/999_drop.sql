-- ============================================================
-- Atlas Editor de Páginas 2.0 (Fase 1 - Parte 5)
-- Reversión completa y limpia de todos los objetos `editor2`.
-- NO toca tablas `content_*`, catálogo ni usuarios.
-- NO ejecutar en producción sin respaldo verificado y autorización explícita.
-- ============================================================

BEGIN;

DROP FUNCTION IF EXISTS public.editor2_unpublish_page(text);
DROP FUNCTION IF EXISTS public.editor2_delete_template(uuid);
DROP FUNCTION IF EXISTS public.editor2_save_template(text, text, text, jsonb);
DROP FUNCTION IF EXISTS public.editor2_list_templates();
DROP FUNCTION IF EXISTS public.editor2_delete_preset(uuid);
DROP FUNCTION IF EXISTS public.editor2_save_preset(text, jsonb);
DROP FUNCTION IF EXISTS public.editor2_list_presets();
DROP FUNCTION IF EXISTS public.editor2_get_public_doc(text);
DROP FUNCTION IF EXISTS public.editor2_delete_version(text, uuid);
DROP FUNCTION IF EXISTS public.editor2_publish_version(text, uuid);
DROP FUNCTION IF EXISTS public.editor2_publish_draft(text, text);
DROP FUNCTION IF EXISTS public.editor2_create_version(text, text, text, uuid);
DROP FUNCTION IF EXISTS public.editor2_save_draft(text, jsonb, uuid);
DROP FUNCTION IF EXISTS public.editor2_get_workspace(text);
DROP FUNCTION IF EXISTS public.editor2_upsert_pages(jsonb);
DROP FUNCTION IF EXISTS public.editor2_list_pages();

DROP SCHEMA IF EXISTS editor2 CASCADE;

COMMIT;
