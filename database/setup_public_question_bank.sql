-- ============================================================
--  Atlas de Histología — Banco de preguntas para pruebas públicas
--  Preparación local: no ejecutar en producción sin revisión y autorización.
--  100% aditivo: conserva pruebas, prueba_preguntas y prueba_pregunta_opciones.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.public_bank_questions (
  id                        UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tema_id                   INTEGER      NOT NULL REFERENCES public.temas(id) ON DELETE CASCADE,
  subtema_id                INTEGER      REFERENCES public.subtemas(id) ON DELETE SET NULL,
  sort_order                INTEGER      NOT NULL DEFAULT 0,
  titulo                    TEXT         NOT NULL DEFAULT '',
  retroalimentacion         TEXT         NOT NULL DEFAULT '',
  options                   JSONB        NOT NULL DEFAULT '[]'::jsonb,
  reference_placa_id        INTEGER      REFERENCES public.placas(id) ON DELETE SET NULL,
  reference_photo_url       TEXT,
  reference_tema_name       TEXT,
  reference_subtema_name    TEXT,
  reference_senalado        JSONB,
  source_legacy_pregunta_id UUID         UNIQUE,
  revision                  INTEGER      NOT NULL DEFAULT 1,
  created_by                INTEGER      REFERENCES public.usuarios(id) ON DELETE SET NULL,
  updated_by                INTEGER      REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at                TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_public_bank_questions_tema_subtema_order
  ON public.public_bank_questions (tema_id, subtema_id, sort_order, created_at);

CREATE INDEX IF NOT EXISTS idx_public_bank_questions_tema_general
  ON public.public_bank_questions (tema_id, sort_order, created_at)
  WHERE subtema_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_public_bank_questions_photo_url
  ON public.public_bank_questions (reference_photo_url)
  WHERE reference_photo_url IS NOT NULL;

ALTER TABLE public.public_bank_questions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.public_bank_questions FROM PUBLIC, anon, authenticated;

-- Extensión no destructiva de public.pruebas
ALTER TABLE public.pruebas
  ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS bank_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pruebas_mode_check' AND conrelid = 'public.pruebas'::regclass
  ) THEN
    ALTER TABLE public.pruebas
      ADD CONSTRAINT pruebas_mode_check CHECK (mode IN ('legacy', 'bank'));
  END IF;
END;
$$;

-- Solo se permite una prueba en modo banco por tema.
CREATE UNIQUE INDEX IF NOT EXISTS idx_pruebas_bank_unique_tema
  ON public.pruebas (tema_id)
  WHERE mode = 'bank' AND tema_id IS NOT NULL;

-- ============================================================
--  Auxiliares privados de autorización y validación
-- ============================================================

CREATE OR REPLACE FUNCTION public.atlas_require_public_bank_editor()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id INTEGER;
BEGIN
  v_user_id := public.atlas_session_user_id();
  IF v_user_id IS NULL OR NOT public.atlas_has_role(ARRAY['Administrador', 'Microscopía']) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;
  RETURN v_user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.atlas_require_public_bank_editor() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.atlas_validate_public_bank_question(p_q JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_titulo TEXT;
  v_retro TEXT;
  v_opts JSONB;
  v_opt JSONB;
  v_clean_opts JSONB := '[]'::jsonb;
  v_correct_count INTEGER := 0;
  v_idx INTEGER := 0;
  v_opt_id TEXT;
  v_opt_text TEXT;
  v_is_correct BOOLEAN;
BEGIN
  IF p_q IS NULL OR jsonb_typeof(p_q) <> 'object' THEN
    RAISE EXCEPTION 'Pregunta inválida';
  END IF;

  v_titulo := COALESCE(p_q->>'titulo', '');
  v_retro := COALESCE(p_q->>'retroalimentacion', '');

  IF length(trim(regexp_replace(v_titulo, '<[^>]+>', '', 'g'))) = 0 THEN
    RAISE EXCEPTION 'Escribe el enunciado de cada pregunta antes de guardar';
  END IF;
  IF length(v_titulo) > 10000 THEN
    RAISE EXCEPTION 'El enunciado supera el tamaño máximo permitido';
  END IF;
  IF length(v_retro) > 10000 THEN
    RAISE EXCEPTION 'La retroalimentación supera el tamaño máximo permitido';
  END IF;

  IF p_q ? 'reference_senalado' AND p_q->'reference_senalado' IS NOT NULL AND jsonb_typeof(p_q->'reference_senalado') <> 'null' THEN
    IF jsonb_typeof(p_q->'reference_senalado') <> 'object' OR octet_length((p_q->'reference_senalado')::text) > 50000 THEN
      RAISE EXCEPTION 'El señalado de referencia es inválido';
    END IF;
  END IF;

  v_opts := p_q->'options';
  IF v_opts IS NULL OR jsonb_typeof(v_opts) <> 'array' THEN
    RAISE EXCEPTION 'Opciones de respuesta inválidas';
  END IF;
  IF jsonb_array_length(v_opts) NOT BETWEEN 2 AND 8 THEN
    RAISE EXCEPTION 'Cada pregunta debe tener entre 2 y 8 opciones';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_opts) x
    GROUP BY COALESCE(NULLIF(trim(x->>'id'), ''), '')
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Las opciones tienen identificadores duplicados';
  END IF;

  FOR v_opt IN SELECT value FROM jsonb_array_elements(v_opts) LOOP
    IF jsonb_typeof(v_opt) <> 'object' THEN
      RAISE EXCEPTION 'Opción de respuesta inválida';
    END IF;
    v_opt_id := COALESCE(NULLIF(trim(v_opt->>'id'), ''), gen_random_uuid()::text);
    v_opt_text := COALESCE(v_opt->>'texto', '');
    v_is_correct := COALESCE((v_opt->>'is_correct')::boolean, FALSE);

    IF length(trim(regexp_replace(v_opt_text, '<[^>]+>', '', 'g'))) = 0 THEN
      RAISE EXCEPTION 'Completa el texto de todas las opciones antes de guardar';
    END IF;
    IF length(v_opt_text) > 3000 THEN
      RAISE EXCEPTION 'Una opción supera el tamaño máximo permitido';
    END IF;
    IF v_is_correct THEN
      v_correct_count := v_correct_count + 1;
    END IF;

    v_clean_opts := v_clean_opts || jsonb_build_array(jsonb_build_object(
      'id', v_opt_id,
      'texto', v_opt_text,
      'is_correct', v_is_correct,
      'sort_order', v_idx
    ));
    v_idx := v_idx + 1;
  END LOOP;

  IF v_correct_count <> 1 THEN
    RAISE EXCEPTION 'Selecciona exactamente una respuesta correcta en cada pregunta';
  END IF;

  RETURN v_clean_opts;
