-- ============================================================
--  Atlas de Histología — Sistema base de pruebas
--  Ejecuta este script en el Editor SQL de Supabase Dashboard
-- ============================================================

-- Tabla principal: una fila por prueba creada desde el formulario inicial.
-- Las preguntas se guardarán después en una tabla hija para no mezclar metadatos
-- de la prueba con el contenido de cada pregunta.
CREATE TABLE IF NOT EXISTS public.pruebas (
  id            UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre        TEXT         NOT NULL,
  instrucciones TEXT         NOT NULL DEFAULT '',
  scope         TEXT         NOT NULL CHECK (scope IN ('parcial', 'tema', 'subtema')),
  parcial_key   TEXT         NOT NULL CHECK (parcial_key IN ('primer', 'segundo', 'tercer')),
  tema_id       INTEGER      REFERENCES public.temas(id) ON DELETE SET NULL,
  subtema_id    INTEGER      REFERENCES public.subtemas(id) ON DELETE SET NULL,
  estado        TEXT         NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador', 'publicada', 'archivada')),
  created_by    UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT pruebas_scope_consistency CHECK (
    (scope = 'parcial' AND tema_id IS NULL AND subtema_id IS NULL) OR
    (scope = 'tema' AND tema_id IS NOT NULL AND subtema_id IS NULL) OR
    (scope = 'subtema' AND tema_id IS NOT NULL AND subtema_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_pruebas_scope_parcial
  ON public.pruebas (scope, parcial_key);

CREATE INDEX IF NOT EXISTS idx_pruebas_tema_id
  ON public.pruebas (tema_id);

CREATE INDEX IF NOT EXISTS idx_pruebas_subtema_id
  ON public.pruebas (subtema_id);

CREATE INDEX IF NOT EXISTS idx_pruebas_estado_created_at
  ON public.pruebas (estado, created_at DESC);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Tabla hija: una fila por pregunta dentro de cada prueba.
-- Guarda el orden, el tipo único de pregunta por ahora, y la referencia visual
-- a una placa que se mostrará junto al enunciado.
CREATE TABLE IF NOT EXISTS public.prueba_preguntas (
  id                   UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prueba_id            UUID         NOT NULL REFERENCES public.pruebas(id) ON DELETE CASCADE,
  sort_order           INTEGER      NOT NULL DEFAULT 0,
  tipo                 TEXT         NOT NULL DEFAULT 'single_choice' CHECK (tipo = 'single_choice'),
  titulo               TEXT         NOT NULL DEFAULT '',
  retroalimentacion    TEXT         NOT NULL DEFAULT '',
  required             BOOLEAN      NOT NULL DEFAULT TRUE,
  reference_placa_id   INTEGER      REFERENCES public.placas(id) ON DELETE SET NULL,
  reference_photo_url  TEXT,
  reference_tema_name  TEXT,
  reference_subtema_name TEXT,
  reference_senalado_x NUMERIC,
  reference_senalado_y NUMERIC,
  reference_senalado_start_x NUMERIC,
  reference_senalado_start_y NUMERIC,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_prueba_preguntas_prueba_sort_order
  ON public.prueba_preguntas (prueba_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_prueba_preguntas_prueba_id
  ON public.prueba_preguntas (prueba_id);

ALTER TABLE public.prueba_preguntas
  DROP COLUMN IF EXISTS descripcion;

ALTER TABLE public.prueba_preguntas
  ADD COLUMN IF NOT EXISTS reference_senalado_x NUMERIC,
  ADD COLUMN IF NOT EXISTS reference_senalado_y NUMERIC,
  ADD COLUMN IF NOT EXISTS reference_senalado_start_x NUMERIC,
  ADD COLUMN IF NOT EXISTS reference_senalado_start_y NUMERIC;

DROP TRIGGER IF EXISTS update_prueba_preguntas_updated_at ON public.prueba_preguntas;
CREATE TRIGGER update_prueba_preguntas_updated_at
  BEFORE UPDATE ON public.prueba_preguntas
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Tabla hija de opciones: una fila por opción de respuesta de cada pregunta.
-- `is_correct` marca la respuesta correcta; el orden se guarda para reconstruir
-- la pregunta exactamente como se ve en el editor.
CREATE TABLE IF NOT EXISTS public.prueba_pregunta_opciones (
  id            UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pregunta_id   UUID         NOT NULL REFERENCES public.prueba_preguntas(id) ON DELETE CASCADE,
  sort_order    INTEGER      NOT NULL DEFAULT 0,
  texto         TEXT         NOT NULL,
  is_correct    BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_prueba_pregunta_opciones_pregunta_sort_order
  ON public.prueba_pregunta_opciones (pregunta_id, sort_order);

CREATE UNIQUE INDEX IF NOT EXISTS idx_prueba_pregunta_opciones_unica_correcta
  ON public.prueba_pregunta_opciones (pregunta_id)
  WHERE is_correct;

CREATE INDEX IF NOT EXISTS idx_prueba_pregunta_opciones_pregunta_id
  ON public.prueba_pregunta_opciones (pregunta_id);

DROP TRIGGER IF EXISTS update_prueba_pregunta_opciones_updated_at ON public.prueba_pregunta_opciones;
CREATE TRIGGER update_prueba_pregunta_opciones_updated_at
  BEFORE UPDATE ON public.prueba_pregunta_opciones
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_pruebas_updated_at ON public.pruebas;
CREATE TRIGGER update_pruebas_updated_at
  BEFORE UPDATE ON public.pruebas
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pruebas TO anon, authenticated;

ALTER TABLE public.pruebas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir lectura de pruebas"
  ON public.pruebas FOR SELECT
  USING (true);

CREATE POLICY "Permitir insercion de pruebas"
  ON public.pruebas FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Permitir actualizacion de pruebas"
  ON public.pruebas FOR UPDATE
  USING (true);

CREATE POLICY "Permitir eliminacion de pruebas"
  ON public.pruebas FOR DELETE
  USING (true);

ALTER TABLE public.prueba_preguntas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir lectura de preguntas de prueba"
  ON public.prueba_preguntas FOR SELECT
  USING (true);

CREATE POLICY "Permitir insercion de preguntas de prueba"
  ON public.prueba_preguntas FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Permitir actualizacion de preguntas de prueba"
  ON public.prueba_preguntas FOR UPDATE
  USING (true);

CREATE POLICY "Permitir eliminacion de preguntas de prueba"
  ON public.prueba_preguntas FOR DELETE
  USING (true);

ALTER TABLE public.prueba_pregunta_opciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir lectura de opciones de prueba"
  ON public.prueba_pregunta_opciones FOR SELECT
  USING (true);

CREATE POLICY "Permitir insercion de opciones de prueba"
  ON public.prueba_pregunta_opciones FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Permitir actualizacion de opciones de prueba"
  ON public.prueba_pregunta_opciones FOR UPDATE
  USING (true);

CREATE POLICY "Permitir eliminacion de opciones de prueba"
  ON public.prueba_pregunta_opciones FOR DELETE
  USING (true);

-- RPC atómico para guardar una prueba completa con preguntas y opciones.
-- Reemplaza el contenido hijo de la prueba en una sola operación.
DROP FUNCTION IF EXISTS public.guardar_prueba_completa(UUID, TEXT, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.guardar_prueba_completa(
  p_prueba_id UUID,
  p_nombre TEXT,
  p_instrucciones TEXT,
  p_preguntas JSONB
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_pregunta JSONB;
  v_pregunta_id UUID;
  v_opcion JSONB;
BEGIN
  UPDATE public.pruebas
  SET nombre = p_nombre,
      instrucciones = p_instrucciones
  WHERE id = p_prueba_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe la prueba %', p_prueba_id;
  END IF;

  DELETE FROM public.prueba_preguntas
  WHERE prueba_id = p_prueba_id;

  FOR v_pregunta IN
    SELECT *
    FROM jsonb_array_elements(COALESCE(p_preguntas, '[]'::jsonb))
  LOOP
    INSERT INTO public.prueba_preguntas (
      prueba_id,
      sort_order,
      tipo,
      titulo,
      retroalimentacion,
      required,
      reference_placa_id,
      reference_photo_url,
      reference_tema_name,
      reference_subtema_name,
      reference_senalado_x,
      reference_senalado_y,
      reference_senalado_start_x,
      reference_senalado_start_y
    )
    VALUES (
      p_prueba_id,
      COALESCE((v_pregunta->>'sortOrder')::integer, 0),
      'single_choice',
      COALESCE(v_pregunta->>'title', ''),
      COALESCE(v_pregunta->>'retroalimentacion', ''),
      COALESCE((v_pregunta->>'required')::boolean, TRUE),
      NULLIF(v_pregunta->>'referencePlacaId', '')::integer,
      NULLIF(v_pregunta->>'referencePhotoUrl', ''),
      NULLIF(v_pregunta->>'referenceTemaName', ''),
      NULLIF(v_pregunta->>'referenceSubtemaName', ''),
      NULLIF(v_pregunta->'referenceSenaladoLocation'->>'x', '')::numeric,
      NULLIF(v_pregunta->'referenceSenaladoLocation'->>'y', '')::numeric,
      NULLIF(v_pregunta->'referenceSenaladoLocation'->>'startX', '')::numeric,
      NULLIF(v_pregunta->'referenceSenaladoLocation'->>'startY', '')::numeric
    )
    RETURNING id INTO v_pregunta_id;

    FOR v_opcion IN
      SELECT *
      FROM jsonb_array_elements(COALESCE(v_pregunta->'options', '[]'::jsonb))
    LOOP
      INSERT INTO public.prueba_pregunta_opciones (
        pregunta_id,
        sort_order,
        texto,
        is_correct
      )
      VALUES (
        v_pregunta_id,
        COALESCE((v_opcion->>'sortOrder')::integer, 0),
        COALESCE(v_opcion->>'text', ''),
        COALESCE((v_opcion->>'isCorrect')::boolean, FALSE)
      );
    END LOOP;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.guardar_prueba_completa(UUID, TEXT, TEXT, JSONB) TO anon, authenticated;