-- ============================================================
-- Atlas Editor de Páginas 2.0 (Fase 1 - Parte 5)
-- Esquema lógico aislado `editor2` y 9 RPC en `public`.
-- NO toca tablas `content_*`, ni catálogo, ni usuarios.
-- NO ejecutar en producción sin respaldo verificado y autorización explícita.
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS editor2;

REVOKE ALL ON SCHEMA editor2 FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------
-- 1. Tablas aisladas en esquema `editor2`
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS editor2.pages (
  page_key text PRIMARY KEY
    CHECK (page_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' AND char_length(page_key) <= 120),
  title text NOT NULL CHECK (char_length(trim(title)) > 0),
  section text NOT NULL CHECK (char_length(trim(section)) > 0),
  public_path text NOT NULL CHECK (char_length(trim(public_path)) > 0),
  description text NOT NULL DEFAULT '',
  keywords text[] NOT NULL DEFAULT '{}',
  kind text NOT NULL DEFAULT 'fixed' CHECK (kind IN ('fixed', 'tema', 'subtema')),
  parent_page_key text,
  parcial text,
  sort_order integer NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS editor2.versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key text NOT NULL
    CHECK (page_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' AND char_length(page_key) <= 120),
  version_number integer NOT NULL CHECK (version_number > 0),
  label text NOT NULL DEFAULT '',
  doc jsonb NOT NULL,
  source text NOT NULL CHECK (source IN ('draft', 'version', 'empty')),
  actor_id integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (page_key, version_number)
);

CREATE TABLE IF NOT EXISTS editor2.drafts (
  page_key text PRIMARY KEY
    CHECK (page_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' AND char_length(page_key) <= 120),
  doc jsonb NOT NULL,
  base_version_id uuid REFERENCES editor2.versions(id) ON DELETE SET NULL,
  actor_id integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS editor2.publications (
  page_key text PRIMARY KEY
    CHECK (page_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' AND char_length(page_key) <= 120),
  version_id uuid NOT NULL REFERENCES editor2.versions(id) ON DELETE RESTRICT,
  actor_id integer,
  published_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS editor2.audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  page_key text NOT NULL,
  action text NOT NULL,
  version_id uuid,
  actor_id integer,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_editor2_versions_page_created
  ON editor2.versions (page_key, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_editor2_audit_page_created
  ON editor2.audit (page_key, created_at DESC);

ALTER TABLE editor2.pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE editor2.versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE editor2.drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE editor2.publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE editor2.audit ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON editor2.pages FROM PUBLIC, anon, authenticated;
REVOKE ALL ON editor2.versions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON editor2.drafts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON editor2.publications FROM PUBLIC, anon, authenticated;
REVOKE ALL ON editor2.audit FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------
-- 2. Auxiliares privados de sesión y validación mínima
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION editor2.assert_session()
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = editor2, public
AS $$
DECLARE
  v_actor_id integer;
BEGIN
  v_actor_id := public.atlas_session_user_id();
  IF v_actor_id IS NULL OR NOT public.atlas_has_role(ARRAY['Administrador', 'Microscopía']) THEN
    RAISE EXCEPTION 'editor2_unauthorized: sesión de Atlas inválida o sin rol de edición'
      USING ERRCODE = '28000';
  END IF;
  RETURN v_actor_id;
END;
$$;

CREATE OR REPLACE FUNCTION editor2.assert_valid_doc(p_page_key text, p_doc jsonb)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = editor2, public
AS $$
DECLARE
  v_schema_version integer;
BEGIN
  IF p_page_key IS NULL OR p_page_key !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' OR char_length(p_page_key) > 120 THEN
    RAISE EXCEPTION 'editor2_validation: pageKey inválido'
      USING ERRCODE = '22023';
  END IF;

  IF p_doc IS NULL OR jsonb_typeof(p_doc) <> 'object' THEN
    RAISE EXCEPTION 'editor2_validation: documento JSON inválido'
      USING ERRCODE = '22023';
  END IF;

  IF NOT (p_doc ? 'schemaVersion') OR jsonb_typeof(p_doc -> 'schemaVersion') <> 'number' THEN
    RAISE EXCEPTION 'editor2_validation: falta schemaVersion'
      USING ERRCODE = '22023';
  END IF;

  v_schema_version := (p_doc ->> 'schemaVersion')::integer;
  IF v_schema_version NOT IN (1, 2) THEN
    RAISE EXCEPTION 'editor2_validation: schemaVersion no soportada (%)' , v_schema_version
      USING ERRCODE = '22023';
  END IF;

  IF COALESCE(p_doc ->> 'pageKey', '') <> p_page_key THEN
    RAISE EXCEPTION 'editor2_validation: pageKey del documento no coincide con el destino'
      USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(p_doc -> 'root') <> 'object'
     OR COALESCE(p_doc -> 'root' ->> 'type', '') <> 'canvas'
     OR jsonb_typeof(p_doc -> 'root' -> 'slots' -> 'children') <> 'array' THEN
    RAISE EXCEPTION 'editor2_validation: estructura root.slots.children inválida'
      USING ERRCODE = '22023';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION editor2.next_version_number(p_page_key text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = editor2, public
AS $$
DECLARE
  v_next integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('editor2.versions:' || p_page_key));
  SELECT COALESCE(MAX(version_number), 0) + 1
  INTO v_next
  FROM editor2.versions
  WHERE page_key = p_page_key;
  RETURN v_next;
END;
$$;

REVOKE ALL ON FUNCTION editor2.assert_session() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION editor2.assert_valid_doc(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION editor2.next_version_number(text) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------
-- 3. RPC públicas del Editor 2.0 (en `public`)
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.editor2_list_pages()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = editor2, public
AS $$
DECLARE
  v_rows jsonb;
BEGIN
  PERFORM editor2.assert_session();

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'pageKey', p.page_key,
        'title', p.title,
        'section', p.section,
        'publicPath', p.public_path,
        'description', p.description,
        'keywords', to_jsonb(p.keywords),
        'kind', p.kind,
        'parentPageKey', p.parent_page_key,
        'parcial', p.parcial,
        'sortOrder', p.sort_order,
        'enabled', p.enabled,
        'hasDraft', (d.page_key IS NOT NULL),
        'draftUpdatedAt', d.updated_at,
        'publishedVersionId', pub.version_id,
        'publishedVersionNumber', v.version_number,
        'publishedAt', pub.published_at
      )
      ORDER BY p.sort_order ASC, p.title ASC
    ),
    '[]'::jsonb
  )
  INTO v_rows
  FROM editor2.pages p
  LEFT JOIN editor2.drafts d ON d.page_key = p.page_key
  LEFT JOIN editor2.publications pub ON pub.page_key = p.page_key
  LEFT JOIN editor2.versions v ON v.id = pub.version_id
  WHERE p.enabled = true;

  RETURN v_rows;
END;
$$;

CREATE OR REPLACE FUNCTION public.editor2_upsert_pages(p_pages jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = editor2, public
AS $$
DECLARE
  v_actor_id integer;
  v_item jsonb;
  v_count integer := 0;
  v_page_key text;
  v_keywords text[];
BEGIN
  v_actor_id := editor2.assert_session();

  IF p_pages IS NULL OR jsonb_typeof(p_pages) <> 'array' THEN
    RAISE EXCEPTION 'editor2_validation: p_pages debe ser un arreglo JSON'
      USING ERRCODE = '22023';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_pages)
  LOOP
    v_page_key := COALESCE(v_item ->> 'pageKey', '');
    IF v_page_key !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' OR char_length(v_page_key) > 120 THEN
      RAISE EXCEPTION 'editor2_validation: pageKey inválido en índice (%)' , v_page_key
        USING ERRCODE = '22023';
    END IF;

    SELECT COALESCE(array_agg(elem), '{}')
    INTO v_keywords
    FROM jsonb_array_elements_text(COALESCE(v_item -> 'keywords', '[]'::jsonb)) AS elem;

    INSERT INTO editor2.pages (
      page_key, title, section, public_path, description,
      keywords, kind, parent_page_key, parcial, sort_order, enabled, updated_at
    )
    VALUES (
      v_page_key,
      trim(COALESCE(v_item ->> 'title', v_page_key)),
      trim(COALESCE(v_item ->> 'section', 'General')),
      trim(COALESCE(v_item ->> 'publicPath', '/')),
      COALESCE(v_item ->> 'description', ''),
      v_keywords,
      CASE
        WHEN (v_item ->> 'kind') IN ('fixed', 'tema', 'subtema') THEN v_item ->> 'kind'
        ELSE 'fixed'
      END,
      NULLIF(trim(COALESCE(v_item ->> 'parentPageKey', '')), ''),
      NULLIF(trim(COALESCE(v_item ->> 'parcial', '')), ''),
      COALESCE((v_item ->> 'sortOrder')::integer, v_count),
      COALESCE((v_item ->> 'enabled')::boolean, true),
      now()
    )
    ON CONFLICT (page_key) DO UPDATE SET
      title = EXCLUDED.title,
      section = EXCLUDED.section,
      public_path = EXCLUDED.public_path,
      description = EXCLUDED.description,
      keywords = EXCLUDED.keywords,
      kind = EXCLUDED.kind,
      parent_page_key = EXCLUDED.parent_page_key,
      parcial = EXCLUDED.parcial,
      sort_order = EXCLUDED.sort_order,
      enabled = EXCLUDED.enabled,
      updated_at = now();

    v_count := v_count + 1;
  END LOOP;

  INSERT INTO editor2.audit (page_key, action, actor_id, detail)
  VALUES ('_index', 'upsert_pages', v_actor_id, jsonb_build_object('count', v_count));

  RETURN jsonb_build_object('ok', true, 'count', v_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.editor2_get_workspace(p_page_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = editor2, public
AS $$
DECLARE
  v_draft jsonb;
  v_versions jsonb;
  v_pub jsonb;
BEGIN
  PERFORM editor2.assert_session();

  IF p_page_key IS NULL OR p_page_key !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' THEN
    RAISE EXCEPTION 'editor2_validation: pageKey inválido'
      USING ERRCODE = '22023';
  END IF;

  SELECT jsonb_build_object(
    'pageKey', d.page_key,
    'doc', d.doc,
    'baseVersionId', d.base_version_id,
    'actorId', d.actor_id,
    'updatedAt', d.updated_at
  )
  INTO v_draft
  FROM editor2.drafts d
  WHERE d.page_key = p_page_key;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', v.id,
        'pageKey', v.page_key,
        'versionNumber', v.version_number,
        'label', v.label,
        'source', v.source,
        'actorId', v.actor_id,
        'createdAt', v.created_at,
        'isPublished', (pub.version_id = v.id)
      )
      ORDER BY v.version_number DESC
    ),
    '[]'::jsonb
  )
  INTO v_versions
  FROM editor2.versions v
  LEFT JOIN editor2.publications pub ON pub.page_key = v.page_key
  WHERE v.page_key = p_page_key;

  SELECT jsonb_build_object(
    'pageKey', pub.page_key,
    'versionId', pub.version_id,
    'versionNumber', v.version_number,
    'label', v.label,
    'actorId', pub.actor_id,
    'publishedAt', pub.published_at
  )
  INTO v_pub
  FROM editor2.publications pub
  JOIN editor2.versions v ON v.id = pub.version_id
  WHERE pub.page_key = p_page_key;

  RETURN jsonb_build_object(
    'pageKey', p_page_key,
    'draft', v_draft,
    'versions', v_versions,
    'publication', v_pub
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.editor2_save_draft(
  p_page_key text,
  p_doc jsonb,
  p_base_version_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = editor2, public
AS $$
DECLARE
  v_actor_id integer;
  v_updated_at timestamptz;
BEGIN
  v_actor_id := editor2.assert_session();
  PERFORM editor2.assert_valid_doc(p_page_key, p_doc);

  INSERT INTO editor2.drafts (page_key, doc, base_version_id, actor_id, updated_at)
  VALUES (p_page_key, p_doc, p_base_version_id, v_actor_id, now())
  ON CONFLICT (page_key) DO UPDATE SET
    doc = EXCLUDED.doc,
    base_version_id = COALESCE(EXCLUDED.base_version_id, editor2.drafts.base_version_id),
    actor_id = EXCLUDED.actor_id,
    updated_at = now()
  RETURNING updated_at INTO v_updated_at;

  INSERT INTO editor2.audit (page_key, action, version_id, actor_id, detail)
  VALUES (p_page_key, 'save_draft', p_base_version_id, v_actor_id, '{}'::jsonb);

  RETURN jsonb_build_object(
    'pageKey', p_page_key,
    'doc', p_doc,
    'baseVersionId', p_base_version_id,
    'actorId', v_actor_id,
    'updatedAt', v_updated_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.editor2_create_version(
  p_page_key text,
  p_label text DEFAULT '',
  p_source text DEFAULT 'draft',
  p_source_version_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = editor2, public
AS $$
DECLARE
  v_actor_id integer;
  v_doc jsonb;
  v_version_number integer;
  v_row editor2.versions%ROWTYPE;
BEGIN
  v_actor_id := editor2.assert_session();

  IF p_source NOT IN ('draft', 'version', 'empty') THEN
    RAISE EXCEPTION 'editor2_validation: origen de versión inválido'
      USING ERRCODE = '22023';
  END IF;

  IF p_source = 'draft' THEN
    SELECT doc INTO v_doc FROM editor2.drafts WHERE page_key = p_page_key FOR UPDATE;
    IF v_doc IS NULL THEN
      RAISE EXCEPTION 'editor2_not_found: no existe borrador para crear versión'
        USING ERRCODE = 'P0002';
    END IF;
  ELSIF p_source = 'version' THEN
    SELECT doc INTO v_doc
    FROM editor2.versions
    WHERE id = p_source_version_id AND page_key = p_page_key;
    IF v_doc IS NULL THEN
      RAISE EXCEPTION 'editor2_not_found: versión origen no encontrada'
        USING ERRCODE = 'P0002';
    END IF;
  ELSE
    v_doc := jsonb_build_object(
      'schemaVersion', 2,
      'pageKey', p_page_key,
      'root', jsonb_build_object(
        'id', gen_random_uuid()::text,
        'type', 'canvas',
        'props', jsonb_build_object('gap', 'md', 'depth', 0),
        'slots', jsonb_build_object('children', '[]'::jsonb)
      )
    );
  END IF;

  PERFORM editor2.assert_valid_doc(p_page_key, v_doc);
  v_version_number := editor2.next_version_number(p_page_key);

  INSERT INTO editor2.versions (page_key, version_number, label, doc, source, actor_id)
  VALUES (p_page_key, v_version_number, COALESCE(trim(p_label), ''), v_doc, p_source, v_actor_id)
  RETURNING * INTO v_row;

  INSERT INTO editor2.audit (page_key, action, version_id, actor_id, detail)
  VALUES (
    p_page_key,
    'create_version',
    v_row.id,
    v_actor_id,
    jsonb_build_object('versionNumber', v_row.version_number, 'source', p_source)
  );

  RETURN jsonb_build_object(
    'id', v_row.id,
    'pageKey', v_row.page_key,
    'versionNumber', v_row.version_number,
    'label', v_row.label,
    'source', v_row.source,
    'actorId', v_row.actor_id,
    'createdAt', v_row.created_at,
    'isPublished', false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.editor2_publish_draft(
  p_page_key text,
  p_label text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = editor2, public
AS $$
DECLARE
  v_actor_id integer;
  v_draft editor2.drafts%ROWTYPE;
  v_version_number integer;
  v_version editor2.versions%ROWTYPE;
  v_published_at timestamptz;
BEGIN
  v_actor_id := editor2.assert_session();

  SELECT * INTO v_draft
  FROM editor2.drafts
  WHERE page_key = p_page_key
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'editor2_not_found: no existe borrador para publicar'
      USING ERRCODE = 'P0002';
  END IF;

  PERFORM editor2.assert_valid_doc(p_page_key, v_draft.doc);
  v_version_number := editor2.next_version_number(p_page_key);

  INSERT INTO editor2.versions (page_key, version_number, label, doc, source, actor_id)
  VALUES (p_page_key, v_version_number, COALESCE(trim(p_label), ''), v_draft.doc, 'draft', v_actor_id)
  RETURNING * INTO v_version;

  INSERT INTO editor2.publications (page_key, version_id, actor_id, published_at)
  VALUES (p_page_key, v_version.id, v_actor_id, now())
  ON CONFLICT (page_key) DO UPDATE SET
    version_id = EXCLUDED.version_id,
    actor_id = EXCLUDED.actor_id,
    published_at = now()
  RETURNING published_at INTO v_published_at;

  UPDATE editor2.drafts
  SET base_version_id = v_version.id
  WHERE page_key = p_page_key;

  INSERT INTO editor2.audit (page_key, action, version_id, actor_id, detail)
  VALUES (
    p_page_key,
    'publish_draft',
    v_version.id,
    v_actor_id,
    jsonb_build_object('versionNumber', v_version.version_number)
  );

  RETURN jsonb_build_object(
    'pageKey', p_page_key,
    'versionId', v_version.id,
    'versionNumber', v_version.version_number,
    'label', v_version.label,
    'actorId', v_actor_id,
    'publishedAt', v_published_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.editor2_publish_version(
  p_page_key text,
  p_version_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = editor2, public
AS $$
DECLARE
  v_actor_id integer;
  v_version editor2.versions%ROWTYPE;
  v_published_at timestamptz;
BEGIN
  v_actor_id := editor2.assert_session();

  SELECT * INTO v_version
  FROM editor2.versions
  WHERE id = p_version_id AND page_key = p_page_key;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'editor2_not_found: versión no encontrada para esta página'
      USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO editor2.publications (page_key, version_id, actor_id, published_at)
  VALUES (p_page_key, v_version.id, v_actor_id, now())
  ON CONFLICT (page_key) DO UPDATE SET
    version_id = EXCLUDED.version_id,
    actor_id = EXCLUDED.actor_id,
    published_at = now()
  RETURNING published_at INTO v_published_at;

  INSERT INTO editor2.audit (page_key, action, version_id, actor_id, detail)
  VALUES (
    p_page_key,
    'publish_version',
    v_version.id,
    v_actor_id,
    jsonb_build_object('versionNumber', v_version.version_number)
  );

  RETURN jsonb_build_object(
    'pageKey', p_page_key,
    'versionId', v_version.id,
    'versionNumber', v_version.version_number,
    'label', v_version.label,
    'actorId', v_actor_id,
    'publishedAt', v_published_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.editor2_delete_version(
  p_page_key text,
  p_version_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = editor2, public
AS $$
DECLARE
  v_actor_id integer;
  v_is_published boolean;
  v_deleted_count integer;
BEGIN
  v_actor_id := editor2.assert_session();

  SELECT EXISTS (
    SELECT 1 FROM editor2.publications
    WHERE page_key = p_page_key AND version_id = p_version_id
  )
  INTO v_is_published;

  IF v_is_published THEN
    RAISE EXCEPTION 'editor2_conflict: no se puede eliminar la versión publicada activa'
      USING ERRCODE = '23503';
  END IF;

  DELETE FROM editor2.versions
  WHERE id = p_version_id AND page_key = p_page_key;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  IF v_deleted_count = 0 THEN
    RAISE EXCEPTION 'editor2_not_found: versión no encontrada'
      USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO editor2.audit (page_key, action, version_id, actor_id, detail)
  VALUES (p_page_key, 'delete_version', p_version_id, v_actor_id, '{}'::jsonb);

  RETURN jsonb_build_object('ok', true, 'deletedVersionId', p_version_id);
END;
$$;

-- Lectura pública sin sesión: SOLO devuelve la versión publicada activa.
-- NUNCA consulta `editor2.drafts`.
CREATE OR REPLACE FUNCTION public.editor2_get_public_doc(p_page_key text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = editor2, public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF p_page_key IS NULL OR p_page_key !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'pageKey', pub.page_key,
    'versionId', v.id,
    'versionNumber', v.version_number,
    'publishedAt', pub.published_at,
    'doc', v.doc
  )
  INTO v_result
  FROM editor2.publications pub
  JOIN editor2.versions v ON v.id = pub.version_id
  WHERE pub.page_key = p_page_key;

  RETURN v_result;
END;
$$;

-- ------------------------------------------------------------
-- 4. Privilegios de ejecución de las RPC
-- ------------------------------------------------------------

REVOKE ALL ON FUNCTION public.editor2_list_pages() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.editor2_upsert_pages(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.editor2_get_workspace(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.editor2_save_draft(text, jsonb, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.editor2_create_version(text, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.editor2_publish_draft(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.editor2_publish_version(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.editor2_delete_version(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.editor2_get_public_doc(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.editor2_list_pages() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.editor2_upsert_pages(jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.editor2_get_workspace(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.editor2_save_draft(text, jsonb, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.editor2_create_version(text, text, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.editor2_publish_draft(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.editor2_publish_version(text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.editor2_delete_version(text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.editor2_get_public_doc(text) TO anon, authenticated;

COMMIT;
