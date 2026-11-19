-- ============================================================
-- Atlas Editor de Páginas 2.0 (Fase 2 - Parte 6)
-- Tablas y RPCs aisladas en el esquema `editor2` para guardar
-- presets de estilo y plantillas de sección reutilizables entre equipos.
-- NO toca tablas `content_*`, catálogo ni usuarios.
-- NO ejecutar en producción sin autorización explícita del usuario.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS editor2.style_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 80),
  style jsonb NOT NULL,
  created_by bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS editor2.section_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 100),
  category text NOT NULL DEFAULT 'Personalizada' CHECK (char_length(trim(category)) BETWEEN 1 AND 48),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 200),
  section jsonb NOT NULL,
  created_by bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE editor2.style_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE editor2.section_templates ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE editor2.style_presets FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE editor2.section_templates FROM PUBLIC, anon, authenticated;

-- ---- RPCs de Presets de Estilo ----

CREATE OR REPLACE FUNCTION public.editor2_list_presets()
RETURNS TABLE (
  id uuid,
  name text,
  style jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = editor2, public
AS $$
BEGIN
  PERFORM editor2.assert_session();
  RETURN QUERY
  SELECT p.id, p.name, p.style, p.created_at
  FROM editor2.style_presets p
  ORDER BY p.created_at DESC
  LIMIT 100;
END;
$$;

CREATE OR REPLACE FUNCTION public.editor2_save_preset(
  p_name text,
  p_style jsonb
)
RETURNS TABLE (
  id uuid,
  name text,
  style jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = editor2, public
AS $$
DECLARE
  v_user_id bigint;
  v_clean_name text;
BEGIN
  v_user_id := editor2.assert_session();
  v_clean_name := trim(coalesce(p_name, ''));
  IF char_length(v_clean_name) < 1 OR char_length(v_clean_name) > 80 THEN
    RAISE EXCEPTION 'editor2_invalid_preset_name';
  END IF;
  IF p_style IS NULL OR jsonb_typeof(p_style) <> 'object' THEN
    RAISE EXCEPTION 'editor2_invalid_preset_style';
  END IF;

  RETURN QUERY
  INSERT INTO editor2.style_presets (name, style, created_by)
  VALUES (v_clean_name, p_style, v_user_id)
  RETURNING style_presets.id, style_presets.name, style_presets.style, style_presets.created_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.editor2_delete_preset(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = editor2, public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  PERFORM editor2.assert_session();
  DELETE FROM editor2.style_presets WHERE id = p_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted > 0;
END;
$$;

-- ---- RPCs de Plantillas de Sección ----

CREATE OR REPLACE FUNCTION public.editor2_list_templates()
RETURNS TABLE (
  id uuid,
  name text,
  category text,
  description text,
  section jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = editor2, public
AS $$
BEGIN
  PERFORM editor2.assert_session();
  RETURN QUERY
  SELECT t.id, t.name, t.category, t.description, t.section, t.created_at
  FROM editor2.section_templates t
  ORDER BY t.created_at DESC
  LIMIT 100;
END;
$$;

CREATE OR REPLACE FUNCTION public.editor2_save_template(
  p_name text,
  p_category text,
  p_description text,
  p_section jsonb
)
RETURNS TABLE (
  id uuid,
  name text,
  category text,
  description text,
  section jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = editor2, public
AS $$
DECLARE
  v_user_id bigint;
  v_clean_name text;
  v_clean_cat text;
  v_clean_desc text;
BEGIN
  v_user_id := editor2.assert_session();
  v_clean_name := trim(coalesce(p_name, ''));
  v_clean_cat := coalesce(nullif(trim(coalesce(p_category, '')), ''), 'Personalizada');
  v_clean_desc := left(trim(coalesce(p_description, '')), 200);

  IF char_length(v_clean_name) < 1 OR char_length(v_clean_name) > 100 THEN
    RAISE EXCEPTION 'editor2_invalid_template_name';
  END IF;
  IF p_section IS NULL OR jsonb_typeof(p_section) <> 'object' THEN
    RAISE EXCEPTION 'editor2_invalid_template_section';
  END IF;

  RETURN QUERY
  INSERT INTO editor2.section_templates (name, category, description, section, created_by)
  VALUES (v_clean_name, v_clean_cat, v_clean_desc, p_section, v_user_id)
  RETURNING section_templates.id, section_templates.name, section_templates.category, section_templates.description, section_templates.section, section_templates.created_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.editor2_delete_template(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = editor2, public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  PERFORM editor2.assert_session();
  DELETE FROM editor2.section_templates WHERE id = p_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.editor2_list_presets() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.editor2_save_preset(text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.editor2_delete_preset(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.editor2_list_templates() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.editor2_save_template(text, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.editor2_delete_template(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.editor2_list_presets() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.editor2_save_preset(text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.editor2_delete_preset(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.editor2_list_templates() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.editor2_save_template(text, text, text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.editor2_delete_template(uuid) TO anon, authenticated;

COMMIT;
