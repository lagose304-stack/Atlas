import { useMemo, useState } from 'react';
import { ArrowLeft, CheckCheck, Eye, RotateCcw, Send } from 'lucide-react';
import InstructorExamNavigator from './InstructorExamNavigator';
import type { InstructorContent } from '../services/instructorTests';
import {
  expandInstructorVersus, groupPublicInstructorQuestions, instructorGroups, isInstructorAnswerComplete,
  type InstructorAnswers, type PublicInstructorQuestion,
} from '../types/instructorQuestions';
import '../styles/instructorPublic.css';
import { shuffleInstructorItems } from '../utils/instructorTopics';

export function buildInstructorPreviewQuestions(content: InstructorContent): PublicInstructorQuestion[] {
  content = expandInstructorVersus(content);
  const byId = new Map(content.questions.map(q => [q.id, q]));
  const sectionsById = new Map((content.sections ?? []).map((sec, idx) => [sec.id, { ...sec, position: idx + 1 }]));
  const groups = instructorGroups(content);
  const result: PublicInstructorQuestion[] = [];

  groups.forEach((group, groupIdx) => {
    const section = group.section_id ? sectionsById.get(group.section_id) : undefined;
    const publicGroup = { id: group.id, titulo: group.titulo, position: groupIdx + 1, ...(section ? { section } : {}) };
    group.item_ids.forEach(itemId => {
      const q = byId.get(itemId);
      if (!q) return;
      const publicImage = (img?: { url: string; annotations?: { x: number; y: number; label: string }[] }) => (
        img ? { url: img.url, ...(img.annotations ? { annotations: img.annotations.map(a => ({ ...a, label: 'Señalado' })) } : {}) } : undefined
      );

      if (q.type === 'image_versus') {
        result.push({
          id: q.id, titulo: q.titulo, type: 'image_versus',
          image_a: publicImage(q.image_a) ?? { url: '' },
          image_b: publicImage(q.image_b) ?? { url: '' },
          group: publicGroup,
        });
      } else if (q.type === 'image_point') {
        result.push({ id: q.id, titulo: q.titulo, type: 'image_point', image: { url: q.image?.url ?? '' }, group: publicGroup });
      } else if (q.type === 'short_answer') {
        result.push({ id: q.id, titulo: q.titulo, type: 'short_answer', ...(q.image ? { image: publicImage(q.image) } : {}), group: publicGroup });
      } else if (q.type === 'completion') {
        result.push({
          id: q.id, titulo: q.titulo, type: 'completion',
          blanks: q.blanks.map(b => ({ id: b.id })),
          ...(q.image ? { image: publicImage(q.image) } : {}),
          group: publicGroup,
        });
      } else if (q.type === 'matching') {
        const choices = [
          ...q.pairs.map(pair => ({ id: pair.option_id, texto: pair.definition || 'Sin pareja' })),
          ...(q.distractors ?? []).map(option => ({ ...option, texto: option.texto || 'Sin texto' })),
        ];
        result.push({
          id: q.id, titulo: q.titulo, type: 'matching',
          terms: q.pairs.map(p => ({ id: p.id, texto: p.term || 'Sin término' })),
          choices: shuffleInstructorItems(choices),
          ...(q.image ? { image: publicImage(q.image) } : {}),
          group: publicGroup,
        });
      } else {
        result.push({
          id: q.id, titulo: q.titulo, type: 'single_choice',
          ...(q.correct_option_ids ? { multiple: true } : {}),
          options: q.options.map((o, i) => ({ id: o.id, texto: o.texto || `Opción ${i + 1}` })),
          ...(q.image ? { image: publicImage(q.image) } : {}),
          group: publicGroup,
        });
      }
    });
  });

  return result;
}

export default function InstructorTestPreview({ content, onClose }: { content: InstructorContent; onClose: () => void }) {
  const questions = useMemo(() => buildInstructorPreviewQuestions(content), [content]);
  const [answers, setAnswers] = useState<InstructorAnswers>({});
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  const reset = () => {
    setAnswers({});
    setCurrentQuestion(null);
    setNotice(null);
  };

  const simulateSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (questions.some(q => !isInstructorAnswerComplete(q, answers[q.id]))) {
      const missing = groupPublicInstructorQuestions(questions).find(group => group.items.some(q => !isInstructorAnswerComplete(q, answers[q.id])));
      if (missing) setCurrentQuestion(missing.id);
      setNotice({ kind: 'error', text: 'Responde todas las preguntas evaluables para completar la simulación.' });
      return;
    }
    setNotice({ kind: 'success', text: 'Simulación completada: todas las preguntas evaluables fueron respondidas. En vista previa no se envía ni se guarda nada en la base de datos.' });
  };

  return (
    <div className="instructor-page instructor-public-page instructor-taking-mode" aria-label="Vista previa de la prueba">
      <header className="instructor-taking-topbar">
        <div>
          <p className="instructor-public-kicker">Vista previa · Solo visualización</p>
          <h1>{content.nombre.trim() || 'Prueba de instructores'}</h1>
        </div>
        <div className="instructor-taking-actions">
          <button type="button" className="instructor-btn" onClick={reset}>
            <RotateCcw size={16} aria-hidden="true" />
            <span>Reiniciar respuestas</span>
          </button>
          <button type="button" className="instructor-btn instructor-btn-primary" onClick={onClose}>
            <ArrowLeft size={16} aria-hidden="true" />
            <span>Volver al editor</span>
          </button>
        </div>
      </header>
      <main className="instructor-main">
        <div className="instructor-participant-bar" role="status">
          <span><Eye size={16} aria-hidden="true" />Modo vista previa interactiva</span>
          <span>Sin código ni registro · No guarda datos en la base de datos</span>
        </div>

        {content.instrucciones.trim() && (
          <p style={{ whiteSpace: 'pre-wrap' }}>{content.instrucciones}</p>
        )}

        {notice && (
          <p role={notice.kind === 'error' ? 'alert' : 'status'} className={notice.kind === 'error' ? 'instructor-error' : 'instructor-success'}>
            {notice.kind === 'success' && <CheckCheck size={16} aria-hidden="true" style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />}
            {notice.text}
          </p>
        )}

        {questions.length === 0 ? (
          <section className="instructor-panel">
            <h2>Todavía no hay incisos para previsualizar</h2>
            <p className="instructor-muted">Agrega al menos un inciso en el editor para ver cómo se comportará la prueba.</p>
            <button type="button" className="instructor-btn instructor-btn-primary" onClick={onClose}>
              <ArrowLeft size={16} aria-hidden="true" />Volver al editor
            </button>
          </section>
        ) : (
          <form onSubmit={simulateSubmit}>
            <InstructorExamNavigator
              questions={questions}
              answers={answers}
              currentId={currentQuestion}
              showTopics
              disabled={false}
              onSelect={id => { setCurrentQuestion(id); setNotice(null); }}
              onAnswer={(questionId, value) => {
                setAnswers(previous => ({ ...previous, [questionId]: value }));
                setNotice(null);
              }}
            />
            <div className="instructor-exam-delivery">
              <div>
                <strong>Entrega simulada (vista previa)</strong>
                <p>Comprueba si todas las preguntas evaluables están respondidas. No se enviará ni guardará nada en la base de datos.</p>
              </div>
              <button type="submit" className="instructor-btn instructor-btn-primary">
                <Send size={17} aria-hidden="true" />Comprobar entrega
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
