import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams, useNavigate } from 'react-router-dom';
import { ZoomIn } from 'lucide-react';
import BackButton from '../components/BackButton';
import Footer from '../components/Footer';
import Header from '../components/Header';
import ImageViewerModal from '../components/ImageViewerModal';
import { getCloudinaryImageUrl } from '../services/cloudinaryImages';
import { supabase } from '../services/supabase';

type ParcialKey = 'primer' | 'segundo' | 'tercer';

type TestScope = 'parcial' | 'tema' | 'subtema';

interface PruebaRow {
  id: string;
  nombre: string;
  instrucciones: string;
  scope: TestScope;
  parcial_key: ParcialKey;
  created_at: string;
  estado: string;
}

interface QuestionOptionRow {
  id: string;
  pregunta_id: string;
  sort_order: number;
  texto: string;
  is_correct: boolean;
}

interface QuestionRow {
  id: string;
  sort_order: number;
  titulo: string;
  retroalimentacion: string | null;
  required: boolean;
  reference_photo_url: string | null;
  reference_tema_name: string | null;
  reference_subtema_name: string | null;
  reference_senalado_x: number | null;
  reference_senalado_y: number | null;
  reference_senalado_start_x: number | null;
  reference_senalado_start_y: number | null;
}

interface QuestionOptionDraft {
  id: string;
  text: string;
  isCorrect: boolean;
  sortOrder: number;
}

interface QuestionDraft {
  id: string;
  sortOrder: number;
  title: string;
  retroalimentacion: string;
  required: boolean;
  options: QuestionOptionDraft[];
  referencePhotoUrl: string | null;
  referenceTemaName: string;
  referenceSubtemaName: string;
  referenceSenaladoLocation: {
    x: number;
    y: number;
    startX?: number | null;
    startY?: number | null;
  } | null;
}

interface SelectedAnswersState {
  [questionId: string]: string;
}

interface PublicTestPayload {
  test: PruebaRow;
  questions: Array<Omit<QuestionRow, 'retroalimentacion'> & { options: Omit<QuestionOptionRow, 'is_correct'>[] }>;
}

interface GradeResult {
  question_id: string;
  is_correct: boolean;
  correct_option_id: string;
  correct_option_text: string;
  feedback: string | null;
}

const parciales: Array<{ key: ParcialKey; label: string }> = [
  { key: 'primer', label: 'Primer parcial' },
  { key: 'segundo', label: 'Segundo parcial' },
  { key: 'tercer', label: 'Tercer parcial' },
];

