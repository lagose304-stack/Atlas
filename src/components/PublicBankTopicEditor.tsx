import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Circle, Copy,
  Image as ImageIcon, Layers, LoaderCircle, MapPin, Plus, Save, Search, Trash2, Upload, X,
} from 'lucide-react';
import type { CatalogSubtema, CatalogTema } from '../services/catalogService';
import { getCachedSubtemas } from '../services/catalogService';
import { getCloudinaryImageUrl } from '../services/cloudinaryImages';
import { uploadToCloudinary } from '../services/cloudinary';
import { supabase } from '../services/supabase';
import {
  getPublicBankQuestions,
  movePublicBankQuestion,
  savePublicBankSection,
} from '../services/publicTestsBank';
import {
  createBlankPublicBankOption,
  createBlankPublicBankQuestion,
  isPublicBankQuestionComplete,
  type PublicBankQuestion,
  type PublicBankTopicSummary,
} from '../types/publicQuestionBank';
import { PARCIAL_LABELS } from '../utils/instructorTopics';
import SenaladoLocationPicker, { type MarkerLocation } from './SenaladoLocationPicker';
import TestRichTextField from './TestRichTextField';

interface PlacaPickRow {
  id: number;
  photo_url: string;
  tema_id: number;
  subtema_id: number;
}

interface PublicBankTopicEditorProps {
  tema: CatalogTema;
  summary: PublicBankTopicSummary | undefined;
  onSummaryUpdated: () => Promise<void> | void;
  onClose: () => void;
}

const GENERAL_KEY = 'general';

