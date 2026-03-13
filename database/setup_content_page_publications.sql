-- ============================================================
-- Atlas de Histologia - Publicacion de contenido por pagina
-- Ejecuta este script en el Editor SQL de Supabase Dashboard
-- ============================================================

CREATE TABLE IF NOT EXISTS public.content_page_publications (
  id               BIGSERIAL    PRIMARY KEY,
  entity_type      TEXT         NOT NULL,
  entity_id        INTEGER      NOT NULL,
  status           TEXT         NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  published_blocks JSONB        NOT NULL DEFAULT '[]'::jsonb,
  published_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_content_page_publications_entity
  ON public.content_page_publications (entity_type, entity_id);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_content_page_publications_updated_at ON public.content_page_publications;
CREATE TRIGGER update_content_page_publications_updated_at
  BEFORE UPDATE ON public.content_page_publications
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

ALTER TABLE public.content_page_publications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir lectura de content_page_publications"
  ON public.content_page_publications FOR SELECT
  USING (true);

CREATE POLICY "Permitir insercion de content_page_publications"
  ON public.content_page_publications FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Permitir actualizacion de content_page_publications"
  ON public.content_page_publications FOR UPDATE
  USING (true);

CREATE POLICY "Permitir eliminacion de content_page_publications"
  ON public.content_page_publications FOR DELETE
  USING (true);
