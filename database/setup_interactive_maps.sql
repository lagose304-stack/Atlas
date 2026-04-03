-- ============================================================
-- Atlas de Histologia - Mapas interactivos por placa
-- Ejecuta este script en el Editor SQL de Supabase Dashboard
-- ============================================================

CREATE TABLE IF NOT EXISTS public.interactive_maps (
  id          BIGSERIAL   PRIMARY KEY,
  tema_id     INTEGER     NOT NULL REFERENCES public.temas(id) ON DELETE CASCADE,
  subtema_id  INTEGER     REFERENCES public.subtemas(id) ON DELETE SET NULL,
  placa_id    INTEGER     NOT NULL REFERENCES public.placas(id) ON DELETE CASCADE,
  map_number  INTEGER     NOT NULL CHECK (map_number > 0),
  sections    JSONB       NOT NULL DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Numeracion por tema: cada tema tiene su propio mapa 1, 2, 3...
  CONSTRAINT interactive_maps_tema_map_number_key UNIQUE (tema_id, map_number),

  -- Una placa mantiene un unico mapa editable
  CONSTRAINT interactive_maps_placa_unique UNIQUE (placa_id)
);

CREATE INDEX IF NOT EXISTS idx_interactive_maps_tema_id
  ON public.interactive_maps (tema_id);

CREATE INDEX IF NOT EXISTS idx_interactive_maps_subtema_id
  ON public.interactive_maps (subtema_id);

CREATE INDEX IF NOT EXISTS idx_interactive_maps_placa_id
  ON public.interactive_maps (placa_id);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_interactive_maps_updated_at ON public.interactive_maps;
CREATE TRIGGER update_interactive_maps_updated_at
  BEFORE UPDATE ON public.interactive_maps
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

ALTER TABLE public.interactive_maps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir lectura de interactive_maps"
  ON public.interactive_maps FOR SELECT
  USING (true);

CREATE POLICY "Permitir insercion de interactive_maps"
  ON public.interactive_maps FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Permitir actualizacion de interactive_maps"
  ON public.interactive_maps FOR UPDATE
  USING (true);

CREATE POLICY "Permitir eliminacion de interactive_maps"
  ON public.interactive_maps FOR DELETE
  USING (true);
