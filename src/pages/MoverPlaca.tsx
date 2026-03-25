import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import BackButton from '../components/BackButton';
import Header from '../components/Header';
import Footer from '../components/Footer';
import LoadingToast from '../components/LoadingToast';
import BoldField from '../components/BoldField';
import SenaladoLocationPicker from '../components/SenaladoLocationPicker';
import RequiredTextPromptModal from '../components/RequiredTextPromptModal';
import { getCloudinaryImageUrl } from '../services/cloudinaryImages';
import { useAuth } from '../contexts/AuthContext';
import { logPlateActivity } from '../services/plateActivityAudit';
import { useSmartBackNavigation } from '../hooks/useSmartBackNavigation';

interface Tema {
  id: number;
  nombre: string;
  parcial: string;
  sort_order: number;
}

interface Subtema {
  id: number;
  nombre: string;
  tema_id: number;
}

interface Placa {
  id: number;
  photo_url: string;
  sort_order: number;
  tema_id: number;
  subtema_id: number;
  aumento?: string | null;
  senalados?: string[] | null;
  senalados_meta?: SenaladoMetaItem[] | null;
  comentario?: string | null;
  tincion?: string | null;
}

interface MarkerLocation {
  x: number;
  y: number;
}

interface SenaladoMetaItem {
  label: string;
  x: number | null;
  y: number | null;
}

type ParcialKey = 'primer' | 'segundo' | 'tercer';

const PARCIALES: { key: ParcialKey; label: string }[] = [
  { key: 'primer',  label: 'Primer parcial'  },
  { key: 'segundo', label: 'Segundo parcial' },
  { key: 'tercer',  label: 'Tercer parcial'  },
];

