// Motor PostgreSQL WASM aislado. Nunca carga .env ni contacta Supabase.
// Uso: node database/tests/verify_instructor_tests.mjs <ruta-a-pglite/dist/index.js>
// pgcrypto se simula aquí; estas pruebas no verifican el algoritmo criptográfico.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

if (!process.argv[2]) throw new Error('Indica la ruta del módulo PGlite instalado fuera del proyecto.');
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const withResume = process.argv.includes('--resume');
const withSections = process.argv.includes('--sections') || withResume;
const withWeightedReview = process.argv.includes('--review') || withSections;
const withAllSubmissions = process.argv.includes('--submissions') || withWeightedReview;
const withPoints = process.argv.includes('--points') || withAllSubmissions;
const withAnnotations = process.argv.includes('--annotations') || withPoints;
const withImages = process.argv.includes('--images') || withAnnotations;
const withGroups = process.argv.includes('--groups') || withImages;
const withFormats = process.argv.includes('--formats') || withGroups;
let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks++; };
const call = async (name, args = []) => {
  const placeholders = args.map((_, i) => `$${i + 1}`).join(',');
  return (await db.query(`select public.${name}(${placeholders}) as value`, args)).rows[0].value;
};
const reject = async (operation, pattern) => {
  await assert.rejects(operation, pattern); checks++;
};
const actor = id => db.query("select set_config('atlas.test_actor', $1, false)", [id === null ? '' : String(id)]);
const ip = value => db.query("select set_config('request.headers', $1, false)", [JSON.stringify({ 'x-forwarded-for': value })]);

