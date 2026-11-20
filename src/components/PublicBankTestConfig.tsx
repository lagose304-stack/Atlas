import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, Check, Circle, Info, LoaderCircle, Save, Shuffle, Upload, X,
} from 'lucide-react';
import type { CatalogSubtema, CatalogTema } from '../services/catalogService';
import { getCachedSubtemas } from '../services/catalogService';
import { uploadToCloudinary } from '../services/cloudinary';
import { getCloudinaryImageUrl } from '../services/cloudinaryImages';
import { savePublicBankTest } from '../services/publicTestsBank';
import {
  calculateExpectedBankTestCount,
  type PublicBankConfig,
  type PublicBankTestRow,
  type PublicBankTopicSummary,
} from '../types/publicQuestionBank';
import { groupTemasByParcial } from '../utils/instructorTopics';

interface PublicBankTestConfigProps {
  existingTest: PublicBankTestRow | null;
  defaultTemaId?: number | null;
  temas: CatalogTema[];
  usedTemaIds: Set<number>;
  bankSummaryByTema: Map<number, PublicBankTopicSummary>;
  onSaved: (saved: PublicBankTestRow, message: string) => void;
  onClose: () => void;
}

export default function PublicBankTestConfig({
  existingTest,
  defaultTemaId = null,
  temas,
  usedTemaIds,
  bankSummaryByTema,
  onSaved,
  onClose,
}: PublicBankTestConfigProps) {
  const availableTemas = useMemo(() => {
    if (existingTest?.tema_id) {
      return temas.filter(t => t.id === existingTest.tema_id);
    }
    return temas.filter(t => !usedTemaIds.has(t.id));
  }, [temas, usedTemaIds, existingTest?.tema_id]);

  const initialTema = useMemo(() => {
    if (existingTest?.tema_id) {
      return temas.find(t => t.id === existingTest.tema_id) ?? null;
    }
    if (defaultTemaId && availableTemas.some(t => t.id === defaultTemaId)) {
      return availableTemas.find(t => t.id === defaultTemaId) ?? null;
    }
    return availableTemas[0] ?? null;
  }, [existingTest?.tema_id, defaultTemaId, availableTemas, temas]);

  const [temaId, setTemaId] = useState<number | null>(initialTema?.id ?? null);
  const [nombre, setNombre] = useState(
    existingTest?.nombre ?? (initialTema ? `Prueba de ${initialTema.nombre}` : ''),
  );
  const [instrucciones, setInstrucciones] = useState(
    existingTest?.instrucciones ?? 'Responde cada pregunta seleccionando la opción correcta. Recibirás retroalimentación inmediata al avanzar.',
  );
  const [imageUrl, setImageUrl] = useState<string | null>(existingTest?.image_url ?? null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const initialGeneralAvailable = initialTema ? (bankSummaryByTema.get(initialTema.id)?.general_count ?? 0) : 0;
  const initialConfig: PublicBankConfig = existingTest?.bank_config ?? {
    general_count: Math.min(5, initialGeneralAvailable),
    subtema_counts: {},
    shuffle_options: true,
    shuffle_questions: true,
  };
  const [generalCount, setGeneralCount] = useState<number>(
    Math.min(initialConfig.general_count ?? 0, initialGeneralAvailable),
  );
  const [subtemaCounts, setSubtemaCounts] = useState<Record<string, number>>(initialConfig.subtema_counts ?? {});
  const [shuffleOptions, setShuffleOptions] = useState<boolean>(initialConfig.shuffle_options ?? true);
  const [shuffleQuestions, setShuffleQuestions] = useState<boolean>(initialConfig.shuffle_questions ?? true);
  const [bulkSubtemaValue, setBulkSubtemaValue] = useState<string>('2');

  const [subtemas, setSubtemas] = useState<CatalogSubtema[]>([]);
  const [loadingSubtemas, setLoadingSubtemas] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  useEffect(() => {
    if (!temaId) {
      setSubtemas([]);
      return;
    }
    let cancelled = false;
    setLoadingSubtemas(true);
    void getCachedSubtemas(temaId).then(list => {
      if (!cancelled) setSubtemas(list);
    }).catch(() => {
      if (!cancelled) setSubtemas([]);
    }).finally(() => {
      if (!cancelled) setLoadingSubtemas(false);
    });
    return () => { cancelled = true; };
  }, [temaId]);

  const selectedTema = useMemo(() => temas.find(t => t.id === temaId) ?? null, [temas, temaId]);
  const summary = temaId ? bankSummaryByTema.get(temaId) : undefined;
  const maxGeneralCount = summary?.general_count ?? 0;
  const subtemaAvailMap = useMemo(
    () => new Map((summary?.subtemas ?? []).map(s => [s.subtema_id, s.count])),
    [summary],
  );

  // Acotar valores guardados si el banco disminuyó o cambió el tema seleccionado
  const clampedGeneralCount = Math.max(0, Math.min(maxGeneralCount, Math.floor(generalCount || 0)));
  const clampedSubtemaCounts = useMemo(() => {
    const next: Record<string, number> = {};
    for (const [key, rawVal] of Object.entries(subtemaCounts)) {
      const avail = subtemaAvailMap.get(Number(key)) ?? 0;
      const clamped = Math.max(0, Math.min(avail, Math.floor(Number(rawVal) || 0)));
      if (clamped > 0) next[key] = clamped;
    }
    return next;
  }, [subtemaCounts, subtemaAvailMap]);

  const currentConfig: PublicBankConfig = useMemo(() => ({
    general_count: clampedGeneralCount,
    subtema_counts: clampedSubtemaCounts,
    shuffle_options: shuffleOptions,
    shuffle_questions: shuffleQuestions,
  }), [clampedGeneralCount, clampedSubtemaCounts, shuffleOptions, shuffleQuestions]);

  const { configured, available } = useMemo(
    () => calculateExpectedBankTestCount(currentConfig, summary),
    [currentConfig, summary],
  );

  const groupedAvailableTemas = useMemo(() => groupTemasByParcial(availableTemas), [availableTemas]);

  const handleSelectTema = (nextTemaId: number) => {
    setTemaId(nextTemaId);
    const nextMaxGeneral = bankSummaryByTema.get(nextTemaId)?.general_count ?? 0;
    setGeneralCount(Math.min(5, nextMaxGeneral));
    setSubtemaCounts({});
    if (!existingTest) {
      const nextTema = temas.find(t => t.id === nextTemaId);
      if (nextTema) setNombre(`Prueba de ${nextTema.nombre}`);
    }
  };

  const applyBulkToSubtemas = () => {
    const num = Math.max(0, Math.min(200, Math.floor(Number(bulkSubtemaValue) || 0)));
    const next: Record<string, number> = {};
    subtemas.forEach(st => {
      const avail = subtemaAvailMap.get(st.id) ?? 0;
      if (avail > 0) {
        next[String(st.id)] = Math.min(num, avail);
      }
    });
    setSubtemaCounts(next);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || !temaId) return;
    if (!nombre.trim()) {
      setError('Escribe un nombre para la prueba.');
      return;
    }
    if (configured < 1) {
      setError('Configura al menos 1 pregunta general o de subtema antes de guardar.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      let finalImageUrl = imageUrl;
      if (imageFile) {
        const uploaded = await uploadToCloudinary(imageFile, {
          folder: `pruebas/portadas/tema-${temaId}`,
          optimizeImage: true,
        });
        if (typeof uploaded.secure_url !== 'string' || !uploaded.secure_url.startsWith('https://')) {
          throw new Error('No se pudo confirmar la portada subida a R2.');
        }
        finalImageUrl = uploaded.secure_url;
      }

      const saved = await savePublicBankTest({
        id: existingTest?.id ?? null,
        temaId,
        nombre: nombre.trim(),
        instrucciones: instrucciones.trim(),
        imageUrl: finalImageUrl,
        bankConfig: currentConfig,
        revision: existingTest?.revision ?? null,
      });

      onSaved(
        saved,
        existingTest
          ? `Configuración de «${saved.nombre}» actualizada.`
          : `Prueba «${saved.nombre}» creada en borrador. Publícala cuando esté lista.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la configuración de la prueba.');
    } finally {
      setSaving(false);
    }
  };

  const activePreviewUrl = imagePreview || (imageUrl ? getCloudinaryImageUrl(imageUrl, 'cardWide') : null);

  return (
    <div className="instructor-page instructor-editor-scope instructor-focus-mode public-bank-scope">
      <main className="instructor-main">
        <form className="instructor-panel instructor-edit-surface" onSubmit={event => void handleSave(event)}>
          <fieldset disabled={saving} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
            <header className="instructor-editor-topbar">
              <button
                type="button"
                className="instructor-btn instructor-btn-ghost instructor-editor-back"
                onClick={onClose}
                aria-label="Volver al listado"
              >
                <ArrowLeft size={20} aria-hidden="true" />
                <span>Volver</span>
              </button>
              <div className="instructor-editor-document">
                <h2>{existingTest ? 'Editar prueba de tema' : 'Nueva prueba por tema (banco en vivo)'}</h2>
                <h1>{nombre.trim() || selectedTema?.nombre || 'Configuración de prueba'}</h1>
              </div>
              <div className="instructor-editor-top-actions">
                <span className="instructor-save-state" data-dirty={configured > 0}>
                  {configured > 0 ? <Check size={15} aria-hidden="true" /> : <Circle size={12} aria-hidden="true" />}
                  {available} {available === 1 ? 'pregunta saldrá' : 'preguntas saldrán'} hoy
                </span>
                <button
                  type="submit"
                  className="instructor-btn instructor-btn-primary"
                  disabled={saving || !temaId || !nombre.trim() || configured < 1}
                >
                  {saving ? <LoaderCircle size={17} className="instructor-spin" aria-hidden="true" /> : <Save size={17} aria-hidden="true" />}
                  {saving ? 'Guardando…' : 'Guardar configuración'}
                </button>
              </div>
            </header>

            <div className="instructor-editor-body">
              <div className="instructor-workflow-note">
                <Info size={16} aria-hidden="true" />
                <p>
                  Solo se permite una prueba por tema. Cada estudiante recibirá preguntas aleatorias tomadas en vivo del banco de este tema, con calificación inmediata al avanzar.
                </p>
              </div>

              {error && <p role="alert" className="instructor-error">{error}</p>}

              {!existingTest && availableTemas.length === 0 ? (
                <div className="instructor-list-empty">
                  <h3>Todos los temas ya tienen una prueba configurada</h3>
                  <p>Edita la configuración de cualquier tema desde la pestaña «Pruebas por tema».</p>
                </div>
              ) : (
                <>
                  <section className="instructor-settings-card" aria-label="Datos generales de la prueba">
                    <label className="instructor-label">
                      Tema de la prueba (máximo 1 prueba por tema)
                      <select
                        className="instructor-input"
                        value={temaId ?? ''}
                        disabled={Boolean(existingTest)}
                        onChange={event => handleSelectTema(Number(event.target.value))}
                      >
                        {groupedAvailableTemas.map(group => (
                          <optgroup key={group.parcial} label={group.label}>
                            {group.temas.map(t => (
                              <option key={t.id} value={t.id}>
                                {t.nombre} ({bankSummaryByTema.get(t.id)?.total_count ?? 0} preguntas en banco)
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </label>

                    <label className="instructor-label">
                      Nombre de la prueba
                      <input
                        className="instructor-input"
                        value={nombre}
                        required
                        maxLength={400}
                        onChange={event => setNombre(event.target.value)}
                      />
                    </label>

                    <label className="instructor-label">
                      Instrucciones para el estudiante
                      <textarea
                        className="instructor-input"
                        value={instrucciones}
                        maxLength={10000}
                        onChange={event => setInstrucciones(event.target.value)}
                      />
                    </label>

                    <div className="public-bank-ref-box" style={{ marginBottom: 8 }}>
                      <div className="instructor-row instructor-between">
                        <div>
                          <strong style={{ fontSize: '0.84rem', color: 'var(--pb-ink)' }}>Portada de la prueba (opcional)</strong>
                          <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--pb-muted)' }}>
                            Si no subes una portada, se usará automáticamente el logo del tema.
                          </p>
                        </div>
                        <div className="instructor-row">
                          <button type="button" className="instructor-btn" onClick={() => fileInputRef.current?.click()}>
                            <Upload size={15} aria-hidden="true" />
                            {activePreviewUrl ? 'Cambiar portada' : 'Subir portada'}
                          </button>
                          {activePreviewUrl && (
                            <button
                              type="button"
                              className="instructor-btn instructor-btn-danger"
                              onClick={() => {
                                if (imagePreview) URL.revokeObjectURL(imagePreview);
                                setImagePreview(null);
                                setImageFile(null);
                                setImageUrl(null);
                              }}
                            >
                              <X size={15} aria-hidden="true" />
                              Quitar
                            </button>
                          )}
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={handleFileChange}
                          />
                        </div>
                      </div>
                      {activePreviewUrl && (
                        <div className="public-bank-ref-thumb" style={{ width: 150 }}>
                          <img src={activePreviewUrl} alt="Vista previa de portada" />
                        </div>
                      )}
                    </div>
                  </section>

                  <section className="instructor-settings-card" aria-label="Selección aleatoria desde el banco">
                    <div className="instructor-setting-heading" style={{ marginTop: 14 }}>
                      <span className="instructor-setting-icon"><Shuffle size={20} aria-hidden="true" /></span>
                      <div>
                        <h4>Cantidad de preguntas aleatorias por intento</h4>
                        <p>
                          Define cuántas preguntas generales del tema y cuántas específicas de cada subtema saldrán al estudiante (como máximo las disponibles actualmente en el banco).
                        </p>
                      </div>
                      <span className="instructor-badge">
                        Total por intento: {available}
                      </span>
                    </div>

                    {/* Preguntas generales del tema */}
                    <div className="public-bank-subtema-row" style={{ marginBottom: 18 }}>
                      <div>
                        <strong>Preguntas generales del tema</strong>
                        <small>
                          {maxGeneralCount > 0
                            ? `Preguntas de «${selectedTema?.nombre ?? 'este tema'}» no ligadas a un subtema específico.`
                            : 'Sin preguntas generales en el banco aún.'}
                        </small>
                      </div>
                      <span className="instructor-badge">
                        {maxGeneralCount} disponibles
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={maxGeneralCount}
                        disabled={maxGeneralCount === 0}
                        className="instructor-input"
                        aria-label="Cantidad de preguntas generales del tema"
                        value={clampedGeneralCount}
                        onChange={event =>
                          setGeneralCount(
                            Math.max(0, Math.min(maxGeneralCount, Math.floor(Number(event.target.value) || 0))),
                          )
                        }
                      />
                    </div>

                    {/* Preguntas específicas por subtema */}
                    <div className="instructor-row instructor-between" style={{ marginBottom: 8 }}>
                      <strong style={{ fontSize: '0.88rem', color: 'var(--pb-ink)' }}>
                        Preguntas específicas por subtema ({subtemas.length})
                      </strong>
                      {subtemas.length > 0 && (
                        <div className="instructor-row" style={{ gap: 8 }}>
                          <input
                            type="number"
                            min={0}
                            max={200}
                            className="instructor-input"
                            style={{ width: 78, padding: '8px 10px' }}
                            aria-label="Cantidad rápida para todos los subtemas con preguntas"
                            value={bulkSubtemaValue}
                            onChange={event => setBulkSubtemaValue(event.target.value)}
                          />
                          <button type="button" className="instructor-btn" onClick={applyBulkToSubtemas}>
                            Aplicar a subtemas con preguntas
                          </button>
                        </div>
                      )}
                    </div>

                    {loadingSubtemas ? (
                      <p className="instructor-list-loading">
                        <LoaderCircle size={18} className="instructor-spin" aria-hidden="true" />
                        Cargando subtemas…
                      </p>
                    ) : subtemas.length === 0 ? (
                      <p className="instructor-muted">Este tema no tiene subtemas registrados.</p>
                    ) : (
                      <div className="public-bank-subtema-list">
                        {subtemas.map(st => {
                          const avail = subtemaAvailMap.get(st.id) ?? 0;
                          const val = clampedSubtemaCounts[String(st.id)] ?? 0;
                          return (
                            <div key={st.id} className="public-bank-subtema-row">
                              <div>
                                <strong>{st.nombre}</strong>
                                <small>{avail > 0 ? 'Con preguntas en el banco' : 'Sin preguntas en el banco aún'}</small>
                              </div>
                              <span className="instructor-badge">{avail} disponibles</span>
                              <input
                                type="number"
                                min={0}
                                max={avail}
                                disabled={avail === 0}
                                className="instructor-input"
                                aria-label={`Cantidad de preguntas para ${st.nombre}`}
                                value={val}
                                onChange={event => {
                                  const nextNum = Math.max(0, Math.min(avail, Math.floor(Number(event.target.value) || 0)));
                                  setSubtemaCounts(prev => ({ ...prev, [String(st.id)]: nextNum }));
                                }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="instructor-row" style={{ marginTop: 20, gap: 20 }}>
                      <label className="instructor-row" style={{ gap: 8, fontSize: '0.84rem', color: 'var(--pb-ink)', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={shuffleQuestions}
                          onChange={event => setShuffleQuestions(event.target.checked)}
                        />
                        <span>Mezclar el orden de las preguntas en cada intento</span>
                      </label>
                      <label className="instructor-row" style={{ gap: 8, fontSize: '0.84rem', color: 'var(--pb-ink)', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={shuffleOptions}
                          onChange={event => setShuffleOptions(event.target.checked)}
                        />
                        <span>Mezclar el orden de las opciones de respuesta</span>
                      </label>
                    </div>
                  </section>
                </>
              )}
            </div>
          </fieldset>
        </form>
      </main>
    </div>
  );
}
