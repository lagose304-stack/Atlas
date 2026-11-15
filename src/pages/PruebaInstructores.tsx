import { useEffect, useRef, useState } from 'react';
import { uploadToCloudinary } from '../services/cloudinary';
import { ArrowLeft, Check, Circle, ClipboardCheck, FilePenLine, FileText, Info, LoaderCircle, Plus, RefreshCw, Save, SquarePen, Upload } from 'lucide-react';
import InstructorTestComposer from '../components/InstructorTestComposer';
import InstructorSubmissionReview from '../components/InstructorSubmissionReview';
import Footer from '../components/Footer';
import Header from '../components/Header';
import { useSmartBackNavigation } from '../hooks/useSmartBackNavigation';
import {
  getInstructorTest, listInstructorTests, publishInstructorTest, saveInstructorTest,
  isSixDigitCode, type InstructorContent, type InstructorEditor, type InstructorSummary,
} from '../services/instructorTests';
import '../styles/instructorTests.css';

export default function PruebaInstructores() {
  const handleGoBack = useSmartBackNavigation('/edicion');
  const [tests, setTests] = useState<InstructorSummary[]>([]);
  const [editor, setEditor] = useState<InstructorEditor | null>(null);
  const [content, setContent] = useState<InstructorContent | null>(null);
  const [code, setCode] = useState('');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reload, setReload] = useState(0);
  const [reviewTest, setReviewTest] = useState<InstructorSummary | null>(null);
  const pendingImages = useRef(new Map<string, { file: File; preview: string }>());
  const uploadFolder = useRef<string>('');
  const clearPendingImages = () => {
    pendingImages.current.forEach(image => URL.revokeObjectURL(image.preview));
    pendingImages.current.clear();
  };
  useEffect(() => () => clearPendingImages(), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    void listInstructorTests().then(data => { if (!cancelled) setTests(data); })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'No se pudieron cargar las pruebas.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reload]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const mayLeave = () => !dirty || window.confirm('Hay cambios sin guardar. ¿Quieres descartarlos?');
  const edit = (next: InstructorContent) => { setContent(next); setDirty(true); setMessage(''); };
  const updateSummary = (saved: InstructorEditor) => {
    const summary: InstructorSummary = {
      id: saved.id, nombre: saved.content.nombre, estado: saved.estado,
      revision: saved.revision, published_revision: saved.published_revision,
    };
    setTests(previous => previous.some(t => t.id === saved.id)
      ? previous.map(t => t.id === saved.id ? summary : t)
      : [summary, ...previous]);
  };
  const reflect = (saved: InstructorEditor) => {
    clearPendingImages();
    setEditor(saved); setContent(saved.content); setCode(''); setDirty(false);
    updateSummary(saved);
  };
  const open = async (id: string) => {
    if (!mayLeave() || busy) return;
    setBusy(true); setError(''); setMessage('');
    try { reflect(await getInstructorTest(id)); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo abrir la prueba.'); }
    finally { setBusy(false); }
  };
  const save = async () => {
    if (!content || busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      let prepared = content;
      for (const question of content.questions) {
        if ((question.type !== 'short_answer' && question.type !== 'image_point') || !question.image?.url.startsWith('blob:')) continue;
        const pending = pendingImages.current.get(question.id);
        if (!pending || pending.preview !== question.image.url) throw new Error('Vuelve a seleccionar la imagen antes de guardar.');
        if (!uploadFolder.current) uploadFolder.current = crypto.randomUUID();
        const upload = await uploadToCloudinary(pending.file, { folder: `pruebas/instructores/referencias/${editor?.id ?? uploadFolder.current}`, optimizeImage: true });
        if (typeof upload.secure_url !== 'string' || !upload.secure_url.startsWith('https://')) throw new Error('No se pudo confirmar la imagen subida.');
        const next = { ...question, image: { ...question.image, url: upload.secure_url, source: 'upload' as const } };
        prepared = { ...prepared, questions: prepared.questions.map(q => q.id === question.id ? next : q) };
        setContent(prepared);
        pendingImages.current.delete(question.id); URL.revokeObjectURL(pending.preview);
      }
      updateSummary(await saveInstructorTest(editor, prepared, code));
      clearPendingImages();
      setEditor(null); setContent(null); setCode(''); setDirty(false);
      setMessage(code
        ? 'Borrador y código guardados correctamente. Las preguntas públicas solo cambian al publicar.'
        : 'Borrador guardado correctamente. La versión pública solo cambia al publicar.');
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar.'); }
    finally { setBusy(false); }
  };
  const publish = async (test: InstructorSummary, value: boolean) => {
    if (busy || dirty) return;
    if (!window.confirm(value ? `¿Publicar «${test.nombre}» en las evaluaciones públicas?` : `¿Pasar «${test.nombre}» a borrador y retirarla de las evaluaciones públicas?`)) return;
    setBusy(true); setError(''); setMessage('');
    try {
      updateSummary(await publishInstructorTest(test, value));
      setMessage(value ? 'Prueba publicada. Aparecerá al final de las evaluaciones públicas.' : 'Prueba en borrador. Ya no aparece en las evaluaciones públicas.');
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cambiar la publicación.'); }
    finally { setBusy(false); }
  };
  const create = () => {
    if (!mayLeave()) return;
    clearPendingImages(); uploadFolder.current = '';
    setEditor(null); setContent({ nombre: 'Prueba de instructores', instrucciones: '', questions: [], groups: [] });
    setCode(''); setDirty(true); setMessage(''); setError('');
  };
  const close = () => {
    if (busy || !mayLeave()) return;
    clearPendingImages();
    setContent(null); setEditor(null); setCode(''); setDirty(false); setMessage(''); setError('');
  };

  return (
    <div className={`instructor-page instructor-editor-scope${content ? ' instructor-focus-mode' : ''}`}>
      {!content && <Header onBeforeNavigate={proceed => { if (!busy && mayLeave()) proceed(); }} />}
      <main className="instructor-main">
        {!content && <>
          <button type="button" className="instructor-btn instructor-btn-ghost instructor-panel-back" disabled={busy} onClick={handleGoBack}><ArrowLeft size={16} aria-hidden="true" />Panel de edición</button>
          <section className="instructor-module-hero" aria-labelledby="prueba-instructores-title">
            <span className="instructor-module-icon"><ClipboardCheck size={26} aria-hidden="true" /></span>
            <div><p className="instructor-eyebrow">Evaluaciones · Panel de edición</p><h1 id="prueba-instructores-title">Prueba de instructores</h1>
              <p className="instructor-muted">Organiza tus evaluaciones, prepara los incisos y decide cuándo publicarlas.</p></div>
          </section>
          <div className="instructor-overview" aria-label="Resumen de pruebas">
            <div><span>Guardadas</span><strong>{loading ? '—' : tests.length}</strong></div>
            <div><span>Publicadas</span><strong>{loading ? '—' : tests.filter(test => test.estado === 'publicada').length}</strong></div>
            <div><span>Borradores</span><strong>{loading ? '—' : tests.filter(test => test.estado === 'borrador').length}</strong></div>
          </div>
        </>}
        {error && !content && <p role="alert" className="instructor-error">{error}</p>}
        {message && !content && <p role="status" className="instructor-success">{message}</p>}
        {reviewTest && <InstructorSubmissionReview key={reviewTest.id} testId={reviewTest.id} name={reviewTest.nombre} onClose={() => setReviewTest(null)} />}
        {!content && !reviewTest && <section className="instructor-panel" aria-label="Pruebas de instructores guardadas">
          <div className="instructor-row instructor-between instructor-list-heading">
            <div><h2>Pruebas guardadas</h2><p className="instructor-muted">Edita tus borradores y administra lo que ven los instructores.</p></div>
            <button type="button" className="instructor-btn instructor-btn-primary" disabled={busy || loading} onClick={create}><Plus size={18} aria-hidden="true" />Nueva prueba</button>
          </div>
          {loading ? <p role="status" className="instructor-list-loading"><LoaderCircle size={20} className="instructor-spin" aria-hidden="true" />Cargando pruebas…</p> : <>
            {tests.length === 0 && !error && <div className="instructor-list-empty"><span className="instructor-empty-icon"><FileText size={26} aria-hidden="true" /></span><h3>Todavía no hay pruebas de instructores.</h3><p>Crea una prueba y añade preguntas con los formatos que necesites.</p></div>}
            <ul className="instructor-test-list" aria-label="Listado de pruebas guardadas">
              {tests.map(test => <li className="instructor-test-item" key={test.id}>
                <span className="instructor-test-icon"><FileText size={20} aria-hidden="true" /></span>
                <div className="instructor-test-info">
                  <h3 className="instructor-summary-name">{test.nombre}</h3>
                  <span className={`instructor-badge${test.estado === 'publicada' ? ' instructor-badge-published' : ''}`}>
                    {test.estado === 'publicada' ? <Check size={13} aria-hidden="true" /> : <FilePenLine size={13} aria-hidden="true" />}
                    {test.estado === 'publicada' ? 'Publicada' : 'Borrador'}
                  </span>
                  {test.estado === 'publicada' && test.published_revision !== test.revision && <p className="instructor-muted">Cambios guardados pendientes de publicar.</p>}
                </div>
                <div className="instructor-test-actions">
                  <button type="button" className="instructor-btn" disabled={busy} aria-label={`Revisar respuestas de ${test.nombre}`} onClick={() => setReviewTest(test)}><ClipboardCheck size={16} aria-hidden="true" />Revisar respuestas</button>
                  {(test.estado === 'borrador' || test.published_revision !== test.revision) && <button type="button" className="instructor-btn instructor-btn-publish" disabled={busy}
                    aria-label={`${test.estado === 'publicada' ? 'Publicar cambios de' : 'Publicar'} ${test.nombre}`} onClick={() => void publish(test, true)}>
                    <Upload size={16} aria-hidden="true" />{test.estado === 'publicada' ? 'Publicar cambios' : 'Publicar'}
                  </button>}
                  {test.estado === 'publicada' && <button type="button" className="instructor-btn" disabled={busy}
                    aria-label={`Pasar a borrador ${test.nombre}`} onClick={() => void publish(test, false)}><FilePenLine size={16} aria-hidden="true" />Pasar a borrador</button>}
                  <button type="button" className="instructor-btn" disabled={busy} aria-label={`Editar ${test.nombre}`} onClick={() => void open(test.id)}><SquarePen size={16} aria-hidden="true" />Editar</button>
                </div>
              </li>)}
            </ul>
            <button type="button" className="instructor-btn instructor-btn-ghost" disabled={busy} onClick={() => setReload(n => n + 1)}><RefreshCw size={16} aria-hidden="true" />Actualizar lista</button>
          </>}
        </section>}
        {content && <form className="instructor-panel instructor-edit-surface" onSubmit={event => { event.preventDefault(); void save(); }}>
          <fieldset disabled={busy} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
            <header className="instructor-editor-topbar">
              <button type="button" className="instructor-btn instructor-btn-ghost instructor-editor-back" onClick={close} aria-label="Volver al listado"><ArrowLeft size={20} aria-hidden="true" /><span>Volver al listado</span></button>
              <div className="instructor-editor-document"><h2>Editor de prueba de instructores</h2><h1>{content.nombre.trim() || 'Nueva prueba'}</h1></div>
              <div className="instructor-editor-top-actions">
                <span className="instructor-save-state" data-dirty={dirty}>{dirty ? <Circle size={12} aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}{dirty ? 'Cambios sin guardar' : 'Borrador guardado'}</span>
                <button type="submit" className="instructor-btn instructor-btn-primary" disabled={!dirty || !content.nombre.trim() || (!!code && !isSixDigitCode(code))}>{busy ? <LoaderCircle size={17} aria-hidden="true" className="instructor-spin" /> : <Save size={17} aria-hidden="true" />}{busy ? 'Guardando…' : 'Guardar borrador'}</button>
              </div>
            </header>
            <div className="instructor-editor-body">
              <div className="instructor-workflow-note"><Info size={16} aria-hidden="true" /><p>{editor?.estado === 'publicada' ? 'Editando el borrador. La versión publicada se conserva hasta que publiques los cambios desde el listado.' : 'Estás preparando un borrador. Guarda tus cambios y publica la prueba desde el listado cuando esté lista.'}</p></div>
              {!!code && !isSixDigitCode(code) && <p className="instructor-error">Completa los 6 dígitos del código en «Datos de la prueba» antes de guardar.</p>}
              {error && <p role="alert" className="instructor-error">{error}</p>}
              {message && <p role="status" className="instructor-success">{message}</p>}
              <InstructorTestComposer content={content} code={code} hasCode={editor?.has_code ?? false} existing={!!editor} busy={busy}
                onSelectImageFile={(id, file) => {
                  const old = pendingImages.current.get(id); if (old) URL.revokeObjectURL(old.preview);
                  const preview = URL.createObjectURL(file); pendingImages.current.set(id, { file, preview });
                  edit({ ...content, questions: content.questions.map(q => q.id === id && (q.type === 'short_answer' || q.type === 'image_point') ? { ...q, image: { url: preview, source: 'upload' as const } } : q) });
                }}
                onChange={edit} onCodeChange={next => { setCode(next); setDirty(true); setMessage(''); }} />
            </div>
          </fieldset>
        </form>}
      </main>
      {!content && <Footer />}
    </div>
  );
}
