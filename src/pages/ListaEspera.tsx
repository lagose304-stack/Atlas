import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { deleteFromCloudinary } from '../services/cloudinary';
import BackButton from '../components/BackButton';
import Header from '../components/Header';
import Footer from '../components/Footer';
import LoadingToast from '../components/LoadingToast';
import SenaladoLocationPicker from '../components/SenaladoLocationPicker.tsx';
import RequiredTextPromptModal from '../components/RequiredTextPromptModal';
import PlateEditorPanel from '../components/PlateEditorPanel';
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

interface PlacaSinClasificar {
  id: number;
  photo_url: string;
  public_id: string;
  created_at: string;
}

type ParcialKey = 'primer' | 'segundo' | 'tercer';

const PARCIALES: { key: ParcialKey; label: string }[] = [
  { key: 'primer',  label: 'Primer parcial'  },
  { key: 'segundo', label: 'Segundo parcial' },
  { key: 'tercer',  label: 'Tercer parcial'  },
];

interface MarkerLocation {
  x: number;
  y: number;
  startX?: number | null;
  startY?: number | null;
  regionPoints?: number[] | null;
  regionColor?: string | null;
  regionOpacity?: number | null;
}

interface SenaladoMetaItem {
  label: string;
  x: number | null;
  y: number | null;
  startX?: number | null;
  startY?: number | null;
  regionPoints?: number[] | null;
  regionColor?: string | null;
  regionOpacity?: number | null;
}

const buildSenaladosPayload = (
  names: string[],
  locations: Array<MarkerLocation | null>
): { labels: string[]; meta: SenaladoMetaItem[]; error?: string } => {
  const labels: string[] = [];
  const meta: SenaladoMetaItem[] = [];

  const total = Math.max(names.length, locations.length);
  for (let index = 0; index < total; index++) {
    const name = names[index] ?? '';
    const label = name.trim();
    const location = locations[index] ?? null;

    const hasLabel = label !== '';
    const hasLocation = location !== null;

    if (!hasLabel && !hasLocation) continue;

    if (!hasLocation) {
      return {
        labels: [],
        meta: [],
        error: `Debes ubicar el señalado ${index + 1} antes de guardar.`,
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
      startX: location?.startX ?? null,
      startY: location?.startY ?? null,
      regionPoints: location?.regionPoints ?? null,
      regionColor: location?.regionColor ?? null,
      regionOpacity: location?.regionOpacity ?? null,
    });
  }

  return { labels, meta };
};

const ITEMS_PER_PAGE = 15;