const normalizeLocations = (values: Array<MarkerLocation | null>): Array<MarkerLocation | null> => {
  return values.map(value => {
    if (!value) return null;
    const x = Number(value.x);
    const y = Number(value.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return {
      x: Math.min(Math.max(x, 0), 1),
      y: Math.min(Math.max(y, 0), 1),
    };
  });
};

const buildSenaladosPayload = (
  names: string[],
  locations: Array<MarkerLocation | null>
): { labels: string[]; meta: SenaladoMetaItem[]; error?: string; firstMissingLocationIndex?: number } => {
  const labels: string[] = [];
  const meta: SenaladoMetaItem[] = [];
  const safeLocations = normalizeLocations(locations);

  const total = Math.max(names.length, safeLocations.length);
  for (let index = 0; index < total; index++) {
    const name = names[index] ?? '';
    const label = name.trim();
    const location = safeLocations[index] ?? null;

    const hasLabel = label !== '';
    const hasLocation = location !== null;

    if (!hasLabel && !hasLocation) continue;

    if (!hasLocation) {
      return {
        labels: [],
        meta: [],
        error: `Debes ubicar el señalado ${index + 1} antes de guardar.`,
        firstMissingLocationIndex: index,
      };
    }

    if (!hasLabel) {
      return {
        labels: [],
        meta: [],
        error: `Debes escribir el nombre del señalado ${index + 1}.`,
      };
    }

    labels.push(label);
    meta.push({
      label,
      x: location?.x ?? null,
      y: location?.y ?? null,
    });
  }

  return { labels, meta };
};

const deriveLocations = (
  names: string[],
  meta: SenaladoMetaItem[] | null | undefined
): Array<MarkerLocation | null> => {
  return names.map((_, index) => {
    const item = meta?.[index];
    if (!item || item.x == null || item.y == null) return null;
    return { x: item.x, y: item.y };
  });
};

const MoverPlaca: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // ── Selección de contexto (tema/subtema de búsqueda) ──────────────────
  const [temas,    setTemas]    = useState<Tema[]>([]);
  const [subtemas, setSubtemas] = useState<Subtema[]>([]);
  const [placas,   setPlacas]   = useState<Placa[]>([]);

  const [selectedTemaId,    setSelectedTemaId]    = useState<number | null>(null);
  const [selectedSubtemaId, setSelectedSubtemaId] = useState<number | null>(null);

  const [loadingTemas,    setLoadingTemas]    = useState(true);
  const [loadingSubtemas, setLoadingSubtemas] = useState(false);
  const [loadingPlacas,   setLoadingPlacas]   = useState(false);

  const [hoveredCard, setHoveredCard] = useState<number | null>(null);

  // ── Placa seleccionada para editar ────────────────────────────────────
  const [selectedPlaca, setSelectedPlaca] = useState<Placa | null>(null);

  // ── Selectores del panel de edición ──────────────────────────────────
  const [editTemas,    setEditTemas]    = useState<Tema[]>([]);
  const [editSubtemas, setEditSubtemas] = useState<Subtema[]>([]);

  const [editTemaId,    setEditTemaId]    = useState<number | null>(null);
  const [editSubtemaId, setEditSubtemaId] = useState<number | null>(null);

  const [loadingEditSubtemas, setLoadingEditSubtemas] = useState(false);

  // ── Campos editables adicionales ─────────────────────────────────────
  const [editAumento,       setEditAumento]       = useState('');
  const [editSenalados,     setEditSenalados]     = useState<string[]>([]);
  const [editSenaladosPos,  setEditSenaladosPos]  = useState<Array<MarkerLocation | null>>([]);
  const [editingSenaladoIndex, setEditingSenaladoIndex] = useState<number | null>(null);
  const [namingSenaladoIndex, setNamingSenaladoIndex] = useState<number | null>(null);
  const [forceLocationAssignment, setForceLocationAssignment] = useState(false);
  const [editComentario,    setEditComentario]    = useState('');
  const [showEditComentario, setShowEditComentario] = useState(false);
  const [editTincion,       setEditTincion]       = useState('');
  const [showEditTincion,   setShowEditTincion]   = useState(false);

  const [isSaving,    setIsSaving]    = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError,   setSaveError]   = useState('');

  // ── Cargar temas al montar ────────────────────────────────────────────
  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('temas')
        .select('id, nombre, parcial, sort_order')
        .order('parcial')
        .order('sort_order', { ascending: true });
      if (data) {
        setTemas(data);
        setEditTemas(data); // misma lista para el panel de edición
      }
      setLoadingTemas(false);
    };
    fetch();
  }, []);

  // ── Cargar subtemas de contexto cuando cambia el tema ─────────────────
  useEffect(() => {
    setSubtemas([]);
    setPlacas([]);
    setSelectedSubtemaId(null);
    setSelectedPlaca(null);
    if (!selectedTemaId) return;
    const fetch = async () => {
      setLoadingSubtemas(true);
      const { data } = await supabase
        .from('subtemas')
        .select('id, nombre, tema_id')
        .eq('tema_id', selectedTemaId)
        .order('sort_order', { ascending: true });
      if (data) setSubtemas(data);
      setLoadingSubtemas(false);
    };
    fetch();
  }, [selectedTemaId]);

  // ── Cargar placas cuando cambia el subtema de contexto ────────────────
  useEffect(() => {
    setPlacas([]);
    setSelectedPlaca(null);
    if (!selectedSubtemaId) return;
    const fetch = async () => {
      setLoadingPlacas(true);
      const { data } = await supabase
        .from('placas')
        .select('id, photo_url, sort_order, tema_id, subtema_id, aumento, senalados, senalados_meta, comentario, tincion')
        .eq('subtema_id', selectedSubtemaId)
        .order('sort_order', { ascending: true });
      if (data) setPlacas(data);
      setLoadingPlacas(false);
    };
    fetch();
  }, [selectedSubtemaId]);

  // ── Cuando se selecciona una placa, inicializar los selectores de edición ──
  useEffect(() => {
    if (!selectedPlaca) {
      setEditTemaId(null);
      setEditSubtemaId(null);
      setEditSubtemas([]);
      setEditAumento('');
      setEditSenalados([]);
      setEditSenaladosPos([]);
      setEditingSenaladoIndex(null);
      setNamingSenaladoIndex(null);
      setForceLocationAssignment(false);
      setEditComentario('');
      setShowEditComentario(false);
      setEditTincion('');
      setShowEditTincion(false);
      return;
    }
    setEditTemaId(selectedPlaca.tema_id);
    setEditSubtemaId(selectedPlaca.subtema_id);
    setEditAumento(selectedPlaca.aumento ?? '');
    const nextNames = selectedPlaca.senalados ? [...selectedPlaca.senalados] : [];
    const nextLocations = deriveLocations(nextNames, selectedPlaca.senalados_meta ?? null);
    setEditSenalados(nextNames);
    setEditSenaladosPos(nextLocations);

    const firstMissingLocationIndex = nextNames.findIndex((label, index) => {
      return label.trim() !== '' && !nextLocations[index];
    });
    if (firstMissingLocationIndex >= 0) {
      setEditingSenaladoIndex(firstMissingLocationIndex);
      setForceLocationAssignment(true);
      setSaveError('Esta placa tiene señalados sin ubicación. Debes ubicarlos para continuar.');
    } else {
      setForceLocationAssignment(false);
    }

    setEditComentario(selectedPlaca.comentario ?? '');
    setShowEditComentario(!!(selectedPlaca.comentario));
    setEditTincion(selectedPlaca.tincion ?? '');
    setShowEditTincion(!!(selectedPlaca.tincion));
    // Cargar subtemas del tema actual de la placa
    const fetch = async () => {
      setLoadingEditSubtemas(true);
      const { data } = await supabase
        .from('subtemas')
        .select('id, nombre, tema_id')
        .eq('tema_id', selectedPlaca.tema_id)
        .order('sort_order', { ascending: true });
      if (data) setEditSubtemas(data);
      setLoadingEditSubtemas(false);
    };
    fetch();
  }, [selectedPlaca]);

  // ── Cuando cambia el tema en el panel de edición, recargar subtemas ───
  const handleEditTemaChange = async (temaId: number | null) => {
    setEditTemaId(temaId);
    setEditSubtemaId(null);
    setEditSubtemas([]);
    if (!temaId) return;
    setLoadingEditSubtemas(true);
    const { data } = await supabase
      .from('subtemas')
      .select('id, nombre, tema_id')
      .eq('tema_id', temaId)
      .order('sort_order', { ascending: true });
    if (data) setEditSubtemas(data);
    setLoadingEditSubtemas(false);
  };

  // ── Guardar cambios ───────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!selectedPlaca || !editTemaId || !editSubtemaId) return;
    const senaladosPayload = buildSenaladosPayload(editSenalados, editSenaladosPos);
    if (senaladosPayload.error) {
      setSaveError(senaladosPayload.error);
      if (senaladosPayload.firstMissingLocationIndex != null) {
        setEditingSenaladoIndex(senaladosPayload.firstMissingLocationIndex);
        setForceLocationAssignment(true);
      }
      return;
    }

    setIsSaving(true);
    setSaveError('');
    setSaveSuccess(false);
    const { labels: senalados_filtrados, meta: senalados_meta } = senaladosPayload;
    try {
      const { error } = await supabase
        .from('placas')
        .update({
          tema_id:     editTemaId,
          subtema_id:  editSubtemaId,
          aumento:     editAumento || null,
          senalados:   senalados_filtrados.length > 0 ? senalados_filtrados : null,
          senalados_meta: senalados_meta.length > 0 ? senalados_meta : null,
          comentario:  editComentario.trim() || null,
          tincion:     editTincion.trim() || null,
        })
        .eq('id', selectedPlaca.id);
      if (error) throw error;

      const updatedFields = {
        tema_id:    editTemaId,
        subtema_id: editSubtemaId,
        aumento:    editAumento || null,
        senalados:  senalados_filtrados.length > 0 ? senalados_filtrados : null,
        senalados_meta: senalados_meta.length > 0 ? senalados_meta : null,
        comentario: editComentario.trim() || null,
        tincion:    editTincion.trim() || null,
      };

      await logPlateActivity({
        actionType: 'edit_plate',
        targetTable: 'placas',
        placaId: selectedPlaca.id,
        actor: {
          id: user?.id ?? null,
          username: user?.username ?? null,
        },
        details: {
          source: 'mover_placa',
          from_tema_id: selectedPlaca.tema_id,
          from_subtema_id: selectedPlaca.subtema_id,
          to_tema_id: editTemaId,
          to_subtema_id: editSubtemaId,
          changed_fields: updatedFields,
        },
      });

      // Si el subtema destino es diferente al actual, quitar la placa de la lista
      if (editSubtemaId !== selectedPlaca.subtema_id) {
        setPlacas(prev => prev.filter(p => p.id !== selectedPlaca.id));
        setSelectedPlaca(null);
      } else {
        // Actualizar el objeto en el listado
        const updated = { ...selectedPlaca, ...updatedFields };
        setPlacas(prev => prev.map(p => p.id === selectedPlaca.id ? updated : p));
        setSelectedPlaca(updated);
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err) {
      console.error('Error al guardar placa:', err);
      setSaveError('Error al guardar. Intenta de nuevo.');
    } finally {
      setIsSaving(false);
    }
  }, [
    selectedPlaca,
    editTemaId,
    editSubtemaId,
    editAumento,
    editSenalados,
    editSenaladosPos,
    editComentario,
    editTincion,
    user?.id,
    user?.username,
  ]);

  const temasByParcial: Record<ParcialKey, Tema[]> = { primer: [], segundo: [], tercer: [] };
  temas.forEach(t => {
    if (temasByParcial[t.parcial as ParcialKey]) {
      temasByParcial[t.parcial as ParcialKey].push(t);
    }
  });

  const editTemasByParcial: Record<ParcialKey, Tema[]> = { primer: [], segundo: [], tercer: [] };
  editTemas.forEach(t => {
    if (editTemasByParcial[t.parcial as ParcialKey]) {
      editTemasByParcial[t.parcial as ParcialKey].push(t);
    }
  });

  const selectedTema    = temas.find(t => t.id === selectedTemaId)       ?? null;
  const selectedSubtema = subtemas.find(s => s.id === selectedSubtemaId) ?? null;
  const editTema        = editTemas.find(t => t.id === editTemaId)        ?? null;
  const editSubtema     = editSubtemas.find(s => s.id === editSubtemaId)  ?? null;

  const hasChanges = selectedPlaca !== null && (
    editTemaId    !== selectedPlaca.tema_id ||
    editSubtemaId !== selectedPlaca.subtema_id ||
    editAumento   !== (selectedPlaca.aumento ?? '') ||
    editComentario !== (selectedPlaca.comentario ?? '') ||
    JSON.stringify(buildSenaladosPayload(editSenalados, editSenaladosPos).meta) !==
      JSON.stringify(selectedPlaca.senalados_meta ?? buildSenaladosPayload(selectedPlaca.senalados ?? [], []).meta) ||
    editTincion !== (selectedPlaca.tincion ?? '')
  );
    const handleGoBack = useSmartBackNavigation('/edicion');

  return (
    <div style={s.page}>
      <Header />
      <main style={s.main}>

                <BackButton onClick={handleGoBack} />

        {/* Encabezado */}
        <div style={{ ...s.pageHeader, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ flex: 1 }}>
            <h1 style={s.pageTitle}>Mover placa</h1>
            <p style={s.pageSubtitle}>Selecciona un tema y subtema para ver sus placas, haz clic en una para reasignarla a otro tema o subtema.</p>
            <div style={s.accentLine} />
          </div>
          <button
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '7px',
              padding: '11px 18px', borderRadius: '12px',
              border: '1.5px solid #c7d2fe', background: '#f5f3ff',
              color: '#6366f1', fontSize: '0.9em', fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s',
              whiteSpace: 'nowrap', flexShrink: 0,
            }}
            onClick={() => navigate('/lista-espera')}
            onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg,#6366f1,#818cf8)'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'transparent'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#f5f3ff'; e.currentTarget.style.color = '#6366f1'; e.currentTarget.style.borderColor = '#c7d2fe'; }}
          >
            ⏳ Lista de espera
          </button>
        </div>

        {/* Selectores de contexto */}
        <div style={s.card}>
          <div style={s.cardHeader}>
            <h2 style={s.cardTitle}>Selecciona tema y subtema</h2>
            <p style={s.cardSubtitle}>Elige dónde buscar la placa que deseas reasignar</p>
            <div style={s.divider} />
          </div>

          <div style={s.selectsRow}>
            <div style={s.selectGroup}>
              <label style={s.selectLabel}>Tema</label>
              {loadingTemas ? (
                <div style={s.inlineLoading}><div style={s.spinnerSm} /> Cargando...</div>
              ) : (
                <select
                  style={s.select}
                  value={selectedTemaId ?? ''}
                  onChange={e => setSelectedTemaId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">— Elige un tema —</option>
                  {PARCIALES.map(({ key, label }) =>
                    temasByParcial[key].length > 0 ? (
                      <optgroup key={key} label={label}>
                        {temasByParcial[key].map(t => (
                          <option key={t.id} value={t.id}>{t.nombre}</option>
                        ))}
                      </optgroup>
                    ) : null
                  )}
                </select>
              )}
            </div>

            <div style={s.selectGroup}>
              <label style={s.selectLabel}>Subtema</label>
              {loadingSubtemas ? (
                <div style={s.inlineLoading}><div style={s.spinnerSm} /> Cargando...</div>
              ) : (
                <select
                  style={{ ...s.select, ...(!selectedTemaId ? s.selectDisabled : {}) }}
                  value={selectedSubtemaId ?? ''}
                  disabled={!selectedTemaId || subtemas.length === 0}
                  onChange={e => setSelectedSubtemaId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">
                    {!selectedTemaId
                      ? '— Primero elige un tema —'
                      : subtemas.length === 0
                      ? '— Sin subtemas —'
                      : '— Elige un subtema —'}
                  </option>
                  {subtemas.map(sub => (
                    <option key={sub.id} value={sub.id}>{sub.nombre}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>

        {/* Grid de placas */}
        {selectedSubtema && (
          <div style={s.card}>
            <div style={s.cardHeader}>
              <h2 style={s.cardTitle}>
                {selectedTema?.nombre} › {selectedSubtema.nombre}
              </h2>
              <p style={s.cardSubtitle}>
                {placas.length} {placas.length === 1 ? 'placa' : 'placas'} — haz clic en una para editarla
              </p>
              <div style={s.divider} />
            </div>

            {loadingPlacas ? (
              <div style={s.loadingWrap}>
                <div style={s.spinner} />
                <p style={s.loadingText}>Cargando placas...</p>
              </div>
            ) : placas.length === 0 ? (
              <div style={s.emptyState}>Este subtema no tiene placas aún.</div>
            ) : (
              <div className="placas-gallery-grid">
                {placas.map((placa, index) => {
                  const isSelected = selectedPlaca?.id === placa.id;
                  const isHovered  = hoveredCard === placa.id;
                  return (
                    <div
                      key={placa.id}
                      className="placa-thumb-wrap"
                      style={{
                        ...s.placaCard,
                        border: isSelected
                          ? '2.5px solid #818cf8'
                          : isHovered
                          ? '2px solid #38bdf8'
                          : '1.5px solid #e0f2fe',
                        boxShadow: isSelected
                          ? '0 0 0 4px rgba(129,140,248,0.22)'
                          : isHovered
                          ? '0 12px 28px rgba(14,165,233,0.22)'
                          : '0 2px 10px rgba(15,23,42,0.10)',
                        transform: isHovered && !isSelected ? 'translateY(-4px)' : 'none',
                        cursor: 'pointer',
                      }}
                      onClick={() => setSelectedPlaca(isSelected ? null : placa)}
                      onMouseEnter={() => setHoveredCard(placa.id)}
                      onMouseLeave={() => setHoveredCard(null)}
                    >
                      <div style={{
                        ...s.cardAccent,
                        background: isSelected
                          ? 'linear-gradient(90deg, #818cf8, #c084fc)'
                          : 'linear-gradient(90deg, #38bdf8, #818cf8)',
                      }} />

                      <span style={s.positionBadge}>{index + 1}</span>

                      {isSelected && (
                        <div style={s.selectedMark}>✏️</div>
                      )}

                      <div style={s.imgWrap}>
                        <img
                          src={getCloudinaryImageUrl(placa.photo_url, 'thumb')}
                          alt={`Placa ${index + 1}`}
                          style={s.img}
                          loading="lazy"
                          draggable={false}
                        />
                      </div>

                      <div style={{
                        ...s.cardFooter,
                        background: isSelected
                          ? 'linear-gradient(135deg, #ede9fe, #ddd6fe)'
                          : isHovered
                          ? 'linear-gradient(135deg, #e0f2fe, #ede9fe)'
                          : '#f8fafc',
                        borderColor: isSelected ? '#a5b4fc' : isHovered ? '#7dd3fc' : '#e2e8f0',
                      }}>
                        <span style={{
                          ...s.cardFooterText,
                          color: isSelected ? '#4338ca' : '#94a3b8',
                          fontWeight: isSelected ? 700 : 600,
                        }}>
                          {isSelected ? '✏️ Editando' : 'Clic para editar'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Panel de edición */}
        {selectedPlaca && (
          <div style={s.editPanel}>
            <div style={s.editPanelInner}>

              {/* Foto */}
              <div style={s.editPhotoCol}>
                <div style={s.editPhotoWrap}>
                  <img
                    src={getCloudinaryImageUrl(selectedPlaca.photo_url, 'view')}
                    alt="Placa seleccionada"
                    style={s.editPhoto}
                    draggable={false}
                  />
                </div>
                <p style={s.editPhotoHint}>Placa seleccionada</p>
              </div>

              {/* Formulario */}
              <div style={s.editFormCol}>
                <h3 style={s.editFormTitle}>Reasignar placa</h3>
                <p style={s.editFormSubtitle}>
                  Cambia el tema o subtema al que pertenece esta placa.
                  Si cambias el tema deberás seleccionar un nuevo subtema.
                </p>
                <div style={s.divider} />

                {/* Info actual */}
                <div style={s.currentInfo}>
                  <span style={s.currentInfoLabel}>Asignación actual:</span>
                  <span style={s.currentInfoValue}>
                    {temas.find(t => t.id === selectedPlaca.tema_id)?.nombre ?? '—'}
                    {' › '}
                    {/* subtemas de contexto puede no incluirlo si fue en otro tema */}
                    {editSubtemas.find(s => s.id === selectedPlaca.subtema_id)?.nombre
                      ?? subtemas.find(s => s.id === selectedPlaca.subtema_id)?.nombre
                      ?? `subtema #${selectedPlaca.subtema_id}`}
                  </span>
                </div>

                {/* Selector de nuevo tema */}
                <div style={s.editFieldGroup}>
                  <label style={s.selectLabel}>Nuevo tema</label>
                  <select
                    style={s.select}
                    value={editTemaId ?? ''}
                    onChange={e => handleEditTemaChange(e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">— Elige un tema —</option>
                    {PARCIALES.map(({ key, label }) =>
                      editTemasByParcial[key].length > 0 ? (
                        <optgroup key={key} label={label}>
                          {editTemasByParcial[key].map(t => (
                            <option key={t.id} value={t.id}>{t.nombre}</option>
                          ))}
                        </optgroup>
                      ) : null
                    )}
                  </select>
                </div>

                {/* Selector de nuevo subtema */}
                <div style={s.editFieldGroup}>
                  <label style={s.selectLabel}>Nuevo subtema</label>
                  {loadingEditSubtemas ? (
                    <div style={s.inlineLoading}><div style={s.spinnerSm} /> Cargando...</div>
                  ) : (
                    <select
                      style={{ ...s.select, ...(!editTemaId ? s.selectDisabled : {}) }}
                      value={editSubtemaId ?? ''}
                      disabled={!editTemaId || editSubtemas.length === 0}
                      onChange={e => setEditSubtemaId(e.target.value ? Number(e.target.value) : null)}
                    >
                      <option value="">
                        {!editTemaId
                          ? '— Primero elige un tema —'
                          : editSubtemas.length === 0
                          ? '— Sin subtemas —'
                          : '— Elige un subtema —'}
                      </option>
                      {editSubtemas.map(sub => (
                        <option key={sub.id} value={sub.id}>{sub.nombre}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* ── Aumento ── */}
                <div style={s.editFieldGroup}>
                  <label style={s.selectLabel}>🔬 Aumento</label>
                  <div style={s.aumentoGroup}>
                    {['x4', 'x10', 'x40', 'x50', 'x100'].map(op => (
                      <button
                        key={op}
                        type="button"
                        style={editAumento === op ? s.aumentoBtnActive : s.aumentoBtn}
                        onClick={() => setEditAumento(prev => prev === op ? '' : op)}
                      >
                        {op}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── Tinción ── */}
                <div style={s.editFieldGroup}>
                  {!showEditTincion ? (
                    <button
                      type="button"
                      style={s.addTincionBtn}
                      onClick={() => setShowEditTincion(true)}
                    >
                      🧪 Añadir / editar tinción
                    </button>
                  ) : (
                    <>
                      <label style={{ ...s.selectLabel, color: '#b45309' }}>🧪 Tinción</label>
                      <BoldField
                        as="input"
                        style={s.tincionField}
                        value={editTincion}
                        placeholder="Ej: H&E, PAS, Azul de toluidina..."
                        onChange={setEditTincion}
                      />
                      {editTincion && (
                        <button
                          type="button"
                          style={s.clearTincionBtn}
                          onClick={() => { setEditTincion(''); setShowEditTincion(false); }}
                        >
                          🗑️ Eliminar tinción
                        </button>
                      )}
                    </>
                  )}
                </div>

                {/* ── Señalados ── */}
                <div style={s.editFieldGroup}>
                  <label style={s.selectLabel}>📌 Señalados</label>
                  {editSenalados.map((val, idx) => (
                    <div key={idx} style={s.senalRow}>
                      <span style={s.senalNumber}>{idx + 1}</span>
                      <BoldField
                        as="input"
                        inline
                        style={s.senalInput}
                        value={val}
                        placeholder={`Señalado ${idx + 1}`}
                        onChange={v => {
                          const updated = [...editSenalados];
                          updated[idx] = v;
                          setEditSenalados(updated);
                        }}
                        onFocus={e => (e.currentTarget.style.borderColor = '#818cf8')}
                        onBlur={e => (e.currentTarget.style.borderColor = '#cbd5e1')}
                      />
                      <button
                        type="button"
                        style={s.senalRemoveBtn}
                        title="Eliminar señalado"
                        onClick={() => {
                          setEditSenalados(prev => prev.filter((_, i) => i !== idx));
                          setEditSenaladosPos(prev => prev.filter((_, i) => i !== idx));
                        }}
                      >✕</button>
                      <button
                        type="button"
                        style={{ ...s.addSenalBtn, padding: '6px 10px' }}
                        onClick={() => {
                          setForceLocationAssignment(false);
                          setEditingSenaladoIndex(idx);
                        }}
                      >
                        {editSenaladosPos[idx] ? '📍 Editar ubicación' : '📍 Ubicar'}
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    style={s.addSenalBtn}
                    onClick={() => {
                      const nextIndex = editSenalados.length;
                      setEditSenalados(prev => [...prev, '']);
                      setEditSenaladosPos(prev => [...prev, null]);
                      setForceLocationAssignment(true);
                      setEditingSenaladoIndex(nextIndex);
                    }}
                  >
                    + Añadir señalado
                  </button>
                </div>

                {/* ── Comentario ── */}
                <div style={s.editFieldGroup}>
                  {!showEditComentario ? (
                    <button
                      type="button"
                      style={s.addComentarioBtn}
                      onClick={() => setShowEditComentario(true)}
                    >
                      💬 Añadir / editar comentario
                    </button>
                  ) : (
                    <>
                      <label style={{ ...s.selectLabel, color: '#4f46e5' }}>💬 Comentario</label>
                      <BoldField
                        as="textarea"
                        style={s.comentarioField}
                        value={editComentario}
                        placeholder="Escribe un comentario para esta placa..."
                        onChange={setEditComentario}
                      />
                      {editComentario && (
                        <button
                          type="button"
                          style={s.clearComentarioBtn}
                          onClick={() => { setEditComentario(''); setShowEditComentario(false); }}
                        >
                          🗑️ Eliminar comentario
                        </button>
                      )}
                    </>
                  )}
                </div>

                {/* Destino */}
                {editTema && editSubtema && (
                  <div style={s.destInfo}>
                    <span style={s.destInfoLabel}>Nuevo destino:</span>
                    <span style={s.destInfoValue}>
                      {editTema.nombre} › {editSubtema.nombre}
                    </span>
                  </div>
                )}

                {saveError && (
                  <p style={s.errorMsg}>{saveError}</p>
                )}

                {saveSuccess && (
                  <p style={s.successMsg}>✅ Placa reasignada correctamente</p>
                )}

                {/* Botón guardar */}
                <button
                  style={hasChanges && !isSaving && editTemaId && editSubtemaId
                    ? s.saveBtn
                    : s.saveBtnDisabled}
                  disabled={!hasChanges || isSaving || !editTemaId || !editSubtemaId}
                  onClick={handleSave}
                >
                  {isSaving
                    ? 'Guardando...'
                    : hasChanges
                    ? '💾 Guardar cambios'
                    : '— Sin cambios —'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
      <LoadingToast visible={isSaving} type="updating" message="Actualizando placa" />

      {editingSenaladoIndex !== null && selectedPlaca && (
        <SenaladoLocationPicker
          imageSrc={getCloudinaryImageUrl(selectedPlaca.photo_url, 'view')}
          senaladoLabel={editSenalados[editingSenaladoIndex] ?? ''}
          initialLocation={editSenaladosPos[editingSenaladoIndex] ?? null}
          onCancel={() => setEditingSenaladoIndex(null)}
          onRemove={() => {
            const targetIndex = editingSenaladoIndex;
            setEditSenalados(prev => prev.filter((_, i) => i !== targetIndex));
            setEditSenaladosPos(prev => prev.filter((_, i) => i !== targetIndex));
            setEditingSenaladoIndex(null);
            setNamingSenaladoIndex(null);
            setForceLocationAssignment(false);
          }}
          onSave={(location) => {
            const targetIndex = editingSenaladoIndex;
            setEditSenaladosPos(prev => {
              const next = [...prev];
              next[targetIndex] = location;
              return next;
            });

            const currentLabel = (editSenalados[targetIndex] ?? '').trim();
            if (!currentLabel) {
              setNamingSenaladoIndex(targetIndex);
            }

            setForceLocationAssignment(false);
            setEditingSenaladoIndex(null);
          }}
        />
      )}

      {namingSenaladoIndex !== null && (
        <RequiredTextPromptModal
          title="Nombre del señalado"
          description="Después de ubicar el señalado, debes escribir su nombre para continuar."
          placeholder="Ej: Luz del túbulo"
          required
          cancelLabel="Cancelar y señalar de nuevo"
          onCancel={() => {
            const targetIndex = namingSenaladoIndex;
            setNamingSenaladoIndex(null);
            setForceLocationAssignment(true);
            setEditingSenaladoIndex(targetIndex);
          }}
          onSubmit={(value) => {
            setEditSenalados(prev => {
              const next = [...prev];
              next[namingSenaladoIndex] = value;
              return next;
            });
            setNamingSenaladoIndex(null);
          }}
        />
      )}
    </div>
  );
};

const s: { [key: string]: React.CSSProperties } = {
  page: {
    minHeight: '100vh',
    background: 'transparent',
    color: '#0f172a',
    fontFamily: '"Montserrat", "Segoe UI", sans-serif',
    display: 'flex',
    flexDirection: 'column',
  },
  main: {
    flex: 1,
    width: '100%',
    maxWidth: '1300px',
    margin: '0 auto',
    padding: 'clamp(16px, 3vw, 40px) clamp(12px, 3vw, 40px) clamp(24px, 4vw, 60px)',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  breadcrumb: {
    display: 'inline-flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' as const,
    background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(8px)',
    border: '1px solid rgba(186,230,253,0.6)', borderRadius: '12px',
    padding: '8px 16px', boxShadow: '0 2px 8px rgba(14,165,233,0.07)',
    alignSelf: 'flex-start',
  },
  breadcrumbLink: {
    background: 'none', border: 'none', cursor: 'pointer', color: '#0ea5e9',
    fontWeight: 600, fontSize: '0.88em', padding: '4px 8px', borderRadius: '8px',
    transition: 'background 0.15s', fontFamily: 'inherit', letterSpacing: '0.01em',
  },
  breadcrumbSep: { color: '#94a3b8', fontWeight: 700, fontSize: '0.75em', userSelect: 'none' as const },
  breadcrumbCurrent: {
    color: '#0f172a', fontWeight: 800, fontSize: '0.88em', padding: '4px 8px',
    background: 'linear-gradient(135deg, #e0f2fe, #ede9fe)', borderRadius: '8px',
    border: '1px solid #bae6fd', letterSpacing: '0.01em',
  },
  pageHeader: { display: 'flex', flexDirection: 'column', gap: '6px' },
  pageTitle: {
    fontSize: 'clamp(1.6em, 4vw, 2.4em)', fontWeight: 900, color: '#0f172a',
    letterSpacing: '-0.03em', margin: 0,
  },
  pageSubtitle: { fontSize: 'clamp(0.88em, 2vw, 1em)', color: '#64748b', margin: 0, lineHeight: 1.6 },
  accentLine: {
    width: '56px', height: '4px',
    background: 'linear-gradient(90deg, #6366f1, #818cf8)', borderRadius: '4px',
    marginTop: '8px',
  },
  card: {
    background: 'transparent',
    borderRadius: '20px',
    padding: 'clamp(16px, 3vw, 36px)',
    boxShadow: 'none',
    border: 'none',
  },
  cardHeader: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: '24px',
  },
  cardTitle: {
    fontSize: 'clamp(1.2em, 3vw, 2em)',
    fontWeight: 800,
    color: '#0f172a',
    letterSpacing: '-0.03em',
    margin: '0 0 6px',
    textAlign: 'center',
  },
  cardSubtitle: {
    fontSize: '0.9em',
    color: '#64748b',
    margin: '0 0 14px',
    textAlign: 'center',
  },
  divider: {
    width: '56px',
    height: '4px',
    background: 'linear-gradient(90deg, #818cf8, #c084fc)',
    borderRadius: '4px',
  },
  selectsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '20px',
  },
  selectGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  selectLabel: {
    fontSize: '0.875em',
    fontWeight: 700,
    color: '#475569',
    letterSpacing: '0.03em',
  },
  select: {
    width: '100%',
    padding: '12px 16px',
    fontSize: '1em',
    fontFamily: '"Montserrat", "Segoe UI", sans-serif',
    borderRadius: '10px',
    border: '1.5px solid #cbd5e1',
    background: '#f8fafc',
    color: '#0f172a',
    cursor: 'pointer',
    outline: 'none',
    boxSizing: 'border-box',
  },
  selectDisabled: {
    opacity: 0.55,
    cursor: 'not-allowed',
  },
  inlineLoading: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 16px',
    fontSize: '0.9em',
    color: '#64748b',
    background: '#f8fafc',
    borderRadius: '10px',
    border: '1.5px solid #e2e8f0',
  },
  spinnerSm: {
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    border: '3px solid #e0f2fe',
    borderTop: '3px solid #38bdf8',
    animation: 'spin 0.8s linear infinite',
    flexShrink: 0,
  },
  emptyState: {
    textAlign: 'center',
    color: '#94a3b8',
    fontStyle: 'italic',
    padding: '36px',
    background: '#f8fafc',
    borderRadius: '10px',
    border: '1px dashed #e2e8f0',
    fontSize: '0.95em',
  },
  loadingWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
    padding: '40px 0',
  },
  spinner: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    border: '4px solid #e0f2fe',
    borderTop: '4px solid #38bdf8',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: { color: '#64748b', fontSize: '1em', fontWeight: 500 },
  placaCard: {
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
    border: '1.5px solid #e0f2fe',
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    transition: 'opacity 0.2s, transform 0.2s, box-shadow 0.2s, border-color 0.2s',
    userSelect: 'none',
  },
  cardAccent: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: '3px',
    borderRadius: '12px 12px 0 0',
    zIndex: 1,
  },
  positionBadge: {
    position: 'absolute',
    top: '10px',
    left: '10px',
    background: 'rgba(15,23,42,0.55)',
    color: '#ffffff',
    fontSize: '0.72em',
    fontWeight: 800,
    borderRadius: '6px',
    padding: '2px 7px',
    lineHeight: 1.5,
    zIndex: 2,
    backdropFilter: 'blur(4px)',
  },
  selectedMark: {
    position: 'absolute',
    top: '10px',
    right: '10px',
    width: '28px',
    height: '28px',
    background: 'linear-gradient(135deg, #818cf8, #c084fc)',
    color: '#fff',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.85em',
    zIndex: 3,
    boxShadow: '0 2px 8px rgba(129,140,248,0.45)',
  },
  imgWrap: {
    width: '100%',
    aspectRatio: '1 / 1',
    overflow: 'hidden',
    background: '#e2e8f0',
    flexShrink: 0,
  },
  img: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
    pointerEvents: 'none',
    transition: 'filter 0.2s',
  },
  cardFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '7px 0',
    borderTop: '1px solid #e2e8f0',
    transition: 'background 0.15s, border-color 0.15s',
    flexShrink: 0,
  },
  cardFooterText: {
    fontSize: '0.7em',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  // ── Panel de edición ──────────────────────────────────────────────────
  editPanel: {
    background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
    borderRadius: '20px',
    padding: 'clamp(16px, 3vw, 36px)',
    boxShadow: '0 20px 50px rgba(15,23,42,0.12), 0 4px 12px rgba(15,23,42,0.06)',
    border: '2px solid #818cf8',
  },
  editPanelInner: {
    display: 'flex',
    gap: 'clamp(20px, 4vw, 48px)',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  editPhotoCol: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    flex: '0 0 auto',
  },
  editPhotoWrap: {
    width: 'clamp(160px, 24vw, 280px)',
    height: 'clamp(160px, 24vw, 280px)',
    borderRadius: '16px',
    overflow: 'hidden',
    boxShadow: '0 8px 32px rgba(15,23,42,0.18)',
    border: '3px solid #818cf8',
    flexShrink: 0,
  },
  editPhoto: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  editPhotoHint: {
    fontSize: '0.78em',
    color: '#94a3b8',
    fontWeight: 500,
    textAlign: 'center',
    margin: 0,
  },
  editFormCol: {
    flex: '1 1 280px',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
    minWidth: 0,
  },
  editFormTitle: {
    fontSize: 'clamp(1.1em, 2.5vw, 1.6em)',
    fontWeight: 800,
    color: '#0f172a',
    letterSpacing: '-0.02em',
    margin: 0,
  },
  editFormSubtitle: {
    fontSize: '0.88em',
    color: '#64748b',
    lineHeight: 1.6,
    margin: 0,
  },
  currentInfo: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    flexWrap: 'wrap',
    padding: '10px 14px',
    background: '#f1f5f9',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
    fontSize: '0.88em',
  },
  currentInfoLabel: {
    fontWeight: 700,
    color: '#64748b',
    flexShrink: 0,
  },
  currentInfoValue: {
    color: '#0f172a',
    fontWeight: 500,
  },
  editFieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  destInfo: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    flexWrap: 'wrap',
    padding: '10px 14px',
    background: 'linear-gradient(135deg, #ede9fe, #ddd6fe)',
    borderRadius: '10px',
    border: '1px solid #a5b4fc',
    fontSize: '0.88em',
  },
  destInfoLabel: {
    fontWeight: 700,
    color: '#4338ca',
    flexShrink: 0,
  },
  destInfoValue: {
    color: '#3730a3',
    fontWeight: 600,
  },
  errorMsg: {
    fontSize: '0.88em',
    color: '#ef4444',
    background: '#fee2e2',
    borderRadius: '8px',
    padding: '8px 12px',
    margin: 0,
  },
  saveBtn: {
    padding: '12px 28px',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    background: 'linear-gradient(135deg, #818cf8, #6366f1)',
    color: 'white',
    fontWeight: 700,
    fontSize: '1em',
    fontFamily: 'inherit',
    boxShadow: '0 4px 14px rgba(129,140,248,0.35)',
    alignSelf: 'flex-start',
  },
  saveBtnDisabled: {
    padding: '12px 28px',
    border: 'none',
    borderRadius: '10px',
    cursor: 'not-allowed',
    background: '#e2e8f0',
    color: '#94a3b8',
    fontWeight: 700,
    fontSize: '1em',
    fontFamily: 'inherit',
    alignSelf: 'flex-start',
  },
  successMsg: { fontSize: '0.92em', color: '#15803d', fontWeight: 600, margin: '0 0 8px' },
  // ── Aumento ──────────────────────────────────────────────────────────────
  aumentoGroup: {
    display: 'flex', gap: '8px', flexWrap: 'wrap' as const,
  },
  aumentoBtn: {
    padding: '7px 16px', borderRadius: '20px', border: '2px solid #cbd5e1',
    background: '#f8fafc', cursor: 'pointer', fontSize: '0.92em', fontWeight: 600,
    color: '#475569', fontFamily: 'inherit', transition: 'all 0.15s ease',
  },
  aumentoBtnActive: {
    padding: '7px 16px', borderRadius: '20px', border: '2px solid #818cf8',
    background: 'linear-gradient(135deg, #818cf8, #6366f1)', cursor: 'pointer',
    fontSize: '0.92em', fontWeight: 700, color: '#fff', fontFamily: 'inherit',
    transition: 'all 0.15s ease',
  },
  // ── Señalados ─────────────────────────────────────────────────────────────
  senalRow: {
    display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px',
  },
  senalNumber: {
    minWidth: '26px', height: '26px', borderRadius: '50%',
    background: 'linear-gradient(135deg, #818cf8, #6366f1)', color: '#fff',
    fontWeight: 700, fontSize: '0.82em', display: 'flex', alignItems: 'center',
    justifyContent: 'center', flexShrink: 0,
  },
  senalInput: {
    flex: 1, padding: '9px 12px', fontSize: '0.92em', fontFamily: 'inherit',
    border: '1.5px solid #cbd5e1', borderRadius: '8px', outline: 'none',
    color: '#0f172a', background: '#f8fafc', boxSizing: 'border-box' as const,
    transition: 'border-color 0.2s',
  },
  senalRemoveBtn: {
    background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444',
    fontSize: '1em', padding: '0 4px', lineHeight: 1, flexShrink: 0, fontFamily: 'inherit',
  },
  addSenalBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '8px 16px', borderRadius: '8px', border: '2px dashed #818cf8',
    background: '#f5f3ff', color: '#4f46e5', cursor: 'pointer',
    fontSize: '0.88em', fontWeight: 600, fontFamily: 'inherit',
    transition: 'background 0.15s', marginTop: '2px',
  },
  // ── Comentario ────────────────────────────────────────────────────────────
  addComentarioBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '8px 16px', borderRadius: '8px', border: '2px dashed #818cf8',
    background: '#f5f3ff', color: '#4f46e5', cursor: 'pointer',
    fontSize: '0.88em', fontWeight: 600, fontFamily: 'inherit',
    transition: 'background 0.15s',
  },
  comentarioField: {
    width: '100%', padding: '10px 12px', fontSize: '0.95em', fontFamily: 'inherit',
    border: '1.5px solid #c7d2fe', borderRadius: '8px', outline: 'none',
    color: '#0f172a', resize: 'vertical' as const, minHeight: '80px',
    boxSizing: 'border-box' as const, transition: 'border-color 0.2s', background: '#f8fafc',
  },
  clearComentarioBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '6px 14px', borderRadius: '8px', border: '1.5px solid #fca5a5',
    background: '#fff1f2', color: '#dc2626', cursor: 'pointer',
    fontSize: '0.82em', fontWeight: 600, fontFamily: 'inherit',
    marginTop: '6px', transition: 'background 0.15s',
  },
  addTincionBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '8px 16px', borderRadius: '8px', border: '2px dashed #f59e0b',
    background: '#fffbeb', color: '#b45309', cursor: 'pointer',
    fontSize: '0.88em', fontWeight: 600, fontFamily: 'inherit',
    transition: 'background 0.15s',
  },
  tincionField: {
    width: '100%', padding: '10px 12px', fontSize: '0.95em', fontFamily: 'inherit',
    border: '1.5px solid #fde68a', borderRadius: '8px', outline: 'none',
    color: '#0f172a', boxSizing: 'border-box' as const, transition: 'border-color 0.2s',
    background: '#fffbeb',
  },
  clearTincionBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '6px 14px', borderRadius: '8px', border: '1.5px solid #fde68a',
    background: '#fff7ed', color: '#92400e', cursor: 'pointer',
    fontSize: '0.82em', fontWeight: 600, fontFamily: 'inherit',
    marginTop: '6px', transition: 'background 0.15s',
  },
};

export default MoverPlaca;






