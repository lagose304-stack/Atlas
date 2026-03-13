-- ============================================================
-- Atlas de Histologia - Sistema de pruebas por tema/subtema
-- Ejecuta este script en el Editor SQL de Supabase Dashboard
-- ============================================================

CREATE TABLE IF NOT EXISTS public.tests (
  id               UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo           TEXT         NOT NULL,
  descripcion      TEXT         NOT NULL DEFAULT '',
  tema_id          INTEGER      NOT NULL REFERENCES public.temas(id) ON DELETE CASCADE,
  subtema_id       INTEGER      REFERENCES public.subtemas(id) ON DELETE SET NULL,
  estado           TEXT         NOT NULL DEFAULT 'draft' CHECK (estado IN ('draft', 'published')),
  dificultad       TEXT         NOT NULL DEFAULT 'media' CHECK (dificultad IN ('baja', 'media', 'alta')),
  duracion_min     INTEGER      NOT NULL DEFAULT 15 CHECK (duracion_min > 0),
  published_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.test_question_blocks (
  id               UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  test_id          UUID         NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  block_type       TEXT         NOT NULL CHECK (block_type IN ('single_choice', 'multiple_choice', 'true_false', 'matching', 'ordering', 'dropdown_single')),
  sort_order       INTEGER      NOT NULL DEFAULT 0,
  title            TEXT         NOT NULL DEFAULT '',
  prompt           TEXT         NOT NULL DEFAULT '',
  config           JSONB        NOT NULL DEFAULT '{}'::jsonb,
  answer_key       JSONB        NOT NULL DEFAULT '{}'::jsonb,
  points           NUMERIC(6,2) NOT NULL DEFAULT 1.0 CHECK (points >= 0),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tests_tema_estado
  ON public.tests (tema_id, estado, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tests_subtema
  ON public.tests (subtema_id);

CREATE INDEX IF NOT EXISTS idx_test_question_blocks_test
  ON public.test_question_blocks (test_id, sort_order);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_tests_updated_at ON public.tests;
CREATE TRIGGER update_tests_updated_at
  BEFORE UPDATE ON public.tests
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_test_question_blocks_updated_at ON public.test_question_blocks;
CREATE TRIGGER update_test_question_blocks_updated_at
  BEFORE UPDATE ON public.test_question_blocks
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_question_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir lectura de tests"
  ON public.tests FOR SELECT
  USING (true);

CREATE POLICY "Permitir insercion de tests"
  ON public.tests FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Permitir actualizacion de tests"
  ON public.tests FOR UPDATE
  USING (true);

CREATE POLICY "Permitir eliminacion de tests"
  ON public.tests FOR DELETE
  USING (true);

CREATE POLICY "Permitir lectura de test_question_blocks"
  ON public.test_question_blocks FOR SELECT
  USING (true);

CREATE POLICY "Permitir insercion de test_question_blocks"
  ON public.test_question_blocks FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Permitir actualizacion de test_question_blocks"
  ON public.test_question_blocks FOR UPDATE
  USING (true);

CREATE POLICY "Permitir eliminacion de test_question_blocks"
  ON public.test_question_blocks FOR DELETE
  USING (true);
