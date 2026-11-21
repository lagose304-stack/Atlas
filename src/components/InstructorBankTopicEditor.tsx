import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, Circle, Eye, Info, LoaderCircle, Save } from 'lucide-react';
import { uploadToCloudinary } from '../services/cloudinary';
import type { CatalogTema } from '../services/catalogService';
import {
  saveInstructorBankTopic,
  type InstructorBankContent,
  type InstructorBankTopic,
  type InstructorContent,
} from '../services/instructorTests';
import { instructorGroups, instructorQuestionImageUrls, replaceInstructorQuestionImageUrl } from '../types/instructorQuestions';
import InstructorTestComposer from './InstructorTestComposer';
import InstructorTestPreview from './InstructorTestPreview';
import { PARCIAL_LABELS } from '../utils/instructorTopics';

function replaceDraftImageUrl(draft: InstructorContent, from: string, to: string): InstructorContent {
  return { ...draft, questions: draft.questions.map(question => replaceInstructorQuestionImageUrl(question, from, to)) };
}

export default function InstructorBankTopicEditor({
  tema,
  initialTopic,
  onSaved,
  onClose,
}: {
  tema: CatalogTema;
  initialTopic: InstructorBankTopic;
  onSaved: (saved: InstructorBankTopic) => void;
  onClose: () => void;
}) {
  const [revision, setRevision] = useState<number>(initialTopic.revision);
  const [content, setContent] = useState<InstructorContent>({
    nombre: tema.nombre,
    instrucciones: '',
    groups: initialTopic.content.groups ?? [],
    questions: initialTopic.content.questions ?? [],
  });
  const [busy, setBusy] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [error, setError] = useState('');
  const [autoSaveError, setAutoSaveError] = useState('');
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState('');
  const [previewing, setPreviewing] = useState(false);

  const pendingImages = useRef(new Map<string, { file: File; uploadedUrl?: string }>());
  const savedSnapshotRef = useRef(JSON.stringify({ groups: initialTopic.content.groups ?? [], questions: initialTopic.content.questions ?? [] }));
  const saveInFlightRef = useRef(false);
  const autoSavePausedRef = useRef(false);

  const serializeBank = (c: InstructorContent): InstructorBankContent => ({
    groups: instructorGroups(c),
    questions: c.questions,
  });
  const currentSnapshot = JSON.stringify(serializeBank(content));
  const dirty = currentSnapshot !== savedSnapshotRef.current;

  const clearPendingImages = () => {
    pendingImages.current.forEach((_, url) => URL.revokeObjectURL(url));
    pendingImages.current.clear();
  };
  useEffect(() => () => clearPendingImages(), []);

  useEffect(() => {
    if (busy || autoSaving || !pendingImages.current.size) return;
    const currentUrls = new Set(content.questions.flatMap(instructorQuestionImageUrls));
    for (const url of pendingImages.current.keys()) {
      if (currentUrls.has(url)) continue;
      URL.revokeObjectURL(url);
      pendingImages.current.delete(url);
    }
  }, [content.questions, busy, autoSaving]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const edit = (next: InstructorContent) => {
    autoSavePausedRef.current = false;
    setAutoSaveError('');
    setError('');
    let draft = next;
    for (const [url, pending] of pendingImages.current) {
      if (pending.uploadedUrl) draft = replaceDraftImageUrl(draft, url, pending.uploadedUrl);
    }
    setContent(draft);
  };

  const persist = async (mode: 'manual' | 'auto', overrideContent?: InstructorContent) => {
    const target = overrideContent ?? content;
    if (saveInFlightRef.current) return;
    if (mode === 'manual') { setBusy(true); setError(''); }
    else { setAutoSaving(true); }
    setAutoSaveError('');
    saveInFlightRef.current = true;
    try {
      let prepared = target;
      const pendingUrls = new Set(target.questions.flatMap(instructorQuestionImageUrls).filter(url => url.startsWith('blob:')));
      for (const url of pendingUrls) {
        const pending = pendingImages.current.get(url);
        if (!pending) throw new Error('Vuelve a seleccionar la imagen antes de guardar.');
        const secureUrl = pending.uploadedUrl ?? (await uploadToCloudinary(pending.file, {
          folder: `pruebas/instructores/banco/tema-${tema.id}`, optimizeImage: true,
        })).secure_url;
        if (typeof secureUrl !== 'string' || !secureUrl.startsWith('https://')) throw new Error('No se pudo confirmar la imagen subida.');
        pending.uploadedUrl = secureUrl;
        prepared = replaceDraftImageUrl(prepared, url, secureUrl);
        setContent(draft => replaceDraftImageUrl(draft, url, secureUrl));
      }
      const bankPayload = serializeBank(prepared);
      const saved = await saveInstructorBankTopic(tema.id, revision, bankPayload);
      savedSnapshotRef.current = JSON.stringify(bankPayload);
      setRevision(saved.revision);
      onSaved(saved);
      if (mode === 'manual') {
        clearPendingImages();
        onClose();
      } else {
        const now = new Date();
        setLastAutoSavedAt(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo guardar el banco del tema.';
      if (mode === 'manual') setError(msg);
      else { autoSavePausedRef.current = true; setAutoSaveError(`Guardado automático pausado: ${msg}`); }
    } finally {
      saveInFlightRef.current = false;
      if (mode === 'manual') setBusy(false);
      else setAutoSaving(false);
    }
  };

  const handleMilestoneAutoSave = (nextContent?: InstructorContent) => {
    const target = nextContent ?? content;
    if (busy || autoSaving || previewing || saveInFlightRef.current || autoSavePausedRef.current) return;
    if (JSON.stringify(serializeBank(target)) === savedSnapshotRef.current) return;
    void persist('auto', target);
  };

  const handleClose = () => {
    if (busy || autoSaving) return;
    if (dirty && !window.confirm('Hay cambios sin guardar en este tema. ¿Quieres descartarlos?')) return;
    clearPendingImages();
    onClose();
  };

  if (previewing) {
    const sectionId = `bank-tema-${tema.id}`;
    const previewContent: InstructorContent = {
      nombre: `Vista previa · ${tema.nombre}`,
      instrucciones: '',
      sections: [{ id: sectionId, tema_id: tema.id, nombre: tema.nombre }],
      groups: instructorGroups(content).map(g => ({ ...g, section_id: sectionId })),
      questions: content.questions,
    };
    return <InstructorTestPreview content={previewContent} onClose={() => setPreviewing(false)} />;
  }

  return (
    <div className="instructor-page instructor-editor-scope instructor-focus-mode">
      <main className="instructor-main">
        <form className="instructor-panel instructor-edit-surface" onSubmit={event => { event.preventDefault(); void persist('manual'); }}>
          <fieldset disabled={busy} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
            <header className="instructor-editor-topbar">
              <button type="button" className="instructor-btn instructor-btn-ghost instructor-editor-back" onClick={handleClose} aria-label="Volver al banco de preguntas">
                <ArrowLeft size={20} aria-hidden="true" /><span>Volver al banco</span>
              </button>
              <div className="instructor-editor-document">
                <h2>Banco de preguntas · {PARCIAL_LABELS[tema.parcial] ?? 'Tema'}</h2>
                <h1>{tema.nombre}</h1>
              </div>
              <div className="instructor-editor-top-actions">
                <span className="instructor-save-state" data-dirty={dirty || autoSaving}>
                  {autoSaving ? <LoaderCircle size={14} aria-hidden="true" className="instructor-spin" /> : dirty ? <Circle size={12} aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}
                  {autoSaving ? 'Guardando automáticamente…' : dirty ? 'Cambios sin guardar' : lastAutoSavedAt ? `Guardado automático · ${lastAutoSavedAt}` : 'Banco guardado'}
                </span>
                <button type="button" className="instructor-btn" disabled={busy || content.questions.length === 0} onClick={() => setPreviewing(true)}>
                  <Eye size={16} aria-hidden="true" />Vista previa
                </button>
                <button type="submit" className="instructor-btn instructor-btn-primary" disabled={autoSaving || !dirty}>
                  {busy ? <LoaderCircle size={17} aria-hidden="true" className="instructor-spin" /> : <Save size={17} aria-hidden="true" />}
                  {busy ? 'Guardando…' : 'Guardar banco'}
                </button>
              </div>
            </header>
            <div className="instructor-editor-body">
              <div className="instructor-workflow-note">
                <Info size={16} aria-hidden="true" />
                <p>Todas las preguntas que crees aquí quedan asignadas automáticamente al tema «{tema.nombre}». Se autoguarda al crear o eliminar preguntas e incisos.</p>
              </div>
              {autoSaveError && !error && <p role="alert" className="instructor-error">{autoSaveError}</p>}
              {error && <p role="alert" className="instructor-error">{error}</p>}
              <InstructorTestComposer
                content={content}
                code=""
                hasCode={false}
                existing={true}
                busy={busy}
                bankTopicName={tema.nombre}
                onMilestoneAction={handleMilestoneAutoSave}
                onSelectImageFile={(id, file, slot = 'image') => {
                  const preview = URL.createObjectURL(file);
                  pendingImages.current.set(preview, { file });
                  edit({
                    ...content,
                    questions: content.questions.map(q => {
                      if (q.id !== id) return q;
                      if (slot === 'image' && q.type !== 'image_versus') {
                        return { ...q, image: { url: preview, source: 'upload' as const } };
                      }
                      if (q.type === 'image_versus' && (slot === 'image_a' || slot === 'image_b')) {
                        return { ...q, [slot]: { url: preview, source: 'upload' as const } };
                      }
                      return q;
                    }),
                  });
                }}
                onChange={edit}
                onCodeChange={() => {}}
              />
            </div>
          </fieldset>
        </form>
      </main>
    </div>
  );
}
