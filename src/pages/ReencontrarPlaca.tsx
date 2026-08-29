import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Upload,
  CheckCircle,
  XCircle,
  Eye,
  ArrowLeft,
  Image as ImageIcon,
  Sparkles,
  Layers,
  MapPin,
  RefreshCw,
  FolderOpen,
  Info,
  Trash2,
  AlertCircle,
  SkipForward,
} from 'lucide-react';
import { describeSupabaseError, supabase } from '../services/supabase';
import { uploadToCloudinary, slugify } from '../services/cloudinary';
import { logPlateActivity } from '../services/plateActivityAudit';
import { useAuth } from '../contexts/AuthContext';
import { getCachedSubtemas, getQuickSubtemas } from '../services/catalogService';
import Header from '../components/Header';
import Footer from '../components/Footer';
import BackButton from '../components/BackButton';
import LoadingToast from '../components/LoadingToast';
import ImageViewerModal from '../components/ImageViewerModal';
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

interface SenaladoMetaItem {
  label: string;
  x: number | null;
  y: number | null;
  startX?: number | null;
  startY?: number | null;
  regionPoints?: number[] | null;
  regionHoles?: number[][] | null;
  regionColor?: string | null;
  regionOpacity?: number | null;
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

interface CandidateImage {
  id: string;
  file: File;
  previewUrl: string;
  name: string;
  size: number;
}

type ParcialKey = 'primer' | 'segundo' | 'tercer';

const PARCIALES: { key: ParcialKey; label: string }[] = [
  { key: 'primer',  label: 'Primer parcial'  },
  { key: 'segundo', label: 'Segundo parcial' },
  { key: 'tercer',  label: 'Tercer parcial'  },
];

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const MATCHED_PLACAS_STORAGE_KEY = 'atlas_reencontrar_matched_placas';
const NOT_FOUND_PLACAS_STORAGE_KEY = 'atlas_reencontrar_not_found_placas';

const ReencontrarPlaca: React.FC = () => {
  const { user } = useAuth();
  const handleGoBack = useSmartBackNavigation('/placas');

  // ── Selección de Contexto ──────────────────────────────────────────────
  const [temas, setTemas] = useState<Tema[]>([]);
  const [subtemas, setSubtemas] = useState<Subtema[]>([]);
  const [placas, setPlacas] = useState<Placa[]>([]);
  const [placasConMapa, setPlacasConMapa] = useState<Set<number>>(new Set());

  const [selectedParcial, setSelectedParcial] = useState<ParcialKey>('primer');
  const [selectedTemaId, setSelectedTemaId] = useState<number | null>(null);
  const [selectedSubtemaId, setSelectedSubtemaId] = useState<number | null>(null);

  const [loadingTemas, setLoadingTemas] = useState(true);
  const [loadingSubtemas, setLoadingSubtemas] = useState(false);
  const [loadingPlacas, setLoadingPlacas] = useState(false);

  // ── Placa Activa para Emparejar & Persistencia ──────────────────────────
  const [selectedPlacaId, setSelectedPlacaId] = useState<number | null>(null);
  const [matchedPlacaIds, setMatchedPlacaIds] = useState<Set<number>>(() => {
    try {
      const saved = localStorage.getItem(MATCHED_PLACAS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return new Set(parsed.map(Number));
        }
      }
    } catch (err) {
      console.error('Error cargando placas emparejadas desde localStorage:', err);
    }
    return new Set<number>();
  });