const ListaEspera: React.FC = () => {
  const { user } = useAuth();

  // ── Datos ─────────────────────────────────────────────────────────────
  const [placas,   setPlacas]   = useState<PlacaSinClasificar[]>([]);
  const [temas,    setTemas]    = useState<Tema[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [miniPage, setMiniPage] = useState(1);

  // ── Placa seleccionada ────────────────────────────────────────────────
  const [selected, setSelected] = useState<PlacaSinClasificar | null>(null);
  const [preselectPlate, setPreselectPlate] = useState<PlacaSinClasificar | null>(null);
  const [preselectModalOpen, setPreselectModalOpen] = useState(false);
  const [temaIdTemp, setTemaIdTemp] = useState<number | null>(null);
  const [subtemaIdTemp, setSubtemaIdTemp] = useState<number | null>(null);
  const [tempSubtemas, setTempSubtemas] = useState<Subtema[]>([]);
  const [loadingTempSubtemas, setLoadingTempSubtemas] = useState(false);

  // ── Formulario de clasificación ───────────────────────────────────────
  const [subtemas,        setSubtemas]        = useState<Subtema[]>([]);
  const [temaId,          setTemaId]          = useState<number | null>(null);
  const [subtemaId,       setSubtemaId]       = useState<number | null>(null);
  const [loadingSubtemas, setLoadingSubtemas] = useState(false);
  const [aumento,         setAumento]         = useState('');
  const [senalados,       setSenalados]       = useState<string[]>([]);
  const [senaladosPos,    setSenaladosPos]    = useState<Array<MarkerLocation | null>>([]);
  const [editingSenaladoIndex, setEditingSenaladoIndex] = useState<number | null>(null);
  const [borderSenaladoIndex, setBorderSenaladoIndex] = useState<number | null>(null);
  const [editingSenaladoGroup, setEditingSenaladoGroup] = useState<{ label: string; indices: number[] } | null>(null);
  const [editingSenaladoGroupLocations, setEditingSenaladoGroupLocations] = useState<Array<MarkerLocation | null>>([]);
  const [namingSenaladoIndex, setNamingSenaladoIndex] = useState<number | null>(null);
  const [comentario,      setComentario]      = useState('');
  const [showComentario,  setShowComentario]  = useState(false);
  const [tincion,         setTincion]         = useState('');
  const [showTincion,     setShowTincion]     = useState(false);
  const [multipleSenaladoActivo, setMultipleSenaladoActivo] = useState(false);
  const [multipleSenaladoLabel, setMultipleSenaladoLabel] = useState('');
  const [multipleSenaladoPromptOpen, setMultipleSenaladoPromptOpen] = useState(false);
  const [multipleSenaladoBatchOpen, setMultipleSenaladoBatchOpen] = useState(false);

  const [isSaving,    setIsSaving]    = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError,   setSaveError]   = useState('');

  // ── Borrado de placa en espera ────────────────────────────────────────
  const [deleteTarget,  setDeleteTarget]  = useState<PlacaSinClasificar | null>(null);
  const [isDeleting,    setIsDeleting]    = useState(false);
  const [deleteError,   setDeleteError]   = useState('');

  // ── Cargar datos al montar ────────────────────────────────────────────
  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      const [placasRes, temasRes] = await Promise.all([
        supabase
          .from('placas_sin_clasificar')
          .select('id, photo_url, public_id, created_at')
          .order('created_at', { ascending: true }),
        supabase
          .from('temas')
          .select('id, nombre, parcial, sort_order')
          .order('parcial')
          .order('sort_order', { ascending: true }),
      ]);
      if (placasRes.data) setPlacas(placasRes.data);
      if (temasRes.data) setTemas(temasRes.data);
      setLoading(false);
    };
    fetchAll();
  }, []);

  // ── Resetear form al deseleccionar ────────────────────────────────────
  const resetForm = () => {
    setTemaId(null);
    setSubtemaId(null);
    setSubtemas([]);
    setAumento('');
    setSenalados([]);
    setSenaladosPos([]);
    setEditingSenaladoIndex(null);
    setEditingSenaladoGroup(null);
    setEditingSenaladoGroupLocations([]);
    setNamingSenaladoIndex(null);
    setComentario('');
    setShowComentario(false);
    setTincion('');
    setShowTincion(false);
    setMultipleSenaladoActivo(false);
    setMultipleSenaladoLabel('');
    setMultipleSenaladoPromptOpen(false);
    setMultipleSenaladoBatchOpen(false);
    setSaveSuccess(false);
    setSaveError('');
  };

  const handleSelect = (placa: PlacaSinClasificar) => {
    if (selected?.id === placa.id) {
      setSelected(null);
      resetForm();
      setMiniPage(1);
      return;
    }

    // Abrir modal para elegir Tema/Subtema antes de abrir el editor
    setPreselectPlate(placa);
    setTemaIdTemp(null);
    setSubtemaIdTemp(null);
    setPreselectModalOpen(true);
  };

  // ── Cambio de tema en el form ─────────────────────────────────────────
  const handleTemaChange = async (id: number | null) => {
    setTemaId(id);
    setSubtemaId(null);
    setSubtemas([]);
    if (!id) return;
    setLoadingSubtemas(true);
    const { data } = await supabase
      .from('subtemas')
      .select('id, nombre, tema_id')
      .eq('tema_id', id)
      .order('sort_order', { ascending: true });
    if (data) setSubtemas(data);
    setLoadingSubtemas(false);
  };

  const handleTemaTempChange = async (id: number | null) => {
    setTemaIdTemp(id);
    setSubtemaIdTemp(null);
    setTempSubtemas([]);
    if (!id) return;
    setLoadingTempSubtemas(true);
    const { data } = await supabase
      .from('subtemas')
      .select('id, nombre, tema_id')
      .eq('tema_id', id)
      .order('sort_order', { ascending: true });
    if (data) setTempSubtemas(data);
    setLoadingTempSubtemas(false);
  };

  const appendMultipleSenaladoSlot = useCallback((label: string) => {
    const nextIndex = senalados.length;
    setSenalados(prev => [...prev, label]);
    setSenaladosPos(prev => [...prev, null]);
    setEditingSenaladoIndex(nextIndex);
    return nextIndex;
  }, [senalados.length]);

  const handleAddMultipleSenalado = useCallback(() => {
    setMultipleSenaladoActivo(true);
    setMultipleSenaladoPromptOpen(true);
  }, []);

  const getSenaladoGroupIndices = useCallback((index: number) => {
    const targetLabel = (senalados[index] ?? '').trim();
    return targetLabel
      ? senalados.reduce<number[]>((acc, value, currentIndex) => {
          if ((value ?? '').trim() === targetLabel) acc.push(currentIndex);
          return acc;
        }, [])
      : [index];
  }, [senalados]);

  // ── Clasificar y guardar ───────────────────────────────────────────────
  const handleClasificar = useCallback(async () => {
    if (!selected || !temaId || !subtemaId) return;
    const temaObj = temas.find(t => t.id === temaId);
    const subObj = subtemas.find(s => s.id === subtemaId);
    if (!temaObj || !subObj) return;

    const senaladosPayload = buildSenaladosPayload(senalados, senaladosPos);
    if (senaladosPayload.error) {
      setSaveError(senaladosPayload.error);
      return;
    }

    setIsSaving(true);
    setSaveError('');
    setSaveSuccess(false);

    try {
      const { labels: senalados_filtrados, meta: senalados_meta } = senaladosPayload;
      const { data: createdPlacaId, error } = await supabase.rpc('classify_waiting_plate', {
        p_waiting_id: selected.id,
        p_tema_id: temaId,
        p_subtema_id: subtemaId,
        p_aumento: aumento || null,
        p_senalados: senalados_filtrados.length > 0 ? senalados_filtrados : null,
        p_senalados_meta: senalados_meta.length > 0 ? senalados_meta : null,
        p_comentario: comentario.trim() || null,
        p_tincion: tincion.trim() || null,
      });
      if (error) throw error;

      await logPlateActivity({
        actionType: 'classify_waiting_plate',
        targetTable: 'placas',
        placaId: typeof createdPlacaId === 'number' ? createdPlacaId : null,
        waitingPlateId: selected.id,
        actor: {
          id: user?.id ?? null,
          username: user?.username ?? null,
        },
        details: {
          tema_id: temaId,
          subtema_id: subtemaId,
          aumento: aumento || null,
          source: 'lista_espera',
        },
      });

      setPlacas(prev => prev.filter(p => p.id !== selected.id));
      setSelected(null);
      resetForm();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      console.error('Error al clasificar placa:', err);
      setSaveError('Error al clasificar. Intenta de nuevo.');
    } finally {
      setIsSaving(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, temaId, subtemaId, aumento, senalados, senaladosPos, comentario, tincion, temas, subtemas]);

  const handleDeletePlaca = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      const deleteTargetId = deleteTarget.id;
      const { data: deletedRows, error: deleteRowError } = await supabase
        .from('placas_sin_clasificar')
        .delete()
        .eq('id', deleteTargetId)
        .select('id');

      if (deleteRowError) throw deleteRowError;
      if (!deletedRows?.some(row => row.id === deleteTargetId)) {
        throw new Error('La base de datos no confirmó la eliminación de la placa.');
      }

      try {
        await deleteFromCloudinary({ publicId: deleteTarget.public_id, imageUrl: deleteTarget.photo_url });
      } catch (cloudinaryError) {
        console.warn('La placa se eliminó, pero no fue posible limpiar su imagen de Cloudinary:', cloudinaryError);
      }

      await logPlateActivity({
        actionType: 'delete_unclassified',
        targetTable: 'placas_sin_clasificar',
        waitingPlateId: deleteTargetId,
        actor: {
          id: user?.id ?? null,
          username: user?.username ?? null,
        },
        details: {
          source: 'lista_espera',
        },
      });

      setPlacas(prev => prev.filter(p => p.id !== deleteTargetId));
      setDeleteTarget(null);
    } catch (err) {
      console.error('Error al eliminar placa:', err);
      setDeleteError('Error al eliminar. Intenta de nuevo.');
    } finally {
      setIsDeleting(false);
    }
  };

  const temasByParcial: Record<ParcialKey, Tema[]> = { primer: [], segundo: [], tercer: [] };
  temas.forEach(t => {
    if (temasByParcial[t.parcial as ParcialKey]) {
      temasByParcial[t.parcial as ParcialKey].push(t);
    }
  });

  const temaSeleccionado  = temas.find(t => t.id === temaId) ?? null;
  const subSeleccionado   = subtemas.find(s => s.id === subtemaId) ?? null;
  const canSave           = !!temaId && !!subtemaId && !isSaving;
  const handleGoBack = useSmartBackNavigation('/edicion');

  const totalPages = Math.max(1, Math.ceil(placas.length / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * ITEMS_PER_PAGE;
  const paginatedPlacas = placas.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const remainingPlacas = selected ? placas.filter(p => p.id !== selected.id) : [];
  const miniTotalPages = Math.max(1, Math.ceil(remainingPlacas.length / ITEMS_PER_PAGE));
  const safeMiniPage = Math.min(miniPage, miniTotalPages);
  const miniStart = (safeMiniPage - 1) * ITEMS_PER_PAGE;
  const miniPaginatedPlacas = remainingPlacas.slice(miniStart, miniStart + ITEMS_PER_PAGE);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    if (miniPage > miniTotalPages) setMiniPage(miniTotalPages);
  }, [miniPage, miniTotalPages]);

  return (
    <div style={s.page}>
      <Header />
      <main style={s.main}>

                <BackButton onClick={handleGoBack} />

        {/* Encabezado */}
        <div style={s.pageHeader}>
          <h1 style={s.pageTitle}>⏳ Lista de espera</h1>
          <p style={s.pageSubtitle}>
            Imágenes subidas sin clasificar. Haz clic en una para asignarle tema, subtema y más detalles.
          </p>
          <div style={s.accentLine} />
        </div>

        {/* Estado de carga */}
        {loading ? (
          <div style={s.loadingWrap}>
            <div style={s.spinner} />
            <p style={s.loadingText}>Cargando imágenes...</p>
          </div>
        ) : placas.length === 0 && !saveSuccess ? (
          <div style={s.emptyCard}>
            <span style={{ fontSize: '3em' }}>🎉</span>
            <h2 style={{ margin: '12px 0 6px', fontWeight: 800, color: '#0f172a' }}>
              ¡Lista vacía!
            </h2>
            <p style={{ color: '#64748b', margin: 0 }}>
              No hay imágenes pendientes de clasificar.
            </p>
          </div>
        ) : (
          <>
            {/* Banner de éxito flotante */}
            {saveSuccess && (
              <div style={s.successBanner}>
                ✅ Placa clasificada y guardada correctamente
              </div>
            )}

            {/* Contador */}
            {!selected && (
              <div style={s.countRow}>
                <span style={s.countBadge}>{placas.length}</span>
                <span style={s.countLabel}>
                  {placas.length === 1 ? 'imagen pendiente' : 'imágenes pendientes de clasificar'}
                </span>
                <span style={s.countHint}>— Haz clic en una para clasificarla</span>
                {placas.length > 0 && (
                  <span style={s.pageHint}>
                    Mostrando {startIndex + 1}-{Math.min(startIndex + ITEMS_PER_PAGE, placas.length)}
                  </span>
                )}
              </div>
            )}

            {/* ── Vista: sin selección → grid completo ── */}
            {!selected && (
              <div style={s.card}>
                <div className="placas-gallery-grid">
                  {paginatedPlacas.map((placa, idx) => {
                    const isHov = hoveredCard === placa.id;
                    const absoluteIndex = startIndex + idx;
                    return (
                      <div
                        key={placa.id}
                        className="placa-thumb-wrap"
                        style={{
                          ...s.placaCard,
                          border: isHov ? '2px solid #818cf8' : '1.5px solid #e0e7ff',
                          boxShadow: isHov
                            ? '0 12px 28px rgba(99,102,241,0.22)'
                            : '0 2px 10px rgba(15,23,42,0.10)',
                          transform: isHov ? 'translateY(-4px)' : 'none',
                          cursor: 'pointer',
                        }}
                        onClick={() => handleSelect(placa)}
                        onMouseEnter={() => setHoveredCard(placa.id)}
                        onMouseLeave={() => setHoveredCard(null)}
                      >
                        <div style={s.cardAccent} />
                        <span style={s.positionBadge}>{absoluteIndex + 1}</span>
                        {/* Botón borrar */}
                        <button
                          type="button"
                          title="Eliminar imagen"
                          style={s.cardDeleteBtn}
                          onClick={e => { e.stopPropagation(); setDeleteTarget(placa); }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = '#fff'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.85)'; e.currentTarget.style.color = '#ef4444'; }}
                        >✕</button>
                        <div style={s.imgWrap}>
                          <img
                            src={getCloudinaryImageUrl(placa.photo_url, 'thumb')}
                            srcSet={`${getCloudinaryImageUrl(placa.photo_url, 'thumbSmall')} 320w, ${getCloudinaryImageUrl(placa.photo_url, 'thumb')} 560w`}
                            sizes="(max-width: 560px) 45vw, (max-width: 980px) 30vw, 220px"
                            alt={`Sin clasificar ${absoluteIndex + 1}`}
                            style={s.img}
                            loading="lazy"
                            decoding="async"
                            draggable={false}
                          />
                        </div>
                        <div style={{
                          ...s.cardFooter,
                          background: isHov ? 'linear-gradient(135deg,#ede9fe,#e0e7ff)' : '#f8fafc',
                          borderColor: isHov ? '#c7d2fe' : '#e2e8f0',
                        }}>
                          <span style={{ ...s.cardFooterText, color: isHov ? '#4338ca' : '#94a3b8' }}>
                            {isHov ? '✏️ Clasificar' : 'Clic para clasificar'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {totalPages > 1 && (
                  <div style={s.paginationBar}>
                    <button
                      type="button"
                      style={safePage > 1 ? s.pageBtn : s.pageBtnDisabled}
                      disabled={safePage <= 1}
                      onClick={() => setPage(1)}
                    >
                      « Primera
                    </button>
                    <button
                      type="button"
                      style={safePage > 1 ? s.pageBtn : s.pageBtnDisabled}
                      disabled={safePage <= 1}
                      onClick={() => setPage(prev => Math.max(1, prev - 1))}
                    >
                      ← Anterior
                    </button>
                    <span style={s.pageInfo}>Página {safePage} de {totalPages}</span>
                    <button
                      type="button"
                      style={safePage < totalPages ? s.pageBtn : s.pageBtnDisabled}
                      disabled={safePage >= totalPages}
                      onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                    >
                      Siguiente →
                    </button>
                    <button
                      type="button"
                      style={safePage < totalPages ? s.pageBtn : s.pageBtnDisabled}
                      disabled={safePage >= totalPages}
                      onClick={() => setPage(totalPages)}
                    >
                      Última »
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── Vista: con selección → split layout ── */}
            {selected && (
              <div style={s.splitLayout}>

                {/* Columna izquierda — imagen grande */}
                <div style={s.splitLeft}>
                  <div style={s.card}>
                    <div style={s.selectedImgHeader}>
                      <span style={s.selectedImgTitle}>Imagen seleccionada</span>
                      <button
                        style={s.deselBtn}
                        onClick={() => { setSelected(null); resetForm(); }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#dc2626'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#64748b'; }}
                      >
                        ✕ Deseleccionar
                      </button>
                    </div>
                    <div style={s.bigImgWrap}>
                      <img
                        src={getCloudinaryImageUrl(selected.photo_url, 'view')}
                        alt="Imagen a clasificar"
                        style={s.bigImg}
                        draggable={false}
                      />
                    </div>

                    {/* Mini-grid del resto */}
                    {placas.length > 1 && (
                      <div style={{ marginTop: '20px' }}>
                        <p style={s.restLabel}>Otras imágenes en espera — clic para cambiar selección</p>
                        <div style={s.miniGrid}>
                          {miniPaginatedPlacas.map((placa, idx) => {
                            const isHov = hoveredCard === placa.id;
                            return (
                              <div
                                key={placa.id}
                                style={{
                                  ...s.miniCard,
                                  border: isHov ? '2px solid #818cf8' : '1.5px solid #e0e7ff',
                                  transform: isHov ? 'translateY(-2px)' : 'none',
                                  boxShadow: isHov ? '0 6px 16px rgba(99,102,241,0.2)' : '0 2px 8px rgba(15,23,42,0.08)',
                                }}
                                onClick={() => handleSelect(placa)}
                                onMouseEnter={() => setHoveredCard(placa.id)}
                                onMouseLeave={() => setHoveredCard(null)}
                              >
                                <img
                                  src={getCloudinaryImageUrl(placa.photo_url, 'thumb')}
                                  srcSet={`${getCloudinaryImageUrl(placa.photo_url, 'thumbSmall')} 320w, ${getCloudinaryImageUrl(placa.photo_url, 'thumb')} 560w`}
                                  sizes="80px"
                                  alt={`Mini ${miniStart + idx + 1}`}
                                  style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center center', display: 'block' }}
                                  loading="lazy"
                                  decoding="async"
                                  draggable={false}
                                />
                              </div>
                            );
                          })}
                        </div>
                        {miniTotalPages > 1 && (
                          <div style={{ ...s.paginationBar, marginTop: '12px' }}>
                            <button
                              type="button"
                              style={safeMiniPage > 1 ? s.pageBtn : s.pageBtnDisabled}
                              disabled={safeMiniPage <= 1}
                              onClick={() => setMiniPage(1)}
                            >
                              « Primera
                            </button>
                            <button
                              type="button"
                              style={safeMiniPage > 1 ? s.pageBtn : s.pageBtnDisabled}
                              disabled={safeMiniPage <= 1}
                              onClick={() => setMiniPage(prev => Math.max(1, prev - 1))}
                            >
                              ← Anterior
                            </button>
                            <span style={s.pageInfo}>Página {safeMiniPage} de {miniTotalPages}</span>
                            <button
                              type="button"
                              style={safeMiniPage < miniTotalPages ? s.pageBtn : s.pageBtnDisabled}
                              disabled={safeMiniPage >= miniTotalPages}
                              onClick={() => setMiniPage(prev => Math.min(miniTotalPages, prev + 1))}
                            >
                              Siguiente →
                            </button>
                            <button
                              type="button"
                              style={safeMiniPage < miniTotalPages ? s.pageBtn : s.pageBtnDisabled}
                              disabled={safeMiniPage >= miniTotalPages}
                              onClick={() => setMiniPage(miniTotalPages)}
                            >
                              Última »
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Columna derecha — formulario */}
                <div style={s.splitRight}>
                  <div style={s.card}>
                    <div style={s.formHeader}>
                      <h2 style={s.formTitle}>Clasificar placa</h2>
                      <p style={s.formSubtitle}>
                        Asigna tema y subtema (obligatorio). El resto de campos son opcionales.
                      </p>
                      <div style={s.divider} />
                    </div>

                    {/* Tema — obligatorio */}
                    <div style={s.fieldGroup}>
                      <label style={{ ...s.label, color: '#6366f1' }}>
                        Tema <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <select
                        style={s.select}
                        value={temaId ?? ''}
                        onChange={e => handleTemaChange(e.target.value ? Number(e.target.value) : null)}
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
                    </div>

                    {/* Subtema — obligatorio */}
                    <div style={s.fieldGroup}>
                      <label style={{ ...s.label, color: '#6366f1' }}>
                        Subtema <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      {loadingSubtemas ? (
                        <div style={s.inlineLoading}><div style={s.spinnerSm} /> Cargando...</div>
                      ) : (
                        <select
                          style={{
                            ...s.select,
                            ...(!temaId ? s.selectDisabled : {}),
                          }}
                          value={subtemaId ?? ''}
                          disabled={!temaId || subtemas.length === 0}
                          onChange={e => setSubtemaId(e.target.value ? Number(e.target.value) : null)}
                        >
                          <option value="">
                            {!temaId
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

                    {/* Destino calculado */}
                    {temaSeleccionado && subSeleccionado && (
                      <div style={s.destInfo}>
                        <span style={s.destLabel}>📁 Destino:</span>
                        <span style={s.destValue}>
                          {temaSeleccionado.nombre} › {subSeleccionado.nombre}
                        </span>
                      </div>
                    )}

                    <div style={s.divider} />

                    {/* Aumento */}
                    <div style={s.fieldGroup}>
                      <label style={s.label}>🔬 Aumento</label>
                      <div style={s.aumentoGroup}>
                        {['x4', 'x10', 'x40', 'x50', 'x100'].map(op => (
                          <button
                            key={op}
                            type="button"
                            style={aumento === op ? s.aumentoBtnActive : s.aumentoBtn}
                            onClick={() => setAumento(prev => prev === op ? '' : op)}
                          >
                            {op}
                          </button>
                        ))}
                      </div>
                    </div>

                    <PlateEditorPanel
                      title="Clasificar placa"
                      imageSrc={getCloudinaryImageUrl(selected.photo_url, 'thumb')}
                      imageAlt="Miniatura de la placa en lista de espera"
                      primaryActionLabel="💾 Clasificar y guardar placa"
                      primaryActionLoading={isSaving}
                      primaryActionDisabled={!canSave || isSaving}
                      primaryActionFeedback={saveError || (saveSuccess ? 'Placa clasificada correctamente.' : '')}
                      primaryActionFeedbackTone={saveError ? 'error' : saveSuccess ? 'success' : 'info'}
                      onPrimaryAction={handleClasificar}
                      aumento={aumento}
                      onAumentoChange={setAumento}
                      showTincion={showTincion}
                      onShowTincion={() => setShowTincion(true)}
                      tincion={tincion}
                      onTincionChange={setTincion}
                      senalados={senalados}
                      senaladosPos={senaladosPos}
                      onSenaladoChange={(index, value) => {
                        setSenalados(previous => {
                          const updated = [...previous];
                          updated[index] = value;
                          return updated;
                        });
                      }}
                      onRemoveSenalado={(index) => {
                        const groupIndices = getSenaladoGroupIndices(index);

                        if (groupIndices.length > 1) {
                          setSenalados(prev => prev.filter((_, currentIndex) => !groupIndices.includes(currentIndex)));
                          setSenaladosPos(prev => prev.filter((_, currentIndex) => !groupIndices.includes(currentIndex)));
                          return;
                        }

                        setSenalados(prev => prev.filter((_, i) => i !== index));
                        setSenaladosPos(prev => prev.filter((_, i) => i !== index));
                      }}
                      onOpenSenaladoLocation={(index) => {
                        const groupIndices = getSenaladoGroupIndices(index);
                        const targetLabel = (senalados[index] ?? '').trim();

                        if (groupIndices.length > 1) {
                          setEditingSenaladoGroup({ label: targetLabel, indices: groupIndices });
                          setEditingSenaladoGroupLocations(groupIndices.map(currentIndex => senaladosPos[currentIndex] ?? null));
                          setEditingSenaladoIndex(null);
                          return;
                        }

                        setEditingSenaladoIndex(index);
                      }}
                      onAddSenalado={() => {
                        const nextIndex = senalados.length;
                        setSenalados(prev => [...prev, '']);
                        setSenaladosPos(prev => [...prev, null]);
                        setEditingSenaladoIndex(nextIndex);
                      }}
                      onAddMultipleSenalado={handleAddMultipleSenalado}
                      onAddBorderSenalado={() => {
                        const nextIndex = senalados.length;
                        setSenalados(prev => [...prev, '']);
                        setSenaladosPos(prev => [...prev, null]);
                        setBorderSenaladoIndex(nextIndex);
                        setEditingSenaladoIndex(nextIndex);
                      }}
                      showComentario={showComentario}
                      onShowComentario={() => setShowComentario(true)}
                      comentario={comentario}
                      onComentarioChange={setComentario}
                      onClearComentario={() => { setComentario(''); setShowComentario(false); }}
                      onRequestClose={() => {
                        setSelected(null);
                        resetForm();
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <Footer />
      <LoadingToast visible={isSaving} type="saving" message="Clasificando placa" />

      {editingSenaladoIndex !== null && selected && (
        <SenaladoLocationPicker
          key={`senalado-${editingSenaladoIndex}`}
          imageSrc={getCloudinaryImageUrl(selected.photo_url, 'view')}
          senaladoLabel={senalados[editingSenaladoIndex] ?? ''}
          initialLocation={senaladosPos[editingSenaladoIndex] ?? null}
          borderMode={borderSenaladoIndex === editingSenaladoIndex || Boolean(senaladosPos[editingSenaladoIndex]?.regionPoints?.length)}
          onCancel={() => {
            setEditingSenaladoIndex(null);
            setBorderSenaladoIndex(null);
            setNamingSenaladoIndex(null);
            setMultipleSenaladoActivo(false);
            setMultipleSenaladoLabel('');
            setMultipleSenaladoPromptOpen(false);
            setMultipleSenaladoBatchOpen(false);
          }}
          onRemove={() => {
            const targetIndex = editingSenaladoIndex;
            setSenalados(prev => prev.filter((_, i) => i !== targetIndex));
            setSenaladosPos(prev => prev.filter((_, i) => i !== targetIndex));
            setEditingSenaladoIndex(null);
            setBorderSenaladoIndex(null);
            setNamingSenaladoIndex(null);
            setMultipleSenaladoActivo(false);
            setMultipleSenaladoLabel('');
            setMultipleSenaladoPromptOpen(false);
            setMultipleSenaladoBatchOpen(false);
          }}
          onSave={(location) => {
            const targetIndex = editingSenaladoIndex;
            setSenaladosPos(prev => {
              const next = [...prev];
              next[targetIndex] = location;
              return next;
            });
            setBorderSenaladoIndex(null);

            const currentLabel = (senalados[targetIndex] ?? '').trim();
            if (!currentLabel) {
              setNamingSenaladoIndex(targetIndex);
              setEditingSenaladoIndex(null);
              return;
            }

            if (multipleSenaladoActivo) {
              setMultipleSenaladoLabel(currentLabel);
              appendMultipleSenaladoSlot(currentLabel);
              return;
            }

            setEditingSenaladoIndex(null);
          }}
        />
      )}

      {editingSenaladoGroup && selected && (
        <SenaladoLocationPicker
          key={`senalado-group-${editingSenaladoGroup.label}-${editingSenaladoGroup.indices.join('-')}`}
          imageSrc={getCloudinaryImageUrl(selected.photo_url, 'view')}
          senaladoLabel={editingSenaladoGroup.label}
          batchMode
          batchSaveLabel="Guardar cambios del grupo"
          initialBatchLocations={editingSenaladoGroupLocations.filter((location): location is MarkerLocation => location !== null)}
          onCancel={() => {
            setEditingSenaladoGroup(null);
            setEditingSenaladoGroupLocations([]);
          }}
          onSave={() => {}}
          onBatchSave={(locations) => {
            const targetIndices = editingSenaladoGroup.indices;
            const firstIndex = targetIndices[0] ?? 0;

            setSenalados(prev => {
              const remaining = prev.filter((_, currentIndex) => !targetIndices.includes(currentIndex));
              remaining.splice(firstIndex, 0, ...locations.map(() => editingSenaladoGroup.label));
              return remaining;
            });

            setSenaladosPos(prev => {
              const remaining = prev.filter((_, currentIndex) => !targetIndices.includes(currentIndex));
              remaining.splice(firstIndex, 0, ...locations);
              return remaining;
            });

            setEditingSenaladoGroup(null);
            setEditingSenaladoGroupLocations([]);
          }}
        />
      )}

      {namingSenaladoIndex !== null && (
        <RequiredTextPromptModal
          title="Nombre del señalado"
          description="Después de ubicar el señalado, debes escribir su nombre para continuar."
          placeholder="Ej: Membrana basal"
          required
          cancelLabel="Cancelar y señalar de nuevo"
          onCancel={() => {
            const targetIndex = namingSenaladoIndex;
            setNamingSenaladoIndex(null);
            setEditingSenaladoIndex(targetIndex);
          }}
          onSubmit={(value) => {
            const normalized = value.trim();
            setSenalados(prev => {
              const next = [...prev];
              next[namingSenaladoIndex] = normalized;
              return next;
            });
            setNamingSenaladoIndex(null);
            if (multipleSenaladoActivo) {
              appendMultipleSenaladoSlot(normalized);
            }
          }}
        />
      )}

      {multipleSenaladoPromptOpen && (
        <RequiredTextPromptModal
          title="Nombre del grupo de señalados"
          description="Escribe el nombre común que se repetirá para todos los puntos que vas a capturar ahora."
          placeholder="Ej: Células basales"
          required
          cancelLabel="Cancelar"
          onCancel={() => {
            setMultipleSenaladoActivo(false);
            setMultipleSenaladoLabel('');
            setMultipleSenaladoPromptOpen(false);
          }}
          onSubmit={(value) => {
            const normalized = value.trim();
            setMultipleSenaladoLabel(normalized);
            setMultipleSenaladoPromptOpen(false);
            setMultipleSenaladoBatchOpen(true);
          }}
        />
      )}

      {multipleSenaladoBatchOpen && selected && (
        <SenaladoLocationPicker
          imageSrc={getCloudinaryImageUrl(selected.photo_url, 'view')}
          senaladoLabel={multipleSenaladoLabel}
          batchMode
          batchSaveLabel="Guardar todos"
          onCancel={() => {
            setMultipleSenaladoBatchOpen(false);
            setMultipleSenaladoActivo(false);
            setMultipleSenaladoLabel('');
          }}
          onSave={() => {}}
          onBatchSave={(locations) => {
            if (locations.length === 0) return;
            setSenalados(prev => [...prev, ...locations.map(() => multipleSenaladoLabel)]);
            setSenaladosPos(prev => [...prev, ...locations]);
            setMultipleSenaladoBatchOpen(false);
            setMultipleSenaladoActivo(false);
            setMultipleSenaladoLabel('');
          }}
        />
      )}

      {preselectModalOpen && preselectPlate && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}
          onClick={() => { setPreselectModalOpen(false); setPreselectPlate(null); }}
        >
          <div style={{ maxWidth: '720px', width: '92%' }} onClick={e => e.stopPropagation()}>
            <div style={{ background: 'rgba(248,250,252,0.9)', borderRadius: '12px', border: '1px solid rgba(15,23,42,0.08)', overflow: 'hidden', marginTop: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', borderBottom: '1px solid rgba(15,23,42,0.07)', background: 'rgba(255,255,255,0.6)' }}>
                <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg,#10b981,#34d399)' }} />
                <span style={{ fontSize: '0.9em', fontWeight: 700, color: '#0f172a' }}>Selecciona tema y subtema</span>
              </div>

              <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: 'minmax(220px, 280px) minmax(0, 1fr)', gap: '16px', alignItems: 'start' }}>
                <aside style={{ borderRadius: '18px', border: '1px solid #dbeafe', background: 'linear-gradient(180deg, #eff6ff 0%, #ffffff 100%)', boxShadow: '0 16px 40px rgba(15, 23, 42, 0.10)', padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ fontSize: '0.88em', fontWeight: 900, color: '#1e293b' }}>Miniatura</div>
                    <div style={{ fontSize: '0.82em', color: '#64748b' }}>Placa que esta editando</div>
                  </div>
                  <div style={{ borderRadius: '18px', overflow: 'hidden', background: '#0f172a', border: '1px solid rgba(148, 163, 184, 0.35)', aspectRatio: '3 / 4', minHeight: '340px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img
                      src={getCloudinaryImageUrl(preselectPlate.photo_url, 'view')}
                      alt="Miniatura de la placa en lista de espera"
                      style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                    />
                  </div>
                </aside>

                <div style={{ minHeight: 0, overflow: 'auto', paddingRight: '4px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  <div style={{ padding: '12px 14px', borderRadius: '10px', background: '#eff6ff', border: '1.5px solid #bfdbfe', color: '#1d4ed8', fontSize: '0.88em', fontWeight: 600, lineHeight: 1.5 }}>
                    Esta selección solo prepara la placa dentro del editor. Nada se guarda hasta pulsar <strong>💾 Clasificar y guardar placa</strong>.
                  </div>

                  <div style={s.fieldGroup}>
                    <label style={{ ...s.label, color: '#6366f1' }}>
                      Tema <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <select
                      style={s.select}
                      value={temaIdTemp ?? ''}
                      onChange={e => handleTemaTempChange(e.target.value ? Number(e.target.value) : null)}
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
                  </div>

                  <div style={s.fieldGroup}>
                    <label style={{ ...s.label, color: '#6366f1' }}>
                      Subtema <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    {temaIdTemp ? (
                      loadingTempSubtemas ? (
                        <div style={s.inlineLoading}>
                          <div style={s.spinnerSm} />
                          Cargando subtemas...
                        </div>
                      ) : (
                        <select
                          style={{
                            ...s.select,
                            ...(!temaIdTemp ? s.selectDisabled : {}),
                          }}
                          value={subtemaIdTemp ?? ''}
                          onChange={e => setSubtemaIdTemp(e.target.value ? Number(e.target.value) : null)}
                          disabled={tempSubtemas.length === 0}
                        >
                          <option value="">
                            {tempSubtemas.length === 0 ? '— Sin subtemas —' : '— Elige un subtema —'}
                          </option>
                          {tempSubtemas.map(s => (
                            <option key={s.id} value={s.id}>{s.nombre}</option>
                          ))}
                        </select>
                      )
                    ) : (
                      <div style={s.inlineLoading}>
                        — Primero elige un tema —
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px', flexWrap: 'wrap' }}>
                    <button type="button" style={{ padding: '9px 20px', borderRadius: '8px', border: '1.5px solid #cbd5e1', background: '#f8fafc', color: '#475569', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.92em' }} onClick={() => { setPreselectModalOpen(false); setPreselectPlate(null); setTemaIdTemp(null); setSubtemaIdTemp(null); setTempSubtemas([]); }}>Cancelar</button>
                    <button type="button" style={{ padding: '9px 20px', borderRadius: '8px', border: 'none', background: (temaIdTemp && subtemaIdTemp) ? 'linear-gradient(135deg,#10b981,#34d399)' : '#e2e8f0', color: (temaIdTemp && subtemaIdTemp) ? '#fff' : '#94a3b8', fontWeight: 700, cursor: (temaIdTemp && subtemaIdTemp) ? 'pointer' : 'not-allowed', fontFamily: 'inherit', fontSize: '0.92em' }} disabled={!temaIdTemp || !subtemaIdTemp} onClick={() => {
                      if (!preselectPlate) return;
                      resetForm();
                      setSelected(preselectPlate);
                      setTemaId(temaIdTemp);
                      setSubtemaId(subtemaIdTemp);
                      setSubtemas(tempSubtemas);
                      setPreselectModalOpen(false);
                      setPreselectPlate(null);
                      setMiniPage(1);
                    }}>
                      Abrir editor
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmación borrar placa de espera */}
      {deleteTarget && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}
          onClick={() => !isDeleting && setDeleteTarget(null)}
        >
          <div
            style={{ background: '#fff', borderRadius: '16px', padding: '32px', maxWidth: '420px', width: '90%', boxShadow: '0 20px 60px rgba(15,23,42,0.25)' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 12px', fontSize: '1.1em', fontWeight: 800, color: '#0f172a' }}>⚠️ Eliminar imagen</h3>
            <p style={{ margin: '0 0 24px', color: '#475569', fontSize: '0.95em' }}>
              Esta imagen será borrada permanentemente de la lista de espera y de Cloudinary. Esta acción es <strong>irreversible</strong>.
            </p>
            {deleteError && (
              <p style={{ color: '#dc2626', fontSize: '0.88em', marginBottom: '12px' }}>{deleteError}</p>
            )}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                style={{ padding: '9px 20px', borderRadius: '8px', border: '1.5px solid #cbd5e1', background: '#f8fafc', color: '#475569', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.92em' }}
                onClick={() => { setDeleteTarget(null); setDeleteError(''); }}
                disabled={isDeleting}
              >Cancelar</button>
              <button
                style={{ padding: '9px 20px', borderRadius: '8px', border: 'none', background: isDeleting ? '#fca5a5' : 'linear-gradient(135deg,#ef4444,#dc2626)', color: '#fff', fontWeight: 700, cursor: isDeleting ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: '0.92em' }}
                onClick={handleDeletePlaca}
                disabled={isDeleting}
              >{isDeleting ? 'Eliminando...' : '🗑️ Sí, eliminar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const s: { [key: string]: React.CSSProperties } = {
  page: {
    minHeight: '100vh',
    background: 'transparent',
    color: '#0f172a',
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    display: 'flex',
    flexDirection: 'column',
  },
  main: {
    flex: 1,
    width: '100%',
    maxWidth: '1400px',
    margin: '0 auto',
    padding: 'clamp(16px, 3vw, 40px) clamp(12px, 3vw, 40px) clamp(24px, 4vw, 60px)',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  breadcrumb: {
    display: 'inline-flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap',
    background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(8px)',
    border: '1px solid rgba(186,230,253,0.6)', borderRadius: '12px',
    padding: '8px 16px', boxShadow: '0 2px 8px rgba(14,165,233,0.07)',
  },
  breadcrumbLink: {
    background: 'none', border: 'none', cursor: 'pointer', color: '#0ea5e9',
    fontWeight: 600, fontSize: '0.88em', padding: '4px 8px', borderRadius: '8px',
    transition: 'background 0.15s', fontFamily: 'inherit',
  },
  breadcrumbSep: { color: '#94a3b8', fontWeight: 700, fontSize: '0.75em' },
  breadcrumbCurrent: {
    color: '#0f172a', fontWeight: 800, fontSize: '0.88em', padding: '4px 8px',
    background: 'linear-gradient(135deg,#e0e7ff,#ede9fe)', borderRadius: '8px',
    border: '1px solid #c7d2fe',
  },
  pageHeader: {
    display: 'flex', flexDirection: 'column', gap: '6px',
  },
  pageTitle: {
    fontSize: 'clamp(1.6em, 4vw, 2.4em)', fontWeight: 900, color: '#0f172a',
    letterSpacing: '-0.03em', margin: 0,
  },
  pageSubtitle: { fontSize: 'clamp(0.88em, 2vw, 1em)', color: '#64748b', margin: 0, lineHeight: 1.6 },
  accentLine: {
    marginTop: '10px', width: '56px', height: '4px',
    background: 'linear-gradient(90deg, #6366f1, #a78bfa)', borderRadius: '4px',
  },
  loadingWrap: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: '16px', padding: '80px 0',
  },
  spinner: {
    width: '48px', height: '48px', borderRadius: '50%',
    border: '4px solid #e0e7ff', borderTop: '4px solid #6366f1',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: { color: '#6366f1', fontWeight: 600, margin: 0 },
  spinnerSm: {
    width: '18px', height: '18px', borderRadius: '50%',
    border: '3px solid #e0e7ff', borderTop: '3px solid #818cf8',
    animation: 'spin 0.8s linear infinite', flexShrink: 0,
  },
  inlineLoading: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '12px 16px', fontSize: '0.9em', color: '#64748b',
    background: '#f8fafc', borderRadius: '10px', border: '1.5px solid #e2e8f0',
  },
  emptyCard: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: '4px', padding: '60px 40px',
    background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
    borderRadius: '20px', textAlign: 'center',
    boxShadow: '0 20px 50px rgba(15,23,42,0.10)',
    border: '1px solid rgba(99,102,241,0.1)',
  },
  successBanner: {
    padding: '14px 20px', borderRadius: '12px',
    background: 'linear-gradient(135deg, #dcfce7, #bbf7d0)',
    border: '1.5px solid #86efac', color: '#15803d',
    fontWeight: 700, fontSize: '0.95em',
    boxShadow: '0 4px 12px rgba(21,128,61,0.12)',
  },
  countRow: {
    display: 'flex', alignItems: 'center', gap: '10px',
    flexWrap: 'wrap',
  },
  countBadge: {
    background: 'linear-gradient(135deg, #6366f1, #818cf8)',
    color: '#fff', borderRadius: '20px', padding: '3px 12px',
    fontSize: '0.9em', fontWeight: 800,
  },
  countLabel: { fontWeight: 700, color: '#0f172a', fontSize: '0.95em' },
  countHint: { color: '#94a3b8', fontSize: '0.88em' },
  pageHint: {
    color: '#475569',
    fontSize: '0.84em',
    fontWeight: 600,
    background: '#eef2ff',
    border: '1px solid #c7d2fe',
    borderRadius: '999px',
    padding: '2px 10px',
  },
  paginationBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    marginTop: '14px',
    flexWrap: 'wrap',
  },
  pageBtn: {
    border: '1px solid #c7d2fe',
    background: '#eef2ff',
    color: '#4338ca',
    borderRadius: '8px',
    padding: '6px 12px',
    fontSize: '0.84em',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  pageBtnDisabled: {
    border: '1px solid #e2e8f0',
    background: '#f8fafc',
    color: '#94a3b8',
    borderRadius: '8px',
    padding: '6px 12px',
    fontSize: '0.84em',
    fontWeight: 700,
    cursor: 'not-allowed',
    fontFamily: 'inherit',
  },
  pageInfo: {
    fontSize: '0.84em',
    color: '#334155',
    fontWeight: 700,
  },
  card: {
    background: 'transparent',
    borderRadius: '20px',
    padding: 'clamp(16px, 2.5vw, 32px)',
    boxShadow: 'none',
    border: 'none',
  },
  placaCard: {
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
    border: '1.5px solid #e0e7ff',
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
    userSelect: 'none',
  },
  cardAccent: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
    background: 'linear-gradient(90deg, #6366f1, #a78bfa)',
    borderRadius: '12px 12px 0 0', zIndex: 1,
  },
  positionBadge: {
    position: 'absolute', top: '10px', left: '10px',
    background: 'rgba(15,23,42,0.55)', color: '#ffffff',
    fontSize: '0.72em', fontWeight: 800, borderRadius: '6px',
    padding: '2px 7px', lineHeight: 1.5, zIndex: 2, backdropFilter: 'blur(4px)',
  },
  cardDeleteBtn: {
    position: 'absolute', top: '10px', right: '10px',
    width: '26px', height: '26px', borderRadius: '50%',
    border: '1.5px solid #fca5a5', background: 'rgba(255,255,255,0.85)',
    color: '#ef4444', fontWeight: 700, fontSize: '0.8em',
    cursor: 'pointer', zIndex: 3, display: 'flex', alignItems: 'center',
    justifyContent: 'center', lineHeight: 1, fontFamily: 'inherit',
    transition: 'background 0.15s, color 0.15s',
    backdropFilter: 'blur(4px)',
  },
  imgWrap: {
    width: '100%', aspectRatio: '1 / 1', overflow: 'hidden',
    background: '#e2e8f0', flexShrink: 0,
  },
  img: {
    width: '100%', height: '100%', objectFit: 'cover',
    objectPosition: 'center center',
    display: 'block', pointerEvents: 'none',
  },
  cardFooter: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '8px 10px', borderTop: '1px solid #e2e8f0',
    transition: 'background 0.2s, border-color 0.2s',
  },
  cardFooterText: {
    fontSize: '0.75em', fontWeight: 600, letterSpacing: '0.02em',
  },

  // ── Split layout ───────────────────────────────────────────────────────
  splitLayout: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '24px',
    alignItems: 'start',
  } as React.CSSProperties,
  splitLeft: { display: 'flex', flexDirection: 'column', gap: '0' },
  splitRight: { display: 'flex', flexDirection: 'column', gap: '0' },

  selectedImgHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: '16px',
  },
  selectedImgTitle: {
    fontSize: '0.85em', fontWeight: 700, color: '#6366f1',
    letterSpacing: '0.04em', textTransform: 'uppercase' as const,
  },
  deselBtn: {
    background: '#f1f5f9', border: '1.5px solid #e2e8f0',
    borderRadius: '8px', padding: '6px 12px', fontSize: '0.82em',
    fontWeight: 600, cursor: 'pointer', color: '#64748b',
    fontFamily: 'inherit', transition: 'all 0.15s',
  },
  bigImgWrap: {
    width: '100%', aspectRatio: '4 / 3' as const,
    overflow: 'hidden', borderRadius: '12px',
    border: '2px solid #c7d2fe', background: '#e0e7ff',
  } as React.CSSProperties,
  bigImg: {
    width: '100%', height: '100%', objectFit: 'cover',
    objectPosition: 'center center',
    display: 'block', pointerEvents: 'none',
  },
  restLabel: {
    fontSize: '0.78em', fontWeight: 600, color: '#94a3b8',
    margin: '0 0 10px', letterSpacing: '0.03em',
  },
  miniGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))',
    gap: '8px',
  },
  miniCard: {
    aspectRatio: '1 / 1' as const, borderRadius: '8px', overflow: 'hidden',
    cursor: 'pointer', border: '1.5px solid #e0e7ff',
    transition: 'all 0.18s',
  } as React.CSSProperties,

  // ── Formulario ─────────────────────────────────────────────────────────
  formHeader: { marginBottom: '20px' },
  formTitle: {
    fontSize: 'clamp(1.1em,2vw,1.5em)', fontWeight: 800, color: '#0f172a',
    margin: '0 0 6px', letterSpacing: '-0.02em',
  },
  formSubtitle: { fontSize: '0.88em', color: '#64748b', margin: '0 0 14px' },
  divider: {
    width: '56px', height: '4px',
    background: 'linear-gradient(90deg, #6366f1, #a78bfa)',
    borderRadius: '4px', marginBottom: '20px',
  },
  fieldGroup: { marginBottom: '18px' },
  label: {
    display: 'block', fontSize: '0.875em', fontWeight: 700,
    color: '#475569', letterSpacing: '0.03em', marginBottom: '8px',
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
    outline: 'none', boxSizing: 'border-box' as const,
  },
  selectDisabled: { opacity: 0.55, cursor: 'not-allowed' },
  destInfo: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '10px 14px', borderRadius: '10px',
    background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)',
    border: '1.5px solid #86efac', marginBottom: '18px',
  },
  destLabel: { fontSize: '0.85em', fontWeight: 700, color: '#15803d' },
  destValue: { fontSize: '0.9em', fontWeight: 600, color: '#166534' },
  aumentoGroup: { display: 'flex', gap: '8px', flexWrap: 'wrap' as const },
  aumentoBtn: {
    padding: '7px 14px', borderRadius: '20px', border: '2px solid #c7d2fe',
    background: '#f5f3ff', cursor: 'pointer', fontSize: '0.9em', fontWeight: 600,
    color: '#6366f1', transition: 'all 0.15s', fontFamily: 'inherit',
  },
  aumentoBtnActive: {
    padding: '7px 14px', borderRadius: '20px', border: '2px solid #6366f1',
    background: 'linear-gradient(135deg, #6366f1, #818cf8)', cursor: 'pointer',
    fontSize: '0.9em', fontWeight: 700, color: '#fff', transition: 'all 0.15s',
    fontFamily: 'inherit',
  },
  addOptBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '7px 14px', borderRadius: '8px', border: '2px dashed #fde68a',
    background: '#fffbeb', color: '#b45309', cursor: 'pointer',
    fontSize: '0.88em', fontWeight: 600, fontFamily: 'inherit',
    transition: 'background 0.15s',
  },
  clearOptBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '6px',
    padding: '6px 12px', borderRadius: '8px', border: '1.5px solid #fde68a',
    background: '#fff7ed', color: '#92400e', cursor: 'pointer',
    fontSize: '0.82em', fontWeight: 600, fontFamily: 'inherit',
  },
  tincionField: {
    width: '100%', padding: '10px 12px', fontSize: '0.95em',
    border: '2px solid #fde68a', borderRadius: '8px', outline: 'none',
    boxSizing: 'border-box' as const, fontFamily: 'inherit', color: '#2c3e50',
    background: '#fffbeb', transition: 'border-color 0.2s',
  },
  senalRow: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' },
  senalNum: {
    minWidth: '26px', height: '26px', borderRadius: '50%',
    background: 'linear-gradient(135deg, #6366f1, #818cf8)', color: '#fff',
    fontWeight: 700, fontSize: '0.85em', display: 'flex',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  senalInput: {
    flex: 1, padding: '8px 12px', fontSize: '0.9em',
    border: '1.5px solid #c7d2fe', borderRadius: '8px', outline: 'none',
    fontFamily: 'inherit', color: '#0f172a', background: '#f8fafc',
    transition: 'border-color 0.2s',
  },
  senalRemBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: '#ef4444', fontSize: '1.1em', padding: '0 4px',
  },
  addSenalBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '7px 14px', borderRadius: '8px', border: '2px dashed #818cf8',
    background: '#f5f3ff', color: '#6366f1', cursor: 'pointer',
    fontSize: '0.88em', fontWeight: 600, marginTop: '4px',
    fontFamily: 'inherit', transition: 'background 0.15s',
  },
  addComentBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '7px 14px', borderRadius: '8px', border: '2px dashed #6366f1',
    background: '#f5f3ff', color: '#4f46e5', cursor: 'pointer',
    fontSize: '0.88em', fontWeight: 600, fontFamily: 'inherit',
    transition: 'background 0.15s',
  },
  comentarioField: {
    width: '100%', padding: '10px 12px', fontSize: '0.95em',
    border: '2px solid #c7d2fe', borderRadius: '8px', outline: 'none',
    boxSizing: 'border-box' as const, fontFamily: 'inherit', color: '#0f172a',
    resize: 'vertical' as const, minHeight: '80px', background: 'transparent',
    transition: 'border-color 0.2s',
  },
  errorMsg: {
    padding: '10px 14px', borderRadius: '10px',
    background: '#fee2e2', border: '1px solid #fca5a5',
    color: '#b91c1c', fontWeight: 600, fontSize: '0.88em',
    marginBottom: '12px',
  },
  saveBtn: {
    width: '100%', padding: '13px', borderRadius: '10px', border: 'none',
    background: 'linear-gradient(135deg, #6366f1, #818cf8)',
    color: '#fff', fontSize: '0.97em', fontWeight: 700,
    cursor: 'pointer', marginTop: '4px', transition: 'all 0.2s',
    fontFamily: 'inherit',
  },
  saveBtnDisabled: {
    width: '100%', padding: '13px', borderRadius: '10px', border: 'none',
    background: '#e0e7ff', color: '#6366f1', fontSize: '0.97em',
    fontWeight: 700, cursor: 'not-allowed', marginTop: '4px',
    opacity: 0.65, fontFamily: 'inherit',
  },

};

export default ListaEspera;






