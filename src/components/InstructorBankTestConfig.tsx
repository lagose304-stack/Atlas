import { useState } from 'react';
import { ArrowLeft, Check, Circle, Eye, Info, LoaderCircle, Save, ShieldCheck, Shuffle } from 'lucide-react';
import type { CatalogTema } from '../services/catalogService';
import {
  getInstructorBankTopic,
  isSixDigitCode,
  saveInstructorTest,
  type InstructorBankSummary,
  type InstructorContent,
  type InstructorEditor,
} from '../services/instructorTests';
import { instructorGroups, type InstructorQuestion, type InstructorQuestionGroup, type InstructorSection } from '../types/instructorQuestions';
import { groupTemasByParcial, sortInstructorTemas } from '../utils/instructorTopics';
import HoldToRevealCodeInput from './HoldToRevealCodeInput';
import InstructorScheduleEditor from './InstructorScheduleEditor';
import InstructorTestPreview from './InstructorTestPreview';

function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function InstructorBankTestConfig({
  editor,
  temas,
  bankSummary,
  onSaved,
  onClose,
}: {
  editor: InstructorEditor | null;
  temas: CatalogTema[];
  bankSummary: InstructorBankSummary[];
  onSaved: (saved: InstructorEditor, message: string) => void;
  onClose: () => void;
}) {
  const initialContent: InstructorContent = editor?.content
    ? { ...editor.content, mode: 'bank', questions_per_topic: editor.content.questions_per_topic ?? 1, questions: [], groups: [] }
    : { nombre: 'Prueba de instructores', instrucciones: '', mode: 'bank', questions_per_topic: 1, questions: [], groups: [] };

  const [content, setContent] = useState<InstructorContent>(initialContent);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewContent, setPreviewContent] = useState<InstructorContent | null>(null);
  const [error, setError] = useState('');

  const initialSnapshot = JSON.stringify(initialContent);
  const dirty = editor === null || JSON.stringify(content) !== initialSnapshot || code.length > 0;
  const perTopic = Math.max(1, Math.min(50, Math.floor(content.questions_per_topic ?? 1)));
  const canSave = !!content.nombre.trim() && (!code || isSixDigitCode(code)) && perTopic >= 1;

  const bankByTema = new Map(bankSummary.map(item => [item.tema_id, item]));
  const groupedTemas = groupTemasByParcial(temas);
  const activeTemas = sortInstructorTemas(temas).filter(t => (bankByTema.get(t.id)?.question_count ?? 0) > 0);
  const expectedTotalQuestions = activeTemas.reduce(
    (sum, t) => sum + Math.min(bankByTema.get(t.id)?.question_count ?? 0, perTopic),
    0,
  );

  const openRandomPreview = async () => {
    if (busy || loadingPreview || activeTemas.length === 0) return;
    setLoadingPreview(true);
    setError('');
    try {
      const topics = await Promise.all(activeTemas.map(tema => getInstructorBankTopic(tema.id)));
      const sections: InstructorSection[] = [];
      const groups: InstructorQuestionGroup[] = [];
      const questions: InstructorQuestion[] = [];

      activeTemas.forEach((tema, idx) => {
        const topicData = topics[idx];
        const topicGroups = instructorGroups(topicData.content).filter(g => g.item_ids.length > 0);
        if (!topicGroups.length) return;
        const sectionId = `sec-tema-${tema.id}`;
        sections.push({ id: sectionId, tema_id: tema.id, nombre: tema.nombre });
        const picked = shuffleArray(topicGroups).slice(0, perTopic);
        const byId = new Map(topicData.content.questions.map(q => [q.id, q]));
        picked.forEach(g => {
          groups.push({ ...g, section_id: sectionId });
          g.item_ids.forEach(id => {
            const q = byId.get(id);
            if (q) questions.push(q);
          });
        });
      });

      setPreviewContent({
        nombre: content.nombre.trim() || 'Prueba de instructores',
        instrucciones: content.instrucciones,
        sections,
        groups,
        questions,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar la vista previa aleatoria.');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || !canSave) return;
    setBusy(true);
    setError('');
    try {
      const payload: InstructorContent = {
        ...content,
        mode: 'bank',
        questions_per_topic: perTopic,
        questions: [],
        groups: [],
      };
      const saved = await saveInstructorTest(editor, payload, code);
      onSaved(
        saved,
        code
          ? 'Configuración y código guardados correctamente. La versión pública solo cambia al publicar.'
          : 'Configuración de la prueba guardada correctamente. La versión pública solo cambia al publicar.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la configuración.');
    } finally {
      setBusy(false);
    }
  };

  const handleClose = () => {
    if (busy) return;
    if (dirty && !window.confirm('Hay cambios sin guardar en la configuración. ¿Quieres descartarlos?')) return;
    onClose();
  };

  if (previewContent) {
    return <InstructorTestPreview content={previewContent} onClose={() => setPreviewContent(null)} />;
  }

  return (
    <div className="instructor-page instructor-editor-scope instructor-focus-mode">
      <main className="instructor-main">
        <form className="instructor-panel instructor-edit-surface" onSubmit={event => void handleSave(event)}>
          <fieldset disabled={busy} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
            <header className="instructor-editor-topbar">
              <button type="button" className="instructor-btn instructor-btn-ghost instructor-editor-back" onClick={handleClose} aria-label="Volver al listado">
                <ArrowLeft size={20} aria-hidden="true" /><span>Volver al listado</span>
              </button>
              <div className="instructor-editor-document">
                <h2>Configuración de prueba desde banco</h2>
                <h1>{content.nombre.trim() || 'Nueva prueba'}</h1>
              </div>
              <div className="instructor-editor-top-actions">
                <span className="instructor-save-state" data-dirty={dirty}>
                  {dirty ? <Circle size={12} aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}
                  {dirty ? 'Cambios sin guardar' : 'Configuración guardada'}
                </span>
                <button type="button" className="instructor-btn" disabled={busy || loadingPreview || expectedTotalQuestions === 0} onClick={() => void openRandomPreview()}>
                  {loadingPreview ? <LoaderCircle size={16} className="instructor-spin" aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                  {loadingPreview ? 'Sorteando…' : 'Vista previa aleatoria'}
                </button>
                <button type="submit" className="instructor-btn instructor-btn-primary" disabled={!dirty || !canSave}>
                  {busy ? <LoaderCircle size={17} className="instructor-spin" aria-hidden="true" /> : <Save size={17} aria-hidden="true" />}
                  {busy ? 'Guardando…' : 'Guardar configuración'}
                </button>
              </div>
            </header>

            <div className="instructor-editor-body">
              <div className="instructor-workflow-note">
                <Info size={16} aria-hidden="true" />
                <p>Esta prueba selecciona preguntas aleatoriamente desde el Banco de preguntas para cada participante que la inicie. Al publicar, se congela el banco actual para los intentos de esta versión.</p>
              </div>
              {!!code && !isSixDigitCode(code) && <p className="instructor-error">Completa los 6 dígitos del código antes de guardar.</p>}
              {error && <p role="alert" className="instructor-error">{error}</p>}

              <div className="instructor-settings-card">
                <label className="instructor-label">Nombre de la prueba
                  <input className="instructor-input" value={content.nombre} required maxLength={200} onChange={e => setContent({ ...content, nombre: e.target.value })} />
                </label>
                <label className="instructor-label">Instrucciones
                  <textarea className="instructor-input" aria-label="Instrucciones" value={content.instrucciones} maxLength={10000} onChange={e => setContent({ ...content, instrucciones: e.target.value })} />
                </label>
              </div>

              <section className="instructor-settings-card" aria-label="Selección aleatoria del banco">
                <div className="instructor-setting-heading">
                  <span className="instructor-setting-icon"><Shuffle size={20} aria-hidden="true" /></span>
                  <div>
                    <h4>Preguntas aleatorias por tema</h4>
                    <p>Cada participante recibirá esta cantidad de preguntas elegidas al azar por cada tema que tenga preguntas en el banco. Si un tema tiene menos, saldrán todas en orden aleatorio.</p>
                  </div>
                  <span className="instructor-badge">{expectedTotalQuestions} {expectedTotalQuestions === 1 ? 'pregunta' : 'preguntas'} por examen</span>
                </div>
                <label className="instructor-label" style={{ maxWidth: 280 }}>
                  Cantidad de preguntas por tema
                  <input
                    className="instructor-input"
                    type="number"
                    min={1}
                    max={50}
                    required
                    value={content.questions_per_topic ?? 1}
                    onChange={e => {
                      const raw = Number(e.target.value);
                      setContent({ ...content, questions_per_topic: Number.isFinite(raw) ? Math.max(1, Math.min(50, Math.floor(raw))) : 1 });
                    }}
                  />
                </label>
                {activeTemas.length === 0 ? (
                  <p className="instructor-error">Todavía no hay preguntas en el banco. Agrega preguntas en al menos un tema antes de publicar esta prueba.</p>
                ) : (
                  <div className="instructor-bank-config-summary">
                    {groupedTemas.map(group => {
                      const withQuestions = group.temas.filter(t => (bankByTema.get(t.id)?.question_count ?? 0) > 0);
                      if (!withQuestions.length) return null;
                      return (
                        <div key={group.parcial} className="instructor-bank-config-group">
                          <h5>{group.label}</h5>
                          <ul>
                            {withQuestions.map(tema => {
                              const available = bankByTema.get(tema.id)?.question_count ?? 0;
                              const selected = Math.min(available, perTopic);
                              return (
                                <li key={tema.id}>
                                  <span>{tema.nombre}</span>
                                  <small>{selected} de {available} {available === 1 ? 'pregunta disponible' : 'preguntas disponibles'}</small>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="instructor-settings-card instructor-access-card" aria-label="Acceso a la prueba">
                <div className="instructor-setting-heading">
                  <span className="instructor-setting-icon"><ShieldCheck size={20} aria-hidden="true" /></span>
                  <div><h4>Acceso con código</h4><p>Comparte el código únicamente con quienes realizarán la prueba.</p></div>
                  <span className="instructor-badge">{code ? code.length === 6 ? 'Código por guardar' : 'Completa los 6 dígitos' : editor?.has_code ? 'Configurado' : 'Sin configurar'}</span>
                </div>
                <HoldToRevealCodeInput
                  label="Código de acceso de 6 dígitos"
                  inputMode="numeric"
                  autoComplete="new-password"
                  maxLength={6}
                  pattern="[0-9]{6}"
                  value={code}
                  disabled={busy}
                  placeholder={editor?.has_code ? '••••••' : '000000'}
                  onChange={e => setCode(e.target.value.replace(/[^0-9]/g, ''))}
                />
                <p className="instructor-muted">{editor?.has_code ? 'Ya hay un código configurado. Deja el campo vacío para conservarlo.' : 'Define un código antes de publicar y compártelo con los instructores.'} El código nuevo se usará desde que guardes.</p>
              </section>

              <InstructorScheduleEditor content={content} onChange={setContent} />
            </div>
          </fieldset>
        </form>
      </main>
    </div>
  );
}
