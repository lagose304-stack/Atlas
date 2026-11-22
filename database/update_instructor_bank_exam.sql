-- Requiere setup_instructor_question_bank.sql y add_instructor_question_images.sql.
-- Incluye la corrección de guardado de fix_instructor_bank_progress.sql.
-- Conserva los temas para la revisión. Las RPC del examen omiten esos metadatos.
BEGIN;

CREATE OR REPLACE FUNCTION public.atlas_instructor_matching_choices(p_question jsonb)
RETURNS TABLE(id text, texto text) LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT p->>'option_id', p->>'definition' FROM jsonb_array_elements(p_question->'pairs') p
  UNION ALL
  SELECT d->>'id', d->>'texto' FROM jsonb_array_elements(coalesce(p_question->'distractors','[]'::jsonb)) d;
$$;
REVOKE ALL ON FUNCTION public.atlas_instructor_matching_choices(jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.atlas_validate_instructor_multiple_choice(p_question jsonb, p_selection jsonb, p_required boolean)
RETURNS void LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
BEGIN
  IF p_required AND (p_selection IS NULL OR p_selection = '[]'::jsonb) THEN
    RAISE EXCEPTION 'Marca al menos una opción en la pregunta de selección múltiple';
  END IF;
  IF jsonb_typeof(p_selection) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Selección múltiple inválida';
  END IF;
  IF jsonb_array_length(p_selection) > 8
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_selection) s GROUP BY s.value HAVING count(*) > 1)
     OR EXISTS (
       SELECT 1 FROM jsonb_array_elements(p_selection) s
       WHERE jsonb_typeof(s.value) <> 'string' OR NOT EXISTS (
         SELECT 1 FROM jsonb_array_elements(p_question->'options') o WHERE o->>'id' = s.value#>>'{}'
       )
     ) THEN RAISE EXCEPTION 'Selección múltiple inválida'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.atlas_validate_instructor_multiple_choice(jsonb, jsonb, boolean) FROM PUBLIC, anon, authenticated;