  const [notFoundPlacaIds, setNotFoundPlacaIds] = useState<Set<number>>(() => {
    try {
      const saved = localStorage.getItem(NOT_FOUND_PLACAS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return new Set(parsed.map(Number));
        }
      }
    } catch (err) {
      console.error('Error cargando placas no encontradas desde localStorage:', err);
    }
    return new Set<number>();
  });

  const [filterPlacasMode, setFilterPlacasMode] = useState<'todas' | 'pendientes' | 'vinculadas' | 'no_encontradas'>('todas');
  const [activeMarkerIndex, setActiveMarkerIndex] = useState<number | null>(null);
  const [activeMapSectionIndex, setActiveMapSectionIndex] = useState<number | null>(null);

  // Sincronizar matchedPlacaIds con localStorage
  useEffect(() => {
    try {
      localStorage.setItem(MATCHED_PLACAS_STORAGE_KEY, JSON.stringify(Array.from(matchedPlacaIds)));
    } catch (err) {
      console.error('Error guardando placas emparejadas en localStorage:', err);
    }
  }, [matchedPlacaIds]);

  // Sincronizar notFoundPlacaIds con localStorage
  useEffect(() => {
    try {
      localStorage.setItem(NOT_FOUND_PLACAS_STORAGE_KEY, JSON.stringify(Array.from(notFoundPlacaIds)));
    } catch (err) {
      console.error('Error guardando placas no encontradas en localStorage:', err);
    }
  }, [notFoundPlacaIds]);

  // Al cambiar de placa seleccionada, reseteamos el señalado activo
  useEffect(() => {
    setActiveMarkerIndex(null);
    setActiveMapSectionIndex(null);
  }, [selectedPlacaId]);

  // ── Imágenes Locales Candidatas ─────────────────────────────────────────
  const [candidates, setCandidates] = useState<CandidateImage[]>([]);
  const [currentCandidateIndex, setCurrentCandidateIndex] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Estado de Visor y Guardado ─────────────────────────────────────────
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [saveErrorMsg, setSaveErrorMsg] = useState<string | null>(null);

  // ── Cargar Temas ───────────────────────────────────────────────────────
  const fetchTemas = useCallback(async () => {
    setLoadingTemas(true);
    try {
      const { data, error } = await supabase
        .from('temas')
        .select('id, nombre, parcial, sort_order')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      setTemas(data || []);
    } catch (err) {
      console.error('Error cargando temas:', err);
    } finally {
      setLoadingTemas(false);
    }
  }, []);

  useEffect(() => {
    void fetchTemas();
  }, [fetchTemas]);

  // ── Cargar Subtemas al cambiar tema ────────────────────────────────────
  useEffect(() => {
    setSubtemas([]);
    setSelectedSubtemaId(null);
    setPlacas([]);
    setSelectedPlacaId(null);

    const numTemaId = Number(selectedTemaId);
    const quick = getQuickSubtemas(numTemaId);
    if (quick && quick.length > 0) {
      setSubtemas(quick as unknown as Subtema[]);
      setSelectedSubtemaId(quick[0].id);
      setLoadingSubtemas(false);
    } else {
      setLoadingSubtemas(true);
    }

    const fetchSubtemas = async () => {
      try {
        const data = await getCachedSubtemas(numTemaId);
        if (data && data.length > 0) {
          setSubtemas(data as unknown as Subtema[]);
          setSelectedSubtemaId((prev) => prev ?? data[0].id);
        }
      } catch (err) {
        console.error('Error cargando subtemas:', err);
        const fallback = getQuickSubtemas(numTemaId);
        if (fallback && fallback.length > 0) {
          setSubtemas(fallback as unknown as Subtema[]);
          setSelectedSubtemaId((prev) => prev ?? fallback[0].id);
        }
      } finally {
        setLoadingSubtemas(false);
      }
    };

    void fetchSubtemas();
  }, [selectedTemaId]);

  // ── Cargar Placas al cambiar subtema ───────────────────────────────────
  useEffect(() => {
    setPlacas([]);
    setSelectedPlacaId(null);
    setPlacasConMapa(new Set());

    if (!selectedSubtemaId) return;

    const fetchPlacas = async () => {
      setLoadingPlacas(true);
      try {
        const { data: placasData, error: placasErr } = await supabase
          .from('placas')
          .select('id, photo_url, sort_order, tema_id, subtema_id, aumento, senalados, senalados_meta, comentario, tincion')
          .eq('subtema_id', selectedSubtemaId)
          .order('sort_order', { ascending: true });

        if (placasErr) throw placasErr;
        const rows = placasData || [];
        setPlacas(rows);

        if (rows.length > 0) {
          // Selecciona automáticamente la primera placa pendiente (no vinculada y no marcada como no encontrada)
          const firstPending = rows.find(p => !matchedPlacaIds.has(p.id) && !notFoundPlacaIds.has(p.id))
            || rows.find(p => !matchedPlacaIds.has(p.id))
            || rows[0];
          setSelectedPlacaId(firstPending.id);

          const placaIds = rows.map(p => p.id);
          const { data: mapsData } = await supabase
            .from('interactive_maps')
            .select('placa_id, sections')
            .in('placa_id', placaIds);

          const withMap = new Set<number>();
          (mapsData || []).forEach((m: any) => {
            if (Array.isArray(m.sections) && m.sections.length > 0) {
              withMap.add(m.placa_id);
            }
          });
          setPlacasConMapa(withMap);
        }
      } catch (err) {
        console.error('Error cargando placas:', err);
      } finally {
        setLoadingPlacas(false);
      }
    };

    void fetchPlacas();
  }, [selectedSubtemaId]);

  // Temas filtrados por parcial
  const filteredTemas = useMemo(() => {
    return temas.filter(t => t.parcial === selectedParcial);
  }, [temas, selectedParcial]);

  // Auto-seleccionar primer tema al cambiar de parcial
  useEffect(() => {
    if (filteredTemas.length > 0) {
      setSelectedTemaId(filteredTemas[0].id);
    } else {
      setSelectedTemaId(null);
    }
  }, [filteredTemas]);

  // Placa activa
  const activePlaca = useMemo(() => {
    return placas.find(p => p.id === selectedPlacaId) || null;
  }, [placas, selectedPlacaId]);

  const activeTema = useMemo(() => {
    return temas.find(t => t.id === selectedTemaId) || null;
  }, [temas, selectedTemaId]);

  const activeSubtema = useMemo(() => {
    return subtemas.find(s => s.id === selectedSubtemaId) || null;
  }, [subtemas, selectedSubtemaId]);

  const currentCandidate = useMemo(() => {
    return candidates[currentCandidateIndex] || null;
  }, [candidates, currentCandidateIndex]);

  const matchedInCurrentSubtemaCount = useMemo(() => {
    return placas.filter(p => matchedPlacaIds.has(p.id)).length;
  }, [placas, matchedPlacaIds]);

  const notFoundInCurrentSubtemaCount = useMemo(() => {
    return placas.filter(p => notFoundPlacaIds.has(p.id)).length;
  }, [placas, notFoundPlacaIds]);

  const pendingInCurrentSubtemaCount = useMemo(() => {
    return placas.filter(p => !matchedPlacaIds.has(p.id) && !notFoundPlacaIds.has(p.id)).length;
  }, [placas, matchedPlacaIds, notFoundPlacaIds]);

  // Placas filtradas según la pestaña activa (Todas, Pendientes, Vinculadas, No encontradas)
  const filteredPlacas = useMemo(() => {
    if (filterPlacasMode === 'pendientes') {
      return placas.filter(p => !matchedPlacaIds.has(p.id) && !notFoundPlacaIds.has(p.id));
    }
    if (filterPlacasMode === 'vinculadas') {
      return placas.filter(p => matchedPlacaIds.has(p.id));
    }
    if (filterPlacasMode === 'no_encontradas') {
      return placas.filter(p => notFoundPlacaIds.has(p.id));
    }
    return placas;
  }, [placas, filterPlacasMode, matchedPlacaIds, notFoundPlacaIds]);

  const handleClearMatchedHistory = () => {
    if (window.confirm('¿Deseas reiniciar la lista local de placas marcadas (vinculadas y no encontradas)? (Esto no modifica ni borra los datos guardados en la base de datos).')) {
      setMatchedPlacaIds(new Set());
      setNotFoundPlacaIds(new Set());
      try {
        localStorage.removeItem(MATCHED_PLACAS_STORAGE_KEY);
        localStorage.removeItem(NOT_FOUND_PLACAS_STORAGE_KEY);
      } catch (err) {
        console.error('Error al limpiar localStorage:', err);
      }
    }
  };

  // ── Manejo de Archivos Locales ─────────────────────────────────────────
  const handleAddFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (fileArray.length === 0) return;

    const newCandidates: CandidateImage[] = fileArray.map((file, idx) => ({
      id: `${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 7)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      name: file.name,
      size: file.size,
    }));

    setCandidates(prev => [...prev, ...newCandidates]);
  }, []);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleAddFiles(e.target.files);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files) {
      handleAddFiles(e.dataTransfer.files);
    }
  };

  const handleRemoveCandidate = (index: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCandidates(prev => {
      const removed = prev[index];
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      const next = prev.filter((_, i) => i !== index);
      if (currentCandidateIndex >= next.length) {
        setCurrentCandidateIndex(Math.max(0, next.length - 1));
      }
      return next;
    });
  };

  const handleClearAllCandidates = () => {
    candidates.forEach(c => URL.revokeObjectURL(c.previewUrl));
    setCandidates([]);
    setCurrentCandidateIndex(0);
  };

  // ── Navegación entre Fotos Candidatas ──────────────────────────────────
  const handleNextCandidate = useCallback(() => {
    if (candidates.length === 0) return;
    setCurrentCandidateIndex(prev => (prev + 1) % candidates.length);
  }, [candidates.length]);

  const handlePrevCandidate = useCallback(() => {
    if (candidates.length === 0) return;
    setCurrentCandidateIndex(prev => (prev - 1 + candidates.length) % candidates.length);
  }, [candidates.length]);

  // ── Marcar Placa como No Encontrada y Avanzar a Calibrar Siguiente ──────
  const handleMarkAsNotFound = useCallback((placaIdToMark?: number) => {
    const targetId = placaIdToMark ?? activePlaca?.id;
    if (!targetId) return;

    setNotFoundPlacaIds(prev => new Set(prev).add(targetId));

    // Si estaba marcada como vinculada, quitarla de vinculadas
    setMatchedPlacaIds(prev => {
      if (prev.has(targetId)) {
        const updated = new Set(prev);
        updated.delete(targetId);
        return updated;
      }
      return prev;
    });

    // Encontrar la siguiente placa pendiente (no vinculada y no marcada como no encontrada)
    const currentIndex = placas.findIndex(p => p.id === targetId);
    let nextPlaca = placas
      .slice(currentIndex + 1)
      .find(p => p.id !== targetId && !matchedPlacaIds.has(p.id) && !notFoundPlacaIds.has(p.id));

    if (!nextPlaca) {
      nextPlaca = placas.find(p => p.id !== targetId && !matchedPlacaIds.has(p.id) && !notFoundPlacaIds.has(p.id));
    }

    if (nextPlaca) {
      setSelectedPlacaId(nextPlaca.id);
      setCurrentCandidateIndex(0); // Reiniciar a la primera foto para calibrar la nueva placa
      setSaveSuccessMsg(`⚠️ Placa #${targetId} marcada como NO encontrada. Pasando a calibrar Placa #${nextPlaca.id}`);
    } else {
      setSaveSuccessMsg(`⚠️ Placa #${targetId} marcada como NO encontrada. ¡No quedan más placas pendientes en este subtema!`);
    }

    setTimeout(() => setSaveSuccessMsg(null), 4500);
  }, [activePlaca, notFoundPlacaIds, matchedPlacaIds, placas]);

  // ── Alternar Marca de No Encontrada Directamente ────────────────────────
  const handleToggleNotFound = useCallback((placaId: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setNotFoundPlacaIds(prev => {
      const updated = new Set(prev);
      if (updated.has(placaId)) {
        updated.delete(placaId);
        setSaveSuccessMsg(`Placa #${placaId} desmarcada como no encontrada.`);
      } else {
        updated.add(placaId);
        setSaveSuccessMsg(`Placa #${placaId} marcada como no encontrada.`);
      }
      return updated;
    });
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  }, []);

  // ── Vincular y Guardar Imagen a la Placa ────────────────────────────────
  const handleConfirmMatch = useCallback(async () => {
    if (!activePlaca || !currentCandidate || !activeTema || !activeSubtema) return;

    setIsSaving(true);
    setSaveErrorMsg(null);
    setSaveSuccessMsg(null);

    try {
      // 1. Optimizar y subir a Cloudflare R2 en la carpeta oficial del tema y subtema
      const folder = `placas/${slugify(activeTema.nombre)}/${slugify(activeSubtema.nombre)}`;
      const uploadResult = await uploadToCloudinary(currentCandidate.file, {
        folder,
        optimizeForPlaque: true,
      });

      if (!uploadResult?.secure_url) {
        throw new Error('No se recibió la URL de la imagen subida a Cloudflare R2.');
      }

      // 2. Actualizar photo_url en la base de datos
      const { error: dbError } = await supabase
        .from('placas')
        .update({ photo_url: uploadResult.secure_url })
        .eq('id', activePlaca.id);

      if (dbError) throw dbError;

      // 3. Registrar auditoría
      await logPlateActivity({
        actionType: 'edit_plate',
        targetTable: 'placas',
        placaId: activePlaca.id,
        actor: {
          id: user?.id ?? null,
          username: user?.username ?? null,
          name: user?.nombre ?? null,
          role: user?.rol ?? null,
        },
        details: {
          photo_url: uploadResult.secure_url,
          nombre_placa: `Placa #${activePlaca.id} - ${activeSubtema.nombre}`,
          tema_id: activeTema.id,
          tema_nombre: activeTema.nombre,
          subtema_id: activeSubtema.id,
          subtema_nombre: activeSubtema.nombre,
          source: 'reencontrar_placa',
          matched_file: currentCandidate.name,
        },
      });

      // 4. Actualizar estado local
      setMatchedPlacaIds(prev => new Set(prev).add(activePlaca.id));
      setNotFoundPlacaIds(prev => {
        if (prev.has(activePlaca.id)) {
          const updated = new Set(prev);
          updated.delete(activePlaca.id);
          return updated;
        }
        return prev;
      });

      setPlacas(prev =>
        prev.map(p => (p.id === activePlaca.id ? { ...p, photo_url: uploadResult.secure_url } : p))
      );

      setSaveSuccessMsg(`¡Placa #${activePlaca.id} vinculada exitosamente con "${currentCandidate.name}"!`);

      // 5. Remover la imagen emparejada de la lista de candidatas
      handleRemoveCandidate(currentCandidateIndex);

      // 6. Seleccionar automáticamente la siguiente placa que no esté emparejada ni marcada como no encontrada
      const nextUnmatched = placas.find(
        p => p.id !== activePlaca.id && !matchedPlacaIds.has(p.id) && !notFoundPlacaIds.has(p.id)
      ) || placas.find(p => p.id !== activePlaca.id && !matchedPlacaIds.has(p.id));

      if (nextUnmatched) {
        setSelectedPlacaId(nextUnmatched.id);
      }

      setTimeout(() => setSaveSuccessMsg(null), 5000);
    } catch (err: any) {
      console.error('Error al vincular imagen:', err);
      const detail = err?.message || describeSupabaseError(err) || 'Intenta de nuevo.';
      setSaveErrorMsg(`Error al vincular: ${detail}`);
    } finally {
      setIsSaving(false);
    }
  }, [
    activePlaca,
    currentCandidate,
    activeTema,
    activeSubtema,
    currentCandidateIndex,
    placas,
    matchedPlacaIds,
    notFoundPlacaIds,
    handleRemoveCandidate,
    user,
  ]);

  // Atajos de teclado en el visor
  useEffect(() => {
    if (!isViewerOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'x' || e.key === 'X') {
        e.preventDefault();
        handleNextCandidate();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevCandidate();
      } else if (e.key === 'Enter' || e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        if (!isSaving) void handleConfirmMatch();
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        handleMarkAsNotFound();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isViewerOpen, handleNextCandidate, handlePrevCandidate, handleConfirmMatch, handleMarkAsNotFound, isSaving]);

  return (
    <div style={styles.page}>
      <Header />

      <main style={styles.main}>
        <BackButton onClick={handleGoBack} />

        {/* Encabezado */}
        <div style={styles.header}>
          <div style={styles.badge}>
            <Sparkles size={16} color="#4f46e5" />
            <span>Herramienta de Recuperación</span>
          </div>
          <h1 style={styles.title}>🔍 Reencontrar / Emparejar Placa</h1>
          <p style={styles.subtitle}>
            Empareja visualmente tus fotos locales con las placas existentes en el sistema para recuperar imágenes perdidas conservando todos sus señalados y mapas interactivos.
          </p>
        </div>

        {/* Mensajes de Notificación */}
        {saveSuccessMsg && (
          <div style={styles.alertSuccess}>
            <CheckCircle size={20} />
            <span>{saveSuccessMsg}</span>
          </div>
        )}
        {saveErrorMsg && (
          <div style={styles.alertError}>
            <XCircle size={20} />
            <span>{saveErrorMsg}</span>
          </div>
        )}

        {/* ── PASO 1: Selector de Contexto ── */}
        <section style={styles.card}>
          <h2 style={styles.cardHeader}>
            <FolderOpen size={20} color="#4f46e5" />
            <span>1. Selecciona el Tema y Subtema</span>
          </h2>

          <div style={styles.parcialTabs}>
            {PARCIALES.map(p => (
              <button
                key={p.key}
                type="button"
                style={{
                  ...styles.parcialTab,
                  ...(selectedParcial === p.key ? styles.parcialTabActive : {}),
                }}
                onClick={() => setSelectedParcial(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div style={styles.selectorsRow}>
            <div style={styles.selectGroup}>
              <label style={styles.label}>Tema:</label>
              <select
                style={styles.select}
                value={selectedTemaId ?? ''}
                onChange={e => setSelectedTemaId(e.target.value ? Number(e.target.value) : null)}
                disabled={loadingTemas || filteredTemas.length === 0}
              >
                {filteredTemas.length === 0 && <option value="">No hay temas disponibles</option>}
                {filteredTemas.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.selectGroup}>
              <label style={styles.label}>Subtema:</label>
              <select
                style={styles.select}
                value={selectedSubtemaId ?? ''}
                onChange={e => setSelectedSubtemaId(e.target.value ? Number(e.target.value) : null)}
                disabled={loadingSubtemas || subtemas.length === 0}
              >
                {subtemas.length === 0 && <option value="">No hay subtemas disponibles</option>}
                {subtemas.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* ── PASO 2: Carga Masiva de Fotos Locales ── */}
        <section style={styles.card}>
          <div style={styles.cardHeaderRow}>
            <h2 style={styles.cardHeader}>
              <Upload size={20} color="#0284c7" />
              <span>2. Subir Fotos Locales desde tu Computadora</span>
            </h2>
            {candidates.length > 0 && (
              <button type="button" style={styles.clearBtn} onClick={handleClearAllCandidates}>
                <Trash2 size={14} />
                <span>Limpiar fotos ({candidates.length})</span>
              </button>
            )}
          </div>

          <div
            style={{
              ...styles.dropzone,
              ...(isDragOver ? styles.dropzoneActive : {}),
            }}
            onDragOver={e => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileInputChange}
            />
            <ImageIcon size={44} color={isDragOver ? '#0284c7' : '#94a3b8'} />
            <div style={styles.dropzoneText}>
              <strong>Haz clic o arrastra un lote de imágenes aquí</strong>
              <span>Puedes seleccionar múltiples fotos a la vez (JPG, PNG, WebP)</span>
            </div>
            <button
              type="button"
              style={styles.browseBtn}
              onClick={e => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              Examinar archivos
            </button>
          </div>

          {/* Carrusel de Miniaturas Cargadas */}
          {candidates.length > 0 && (
            <div style={styles.thumbnailsContainer}>
              <div style={styles.thumbnailsHeader}>
                <span>
                  Fotos cargadas en memoria: <strong>{candidates.length}</strong>
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    Foto activa: <strong>{currentCandidateIndex + 1}</strong> de {candidates.length}
                  </span>
                  <button
                    type="button"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '5px 12px',
                      background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: '0 2px 6px rgba(239,68,68,0.3)',
                    }}
                    onClick={handleClearAllCandidates}
                    title="Eliminar todas las fotos del lote"
                  >
                    <Trash2 size={13} />
                    Borrar todo el lote
                  </button>
                </div>
              </div>
              <div style={styles.thumbnailsGrid}>
                {candidates.map((c, idx) => (
                  <div
                    key={c.id}
                    style={{
                      ...styles.thumbCard,
                      ...(idx === currentCandidateIndex ? styles.thumbCardActive : {}),
                    }}
                    onClick={() => setCurrentCandidateIndex(idx)}
                  >
                    <img src={c.previewUrl} alt={c.name} style={styles.thumbImg} />
                    <button
                      type="button"
                      style={styles.thumbDeleteBtn}
                      onClick={e => handleRemoveCandidate(idx, e)}
                      title="Eliminar de la cola"
                    >
                      ✕
                    </button>
                    <div style={styles.thumbInfo}>
                      <span style={styles.thumbName}>{c.name}</span>
                      <span style={styles.thumbSize}>{formatBytes(c.size)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ── PASO 3: Selección de Placa de la Base de Datos y Emparejamiento ── */}
        <section style={styles.card}>
          <div style={styles.cardHeaderRow}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <h2 style={styles.cardHeader}>
                <Layers size={20} color="#059669" />
                <span>3. Placas Registradas en este Subtema ({placas.length})</span>
              </h2>
              {placas.length > 0 && (
                <span style={styles.progressBadge}>
                  {matchedInCurrentSubtemaCount} de {placas.length} vinculadas ({Math.round((matchedInCurrentSubtemaCount / Math.max(1, placas.length)) * 100)}%)
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {matchedPlacaIds.size > 0 && (
                <button
                  type="button"
                  style={styles.resetHistoryBtn}
                  onClick={handleClearMatchedHistory}
                  title="Reiniciar lista de vinculadas en el navegador"
                >
                  <RefreshCw size={13} />
                  <span>Reiniciar marcadas</span>
                </button>
              )}
              {activePlaca && candidates.length > 0 && (
                <button
                  type="button"
                  style={styles.openViewerBtn}
                  onClick={() => setIsViewerOpen(true)}
                >
                  <Eye size={18} />
                  <span>Abrir Visor de Verificación</span>
                </button>
              )}
            </div>
          </div>

          {/* Filtros de placas: Todas / Pendientes / Vinculadas / No encontradas */}
          {placas.length > 0 && (
            <div style={styles.placasFilterRow}>
              <button
                type="button"
                style={{
                  ...styles.filterTabBtn,
                  ...(filterPlacasMode === 'todas' ? styles.filterTabBtnActive : {}),
                }}
                onClick={() => setFilterPlacasMode('todas')}
              >
                Todas ({placas.length})
              </button>
              <button
                type="button"
                style={{
                  ...styles.filterTabBtn,
                  ...(filterPlacasMode === 'pendientes' ? styles.filterTabBtnActive : {}),
                }}
                onClick={() => setFilterPlacasMode('pendientes')}
              >
                ⏳ Pendientes ({pendingInCurrentSubtemaCount})
              </button>
              <button
                type="button"
                style={{
                  ...styles.filterTabBtn,
                  ...(filterPlacasMode === 'vinculadas' ? styles.filterTabBtnActive : {}),
                }}
                onClick={() => setFilterPlacasMode('vinculadas')}
              >
                ✅ Vinculadas ({matchedInCurrentSubtemaCount})
              </button>
              <button
                type="button"
                style={{
                  ...styles.filterTabBtn,
                  ...(filterPlacasMode === 'no_encontradas' ? styles.filterTabBtnActive : {}),
                }}
                onClick={() => setFilterPlacasMode('no_encontradas')}
              >
                ⚠️ No encontradas ({notFoundInCurrentSubtemaCount})
              </button>
            </div>
          )}

          {loadingPlacas ? (
            <div style={styles.loadingState}>
              <RefreshCw className="animate-spin" size={24} color="#4f46e5" />
              <span>Cargando placas registradas...</span>
            </div>
          ) : placas.length === 0 ? (
            <div style={styles.emptyState}>
              <Info size={32} color="#94a3b8" />
              <p>No hay placas registradas en este subtema.</p>
            </div>
          ) : filteredPlacas.length === 0 ? (
            <div style={styles.emptyState}>
              <CheckCircle size={32} color="#059669" />
              <p>
                {filterPlacasMode === 'pendientes'
                  ? '¡Excelente! Todas las placas de este subtema ya están vinculadas o marcadas.'
                  : filterPlacasMode === 'no_encontradas'
                  ? 'No hay placas marcadas como no encontradas en este subtema.'
                  : filterPlacasMode === 'vinculadas'
                  ? 'No hay placas vinculadas en este subtema aún.'
                  : 'No hay placas en esta categoría.'}
              </p>
            </div>
          ) : (
            <div style={styles.placasGrid}>
              {filteredPlacas.map((placa, idx) => {
                const isSelected = placa.id === selectedPlacaId;
                const isMatched = matchedPlacaIds.has(placa.id);
                const isNotFound = notFoundPlacaIds.has(placa.id);
                const hasMap = placasConMapa.has(placa.id);
                const senaladosCount = Array.isArray(placa.senalados) ? placa.senalados.length : 0;

                return (
                  <div
                    key={placa.id}
                    style={{
                      ...styles.placaCard,
                      ...(isSelected ? styles.placaCardSelected : {}),
                      ...(isMatched ? styles.placaCardMatched : {}),
                      ...(isNotFound ? styles.placaCardNotFound : {}),
                    }}
                    onClick={() => setSelectedPlacaId(placa.id)}
                  >
                    <div style={styles.placaCardTop}>
                      <span style={styles.placaNumber}>#{idx + 1} (ID: {placa.id})</span>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        {isMatched && (
                          <span style={styles.matchedBadge}>
                            <CheckCircle size={12} /> Emparejada
                          </span>
                        )}
                        {isNotFound && (
                          <span style={styles.notFoundBadge}>
                            <AlertCircle size={12} /> No encontrada
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={styles.placaDetails}>
                      <div style={styles.placaDetailItem}>
                        <strong>Aumento:</strong> {placa.aumento || 'Sin aumento'}
                      </div>
                      <div style={styles.placaDetailItem}>
                        <strong>Tinción:</strong> {placa.tincion || 'Sin especificar'}
                      </div>
                      <div style={styles.placaBadgesRow}>
                        <span style={styles.markerBadge}>
                          <MapPin size={12} /> {senaladosCount} señalados
                        </span>
                        {hasMap && (
                          <span style={styles.mapBadge}>
                            🗺️ Mapa Interactivo
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={styles.placaCardActions}>
                      <button
                        type="button"
                        style={{
                          ...styles.selectPlacaBtn,
                          ...(isSelected ? styles.selectPlacaBtnActive : {}),
                        }}
                        onClick={e => {
                          e.stopPropagation();
                          setSelectedPlacaId(placa.id);
                          if (candidates.length > 0) setIsViewerOpen(true);
                        }}
                      >
                        {isSelected ? '🎯 Seleccionada para calibrar' : 'Elegir para emparejar'}
                      </button>

                      <button
                        type="button"
                        style={{
                          ...styles.toggleNotFoundBtn,
                          ...(isNotFound ? styles.toggleNotFoundBtnActive : {}),
                        }}
                        onClick={e => handleToggleNotFound(placa.id, e)}
                        title={isNotFound ? 'Quitar marca de no encontrada' : 'Marcar como no encontrada'}
                      >
                        <AlertCircle size={13} />
                        <span>{isNotFound ? 'Desmarcar' : 'No encontrada'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Calibrador Visual Rápido si hay fotos cargadas ── */}
        {activePlaca && currentCandidate && (
          <section style={styles.quickCalibrationSection}>
            <div style={styles.quickBar}>
              <div style={styles.quickInfo}>
                <strong>Calibrando Placa #{activePlaca.id}</strong> con foto{' '}
                <span style={styles.quickFilename}>"{currentCandidate.name}"</span> (
                {currentCandidateIndex + 1}/{candidates.length})
              </div>
              <div style={styles.quickActions}>
                <button
                  type="button"
                  style={styles.actionBtnReject}
                  onClick={handleNextCandidate}
                  title="Probar siguiente foto (X o flecha derecha)"
                >
                  <XCircle size={18} />
                  <span>Siguiente foto (❌)</span>
                </button>
                <button
                  type="button"
                  style={styles.actionBtnNotFound}
                  onClick={() => handleMarkAsNotFound()}
                  title="Marcar placa como no encontrada y pasar a calibrar la siguiente (Tecla N)"
                >
                  <SkipForward size={18} />
                  <span>No encontrada (⏭️)</span>
                </button>
                <button
                  type="button"
                  style={styles.actionBtnAccept}
                  onClick={() => void handleConfirmMatch()}
                  disabled={isSaving}
                >
                  <CheckCircle size={18} />
                  <span>{isSaving ? 'Guardando...' : '¡Coincide! Vincular (✔️)'}</span>
                </button>
                <button
                  type="button"
                  style={styles.actionBtnExpand}
                  onClick={() => setIsViewerOpen(true)}
                >
                  <Eye size={18} />
                  <span>Visor Completo</span>
                </button>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* ── VISOR IDENTICO AL GENERAL CON SUPERPOSICIÓN DE SEÑALADOS Y MAPA ── */}
      {isViewerOpen && activePlaca && currentCandidate && (
        <div style={styles.viewerOverlayWrapper}>
          <ImageViewerModal
            src={currentCandidate.previewUrl}
            placaId={activePlaca.id}
            initialActiveMarkerIndex={activeMarkerIndex}
            onActiveMarkerChange={setActiveMarkerIndex}
            initialActiveMapSectionIndex={activeMapSectionIndex}
            onActiveMapSectionChange={setActiveMapSectionIndex}
            temaNombre={activeTema?.nombre}
            subtemaNombre={activeSubtema?.nombre}
            aumento={activePlaca.aumento}
            senalados={activePlaca.senalados}
            senaladosMeta={activePlaca.senalados_meta}
            comentario={activePlaca.comentario}
            tincion={activePlaca.tincion}
            onClose={() => setIsViewerOpen(false)}
          />

          {/* Barra Flotante de Decisión en Pantalla Completa */}
          <div style={styles.floatingDecisionBar}>
            <div style={styles.floatingInfo}>
              <div
                style={styles.floatingPlateTitle}
                title={`Placa #${activePlaca.id} (${activePlaca.aumento || 'Sin aumento'}) — ${activeSubtema?.nombre}`}
              >
                Placa #{activePlaca.id} ({activePlaca.aumento || 'Sin aumento'}) — {activeSubtema?.nombre}
              </div>
              <div
                style={styles.floatingCandidateTitle}
                title={`Foto ${currentCandidateIndex + 1} de ${candidates.length}: ${currentCandidate.name}`}
              >
                <span style={{ whiteSpace: 'nowrap' }}>
                  Foto {currentCandidateIndex + 1}/{candidates.length}: <strong>{currentCandidate.name}</strong>
                </span>
                {activeMarkerIndex !== null && (activePlaca.senalados_meta?.[activeMarkerIndex]?.label || activePlaca.senalados?.[activeMarkerIndex]) && (
                  <span style={styles.floatingMarkerTag}>
                    🎯 {activePlaca.senalados_meta?.[activeMarkerIndex]?.label || activePlaca.senalados?.[activeMarkerIndex]}
                  </span>
                )}
              </div>
            </div>

            <div style={styles.floatingButtonsGroup}>
              <button
                type="button"
                style={styles.floatingPrevBtn}
                onClick={handlePrevCandidate}
                title="Foto anterior (Flecha Izquierda)"
              >
                <ArrowLeft size={16} />
                <span>Anterior</span>
              </button>

              <button
                type="button"
                style={styles.floatingRejectBtn}
                onClick={handleNextCandidate}
                title="Descartar y probar siguiente (X o Flecha Derecha)"
              >
                <XCircle size={16} />
                <span>Siguiente (❌)</span>
              </button>

              <button
                type="button"
                style={styles.floatingNotFoundBtn}
                onClick={() => handleMarkAsNotFound()}
                title="Marcar esta placa como no encontrada y pasar de inmediato a calibrar la siguiente placa (Tecla N)"
              >
                <SkipForward size={16} />
                <span>No encontrada (⏭️)</span>
              </button>

              <button
                type="button"
                style={styles.floatingAcceptBtn}
                onClick={() => void handleConfirmMatch()}
                disabled={isSaving}
                title="Confirmar que esta foto pertenece a esta placa (Enter o V)"
              >
                <CheckCircle size={17} />
                <span>{isSaving ? 'Guardando...' : '¡Confirmar! (✔️)'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <LoadingToast
        visible={isSaving}
        type="uploading"
        message="Optimizando y guardando imagen en Cloudflare R2..."
      />

      <Footer />
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#f8fafc',
    color: '#0f172a',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  main: {
    flex: 1,
    maxWidth: '1240px',
    width: '100%',
    margin: '0 auto',
    padding: '24px 20px 80px',
    boxSizing: 'border-box',
  },
  header: {
    marginBottom: '28px',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 12px',
    backgroundColor: '#e0e7ff',
    color: '#4338ca',
    borderRadius: '9999px',
    fontSize: '13px',
    fontWeight: 600,
    marginBottom: '10px',
  },
  title: {
    fontSize: '28px',
    fontWeight: 800,
    color: '#1e1b4b',
    margin: '0 0 8px 0',
  },
  subtitle: {
    fontSize: '15px',
    color: '#64748b',
    maxWidth: '850px',
    lineHeight: 1.5,
    margin: 0,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    padding: '24px',
    marginBottom: '24px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
  },
  cardHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '18px',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '18px',
    fontWeight: 700,
    color: '#0f172a',
    margin: 0,
  },
  clearBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    backgroundColor: '#fff1f2',
    color: '#e11d48',
    border: '1px solid #fecdd3',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  parcialTabs: {
    display: 'flex',
    gap: '8px',
    marginBottom: '16px',
    borderBottom: '1px solid #e2e8f0',
    paddingBottom: '12px',
  },
  parcialTab: {
    padding: '8px 18px',
    backgroundColor: '#f1f5f9',
    color: '#475569',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 600,
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  parcialTabActive: {
    backgroundColor: '#4f46e5',
    color: '#ffffff',
  },
  selectorsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '16px',
  },
  selectGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#334155',
  },
  select: {
    padding: '10px 14px',
    borderRadius: '10px',
    border: '1px solid #cbd5e1',
    backgroundColor: '#f8fafc',
    fontSize: '15px',
    color: '#0f172a',
    outline: 'none',
    cursor: 'pointer',
  },
  dropzone: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 20px',
    border: '2px dashed #cbd5e1',
    borderRadius: '14px',
    backgroundColor: '#f8fafc',
    cursor: 'pointer',
    textAlign: 'center',
    gap: '12px',
    transition: 'all 0.2s',
  },
  dropzoneActive: {
    borderColor: '#0284c7',
    backgroundColor: '#f0f9ff',
  },
  dropzoneText: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    fontSize: '14px',
    color: '#475569',
  },
  browseBtn: {
    padding: '8px 18px',
    backgroundColor: '#0284c7',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  thumbnailsContainer: {
    marginTop: '20px',
    paddingTop: '16px',
    borderTop: '1px solid #e2e8f0',
  },
  thumbnailsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
    fontSize: '14px',
    color: '#334155',
  },
  thumbnailsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
    gap: '12px',
    maxHeight: '260px',
    overflowY: 'auto',
    padding: '4px',
  },
  thumbCard: {
    position: 'relative',
    borderRadius: '10px',
    border: '2px solid #e2e8f0',
    backgroundColor: '#ffffff',
    overflow: 'hidden',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    transition: 'all 0.15s ease',
  },
  thumbCardActive: {
    borderColor: '#4f46e5',
    boxShadow: '0 0 0 3px rgba(79, 70, 229, 0.25)',
  },
  thumbImg: {
    width: '100%',
    height: '90px',
    objectFit: 'cover',
  },
  thumbDeleteBtn: {
    position: 'absolute',
    top: '4px',
    right: '4px',
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    color: '#ffffff',
    border: 'none',
    fontSize: '11px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  thumbInfo: {
    padding: '6px 8px',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#ffffff',
  },
  thumbName: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#1e293b',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  thumbSize: {
    fontSize: '10px',
    color: '#64748b',
  },
  placasGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: '16px',
  },
  placaCard: {
    borderRadius: '12px',
    border: '2px solid #e2e8f0',
    padding: '16px',
    backgroundColor: '#ffffff',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    gap: '12px',
    transition: 'all 0.15s ease',
  },
  placaCardSelected: {
    borderColor: '#059669',
    backgroundColor: '#f0fdf4',
    boxShadow: '0 0 0 3px rgba(5, 150, 105, 0.2)',
  },
  placaCardMatched: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  placaCardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  placaNumber: {
    fontWeight: 700,
    fontSize: '15px',
    color: '#0f172a',
  },
  matchedBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '11px',
    fontWeight: 700,
    color: '#2563eb',
    backgroundColor: '#dbeafe',
    padding: '2px 8px',
    borderRadius: '9999px',
  },
  placaDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    fontSize: '13px',
    color: '#475569',
  },
  placaDetailItem: {
    display: 'flex',
    justifyContent: 'space-between',
  },
  placaBadgesRow: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
    marginTop: '4px',
  },
  markerBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '11px',
    fontWeight: 600,
    backgroundColor: '#ede9fe',
    color: '#6d28d9',
    padding: '3px 8px',
    borderRadius: '6px',
  },
  mapBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '11px',
    fontWeight: 600,
    backgroundColor: '#e0f2fe',
    color: '#0369a1',
    padding: '3px 8px',
    borderRadius: '6px',
  },
  selectPlacaBtn: {
    width: '100%',
    padding: '8px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    backgroundColor: '#f8fafc',
    color: '#334155',
    fontWeight: 600,
    fontSize: '13px',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  selectPlacaBtnActive: {
    backgroundColor: '#059669',
    color: '#ffffff',
    borderColor: '#059669',
  },
  progressBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 10px',
    borderRadius: '9999px',
    backgroundColor: '#dcfce7',
    color: '#15803d',
    fontSize: '12px',
    fontWeight: 700,
  },
  resetHistoryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '6px 12px',
    backgroundColor: '#f1f5f9',
    color: '#64748b',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  placasFilterRow: {
    display: 'flex',
    gap: '8px',
    marginBottom: '16px',
    paddingBottom: '8px',
    borderBottom: '1px solid #f1f5f9',
    flexWrap: 'wrap',
  },
  filterTabBtn: {
    padding: '6px 14px',
    backgroundColor: '#f8fafc',
    color: '#64748b',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  filterTabBtnActive: {
    backgroundColor: '#059669',
    color: '#ffffff',
    borderColor: '#059669',
    boxShadow: '0 2px 6px rgba(5, 150, 105, 0.2)',
  },
  openViewerBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    backgroundColor: '#4f46e5',
    color: '#ffffff',
    border: 'none',
    borderRadius: '10px',
    fontWeight: 700,
    fontSize: '14px',
    cursor: 'pointer',
    boxShadow: '0 2px 4px rgba(79, 70, 229, 0.3)',
  },
  loadingState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    padding: '40px',
    color: '#64748b',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    padding: '40px',
    color: '#64748b',
  },
  quickCalibrationSection: {
    position: 'sticky',
    bottom: '20px',
    zIndex: 40,
    marginTop: '20px',
  },
  quickBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'nowrap',
    gap: '12px',
    padding: '10px 18px',
    backgroundColor: '#0f172a',
    color: '#ffffff',
    borderRadius: '12px',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
  },
  quickInfo: {
    fontSize: '13px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    flex: '1 1 auto',
    minWidth: '180px',
  },
  quickFilename: {
    color: '#38bdf8',
    fontWeight: 600,
  },
  quickActions: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    flexShrink: 0,
    flexWrap: 'nowrap',
  },
  actionBtnReject: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '6px 12px',
    backgroundColor: '#ef4444',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 600,
    fontSize: '13px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  actionBtnNotFound: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '6px 12px',
    backgroundColor: '#d97706',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 600,
    fontSize: '13px',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(217, 119, 6, 0.3)',
    whiteSpace: 'nowrap',
  },
  actionBtnAccept: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '6px 14px',
    backgroundColor: '#10b981',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 700,
    fontSize: '13px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  actionBtnExpand: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '6px 12px',
    backgroundColor: '#334155',
    color: '#f8fafc',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 600,
    fontSize: '13px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  viewerOverlayWrapper: {
    position: 'relative',
    zIndex: 9999,
  },
  floatingDecisionBar: {
    position: 'fixed',
    bottom: '18px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 100000,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    backdropFilter: 'blur(12px)',
    borderRadius: '16px',
    padding: '8px 18px',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    maxWidth: '95vw',
    width: 'auto',
    boxSizing: 'border-box',
  },
  floatingInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    minWidth: '180px',
    maxWidth: '380px',
    flex: '1 1 auto',
    overflow: 'hidden',
  },
  floatingPlateTitle: {
    color: '#38bdf8',
    fontWeight: 700,
    fontSize: '13.5px',
    lineHeight: '1.25',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  floatingCandidateTitle: {
    color: '#cbd5e1',
    fontSize: '12px',
    lineHeight: '1.25',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  floatingMarkerTag: {
    color: '#fde047',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '180px',
  },
  floatingButtonsGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexShrink: 0,
    flexWrap: 'nowrap',
  },
  floatingPrevBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '7px 12px',
    backgroundColor: '#334155',
    color: '#ffffff',
    border: 'none',
    borderRadius: '10px',
    fontWeight: 600,
    fontSize: '13px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  floatingRejectBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '7px 14px',
    backgroundColor: '#dc2626',
    color: '#ffffff',
    border: 'none',
    borderRadius: '10px',
    fontWeight: 700,
    fontSize: '13px',
    cursor: 'pointer',
    boxShadow: '0 3px 10px rgba(220, 38, 38, 0.35)',
    whiteSpace: 'nowrap',
  },
  floatingNotFoundBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '7px 14px',
    backgroundColor: '#d97706',
    color: '#ffffff',
    border: 'none',
    borderRadius: '10px',
    fontWeight: 700,
    fontSize: '13px',
    cursor: 'pointer',
    boxShadow: '0 3px 10px rgba(217, 119, 6, 0.4)',
    whiteSpace: 'nowrap',
  },
  floatingAcceptBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '7px 18px',
    backgroundColor: '#059669',
    color: '#ffffff',
    border: 'none',
    borderRadius: '10px',
    fontWeight: 800,
    fontSize: '13.5px',
    cursor: 'pointer',
    boxShadow: '0 3px 12px rgba(5, 150, 105, 0.45)',
    whiteSpace: 'nowrap',
  },
  notFoundBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '3px 8px',
    backgroundColor: '#fffbeb',
    color: '#b45309',
    borderRadius: '8px',
    fontSize: '11px',
    fontWeight: 700,
    border: '1px solid #fde68a',
  },
  placaCardNotFound: {
    borderColor: '#fde68a',
    backgroundColor: '#fffdf5',
  },
  placaCardActions: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    marginTop: 'auto',
  },
  toggleNotFoundBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '8px 10px',
    backgroundColor: '#f1f5f9',
    color: '#64748b',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  toggleNotFoundBtnActive: {
    backgroundColor: '#fef3c7',
    color: '#b45309',
    borderColor: '#fde68a',
  },
  alertSuccess: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    backgroundColor: '#ecfdf5',
    color: '#065f46',
    border: '1px solid #a7f3d0',
    padding: '14px 20px',
    borderRadius: '12px',
    marginBottom: '20px',
    fontWeight: 600,
  },
  alertError: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    backgroundColor: '#fef2f2',
    color: '#991b1b',
    border: '1px solid #fecaca',
    padding: '14px 20px',
    borderRadius: '12px',
    marginBottom: '20px',
    fontWeight: 600,
  },
};

export default ReencontrarPlaca;