END;
$$;
REVOKE ALL ON FUNCTION public.atlas_validate_public_bank_question(JSONB) FROM PUBLIC, anon, authenticated;

-- ============================================================
--  RPCs de administración del Banco de Preguntas
-- ============================================================

CREATE OR REPLACE FUNCTION public.atlas_list_public_bank_summary()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.atlas_require_public_bank_editor();
  RETURN COALESCE((
    SELECT jsonb_agg(row_data ORDER BY tema_id)
    FROM (
      SELECT
        q.tema_id,
        jsonb_build_object(
          'tema_id', q.tema_id,
          'general_count', count(*) FILTER (WHERE q.subtema_id IS NULL),
          'subtema_total_count', count(*) FILTER (WHERE q.subtema_id IS NOT NULL),
          'total_count', count(*),
          'subtemas', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
              'subtema_id', s_agg.subtema_id,
              'count', s_agg.cnt
            ) ORDER BY s_agg.subtema_id)
            FROM (
              SELECT subtema_id, count(*)::integer AS cnt
              FROM public.public_bank_questions
              WHERE tema_id = q.tema_id AND subtema_id IS NOT NULL
              GROUP BY subtema_id
            ) s_agg
          ), '[]'::jsonb)
        ) AS row_data
      FROM public.public_bank_questions q
      GROUP BY q.tema_id
    ) grouped
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.atlas_get_public_bank_questions(
  p_tema_id INTEGER,
  p_subtema_id INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.atlas_require_public_bank_editor();
  IF NOT EXISTS (SELECT 1 FROM public.temas WHERE id = p_tema_id) THEN
    RAISE EXCEPTION 'Tema no encontrado';
  END IF;
  IF p_subtema_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.subtemas WHERE id = p_subtema_id AND tema_id = p_tema_id
  ) THEN
    RAISE EXCEPTION 'El subtema no pertenece al tema seleccionado';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', q.id,
      'tema_id', q.tema_id,
      'subtema_id', q.subtema_id,
      'sort_order', q.sort_order,
      'titulo', q.titulo,
      'retroalimentacion', q.retroalimentacion,
      'options', q.options,
      'reference_placa_id', q.reference_placa_id,
      'reference_photo_url', q.reference_photo_url,
      'reference_tema_name', q.reference_tema_name,
      'reference_subtema_name', q.reference_subtema_name,
      'reference_senalado', q.reference_senalado,
      'revision', q.revision,
      'updated_at', q.updated_at
    ) ORDER BY q.sort_order, q.created_at, q.id)
    FROM public.public_bank_questions q
    WHERE q.tema_id = p_tema_id
      AND ((p_subtema_id IS NULL AND q.subtema_id IS NULL) OR q.subtema_id = p_subtema_id)
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.atlas_save_public_bank_section(
  p_tema_id INTEGER,
  p_subtema_id INTEGER,
  p_questions JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor INTEGER;
  v_q JSONB;
  v_clean_opts JSONB;
  v_idx INTEGER := 0;
  v_qid UUID;
  v_kept_ids UUID[] := ARRAY[]::UUID[];
  v_senalado JSONB;
  v_placa_id INTEGER;
BEGIN
  v_actor := public.atlas_require_public_bank_editor();

  IF NOT EXISTS (SELECT 1 FROM public.temas WHERE id = p_tema_id) THEN
    RAISE EXCEPTION 'Tema no encontrado';
  END IF;
  IF p_subtema_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.subtemas WHERE id = p_subtema_id AND tema_id = p_tema_id
  ) THEN
    RAISE EXCEPTION 'El subtema no pertenece al tema seleccionado';
  END IF;
  IF p_questions IS NULL OR jsonb_typeof(p_questions) <> 'array' THEN
    RAISE EXCEPTION 'Lista de preguntas inválida';
  END IF;
  IF jsonb_array_length(p_questions) > 500 THEN
    RAISE EXCEPTION 'Se superó el límite de 500 preguntas por sección';
  END IF;

  -- Bloquear filas de esta sección para serializar ediciones concurrentes.
  PERFORM 1 FROM public.public_bank_questions
  WHERE tema_id = p_tema_id
    AND ((p_subtema_id IS NULL AND subtema_id IS NULL) OR subtema_id = p_subtema_id)
  FOR UPDATE;

  FOR v_q IN SELECT value FROM jsonb_array_elements(p_questions) LOOP
    v_clean_opts := public.atlas_validate_public_bank_question(v_q);
    v_senalado := CASE
      WHEN v_q ? 'reference_senalado' AND jsonb_typeof(v_q->'reference_senalado') = 'object'
        THEN v_q->'reference_senalado'
      ELSE NULL
    END;
    v_placa_id := CASE
      WHEN NULLIF(trim(COALESCE(v_q->>'reference_placa_id', '')), '') ~ '^[0-9]+$'
        THEN (v_q->>'reference_placa_id')::integer
      ELSE NULL
    END;

    v_qid := NULL;
    IF NULLIF(trim(COALESCE(v_q->>'id', '')), '') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
      v_qid := (v_q->>'id')::uuid;
    END IF;

    IF v_qid IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.public_bank_questions
      WHERE id = v_qid AND tema_id = p_tema_id
        AND ((p_subtema_id IS NULL AND subtema_id IS NULL) OR subtema_id = p_subtema_id)
    ) THEN
      UPDATE public.public_bank_questions
      SET sort_order = v_idx,
          titulo = COALESCE(v_q->>'titulo', ''),
          retroalimentacion = COALESCE(v_q->>'retroalimentacion', ''),
          options = v_clean_opts,
          reference_placa_id = v_placa_id,
          reference_photo_url = NULLIF(trim(COALESCE(v_q->>'reference_photo_url', '')), ''),
          reference_tema_name = NULLIF(trim(COALESCE(v_q->>'reference_tema_name', '')), ''),
          reference_subtema_name = NULLIF(trim(COALESCE(v_q->>'reference_subtema_name', '')), ''),
          reference_senalado = v_senalado,
          revision = revision + 1,
          updated_by = v_actor,
          updated_at = now()
      WHERE id = v_qid;
    ELSE
      INSERT INTO public.public_bank_questions (
        tema_id, subtema_id, sort_order, titulo, retroalimentacion, options,
        reference_placa_id, reference_photo_url, reference_tema_name,
        reference_subtema_name, reference_senalado, created_by, updated_by
      )
      VALUES (
        p_tema_id,
        p_subtema_id,
        v_idx,
        COALESCE(v_q->>'titulo', ''),
        COALESCE(v_q->>'retroalimentacion', ''),
        v_clean_opts,
        v_placa_id,
        NULLIF(trim(COALESCE(v_q->>'reference_photo_url', '')), ''),
        NULLIF(trim(COALESCE(v_q->>'reference_tema_name', '')), ''),
        NULLIF(trim(COALESCE(v_q->>'reference_subtema_name', '')), ''),
        v_senalado,
        v_actor,
        v_actor
      )
      RETURNING id INTO v_qid;
    END IF;

    v_kept_ids := array_append(v_kept_ids, v_qid);
    v_idx := v_idx + 1;
  END LOOP;

  DELETE FROM public.public_bank_questions
  WHERE tema_id = p_tema_id
    AND ((p_subtema_id IS NULL AND subtema_id IS NULL) OR subtema_id = p_subtema_id)
    AND NOT (id = ANY(v_kept_ids));

  RETURN public.atlas_get_public_bank_questions(p_tema_id, p_subtema_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.atlas_move_public_bank_question(
  p_question_id UUID,
  p_target_subtema_id INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor INTEGER;
  v_q public.public_bank_questions%ROWTYPE;
  v_next_order INTEGER;
BEGIN
  v_actor := public.atlas_require_public_bank_editor();
  SELECT * INTO v_q FROM public.public_bank_questions WHERE id = p_question_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pregunta no encontrada en el banco';
  END IF;
  IF p_target_subtema_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.subtemas WHERE id = p_target_subtema_id AND tema_id = v_q.tema_id
  ) THEN
    RAISE EXCEPTION 'El subtema destino no pertenece al mismo tema';
  END IF;

  SELECT COALESCE(max(sort_order), -1) + 1 INTO v_next_order
  FROM public.public_bank_questions
  WHERE tema_id = v_q.tema_id
    AND ((p_target_subtema_id IS NULL AND subtema_id IS NULL) OR subtema_id = p_target_subtema_id);

  UPDATE public.public_bank_questions
  SET subtema_id = p_target_subtema_id,
      sort_order = v_next_order,
      revision = revision + 1,
      updated_by = v_actor,
      updated_at = now()
  WHERE id = p_question_id;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'id', p_question_id,
    'tema_id', v_q.tema_id,
    'subtema_id', p_target_subtema_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.atlas_check_public_bank_image_refs(p_urls TEXT[])
RETURNS TEXT[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.atlas_require_public_bank_editor();
  IF p_urls IS NULL OR array_length(p_urls, 1) IS NULL THEN
    RETURN ARRAY[]::TEXT[];
  END IF;
  RETURN COALESCE((
    SELECT array_agg(DISTINCT reference_photo_url)
    FROM public.public_bank_questions
    WHERE reference_photo_url = ANY(p_urls)
  ), ARRAY[]::TEXT[]);
END;
$$;

-- ============================================================
--  Migración automática (pruebas de subtema) y asistida (tema/parcial)
-- ============================================================

CREATE OR REPLACE FUNCTION public.atlas_count_pending_subtema_migration()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending_questions INTEGER := 0;
  v_pending_tests INTEGER := 0;
BEGIN
  PERFORM public.atlas_require_public_bank_editor();

  SELECT
    count(*)::integer,
    count(DISTINCT q.prueba_id)::integer
  INTO v_pending_questions, v_pending_tests
  FROM public.prueba_preguntas q
  JOIN public.pruebas p ON p.id = q.prueba_id
  JOIN public.temas t ON t.id = p.tema_id
  JOIN public.subtemas st ON st.id = p.subtema_id AND st.tema_id = p.tema_id
  WHERE p.mode = 'legacy'
    AND p.scope = 'subtema'
    AND p.tema_id IS NOT NULL
    AND p.subtema_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.public_bank_questions bq
      WHERE bq.source_legacy_pregunta_id = q.id
    )
    AND (
      SELECT count(*) FROM public.prueba_pregunta_opciones o WHERE o.pregunta_id = q.id
    ) >= 2
    AND EXISTS (
      SELECT 1 FROM public.prueba_pregunta_opciones o WHERE o.pregunta_id = q.id AND o.is_correct = TRUE
    );

  RETURN jsonb_build_object(
    'pending_questions', v_pending_questions,
    'pending_tests', v_pending_tests
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.atlas_migrate_subtema_tests_to_bank()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor INTEGER;
  v_row RECORD;
  v_opts JSONB;
  v_senalado JSONB;
  v_next_order INTEGER;
  v_migrated INTEGER := 0;
  v_skipped INTEGER := 0;
  v_tests UUID[] := ARRAY[]::UUID[];
  v_temas INTEGER[] := ARRAY[]::INTEGER[];
BEGIN
  v_actor := public.atlas_require_public_bank_editor();

  FOR v_row IN
    SELECT
      q.*,
      p.tema_id AS prueba_tema_id,
      p.subtema_id AS prueba_subtema_id
    FROM public.prueba_preguntas q
    JOIN public.pruebas p ON p.id = q.prueba_id
    JOIN public.temas t ON t.id = p.tema_id
    JOIN public.subtemas st ON st.id = p.subtema_id AND st.tema_id = p.tema_id
    WHERE p.mode = 'legacy'
      AND p.scope = 'subtema'
      AND p.tema_id IS NOT NULL
      AND p.subtema_id IS NOT NULL
    ORDER BY p.tema_id, p.subtema_id, p.created_at, q.sort_order, q.id
  LOOP
    IF EXISTS (SELECT 1 FROM public.public_bank_questions WHERE source_legacy_pregunta_id = v_row.id) THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', o.id::text,
      'texto', o.texto,
      'is_correct', o.is_correct,
      'sort_order', o.sort_order
    ) ORDER BY o.sort_order, o.id), '[]'::jsonb)
    INTO v_opts
    FROM public.prueba_pregunta_opciones o
    WHERE o.pregunta_id = v_row.id;

    -- Omitir preguntas corruptas o incompletas sin al menos 2 opciones o 1 correcta
    IF jsonb_array_length(v_opts) < 2 OR NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_opts) x WHERE (x->>'is_correct')::boolean = TRUE
    ) THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    v_senalado := CASE
      WHEN v_row.reference_senalado_x IS NOT NULL AND v_row.reference_senalado_y IS NOT NULL THEN
        jsonb_strip_nulls(jsonb_build_object(
          'x', v_row.reference_senalado_x,
          'y', v_row.reference_senalado_y,
          'startX', v_row.reference_senalado_start_x,
          'startY', v_row.reference_senalado_start_y
        ))
      ELSE NULL
    END;

    SELECT COALESCE(max(sort_order), -1) + 1 INTO v_next_order
    FROM public.public_bank_questions
    WHERE tema_id = v_row.prueba_tema_id AND subtema_id = v_row.prueba_subtema_id;

    INSERT INTO public.public_bank_questions (
      tema_id, subtema_id, sort_order, titulo, retroalimentacion, options,
      reference_placa_id, reference_photo_url, reference_tema_name,
      reference_subtema_name, reference_senalado, source_legacy_pregunta_id,
      created_by, updated_by
    )
    VALUES (
      v_row.prueba_tema_id,
      v_row.prueba_subtema_id,
      v_next_order,
      COALESCE(v_row.titulo, ''),
      COALESCE(v_row.retroalimentacion, ''),
      v_opts,
      v_row.reference_placa_id,
      v_row.reference_photo_url,
      v_row.reference_tema_name,
      v_row.reference_subtema_name,
      v_senalado,
      v_row.id,
      v_actor,
      v_actor
    )
    ON CONFLICT (source_legacy_pregunta_id) DO NOTHING;

    v_migrated := v_migrated + 1;
    IF NOT (v_row.prueba_id = ANY(v_tests)) THEN
      v_tests := array_append(v_tests, v_row.prueba_id);
    END IF;
    IF NOT (v_row.prueba_tema_id = ANY(v_temas)) THEN
      v_temas := array_append(v_temas, v_row.prueba_tema_id);
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'migrated_questions', v_migrated,
    'skipped_questions', v_skipped,
    'affected_tests', COALESCE(array_length(v_tests, 1), 0),
    'affected_temas', COALESCE(array_length(v_temas, 1), 0)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.atlas_list_legacy_public_tests_for_migration()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.atlas_require_public_bank_editor();

  RETURN COALESCE((
    SELECT jsonb_agg(test_item ORDER BY created_at DESC)
    FROM (
      SELECT
        p.created_at,
        jsonb_build_object(
          'id', p.id,
          'nombre', p.nombre,
          'scope', p.scope,
          'parcial_key', p.parcial_key,
          'tema_id', p.tema_id,
          'subtema_id', p.subtema_id,
          'estado', p.estado,
          'created_at', p.created_at,
          'questions', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
              'id', q.id,
              'sort_order', q.sort_order,
              'titulo', q.titulo,
              'retroalimentacion', q.retroalimentacion,
              'reference_placa_id', q.reference_placa_id,
              'reference_photo_url', q.reference_photo_url,
              'reference_tema_name', q.reference_tema_name,
              'reference_subtema_name', q.reference_subtema_name,
              'reference_senalado', CASE
                WHEN q.reference_senalado_x IS NOT NULL AND q.reference_senalado_y IS NOT NULL THEN
                  jsonb_strip_nulls(jsonb_build_object(
                    'x', q.reference_senalado_x,
                    'y', q.reference_senalado_y,
                    'startX', q.reference_senalado_start_x,
                    'startY', q.reference_senalado_start_y
                  ))
                ELSE NULL
              END,
              'options', COALESCE((
                SELECT jsonb_agg(jsonb_build_object(
                  'id', o.id::text,
                  'texto', o.texto,
                  'is_correct', o.is_correct,
                  'sort_order', o.sort_order
                ) ORDER BY o.sort_order, o.id)
                FROM public.prueba_pregunta_opciones o
                WHERE o.pregunta_id = q.id
              ), '[]'::jsonb)
            ) ORDER BY q.sort_order, q.id)
            FROM public.prueba_preguntas q
            WHERE q.prueba_id = p.id
              AND NOT EXISTS (
                SELECT 1 FROM public.public_bank_questions bq
                WHERE bq.source_legacy_pregunta_id = q.id
              )
          ), '[]'::jsonb)
        ) AS test_item
      FROM public.pruebas p
      WHERE p.mode = 'legacy'
        AND p.scope IN ('tema', 'parcial')
        AND EXISTS (
          SELECT 1 FROM public.prueba_preguntas q
          WHERE q.prueba_id = p.id
            AND NOT EXISTS (
              SELECT 1 FROM public.public_bank_questions bq
              WHERE bq.source_legacy_pregunta_id = q.id
            )
        )
    ) sub
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.atlas_migrate_legacy_public_question(
  p_prueba_id UUID,
  p_pregunta_id UUID,
  p_tema_id INTEGER,
  p_subtema_id INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor INTEGER;
  v_q public.prueba_preguntas%ROWTYPE;
  v_opts JSONB;
  v_senalado JSONB;
  v_next_order INTEGER;
  v_new_id UUID;
  v_remaining INTEGER;
BEGIN
  v_actor := public.atlas_require_public_bank_editor();

  IF NOT EXISTS (SELECT 1 FROM public.temas WHERE id = p_tema_id) THEN
    RAISE EXCEPTION 'Tema destino no encontrado';
  END IF;
  IF p_subtema_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.subtemas WHERE id = p_subtema_id AND tema_id = p_tema_id
  ) THEN
    RAISE EXCEPTION 'El subtema destino no pertenece al tema seleccionado';
  END IF;

  SELECT * INTO v_q
  FROM public.prueba_preguntas
  WHERE id = p_pregunta_id AND prueba_id = p_prueba_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La pregunta ya fue migrada o no existe';
  END IF;

  IF EXISTS (SELECT 1 FROM public.public_bank_questions WHERE source_legacy_pregunta_id = p_pregunta_id) THEN
    RAISE EXCEPTION 'Esta pregunta ya fue migrada al banco';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', o.id::text,
    'texto', o.texto,
    'is_correct', o.is_correct,
    'sort_order', o.sort_order
  ) ORDER BY o.sort_order, o.id), '[]'::jsonb)
  INTO v_opts
  FROM public.prueba_pregunta_opciones o
  WHERE o.pregunta_id = p_pregunta_id;

  v_senalado := CASE
    WHEN v_q.reference_senalado_x IS NOT NULL AND v_q.reference_senalado_y IS NOT NULL THEN
      jsonb_strip_nulls(jsonb_build_object(
        'x', v_q.reference_senalado_x,
        'y', v_q.reference_senalado_y,
        'startX', v_q.reference_senalado_start_x,
        'startY', v_q.reference_senalado_start_y
      ))
    ELSE NULL
  END;

  SELECT COALESCE(max(sort_order), -1) + 1 INTO v_next_order
  FROM public.public_bank_questions
  WHERE tema_id = p_tema_id
    AND ((p_subtema_id IS NULL AND subtema_id IS NULL) OR subtema_id = p_subtema_id);

  INSERT INTO public.public_bank_questions (
    tema_id, subtema_id, sort_order, titulo, retroalimentacion, options,
    reference_placa_id, reference_photo_url, reference_tema_name,
    reference_subtema_name, reference_senalado, source_legacy_pregunta_id,
    created_by, updated_by
  )
  VALUES (
    p_tema_id,
    p_subtema_id,
    v_next_order,
    COALESCE(v_q.titulo, ''),
    COALESCE(v_q.retroalimentacion, ''),
    v_opts,
    v_q.reference_placa_id,
    v_q.reference_photo_url,
    v_q.reference_tema_name,
    v_q.reference_subtema_name,
    v_senalado,
    v_q.id,
    v_actor,
    v_actor
  )
  RETURNING id INTO v_new_id;

  SELECT count(*)::integer INTO v_remaining
  FROM public.prueba_preguntas q
  WHERE q.prueba_id = p_prueba_id
    AND NOT EXISTS (
      SELECT 1 FROM public.public_bank_questions bq
      WHERE bq.source_legacy_pregunta_id = q.id
    );

  IF v_remaining = 0 THEN
    UPDATE public.pruebas
    SET estado = 'archivada', updated_at = now()
    WHERE id = p_prueba_id AND mode = 'legacy';
  END IF;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'question_id', v_new_id,
    'tema_id', p_tema_id,
    'subtema_id', p_subtema_id,
    'remaining_count', v_remaining
  );
