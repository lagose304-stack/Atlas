-- ============================================================
--  Atlas de Histología — Tabla de bloques de contenido
--  Ejecuta este script en el Editor SQL de Supabase Dashboard
-- ============================================================

CREATE TABLE IF NOT EXISTS public.content_blocks (
  id           UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type  TEXT         NOT NULL,   -- 'subtemas_page' | 'placas_page'
  entity_id    INTEGER      NOT NULL,   -- tema_id  o  subtema_id
  block_type   TEXT         NOT NULL,   -- 'heading' | 'subheading' | 'paragraph' | 'image' | 'text_image'
  sort_order   INTEGER      NOT NULL DEFAULT 0,
  content      JSONB        NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Índice compuesto para consultas rápidas por entidad
CREATE INDEX IF NOT EXISTS idx_content_blocks_entity
  ON public.content_blocks (entity_type, entity_id, sort_order);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_content_blocks_updated_at ON public.content_blocks;
CREATE TRIGGER update_content_blocks_updated_at
  BEFORE UPDATE ON public.content_blocks
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Habilitar Row Level Security (igual que el resto del proyecto)
ALTER TABLE public.content_blocks ENABLE ROW LEVEL SECURITY;

-- Lectura pública
CREATE POLICY "Permitir lectura de content_blocks"
  ON public.content_blocks FOR SELECT
  USING (true);

-- Inserción abierta (mismo patrón que placas/subtemas)
CREATE POLICY "Permitir inserción de content_blocks"
  ON public.content_blocks FOR INSERT
  WITH CHECK (true);

-- Actualización abierta
CREATE POLICY "Permitir actualización de content_blocks"
  ON public.content_blocks FOR UPDATE
  USING (true);

-- Eliminación abierta
CREATE POLICY "Permitir eliminación de content_blocks"
  ON public.content_blocks FOR DELETE
  USING (true);
