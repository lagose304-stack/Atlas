-- ============================================================
-- Atlas de Histologia - Ampliar tipos de bloque de pruebas
-- Ejecuta este script si ya habias creado test_question_blocks
-- ============================================================

ALTER TABLE public.test_question_blocks
  DROP CONSTRAINT IF EXISTS test_question_blocks_block_type_check;

ALTER TABLE public.test_question_blocks
  ADD CONSTRAINT test_question_blocks_block_type_check
  CHECK (
    block_type IN (
      'single_choice',
      'multiple_choice',
      'true_false',
      'matching',
      'ordering',
      'dropdown_single'
    )
  );