CREATE OR REPLACE FUNCTION public.atlas_validate_instructor_content(p_content jsonb, p_publish boolean)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE q jsonb; o jsonb; b jsonb; v_type text; v_answers jsonb; v_blanks integer; v_per_topic integer;
BEGIN
  IF p_content IS NULL OR jsonb_typeof(p_content) <> 'object'
     OR jsonb_typeof(p_content->'nombre') IS DISTINCT FROM 'string'
     OR length(trim(p_content->>'nombre')) NOT BETWEEN 1 AND 200
     OR jsonb_typeof(p_content->'instrucciones') IS DISTINCT FROM 'string'
     OR length(p_content->>'instrucciones') > 10000
     OR octet_length(p_content::text) > 500000 THEN RAISE EXCEPTION 'Contenido inválido'; END IF;

  IF p_content->>'mode' = 'bank' THEN
    IF jsonb_typeof(p_content->'questions_per_topic') IS DISTINCT FROM 'number' THEN
      RAISE EXCEPTION 'Define cuántas preguntas aleatorias saldrán por tema';
    END IF;
    v_per_topic := (p_content->>'questions_per_topic')::integer;
    IF v_per_topic NOT BETWEEN 1 AND 50 THEN
      RAISE EXCEPTION 'La cantidad de preguntas por tema debe estar entre 1 y 50';
    END IF;
    PERFORM public.atlas_validate_instructor_schedule(p_content, p_publish);
    IF p_publish AND NOT EXISTS (
      SELECT 1 FROM public.instructor_question_bank
      WHERE jsonb_typeof(content->'groups') = 'array' AND jsonb_array_length(content->'groups') > 0
    ) THEN
      RAISE EXCEPTION 'Agrega al menos una pregunta en el banco antes de publicar';
    END IF;
    RETURN;
  END IF;

  IF jsonb_typeof(p_content->'questions') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Contenido inválido'; END IF;
  IF jsonb_array_length(p_content->'questions') > 100
     OR (p_publish AND jsonb_array_length(p_content->'questions') = 0) THEN
    RAISE EXCEPTION 'La prueba admite entre 1 y 100 incisos al publicarse';
  END IF;
  IF p_publish AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_content->'questions') x WHERE coalesce(x->>'type','single_choice') <> 'image_versus') THEN
    RAISE EXCEPTION 'Agrega al menos un inciso evaluable antes de publicar';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_content->'questions') x GROUP BY x->>'id' HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Preguntas repetidas';
  END IF;
  FOR q IN SELECT value FROM jsonb_array_elements(p_content->'questions') LOOP
    PERFORM public.atlas_validate_instructor_reference_image(q);
    v_type := coalesce(q->>'type','single_choice');
    IF jsonb_typeof(q) <> 'object' OR jsonb_typeof(q->'id') IS DISTINCT FROM 'string'
       OR coalesce(length(q->>'id'),0) NOT BETWEEN 1 AND 80
       OR jsonb_typeof(q->'titulo') IS DISTINCT FROM 'string' OR length(q->>'titulo') > 5000
       OR v_type NOT IN ('single_choice','short_answer','completion','matching','image_point','image_versus') THEN RAISE EXCEPTION 'Pregunta inválida'; END IF;
    IF v_type = 'image_versus' THEN
      IF p_publish AND (NOT (q ? 'image_a') OR NOT (q ? 'image_b')) THEN RAISE EXCEPTION 'El versus de imágenes necesita las dos imágenes antes de publicar'; END IF;
    ELSIF v_type = 'image_point' THEN
      IF p_publish AND NOT (q ? 'image') THEN RAISE EXCEPTION 'El inciso de senalado necesita una imagen'; END IF;
    ELSIF v_type = 'single_choice' THEN
      IF jsonb_typeof(q->'options') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Opciones inválidas'; END IF;
      IF jsonb_array_length(q->'options') NOT BETWEEN 2 AND 8 THEN RAISE EXCEPTION 'La selección admite de 2 a 8 opciones'; END IF;
      IF EXISTS (SELECT 1 FROM jsonb_array_elements(q->'options') x GROUP BY x->>'id' HAVING count(*) > 1) THEN RAISE EXCEPTION 'Opciones repetidas'; END IF;
      FOR o IN SELECT value FROM jsonb_array_elements(q->'options') LOOP
        IF jsonb_typeof(o) <> 'object' OR jsonb_typeof(o->'id') IS DISTINCT FROM 'string'
           OR coalesce(length(o->>'id'),0) NOT BETWEEN 1 AND 80
           OR jsonb_typeof(o->'texto') IS DISTINCT FROM 'string' OR length(o->>'texto') > 3000
           OR (p_publish AND trim(o->>'texto') = '') THEN RAISE EXCEPTION 'Opción inválida'; END IF;
      END LOOP;
      IF q ? 'correct_option_ids' THEN
        PERFORM public.atlas_validate_instructor_multiple_choice(q, q->'correct_option_ids', p_publish);
      ELSIF p_publish AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(q->'options') x WHERE x->>'id' = q->>'correct_option_id') THEN
        RAISE EXCEPTION 'Selecciona una respuesta correcta en cada pregunta';
      END IF;
    ELSIF v_type IN ('short_answer','completion') THEN
      IF v_type = 'completion' THEN
        IF q ? 'review_reference' AND
          (jsonb_typeof(q->'review_reference') IS DISTINCT FROM 'string' OR length(q->>'review_reference') > 5000) THEN
          RAISE EXCEPTION 'La referencia para revisión debe ser texto de hasta 5000 caracteres';
        END IF;
        IF jsonb_typeof(q->'blanks') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Huecos inválidos'; END IF;
        v_blanks := jsonb_array_length(q->'blanks');
        IF v_blanks NOT BETWEEN 1 AND 12 THEN RAISE EXCEPTION 'La completación admite de 1 a 12 huecos'; END IF;
        IF EXISTS (SELECT 1 FROM jsonb_array_elements(q->'blanks') x GROUP BY x->>'id' HAVING count(*) > 1) THEN RAISE EXCEPTION 'Huecos repetidos'; END IF;
      END IF;
      FOR b IN SELECT value FROM jsonb_array_elements(CASE WHEN v_type = 'short_answer'
                    THEN jsonb_build_array(jsonb_build_object('id',q->>'id','accepted_answers',q->'accepted_answers')) ELSE q->'blanks' END) LOOP
        IF jsonb_typeof(b->'id') IS DISTINCT FROM 'string' OR coalesce(length(b->>'id'),0) NOT BETWEEN 1 AND 80 THEN RAISE EXCEPTION 'Hueco inválido'; END IF;
        v_answers := b->'accepted_answers';
        IF jsonb_typeof(v_answers) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Respuestas aceptadas inválidas'; END IF;
        IF jsonb_array_length(v_answers) NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'Configura entre 1 y 20 respuestas aceptadas'; END IF;
        FOR o IN SELECT value FROM jsonb_array_elements(v_answers) LOOP
          IF jsonb_typeof(o) <> 'string' OR length(o#>>'{}') > 1000 THEN RAISE EXCEPTION 'Respuesta aceptada inválida'; END IF;
        END LOOP;
        IF p_publish AND v_type = 'completion' AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(v_answers) a
                                     WHERE public.atlas_normalize_instructor_answer(a) <> '') THEN
          RAISE EXCEPTION 'Configura una respuesta aceptada para cada pregunta y cada hueco';
        END IF;
      END LOOP;
    ELSE
      IF jsonb_typeof(q->'pairs') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Parejas inválidas'; END IF;
      IF jsonb_array_length(q->'pairs') NOT BETWEEN 2 AND 12 THEN RAISE EXCEPTION 'Configura entre 2 y 12 parejas'; END IF;
      IF EXISTS (SELECT 1 FROM jsonb_array_elements(q->'pairs') p GROUP BY p->>'id' HAVING count(*) > 1)
         OR EXISTS (SELECT 1 FROM jsonb_array_elements(q->'pairs') p GROUP BY p->>'option_id' HAVING count(*) > 1)
         OR EXISTS (SELECT 1 FROM jsonb_array_elements(q->'pairs') left_pair, jsonb_array_elements(q->'pairs') right_pair WHERE left_pair->>'id' = right_pair->>'option_id') THEN
        RAISE EXCEPTION 'Los identificadores de términos y opciones deben ser únicos e independientes';
      END IF;
      FOR b IN SELECT value FROM jsonb_array_elements(q->'pairs') LOOP
        IF jsonb_typeof(b) <> 'object' OR jsonb_typeof(b->'id') IS DISTINCT FROM 'string'
           OR coalesce(length(b->>'id'),0) NOT BETWEEN 1 AND 80 OR jsonb_typeof(b->'option_id') IS DISTINCT FROM 'string'
           OR coalesce(length(b->>'option_id'),0) NOT BETWEEN 1 AND 80
           OR jsonb_typeof(b->'term') IS DISTINCT FROM 'string' OR length(b->>'term') > 1000
           OR jsonb_typeof(b->'definition') IS DISTINCT FROM 'string' OR length(b->>'definition') > 1000
           OR (p_publish AND (trim(b->>'term') = '' OR trim(b->>'definition') = '')) THEN RAISE EXCEPTION 'Completa cada término y su pareja'; END IF;
      END LOOP;
      IF q ? 'distractors' THEN
        IF jsonb_typeof(q->'distractors') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Opciones incorrectas inválidas'; END IF;
        IF jsonb_array_length(q->'distractors') > 20 THEN RAISE EXCEPTION 'Agrega como máximo 20 opciones incorrectas'; END IF;
        FOR o IN SELECT value FROM jsonb_array_elements(q->'distractors') LOOP
          IF jsonb_typeof(o) IS DISTINCT FROM 'object'
             OR jsonb_typeof(o->'id') IS DISTINCT FROM 'string' OR length(o->>'id') NOT BETWEEN 1 AND 80
             OR jsonb_typeof(o->'texto') IS DISTINCT FROM 'string' OR length(o->>'texto') > 1000
             OR (p_publish AND trim(o->>'texto') = '') THEN RAISE EXCEPTION 'Completa las opciones incorrectas'; END IF;
        END LOOP;
        IF EXISTS (SELECT 1 FROM public.atlas_instructor_matching_choices(q) c GROUP BY c.id HAVING count(*) > 1)
           OR EXISTS (SELECT 1 FROM jsonb_array_elements(q->'pairs') p JOIN public.atlas_instructor_matching_choices(q) c ON c.id = p->>'id') THEN
          RAISE EXCEPTION 'Los identificadores de términos y opciones deben ser únicos e independientes';
        END IF;
      END IF;
      IF p_publish AND (EXISTS (SELECT 1 FROM jsonb_array_elements(q->'pairs') p GROUP BY public.atlas_normalize_instructor_answer(p->>'term') HAVING count(*) > 1)
         OR EXISTS (SELECT 1 FROM public.atlas_instructor_matching_choices(q) c GROUP BY public.atlas_normalize_instructor_answer(c.texto) HAVING count(*) > 1)) THEN
        RAISE EXCEPTION 'Usa términos y opciones diferentes para evitar respuestas ambiguas';
      END IF;
    END IF;
  END LOOP;
  PERFORM public.atlas_validate_instructor_groups(p_content, p_publish);
  PERFORM public.atlas_validate_instructor_sections(p_content,p_publish);
  PERFORM public.atlas_validate_instructor_schedule(p_content,p_publish);