END;
$$;

-- ============================================================
--  Configuración y publicación de Pruebas por Tema (1 por tema)
-- ============================================================

CREATE OR REPLACE FUNCTION public.atlas_save_public_bank_test(
  p_id UUID,
  p_tema_id INTEGER,
  p_nombre TEXT,
  p_instrucciones TEXT,
  p_image_url TEXT,
  p_bank_config JSONB,
  p_revision INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor INTEGER;
  v_actor_name TEXT;
  v_tema RECORD;
  v_existing public.pruebas%ROWTYPE;
  v_general_count INTEGER;
  v_subtema_counts JSONB;
  v_clean_subtema_counts JSONB := '{}'::jsonb;
  v_key TEXT;
  v_val INTEGER;
  v_total_configured INTEGER := 0;
  v_clean_config JSONB;
  v_saved public.pruebas%ROWTYPE;
BEGIN
  v_actor := public.atlas_require_public_bank_editor();
  SELECT COALESCE(NULLIF(trim(nombre), ''), NULLIF(trim(username), ''), 'Administrador')
    INTO v_actor_name
  FROM public.usuarios WHERE id = v_actor;

  SELECT id, nombre, parcial INTO v_tema FROM public.temas WHERE id = p_tema_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tema no encontrado';
  END IF;
  IF v_tema.parcial NOT IN ('primer', 'segundo', 'tercer') THEN
    RAISE EXCEPTION 'El tema no tiene un parcial válido';
  END IF;

  IF p_nombre IS NULL OR length(trim(regexp_replace(p_nombre, '<[^>]+>', '', 'g'))) = 0 THEN
    RAISE EXCEPTION 'Escribe un nombre para la prueba';
  END IF;
  IF length(p_nombre) > 400 THEN
    RAISE EXCEPTION 'El nombre supera el máximo permitido';
  END IF;
  IF length(COALESCE(p_instrucciones, '')) > 10000 THEN
    RAISE EXCEPTION 'Las instrucciones superan el máximo permitido';
  END IF;

  IF p_bank_config IS NULL OR jsonb_typeof(p_bank_config) <> 'object' THEN
    RAISE EXCEPTION 'Configuración de banco inválida';
  END IF;

  v_general_count := COALESCE((p_bank_config->>'general_count')::integer, 0);
  IF v_general_count NOT BETWEEN 0 AND 200 THEN
    RAISE EXCEPTION 'La cantidad de preguntas generales debe estar entre 0 y 200';
  END IF;
  IF v_general_count > (
    SELECT count(*)::integer FROM public.public_bank_questions
    WHERE tema_id = p_tema_id AND subtema_id IS NULL
  ) THEN
    RAISE EXCEPTION 'No puedes configurar más preguntas generales que las disponibles en el banco';
  END IF;
  v_total_configured := v_general_count;

  v_subtema_counts := COALESCE(p_bank_config->'subtema_counts', '{}'::jsonb);
  IF jsonb_typeof(v_subtema_counts) <> 'object' THEN
    RAISE EXCEPTION 'La configuración por subtema es inválida';
  END IF;

  FOR v_key IN SELECT jsonb_object_keys(v_subtema_counts) LOOP
    IF v_key !~ '^[0-9]+$' THEN
      RAISE EXCEPTION 'Identificador de subtema inválido';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.subtemas WHERE id = v_key::integer AND tema_id = p_tema_id) THEN
      RAISE EXCEPTION 'Uno de los subtemas configurados no pertenece a este tema';
    END IF;
    v_val := COALESCE((v_subtema_counts->>v_key)::integer, 0);
    IF v_val NOT BETWEEN 0 AND 200 THEN
      RAISE EXCEPTION 'La cantidad de preguntas por subtema debe estar entre 0 y 200';
    END IF;
    IF v_val > (
      SELECT count(*)::integer FROM public.public_bank_questions
      WHERE tema_id = p_tema_id AND subtema_id = v_key::integer
    ) THEN
      RAISE EXCEPTION 'No puedes configurar más preguntas de un subtema que las disponibles en el banco';
    END IF;
    IF v_val > 0 THEN
      v_clean_subtema_counts := v_clean_subtema_counts || jsonb_build_object(v_key, v_val);
      v_total_configured := v_total_configured + v_val;
    END IF;
  END LOOP;

  IF v_total_configured < 1 THEN
    RAISE EXCEPTION 'Configura al menos 1 pregunta general o de subtema para esta prueba';
  END IF;

  v_clean_config := jsonb_build_object(
    'general_count', v_general_count,
    'subtema_counts', v_clean_subtema_counts,
    'shuffle_options', COALESCE((p_bank_config->>'shuffle_options')::boolean, TRUE),
    'shuffle_questions', COALESCE((p_bank_config->>'shuffle_questions')::boolean, TRUE)
  );

  IF p_id IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.pruebas WHERE mode = 'bank' AND tema_id = p_tema_id) THEN
      RAISE EXCEPTION 'Este tema ya tiene una prueba configurada. Edita la prueba existente.';
    END IF;

    INSERT INTO public.pruebas (
      nombre, instrucciones, scope, parcial_key, tema_id, subtema_id,
      estado, image_url, mode, bank_config, revision,
      created_by_id, created_by_name, updated_by_id, updated_by_name
    )
    VALUES (
      trim(p_nombre),
      COALESCE(p_instrucciones, ''),
      'tema',
      v_tema.parcial,
      p_tema_id,
      NULL,
      'borrador',
      NULLIF(trim(COALESCE(p_image_url, '')), ''),
      'bank',
      v_clean_config,
      1,
      v_actor,
      v_actor_name,
      v_actor,
      v_actor_name
    )
    RETURNING * INTO v_saved;
  ELSE
    SELECT * INTO v_existing FROM public.pruebas WHERE id = p_id AND mode = 'bank' FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Prueba de banco no encontrada';
    END IF;
    IF p_revision IS NOT NULL AND p_revision IS DISTINCT FROM v_existing.revision THEN
      RAISE EXCEPTION 'Otra persona modificó esta prueba. Vuelve a abrirla.' USING ERRCODE = '40001';
    END IF;
    IF v_existing.tema_id IS DISTINCT FROM p_tema_id AND EXISTS (
      SELECT 1 FROM public.pruebas WHERE mode = 'bank' AND tema_id = p_tema_id AND id <> p_id
    ) THEN
      RAISE EXCEPTION 'El tema destino ya tiene una prueba configurada';
    END IF;

    UPDATE public.pruebas
    SET nombre = trim(p_nombre),
        instrucciones = COALESCE(p_instrucciones, ''),
        parcial_key = v_tema.parcial,
        tema_id = p_tema_id,
        subtema_id = NULL,
        scope = 'tema',
        image_url = NULLIF(trim(COALESCE(p_image_url, '')), ''),
        bank_config = v_clean_config,
        revision = v_existing.revision + 1,
        updated_by_id = v_actor,
        updated_by_name = v_actor_name,
        updated_at = now()
    WHERE id = p_id
    RETURNING * INTO v_saved;
  END IF;

  RETURN to_jsonb(v_saved);
