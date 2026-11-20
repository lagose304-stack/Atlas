import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRightLeft, Check, Info, LoaderCircle } from 'lucide-react';
import type { CatalogSubtema, CatalogTema } from '../services/catalogService';
import { getCachedSubtemas } from '../services/catalogService';
import { getCloudinaryImageUrl } from '../services/cloudinaryImages';
import { migrateLegacyPublicQuestion } from '../services/publicTestsBank';
import type { LegacyMigrationTest } from '../types/publicQuestionBank';
import { groupTemasByParcial } from '../utils/instructorTopics';
import { hasHtmlMarkup, toSafeHtml } from '../services/richText';

interface PublicLegacyMigratorProps {
  initialTest: LegacyMigrationTest;
  temas: CatalogTema[];
  onMigrated: () => Promise<void> | void;
  onClose: () => void;
}

const GENERAL_DEST = 'general';

function RichPreview({ value, fallback = '' }: { value: string; fallback?: string }) {
  const clean = (value || '').trim();
  if (!clean) return <span>{fallback}</span>;
  if (hasHtmlMarkup(clean)) {
    return <span dangerouslySetInnerHTML={{ __html: toSafeHtml(clean) }} />;
  }
  return <span>{clean}</span>;
}

export default function PublicLegacyMigrator({
  initialTest,
  temas,
  onMigrated,
  onClose,
}: PublicLegacyMigratorProps) {
  const [test, setTest] = useState<LegacyMigrationTest>(initialTest);
  const [temaByQuestion, setTemaByQuestion] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    if (initialTest.tema_id) {
      initialTest.questions.forEach(q => { map[q.id] = initialTest.tema_id!; });
    }
    return map;
  });
  const [destByQuestion, setDestByQuestion] = useState<Record<string, string>>({});
  const [subtemasCache, setSubtemasCache] = useState<Record<number, CatalogSubtema[]>>({});
  const [busyQuestionId, setBusyQuestionId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const groupedTemas = useMemo(() => groupTemasByParcial(temas), [temas]);

  const ensureSubtemasLoaded = async (temaId: number) => {
    if (!temaId || subtemasCache[temaId]) return;
    try {
      const list = await getCachedSubtemas(temaId);
      setSubtemasCache(prev => ({ ...prev, [temaId]: list }));
    } catch {
      setSubtemasCache(prev => ({ ...prev, [temaId]: [] }));
    }
  };

  useEffect(() => {
    if (initialTest.tema_id) {
      void ensureSubtemasLoaded(initialTest.tema_id);
    }
  }, [initialTest.tema_id]);

  const handleMigrate = async (questionId: string) => {
    const targetTemaId = temaByQuestion[questionId];
    if (!targetTemaId || busyQuestionId) return;
    const rawDest = destByQuestion[questionId] ?? GENERAL_DEST;
    const targetSubtemaId = rawDest === GENERAL_DEST ? null : Number(rawDest);

    setBusyQuestionId(questionId);
    setError('');
    setMessage('');
    try {
      await migrateLegacyPublicQuestion(test.id, questionId, targetTemaId, targetSubtemaId);
      setTest(prev => ({
        ...prev,
        questions: prev.questions.filter(q => q.id !== questionId),
      }));
      await onMigrated();
      const temaNombre = temas.find(t => t.id === targetTemaId)?.nombre ?? `Tema ${targetTemaId}`;
      const subNombre = targetSubtemaId
        ? subtemasCache[targetTemaId]?.find(st => st.id === targetSubtemaId)?.nombre ?? `Subtema ${targetSubtemaId}`
        : 'Preguntas generales del tema';
      setMessage(`Pregunta migrada a «${temaNombre} · ${subNombre}».`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo migrar la pregunta.');
    } finally {
      setBusyQuestionId(null);
    }
  };

  return (
    <section className="instructor-panel" aria-label="Migrar preguntas al banco público">
      <button type="button" className="instructor-btn instructor-btn-ghost" disabled={Boolean(busyQuestionId)} onClick={onClose}>
        <ArrowLeft size={16} aria-hidden="true" />
        Volver al listado
      </button>

      <div className="instructor-list-heading" style={{ marginTop: 12 }}>
        <h2>Migrar preguntas de «<RichPreview value={test.nombre} fallback="Prueba antigua" />»</h2>
        <p className="instructor-muted">
          Decide para cada pregunta si pertenece a <strong>Preguntas generales del tema</strong> o a un <strong>Subtema específico</strong>.
        </p>
      </div>

      <div className="instructor-workflow-note" style={{ marginTop: 12 }}>
        <Info size={16} aria-hidden="true" />
        <p>
          Al migrar todas las preguntas de esta prueba antigua, se archivará automáticamente y desaparecerá de esta sección.
        </p>
      </div>

      {error && <p role="alert" className="instructor-error">{error}</p>}
      {message && <p role="status" className="instructor-success">{message}</p>}

      {test.questions.length === 0 ? (
        <div className="instructor-list-empty">
          <span className="instructor-empty-icon"><Check size={24} aria-hidden="true" /></span>
          <h3>Todas las preguntas de esta prueba ya fueron migradas</h3>
          <p>La prueba antigua quedó archivada automáticamente.</p>
          <button type="button" className="instructor-btn instructor-btn-primary" style={{ marginTop: 14 }} onClick={onClose}>
            Volver al panel
          </button>
        </div>
      ) : (
        <ul className="instructor-legacy-list">
          {test.questions.map((question, idx) => {
            const selectedTemaId = temaByQuestion[question.id] ?? 0;
            const selectedDest = destByQuestion[question.id] ?? GENERAL_DEST;
            const temaSubtemas = selectedTemaId ? (subtemasCache[selectedTemaId] ?? []) : [];
            const isBusy = busyQuestionId === question.id;

            return (
              <li key={question.id} className="instructor-legacy-item">
                <div className="instructor-legacy-preview">
                  <strong>Pregunta {idx + 1}</strong>
                  <p className="instructor-legacy-inciso-title" style={{ marginTop: 6 }}>
                    <RichPreview value={question.titulo} fallback="Sin enunciado" />
                  </p>
                  {question.reference_photo_url && (
                    <div className="public-bank-ref-thumb" style={{ width: 160, marginBottom: 10 }}>
                      <img src={getCloudinaryImageUrl(question.reference_photo_url, 'cardWide')} alt="Imagen de referencia" />
                    </div>
                  )}
                  <ul className="instructor-legacy-options">
                    {question.options.map(opt => (
                      <li key={opt.id} className={opt.is_correct ? 'is-correct' : undefined}>
                        {opt.is_correct && <Check size={14} aria-hidden="true" />}
                        <RichPreview value={opt.texto} fallback="Sin texto" />
                      </li>
                    ))}
                  </ul>
                  {question.retroalimentacion && (
                    <p className="instructor-muted" style={{ marginTop: 8, fontSize: '0.8rem' }}>
                      <strong>Retroalimentación:</strong> <RichPreview value={question.retroalimentacion} />
                    </p>
                  )}
                </div>

                <div className="instructor-legacy-controls">
                  <label className="instructor-label" style={{ margin: 0 }}>
                    Tema destino
                    <select
                      className="instructor-input"
                      value={selectedTemaId || ''}
                      disabled={isBusy}
                      onChange={event => {
                        const nextTemaId = Number(event.target.value);
                        setTemaByQuestion(prev => ({ ...prev, [question.id]: nextTemaId }));
                        setDestByQuestion(prev => ({ ...prev, [question.id]: GENERAL_DEST }));
                        if (nextTemaId) void ensureSubtemasLoaded(nextTemaId);
                      }}
                    >
                      <option value="">Selecciona un tema…</option>
                      {groupedTemas.map(group => (
                        <optgroup key={group.parcial} label={group.label}>
                          {group.temas.map(t => (
                            <option key={t.id} value={t.id}>{t.nombre}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </label>

                  <label className="instructor-label" style={{ margin: 0 }}>
                    Sección destino
                    <select
                      className="instructor-input"
                      value={selectedDest}
                      disabled={isBusy || !selectedTemaId}
                      onChange={event => setDestByQuestion(prev => ({ ...prev, [question.id]: event.target.value }))}
                    >
                      <option value={GENERAL_DEST}>Preguntas generales del tema</option>
                      {temaSubtemas.map(st => (
                        <option key={st.id} value={String(st.id)}>
                          Subtema: {st.nombre}
                        </option>
                      ))}
                    </select>
                  </label>

                  <button
                    type="button"
                    className="instructor-btn instructor-btn-primary"
                    disabled={!selectedTemaId || Boolean(busyQuestionId)}
                    onClick={() => void handleMigrate(question.id)}
                  >
                    {isBusy
                      ? <LoaderCircle size={16} className="instructor-spin" aria-hidden="true" />
                      : <ArrowRightLeft size={16} aria-hidden="true" />}
                    {isBusy ? 'Migrando…' : 'Mover al banco'}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