END;
$$;

CREATE OR REPLACE FUNCTION public.atlas_instructor_public_questions(p_content jsonb)
RETURNS jsonb LANGUAGE sql VOLATILE SET search_path = public AS $$
  SELECT jsonb_agg(jsonb_build_object('id',q->>'id','titulo',q->>'titulo','type',coalesce(q->>'type','single_choice')) ||
    CASE coalesce(q->>'type','single_choice')
      WHEN 'image_versus' THEN jsonb_build_object(
        'image_a', jsonb_build_object('url',q->'image_a'->>'url') || CASE WHEN q->'image_a' ? 'annotations' THEN jsonb_build_object('annotations',(SELECT coalesce(jsonb_agg(jsonb_build_object('label','Señalado','x',a->'x','y',a->'y','startX',a->'startX','startY',a->'startY','regionPoints',a->'regionPoints','regionHoles',a->'regionHoles','regionColor',a->'regionColor','regionOpacity',a->'regionOpacity','regionStrokeWidth',a->'regionStrokeWidth','regionDashLength',a->'regionDashLength','regionDashGap',a->'regionDashGap','regionSmooth',a->'regionSmooth') ORDER BY i),'[]'::jsonb) FROM jsonb_array_elements(q->'image_a'->'annotations') WITH ORDINALITY x(a,i))) ELSE '{}'::jsonb END,
        'image_b', jsonb_build_object('url',q->'image_b'->>'url') || CASE WHEN q->'image_b' ? 'annotations' THEN jsonb_build_object('annotations',(SELECT coalesce(jsonb_agg(jsonb_build_object('label','Señalado','x',a->'x','y',a->'y','startX',a->'startX','startY',a->'startY','regionPoints',a->'regionPoints','regionHoles',a->'regionHoles','regionColor',a->'regionColor','regionOpacity',a->'regionOpacity','regionStrokeWidth',a->'regionStrokeWidth','regionDashLength',a->'regionDashLength','regionDashGap',a->'regionDashGap','regionSmooth',a->'regionSmooth') ORDER BY i),'[]'::jsonb) FROM jsonb_array_elements(q->'image_b'->'annotations') WITH ORDINALITY x(a,i))) ELSE '{}'::jsonb END
      )
      WHEN 'image_point' THEN jsonb_build_object('image',jsonb_build_object('url',q->'image'->>'url'))
      WHEN 'short_answer' THEN '{}'::jsonb
      WHEN 'completion' THEN jsonb_build_object('blanks',(
        SELECT jsonb_agg(jsonb_build_object('id',b->>'id') ORDER BY i) FROM jsonb_array_elements(q->'blanks') WITH ORDINALITY x(b,i)))
      WHEN 'matching' THEN jsonb_build_object('terms',(
        SELECT jsonb_agg(jsonb_build_object('id',p->>'id','texto',p->>'term') ORDER BY i) FROM jsonb_array_elements(q->'pairs') WITH ORDINALITY x(p,i)),
        'choices',(SELECT jsonb_agg(jsonb_build_object('id',c.id,'texto',c.texto) ORDER BY gen_random_uuid()) FROM public.atlas_instructor_matching_choices(q) c))
      ELSE jsonb_build_object('options',(
        SELECT jsonb_agg(jsonb_build_object('id',o->>'id','texto',o->>'texto') ORDER BY i) FROM jsonb_array_elements(q->'options') WITH ORDINALITY x(o,i)))
        || CASE WHEN q ? 'correct_option_ids' THEN jsonb_build_object('multiple', true) ELSE '{}'::jsonb END
    END || CASE
      WHEN coalesce(q->>'type','single_choice') IN ('single_choice','short_answer','completion','matching') AND q ? 'image' THEN
        jsonb_build_object('image', jsonb_build_object('url',q->'image'->>'url') || CASE WHEN q->'image' ? 'annotations' THEN jsonb_build_object('annotations',(SELECT coalesce(jsonb_agg(jsonb_build_object('label','Señalado','x',a->'x','y',a->'y','startX',a->'startX','startY',a->'startY','regionPoints',a->'regionPoints','regionHoles',a->'regionHoles','regionColor',a->'regionColor','regionOpacity',a->'regionOpacity','regionStrokeWidth',a->'regionStrokeWidth','regionDashLength',a->'regionDashLength','regionDashGap',a->'regionDashGap','regionSmooth',a->'regionSmooth') ORDER BY i),'[]'::jsonb) FROM jsonb_array_elements(q->'image'->'annotations') WITH ORDINALITY x(a,i))) ELSE '{}'::jsonb END)
      ELSE '{}'::jsonb
    END || CASE WHEN parent.group_id IS NOT NULL THEN jsonb_build_object('group', jsonb_build_object('id',parent.group_id,'titulo',parent.group_title,'position',parent.group_position) || CASE WHEN parent.section IS NOT NULL THEN jsonb_build_object('section',parent.section) ELSE '{}'::jsonb END) ELSE '{}'::jsonb END ORDER BY coalesce(parent.group_position,ord), coalesce(parent.item_position,ord))
  FROM jsonb_array_elements(p_content->'questions') WITH ORDINALITY x(q,ord)
  LEFT JOIN LATERAL (
    SELECT (SELECT jsonb_build_object('id',sec->>'id','tema_id',t.id,'nombre',t.nombre,'position',sec_ord) FROM jsonb_array_elements(coalesce(p_content->'sections','[]'::jsonb)) WITH ORDINALITY sx(sec,sec_ord) JOIN public.temas t ON t.id::text=sec->>'tema_id' WHERE sec->>'id'=g->>'section_id') AS section, g->>'id' AS group_id, g->>'titulo' AS group_title, n AS group_position,
      (SELECT i FROM jsonb_array_elements_text(g->'item_ids') WITH ORDINALITY z(item_id,i) WHERE item_id = q->>'id' LIMIT 1) AS item_position
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_content->'groups') = 'array' THEN p_content->'groups' ELSE '[]'::jsonb END) WITH ORDINALITY y(g,n)
    WHERE g->'item_ids' ? (q->>'id') LIMIT 1
  ) parent ON true;