const EjecutarPrueba: React.FC = () => {
  const location = useLocation();
  const { pruebaId } = useParams();
  const [prueba, setPrueba] = useState<PruebaRow | null>(null);
  const [questions, setQuestions] = useState<QuestionDraft[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<SelectedAnswersState>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isReferenceViewerOpen, setIsReferenceViewerOpen] = useState(false);
  const [referenceThumbNaturalSize, setReferenceThumbNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCompletion, setShowCompletion] = useState(false);
  const [isGraded, setIsGraded] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const loadPrueba = async () => {
      if (!pruebaId) {
        setError('No se encontró la prueba a ejecutar.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError('');

      const { data, error: pruebaError } = await supabase.rpc('atlas_get_public_test', {
        p_prueba_id: pruebaId,
      });
      const payload = data as PublicTestPayload | null;
      if (pruebaError || !payload?.test) {
        setError('No se pudo cargar la prueba.');
        setIsLoading(false);
        return;
      }

      const nextPrueba = payload.test;
      setPrueba(nextPrueba);
      setQuestions(payload.questions.map((pregunta) => {
        return {
          id: pregunta.id,
          sortOrder: pregunta.sort_order,
          title: pregunta.titulo,
          retroalimentacion: '',
          required: pregunta.required,
          options: pregunta.options.map((opcion) => ({
            id: opcion.id,
            text: opcion.texto,
            isCorrect: false,
            sortOrder: opcion.sort_order,
          })),
          referencePhotoUrl: pregunta.reference_photo_url,
          referenceTemaName: pregunta.reference_tema_name ?? '',
          referenceSubtemaName: pregunta.reference_subtema_name ?? '',
          referenceSenaladoLocation:
            pregunta.reference_senalado_x != null &&
            pregunta.reference_senalado_y != null
              ? {
                  x: pregunta.reference_senalado_x,
                  y: pregunta.reference_senalado_y,
                  startX: pregunta.reference_senalado_start_x,
                  startY: pregunta.reference_senalado_start_y,
                }
              : null,
        };
      }));

      setCurrentQuestionIndex(0);
      setIsGraded(false);

      setIsLoading(false);
    };

    void loadPrueba();
  }, [pruebaId]);

  const parcialLabel = prueba
    ? parciales.find(item => item.key === prueba.parcial_key)?.label ?? prueba.parcial_key
    : '';

  const backTarget = (location.state as { from?: string } | null)?.from ?? '/pruebas';

  const correctCount = useMemo(() => {
    return questions.reduce((count, question) => {
      const selectedId = selectedAnswers[question.id];
      const selectedOption = question.options.find(option => option.id === selectedId);
      return count + (selectedOption?.isCorrect ? 1 : 0);
    }, 0);
  }, [questions, selectedAnswers]);

  const answeredCount = Object.keys(selectedAnswers).length;
  const totalQuestions = questions.length;
  const progressPercent = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;
  const currentQuestion = questions[currentQuestionIndex] ?? null;
  const canGoPrev = currentQuestionIndex > 0;

  const gradeTest = async () => {
    if (!pruebaId || isGraded) {
      setShowCompletion(true);
      return;
    }
    const { data, error: gradeError } = await supabase.rpc('atlas_grade_test', {
      p_prueba_id: pruebaId,
      p_answers: selectedAnswers,
    });
    if (gradeError || !data) {
      setError('No se pudo corregir la prueba. Intenta nuevamente.');
      return;
    }
    const results = ((data as { results?: GradeResult[] }).results ?? []);
    const byQuestion = new Map(results.map(result => [result.question_id, result]));
    setQuestions(previous => previous.map(question => {
      const result = byQuestion.get(question.id);
      return {
        ...question,
        retroalimentacion: result?.feedback ?? '',
        options: question.options.map(option => ({
          ...option,
          isCorrect: option.id === result?.correct_option_id,
        })),
      };
    }));
    setIsGraded(true);
    setShowCompletion(true);
  };

  useEffect(() => {
    setReferenceThumbNaturalSize(null);
  }, [currentQuestion?.referencePhotoUrl]);

  return (
    <div style={s.page}>
      <Header disableInteractions />

      <main style={s.main} className="edicion-main">
        <BackButton onClick={() => { window.location.href = backTarget; }} />

        <section style={s.hero} className="edicion-card">
          <div style={s.heroText}>
            <p style={s.kicker}>Ejecutor</p>
            <h1 style={s.title}>{prueba?.nombre ?? 'Prueba'}</h1>
            <p style={s.subtitle}>{prueba?.instrucciones || 'Sin instrucciones registradas.'}</p>
          </div>
        </section>

        {isLoading ? (
          <section style={s.card} className="edicion-card">
            <div style={s.emptyState}>
              <p style={s.emptyTitle}>Cargando prueba...</p>
            </div>
          </section>
        ) : error ? (
          <section style={s.card} className="edicion-card">
            <div style={s.emptyState}>
              <p style={s.emptyTitle}>{error}</p>
              <Link to={backTarget} style={s.secondaryButton}>Volver</Link>
            </div>
          </section>
        ) : (
          <>
            <section style={s.summaryCard} className="edicion-card">
              <div style={s.summaryItem}>
                <span style={s.summaryLabel}>Scope</span>
                <strong style={s.summaryValue}>{prueba?.scope}</strong>
              </div>
              <div style={s.summaryItem}>
                <span style={s.summaryLabel}>Parcial</span>
                <strong style={s.summaryValue}>{parcialLabel}</strong>
              </div>
              <div style={s.summaryItem}>
                <span style={s.summaryLabel}>Respondidas</span>
                <strong style={s.summaryValue}>{answeredCount}/{totalQuestions}</strong>
              </div>
              <div style={s.summaryItem}>
                <span style={s.summaryLabel}>Aciertos</span>
                <strong style={s.summaryValue}>{correctCount}</strong>
              </div>
              <div style={s.summaryProgressWrap}>
                <div style={s.summaryProgressBar}>
                  <span style={{ ...s.summaryProgressFill, width: `${progressPercent}%` }} />
                </div>
                <span style={s.summaryProgressText}>{progressPercent}% completado</span>
              </div>
            </section>

            <section style={s.questionsWrap}>
              {questions.length === 0 ? (
                <div style={s.card} className="edicion-card">
                  <div style={s.emptyState}>
                    <p style={s.emptyTitle}>La prueba no tiene preguntas todavía.</p>
                  </div>
                </div>
              ) : currentQuestion ? (
                (() => {
                  const selectedId = selectedAnswers[currentQuestion.id];
                  const selectedOption = currentQuestion.options.find(option => option.id === selectedId);
                  const correctOption = currentQuestion.options.find(option => option.isCorrect) ?? null;
                  const isAnswered = Boolean(selectedId);
                  const isCorrect = Boolean(selectedOption?.isCorrect);

                  return (
                    <article key={currentQuestion.id} style={s.questionCard} className="edicion-card">
                      <div style={s.questionHeader}>
                        <div style={s.questionHeaderLeft}>
                          <span style={s.questionIndex}>{currentQuestionIndex + 1}</span>
                          <div>
                            <h2 style={s.questionTitle}>{currentQuestion.title || 'Pregunta sin título'}</h2>
                          </div>
                        </div>
                        <span style={isAnswered && isGraded ? (isCorrect ? s.correctPill : s.wrongPill) : s.pendingPill}>
                          {isAnswered ? (isGraded ? (isCorrect ? 'Correcta' : 'Incorrecta') : 'Respondida') : 'Sin responder'}
                        </span>
                      </div>

                      <div style={s.questionBody}>
                        <div style={s.referencePanel}>
                          {currentQuestion.referencePhotoUrl ? (
                            <button
                              type="button"
                              style={s.referenceFrameButton}
                              onClick={() => setIsReferenceViewerOpen(true)}
                            >
                              <div style={s.referenceFrame}>
                                <img
                                  src={getCloudinaryImageUrl(currentQuestion.referencePhotoUrl, 'view')}
                                  alt="Referencia de la pregunta"
                                  style={s.referenceImage}
                                  onLoad={event => {
                                    const imageElement = event.currentTarget;
                                    setReferenceThumbNaturalSize({
                                      width: imageElement.naturalWidth,
                                      height: imageElement.naturalHeight,
                                    });
                                  }}
                                />
                                {currentQuestion.referenceSenaladoLocation && (
                                  <svg
                                    viewBox={`0 0 ${referenceThumbNaturalSize?.width ?? 100} ${referenceThumbNaturalSize?.height ?? 100}`}
                                    style={s.referenceOverlay}
                                  >
                                    <defs>
                                      <marker
                                        id="referenceThumbnailArrow"
                                        markerWidth="10"
                                        markerHeight="10"
                                        refX="8"
                                        refY="3"
                                        orient="auto"
                                        markerUnits="strokeWidth"
                                      >
                                        <path d="M0,0 L9,3 L0,6 Z" fill="#0f172a" />
                                      </marker>
                                    </defs>
                                    <line
                                      x1={(currentQuestion.referenceSenaladoLocation.startX ?? currentQuestion.referenceSenaladoLocation.x) * (referenceThumbNaturalSize?.width ?? 100)}
                                      y1={(currentQuestion.referenceSenaladoLocation.startY ?? currentQuestion.referenceSenaladoLocation.y) * (referenceThumbNaturalSize?.height ?? 100)}
                                      x2={currentQuestion.referenceSenaladoLocation.x * (referenceThumbNaturalSize?.width ?? 100)}
                                      y2={currentQuestion.referenceSenaladoLocation.y * (referenceThumbNaturalSize?.height ?? 100)}
                                      stroke="#0f172a"
                                      strokeWidth={Math.max(4, Math.min(referenceThumbNaturalSize?.width ?? 100, referenceThumbNaturalSize?.height ?? 100) * 0.006)}
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      markerEnd="url(#referenceThumbnailArrow)"
                                    />
                                  </svg>
                                )}

                                <div style={s.referenceZoomHint}>
                                  <span style={s.referenceZoomHintIconWrap}>
                                    <ZoomIn size={14} strokeWidth={2.4} />
                                  </span>
                                  <span style={s.referenceZoomHintText}>Haz clic para ampliar</span>
                                </div>
                              </div>
                            </button>
                          ) : (
                            <div style={s.referenceEmptyFrame}>
                              <p style={s.referenceEmptyText}>Sin imagen de referencia</p>
                            </div>
                          )}
                        </div>

                        <div style={s.answerPanel}>
                          <p style={s.answerHint}>Selecciona una sola respuesta.</p>
                          <div style={s.optionsList}>
                            {currentQuestion.options.map((option) => {
                              const isSelected = option.id === selectedId;
                              const optionIsCorrect = option.isCorrect;
                              const buttonStyle = isSelected
                                ? (isGraded ? (optionIsCorrect ? s.optionCorrect : s.optionWrong) : s.optionCorrectGhost)
                                : (isGraded && optionIsCorrect ? s.optionCorrectGhost : s.optionButton);

                              return (
                                <button
                                  key={option.id}
                                  type="button"
                                  style={buttonStyle}
                                  onClick={() => !isGraded && setSelectedAnswers(prev => ({ ...prev, [currentQuestion.id]: option.id }))}
                                >
                                  <span style={s.optionLetter}>{String.fromCharCode(65 + option.sortOrder)}</span>
                                  <span style={s.optionText}>{option.text}</span>
                                </button>
                              );
                            })}
                          </div>

                          {isAnswered && isGraded && (
                            <div style={isCorrect ? s.feedbackSuccess : s.feedbackError}>
                              {isCorrect
                                ? 'Seleccionaste la respuesta correcta.'
                                : `Incorrecta. La correcta es: ${correctOption?.text ?? 'No definida'}`}
                            </div>
                          )}

                          {isAnswered && isGraded && currentQuestion.retroalimentacion.trim().length > 0 && (
                            <div style={s.feedbackNoteBox}>
                              <span style={s.feedbackNoteLabel}>Retroalimentación</span>
                              <p style={s.feedbackNoteText}>{currentQuestion.retroalimentacion}</p>
                            </div>
                          )}

                          <div style={s.navigationRow}>
                            <button
                              type="button"
                              onClick={() => setCurrentQuestionIndex(index => Math.max(0, index - 1))}
                              disabled={!canGoPrev}
                              style={canGoPrev ? s.navButton : s.navButtonDisabled}
                            >
                              Anterior
                            </button>
                            <span style={s.navMeta}>
                              Pregunta {currentQuestionIndex + 1} de {questions.length}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                if (questions.length === 0) return;
                                if (currentQuestionIndex < questions.length - 1) {
                                  setCurrentQuestionIndex(index => Math.min(questions.length - 1, index + 1));
                                } else {
                                  void gradeTest();
                                }
                              }}
                              disabled={questions.length === 0}
                              style={s.navButtonPrimary}
                            >
                              Siguiente
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })()
              ) : null}
            </section>

            {showCompletion && (
              <section style={s.completionOverlay}>
                <div style={s.completionCard}>
                  <h2 style={s.completionTitle}>¡Felicidades!</h2>
                  <p style={s.completionText}>Has completado la prueba <strong>{prueba?.nombre}</strong>.</p>
                  <p style={s.completionScore}>Tu puntuación: <strong>{correctCount}</strong> de <strong>{totalQuestions}</strong> ({totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0}%)</p>
                  <div style={s.completionActions}>
                    <button type="button" style={s.primaryFinishButton} onClick={() => navigate('/evaluaciones')}>Finalizar y volver a Evaluaciones</button>
                    <button type="button" style={s.secondaryFinishButton} onClick={() => setShowCompletion(false)}>Revisar respuestas</button>
                  </div>
                </div>
              </section>
            )}

            {isReferenceViewerOpen && currentQuestion && currentQuestion.referencePhotoUrl && (
              <ImageViewerModal
                src={getCloudinaryImageUrl(currentQuestion.referencePhotoUrl, 'view')}
                srcZoom={getCloudinaryImageUrl(currentQuestion.referencePhotoUrl, 'zoom')}
                onClose={() => setIsReferenceViewerOpen(false)}
                hideSidebar
                initialMarkerVisualMode="pointer"
                senaladosMeta={currentQuestion.referenceSenaladoLocation ? [{
                  label: 'Señalado',
                  x: currentQuestion.referenceSenaladoLocation.x,
                  y: currentQuestion.referenceSenaladoLocation.y,
                  startX: currentQuestion.referenceSenaladoLocation.startX ?? null,
                  startY: currentQuestion.referenceSenaladoLocation.startY ?? null,
                }] : null}
              />
            )}
          </>
        )}
      </main>

      <Footer />
    </div>
  );
};

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    color: '#0f172a',
    background: 'radial-gradient(circle at top left, rgba(224,231,255,0.85), transparent 28%), radial-gradient(circle at top right, rgba(224,242,254,0.8), transparent 24%), linear-gradient(180deg, #f8fafc 0%, #eef2ff 42%, #ffffff 100%)',
    fontFamily: '"Montserrat", "Segoe UI", sans-serif',
  },
  main: {
    flex: 1,
    width: '100%',
    maxWidth: '1280px',
    margin: '0 auto',
    boxSizing: 'border-box',
    padding: '0 20px 44px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  hero: {
    display: 'block',
    padding: '0',
  },
  heroText: {
    borderRadius: '28px',
    padding: '28px 30px',
    background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(239,246,255,0.96) 45%, rgba(255,255,255,0.98) 100%)',
    border: '1px solid rgba(191,219,254,0.9)',
    boxShadow: '0 20px 50px rgba(15,23,42,0.10)',
  },
  kicker: {
    margin: 0,
    color: '#7c3aed',
    fontWeight: 900,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    fontSize: '0.74em',
  },
  title: {
    margin: '10px 0 8px',
    fontSize: 'clamp(1.8rem, 4vw, 3rem)',
    lineHeight: 1.05,
    letterSpacing: '-0.04em',
  },
  subtitle: {
    margin: 0,
    maxWidth: '72ch',
    color: '#475569',
    lineHeight: 1.65,
    fontSize: '0.98rem',
  },
  summaryCard: {
    borderRadius: '28px',
    border: '1px solid rgba(226,232,240,0.95)',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(248,250,252,0.96) 100%)',
    boxShadow: '0 22px 60px rgba(15,23,42,0.10)',
    padding: '20px',
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: '14px',
    alignItems: 'stretch',
  },
  summaryItem: {
    borderRadius: '18px',
    border: '1px solid #dbeafe',
    background: '#fff',
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  summaryLabel: {
    color: '#64748b',
    fontWeight: 800,
    fontSize: '0.74rem',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  summaryValue: {
    color: '#0f172a',
    fontSize: '1rem',
  },
  summaryProgressWrap: {
    gridColumn: '1 / -1',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  summaryProgressBar: {
    width: '100%',
    height: '10px',
    borderRadius: '999px',
    background: '#e2e8f0',
    overflow: 'hidden',
  },
  summaryProgressFill: {
    display: 'block',
    height: '100%',
    borderRadius: '999px',
    background: 'linear-gradient(135deg, #2563eb, #8b5cf6)',
  },
  summaryProgressText: {
    color: '#475569',
    fontSize: '0.9rem',
    fontWeight: 700,
  },
  questionsWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  card: {
    borderRadius: '28px',
    border: '1px solid rgba(226,232,240,0.95)',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(248,250,252,0.96) 100%)',
    boxShadow: '0 22px 60px rgba(15,23,42,0.10)',
    padding: '28px',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
    width: '100%',
  },
  questionCard: {
    borderRadius: '28px',
    border: '1px solid rgba(226,232,240,0.95)',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.98) 100%)',
    boxShadow: '0 22px 60px rgba(15,23,42,0.10)',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  questionHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '16px',
    flexWrap: 'wrap',
  },
  questionHeaderLeft: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
  },
  questionIndex: {
    width: '38px',
    height: '38px',
    borderRadius: '999px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color: '#fff',
    fontWeight: 900,
    flexShrink: 0,
  },
  questionTitle: {
    margin: 0,
    fontSize: '1.06rem',
    color: '#0f172a',
  },
  questionDesc: {
    margin: '6px 0 0',
    color: '#475569',
    lineHeight: 1.6,
    fontSize: '0.94rem',
  },
  pendingPill: {
    borderRadius: '999px',
    padding: '6px 10px',
    background: '#eef2ff',
    color: '#4338ca',
    fontSize: '0.75rem',
    fontWeight: 800,
    whiteSpace: 'nowrap',
  },
  correctPill: {
    borderRadius: '999px',
    padding: '6px 10px',
    background: '#dcfce7',
    color: '#166534',
    fontSize: '0.75rem',
    fontWeight: 800,
    whiteSpace: 'nowrap',
  },
  wrongPill: {
    borderRadius: '999px',
    padding: '6px 10px',
    background: '#fee2e2',
    color: '#b91c1c',
    fontSize: '0.75rem',
    fontWeight: 800,
    whiteSpace: 'nowrap',
  },
  questionBody: {
    display: 'grid',
    gridTemplateColumns: 'minmax(280px, 360px) minmax(0, 1fr)',
    gap: '18px',
    alignItems: 'start',
  },
  referencePanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  referencePanelHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  referencePanelLabel: {
    color: '#64748b',
    fontSize: '0.74rem',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    fontWeight: 900,
  },
  referencePanelTitle: {
    color: '#0f172a',
    fontSize: '0.96rem',
    fontWeight: 800,
  },
  referenceFrame: {
    position: 'relative',
    width: '100%',
    aspectRatio: '1 / 1',
    borderRadius: '22px',
    overflow: 'hidden',
    border: '1px solid #dbeafe',
    background: '#0f172a',
    boxShadow: '0 14px 30px rgba(15,23,42,0.12)',
  },
  referenceFrameButton: {
    border: 'none',
    padding: 0,
    margin: 0,
    background: 'transparent',
    width: '100%',
    cursor: 'zoom-in',
    textAlign: 'left',
  },
  referenceImage: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    display: 'block',
    background: '#0f172a',
  },
  referenceOverlay: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
  },
  referenceZoomHint: {
    position: 'absolute',
    right: '12px',
    bottom: '12px',
    zIndex: 3,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '7px',
    padding: '8px 11px',
    borderRadius: '999px',
    background: 'rgba(15,23,42,0.78)',
    color: '#fff',
    boxShadow: '0 10px 24px rgba(15,23,42,0.22)',
    backdropFilter: 'blur(8px)',
    pointerEvents: 'none',
  },
  referenceZoomHintIconWrap: {
    width: '22px',
    height: '22px',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.16)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  referenceZoomHintText: {
    fontSize: '0.7rem',
    fontWeight: 800,
    letterSpacing: '0.03em',
    whiteSpace: 'nowrap',
  },
  referenceEmptyFrame: {
    width: '100%',
    aspectRatio: '1 / 1',
    borderRadius: '22px',
    border: '1px dashed #cbd5e1',
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  referenceEmptyText: {
    margin: 0,
    color: '#64748b',
    fontWeight: 700,
  },
  answerPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  answerHint: {
    margin: 0,
    color: '#475569',
    fontWeight: 700,
  },
  optionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  optionButton: {
    borderRadius: '16px',
    border: '1.5px solid #cbd5e1',
    background: '#fff',
    padding: '14px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    textAlign: 'left',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  optionCorrect: {
    borderRadius: '16px',
    border: '1.5px solid #86efac',
    background: '#dcfce7',
    padding: '14px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    textAlign: 'left',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  optionCorrectGhost: {
    borderRadius: '16px',
    border: '1.5px solid #86efac',
    background: '#f0fdf4',
    padding: '14px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    textAlign: 'left',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  optionWrong: {
    borderRadius: '16px',
    border: '1.5px solid #fca5a5',
    background: '#fee2e2',
    padding: '14px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    textAlign: 'left',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  optionLetter: {
    width: '28px',
    height: '28px',
    borderRadius: '999px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#eef2ff',
    color: '#4338ca',
    fontWeight: 900,
    flexShrink: 0,
  },
  optionText: {
    color: '#0f172a',
    fontWeight: 700,
    lineHeight: 1.5,
  },
  feedbackSuccess: {
    borderRadius: '16px',
    background: '#dcfce7',
    border: '1px solid #86efac',
    color: '#166534',
    padding: '14px 16px',
    fontWeight: 800,
    lineHeight: 1.6,
  },
  feedbackError: {
    borderRadius: '16px',
    background: '#fee2e2',
    border: '1px solid #fca5a5',
    color: '#b91c1c',
    padding: '14px 16px',
    fontWeight: 800,
    lineHeight: 1.6,
  },
  feedbackNoteBox: {
    borderRadius: '16px',
    background: '#f8fafc',
    border: '1px solid #cbd5e1',
    color: '#0f172a',
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  feedbackNoteLabel: {
    color: '#475569',
    fontWeight: 900,
    fontSize: '0.72rem',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  feedbackNoteText: {
    margin: 0,
    color: '#0f172a',
    lineHeight: 1.6,
    fontWeight: 600,
    whiteSpace: 'pre-wrap',
  },
  navigationRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    flexWrap: 'wrap',
    marginTop: '4px',
  },
  navMeta: {
    color: '#64748b',
    fontWeight: 800,
    fontSize: '0.9rem',
  },
  navButton: {
    borderRadius: '14px',
    border: '1.5px solid #cbd5e1',
    background: '#fff',
    color: '#334155',
    padding: '12px 16px',
    fontFamily: 'inherit',
    fontWeight: 900,
    cursor: 'pointer',
  },
  navButtonPrimary: {
    borderRadius: '14px',
    border: 'none',
    background: 'linear-gradient(135deg, #2563eb, #8b5cf6)',
    color: '#fff',
    padding: '12px 16px',
    fontFamily: 'inherit',
    fontWeight: 900,
    cursor: 'pointer',
  },
  navButtonDisabled: {
    borderRadius: '14px',
    border: '1.5px solid #e2e8f0',
    background: '#f8fafc',
    color: '#94a3b8',
    padding: '12px 16px',
    fontFamily: 'inherit',
    fontWeight: 900,
    cursor: 'not-allowed',
  },
  completionOverlay: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(15,23,42,0.48)',
    zIndex: 1200,
    padding: '20px',
  },
  completionCard: {
    width: '100%',
    maxWidth: '720px',
    borderRadius: '20px',
    padding: '28px',
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)',
    border: '1px solid #dbeafe',
    boxShadow: '0 30px 80px rgba(15,23,42,0.24)',
    textAlign: 'center',
  },
  completionTitle: {
    margin: 0,
    fontSize: '1.8rem',
    color: '#0f172a',
    fontWeight: 900,
  },
  completionText: {
    marginTop: '8px',
    color: '#475569',
    fontSize: '1rem',
  },
  completionScore: {
    marginTop: '12px',
    fontSize: '1.05rem',
    color: '#0f172a',
    fontWeight: 800,
  },
  completionActions: {
    marginTop: '18px',
    display: 'flex',
    justifyContent: 'center',
    gap: '10px',
  },
  primaryFinishButton: {
    border: 'none',
    borderRadius: '14px',
    padding: '12px 18px',
    background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
    color: '#fff',
    fontWeight: 900,
    cursor: 'pointer',
  },
  secondaryFinishButton: {
    border: '1px solid #cbd5e1',
    borderRadius: '14px',
    padding: '12px 18px',
    background: '#fff',
    color: '#0f172a',
    fontWeight: 800,
    cursor: 'pointer',
  },
  secondaryButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px 16px',
    borderRadius: '14px',
    border: '1.5px solid #cbd5e1',
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
    color: '#334155',
    textDecoration: 'none',
    fontWeight: 800,
    fontFamily: 'inherit',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    borderRadius: '20px',
    padding: '24px',
    border: '1px dashed #cbd5e1',
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
    alignItems: 'flex-start',
  },
  emptyTitle: {
    margin: 0,
    fontWeight: 900,
    color: '#0f172a',
    fontSize: '1.05rem',
  },
};

export default EjecutarPrueba;