export default function PublicBankTopicEditor({
  tema,
  summary,
  onSummaryUpdated,
  onClose,
}: PublicBankTopicEditorProps) {
  const [subtemas, setSubtemas] = useState<CatalogSubtema[]>([]);
  const [selectedSegment, setSelectedSegment] = useState<string>(GENERAL_KEY);
  const [questions, setQuestions] = useState<PublicBankQuestion[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loadingSection, setLoadingSection] = useState(true);
  const [saving, setSaving] = useState(false);
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [subtemaSearch, setSubtemaSearch] = useState('');
  const [selectorCollapsed, setSelectorCollapsed] = useState(false);

  // Selector de placa del Atlas
  const [showPlatePicker, setShowPlatePicker] = useState(false);
  const [pickerSubtemaId, setPickerSubtemaId] = useState<number | null>(null);
  const [pickerPlacas, setPickerPlacas] = useState<PlacaPickRow[]>([]);
  const [loadingPlacas, setLoadingPlacas] = useState(false);

  // Picker de señalado sobre imagen
  const [showMarkerPicker, setShowMarkerPicker] = useState(false);

  // Archivos locales pendientes de subida a R2 por questionId
  const pendingUploads = useRef(new Map<string, { file: File; previewUrl: string }>());
  const savedSnapshotRef = useRef('[]');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const selectedSubtemaId = selectedSegment === GENERAL_KEY ? null : Number(selectedSegment);
  const selectedSubtema = useMemo(
    () => subtemas.find(st => st.id === selectedSubtemaId) ?? null,
    [subtemas, selectedSubtemaId],
  );

  const serialize = (list: PublicBankQuestion[]) =>
    JSON.stringify(list.map(q => ({
      id: q.id,
      titulo: q.titulo,
      retroalimentacion: q.retroalimentacion,
      options: q.options.map(o => ({ id: o.id, texto: o.texto, is_correct: o.is_correct })),
      reference_placa_id: q.reference_placa_id,
      reference_photo_url: q.reference_photo_url,
      reference_senalado: q.reference_senalado,
    })));

  const dirty = serialize(questions) !== savedSnapshotRef.current;

  const clearPendingUploads = useCallback(() => {
    pendingUploads.current.forEach(item => URL.revokeObjectURL(item.previewUrl));
    pendingUploads.current.clear();
  }, []);

  useEffect(() => () => clearPendingUploads(), [clearPendingUploads]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // Cargar subtemas del tema
  useEffect(() => {
    let cancelled = false;
    void getCachedSubtemas(tema.id).then(list => {
      if (!cancelled) setSubtemas(list);
    }).catch(() => {
      if (!cancelled) setSubtemas([]);
    });
    return () => { cancelled = true; };
  }, [tema.id]);

  // Cargar preguntas de la sección seleccionada (Generales o Subtema)
  const loadSection = useCallback(async (subtemaId: number | null) => {
    setLoadingSection(true);
    setError('');
    setStatusMessage('');
    clearPendingUploads();
    try {
      const loaded = await getPublicBankQuestions(tema.id, subtemaId);
      setQuestions(loaded);
      savedSnapshotRef.current = serialize(loaded);
      setActiveIndex(0);
    } catch (e) {
      setQuestions([]);
      savedSnapshotRef.current = '[]';
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las preguntas de esta sección.');
    } finally {
      setLoadingSection(false);
    }
  }, [tema.id, clearPendingUploads]);

  useEffect(() => {
    void loadSection(selectedSubtemaId);
  }, [loadSection, selectedSubtemaId]);

  const handleSelectSegment = (nextKey: string) => {
    if (nextKey === selectedSegment || saving || moving) return;
    if (dirty && !window.confirm('Hay cambios sin guardar en esta sección. ¿Descartarlos y cambiar de sección?')) {
      return;
    }
    setSelectedSegment(nextKey);
  };

  const activeQuestion = questions[activeIndex] ?? null;

  const updateActiveQuestion = (updater: (current: PublicBankQuestion) => PublicBankQuestion) => {
    setError('');
    setStatusMessage('');
    setQuestions(prev => prev.map((q, idx) => (idx === activeIndex ? updater(q) : q)));
  };

  const addQuestion = () => {
    const next = createBlankPublicBankQuestion(tema.id, selectedSubtemaId, questions.length);
    setQuestions(prev => [...prev, next]);
    setActiveIndex(questions.length);
    setError('');
    setStatusMessage('');
  };

  const duplicateActiveQuestion = () => {
    if (!activeQuestion) return;
    const copy: PublicBankQuestion = {
      ...activeQuestion,
      id: crypto.randomUUID(),
      sort_order: questions.length,
      options: activeQuestion.options.map((opt, idx) => ({
        ...opt,
        id: crypto.randomUUID(),
        sort_order: idx,
      })),
    };
    setQuestions(prev => [...prev, copy]);
    setActiveIndex(questions.length);
    setStatusMessage('Pregunta duplicada. Recuerda guardar los cambios.');
  };

  const removeActiveQuestion = () => {
    if (!activeQuestion) return;
    if (!window.confirm(`¿Eliminar la pregunta ${activeIndex + 1} de esta sección?`)) return;
    const pending = pendingUploads.current.get(activeQuestion.id);
    if (pending) {
      URL.revokeObjectURL(pending.previewUrl);
      pendingUploads.current.delete(activeQuestion.id);
    }
    setQuestions(prev => prev.filter((_, idx) => idx !== activeIndex));
    setActiveIndex(prev => Math.max(0, Math.min(prev, questions.length - 2)));
  };

  const handleSave = async () => {
    if (saving || loadingSection) return;
    setSaving(true);
    setError('');
    setStatusMessage('');
    try {
      const prepared: PublicBankQuestion[] = [];
      for (const question of questions) {
        let nextQuestion = question;
        const pending = pendingUploads.current.get(question.id);
        if (pending && question.reference_photo_url === pending.previewUrl) {
          const upload = await uploadToCloudinary(pending.file, {
            folder: `pruebas/banco/tema-${tema.id}`,
            optimizeImage: true,
          });
          if (typeof upload.secure_url !== 'string' || !upload.secure_url.startsWith('https://')) {
            throw new Error('No se pudo confirmar la imagen subida a R2.');
          }
          URL.revokeObjectURL(pending.previewUrl);
          pendingUploads.current.delete(question.id);
          nextQuestion = {
            ...question,
            reference_photo_url: upload.secure_url,
            reference_placa_id: null,
          };
        }
        prepared.push(nextQuestion);
      }

      const saved = await savePublicBankSection(tema.id, selectedSubtemaId, prepared);
      setQuestions(saved);
      savedSnapshotRef.current = serialize(saved);
      setActiveIndex(prev => (saved.length === 0 ? 0 : Math.min(prev, saved.length - 1)));
      await onSummaryUpdated();
      setStatusMessage(
        selectedSubtema
          ? `Preguntas del subtema «${selectedSubtema.nombre}» guardadas correctamente.`
          : `Preguntas generales de «${tema.nombre}» guardadas correctamente.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron guardar las preguntas.');
    } finally {
      setSaving(false);
    }
  };

  const handleMoveQuestion = async (targetSubtemaId: number | null) => {
    if (!activeQuestion || moving || saving) return;
    if (dirty) {
      setError('Guarda primero los cambios de esta sección antes de mover una pregunta.');
      return;
    }
    setMoving(true);
    setError('');
    setStatusMessage('');
    try {
      await movePublicBankQuestion(activeQuestion.id, targetSubtemaId);
      const nextList = questions.filter(q => q.id !== activeQuestion.id);
      setQuestions(nextList);
      savedSnapshotRef.current = serialize(nextList);
      setActiveIndex(prev => (nextList.length === 0 ? 0 : Math.min(prev, nextList.length - 1)));
      await onSummaryUpdated();
      const targetName = targetSubtemaId === null
        ? 'Preguntas generales del tema'
        : subtemas.find(st => st.id === targetSubtemaId)?.nombre ?? `Subtema ${targetSubtemaId}`;
      setStatusMessage(`Pregunta movida a «${targetName}».`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo mover la pregunta.');
    } finally {
      setMoving(false);
    }
  };

  // Cargar placas del Atlas para el modal selector
  const openPlatePicker = async () => {
    setShowPlatePicker(true);
    const initialSubtema = selectedSubtemaId ?? subtemas[0]?.id ?? null;
    setPickerSubtemaId(initialSubtema);
    if (initialSubtema) {
      await loadPlacasForSubtema(initialSubtema);
    } else {
      await loadPlacasForTema();
    }
  };

  const loadPlacasForSubtema = async (subtemaId: number) => {
    setLoadingPlacas(true);
    try {
      const { data } = await supabase
        .from('placas')
        .select('id, photo_url, tema_id, subtema_id')
        .eq('tema_id', tema.id)
        .eq('subtema_id', subtemaId)
        .order('sort_order', { ascending: true })
        .limit(60);
      setPickerPlacas((data ?? []) as PlacaPickRow[]);
    } finally {
      setLoadingPlacas(false);
    }
  };

  const loadPlacasForTema = async () => {
    setLoadingPlacas(true);
    try {
      const { data } = await supabase
        .from('placas')
        .select('id, photo_url, tema_id, subtema_id')
        .eq('tema_id', tema.id)
        .order('id', { ascending: true })
        .limit(60);
      setPickerPlacas((data ?? []) as PlacaPickRow[]);
    } finally {
      setLoadingPlacas(false);
    }
  };

  const handleUploadImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !activeQuestion) return;
    const prevPending = pendingUploads.current.get(activeQuestion.id);
    if (prevPending) URL.revokeObjectURL(prevPending.previewUrl);
    const previewUrl = URL.createObjectURL(file);
    pendingUploads.current.set(activeQuestion.id, { file, previewUrl });
    updateActiveQuestion(q => ({
      ...q,
      reference_placa_id: null,
      reference_photo_url: previewUrl,
      reference_tema_name: tema.nombre,
      reference_subtema_name: selectedSubtema?.nombre ?? null,
      reference_senalado: null,
    }));
  };

  const handleClose = () => {
    if (saving || moving) return;
    if (dirty && !window.confirm('Hay cambios sin guardar en esta sección. ¿Salir y descartarlos?')) return;
    clearPendingUploads();
    onClose();
  };

  const subtemaCountMap = new Map((summary?.subtemas ?? []).map(s => [s.subtema_id, s.count]));
  const generalCount = selectedSubtemaId === null ? questions.length : (summary?.general_count ?? 0);
  const subtemasTotalCount = subtemas.reduce((sum, st) => {
    const isCurrent = selectedSegment === String(st.id);
    return sum + (isCurrent ? questions.length : (subtemaCountMap.get(st.id) ?? 0));
  }, 0);
  const normalizedSubtemaQuery = subtemaSearch.trim().toLowerCase();
  const visibleSubtemas = useMemo(
    () => (normalizedSubtemaQuery
      ? subtemas.filter(st => st.nombre.toLowerCase().includes(normalizedSubtemaQuery))
      : subtemas),
    [subtemas, normalizedSubtemaQuery],
  );
  const activeSegmentLabel = selectedSubtema ? selectedSubtema.nombre : `Generales de ${tema.nombre}`;
  const activeSegmentCount = questions.length;

  return (
    <div className="instructor-page instructor-editor-scope instructor-focus-mode public-bank-scope">
      <main className="instructor-main">
        <div className="instructor-panel instructor-edit-surface">
          <header className="instructor-editor-topbar">
            <button
              type="button"
              className="instructor-btn instructor-btn-ghost instructor-editor-back"
              onClick={handleClose}
              aria-label="Volver al banco de preguntas"
            >
              <ArrowLeft size={20} aria-hidden="true" />
              <span>Volver</span>
            </button>
            <div className="instructor-editor-document">
              <h2>Banco público · {PARCIAL_LABELS[tema.parcial] ?? tema.parcial}</h2>
              <h1>{tema.nombre}</h1>
            </div>
            <div className="instructor-editor-top-actions">
              <span className="instructor-save-state" data-dirty={dirty}>
                {dirty ? <Circle size={12} aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}
                {dirty ? 'Cambios sin guardar' : 'Guardado'}
              </span>
              <button
                type="button"
                className="instructor-btn instructor-btn-primary"
                disabled={saving || loadingSection || !dirty}
                onClick={() => void handleSave()}
              >
                {saving ? <LoaderCircle size={17} className="instructor-spin" aria-hidden="true" /> : <Save size={17} aria-hidden="true" />}
                {saving ? 'Guardando…' : 'Guardar sección'}
              </button>
            </div>
          </header>

          <div className="instructor-editor-body">
            {/* Selector estructurado entre Preguntas generales del tema y Subtemas */}
            <section
              className={`public-bank-segment-card${selectorCollapsed ? ' is-collapsed' : ''}`}
              aria-label="Categoría de preguntas del tema"
            >
              <div className="public-bank-segment-header">
                <div className="public-bank-segment-title-wrap">
                  <span className="public-bank-segment-eyebrow">Sección del banco</span>
                  <div className="public-bank-segment-active-line">
                    <h2>{selectorCollapsed ? activeSegmentLabel : 'Generales y subtemas'}</h2>
                    <span className="public-bank-segment-summary">
                      {selectorCollapsed
                        ? `${activeSegmentCount} ${activeSegmentCount === 1 ? 'pregunta' : 'preguntas'}`
                        : `${generalCount + subtemasTotalCount} en total · ${generalCount} generales · ${subtemasTotalCount} en subtemas`}
                    </span>
                  </div>
                </div>
                <div className="public-bank-segment-tools">
                  {!selectorCollapsed && subtemas.length > 5 && (
                    <div className="public-bank-segment-search">
                      <Search size={14} aria-hidden="true" />
                      <input
                        type="search"
                        aria-label="Filtrar subtemas"
                        placeholder="Filtrar subtema…"
                        value={subtemaSearch}
                        onChange={event => setSubtemaSearch(event.target.value)}
                      />
                      {subtemaSearch && (
                        <button
                          type="button"
                          className="public-bank-segment-search-clear"
                          aria-label="Limpiar filtro de subtemas"
                          onClick={() => setSubtemaSearch('')}
                        >
                          <X size={13} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  )}
                  <button
                    type="button"
                    className="public-bank-segment-toggle"
                    aria-expanded={!selectorCollapsed}
                    onClick={() => setSelectorCollapsed(prev => !prev)}
                  >
                    {selectorCollapsed ? (
                      <>
                        <span>Cambiar sección</span>
                        <ChevronDown size={15} aria-hidden="true" />
                      </>
                    ) : (
                      <>
                        <span>Ocultar lista</span>
                        <ChevronUp size={15} aria-hidden="true" />
                      </>
                    )}
                  </button>
                </div>
              </div>

              {!selectorCollapsed && (
                <div className="public-bank-segment-body" role="group" aria-label="Selector de generales o subtemas">
                  {/* Bloque destacado: Preguntas generales del tema */}
                  <button
                    type="button"
                    className="public-bank-general-tile"
                    aria-pressed={selectedSegment === GENERAL_KEY}
                    data-filled={generalCount > 0 ? 'true' : 'false'}
                    onClick={() => handleSelectSegment(GENERAL_KEY)}
                  >
                    <span className="pb-general-icon" aria-hidden="true">
                      <Layers size={18} />
                    </span>
                    <span className="pb-general-copy">
                      <strong>Preguntas generales de {tema.nombre}</strong>
                      <small>Preguntas transversales del tema sin subtema específico</small>
                    </span>
                    <span className="pb-tile-badge" data-filled={generalCount > 0 ? 'true' : 'false'}>
                      {generalCount}
                    </span>
                  </button>

                  {/* Cuadrícula limpia de Subtemas */}
                  {subtemas.length > 0 && (
                    <div className="public-bank-subtemas-block">
                      <div className="public-bank-subtemas-label">
                        <span>Subtemas ({subtemas.length})</span>
                        <span>
                          {subtemas.filter(st => {
                            const isCurrent = selectedSegment === String(st.id);
                            return (isCurrent ? questions.length : (subtemaCountMap.get(st.id) ?? 0)) > 0;
                          }).length}{' '}
                          con preguntas
                        </span>
                      </div>

                      {visibleSubtemas.length === 0 ? (
                        <p className="public-bank-subtemas-empty">
                          Ningún subtema coincide con «{subtemaSearch}».
                        </p>
                      ) : (
                        <div className="public-bank-subtemas-grid">
                          {visibleSubtemas.map(st => {
                            const originalIndex = subtemas.findIndex(item => item.id === st.id);
                            const orderNum = String(originalIndex + 1).padStart(2, '0');
                            const isSelected = selectedSegment === String(st.id);
                            const count = isSelected ? questions.length : (subtemaCountMap.get(st.id) ?? 0);
                            return (
                              <button
                                key={st.id}
                                type="button"
                                className="public-bank-subtema-tile"
                                aria-pressed={isSelected}
                                data-filled={count > 0 ? 'true' : 'false'}
                                title={st.nombre}
                                onClick={() => handleSelectSegment(String(st.id))}
                              >
                                <span className="pb-subtema-num" aria-hidden="true">{orderNum}</span>
                                <span className="pb-subtema-name">{st.nombre}</span>
                                <span className="pb-tile-badge" data-filled={count > 0 ? 'true' : 'false'}>
                                  {count}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </section>

            {error && <p role="alert" className="instructor-error">{error}</p>}
            {statusMessage && <p role="status" className="instructor-success">{statusMessage}</p>}

            {loadingSection ? (
              <p role="status" className="instructor-list-loading">
                <LoaderCircle size={20} className="instructor-spin" aria-hidden="true" />
                Cargando preguntas…
              </p>
            ) : (
              <div className="instructor-composer">
                {/* Navegador lateral de preguntas (patrón de Prueba de Instructores) */}
                <aside className="instructor-question-nav" aria-label="Navegación de preguntas">
                  <div className="instructor-row instructor-between instructor-nav-heading">
                    <h3>Preguntas</h3>
                    <span className="instructor-badge">{questions.length}</span>
                  </div>
                  {questions.length > 0 && (
                    <ol className="instructor-question-nav-list">
                      {questions.map((q, idx) => (
                        <li key={q.id}>
                          <button
                            type="button"
                            className="instructor-question-tile"
                            aria-current={idx === activeIndex ? 'page' : undefined}
                            aria-label={`Pregunta ${idx + 1}`}
                            data-empty={!isPublicBankQuestionComplete(q)}
                            onClick={() => setActiveIndex(idx)}
                          >
                            {idx + 1}
                          </button>
                        </li>
                      ))}
                    </ol>
                  )}
                  <button
                    type="button"
                    className="instructor-btn instructor-btn-primary"
                    onClick={addQuestion}
                  >
                    <Plus size={16} aria-hidden="true" />
                    Agregar pregunta
                  </button>
                  <p>
                    {selectedSubtema
                      ? `Editando preguntas específicas del subtema «${selectedSubtema.nombre}».`
                      : `Editando preguntas generales del tema «${tema.nombre}».`}
                  </p>
                </aside>

                {/* Espacio de trabajo de la pregunta activa */}
                <section className="instructor-question-workspace" aria-label="Editor de pregunta activa">
                  {!activeQuestion ? (
                    <div className="instructor-composer-empty">
                      <h3>Aún no hay preguntas en esta sección</h3>
                      <p>
                        Agrega la primera pregunta de selección única para{' '}
                        {selectedSubtema ? `el subtema «${selectedSubtema.nombre}»` : `«${tema.nombre}» (generales)`}.
                      </p>
                      <button
                        type="button"
                        className="instructor-btn instructor-btn-primary"
                        style={{ marginTop: 14 }}
                        onClick={addQuestion}
                      >
                        <Plus size={16} aria-hidden="true" />
                        Crear primera pregunta
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="instructor-row instructor-between instructor-active-question-heading">
                        <div>
                          <h3>Pregunta {activeIndex + 1} de {questions.length}</h3>
                          <p>
                            {selectedSubtema ? `Subtema: ${selectedSubtema.nombre}` : 'General del tema'} · Selección única
                          </p>
                        </div>
                        <div className="instructor-row">
                          <button
                            type="button"
                            className="instructor-btn"
                            onClick={duplicateActiveQuestion}
                            title="Duplicar esta pregunta"
                          >
                            <Copy size={15} aria-hidden="true" />
                            Duplicar
                          </button>
                          <button
                            type="button"
                            className="instructor-btn instructor-btn-danger"
                            onClick={removeActiveQuestion}
                            title="Eliminar esta pregunta"
                          >
                            <Trash2 size={15} aria-hidden="true" />
                            Eliminar
                          </button>
                        </div>
                      </div>

                      {/* Mover entre Generales y Subtemas del mismo tema */}
                      {subtemas.length > 0 && !dirty && (
                        <div className="instructor-row" style={{ marginBottom: 16 }}>
                          <label className="instructor-label" style={{ margin: 0, flex: '1 1 260px' }}>
                            Mover esta pregunta a otra sección del tema
                            <div className="instructor-row">
                              <select
                                className="instructor-input"
                                aria-label="Sección destino dentro del tema"
                                defaultValue=""
                                disabled={moving}
                                onChange={event => {
                                  const raw = event.target.value;
                                  if (!raw) return;
                                  event.target.value = '';
                                  void handleMoveQuestion(raw === GENERAL_KEY ? null : Number(raw));
                                }}
                              >
                                <option value="">Seleccionar destino…</option>
                                {selectedSubtemaId !== null && (
                                  <option value={GENERAL_KEY}>Preguntas generales del tema</option>
                                )}
                                {subtemas
                                  .filter(st => st.id !== selectedSubtemaId)
                                  .map(st => (
                                    <option key={st.id} value={String(st.id)}>
                                      Subtema: {st.nombre}
                                    </option>
                                  ))}
                              </select>
                              {moving && <LoaderCircle size={18} className="instructor-spin" aria-hidden="true" />}
                            </div>
                          </label>
                        </div>
                      )}

                      {/* Enunciado */}
                      <div className="instructor-label">
                        <span>Enunciado de la pregunta</span>
                        <div className="public-bank-rich-box">
                          <TestRichTextField
                            key={`titulo-${activeQuestion.id}`}
                            value={activeQuestion.titulo}
                            onChange={val => updateActiveQuestion(q => ({ ...q, titulo: val }))}
                            placeholder="Escribe la pregunta para el estudiante…"
                            ariaLabel={`Enunciado de la pregunta ${activeIndex + 1}`}
                          />
                        </div>
                      </div>

                      {/* Imagen de referencia y señalado */}
                      <div className="public-bank-ref-box">
                        <div className="instructor-row instructor-between">
                          <div>
                            <strong style={{ fontSize: '0.86rem', color: 'var(--pb-ink)' }}>
                              Imagen de referencia (opcional)
                            </strong>
                            <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: 'var(--pb-muted)' }}>
                              Elige una placa del Atlas o sube una imagen propia y coloca opcionalmente un señalado.
                            </p>
                          </div>
                          <div className="instructor-row">
                            <button type="button" className="instructor-btn" onClick={() => void openPlatePicker()}>
                              <ImageIcon size={15} aria-hidden="true" />
                              Elegir placa
                            </button>
                            <button
                              type="button"
                              className="instructor-btn"
                              onClick={() => fileInputRef.current?.click()}
                            >
                              <Upload size={15} aria-hidden="true" />
                              Subir imagen
                            </button>
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="image/*"
                              style={{ display: 'none' }}
                              onChange={handleUploadImageChange}
                            />
                          </div>
                        </div>

                        {activeQuestion.reference_photo_url && (
                          <div className="public-bank-ref-preview">
                            <div className="public-bank-ref-thumb">
                              <img
                                src={
                                  activeQuestion.reference_photo_url.startsWith('blob:')
                                    ? activeQuestion.reference_photo_url
                                    : getCloudinaryImageUrl(activeQuestion.reference_photo_url, 'cardWide')
                                }
                                alt="Referencia de la pregunta"
                              />
                            </div>
                            <div className="public-bank-ref-meta">
                              <p>
                                <strong>Origen:</strong>{' '}
                                {activeQuestion.reference_placa_id
                                  ? `Placa del catálogo #${activeQuestion.reference_placa_id}`
                                  : 'Imagen propia en R2'}
                              </p>
                              <p>
                                <strong>Señalado:</strong>{' '}
                                {activeQuestion.reference_senalado ? 'Configurado sobre la imagen' : 'Sin señalado'}
                              </p>
                              <div className="instructor-row">
                                <button
                                  type="button"
                                  className="instructor-btn"
                                  onClick={() => setShowMarkerPicker(true)}
                                >
                                  <MapPin size={15} aria-hidden="true" />
                                  {activeQuestion.reference_senalado ? 'Editar señalado' : 'Colocar señalado'}
                                </button>
                                <button
                                  type="button"
                                  className="instructor-btn instructor-btn-danger"
                                  onClick={() => {
                                    const pending = pendingUploads.current.get(activeQuestion.id);
                                    if (pending) {
                                      URL.revokeObjectURL(pending.previewUrl);
                                      pendingUploads.current.delete(activeQuestion.id);
                                    }
                                    updateActiveQuestion(q => ({
                                      ...q,
                                      reference_placa_id: null,
                                      reference_photo_url: null,
                                      reference_tema_name: null,
                                      reference_subtema_name: null,
                                      reference_senalado: null,
                                    }));
                                  }}
                                >
                                  <X size={15} aria-hidden="true" />
                                  Quitar imagen
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Opciones de respuesta */}
                      <div className="instructor-answer-heading">
                        <h4>Opciones de respuesta (selección única)</h4>
                        <p>Marca el círculo de la opción correcta. Puedes tener entre 2 y 8 opciones.</p>
                      </div>

                      {activeQuestion.options.map((option, optIndex) => (
                        <div
                          key={option.id}
                          className={`instructor-option instructor-choice-edit${option.is_correct ? ' is-correct' : ''}`}
                        >
                          <input
                            type="radio"
                            name={`correct-option-${activeQuestion.id}`}
                            aria-label={`Marcar opción ${optIndex + 1} como correcta`}
                            checked={option.is_correct}
                            onChange={() =>
                              updateActiveQuestion(q => ({
                                ...q,
                                options: q.options.map(o => ({ ...o, is_correct: o.id === option.id })),
                              }))
                            }
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <TestRichTextField
                              key={`opt-${option.id}`}
                              value={option.texto}
                              singleLine
                              placeholder={`Opción ${optIndex + 1}`}
                              ariaLabel={`Texto de la opción ${optIndex + 1}`}
                              onChange={val =>
                                updateActiveQuestion(q => ({
                                  ...q,
                                  options: q.options.map(o => (o.id === option.id ? { ...o, texto: val } : o)),
                                }))
                              }
                            />
                          </div>
                          {activeQuestion.options.length > 2 && (
                            <button
                              type="button"
                              className="instructor-btn instructor-btn-ghost instructor-btn-icon"
                              aria-label={`Eliminar opción ${optIndex + 1}`}
                              onClick={() =>
                                updateActiveQuestion(q => {
                                  const remaining = q.options.filter(o => o.id !== option.id);
                                  if (!remaining.some(o => o.is_correct) && remaining.length > 0) {
                                    remaining[0] = { ...remaining[0], is_correct: true };
                                  }
                                  return { ...q, options: remaining };
                                })
                              }
                            >
                              <Trash2 size={15} aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      ))}

                      {activeQuestion.options.length < 8 && (
                        <button
                          type="button"
                          className="instructor-btn"
                          style={{ marginTop: 8 }}
                          onClick={() =>
                            updateActiveQuestion(q => ({
                              ...q,
                              options: [...q.options, createBlankPublicBankOption(q.options.length, false)],
                            }))
                          }
                        >
                          <Plus size={15} aria-hidden="true" />
                          Añadir opción
                        </button>
                      )}

                      {/* Retroalimentación */}
                      <div className="instructor-label" style={{ marginTop: 22 }}>
                        <span>Retroalimentación para el estudiante (se muestra al responder)</span>
                        <div className="public-bank-rich-box">
                          <TestRichTextField
                            key={`retro-${activeQuestion.id}`}
                            value={activeQuestion.retroalimentacion}
                            onChange={val => updateActiveQuestion(q => ({ ...q, retroalimentacion: val }))}
                            placeholder="Explica brevemente por qué esta es la respuesta correcta…"
                            ariaLabel={`Retroalimentación de la pregunta ${activeIndex + 1}`}
                          />
                        </div>
                      </div>

                      {/* Paginador Anterior / Siguiente */}
                      <div className="instructor-row instructor-between instructor-question-pager">
                        <button
                          type="button"
                          className="instructor-btn"
                          disabled={activeIndex === 0}
                          onClick={() => setActiveIndex(prev => Math.max(0, prev - 1))}
                        >
                          <ChevronLeft size={16} aria-hidden="true" />
                          Anterior
                        </button>
                        <span>{activeIndex + 1} / {questions.length}</span>
                        <button
                          type="button"
                          className="instructor-btn"
                          disabled={activeIndex >= questions.length - 1}
                          onClick={() => setActiveIndex(prev => Math.min(questions.length - 1, prev + 1))}
                        >
                          Siguiente
                          <ChevronRight size={16} aria-hidden="true" />
                        </button>
                      </div>
                    </>
                  )}
                </section>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Modal selector de placa del Atlas */}
      {showPlatePicker && activeQuestion && (
        <div className="public-bank-modal-backdrop" role="dialog" aria-modal="true" aria-label="Seleccionar placa del Atlas">
          <div className="public-bank-modal">
            <div className="instructor-row instructor-between">
              <h3 style={{ margin: 0 }}>Elegir placa de «{tema.nombre}»</h3>
              <button type="button" className="instructor-btn instructor-btn-ghost" onClick={() => setShowPlatePicker(false)}>
                <X size={18} aria-hidden="true" />
                Cerrar
              </button>
            </div>
            {subtemas.length > 0 && (
              <label className="instructor-label" style={{ margin: 0 }}>
                Filtrar por subtema
                <select
                  className="instructor-input"
                  value={pickerSubtemaId ?? ''}
                  onChange={event => {
                    const val = event.target.value ? Number(event.target.value) : null;
                    setPickerSubtemaId(val);
                    if (val) void loadPlacasForSubtema(val);
                    else void loadPlacasForTema();
                  }}
                >
                  <option value="">Todos los subtemas del tema</option>
                  {subtemas.map(st => (
                    <option key={st.id} value={st.id}>{st.nombre}</option>
                  ))}
                </select>
              </label>
            )}
            {loadingPlacas ? (
              <p className="instructor-list-loading">
                <LoaderCircle size={18} className="instructor-spin" aria-hidden="true" />
                Cargando placas…
              </p>
            ) : pickerPlacas.length === 0 ? (
              <p className="instructor-muted">No se encontraron placas en este filtro.</p>
            ) : (
              <div className="public-bank-plate-grid">
                {pickerPlacas.map(placa => (
                  <button
                    key={placa.id}
                    type="button"
                    className="public-bank-plate-btn"
                    onClick={() => {
                      const stName = subtemas.find(st => st.id === placa.subtema_id)?.nombre ?? null;
                      updateActiveQuestion(q => ({
                        ...q,
                        reference_placa_id: placa.id,
                        reference_photo_url: placa.photo_url,
                        reference_tema_name: tema.nombre,
                        reference_subtema_name: stName,
                        reference_senalado: null,
                      }));
                      setShowPlatePicker(false);
                    }}
                  >
                    <img src={getCloudinaryImageUrl(placa.photo_url, 'thumb')} alt={`Placa ${placa.id}`} loading="lazy" />
                    <span style={{ fontSize: '0.76rem', color: 'var(--pb-muted)' }}>Placa #{placa.id}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Editor de señalado sobre la imagen de referencia */}
      {showMarkerPicker && activeQuestion?.reference_photo_url && (
        <SenaladoLocationPicker
          imageSrc={activeQuestion.reference_photo_url}
          senaladoLabel={`Señalado · Pregunta ${activeIndex + 1}`}
          initialLocation={activeQuestion.reference_senalado}
          onCancel={() => setShowMarkerPicker(false)}
          onSave={(loc: MarkerLocation | null) => {
            updateActiveQuestion(q => ({ ...q, reference_senalado: loc }));
            setShowMarkerPicker(false);
          }}
        />
      )}
    </div>
  );
}