try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE SCHEMA extensions;
    CREATE FUNCTION extensions.digest(text,text) RETURNS bytea LANGUAGE sql IMMUTABLE AS $$ SELECT decode(md5($1),'hex') $$;
    CREATE FUNCTION extensions.gen_salt(text,integer) RETURNS text LANGUAGE sql AS $$ SELECT 'mock$' || md5(random()::text) $$;
    CREATE FUNCTION extensions.crypt(text,text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
      SELECT 'mock$' || split_part($2,'$',2) || '$' || md5($1 || split_part($2,'$',2)) $$;
    CREATE FUNCTION extensions.gen_random_bytes(integer) RETURNS bytea LANGUAGE sql AS $$ SELECT decode(md5(random()::text),'hex') $$;
    CREATE TABLE public.usuarios(id integer PRIMARY KEY, rol text, activo boolean);
    INSERT INTO public.usuarios VALUES (4,'Administrador',true),(9,'Administrador',true),(10,'Administrador',true);
    CREATE TABLE public.atlas_microscopy_chief(singleton boolean PRIMARY KEY DEFAULT true, owner_id integer, user_id integer);
    INSERT INTO public.atlas_microscopy_chief VALUES (true,4,9);
    CREATE FUNCTION public.atlas_session_user_id() RETURNS integer LANGUAGE sql STABLE AS $$
      SELECT nullif(current_setting('atlas.test_actor',true),'')::integer $$;
  `);
  await db.exec(await readFile(new URL('../setup_instructor_tests.sql', import.meta.url), 'utf8'));
  if (withFormats) {
    await db.exec(await readFile(new URL('../extend_instructor_question_formats.sql', import.meta.url), 'utf8'));
  }
  if (withGroups) await db.exec(await readFile(new URL('../group_instructor_questions.sql', import.meta.url), 'utf8'));
  if (withImages) await db.exec(await readFile(new URL('../add_instructor_short_answer_images.sql', import.meta.url), 'utf8'));
  if (withAnnotations) await db.exec(await readFile(new URL('../add_instructor_image_annotations.sql', import.meta.url), 'utf8'));
  check(true, 'Instalación SQL completa y funciones compiladas');
  await actor(10);
  await reject(() => call('atlas_list_instructor_tests'), /No autorizado/);
  await actor(null);
  await reject(() => call('atlas_save_instructor_test', [null, null, {}, null]), /No autorizado/);
  await actor(4);
  const content = { nombre: 'Evaluación docente', instrucciones: 'Selecciona una opción.', questions: [
    { id: 'q1', titulo: '¿Qué tejido es?', options: [{ id: 'a', texto: 'Epitelio' }, { id: 'b', texto: 'Músculo' }], correct_option_id: 'a' },
  ] };
  let saved = await call('atlas_save_instructor_test', [null, null, content, '001234']);
  check(saved.estado === 'borrador' && saved.has_code, 'Crear borrador con código que conserva ceros iniciales');
  check(!JSON.stringify(saved).includes('001234') && !('code_hash' in saved), 'No devolver código ni hash al editor');
  const id = saved.id;
  check((await call('atlas_public_instructor_tests')).length === 0, 'No listar borradores');
  check((await call('atlas_unlock_instructor_test', [id, '001234'])).status === 'unavailable', 'No ejecutar un borrador por URL');
  await reject(() => call('atlas_save_instructor_test', [id, saved.revision, content, '12345']), /6 dígitos/);
  await reject(() => call('atlas_save_instructor_test', [id, 99, content, null]), /Otra persona/);
  const noCode = await call('atlas_save_instructor_test', [null, null, content, null]);
  await reject(() => call('atlas_publish_instructor_test', [noCode.id, noCode.revision, true]), /Configura el código/);
  const empty = await call('atlas_save_instructor_test', [null, null, { ...content, questions: [] }, '123456']);
  await reject(() => call('atlas_publish_instructor_test', [empty.id, empty.revision, true]), /entre 1 y 100/);
  const invalid = { ...content, questions: [{ ...content.questions[0], correct_option_id: 'unknown' }] };
  const incomplete = await call('atlas_save_instructor_test', [null, null, invalid, '123456']);
  await reject(() => call('atlas_publish_instructor_test', [incomplete.id, incomplete.revision, true]), /respuesta correcta/);

  saved = await call('atlas_publish_instructor_test', [id, saved.revision, true]);
  const catalog = await call('atlas_public_instructor_tests');
  check(catalog.length === 1 && catalog[0].question_count === 1, 'Solo publicar la prueba válida');
  check(!JSON.stringify(catalog).includes('questions') && !JSON.stringify(catalog).includes('001234'), 'Catálogo sin preguntas ni códigos');
  await actor(null); await ip('192.0.2.1');
  check((await call('atlas_unlock_instructor_test', [id, '999999'])).status === 'invalid_code', 'Código incorrecto bloquea preguntas');
  let access = await call('atlas_unlock_instructor_test', [id, '001234']);
  check(access.ok && access.test.questions.length === 1 && access.token, 'Código correcto permite comenzar');
  check(!JSON.stringify(access.test).includes('correct_option_id'), 'No exponer respuesta correcta');
  check((await call('atlas_grade_instructor_test', [id, 'fake', { q1: 'a' }])).status === 'expired', 'No calificar sin token válido');
  await reject(() => call('atlas_grade_instructor_test', [id, access.token, {}]), /Responde todas/);
  const result = await call('atlas_grade_instructor_test', [id, access.token, { q1: 'b' }]);
  check(result.ok && result.percentage === 0 && result.total === 1, 'Calificación del servidor');
  const retryResult = await call('atlas_grade_instructor_test', [id, access.token, { q1: 'a' }]);
  check(retryResult.percentage === 0, 'Entrega idempotente: no cambiar respuestas para consultar la clave');

  await actor(9);
  saved = await call('atlas_save_instructor_test', [id, saved.revision, { ...content, nombre: 'Borrador nuevo' }, null]);
  check((await call('atlas_public_instructor_tests'))[0].nombre === content.nombre, 'Guardar borrador conserva snapshot publicado');
  check((await call('atlas_unlock_instructor_test', [id, '001234'])).ok, 'Campo de código vacío conserva el código');
  saved = await call('atlas_save_instructor_test', [id, saved.revision, content, '654321']);
  check((await call('atlas_grade_instructor_test', [id, access.token, { q1: 'a' }])).status === 'expired', 'Rotar código invalida accesos anteriores');
  check((await call('atlas_unlock_instructor_test', [id, '001234'])).status === 'invalid_code', 'Código anterior rechazado');
  access = await call('atlas_unlock_instructor_test', [id, '654321']);
  check(access.ok, 'Código nuevo aceptado');
  saved = await call('atlas_publish_instructor_test', [id, saved.revision, true]);
  check((await call('atlas_grade_instructor_test', [id, access.token, { q1: 'a' }])).status === 'expired', 'Republicar invalida accesos a otra versión');

  await ip('192.0.2.2');
  for (let i = 0; i < 5; i++) check((await call('atlas_unlock_instructor_test', [id, '000000'])).status === 'invalid_code', 'Intento inválido contabilizado');
  check((await call('atlas_unlock_instructor_test', [id, '654321'])).status === 'locked', 'Bloqueo tras cinco fallos incluso con código correcto');
  await db.exec("UPDATE public.instructor_test_attempts SET window_start = now()-interval '16 minutes' WHERE client_hash IS NOT NULL");
  check((await call('atlas_unlock_instructor_test', [id, '654321'])).ok, 'Vuelve a admitir acceso tras el plazo de bloqueo');
  await ip('192.0.2.3');
  access = await call('atlas_unlock_instructor_test', [id, '654321']);
  await db.exec("UPDATE public.instructor_test_access SET expires_at = now()-interval '1 minute' WHERE test_id IS NOT NULL");
  check((await call('atlas_grade_instructor_test', [id, access.token, { q1: 'a' }])).status === 'expired', 'Token caducado rechazado');

  saved = await call('atlas_publish_instructor_test', [id, saved.revision, false]);
  check((await call('atlas_public_instructor_tests')).length === 0, 'Retirar publicación oculta la prueba');
  check((await call('atlas_unlock_instructor_test', [id, '654321'])).status === 'unavailable', 'Retirar publicación bloquea acceso directo');
  await db.exec('UPDATE public.atlas_microscopy_chief SET user_id=10 WHERE singleton=true');
  await reject(() => call('atlas_get_instructor_test', [id]), /No autorizado/);
  await actor(10);
  check((await call('atlas_get_instructor_test', [id])).id === id, 'Nuevo Jefe hereda administración');
  await actor(4);
  check((await call('atlas_get_instructor_test', [id])).id === id, 'Cuenta inicial mantiene administración');
  if (withFormats) {
    const mixed = { nombre: 'Formatos mixtos', instrucciones: '', questions: [
      content.questions[0],
      { id: 'brief', type: 'short_answer', titulo: 'Tejido', accepted_answers: ['Músculo esquelético', 'Músculo estriado'] },
      { id: 'complete', type: 'completion', titulo: 'El {{1}} contiene {{2}}.', blanks: [
        { id: 'gap1', accepted_answers: ['epitelio'] }, { id: 'gap2', accepted_answers: ['células', 'células epiteliales'] },
      ] },
      { id: 'match', type: 'matching', titulo: 'Relaciona', pairs: [
        { id: 'term1', option_id: 'choice8', term: 'Epitelio', definition: 'Revestimiento' },
        { id: 'term2', option_id: 'choice3', term: 'Músculo', definition: 'Contracción' },
      ] },
    ] };
    let multi = await call('atlas_save_instructor_test', [null, null, mixed, '112233']);
    multi = await call('atlas_publish_instructor_test', [multi.id, multi.revision, true]);
    const unlock = () => call('atlas_unlock_instructor_test', [multi.id, '112233']);
    let session = await unlock();
    check(session.ok && session.test.questions.length === 4, 'Desbloquear prueba con cuatro formatos');
    check(session.test.questions[0].type === 'single_choice', 'Preguntas históricas sin type se proyectan como selección');
    check(!JSON.stringify(session.test).includes('accepted_answers') && !JSON.stringify(session.test).includes('correct_option_id')
      && !JSON.stringify(session.test).includes('pairs') && !JSON.stringify(session.test).includes('option_id'), 'No filtrar ninguna clave privada de los cuatro formatos');
    check(session.test.questions[3].terms.length === 2 && session.test.questions[3].choices.length === 2, 'Pareados públicos tienen listas independientes');
    const full = { q1: 'a', brief: '  MUSCULO\t esquele\u0301tico  ', complete: { gap1: 'EPITELIO', gap2: 'celulas' }, match: { term1: 'choice8', term2: 'choice3' } };
    check((await call('atlas_grade_instructor_test', [multi.id, session.token, full])).percentage === 100, 'Calificar formatos mixtos con tildes, Unicode y espacios normalizados');
    session = await unlock();
    check((await call('atlas_grade_instructor_test', [multi.id, session.token, { ...full, brief: 'Músculo estriado' }])).percentage === 100, 'Aceptar variantes explícitas de respuesta breve');
    session = await unlock();
    check((await call('atlas_grade_instructor_test', [multi.id, session.token, { ...full, brief: 'otro tejido' }])).percentage === 75, 'No aceptar texto incorrecto por aproximación');
    session = await unlock();
    check((await call('atlas_grade_instructor_test', [multi.id, session.token, { ...full, complete: { gap1: 'epitelio', gap2: 'fibras' } }])).percentage === 75, 'Completación exige todos los huecos correctos');
    session = await unlock();
    check((await call('atlas_grade_instructor_test', [multi.id, session.token, { ...full, match: { term1: 'choice3', term2: 'choice8' } }])).percentage === 75, 'Pareados intercambiados cuentan como pregunta incorrecta');
    session = await unlock();
    await reject(() => call('atlas_grade_instructor_test', [multi.id, session.token, { ...full, complete: { gap1: 'epitelio' } }]), /todos los huecos/);
    await reject(() => call('atlas_grade_instructor_test', [multi.id, session.token, { ...full, brief: '   ' }]), /respuesta breve/);
    await reject(() => call('atlas_grade_instructor_test', [multi.id, session.token, { ...full, match: { term1: 'choice8', term2: 'choice8' } }]), /opción distinta/);
    await reject(() => call('atlas_grade_instructor_test', [multi.id, session.token, { ...full, match: { term1: 'fake1', term2: 'fake2' } }]), /opciones válidas/);
    check((await call('atlas_grade_instructor_test', [multi.id, session.token, full])).percentage === 100, 'Respuestas inválidas no consumen la entrega válida');
    check(await call('atlas_normalize_instructor_answer', ['AÑO']) !== await call('atlas_normalize_instructor_answer', ['ano']), 'La normalización conserva la distinción de ñ');
    await reject(() => call('atlas_save_instructor_test', [null, null, { ...mixed, questions: [{ ...mixed.questions[1], type: 'invented' }] }, null]), /Pregunta inválida/);
    for (const titulo of ['Falta {{1}}.', 'Repite {{1}} y {{1}}.', 'Desconocido {{1}} y {{3}}.']) {
      const bad = await call('atlas_save_instructor_test', [null, null, { ...mixed, questions: [{ ...mixed.questions[2], titulo }] }, '112233']);
      await reject(() => call('atlas_publish_instructor_test', [bad.id, bad.revision, true]), /marcador de hueco/);
    }
    const ambiguous = await call('atlas_save_instructor_test', [null, null, { ...mixed, questions: [{ ...mixed.questions[3], pairs: [
      mixed.questions[3].pairs[0], { ...mixed.questions[3].pairs[1], definition: 'revestimiento' },
    ] }] }, '112233']);
    await reject(() => call('atlas_publish_instructor_test', [ambiguous.id, ambiguous.revision, true]), /ambiguas/);
    const missing = await call('atlas_save_instructor_test', [null, null, { ...mixed, questions: [{ ...mixed.questions[1], accepted_answers: [''] }] }, '112233']);
    await reject(() => call('atlas_publish_instructor_test', [missing.id, missing.revision, true]), /respuesta aceptada/);
    await reject(() => call('atlas_save_instructor_test', [null, null, { ...mixed, questions: [{ ...mixed.questions[3], pairs: [
      { ...mixed.questions[3].pairs[0], option_id: 'term1' }, mixed.questions[3].pairs[1],
    ] }] }, null]), /independientes/);
    if (withGroups) {
      const grouped = { ...mixed, groups: [
        { id: 'group1', titulo: 'Tejidos básicos', item_ids: ['q1', 'brief'] },
        { id: 'group2', titulo: 'Relaciona y completa', item_ids: ['complete', 'match'] },
      ] };
      let groupedTest = await call('atlas_save_instructor_test', [null, null, grouped, '221144']);
      check((await call('atlas_get_instructor_test', [groupedTest.id])).content.groups[0].item_ids.join(',') === 'q1,brief', 'Conservar asociación y orden de incisos al guardar');
      groupedTest = await call('atlas_publish_instructor_test', [groupedTest.id, groupedTest.revision, true]);
      const groupedAccess = await call('atlas_unlock_instructor_test', [groupedTest.id, '221144']);
      check(groupedAccess.test.questions[0].group.id === 'group1' && groupedAccess.test.questions[1].group.titulo === 'Tejidos básicos', 'Proyectar enunciado general y grupo sin claves privadas');
      check(groupedAccess.test.questions[2].group.position === 2 && groupedAccess.test.questions[3].group.id === 'group2', 'Conservar numeración de preguntas y sus incisos');
      const summary = (await call('atlas_public_instructor_tests')).find(t => t.id === groupedTest.id);
      check(summary.question_count === 2 && summary.inciso_count === 4, 'Catálogo cuenta preguntas e incisos por separado');
      check((await call('atlas_grade_instructor_test', [groupedTest.id, groupedAccess.token, full])).percentage === 100, 'La agrupación no cambia IDs de respuesta ni calificación');
      groupedTest = await call('atlas_save_instructor_test', [groupedTest.id, groupedTest.revision,
        { ...grouped, groups: [{ ...grouped.groups[0], titulo: 'Borrador nuevo' }, grouped.groups[1]] }, null]);
      const oldAccess = await call('atlas_unlock_instructor_test', [groupedTest.id, '221144']);
      check(oldAccess.test.questions[0].group.titulo === 'Tejidos básicos', 'Modificar agrupación en borrador no altera la publicada');
      const emptyGroup = await call('atlas_save_instructor_test', [null, null, { ...grouped, groups: [...grouped.groups, { id: 'empty', titulo: '', item_ids: [] }] }, '221144']);
      await reject(() => call('atlas_publish_instructor_test', [emptyGroup.id, emptyGroup.revision, true]), /al menos un inciso/);
      await reject(() => call('atlas_save_instructor_test', [null, null, { ...grouped, groups: [{ ...grouped.groups[0], item_ids: ['q1'] }, grouped.groups[1]] }, null]), /única pregunta/);
      await reject(() => call('atlas_save_instructor_test', [null, null, { ...grouped, groups: [grouped.groups[0], { ...grouped.groups[1], item_ids: ['q1', 'match'] }] }, null]), /única pregunta/);
      await reject(() => call('atlas_save_instructor_test', [null, null, { ...grouped, groups: [{ ...grouped.groups[0], item_ids: ['q1', 'nonexistent'] }, grouped.groups[1]] }, null]), /no existe/);
      await reject(() => call('atlas_save_instructor_test', [null, null, { ...grouped, groups: [grouped.groups[0], { ...grouped.groups[1], id: 'group1' }] }, null]), /repetidos/);
      await reject(() => call('atlas_save_instructor_test', [null, null, { ...grouped, groups: null }, null]), /Listado de preguntas inválido/);
      const blankDraft = await call('atlas_save_instructor_test', [null, null, { nombre: 'Nueva', instrucciones: '', questions: [], groups: [{ id: 'initial', titulo: '', item_ids: [] }] }, null]);
      check(blankDraft.content.questions.length === 0 && blankDraft.content.groups.length === 1, 'Borrador puede empezar con una pregunta vacía');
      check((await call('atlas_instructor_public_questions', [content]))[0].group === undefined, 'Contenido histórico sin agrupación conserva su representación');
      const ordered = { ...grouped, groups: [grouped.groups[1], { ...grouped.groups[0], item_ids: ['brief', 'q1'] }] };
      check((await call('atlas_instructor_public_questions', [ordered])).map(q => q.id).join(',') === 'complete,match,brief,q1', 'Orden público sigue preguntas e incisos incluso si la lista plana tiene otro orden');
    }
  }
  if (withImages) {
    await actor(4); await ip('192.0.2.40');
    const url = 'https://pub-49025e2296604f9db7de3c958d1fdd8e.r2.dev/site/plate.webp';
    const imageContent = { nombre: 'Imagen', instrucciones: '', questions: [{ id: 'brief-image', type: 'short_answer', titulo: 'Identifica', accepted_answers: ['epitelio'], image: { url, source: 'catalog', plate_id: 12 } }] };
    let imageTest = await call('atlas_save_instructor_test', [null, null, imageContent, '443322']);
    check(imageTest.content.questions[0].image.plate_id === 12, 'Guardar referencia del catalogo');
    imageTest = await call('atlas_publish_instructor_test', [imageTest.id, imageTest.revision, true]);
    const imageAccess = await call('atlas_unlock_instructor_test', [imageTest.id, '443322']);
    check(JSON.stringify(imageAccess.test.questions[0].image) === JSON.stringify({ url }), 'Exponer solo URL sin metadatos de placa');
    check((await call('atlas_grade_instructor_test', [imageTest.id, imageAccess.token, { 'brief-image': 'epitelio' }])).percentage === 100, 'Imagen no cambia calificacion');
    const withoutImage = structuredClone(imageContent); delete withoutImage.questions[0].image;
    imageTest = await call('atlas_save_instructor_test', [imageTest.id, imageTest.revision, withoutImage, null]);
    check((await call('atlas_unlock_instructor_test', [imageTest.id, '443322'])).test.questions[0].image.url === url, 'Quitar imagen del borrador conserva snapshot publicado');
    imageTest = await call('atlas_publish_instructor_test', [imageTest.id, imageTest.revision, true]);
    check(!('image' in (await call('atlas_unlock_instructor_test', [imageTest.id, '443322'])).test.questions[0]), 'Republicar elimina referencia publica');
    for (const invalidUrl of ['javascript:alert(1)', 'blob:preview', 'data:image/png;base64,x', 'https://example.test/test.webp', url.replace('https:', 'http:'), url.replace('.r2.dev', '.r2.dev.evil.test')]) {
      await reject(() => call('atlas_save_instructor_test', [null, null, { ...imageContent, questions: [{ ...imageContent.questions[0], image: { url: invalidUrl, source: 'upload' } }] }, null]), /referencia/);
    }
    await reject(() => call('atlas_save_instructor_test', [null, null, { ...content, questions: [{ ...content.questions[0], image: { url, source: 'upload' } }] }, null]), /referencia/);
    await reject(() => call('atlas_save_instructor_test', [null, null, { ...imageContent, questions: [{ ...imageContent.questions[0], image: { url, source: 'catalog' } }] }, null]), /placa/);
    const uploaded = await call('atlas_save_instructor_test', [null, null, { ...imageContent, questions: [{ ...imageContent.questions[0], image: { url, source: 'upload' } }] }, null]);
    check(uploaded.content.questions[0].image.source === 'upload', 'Aceptar imagen subida sin placa asociada');
  }
  if (withAnnotations) {
    await actor(4); await ip('192.0.2.50');
    await db.exec(`CREATE TABLE public.placas(id integer PRIMARY KEY, senalados_meta jsonb);
      INSERT INTO public.placas VALUES(123,'[{"label":"Original del catalogo","x":0.9,"y":0.8}]');`);
    const catalogBefore = (await db.query('select senalados_meta from public.placas where id = 123')).rows[0].senalados_meta;
    const url = 'https://pub-49025e2296604f9db7de3c958d1fdd8e.r2.dev/site/annotated.webp';
    const annotation = { label: 'SECRET_INTERNAL_ANSWER', x: .4, y: .5, startX: .1, startY: .2,
      regionPoints: [.1,.1,.9,.1,.8,.9], regionHoles: [[.3,.3,.4,.3,.35,.4]], regionColor: '#22c55e', regionOpacity: .28,
      regionStrokeWidth: 4, regionDashLength: 16, regionDashGap: 12, regionSmooth: true, privateExtra: 'never expose' };
    const annotated = { nombre: 'Solo del inciso', instrucciones: '', questions: [{ id: 'annotated', type: 'short_answer', titulo: 'Identifica', accepted_answers: ['epitelio'], image: { url, source: 'catalog', plate_id: 123, annotations: [annotation] } }] };
    let t = await call('atlas_save_instructor_test', [null, null, annotated, '554433']);
    check((await call('atlas_get_instructor_test', [t.id])).content.questions[0].image.annotations[0].label === annotation.label, 'Conservar etiquetas privadas en el borrador');
    t = await call('atlas_publish_instructor_test', [t.id, t.revision, true]);
    const access = await call('atlas_unlock_instructor_test', [t.id, '554433']);
    const publicMarker = access.test.questions[0].image.annotations[0];
    check(publicMarker.regionPoints.length === 6 && publicMarker.regionHoles.length === 1 && publicMarker.regionStrokeWidth === 4, 'Proyectar geometria y estilo de marcas propias');
    check(!JSON.stringify(access.test).includes(annotation.label) && !JSON.stringify(access.test).includes('privateExtra') && !JSON.stringify(access.test).includes('plate_id'), 'No revelar etiquetas privadas ni metadatos del catalogo');
    check((await call('atlas_grade_instructor_test', [t.id, access.token, { annotated: 'epitelio' }])).percentage === 100, 'Marcas no cambian calificacion');
    const modified = structuredClone(annotated); modified.questions[0].image.annotations = [];
    t = await call('atlas_save_instructor_test', [t.id, t.revision, modified, null]);
    check((await call('atlas_unlock_instructor_test', [t.id, '554433'])).test.questions[0].image.annotations.length === 1, 'Editar marcas en borrador conserva snapshot');
    t = await call('atlas_publish_instructor_test', [t.id, t.revision, true]);
    check((await call('atlas_unlock_instructor_test', [t.id, '554433'])).test.questions[0].image.annotations.length === 0, 'Republicar retira marcas del snapshot nuevo');
    check(JSON.stringify((await db.query('select senalados_meta from public.placas where id = 123')).rows[0].senalados_meta) === JSON.stringify(catalogBefore), 'Guardar, publicar y quitar marcas de la prueba conserva la placa original');
    const invalidAnnotations = [null, {}, [{ ...annotation, x: -1 }], [{ ...annotation, y: '0.5' }], [{ ...annotation, startX: null }], [{ ...annotation, regionPoints: [.1,.2] }], [{ ...annotation, regionHoles: [[.1,5,.1,.3,.2,.3]] }], [{ ...annotation, regionColor: 'url(evil)' }], [{ ...annotation, regionSmooth: 'yes' }], Array.from({length:101},()=>annotation)];
    for (const annotations of invalidAnnotations) {
      const invalid = structuredClone(annotated); invalid.questions[0].image.annotations = annotations;
      await reject(() => call('atlas_save_instructor_test', [null, null, invalid, null]), /senalado|aguja/);
    }
    const countBefore = (await db.query('select count(*)::integer n from public.instructor_tests')).rows[0].n;
    await db.exec(await readFile(new URL('../rollback_instructor_image_annotations.sql', import.meta.url), 'utf8'));
    check((await db.query('select count(*)::integer n from public.instructor_tests')).rows[0].n === countBefore, 'Recuperacion conserva las pruebas');
    check(!('annotations' in (await call('atlas_instructor_public_questions', [annotated]))[0].image), 'Recuperacion vuelve a proyeccion sin marcas');
    await db.exec(await readFile(new URL('../add_instructor_image_annotations.sql', import.meta.url), 'utf8'));
  }
  if (withPoints) {
    await db.exec(await readFile(new URL('../add_instructor_point_questions.sql', import.meta.url), 'utf8'));
    await actor(4); await ip('192.0.2.70');
    const pointContent = { nombre: 'Senala estructuras', instrucciones: '', questions: [content.questions[0], { id: 'point', type: 'image_point', titulo: 'Senala el nucleo', image: { url: 'https://pub-49025e2296604f9db7de3c958d1fdd8e.r2.dev/test/point.webp', source: 'catalog', plate_id: 123 } }] };
    let t = await call('atlas_save_instructor_test', [null, null, pointContent, '556677']);
    check(t.content.questions[1].type === 'image_point', 'Guardar el quinto formato');
    t = await call('atlas_publish_instructor_test', [t.id, t.revision, true]);
    const access = await call('atlas_unlock_instructor_test', [t.id, '556677']);
    check(access.test.questions[1].image.url.endsWith('point.webp') && !JSON.stringify(access.test).includes('plate_id'), 'Mostrar imagen sin metadatos ni marcas del catalogo');
    for (const point of [null, '', {}, { x:.5,y:'0.5' }, {x:-.1,y:.5}, {x:.5,y:1.1}, {x:.5,y:.5,regionPoints:[0,0,1,1,0,1]}]) {
      await reject(() => call('atlas_grade_instructor_test', [t.id, access.token, { q1:'a', point }]), /senalado|posicion/);
    }
    await actor(null);
    const delivered = await call('atlas_grade_instructor_test', [t.id, access.token, { q1:'a', point:{x:.4,y:.6} }]);
    check(delivered.pending_review === 1 && delivered.percentage === null && delivered.correct === 1 && delivered.submission_id, 'Entrega pendiente sin nota falsa');
    const repeated = await call('atlas_grade_instructor_test', [t.id, access.token, { q1:'b', point:{x:.8,y:.9} }]);
    check(repeated.submission_id === delivered.submission_id, 'Entrega manual idempotente');
    check((await db.query('select count(*)::integer n from public.instructor_test_submissions')).rows[0].n === 1, 'No duplicar entrega al reintentar');
    await reject(() => call('atlas_list_instructor_submissions', [t.id, 0]), /No autorizado/);
    await reject(() => call('atlas_get_instructor_submission', [delivered.submission_id]), /No autorizado/);
    await reject(() => call('atlas_review_instructor_submission', [delivered.submission_id, 1, { point:true }]), /No autorizado/);
    await actor(9);
    await reject(() => call('atlas_get_instructor_submission', [delivered.submission_id]), /No autorizado/);
    await actor(4);
    const detail = await call('atlas_get_instructor_submission', [delivered.submission_id]);
    check(detail.answers.point.x === .4 && detail.answers.q1 === 'a' && !JSON.stringify(detail).includes('token_hash'), 'Conservar respuesta original y no revelar token');
    check((await call('atlas_list_instructor_submissions', [t.id,0]))[0].pending_review === 1, 'Listar pendientes');
    await reject(() => call('atlas_list_instructor_submissions', [t.id,-1]), /Pagina/);
    await reject(() => call('atlas_review_instructor_submission', [detail.id,99,{point:true}]), /Otra persona/);
    await reject(() => call('atlas_review_instructor_submission', [detail.id,1,{point:'true'}]), /Solo se revisan/);
    await reject(() => call('atlas_review_instructor_submission', [detail.id,1,{q1:true}]), /Solo se revisan/);
    const reviewed = await call('atlas_review_instructor_submission', [detail.id,1,{point:true}]);
    check(reviewed.revision === 2 && reviewed.reviews.point === true, 'Revision protegida por version');
    const final = await call('atlas_grade_instructor_test', [t.id,access.token,{}]);
    check(final.percentage === 100 && final.pending_review === 0, 'Completar nota con revision manual sin aceptar nuevas respuestas');
    await call('atlas_review_instructor_submission', [detail.id,2,{point:false}]);
    check((await call('atlas_grade_instructor_test', [t.id,access.token,{}])).percentage === 50, 'Corregir una revision mantiene puntaje automatico');
    await call('atlas_review_instructor_submission', [detail.id,3,{}]);
    check((await call('atlas_list_instructor_submissions', [t.id,0]))[0].pending_review === 1, 'Retirar decision vuelve a pendiente');
    t = await call('atlas_save_instructor_test', [t.id,t.revision,{ ...pointContent, questions:[pointContent.questions[0], {...pointContent.questions[1],titulo:'Otra version'}] },null]);
    t = await call('atlas_publish_instructor_test', [t.id,t.revision,true]);
    check((await call('atlas_get_instructor_submission', [detail.id])).snapshot.questions[1].titulo === 'Senala el nucleo', 'Revision usa snapshot historico despues de republicar');
    await db.exec('delete from public.instructor_test_access');
    check((await call('atlas_get_instructor_submission', [detail.id])).answers.point.y === .6, 'Entrega conserva respuestas despues de caducar accesos');
    const missing = await call('atlas_save_instructor_test', [null,null,{...pointContent,questions:[{id:'missing',type:'image_point',titulo:'Senala'}]},'556677']);
    await reject(() => call('atlas_publish_instructor_test', [missing.id,missing.revision,true]), /necesita una imagen/);
    await reject(() => call('atlas_save_instructor_test', [null,null,{...pointContent,questions:[{...pointContent.questions[1],image:{...pointContent.questions[1].image,annotations:[]}}]},null]), /sin marcas previas/);
  }
  if (withAllSubmissions) {
    await db.exec(await readFile(new URL('../store_all_instructor_submissions.sql', import.meta.url), 'utf8'));
    await actor(4); await ip('192.0.2.90');
    let t = await call('atlas_save_instructor_test', [null,null,content,'887766']);
    t = await call('atlas_publish_instructor_test', [t.id,t.revision,true]);
    const access = await call('atlas_unlock_instructor_test', [t.id,'887766']);
    await actor(null);
    await reject(() => call('atlas_grade_instructor_test', [t.id,access.token,{q1:'a'}]), /nombre/);
    check((await call('atlas_start_instructor_test', [t.id,'wrong','Nombre'])).status === 'expired', 'No registrar nombre sin token valido');
    for (const invalidName of ['', '  ', 'a'.repeat(151), 'Nombre'+String.fromCharCode(1)]) {
      await reject(() => call('atlas_start_instructor_test', [t.id,access.token,invalidName]), /nombre/);
    }
    const started = await call('atlas_start_instructor_test', [t.id,access.token,'  Ana   Prueba  ']);
    check(started.participant_name === 'Ana Prueba', 'Registrar nombre normalizado tras verificar codigo');
    check((await call('atlas_start_instructor_test', [t.id,access.token,'Ana Prueba'])).ok, 'Reintento de nombre idempotente');
    await reject(() => call('atlas_start_instructor_test', [t.id,access.token,'Otra Persona']), /ya fue registrado/);
    const delivered = await call('atlas_grade_instructor_test', [t.id,access.token,{q1:'a'}]);
    check(delivered.percentage === 100 && delivered.pending_review === 0 && delivered.submission_id, 'Persistir pruebas automaticas completas con nota final');
    await reject(() => call('atlas_start_instructor_test', [t.id,access.token,'Ana Prueba']), /ya fue entregada/);
    await actor(4);
    const detail = await call('atlas_get_instructor_submission', [delivered.submission_id]);
    check(detail.participant_name === 'Ana Prueba' && detail.answers.q1 === 'a', 'Detalle incluye nombre y todas las respuestas automaticas');
    const row = (await call('atlas_list_instructor_submissions', [t.id,0]))[0];
    check(row.participant_name === 'Ana Prueba' && row.correct === 1 && row.percentage === 100 && row.pending_review === 0, 'Listado muestra nombre y puntaje revisado de prueba automatica');
    const count = (await db.query('select count(*)::integer n from public.instructor_test_submissions')).rows[0].n;
    await call('atlas_grade_instructor_test', [t.id,access.token,{q1:'b'}]);
    check((await db.query('select count(*)::integer n from public.instructor_test_submissions')).rows[0].n === count, 'Reintento no duplica entrega ni cambia nombre o respuestas');
    const pointContent = { ...content,questions:[content.questions[0],{id:'point',type:'image_point',titulo:'Senala',image:{url:'https://pub-49025e2296604f9db7de3c958d1fdd8e.r2.dev/site/point.webp',source:'upload'}}] };
    let mixed = await call('atlas_save_instructor_test', [null,null,pointContent,'887766']);
    mixed = await call('atlas_publish_instructor_test', [mixed.id,mixed.revision,true]);
    const mixedAccess = await call('atlas_unlock_instructor_test', [mixed.id,'887766']);
    await call('atlas_start_instructor_test', [mixed.id,mixedAccess.token,'Luis Prueba']);
    const mixedResult = await call('atlas_grade_instructor_test', [mixed.id,mixedAccess.token,{q1:'a',point:{x:.3,y:.4}}]);
    const pending = (await call('atlas_list_instructor_submissions', [mixed.id,0]))[0];
    check(pending.participant_name === 'Luis Prueba' && pending.correct === 1 && pending.percentage === null && pending.pending_review === 1, 'Lista mixta muestra puntaje provisional y pendiente');
    await call('atlas_review_instructor_submission', [mixedResult.submission_id,1,{point:false}]);
    const reviewed = (await call('atlas_list_instructor_submissions', [mixed.id,0]))[0];
    check(reviewed.correct === 1 && reviewed.percentage === 50 && reviewed.pending_review === 0, 'Revision cambia listado a nota final sin alterar nombre');
    const originals = (await db.query('select id,draft from public.instructor_tests order by id')).rows;
    await db.exec(await readFile(new URL('../clean_instructor_submissions.sql', import.meta.url), 'utf8'));
    check((await db.query('select count(*)::integer n from public.instructor_test_submissions')).rows[0].n === count+1, 'Plantilla de limpieza revierte por defecto');
    await db.exec((await readFile(new URL('../clean_instructor_submissions.sql', import.meta.url), 'utf8')).replace('\nROLLBACK;', '\nCOMMIT;'));
    check((await db.query('select count(*)::integer n from public.instructor_test_submissions')).rows[0].n === 0, 'Limpieza acotada vacia todas las entregas');
    check((await db.query('select count(*)::integer n from public.instructor_test_access')).rows[0].n === 0, 'Limpieza elimina accesos y resultados temporales');
    check(JSON.stringify((await db.query('select id,draft from public.instructor_tests order by id')).rows) === JSON.stringify(originals), 'Limpieza conserva preguntas e imagenes de las pruebas');
    check((await call('atlas_grade_instructor_test', [mixed.id,mixedAccess.token,{}])).status === 'expired', 'Un token anterior no recrea entregas limpiadas');
    await actor(null);
    await reject(() => call('atlas_list_instructor_submissions', [t.id,0]), /No autorizado/);
    if (!withWeightedReview) await db.exec(await readFile(new URL('../rollback_store_all_instructor_submissions.sql', import.meta.url), 'utf8'));
    await db.exec('SET ROLE anon');
    if (!withWeightedReview) await reject(() => call('atlas_start_instructor_test', [t.id,access.token,'Ana']), /permission denied/);
    await db.exec('RESET ROLE');
  }
  if (withWeightedReview) {
    await db.exec(await readFile(new URL('../review_instructor_open_answers.sql', import.meta.url), 'utf8'));
    await actor(4); await ip('192.0.2.110');
    const weighted = { nombre:'Revision ponderada',instrucciones:'',questions:[content.questions[0],
      {id:'brief',type:'short_answer',titulo:'Describe',accepted_answers:['']},
      {id:'point',type:'image_point',titulo:'Senala',image:{url:'https://pub-49025e2296604f9db7de3c958d1fdd8e.r2.dev/site/point.webp',source:'upload'}},
      {...content.questions[0],id:'choice2'}],groups:[{id:'g1',titulo:'',item_ids:['q1','brief','point']},{id:'g2',titulo:'',item_ids:['choice2']}] };
    let t = await call('atlas_save_instructor_test', [null,null,weighted,'223355']);
    t = await call('atlas_publish_instructor_test', [t.id,t.revision,true]);
    const access = await call('atlas_unlock_instructor_test', [t.id,'223355']);
    check(!JSON.stringify(access.test).includes('review_guides') && !JSON.stringify(access.test).includes('accepted_answers'), 'No exponer guias ni respuestas privadas al participante');
    await call('atlas_start_instructor_test', [t.id,access.token,'Persona Revision']);
    const answers = {q1:'a',brief:'Texto totalmente libre',point:{x:.3,y:.4},choice2:'a'};
    const delivered = await call('atlas_grade_instructor_test', [t.id,access.token,answers]);
    check(delivered.total === 2 && delivered.pending_review === 2 && delivered.percentage === null && Math.abs(delivered.correct-4/3)<1e-7, 'Cada pregunta vale 1, respuesta escrita y senalado pendientes');
    const detail = await call('atlas_get_instructor_submission', [delivered.submission_id]);
    check(detail.snapshot.scoring_version === 2 && detail.answers.brief === answers.brief, 'Conservar texto original y version de puntuacion');
    await reject(() => call('atlas_review_instructor_submission',[detail.id,1,{q1:true}]), /Solo se revisan/);
    let reviewed = await call('atlas_review_instructor_submission',[detail.id,1,{brief:true}]);
    let row = (await call('atlas_list_instructor_submissions',[t.id,0]))[0];
    check(row.pending_review === 1 && row.percentage === null && Math.abs(row.correct-5/3)<1e-7, 'Revisar texto suma tercio y conserva pendiente la posicion');
    reviewed = await call('atlas_review_instructor_submission',[detail.id,reviewed.revision,{brief:true,point:false}]);
    row = (await call('atlas_list_instructor_submissions',[t.id,0]))[0];
    check(row.pending_review === 0 && row.percentage === 83.33 && Math.abs(row.correct-5/3)<1e-7, 'Nota final pondera grupos de diferente numero de incisos');
    reviewed = await call('atlas_review_instructor_submission',[detail.id,reviewed.revision,{brief:true,point:true}]);
    const final = await call('atlas_grade_instructor_test',[t.id,access.token,{}]);
    check(final.percentage === 100 && final.correct === 2, 'Todos los incisos correctos suman exactamente dos preguntas');
    await actor(null);
    await reject(() => call('atlas_review_instructor_submission',[detail.id,reviewed.revision,{brief:false,point:false}]),/No autorizado/);
    await actor(4);
    const automatic = {nombre:'Solo cerradas',instrucciones:'',questions:[content.questions[0],{...content.questions[0],id:'q2'}],groups:[{id:'g',titulo:'',item_ids:['q1','q2']}]};
    let a = await call('atlas_save_instructor_test',[null,null,automatic,'223355']);a=await call('atlas_publish_instructor_test',[a.id,a.revision,true]);
    const aa = await call('atlas_unlock_instructor_test',[a.id,'223355']);await call('atlas_start_instructor_test',[a.id,aa.token,'Persona Automatica']);
    const ar = await call('atlas_grade_instructor_test',[a.id,aa.token,{q1:'a',q2:'b'}]);
    check(ar.correct === .5 && ar.total === 1 && ar.percentage === 50 && ar.pending_review === 0, 'Dos incisos cerrados aportan medio punto cada uno automaticamente');
    const oldSnapshot = {nombre:'Anterior',questions:[{id:'brief',type:'short_answer',titulo:'Antes'},{id:'point',type:'image_point',titulo:'Antes',image:{url:'x'}}]};
    check(await call('atlas_instructor_requires_review',[oldSnapshot,oldSnapshot.questions[0]]) !== true, 'Texto de entregas historicas sigue con su calificacion previa');
    check(Number(await call('atlas_instructor_inciso_weight',[oldSnapshot,'point'])) === 1, 'Peso historico sigue siendo 1');
    await db.exec(await readFile(new URL('../rollback_review_instructor_open_answers.sql', import.meta.url), 'utf8'));
    check((await call('atlas_list_instructor_submissions',[t.id,0]))[0].percentage === 100, 'Recuperacion conserva puntuacion de entregas nuevas');
    await db.exec(await readFile(new URL('../review_instructor_open_answers.sql', import.meta.url), 'utf8').then(s=>s.replaceAll('CREATE FUNCTION','CREATE OR REPLACE FUNCTION')));
  }
  if (withSections) {
    await db.exec("CREATE TABLE public.temas(id integer PRIMARY KEY,nombre text); INSERT INTO public.temas VALUES(1,'Tejido epitelial'),(2,'Tejido muscular');");
    await db.exec(await readFile(new URL('../section_instructor_tests_by_topic.sql', import.meta.url), 'utf8'));
    await actor(4); await ip('192.0.2.130');
    const sectionContent = {nombre:'Secciones',instrucciones:'',sections:[{id:'s1',tema_id:1,nombre:'Nombre no confiable'},{id:'s2',tema_id:2,nombre:'Otro'}],
      questions:[...Array.from({length:10},(_,i)=>({...content.questions[0],id:'choice'+i})),
        {id:'brief',type:'short_answer',titulo:'Describe',accepted_answers:['']},
        {id:'point',type:'image_point',titulo:'Senala',image:{url:'https://pub-49025e2296604f9db7de3c958d1fdd8e.r2.dev/site/photo.webp',source:'upload'}}],
      groups:[...Array.from({length:10},(_,i)=>({id:'g'+i,titulo:'',item_ids:['choice'+i],section_id:'s1'})),
        {id:'g10',titulo:'',item_ids:['brief','point'],section_id:'s2'}]};
    let t = await call('atlas_save_instructor_test',[null,null,sectionContent,'334466']);
    t = await call('atlas_publish_instructor_test',[t.id,t.revision,true]);
    const a = await call('atlas_unlock_instructor_test',[t.id,'334466']);
    check(a.test.questions[0].group.section.nombre === 'Tejido epitelial' && a.test.questions[10].group.section.tema_id === 2,'Secciones usan nombres oficiales de temas del Atlas');
    await call('atlas_start_instructor_test',[t.id,a.token,'Persona Secciones']);
    const answers = Object.fromEntries(Array.from({length:10},(_,i)=>['choice'+i,i<5?'a':'b']));answers.brief='Libre';answers.point={x:.4,y:.5};
    const r = await call('atlas_grade_instructor_test',[t.id,a.token,answers]);
    check(r.sections[0].correct === 5 && r.sections[0].total === 10 && r.sections[0].percentage === 50,'Cinco preguntas malas entre diez resultan 5 de 10 en el tema');
    check(r.sections[1].pending_review === 2 && r.sections[1].total === 1 && r.sections[1].percentage === null,'Seccion manual indica puntaje provisional');
    await call('atlas_review_instructor_submission',[r.submission_id,1,{brief:true,point:false}]);
    const final = await call('atlas_grade_instructor_test',[t.id,a.token,{}]);
    check(final.sections[1].correct === .5 && final.sections[1].total === 1 && final.sections[1].percentage === 50,'Seccion divide un punto entre los dos incisos');
    check(final.correct === 5.5 && final.total === 11 && final.percentage === 50,'Suma de secciones coincide con nota general');
    const stored = await call('atlas_get_instructor_submission',[r.submission_id]);
    check(stored.auto_results.choice0 === true && stored.auto_results.choice9 === false,'Conservar decisiones automaticas para desglose historico');
    await db.exec("UPDATE public.temas SET nombre='Nombre cambiado' WHERE id=1");
    const original = await call('atlas_get_instructor_submission',[r.submission_id]);
    check(original.snapshot.questions[0].group.section.nombre === 'Tejido epitelial','Entrega conserva tema original aunque cambie el catalogo');
    for (const sections of [[{id:'s1',tema_id:999,nombre:'No'}],[{id:'s1',tema_id:1,subtema_id:2}], [{id:'s1',tema_id:1},{id:'s2',tema_id:1}],null]) {
      await reject(()=>call('atlas_save_instructor_test',[null,null,{...sectionContent,sections},null]), /tema|Secciones/);
    }
    const missing = await call('atlas_save_instructor_test',[null,null,{...sectionContent,groups:sectionContent.groups.map((g,i)=>i?g:{...g,section_id:undefined})},'334466']);
    await reject(()=>call('atlas_publish_instructor_test',[missing.id,missing.revision,true]), /Asigna todas/);
    const empty = await call('atlas_save_instructor_test',[null,null,{...sectionContent,sections:[...sectionContent.sections,{id:'empty',tema_id:3,nombre:'Vacio'}]},null]).catch(e=>null);
    check(empty === null,'Rechazar seccion con tema inexistente incluso en borrador');
    await db.exec("INSERT INTO public.temas VALUES(3,'Tema vacio')");
    const emptySection = await call('atlas_save_instructor_test',[null,null,{...sectionContent,sections:[...sectionContent.sections,{id:'empty',tema_id:3,nombre:'Tema vacio'}]},'334466']);
    await reject(()=>call('atlas_publish_instructor_test',[emptySection.id,emptySection.revision,true]),/Cada seccion/);
    const badGroup = {...sectionContent,groups:sectionContent.groups.map((g,i)=>i?g:{...g,section_id:'nonexistent'})};
    await reject(()=>call('atlas_save_instructor_test',[null,null,badGroup,null]), /Seccion/);
    check((await call('atlas_instructor_section_results',[{nombre:'Anterior',questions:[]},{},{}])).length===0,'Pruebas sin secciones no inventan desglose');
    await actor(null);await reject(()=>call('atlas_get_instructor_submission',[r.submission_id]), /No autorizado/);
    await actor(4);
    await db.exec(await readFile(new URL('../rollback_section_instructor_tests_by_topic.sql', import.meta.url), 'utf8'));
    check((await call('atlas_get_instructor_submission',[r.submission_id])).answers.brief==='Libre','Recuperacion conserva las respuestas y secciones de entregas');
  }
  if (withResume) {
    await db.exec((await readFile(new URL('../section_instructor_tests_by_topic.sql', import.meta.url), 'utf8')).replaceAll('CREATE FUNCTION','CREATE OR REPLACE FUNCTION').replace("ALTER TABLE public.instructor_test_submissions ADD COLUMN auto_results jsonb NOT NULL DEFAULT '{}'::jsonb;",''));
    await db.exec(await readFile(new URL('../resume_instructor_tests_by_account.sql', import.meta.url), 'utf8'));
    await actor(4);await ip('192.0.2.150');
    const testContent={nombre:'Recuperacion',instrucciones:'',questions:[content.questions[0],{id:'brief',type:'short_answer',titulo:'Describe',accepted_answers:['']},{id:'point',type:'image_point',titulo:'Senala',image:{url:'https://pub-49025e2296604f9db7de3c958d1fdd8e.r2.dev/site/x.webp',source:'upload'}}],groups:[{id:'g1',titulo:'',item_ids:['q1']},{id:'g2',titulo:'',item_ids:['brief','point']}]};
    let t=await call('atlas_save_instructor_test',[null,null,testContent,'998877']);t=await call('atlas_publish_instructor_test',[t.id,t.revision,true]);
    const a=await call('atlas_unlock_instructor_test',[t.id,'998877']);await actor(null);
    for(const account of ['123456789','12345678901234','123456789x',''])await reject(()=>call('atlas_begin_instructor_test',[t.id,a.token,'Persona',account]),/cuenta/);
    await reject(()=>call('atlas_begin_instructor_test',[t.id,'wrong','Persona','001234567890']),/acceso/);
    const begin=await call('atlas_begin_instructor_test',[t.id,a.token,'Persona Original','001234567890']);
    check(begin.account_number==='001234567890'&&begin.progress_revision===1,'Preservar ceros iniciales y registrar cuenta como texto');
    check((await call('atlas_begin_instructor_test',[t.id,a.token,'Persona Original','001234567890'])).progress_revision===1,'Inicio idempotente si se pierde respuesta de red');
    let save=await call('atlas_save_instructor_progress',[t.id,a.token,1,{q1:'a',brief:'Texto incompleto',point:{x:.4,y:.6}},'g2']);
    check(save.progress_revision===2,'Guardar respuestas y pregunta actual antes de entregar');
    check((await call('atlas_save_instructor_progress',[t.id,a.token,1,{q1:'a',brief:'Texto incompleto',point:{x:.4,y:.6}},'g2'])).progress_revision===2,'Reintento identico de guardado no duplica ni pierde progreso');
    await reject(()=>call('atlas_save_instructor_progress',[t.id,a.token,1,{q1:'b'},'g1']),/progreso cambio/);
    await reject(()=>call('atlas_save_instructor_progress',[t.id,a.token,2,{alien:'a'},'g2']),/ajena/);
    await reject(()=>call('atlas_save_instructor_progress',[t.id,a.token,2,{q1:'fake'},'g2']),/Opcion/);
    await reject(()=>call('atlas_save_instructor_progress',[t.id,a.token,2,{point:{x:1.1,y:.3}},'g2']),/posicion/);
    await reject(()=>call('atlas_save_instructor_progress',[t.id,a.token,2,{},'nonexistent']),/Pregunta/);
    const b=await call('atlas_unlock_instructor_test',[t.id,'998877']);
    await reject(()=>call('atlas_begin_instructor_test',[t.id,b.token,'Persona Nueva','001234567890']),/Continuar prueba/);
    const resumed=await call('atlas_resume_instructor_test',[t.id,b.token,'001234567890']);
    check(resumed.participant_name==='Persona Original'&&resumed.answers.brief==='Texto incompleto'&&resumed.answers.point.x===.4&&resumed.current_question_id==='g2','Recuperar nombre, texto, punto y pregunta sin pedir nombre');
    await reject(()=>call('atlas_save_instructor_progress',[t.id,a.token,2,{q1:'b'},'g1']),/otra sesion/);
    await reject(()=>call('atlas_grade_instructor_test',[t.id,a.token,{q1:'a',brief:'A',point:{x:.2,y:.3}}]),/recupera/);
    save=await call('atlas_save_instructor_progress',[t.id,b.token,resumed.progress_revision,{q1:'a',brief:'Texto completo',point:''},'g2']);
    check(save.progress_revision===resumed.progress_revision+1,'Permitir quitar punto y conservar prueba incompleta');
    await db.exec('DELETE FROM public.instructor_test_access');
    const c=await call('atlas_unlock_instructor_test',[t.id,'998877']);
    const afterExpiry=await call('atlas_resume_instructor_test',[t.id,c.token,'001234567890']);
    check(afterExpiry.answers.brief==='Texto completo'&&afterExpiry.answers.point==='','Recuperar despues de limpiar o caducar accesos temporales');
    const final=await call('atlas_grade_instructor_test',[t.id,c.token,{q1:'a',brief:'Texto final',point:{x:.2,y:.3}}]);
    check(final.submission_id&&final.pending_review===2,'Entregar desde sesion recuperada');
    await actor(4);const detail=await call('atlas_get_instructor_submission',[final.submission_id]);
    check(detail.account_number==='001234567890'&&detail.participant_name==='Persona Original','Cuenta y nombre llegan a entrega y revision');
    check((await call('atlas_list_instructor_submissions',[t.id,0]))[0].account_number==='001234567890','Listado identifica cuenta');
    const d=await call('atlas_unlock_instructor_test',[t.id,'998877']);
    check((await call('atlas_resume_instructor_test',[t.id,d.token,'001234567890'])).status==='submitted','No reabrir una entrega finalizada');
    await reject(()=>call('atlas_begin_instructor_test',[t.id,d.token,'Persona Original','001234567890']),/ya entrego/);
    const e=await call('atlas_unlock_instructor_test',[t.id,'998877']);
    for(let i=0;i<5;i++)check((await call('atlas_resume_instructor_test',[t.id,e.token,'9999999999'])).status==='not_found','Cuenta sin progreso no devuelve datos');
    const f=await call('atlas_unlock_instructor_test',[t.id,'998877']);
    check((await call('atlas_resume_instructor_test',[t.id,f.token,'001234567890'])).status==='locked','Limite de recuperacion se mantiene aunque se renueve token');
    await db.exec("UPDATE public.instructor_test_attempts SET recovery_window_start=now()-interval '16 minutes'");
    const longAccount=await call('atlas_begin_instructor_test',[t.id,f.token,'Otra Persona','1234567890123']);
    check(longAccount.account_number.length===13,'Aceptar cuenta de trece digitos');
    const extraContent={nombre:'Formatos automaticos recuperables',instrucciones:'',questions:[
      {id:'completion',type:'completion',titulo:'El {{1}}',blanks:[{id:'blank',accepted_answers:['epitelio']}]},
      {id:'matching',type:'matching',titulo:'Relaciona',pairs:[{id:'term1',option_id:'option1',term:'A',definition:'Uno'},{id:'term2',option_id:'option2',term:'B',definition:'Dos'}]}]};
    let extra=await call('atlas_save_instructor_test',[null,null,extraContent,'998877']);extra=await call('atlas_publish_instructor_test',[extra.id,extra.revision,true]);
    const extraAccess=await call('atlas_unlock_instructor_test',[extra.id,'998877']);
    await call('atlas_begin_instructor_test',[extra.id,extraAccess.token,'Persona Formatos','1234567890']);
    await reject(()=>call('atlas_save_instructor_progress',[extra.id,extraAccess.token,1,{matching:{alien:'option1'}},'legacy-matching']),/Pareja/);
    const extraAnswers={completion:{blank:'epitelio'},matching:{term1:'option1',term2:'option2'}};
    check((await call('atlas_save_instructor_progress',[extra.id,extraAccess.token,1,extraAnswers,'legacy-matching'])).progress_revision===2,'Guardar completacion y pareados en progreso');
    check((await call('atlas_grade_instructor_test',[extra.id,extraAccess.token,extraAnswers])).percentage===100,'Entregar formatos automaticos despues de guardar progreso');
    const before=(await db.query('select count(*)::integer n from public.instructor_test_progress')).rows[0].n;
    t=await call('atlas_save_instructor_test',[t.id,t.revision,{...testContent,nombre:'Version nueva'},null]);t=await call('atlas_publish_instructor_test',[t.id,t.revision,true]);
    const g=await call('atlas_unlock_instructor_test',[t.id,'998877']);
    check((await call('atlas_resume_instructor_test',[t.id,g.token,'1234567890123'])).status==='not_found','No mezclar progreso de versiones distintas');
    await db.exec(await readFile(new URL('../clean_instructor_submissions.sql', import.meta.url), 'utf8'));
    check((await db.query('select count(*)::integer n from public.instructor_test_progress')).rows[0].n===before,'Plantilla revierte tambien limpieza de progreso');
    await db.exec((await readFile(new URL('../clean_instructor_submissions.sql', import.meta.url), 'utf8')).replace('\nROLLBACK;','\nCOMMIT;'));
    check((await db.query('select count(*)::integer n from public.instructor_test_progress')).rows[0].n===0,'Limpieza completa vacia tambien copias empezadas');
  }
  await db.exec('SET ROLE anon');
  await reject(() => db.query('select * from public.instructor_tests'), /permission denied/);
  await reject(() => db.query('select * from public.instructor_test_access'), /permission denied/);
  await reject(() => db.query('select * from public.instructor_test_attempts'), /permission denied/);
  await reject(() => call('atlas_require_instructor_manager'), /permission denied/);
  if (withFormats) {
    await reject(() => call('atlas_normalize_instructor_answer', ['text']), /permission denied/);
    await reject(() => call('atlas_instructor_public_questions', [content]), /permission denied/);
  }
  if (withGroups) await reject(() => call('atlas_validate_instructor_groups', [content, true]), /permission denied/);
  if (withImages) await reject(() => call('atlas_validate_instructor_reference_image', [{}]), /permission denied/);
  if (withAnnotations) await reject(() => call('atlas_validate_instructor_polygon', [[]]), /permission denied/);
  if (withPoints) {
    await reject(() => db.query('select * from public.instructor_test_submissions'), /permission denied/);
    await reject(() => call('atlas_validate_instructor_point_answer', [{}]), /permission denied/);
  }
  if (withWeightedReview) {
    await reject(() => call('atlas_instructor_inciso_weight',[{},'q']), /permission denied/);
    await reject(() => call('atlas_instructor_review_points',[{},{}]), /permission denied/);
  }
  if (withSections) {
    await reject(()=>call('atlas_instructor_section_results',[{questions:[]},{},{}]), /permission denied/);
    await reject(()=>call('atlas_validate_instructor_sections',[{},true]), /permission denied/);
  }
  if(withResume){
    await reject(()=>db.query('select * from public.instructor_test_progress'),/permission denied/);
    await reject(()=>call('atlas_require_instructor_access',[null,'x']),/permission denied/);
    await reject(()=>call('atlas_start_instructor_test',[null,'x','name']),/permission denied/);
  }
  check(Array.isArray(await call('atlas_public_instructor_tests')), 'Catálogo público accesible sin sesión');
  await db.exec('RESET ROLE');
  const countBefore = (await db.query('select count(*)::integer as n from public.instructor_tests')).rows[0].n;
  await db.exec(await readFile(new URL('../disable_instructor_tests.sql', import.meta.url), 'utf8'));
  check((await db.query('select count(*)::integer as n from public.instructor_tests')).rows[0].n === countBefore, 'Deshabilitar conserva todas las pruebas');
  await db.exec('SET ROLE anon');
  await reject(() => call('atlas_public_instructor_tests'), /permission denied/);
  console.log(`PASS: ${checks} comprobaciones SQL en PostgreSQL aislado. Sin red, sin datos reales; pgcrypto simulada.`);
} catch (error) {
  console.error('FAIL:', error.message, error.where ?? '', error.internalQuery ?? '');
  process.exitCode = 1;
} finally { await db.close(); }
