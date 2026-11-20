-- ============================================================
--  Rollback: Banco de preguntas para pruebas públicas
--  Preparación local: ejecutar solo bajo autorización explícita.
-- ============================================================

BEGIN;

DROP FUNCTION IF EXISTS public.atlas_grade_public_bank_question(UUID, UUID, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS public.atlas_get_public_bank_pool(UUID);
DROP FUNCTION IF EXISTS public.atlas_start_public_bank_test(UUID, BOOLEAN, UUID[]);
DROP FUNCTION IF EXISTS public.atlas_start_public_bank_test(UUID, BOOLEAN);
DROP FUNCTION IF EXISTS public.atlas_publish_public_bank_test(UUID, BOOLEAN, BOOLEAN);
DROP FUNCTION IF EXISTS public.atlas_save_public_bank_test(UUID, INTEGER, TEXT, TEXT, TEXT, JSONB, INTEGER);
DROP FUNCTION IF EXISTS public.atlas_migrate_legacy_public_question(UUID, UUID, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS public.atlas_list_legacy_public_tests_for_migration();
DROP FUNCTION IF EXISTS public.atlas_migrate_subtema_tests_to_bank();
DROP FUNCTION IF EXISTS public.atlas_count_pending_subtema_migration();
DROP FUNCTION IF EXISTS public.atlas_check_public_bank_image_refs(TEXT[]);
DROP FUNCTION IF EXISTS public.atlas_move_public_bank_question(UUID, INTEGER);
DROP FUNCTION IF EXISTS public.atlas_save_public_bank_section(INTEGER, INTEGER, JSONB);
DROP FUNCTION IF EXISTS public.atlas_get_public_bank_questions(INTEGER, INTEGER);
DROP FUNCTION IF EXISTS public.atlas_list_public_bank_summary();
DROP FUNCTION IF EXISTS public.atlas_validate_public_bank_question(JSONB);
DROP FUNCTION IF EXISTS public.atlas_require_public_bank_editor();

DROP INDEX IF EXISTS public.idx_pruebas_bank_unique_tema;
ALTER TABLE public.pruebas DROP CONSTRAINT IF EXISTS pruebas_mode_check;
ALTER TABLE public.pruebas
  DROP COLUMN IF EXISTS revision,
  DROP COLUMN IF EXISTS bank_config,
  DROP COLUMN IF EXISTS mode;

DROP TABLE IF EXISTS public.public_bank_questions;

COMMIT;
