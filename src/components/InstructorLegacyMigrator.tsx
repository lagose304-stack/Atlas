import { useState } from 'react';
import { ArrowLeft, ArrowRightLeft, Check, Info, LoaderCircle } from 'lucide-react';
import type { CatalogTema } from '../services/catalogService';
import {
  migrateInstructorQuestionToBank,
  type InstructorBankTopic,
  type InstructorEditor,
} from '../services/instructorTests';
import { INSTRUCTOR_QUESTION_TYPES, incisoLetter, instructorGroups, type InstructorQuestion } from '../types/instructorQuestions';
import { groupTemasByParcial } from '../utils/instructorTopics';
import InstructorReferenceImageView from './InstructorReferenceImageView';

function LegacyItemDetails({ item }: { item: InstructorQuestion }) {
  if (item.type === 'image_versus') {
    return (
      <div className="instructor-versus-grid">
        <div className="instructor-versus-card">
          <span className="instructor-versus-label">Imagen A</span>
          <InstructorReferenceImageView url={item.image_a?.url ?? ''} annotations={item.image_a?.annotations} />
        </div>
        <div className="instructor-versus-card">
          <span className="instructor-versus-label">Imagen B</span>
          <InstructorReferenceImageView url={item.image_b?.url ?? ''} annotations={item.image_b?.annotations} />
        </div>
      </div>
    );
  }

  return (
    <div className="instructor-legacy-item-body">
      {item.image && (
        <div className="instructor-question-image">
          <InstructorReferenceImageView url={item.image.url} annotations={item.image.annotations} />
        </div>
      )}
      {(item.type === 'single_choice' || !item.type) && (
        <ul className="instructor-legacy-options">
          {item.options.map(opt => (
            <li key={opt.id} className={opt.id === item.correct_option_id ? 'is-correct' : undefined}>
              {opt.id === item.correct_option_id && <Check size={14} aria-hidden="true" />}
              <span>{opt.texto || 'Sin texto'}</span>
            </li>
          ))}
        </ul>
      )}
      {item.type === 'short_answer' && item.accepted_answers.some(a => a.trim()) && (
        <p className="instructor-muted"><strong>Referencias:</strong> {item.accepted_answers.filter(a => a.trim()).join(' · ')}</p>
      )}
      {item.type === 'completion' && (
        <ul className="instructor-legacy-options">
          {item.blanks.map((blank, i) => (
            <li key={blank.id}><strong>Hueco {i + 1}:</strong> {blank.accepted_answers.filter(a => a.trim()).join(' / ') || 'Sin respuestas'}</li>
          ))}
        </ul>
      )}
      {item.type === 'matching' && (
        <ul className="instructor-legacy-options">
          {item.pairs.map(pair => (
            <li key={pair.id}><strong>{pair.term || 'Sin término'}</strong> → {pair.definition || 'Sin pareja'}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function InstructorLegacyMigrator({
  initialEditor,
  temas,
  onMigrated,
  onClose,
}: {
  initialEditor: InstructorEditor;
  temas: CatalogTema[];
  onMigrated: (test: InstructorEditor, bank: InstructorBankTopic) => void;
  onClose: () => void;
}) {
  const [editor, setEditor] = useState<InstructorEditor>(initialEditor);
  const [selectedTemaByGroup, setSelectedTemaByGroup] = useState<Record<string, string>>({});
  const [busyGroupId, setBusyGroupId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const groups = instructorGroups(editor.content);
  const groupedTemas = groupTemasByParcial(temas);
  const byId = new Map(editor.content.questions.map(q => [q.id, q]));

  const migrate = async (groupId: string) => {
    const temaId = Number(selectedTemaByGroup[groupId]);
    if (!temaId || busyGroupId) return;
    setBusyGroupId(groupId);
    setError('');
    setMessage('');
    try {
      const result = await migrateInstructorQuestionToBank(editor.id, editor.revision, groupId, temaId);
      setEditor(result.test);
      onMigrated(result.test, result.bank);
      const temaNombre = temas.find(t => t.id === temaId)?.nombre ?? `Tema ${temaId}`;
      setMessage(`Pregunta migrada al banco de «${temaNombre}».`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo migrar la pregunta al banco.');
    } finally {
      setBusyGroupId(null);
    }
  };

  return (
    <section className="instructor-panel" aria-label="Migrar preguntas al banco">
      <button type="button" className="instructor-btn instructor-btn-ghost" disabled={!!busyGroupId} onClick={onClose}>
        <ArrowLeft size={16} aria-hidden="true" />Volver
      </button>
      <div className="instructor-list-heading" style={{ marginTop: 12 }}>
        <h2>Migrar preguntas de «{editor.content.nombre}»</h2>
        <p className="instructor-muted">Revisa el contenido completo de cada pregunta (placas, señalados y respuestas) y elige el tema del banco al que deseas moverla.</p>
      </div>
      <div className="instructor-workflow-note" style={{ marginTop: 12 }}>
        <Info size={16} aria-hidden="true" />
        <p>Esta prueba usa el formato anterior y ya no admite preguntas nuevas. Al migrar todas sus preguntas, la sección de migración desaparecerá automáticamente.</p>
      </div>
      {error && <p role="alert" className="instructor-error">{error}</p>}
      {message && <p role="status" className="instructor-success">{message}</p>}

      {groups.length === 0 ? (
        <div className="instructor-list-empty">
          <span className="instructor-empty-icon"><Check size={24} aria-hidden="true" /></span>
          <h3>Todas las preguntas de esta prueba ya fueron migradas</h3>
          <p>Puedes volver al panel principal; esta prueba antigua dejará de mostrarse en la lista de migración.</p>
          <button type="button" className="instructor-btn instructor-btn-primary" style={{ marginTop: 16 }} onClick={onClose}>Volver al panel</button>
        </div>
      ) : (
        <ul className="instructor-legacy-list">
          {groups.map((group, idx) => {
            const items = group.item_ids.map(id => byId.get(id)).filter((q): q is NonNullable<typeof q> => !!q);
            const selectedTema = selectedTemaByGroup[group.id] ?? '';
            const isBusy = busyGroupId === group.id;
            return (
              <li key={group.id} className="instructor-legacy-item">
                <div className="instructor-legacy-preview">
                  <strong>Pregunta {idx + 1} · {items.length} {items.length === 1 ? 'inciso' : 'incisos'}</strong>
                  {group.titulo.trim() && <p className="instructor-muted" style={{ margin: '6px 0 0' }}>{group.titulo}</p>}
                  <div className="instructor-legacy-incisos">
                    {items.map((item, itemIdx) => {
                      const label = INSTRUCTOR_QUESTION_TYPES.find(t => t.value === (item.type ?? 'single_choice'))?.label ?? 'Selección única';
                      return (
                        <article key={item.id} className="instructor-legacy-inciso">
                          <header className="instructor-legacy-inciso-head">
                            <span className="instructor-inciso-letter" aria-hidden="true">{incisoLetter(itemIdx).toUpperCase()}</span>
                            <span className="instructor-badge">{label}</span>
                          </header>
                          <p className="instructor-legacy-inciso-title">{item.titulo.trim() || 'Sin enunciado'}</p>
                          <LegacyItemDetails item={item} />
                        </article>
                      );
                    })}
                  </div>
                </div>
                <div className="instructor-legacy-controls">
                  <label className="instructor-label" style={{ margin: 0 }}>
                    Tema destino en el banco
                    <select
                      className="instructor-input"
                      aria-label={`Tema destino para pregunta ${idx + 1}`}
                      disabled={!!busyGroupId}
                      value={selectedTema}
                      onChange={e => setSelectedTemaByGroup(prev => ({ ...prev, [group.id]: e.target.value }))}
                    >
                      <option value="">Selecciona un tema…</option>
                      {groupedTemas.map(parcialGroup => (
                        <optgroup key={parcialGroup.parcial} label={parcialGroup.label}>
                          {parcialGroup.temas.map(tema => (
                            <option key={tema.id} value={String(tema.id)}>{tema.nombre}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="instructor-btn instructor-btn-primary"
                    disabled={!selectedTema || !!busyGroupId}
                    onClick={() => void migrate(group.id)}
                  >
                    {isBusy ? <LoaderCircle size={16} className="instructor-spin" aria-hidden="true" /> : <ArrowRightLeft size={16} aria-hidden="true" />}
                    {isBusy ? 'Migrando…' : 'Migrar esta pregunta al banco'}
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