END;
$$;

CREATE OR REPLACE FUNCTION public.atlas_publish_public_bank_test(
  p_id UUID,
  p_publish BOOLEAN,
  p_archive_migrated_legacy BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor INTEGER;
  v_actor_name TEXT;
  v_test public.pruebas%ROWTYPE;
  v_general_count INTEGER;
  v_subtema_counts JSONB;
  v_available INTEGER := 0;
  v_key TEXT;
  v_archived_count INTEGER := 0;
BEGIN
  v_actor := public.atlas_require_public_bank_editor();
  SELECT COALESCE(NULLIF(trim(nombre), ''), NULLIF(trim(username), ''), 'Administrador')
    INTO v_actor_name
  FROM public.usuarios WHERE id = v_actor;

  SELECT * INTO v_test FROM public.pruebas WHERE id = p_id AND mode = 'bank' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Prueba de banco no encontrada';
  END IF;

  IF p_publish THEN
    v_general_count := COALESCE((v_test.bank_config->>'general_count')::integer, 0);
    v_subtema_counts := COALESCE(v_test.bank_config->'subtema_counts', '{}'::jsonb);

    IF v_general_count > 0 THEN
      SELECT v_available + LEAST(v_general_count, count(*)::integer) INTO v_available
      FROM public.public_bank_questions
      WHERE tema_id = v_test.tema_id AND subtema_id IS NULL;
    END IF;

    FOR v_key IN SELECT jsonb_object_keys(v_subtema_counts) LOOP
      IF COALESCE((v_subtema_counts->>v_key)::integer, 0) > 0 THEN
        SELECT v_available + LEAST((v_subtema_counts->>v_key)::integer, count(*)::integer) INTO v_available
        FROM public.public_bank_questions
        WHERE tema_id = v_test.tema_id AND subtema_id = v_key::integer;
      END IF;
    END LOOP;

    IF v_available < 1 THEN
      RAISE EXCEPTION 'Agrega al menos una pregunta en el banco para los rubros configurados antes de publicar';
    END IF;
  END IF;

  UPDATE public.pruebas
  SET estado = CASE WHEN p_publish THEN 'publicada' ELSE 'borrador' END,
      revision = revision + 1,
      updated_by_id = v_actor,
      updated_by_name = v_actor_name,
      updated_at = now()
  WHERE id = p_id
  RETURNING * INTO v_test;

  IF p_publish AND COALESCE(p_archive_migrated_legacy, TRUE) AND v_test.tema_id IS NOT NULL THEN
    WITH archived AS (
      UPDATE public.pruebas p
      SET estado = 'archivada', updated_at = now()
      WHERE p.mode = 'legacy'
        AND p.scope = 'subtema'
        AND p.tema_id = v_test.tema_id
        AND p.estado <> 'archivada'
        AND NOT EXISTS (
          SELECT 1 FROM public.prueba_preguntas q
          WHERE q.prueba_id = p.id
            AND NOT EXISTS (
              SELECT 1 FROM public.public_bank_questions bq
              WHERE bq.source_legacy_pregunta_id = q.id
            )
        )
      RETURNING p.id
    )
    SELECT count(*)::integer INTO v_archived_count FROM archived;
  END IF;

  RETURN jsonb_build_object(
    'test', to_jsonb(v_test),
    'archived_legacy_count', v_archived_count
  );
END;
$$;

-- ============================================================
--  RPCs públicas: sorteo en vivo y calificación inmediata 1-a-1
-- ============================================================

DROP FUNCTION IF EXISTS public.atlas_start_public_bank_test(UUID, BOOLEAN);

CREATE OR REPLACE FUNCTION public.atlas_start_public_bank_test(
  p_prueba_id UUID,
  p_preview BOOLEAN DEFAULT FALSE,
  p_seen_ids UUID[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_test public.pruebas%ROWTYPE;
  v_general_count INTEGER;
  v_subtema_counts JSONB;
  v_shuffle_options BOOLEAN;
  v_shuffle_questions BOOLEAN;
  v_seen_ids UUID[] := COALESCE(p_seen_ids, ARRAY[]::UUID[]);
  v_questions JSONB;
BEGIN
  IF COALESCE(p_preview, FALSE) THEN
    PERFORM public.atlas_require_public_bank_editor();
    SELECT * INTO v_test FROM public.pruebas WHERE id = p_prueba_id AND mode = 'bank';
  ELSE
    SELECT * INTO v_test FROM public.pruebas WHERE id = p_prueba_id AND mode = 'bank' AND estado = 'publicada';
  END IF;

  IF NOT FOUND OR v_test.tema_id IS NULL THEN
    RETURN NULL;
  END IF;

  v_general_count := GREATEST(0, COALESCE((v_test.bank_config->>'general_count')::integer, 0));
  v_subtema_counts := COALESCE(v_test.bank_config->'subtema_counts', '{}'::jsonb);
  v_shuffle_options := COALESCE((v_test.bank_config->>'shuffle_options')::boolean, TRUE);
  v_shuffle_questions := COALESCE((v_test.bank_config->>'shuffle_questions')::boolean, TRUE);

  WITH picked_general AS (
    SELECT q.*, 0 AS bucket_order
    FROM public.public_bank_questions q
    WHERE q.tema_id = v_test.tema_id
      AND q.subtema_id IS NULL
      AND v_general_count > 0
    ORDER BY
      CASE WHEN q.id = ANY(v_seen_ids) THEN 1 ELSE 0 END,
      gen_random_uuid()
    LIMIT v_general_count
  ),
  subtema_limits AS (
    SELECT
      key::integer AS subtema_id,
      GREATEST(0, COALESCE(value::integer, 0)) AS lim
    FROM jsonb_each_text(v_subtema_counts)
    WHERE key ~ '^[0-9]+$' AND COALESCE(value::integer, 0) > 0
  ),
  picked_subtemas AS (
    SELECT ranked.*, 1 AS bucket_order
    FROM (
      SELECT
        q.*,
        row_number() OVER (
          PARTITION BY q.subtema_id
          ORDER BY
            CASE WHEN q.id = ANY(v_seen_ids) THEN 1 ELSE 0 END,
            gen_random_uuid()
        ) AS rn,
        sl.lim
      FROM public.public_bank_questions q
      JOIN subtema_limits sl ON sl.subtema_id = q.subtema_id
      WHERE q.tema_id = v_test.tema_id
    ) ranked
    WHERE ranked.rn <= ranked.lim
  ),
  combined AS (
    SELECT id, tema_id, subtema_id, sort_order, titulo, options,
           reference_photo_url, reference_tema_name, reference_subtema_name,
           reference_senalado, bucket_order
    FROM picked_general
    UNION ALL
    SELECT id, tema_id, subtema_id, sort_order, titulo, options,
           reference_photo_url, reference_tema_name, reference_subtema_name,
           reference_senalado, bucket_order
    FROM picked_subtemas
  ),
  ordered AS (
    SELECT
      c.*,
      (row_number() OVER (
        ORDER BY
          CASE WHEN v_shuffle_questions THEN gen_random_uuid()::text ELSE lpad(c.bucket_order::text, 2, '0') || '-' || lpad(COALESCE(c.subtema_id, 0)::text, 10, '0') || '-' || lpad(c.sort_order::text, 10, '0') END
      ) - 1)::integer AS display_order
    FROM combined c
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', o.id,
    'sort_order', o.display_order,
    'titulo', o.titulo,
    'required', TRUE,
    'subtema_id', o.subtema_id,
    'reference_photo_url', o.reference_photo_url,
    'reference_tema_name', o.reference_tema_name,
    'reference_subtema_name', o.reference_subtema_name,
    'reference_senalado', o.reference_senalado,
    'reference_senalado_x', CASE WHEN o.reference_senalado IS NOT NULL THEN (o.reference_senalado->>'x')::numeric ELSE NULL END,
    'reference_senalado_y', CASE WHEN o.reference_senalado IS NOT NULL THEN (o.reference_senalado->>'y')::numeric ELSE NULL END,
    'reference_senalado_start_x', CASE WHEN o.reference_senalado IS NOT NULL AND o.reference_senalado ? 'startX' THEN (o.reference_senalado->>'startX')::numeric ELSE NULL END,
    'reference_senalado_start_y', CASE WHEN o.reference_senalado IS NOT NULL AND o.reference_senalado ? 'startY' THEN (o.reference_senalado->>'startY')::numeric ELSE NULL END,
    'options', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', opt.elem->>'id',
        'pregunta_id', o.id,
        'sort_order', opt.opt_order,
        'texto', opt.elem->>'texto'
      ) ORDER BY opt.opt_order)
      FROM (
        SELECT
          elem,
          (row_number() OVER (
            ORDER BY CASE WHEN v_shuffle_options THEN gen_random_uuid()::text ELSE lpad(COALESCE((elem->>'sort_order')::integer, 0)::text, 6, '0') END
          ) - 1)::integer AS opt_order
        FROM jsonb_array_elements(o.options) elem
      ) opt
    ), '[]'::jsonb)
  ) ORDER BY o.display_order), '[]'::jsonb)
  INTO v_questions
  FROM ordered o;

  RETURN jsonb_build_object(
    'test', jsonb_build_object(
      'id', v_test.id,
      'nombre', v_test.nombre,
      'instrucciones', v_test.instrucciones,
      'scope', v_test.scope,
      'parcial_key', v_test.parcial_key,
      'tema_id', v_test.tema_id,
      'created_at', v_test.created_at,
      'estado', v_test.estado,
      'mode', v_test.mode
    ),
    'questions', v_questions
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.atlas_grade_public_bank_question(
  p_prueba_id UUID,
  p_question_id UUID,
  p_option_id TEXT,
  p_preview BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_test public.pruebas%ROWTYPE;
  v_q public.public_bank_questions%ROWTYPE;
  v_correct JSONB;
  v_selected JSONB;
BEGIN
  IF COALESCE(p_preview, FALSE) THEN
    PERFORM public.atlas_require_public_bank_editor();
    SELECT * INTO v_test FROM public.pruebas WHERE id = p_prueba_id AND mode = 'bank';
  ELSE
    SELECT * INTO v_test FROM public.pruebas WHERE id = p_prueba_id AND mode = 'bank' AND estado = 'publicada';
  END IF;

  IF NOT FOUND OR v_test.tema_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_q
  FROM public.public_bank_questions
  WHERE id = p_question_id AND tema_id = v_test.tema_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT elem INTO v_correct
  FROM jsonb_array_elements(v_q.options) elem
  WHERE (elem->>'is_correct')::boolean = TRUE
  LIMIT 1;

  SELECT elem INTO v_selected
  FROM jsonb_array_elements(v_q.options) elem
  WHERE elem->>'id' = p_option_id
  LIMIT 1;

  RETURN jsonb_build_object(
    'question_id', v_q.id,
    'is_correct', (v_selected IS NOT NULL AND COALESCE((v_selected->>'is_correct')::boolean, FALSE)),
    'correct_option_id', COALESCE(v_correct->>'id', ''),
    'correct_option_text', COALESCE(v_correct->>'texto', ''),
    'feedback', v_q.retroalimentacion
  );
END;
$$;

-- ============================================================
--  Permisos de ejecución de RPCs
-- ============================================================

REVOKE ALL ON FUNCTION public.atlas_list_public_bank_summary() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.atlas_get_public_bank_questions(INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.atlas_save_public_bank_section(INTEGER, INTEGER, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.atlas_move_public_bank_question(UUID, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.atlas_check_public_bank_image_refs(TEXT[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.atlas_count_pending_subtema_migration() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.atlas_migrate_subtema_tests_to_bank() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.atlas_list_legacy_public_tests_for_migration() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.atlas_migrate_legacy_public_question(UUID, UUID, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.atlas_save_public_bank_test(UUID, INTEGER, TEXT, TEXT, TEXT, JSONB, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.atlas_publish_public_bank_test(UUID, BOOLEAN, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.atlas_start_public_bank_test(UUID, BOOLEAN, UUID[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.atlas_grade_public_bank_question(UUID, UUID, TEXT, BOOLEAN) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.atlas_list_public_bank_summary() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.atlas_get_public_bank_questions(INTEGER, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.atlas_save_public_bank_section(INTEGER, INTEGER, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.atlas_move_public_bank_question(UUID, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.atlas_check_public_bank_image_refs(TEXT[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.atlas_count_pending_subtema_migration() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.atlas_migrate_subtema_tests_to_bank() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.atlas_list_legacy_public_tests_for_migration() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.atlas_migrate_legacy_public_question(UUID, UUID, INTEGER, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.atlas_save_public_bank_test(UUID, INTEGER, TEXT, TEXT, TEXT, JSONB, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.atlas_publish_public_bank_test(UUID, BOOLEAN, BOOLEAN) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.atlas_start_public_bank_test(UUID, BOOLEAN, UUID[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.atlas_grade_public_bank_question(UUID, UUID, TEXT, BOOLEAN) TO anon, authenticated;

COMMIT;