$$;

CREATE OR REPLACE FUNCTION public.atlas_draw_instructor_bank_content(p_published jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SET search_path = public, extensions AS $$
DECLARE v_per_topic integer := greatest(1, least(50, coalesce((p_published->>'questions_per_topic')::integer, 1)));
  v_topic jsonb; v_sec_id text; v_sections jsonb := '[]'::jsonb; v_groups jsonb := '[]'::jsonb; v_questions jsonb := '[]'::jsonb;
  v_picked_group jsonb; v_item_id text; v_q jsonb;
BEGIN
  FOR v_topic IN SELECT value FROM jsonb_array_elements(coalesce(p_published->'bank_topics', '[]'::jsonb)) LOOP
    IF jsonb_typeof(v_topic->'groups') IS DISTINCT FROM 'array' OR jsonb_array_length(v_topic->'groups') = 0 THEN CONTINUE; END IF;
    v_sec_id := 'bank-sec-' || (v_topic->>'tema_id');
    v_sections := v_sections || jsonb_build_array(jsonb_build_object('id', v_sec_id, 'tema_id', (v_topic->>'tema_id')::integer, 'nombre', v_topic->>'nombre'));
    FOR v_picked_group IN
      SELECT g FROM jsonb_array_elements(v_topic->'groups') g ORDER BY gen_random_uuid() LIMIT v_per_topic
    LOOP
      v_groups := v_groups || jsonb_build_array(v_picked_group || jsonb_build_object('section_id', v_sec_id));
      FOR v_item_id IN SELECT value FROM jsonb_array_elements_text(v_picked_group->'item_ids') LOOP
        SELECT q INTO v_q FROM jsonb_array_elements(v_topic->'questions') q WHERE q->>'id' = v_item_id LIMIT 1;
        IF v_q IS NOT NULL THEN v_questions := v_questions || jsonb_build_array(v_q); END IF;
      END LOOP;
    END LOOP;
  END LOOP;
  -- El cupo se aplica por tema. El orden final se mezcla entre todos los temas.
  SELECT coalesce(jsonb_agg(g ORDER BY gen_random_uuid()), '[]'::jsonb) INTO v_groups
  FROM jsonb_array_elements(v_groups) g;
  RETURN jsonb_build_object(
    'nombre', p_published->>'nombre',
    'instrucciones', coalesce(p_published->>'instrucciones', ''),
    'sections', v_sections,
    'groups', v_groups,
    'questions', v_questions
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.atlas_unlock_instructor_test(p_id uuid, p_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v public.instructor_tests%ROWTYPE; a public.instructor_test_attempts%ROWTYPE;
  v_client text; v_token text;
BEGIN
  SELECT * INTO v FROM public.instructor_tests WHERE id = p_id AND estado = 'publicada' FOR SHARE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'status','unavailable'); END IF;
  IF public.atlas_instructor_schedule_status(v.published)<>'open' THEN RETURN jsonb_build_object('ok',false,'status','outside_schedule'); END IF;
  v_client := encode(digest(coalesce(nullif(trim(split_part(
    coalesce(nullif(current_setting('request.headers',true),'')::jsonb->>'x-forwarded-for',''), ',', 1)),''),
    'unknown'), 'sha256'),'hex');
  INSERT INTO public.instructor_test_attempts(test_id,client_hash) VALUES (p_id,v_client) ON CONFLICT DO NOTHING;
  SELECT * INTO STRICT a FROM public.instructor_test_attempts WHERE test_id = p_id AND client_hash = v_client FOR UPDATE;
  IF a.window_start <= now() - interval '15 minutes' THEN
    UPDATE public.instructor_test_attempts SET failures = 0, window_start = now() WHERE test_id = p_id AND client_hash = v_client;
    a.failures := 0;
  END IF;
  IF a.failures >= 5 THEN RETURN jsonb_build_object('ok',false,'status','locked'); END IF;
  IF p_code IS NULL OR p_code !~ '^[0-9]{6}$' OR crypt(p_code, v.code_hash) IS DISTINCT FROM v.code_hash THEN
    UPDATE public.instructor_test_attempts SET failures = failures + 1 WHERE test_id = p_id AND client_hash = v_client;
    RETURN jsonb_build_object('ok',false,'status','invalid_code');
  END IF;
  UPDATE public.instructor_test_attempts SET failures = 0 WHERE test_id = p_id AND client_hash = v_client;
  v_token := encode(gen_random_bytes(32),'hex');
  INSERT INTO public.instructor_test_access(token_hash,test_id,access_version,expires_at)
    VALUES (encode(digest(v_token,'sha256'),'hex'),p_id,v.access_version,now()+interval '2 hours');
  RETURN jsonb_build_object('ok',true,'token',v_token,'test',jsonb_build_object(
    'nombre',v.published->>'nombre',
    'instrucciones',v.published->>'instrucciones',
    'questions', CASE WHEN v.published->>'mode' = 'bank' THEN '[]'::jsonb ELSE public.atlas_instructor_public_questions(v.published - 'sections') END
  ));
END;
$$;

CREATE OR REPLACE FUNCTION public.atlas_begin_instructor_test(p_id uuid,p_token text,p_name text,p_account text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE a public.instructor_test_access%ROWTYPE; t public.instructor_tests%ROWTYPE; p public.instructor_test_progress%ROWTYPE; n text;
  v_assigned jsonb;
BEGIN
  a:=public.atlas_require_instructor_access(p_id,p_token);
  IF (SELECT public.atlas_instructor_schedule_status(published) FROM public.instructor_tests WHERE id=p_id)<>'open' THEN RAISE EXCEPTION 'La prueba esta fuera de horario'; END IF;
  IF a.result IS NOT NULL THEN RAISE EXCEPTION 'Esta prueba ya fue entregada'; END IF;
  IF p_account IS NULL OR p_account !~ '^[0-9]{10,13}$' THEN RAISE EXCEPTION 'El numero de cuenta debe tener entre 10 y 13 digitos'; END IF;
  n:=trim(regexp_replace(coalesce(p_name,''),'[[:space:]]+',' ','g'));
  IF length(n) NOT BETWEEN 1 AND 150 OR n ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'Escribe un nombre valido de hasta 150 caracteres'; END IF;
  IF EXISTS(SELECT 1 FROM public.instructor_test_submissions WHERE test_id=p_id AND account_number=p_account) THEN
    RAISE EXCEPTION 'Esta cuenta ya entrego esta prueba. Puedes consultar sus resultados cuando termine la revision';
  END IF;
  SELECT * INTO t FROM public.instructor_tests WHERE id=p_id;
  INSERT INTO public.instructor_test_progress(test_id,test_revision,account_number,participant_name,active_token_hash)
    VALUES(p_id,coalesce(t.attempt_revision,t.published_revision),p_account,n,a.token_hash) ON CONFLICT(test_id,account_number) DO NOTHING;
  SELECT * INTO p FROM public.instructor_test_progress WHERE test_id=p_id AND account_number=p_account FOR UPDATE;
  IF p.submission_id IS NOT NULL THEN RAISE EXCEPTION 'Esta cuenta ya entrego esta prueba'; END IF;
  IF p.test_revision<>coalesce(t.attempt_revision,t.published_revision) THEN
    RAISE EXCEPTION 'Esta cuenta tiene un intento de una version anterior. Contacta al responsable de la prueba';
  END IF;
  IF p.active_token_hash <> a.token_hash OR p.participant_name <> n OR (a.progress_id IS NOT NULL AND a.progress_id <> p.id) THEN
    RAISE EXCEPTION 'Ya hay una prueba iniciada. Usa Continuar prueba para recuperarla';
  END IF;
  IF t.published->>'mode' = 'bank' AND p.assigned_content IS NULL THEN
    v_assigned := public.atlas_draw_instructor_bank_content(t.published);
    UPDATE public.instructor_test_progress SET assigned_content = v_assigned WHERE id = p.id RETURNING * INTO p;
  END IF;
  UPDATE public.instructor_test_access SET participant_name=p.participant_name,account_number=p.account_number,progress_id=p.id WHERE token_hash=a.token_hash;
  RETURN jsonb_build_object(
    'ok',true,'participant_name',p.participant_name,'account_number',p.account_number,
    'answers',p.answers,'current_question_id',p.current_question_id,'progress_revision',p.revision
  ) || CASE WHEN p.assigned_content IS NOT NULL THEN jsonb_build_object('questions', public.atlas_instructor_public_questions(p.assigned_content - 'sections')) ELSE '{}'::jsonb END;
END;
$$;

CREATE OR REPLACE FUNCTION public.atlas_resume_instructor_test(p_id uuid,p_token text,p_account text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE a public.instructor_test_access%ROWTYPE; t public.instructor_tests%ROWTYPE; p public.instructor_test_progress%ROWTYPE;
  attempts public.instructor_test_attempts%ROWTYPE; client text;
BEGIN
  a:=public.atlas_require_instructor_access(p_id,p_token);
  IF (SELECT public.atlas_instructor_schedule_status(published) FROM public.instructor_tests WHERE id=p_id)<>'open' THEN RAISE EXCEPTION 'La prueba esta fuera de horario'; END IF;
  IF p_account IS NULL OR p_account !~ '^[0-9]{10,13}$' THEN RAISE EXCEPTION 'El numero de cuenta debe tener entre 10 y 13 digitos'; END IF;
  client:=encode(digest(coalesce(nullif(trim(split_part(coalesce(nullif(current_setting('request.headers',true),'')::jsonb->>'x-forwarded-for',''),',',1)),''),'unknown'),'sha256'),'hex');
  INSERT INTO public.instructor_test_attempts(test_id,client_hash) VALUES(p_id,client) ON CONFLICT DO NOTHING;
  SELECT * INTO attempts FROM public.instructor_test_attempts WHERE test_id=p_id AND client_hash=client FOR UPDATE;
  IF attempts.recovery_window_start<=now()-interval '15 minutes' THEN
    UPDATE public.instructor_test_attempts SET recovery_failures=0,recovery_window_start=now() WHERE test_id=p_id AND client_hash=client;
    attempts.recovery_failures:=0;
  END IF;
  IF attempts.recovery_failures>=5 THEN RETURN jsonb_build_object('ok',false,'status','locked'); END IF;
  IF EXISTS(SELECT 1 FROM public.instructor_test_submissions WHERE test_id=p_id AND account_number=p_account) THEN
    RETURN jsonb_build_object('ok',false,'status','submitted');
  END IF;
  SELECT * INTO t FROM public.instructor_tests WHERE id=p_id;
  SELECT * INTO p FROM public.instructor_test_progress WHERE test_id=p_id AND account_number=p_account FOR UPDATE;
  IF NOT FOUND THEN
    UPDATE public.instructor_test_attempts SET recovery_failures=recovery_failures+1 WHERE test_id=p_id AND client_hash=client;
    RETURN jsonb_build_object('ok',false,'status','not_found');
  END IF;
  IF p.submission_id IS NOT NULL THEN RETURN jsonb_build_object('ok',false,'status','submitted'); END IF;
  IF p.test_revision<>coalesce(t.attempt_revision,t.published_revision) THEN
    RETURN jsonb_build_object('ok',false,'status','version_changed');
  END IF;
  IF a.result IS NOT NULL OR (a.progress_id IS NOT NULL AND a.progress_id<>p.id) THEN RAISE EXCEPTION 'Este acceso ya pertenece a otro intento'; END IF;
  IF p.active_token_hash<>a.token_hash THEN
    UPDATE public.instructor_test_progress SET active_token_hash=a.token_hash,revision=revision+1,updated_at=now() WHERE id=p.id RETURNING * INTO p;
  END IF;
  UPDATE public.instructor_test_access SET participant_name=p.participant_name,account_number=p.account_number,progress_id=p.id WHERE token_hash=a.token_hash;
  UPDATE public.instructor_test_attempts SET recovery_failures=0 WHERE test_id=p_id AND client_hash=client;
  RETURN jsonb_build_object(
    'ok',true,'participant_name',p.participant_name,'account_number',p.account_number,
    'answers',p.answers,'current_question_id',p.current_question_id,'progress_revision',p.revision
  ) || CASE WHEN p.assigned_content IS NOT NULL THEN jsonb_build_object('questions', public.atlas_instructor_public_questions(p.assigned_content - 'sections')) ELSE '{}'::jsonb END;
END;
$$;

CREATE OR REPLACE FUNCTION public.atlas_save_instructor_progress(p_id uuid,p_token text,p_revision integer,p_answers jsonb,p_current_question_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE a public.instructor_test_access%ROWTYPE; p public.instructor_test_progress%ROWTYPE; t public.instructor_tests%ROWTYPE;
  source_content jsonb; q jsonb; v jsonb; k text; item jsonb;
BEGIN
  a:=public.atlas_require_instructor_access(p_id,p_token);
  SELECT * INTO p FROM public.instructor_test_progress WHERE id=a.progress_id FOR UPDATE;
  IF NOT FOUND OR p.active_token_hash<>a.token_hash THEN RAISE EXCEPTION 'El intento se abrio en otra sesion. Recuperalo de nuevo para continuar'; END IF;
  IF p.submission_id IS NOT NULL OR a.result IS NOT NULL THEN RAISE EXCEPTION 'La prueba ya fue entregada'; END IF;
  IF p_revision IS DISTINCT FROM p.revision THEN
    IF p_revision+1=p.revision AND p_answers=p.answers AND p_current_question_id IS NOT DISTINCT FROM p.current_question_id THEN
      RETURN jsonb_build_object('ok',true,'progress_revision',p.revision);
    END IF;
    RAISE EXCEPTION 'El progreso cambio en otra sesion. Recupera de nuevo la prueba' USING ERRCODE='40001';
  END IF;
  SELECT * INTO t FROM public.instructor_tests WHERE id=p_id;
  source_content := coalesce(p.assigned_content, t.published);
  IF jsonb_typeof(p_answers) IS DISTINCT FROM 'object' OR octet_length(p_answers::text)>500000 THEN RAISE EXCEPTION 'Progreso invalido'; END IF;
  IF p_current_question_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(public.atlas_instructor_public_questions(source_content)) x WHERE coalesce(x->'group'->>'id','legacy-'||(x->>'id'))=p_current_question_id) THEN RAISE EXCEPTION 'Pregunta de progreso invalida'; END IF;
  FOR k,v IN SELECT key,value FROM jsonb_each(p_answers) LOOP
    SELECT value INTO q FROM jsonb_array_elements(source_content->'questions') WHERE value->>'id'=k;
    IF NOT FOUND THEN RAISE EXCEPTION 'Respuesta ajena a esta prueba'; END IF;
    IF coalesce(q->>'type','single_choice') = 'single_choice' AND q ? 'correct_option_ids' THEN
      PERFORM public.atlas_validate_instructor_multiple_choice(q, v, false);
    ELSIF coalesce(q->>'type','single_choice') IN ('single_choice','short_answer') OR v='""'::jsonb THEN
      IF jsonb_typeof(v)<>'string' OR length(v#>>'{}')>1000 THEN RAISE EXCEPTION 'Respuesta de progreso invalida'; END IF;
      IF coalesce(q->>'type','single_choice')='single_choice' AND v<>'""'::jsonb AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(q->'options') x WHERE x->>'id'=v#>>'{}') THEN RAISE EXCEPTION 'Opcion de progreso invalida'; END IF;
    ELSIF q->>'type'='image_point' THEN PERFORM public.atlas_validate_instructor_point_answer(v);
    ELSE
      IF jsonb_typeof(v)<>'object' THEN RAISE EXCEPTION 'Respuesta de progreso invalida'; END IF;
      FOR k,item IN SELECT key,value FROM jsonb_each(v) LOOP
        IF jsonb_typeof(item)<>'string' OR length(item#>>'{}')>1000 THEN RAISE EXCEPTION 'Respuesta de progreso invalida'; END IF;
        IF q->>'type'='completion' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(q->'blanks') x WHERE x->>'id'=k) THEN RAISE EXCEPTION 'Hueco ajeno a esta prueba'; END IF;
        IF q->>'type'='matching' AND (NOT EXISTS(SELECT 1 FROM jsonb_array_elements(q->'pairs') x WHERE x->>'id'=k) OR (item<>'""'::jsonb AND NOT EXISTS(SELECT 1 FROM public.atlas_instructor_matching_choices(q) c WHERE c.id=item#>>'{}'))) THEN RAISE EXCEPTION 'Pareja ajena a esta prueba'; END IF;
      END LOOP;
    END IF;
  END LOOP;
  UPDATE public.instructor_test_progress SET answers=p_answers,current_question_id=p_current_question_id,revision=revision+1,updated_at=now() WHERE id=p.id RETURNING * INTO p;
  RETURN jsonb_build_object('ok',true,'progress_revision',p.revision);
END;
$$;

CREATE OR REPLACE FUNCTION public.atlas_grade_instructor_test(p_id uuid, p_token text, p_answers jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_progress public.instructor_test_progress%ROWTYPE; v public.instructor_tests%ROWTYPE; a public.instructor_test_access%ROWTYPE;
  v_source jsonb; q jsonb; b jsonb; v_answer jsonb; v_type text; v_ok boolean;
  v_total integer; v_pending integer := 0; v_submission uuid; v_correct numeric := 0; v_snapshot jsonb; v_auto_results jsonb := '{}'::jsonb; v_result jsonb; v_text text;
BEGIN
  SELECT * INTO v FROM public.instructor_tests WHERE id = p_id AND estado = 'publicada' FOR SHARE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'status','unavailable'); END IF;
  SELECT * INTO a FROM public.instructor_test_access WHERE token_hash = encode(digest(coalesce(p_token,''),'sha256'),'hex')
    AND test_id = p_id AND access_version = v.access_version AND expires_at > now() FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'status','expired'); END IF;
  IF a.result IS NOT NULL THEN RETURN a.result; END IF;
  IF public.atlas_instructor_schedule_status(v.published)<>'open' THEN RAISE EXCEPTION 'El horario de la prueba finalizo. El progreso guardado se conserva'; END IF;
  SELECT * INTO v_progress FROM public.instructor_test_progress WHERE id=a.progress_id FOR UPDATE;
  IF NOT FOUND OR v_progress.active_token_hash<>a.token_hash OR a.account_number IS NULL THEN RAISE EXCEPTION 'Registra tu cuenta o recupera de nuevo la prueba antes de entregar'; END IF;
  IF v_progress.submission_id IS NOT NULL THEN RAISE EXCEPTION 'Esta cuenta ya entrego esta version de la prueba'; END IF;
  IF a.participant_name IS NULL THEN RAISE EXCEPTION 'Escribe tu nombre antes de responder'; END IF;
  IF jsonb_typeof(p_answers) IS DISTINCT FROM 'object' OR octet_length(p_answers::text) > 500000 THEN RAISE EXCEPTION 'Respuestas inválidas'; END IF;

  v_source := coalesce(v_progress.assigned_content, v.published);
  -- El resultado del participante elimina review_guides del snapshot privado.
  v_snapshot := jsonb_build_object(
    'nombre', v_source->>'nombre',
    'scoring_version', 2,
    'review_guides', (
      SELECT coalesce(jsonb_object_agg(item->>'id', CASE item->>'type'
        WHEN 'short_answer' THEN item->'accepted_answers'
        WHEN 'completion' THEN jsonb_build_object(
          'reference', coalesce(item->>'review_reference', ''),
          'blanks', (SELECT jsonb_object_agg(blank->>'id', blank->'accepted_answers')
                     FROM jsonb_array_elements(item->'blanks') blank)
        )
      END), '{}'::jsonb)
      FROM jsonb_array_elements(v_source->'questions') item
      WHERE item->>'type' IN ('short_answer', 'completion')
    ),
    'questions', public.atlas_instructor_public_questions(v_source)
  );
  SELECT count(DISTINCT coalesce(snapshot_item->'group'->>'id', snapshot_item->>'id')) INTO v_total FROM jsonb_array_elements(v_snapshot->'questions') snapshot_item WHERE coalesce(snapshot_item->>'type','single_choice') <> 'image_versus';
  FOR q IN SELECT value FROM jsonb_array_elements(v_source->'questions') LOOP
    v_type := coalesce(q->>'type','single_choice'); v_answer := p_answers->(q->>'id'); v_ok := true;
    IF v_type = 'image_versus' THEN
      CONTINUE;
    ELSIF v_type = 'single_choice' AND q ? 'correct_option_ids' THEN
      PERFORM public.atlas_validate_instructor_multiple_choice(q, v_answer, true);
      v_ok := v_answer @> (q->'correct_option_ids') AND v_answer <@ (q->'correct_option_ids');
    ELSIF v_type IN ('single_choice','short_answer') THEN
      IF jsonb_typeof(v_answer) IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Responde todas las preguntas'; END IF;
      v_text := v_answer#>>'{}';
      IF v_type = 'single_choice' THEN
        IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(q->'options') o WHERE o->>'id' = v_text) THEN RAISE EXCEPTION 'Responde todas las preguntas'; END IF;
        v_ok := v_text = q->>'correct_option_id';
      ELSE
        IF length(v_text) > 1000 OR public.atlas_normalize_instructor_answer(v_text) = '' THEN RAISE EXCEPTION 'Escribe una respuesta breve'; END IF;
        v_pending := v_pending + 1; v_ok := false;
      END IF;
    ELSIF v_type = 'completion' THEN
      IF jsonb_typeof(v_answer) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Responde todos los huecos'; END IF;
      FOR b IN SELECT value FROM jsonb_array_elements(q->'blanks') LOOP
        IF jsonb_typeof(v_answer->(b->>'id')) IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Responde todos los huecos'; END IF;
        v_text := v_answer->>(b->>'id');
        IF length(v_text) > 1000 OR public.atlas_normalize_instructor_answer(v_text) = '' THEN RAISE EXCEPTION 'Responde todos los huecos'; END IF;
        v_ok := v_ok AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(b->'accepted_answers') s
                                WHERE public.atlas_normalize_instructor_answer(s) = public.atlas_normalize_instructor_answer(v_text));
      END LOOP;
    ELSIF v_type = 'matching' THEN
      IF jsonb_typeof(v_answer) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Relaciona todos los términos'; END IF;
      FOR b IN SELECT value FROM jsonb_array_elements(q->'pairs') LOOP
        IF jsonb_typeof(v_answer->(b->>'id')) IS DISTINCT FROM 'string'
           OR NOT EXISTS (SELECT 1 FROM public.atlas_instructor_matching_choices(q) c WHERE c.id = v_answer->>(b->>'id')) THEN
          RAISE EXCEPTION 'Relaciona todos los términos con opciones válidas';
        END IF;
        v_ok := v_ok AND v_answer->>(b->>'id') = b->>'option_id';
      END LOOP;
    ELSIF v_type = 'image_point' THEN
      PERFORM public.atlas_validate_instructor_point_answer(v_answer);
      v_pending := v_pending + 1; v_ok := false;
    ELSE RAISE EXCEPTION 'Formato de pregunta no compatible';
    END IF;
    IF v_type NOT IN ('short_answer','image_point') THEN v_auto_results := v_auto_results || jsonb_build_object(q->>'id',v_ok); END IF;
    IF v_ok THEN v_correct := v_correct + public.atlas_instructor_inciso_weight(v_snapshot,q->>'id'); END IF;
  END LOOP;
  INSERT INTO public.instructor_test_submissions(test_id, token_hash, test_revision, snapshot, answers, auto_correct, total, manual_count, participant_name, auto_results, account_number)
    VALUES(v.id, a.token_hash, v.published_revision,
      v_snapshot,
      p_answers, v_correct, v_total, v_pending, a.participant_name, v_auto_results, a.account_number) RETURNING id INTO v_submission;
  v_result := jsonb_build_object('ok',true,'correct',round(v_correct,8),'total',v_total,'percentage',CASE WHEN v_pending > 0 THEN null ELSE round(100.0*v_correct/v_total,2) END,'pending_review',v_pending,'submission_id',v_submission,'sections',public.atlas_instructor_section_results(v_snapshot,v_auto_results,'{}'::jsonb));
  UPDATE public.instructor_test_progress SET submission_id=v_submission,answers='{}'::jsonb,updated_at=now(),revision=revision+1 WHERE id=v_progress.id;
  UPDATE public.instructor_test_access SET result = v_result WHERE token_hash = a.token_hash;
  RETURN v_result;
END;
$$;

COMMIT;
