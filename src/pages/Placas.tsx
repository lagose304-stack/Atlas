import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ImageUploader from '../components/ImageUploader';
import { supabase } from '../services/supabase';
import { uploadToCloudinary, getCloudinaryPublicId } from '../services/cloudinary';
import Footer from '../components/Footer';
import BackButton from '../components/BackButton';
import Header from '../components/Header';
import LoadingToast from '../components/LoadingToast';
import BoldField from '../components/BoldField';
import SenaladoLocationPicker from '../components/SenaladoLocationPicker';
import RequiredTextPromptModal from '../components/RequiredTextPromptModal';
import TincionAccordionSelector from '../components/TincionAccordionSelector';
import { useAuth } from '../contexts/AuthContext';
import { logPlateActivity } from '../services/plateActivityAudit';
import { useSmartBackNavigation } from '../hooks/useSmartBackNavigation';

// --- Interfaces ---
interface Tema {
  id: number;
  nombre: string;
  parcial: string;
  sort_order: number;
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
}

interface SenaladoMetaItem {
  label: string;
  x: number | null;
  y: number | null;
  startX?: number | null;
  startY?: number | null;
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
    });
  }

  return { labels, meta };
};

interface Subtema {
  id: number;
  nombre: string;
  tema_id: number;
}

// --- Styles ---
const styles: { [key: string]: React.CSSProperties } = {
  saveButton: {
    display: 'block', width: '100%', padding: '14px', marginTop: '24px',
    border: 'none', borderRadius: '8px', cursor: 'pointer',
    backgroundColor: '#16a34a', color: 'white', fontSize: '1.05em',
    fontWeight: 700, letterSpacing: '0.02em',
    transition: 'background-color 0.2s ease, opacity 0.2s ease',
  },
  saveButtonDisabled: {
    display: 'block', width: '100%', padding: '14px', marginTop: '24px',
    border: 'none', borderRadius: '8px', cursor: 'not-allowed',
    backgroundColor: '#86efac', color: 'white', fontSize: '1.05em',
    fontWeight: 700, opacity: 0.7,
  },
  successMsg: {
    marginTop: '16px', padding: '12px 16px', borderRadius: '8px',
    backgroundColor: '#dcfce7', border: '1px solid #86efac',
    color: '#15803d', fontWeight: 600, textAlign: 'center',
  },
  errorMsg: {
    marginTop: '16px', padding: '12px 16px', borderRadius: '8px',
    backgroundColor: '#fee2e2', border: '1px solid #fca5a5',
    color: '#b91c1c', fontWeight: 600, textAlign: 'center',
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
    boxSizing: 'border-box' as const,
  },
  accordionLabel: {
    display: 'block',
    fontSize: '0.875em',
    fontWeight: 700,
    color: '#475569',
    letterSpacing: '0.03em',
    marginBottom: '8px',
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
  loadErrorBox: {
    marginTop: '12px',
    borderRadius: '10px',
    border: '1px solid #fecaca',
    background: '#fff1f2',
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  loadErrorRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    flexWrap: 'wrap',
  },
  loadErrorText: {
    color: '#9f1239',
    fontSize: '0.88em',
    fontWeight: 600,
  },
  retryButton: {
    border: '1px solid #fb7185',
    background: '#ffffff',
    color: '#9f1239',
    borderRadius: '999px',
    padding: '6px 12px',
    cursor: 'pointer',
    fontSize: '0.8em',
    fontWeight: 700,
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  },
  editFieldGroup: {
    display: 'flex', flexDirection: 'column' as const, gap: '8px',
  },
  aumentoGroup: {
    display: 'flex', gap: '8px', flexWrap: 'wrap' as const, marginTop: '4px',
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
  senalTextField: {
    flex: 1, padding: '9px 12px', fontSize: '0.92em', fontFamily: 'inherit',
    border: '1.5px solid #cbd5e1', borderRadius: '8px', outline: 'none',
    color: '#0f172a', background: '#f8fafc', boxSizing: 'border-box' as const,
    transition: 'border-color 0.2s',
  },
  senalRow: {
    display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px',
  },
  senalNumber: {
    minWidth: '26px', height: '26px', borderRadius: '50%',
    background: 'linear-gradient(135deg, #818cf8, #6366f1)', color: '#fff',
    fontWeight: 700, fontSize: '0.82em', display: 'flex', alignItems: 'center',
    justifyContent: 'center', flexShrink: 0,
  },
  removeBtn: {
    background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444',
    fontSize: '1em', padding: '0 4px', lineHeight: 1, flexShrink: 0, fontFamily: 'inherit',
  },
  addBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '8px 16px', borderRadius: '8px', border: '2px dashed #818cf8',
    background: '#f5f3ff', color: '#4f46e5', cursor: 'pointer',
    fontSize: '0.88em', fontWeight: 600, fontFamily: 'inherit',
    transition: 'background 0.15s', marginTop: '2px',
  },
  addComentarioBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '8px 16px', borderRadius: '8px', border: '2px dashed #6366f1',
    background: '#f5f3ff', color: '#4f46e5', cursor: 'pointer',
    fontSize: '0.9em', fontWeight: 600, marginTop: '6px',
    transition: 'background 0.15s', fontFamily: 'inherit',
  },
  comentarioField: {
    width: '100%', padding: '10px 12px', fontSize: '0.95em',
    border: '2px solid #c7d2fe', borderRadius: '8px', outline: 'none',
    boxSizing: 'border-box' as const, fontFamily: 'inherit', color: '#2c3e50',
    resize: 'vertical' as const, minHeight: '80px', transition: 'border-color 0.2s',
  },
  addTincionBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '8px 16px', borderRadius: '8px', border: '2px dashed #f59e0b',
    background: '#fffbeb', color: '#b45309', cursor: 'pointer',
    fontSize: '0.9em', fontWeight: 600, marginTop: '6px',
    transition: 'background 0.15s', fontFamily: 'inherit',
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

// Convierte un nombre en slug seguro para carpeta de Cloudinary
const slugify = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

const Placas: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showClasificadasForm, setShowClasificadasForm] = useState(false);
  const [showSinClasificarForm, setShowSinClasificarForm] = useState(false);
  const [showReasignacionSection, setShowReasignacionSection] = useState(false);
  const [showEliminarSection, setShowEliminarSection] = useState(false);
  const [imageUploaded, setImageUploaded] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedTema, setSelectedTema] = useState('');
  const [selectedSubtema, setSelectedSubtema] = useState('');
  const [temas, setTemas] = useState<Tema[]>([]);
  const [subtemas, setSubtemas] = useState<Subtema[]>([]);
  const [loadingTemas, setLoadingTemas] = useState(true);
  const [loadingSubtemas, setLoadingSubtemas] = useState(false);
  const [temasLoadError, setTemasLoadError] = useState<string | null>(null);
  const [subtemasLoadError, setSubtemasLoadError] = useState<string | null>(null);
  const [temasReloadTick, setTemasReloadTick] = useState(0);
  const [subtemasReloadTick, setSubtemasReloadTick] = useState(0);
  const [selectedAumento, setSelectedAumento] = useState('');
  const [senalados, setSenalados] = useState<string[]>([]);
  const [senaladosPos, setSenaladosPos] = useState<Array<MarkerLocation | null>>([]);
  const [editingSenaladoIndex, setEditingSenaladoIndex] = useState<number | null>(null);
  const [namingSenaladoIndex, setNamingSenaladoIndex] = useState<number | null>(null);
  const [comentario, setComentario] = useState('');
  const [showComentario, setShowComentario] = useState(false);
  const [tincion, setTincion] = useState('');
  const [showTincion, setShowTincion] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');

  // --- Estado para subida sin clasificar (múltiples imágenes) ---
  const [scFiles, setScFiles] = useState<File[]>([]);
  const [scPreviews, setScPreviews] = useState<string[]>([]);
  const [scIsSaving, setScIsSaving] = useState(false);
  const [scSaveSuccess, setScSaveSuccess] = useState(false);
  const [scSaveError, setScSaveError] = useState('');
  const [scUploadProgress, setScUploadProgress] = useState(0);
  const scInputRef = useRef<HTMLInputElement>(null);
  const [selectedFilePreviewUrl, setSelectedFilePreviewUrl] = useState<string | null>(null);

  // Variable para verificar si alguna sección está activa
  const isAnyFormActive = showClasificadasForm || showSinClasificarForm || showReasignacionSection || showEliminarSection;

  // Cargar temas desde la base de datos
  useEffect(() => {
    const fetchTemas = async () => {
      setLoadingTemas(true);
      setTemasLoadError(null);
      const { data, error } = await supabase
        .from('temas')
        .select('id, nombre, parcial, sort_order')
        .order('parcial')
        .order('sort_order', { ascending: true });

      if (error) {
        console.error('Error al cargar temas:', error);
        setTemas([]);
        setTemasLoadError('No se pudieron cargar los temas. Revisa tu conexión e inténtalo de nuevo.');
        setLoadingTemas(false);
        return;
      }

      setTemas(data ?? []);
      setLoadingTemas(false);
    };

    fetchTemas();
  }, [temasReloadTick]);

  // Cargar subtemas cuando se selecciona un tema
  useEffect(() => {
    const fetchSubtemas = async () => {
      if (selectedTema) {
        setLoadingSubtemas(true);
        setSubtemasLoadError(null);
        const { data, error } = await supabase
          .from('subtemas')
          .select('*')
          .eq('tema_id', selectedTema)
          .order('sort_order', { ascending: true });

        if (error) {
          console.error('Error al cargar subtemas:', error);
          setSubtemas([]);
          setSubtemasLoadError('No se pudieron cargar los subtemas. Revisa tu conexión e inténtalo de nuevo.');
          setLoadingSubtemas(false);
          return;
        }

        setSubtemas(data ?? []);
        setLoadingSubtemas(false);
      } else {
        setSubtemas([]);
        setSubtemasLoadError(null);
        setLoadingSubtemas(false);
      }
    };

    fetchSubtemas();
  }, [selectedTema, subtemasReloadTick]);

  useEffect(() => {
    if (!selectedFile) {
      setSelectedFilePreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    setSelectedFilePreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedFile]);

  const handleImageSelect = (file: File) => {
    setSelectedFile(file);
    setImageUploaded(true);
    setSaveSuccess(false);
    setSaveError('');
  };

  const handleGuardar = async () => {
    if (!selectedFile || !selectedTema || !selectedSubtema) return;
    const temaObj = temas.find(t => String(t.id) === selectedTema);
    const subtemaObj = subtemas.find(s => String(s.id) === selectedSubtema);
    if (!temaObj || !subtemaObj) return;

    const senaladosPayload = buildSenaladosPayload(senalados, senaladosPos);
    if (senaladosPayload.error) {
      setSaveError(senaladosPayload.error);
      return;
    }

    setIsSaving(true);
    setSaveError('');
    setSaveSuccess(false);

    try {
      const folder = `placas/${slugify(temaObj.nombre)}/${slugify(subtemaObj.nombre)}`;
      const uploadResult = await uploadToCloudinary(selectedFile, {
        folder,
        optimizeForPlaque: true,
      });

      const { labels: senalados_filtrados, meta: senalados_meta } = senaladosPayload;
      const { data: maxPlacaData } = await supabase
        .from('placas')
        .select('sort_order')
        .eq('subtema_id', Number(selectedSubtema))
        .order('sort_order', { ascending: false })
        .limit(1);
      const nextPlacaSortOrder = (maxPlacaData && maxPlacaData.length > 0 && maxPlacaData[0].sort_order != null)
        ? maxPlacaData[0].sort_order + 1
        : 0;
      const { data: insertedPlaca, error } = await supabase
        .from('placas')
        .insert({
          photo_url: uploadResult.secure_url,
          tema_id: Number(selectedTema),
          subtema_id: Number(selectedSubtema),
          aumento: selectedAumento || null,
          senalados: senalados_filtrados.length > 0 ? senalados_filtrados : null,
          senalados_meta: senalados_meta.length > 0 ? senalados_meta : null,
          comentario: comentario.trim() || null,
          tincion: tincion.trim() || null,
          sort_order: nextPlacaSortOrder,
        })
        .select('id')
        .single();

      if (error) throw error;

      await logPlateActivity({
        actionType: 'upload_classified',
        targetTable: 'placas',
        placaId: insertedPlaca?.id ?? null,
        actor: {
          id: user?.id ?? null,
          username: user?.username ?? null,
        },
        details: {
          tema_id: Number(selectedTema),
          subtema_id: Number(selectedSubtema),
          source: 'placas_form',
        },
      });

      setSaveSuccess(true);
      setSelectedFile(null);
      setImageUploaded(false);
      setSelectedTema('');
      setSelectedSubtema('');
      setSelectedAumento('');
      setSenalados([]);
      setSenaladosPos([]);
      setEditingSenaladoIndex(null);
      setNamingSenaladoIndex(null);
      setComentario('');
      setShowComentario(false);
      setTincion('');
      setShowTincion(false);
    } catch (err) {
      console.error('Error al guardar placa:', err);
      setSaveError('Error al guardar. Por favor intenta de nuevo.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTemaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedTema(e.target.value);
    setSelectedSubtema(''); // Resetear subtema cuando cambia el tema
    setSubtemasLoadError(null);
    setSubtemasReloadTick(0);
  };

  const handleSubtemaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSubtema(e.target.value);
  };

  // --- Handlers para sin clasificar ---
  const handleScFilesAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files ?? []);
    if (newFiles.length === 0) return;
    const newPreviews = newFiles.map(f => URL.createObjectURL(f));
    setScFiles(prev => [...prev, ...newFiles]);
    setScPreviews(prev => [...prev, ...newPreviews]);
    setScSaveSuccess(false);
    setScSaveError('');
    // Limpiar input para permitir reseleccionar el mismo archivo
    if (scInputRef.current) scInputRef.current.value = '';
  };

  const handleScRemoveFile = (idx: number) => {
    URL.revokeObjectURL(scPreviews[idx]);
    setScFiles(prev => prev.filter((_, i) => i !== idx));
    setScPreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const handleScGuardar = async () => {
    if (scFiles.length === 0) return;
    setScIsSaving(true);
    setScSaveError('');
    setScSaveSuccess(false);
    setScUploadProgress(0);
    const errors: string[] = [];
    for (let i = 0; i < scFiles.length; i++) {
      try {
        const uploadResult = await uploadToCloudinary(scFiles[i], {
          folder: 'placas/sin_clasificar',
          optimizeForPlaque: true,
        });
        const publicId = getCloudinaryPublicId(uploadResult.secure_url);
        const { data: insertedWaiting, error } = await supabase
          .from('placas_sin_clasificar')
          .insert({
            photo_url: uploadResult.secure_url,
            public_id: publicId,
          })
          .select('id')
          .single();
        if (error) throw error;

        await logPlateActivity({
          actionType: 'upload_unclassified',
          targetTable: 'placas_sin_clasificar',
          waitingPlateId: insertedWaiting?.id ?? null,
          actor: {
            id: user?.id ?? null,
            username: user?.username ?? null,
          },
          details: {
            source: 'placas_form',
          },
        });
      } catch (err) {
        errors.push(`Imagen ${i + 1}: error al subir`);
        console.error(err);
      }
      setScUploadProgress(Math.round(((i + 1) / scFiles.length) * 100));
    }
    scPreviews.forEach(url => URL.revokeObjectURL(url));
    setScFiles([]);
    setScPreviews([]);
    setScIsSaving(false);
    if (errors.length > 0) {
      setScSaveError(`Se completó con algunos errores: ${errors.join(', ')}`);
    } else {
      setScSaveSuccess(true);
      setTimeout(() => setScSaveSuccess(false), 4000);
    }
  };

  const handleCancelForm = () => {
    setShowClasificadasForm(false);
    setShowSinClasificarForm(false);
    setShowReasignacionSection(false);
    setShowEliminarSection(false);
    setImageUploaded(false);
    setSelectedFile(null);
    setSelectedTema('');
    setSelectedSubtema('');
    setSelectedAumento('');
    setSenalados([]);
    setSenaladosPos([]);
    setEditingSenaladoIndex(null);
    setNamingSenaladoIndex(null);
    setComentario('');
    setShowComentario(false);
    setTincion('');
    setShowTincion(false);
    setSaveSuccess(false);
    setSaveError('');
    scPreviews.forEach(url => URL.revokeObjectURL(url));
    setScFiles([]);
    setScPreviews([]);
    setScSaveSuccess(false);
    setScSaveError('');
  };
  const handleGoBack = useSmartBackNavigation('/edicion');

  return (
    <div style={p.page}>
      <Header />

      <main style={p.main}>

                <BackButton onClick={handleGoBack} />

        {/* Encabezado */}
        <div style={p.pageHeader}>
          <h1 style={p.pageTitle}>Gestión de Placas</h1>
          <p style={p.pageSubtitle}>Sube, clasifica, reasigna y elimina las placas histológicas del atlas.</p>
          <div style={p.accentLine} />
        </div>

        {/* Grid de tarjetas */}
        <div style={{ ...p.grid, ...(isAnyFormActive ? { gridTemplateColumns: '1fr' } : {}) }} className="placas-grid">

          {/* Subir placas */}
          <div style={p.card}>
            <div style={{ ...p.cardAccent, background: 'linear-gradient(135deg, #10b981, #34d399)' }} />
            <div style={p.cardIcon}>📤</div>
            <div style={p.cardBody}>
              <h2 style={p.cardTitle}>Subir placas</h2>
              <p style={p.cardDesc}>Agrega nuevas placas histológicas, con o sin clasificación de tema y subtema.</p>
            </div>

            {!showClasificadasForm && !showSinClasificarForm && (
              <div style={p.btnGroup}>
                <button
                  style={{ ...p.actionBtn, color: '#059669', background: '#ecfdf5', borderColor: '#a7f3d0' }}
                  onClick={() => setShowClasificadasForm(true)}
                  onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg,#10b981,#34d399)'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'transparent'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#ecfdf5'; e.currentTarget.style.color = '#059669'; e.currentTarget.style.borderColor = '#a7f3d0'; }}
                >
                  ✅ Clasificadas
                </button>
                <button
                  style={{ ...p.actionBtn, color: '#b45309', background: '#fffbeb', borderColor: '#fde68a' }}
                  onClick={() => setShowSinClasificarForm(true)}
                  onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg,#f59e0b,#fbbf24)'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'transparent'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#fffbeb'; e.currentTarget.style.color = '#b45309'; e.currentTarget.style.borderColor = '#fde68a'; }}
                >
                  📋 Sin clasificar
                </button>
              </div>
            )}

            {showClasificadasForm && (
              <div style={p.formPanel}>
                <div style={p.formPanelHeader}>
                  <span style={{ ...p.formPanelDot, background: 'linear-gradient(135deg,#10b981,#34d399)' }} />
                  <span style={p.formPanelTitle}>Subir placa clasificada</span>
                </div>
                <div style={p.formPanelBody}>
                  <ImageUploader onImageSelect={handleImageSelect} />
                  {imageUploaded && (
                    <>
                      {/* --- Tema --- */}
                      <div style={styles.editFieldGroup}>
                        <label style={styles.accordionLabel}>Tema</label>
                        {loadingTemas ? (
                          <div style={styles.inlineLoading}>
                            <div style={styles.spinnerSm} /> Cargando temas...
                          </div>
                        ) : (
                          <select
                            style={styles.select}
                            value={selectedTema}
                            onChange={handleTemaChange}
                          >
                            <option value="">— Elige un tema —</option>
                            {PARCIALES.map(({ key, label }) => {
                              const group = temas.filter(t => t.parcial === key);
                              return group.length > 0 ? (
                                <optgroup key={key} label={label}>
                                  {group.map(t => (
                                    <option key={t.id} value={t.id}>{t.nombre}</option>
                                  ))}
                                </optgroup>
                              ) : null;
                            })}
                          </select>
                        )}

                        {temasLoadError && (
                          <div style={styles.loadErrorBox}>
                            <div style={styles.loadErrorRow}>
                              <span style={styles.loadErrorText}>{temasLoadError}</span>
                              <button
                                type="button"
                                style={styles.retryButton}
                                onClick={() => setTemasReloadTick(tick => tick + 1)}
                                disabled={loadingTemas}
                              >
                                {loadingTemas ? 'Reintentando...' : 'Reintentar temas'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                      {selectedTema && (
                        <div style={styles.editFieldGroup}>
                          <label style={styles.accordionLabel}>Subtema</label>
                          {loadingSubtemas ? (
                            <div style={styles.inlineLoading}>
                              <div style={styles.spinnerSm} /> Cargando subtemas...
                            </div>
                          ) : (
                            <select
                              style={{ ...styles.select, ...(subtemas.length === 0 ? styles.selectDisabled : {}) }}
                              value={selectedSubtema}
                              onChange={handleSubtemaChange}
                              disabled={subtemas.length === 0}
                            >
                              <option value="">— Elige un subtema —</option>
                              {subtemas.map(subtema => (
                                <option key={subtema.id} value={subtema.id}>{subtema.nombre}</option>
                              ))}
                            </select>
                          )}

                          {subtemasLoadError && (
                            <div style={styles.loadErrorBox}>
                              <div style={styles.loadErrorRow}>
                                <span style={styles.loadErrorText}>{subtemasLoadError}</span>
                                <button
                                  type="button"
                                  style={styles.retryButton}
                                  onClick={() => setSubtemasReloadTick(tick => tick + 1)}
                                  disabled={loadingSubtemas}
                                >
                                  {loadingSubtemas ? 'Reintentando...' : 'Reintentar subtemas'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* --- Aumento --- */}
                      {selectedSubtema && (
                        <div style={styles.editFieldGroup}>
                          <label style={styles.accordionLabel}>🔬 Aumento</label>
                          <div style={styles.aumentoGroup}>
                            {['x4', 'x10', 'x40', 'x50', 'x100'].map(op => (
                              <button
                                key={op}
                                type="button"
                                style={selectedAumento === op ? styles.aumentoBtnActive : styles.aumentoBtn}
                                onClick={() => setSelectedAumento(prev => prev === op ? '' : op)}
                              >
                                {op}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* --- Tinción --- */}
                      {selectedSubtema && (
                        <div style={styles.editFieldGroup}>
                          {!showTincion ? (
                            <button
                              type="button"
                              style={styles.addTincionBtn}
                              onClick={() => setShowTincion(true)}
                            >
                              🧪 Añadir tinción
                            </button>
                          ) : (
                            <>
                              <label style={{ ...styles.accordionLabel, color: '#b45309' }}>🧪 Tinción</label>
                              <TincionAccordionSelector value={tincion} onChange={setTincion} />
                            </>
                          )}
                        </div>
                      )}

                      {/* --- Señalados --- */}
                      {selectedSubtema && (
                        <div style={styles.editFieldGroup}>
                          <label style={styles.accordionLabel}>📌 Señalados</label>
                          {senalados.map((val, idx) => (
                            <div key={idx} style={styles.senalRow}>
                              <span style={styles.senalNumber}>{idx + 1}</span>
                              <BoldField
                                as="input"
                                inline
                                style={styles.senalTextField}
                                value={val}
                                placeholder={`Señalado ${idx + 1}`}
                                onChange={v => {
                                  const updated = [...senalados];
                                  updated[idx] = v;
                                  setSenalados(updated);
                                }}
                                onFocus={e => (e.currentTarget.style.borderColor = '#818cf8')}
                                onBlur={e => (e.currentTarget.style.borderColor = '#cbd5e1')}
                              />
                              <button
                                type="button"
                                style={styles.removeBtn}
                                title="Eliminar señalado"
                                onClick={() => {
                                  setSenalados(prev => prev.filter((_, i) => i !== idx));
                                  setSenaladosPos(prev => prev.filter((_, i) => i !== idx));
                                }}
                              >✕</button>
                              <button
                                type="button"
                                style={{ ...styles.addBtn, padding: '6px 10px', marginTop: 0, borderStyle: 'solid' }}
                                onClick={() => setEditingSenaladoIndex(idx)}
                              >
                                {senaladosPos[idx] ? '📍 Editar ubicación' : '📍 Ubicar'}
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            style={styles.addBtn}
                            onClick={() => {
                              const nextIndex = senalados.length;
                              setSenalados(prev => [...prev, '']);
                              setSenaladosPos(prev => [...prev, null]);
                              setEditingSenaladoIndex(nextIndex);
                            }}
                          >
                            + Añadir señalado
                          </button>
                        </div>
                      )}

                      {/* --- Comentario --- */}
                      {selectedSubtema && (
                        <div style={styles.editFieldGroup}>
                          {!showComentario ? (
                            <button
                              type="button"
                              style={styles.addComentarioBtn}
                              onClick={() => setShowComentario(true)}
                            >
                              💬 Añadir comentario
                            </button>
                          ) : (
                            <>
                              <label style={{ ...styles.accordionLabel, color: '#4f46e5' }}>💬 Comentario</label>
                              <BoldField
                                as="textarea"
                                style={styles.comentarioField}
                                value={comentario}
                                placeholder="Escribe un comentario para esta placa..."
                                onChange={setComentario}
                              />
                            </>
                          )}
                        </div>
                      )}

                      {selectedFile && selectedTema && selectedSubtema && (
                        <button
                          style={isSaving ? styles.saveButtonDisabled : styles.saveButton}
                          onClick={handleGuardar}
                          disabled={isSaving}
                        >
                          {isSaving ? 'Guardando...' : '💾 Guardar placa'}
                        </button>
                      )}
                      {saveSuccess && <div style={styles.successMsg}>✅ Placa guardada correctamente.</div>}
                      {saveError && <div style={styles.errorMsg}>❌ {saveError}</div>}
                    </>
                  )}
                  <button style={p.cancelBtn} onClick={handleCancelForm}>✕ Cancelar</button>
                </div>
              </div>
            )}

            {showSinClasificarForm && (
              <div style={p.formPanel}>
                <div style={p.formPanelHeader}>
                  <span style={{ ...p.formPanelDot, background: 'linear-gradient(135deg,#f59e0b,#fbbf24)' }} />
                  <span style={p.formPanelTitle}>Subir placas sin clasificar</span>
                </div>
                <div style={p.formPanelBody}>
                  {/* Zona de drop / botón de selección múltiple */}
                  <div
                    style={{
                      border: '2px dashed #fde68a', borderRadius: '10px',
                      background: '#fffbeb', padding: '20px', textAlign: 'center',
                      cursor: 'pointer', color: '#b45309', fontWeight: 600, fontSize: '0.9em',
                    }}
                    onClick={() => scInputRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); e.currentTarget.style.background = '#fef3c7'; }}
                    onDragLeave={e => { e.currentTarget.style.background = '#fffbeb'; }}
                    onDrop={e => {
                      e.preventDefault();
                      e.currentTarget.style.background = '#fffbeb';
                      const dt = e.dataTransfer;
                      const newFiles = Array.from(dt.files).filter(f => f.type.startsWith('image/'));
                      if (newFiles.length === 0) return;
                      const newPreviews = newFiles.map(f => URL.createObjectURL(f));
                      setScFiles(prev => [...prev, ...newFiles]);
                      setScPreviews(prev => [...prev, ...newPreviews]);
                      setScSaveSuccess(false); setScSaveError('');
                    }}
                  >
                    📂 Haz clic o arrastra imágenes aquí (puedes seleccionar varias)
                  </div>
                  <input
                    ref={scInputRef}
                    type="file"
                    accept="image/*,.heic,.heif,.tif,.tiff,.bmp,.avif,.webp"
                    multiple
                    style={{ display: 'none' }}
                    onChange={handleScFilesAdd}
                  />

                  {/* Previews */}
                  {scPreviews.length > 0 && (
                    <>
                      <p style={{ margin: '14px 0 8px', fontSize: '0.85em', color: '#64748b', fontWeight: 600 }}>
                        {scFiles.length} {scFiles.length === 1 ? 'imagen seleccionada' : 'imágenes seleccionadas'}
                      </p>
                      <div style={{
                        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))',
                        gap: '8px', maxHeight: '260px', overflowY: 'auto',
                      }}>
                        {scPreviews.map((src, idx) => (
                          <div key={idx} style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', border: '1.5px solid #fde68a' }}>
                            <img src={src} alt={`preview-${idx}`} style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', objectPosition: 'center center', display: 'block' }} />
                            <button
                              type="button"
                              onClick={() => handleScRemoveFile(idx)}
                              style={{
                                position: 'absolute', top: '4px', right: '4px',
                                background: 'rgba(239,68,68,0.85)', color: '#fff',
                                border: 'none', borderRadius: '50%', width: '20px', height: '20px',
                                cursor: 'pointer', fontSize: '0.75em', fontWeight: 700,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                              }}
                              title="Quitar imagen"
                            >✕</button>
                          </div>
                        ))}
                      </div>

                      {/* Progreso */}
                      {scIsSaving && (
                        <div style={{ marginTop: '12px' }}>
                          <div style={{ background: '#fef3c7', borderRadius: '6px', overflow: 'hidden', height: '8px' }}>
                            <div style={{ width: `${scUploadProgress}%`, height: '100%', background: 'linear-gradient(90deg,#f59e0b,#fbbf24)', transition: 'width 0.3s' }} />
                          </div>
                          <p style={{ fontSize: '0.82em', color: '#b45309', margin: '4px 0 0', textAlign: 'center' }}>
                            Subiendo... {scUploadProgress}%
                          </p>
                        </div>
                      )}

                      <button
                        type="button"
                        style={{
                          ...styles.saveButton,
                          background: scIsSaving || scFiles.length === 0 ? '#fde68a' : 'linear-gradient(135deg,#f59e0b,#fbbf24)',
                          color: scIsSaving || scFiles.length === 0 ? '#92400e' : '#fff',
                          cursor: scIsSaving || scFiles.length === 0 ? 'not-allowed' : 'pointer',
                          opacity: scIsSaving || scFiles.length === 0 ? 0.75 : 1,
                        }}
                        onClick={handleScGuardar}
                        disabled={scIsSaving || scFiles.length === 0}
                      >
                        {scIsSaving ? `Subiendo ${scUploadProgress}%...` : `📤 Guardar ${scFiles.length} imagen${scFiles.length !== 1 ? 'es' : ''} sin clasificar`}
                      </button>
                    </>
                  )}

                  {scSaveSuccess && (
                    <div style={{ ...styles.successMsg, marginTop: '12px' }}>✅ Imágenes guardadas en lista de espera.</div>
                  )}
                  {scSaveError && (
                    <div style={{ ...styles.errorMsg, marginTop: '12px' }}>⚠️ {scSaveError}</div>
                  )}

                  <button style={p.cancelBtn} onClick={handleCancelForm}>✕ Cancelar</button>
                </div>
              </div>
            )}
          </div>

          {/* Reasignación y Eliminar — solo visibles cuando ningún form está abierto */}
          {!isAnyFormActive && (<>

          {/* Reasignación */}
          <div style={p.card}>
            <div style={{ ...p.cardAccent, background: 'linear-gradient(135deg, #6366f1, #818cf8)' }} />
            <div style={p.cardIcon}>🔄</div>
            <div style={p.cardBody}>
              <h2 style={p.cardTitle}>Reasignación</h2>
              <p style={p.cardDesc}>Mueve placas entre temas o subtemas, o gestiona la lista de espera de clasificación.</p>
            </div>
            <div style={p.btnGroup}>
              <button
                style={{ ...p.actionBtn, color: '#6366f1', background: '#f5f3ff', borderColor: '#c7d2fe' }}
                onClick={() => navigate('/mover-placa')}
                onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg,#6366f1,#818cf8)'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'transparent'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#f5f3ff'; e.currentTarget.style.color = '#6366f1'; e.currentTarget.style.borderColor = '#c7d2fe'; }}
              >
                📂 Editar placas
              </button>
              <button
                style={{ ...p.actionBtn, color: '#6366f1', background: '#f5f3ff', borderColor: '#c7d2fe' }}
                onClick={() => navigate('/lista-espera')}
                onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg,#6366f1,#818cf8)'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'transparent'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#f5f3ff'; e.currentTarget.style.color = '#6366f1'; e.currentTarget.style.borderColor = '#c7d2fe'; }}
              >
                ⏳ Lista de espera
              </button>
            </div>
          </div>

          {/* Mapas interactivos */}
          <div style={p.card}>
            <div style={{ ...p.cardAccent, background: 'linear-gradient(135deg, #0ea5e9, #22d3ee)' }} />
            <div style={p.cardIcon}>🗺️</div>
            <div style={p.cardBody}>
              <h2 style={p.cardTitle}>Crea mapas interactivos</h2>
              <p style={p.cardDesc}>Sección preparada para gestionar mapas interactivos de forma visual.</p>
            </div>
            <div style={p.btnGroup}>
              <button
                type="button"
                style={{ ...p.actionBtn, color: '#0369a1', background: '#ecfeff', borderColor: '#a5f3fc' }}
                onClick={() => navigate('/mapas-interactivos')}
                onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg,#0ea5e9,#22d3ee)'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'transparent'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#ecfeff'; e.currentTarget.style.color = '#0369a1'; e.currentTarget.style.borderColor = '#a5f3fc'; }}
              >
                ➕ Crear
              </button>
              <button
                type="button"
                style={{ ...p.actionBtn, color: '#0369a1', background: '#ecfeff', borderColor: '#a5f3fc' }}
                onClick={() => navigate('/mapas-interactivos?modo=editar')}
                onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg,#0ea5e9,#22d3ee)'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'transparent'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#ecfeff'; e.currentTarget.style.color = '#0369a1'; e.currentTarget.style.borderColor = '#a5f3fc'; }}
              >
                ✏️ Editar
              </button>
            </div>
          </div>

          {/* Tinciones */}
          <div style={p.card}>
            <div style={{ ...p.cardAccent, background: 'linear-gradient(135deg, #f59e0b, #fbbf24)' }} />
            <div style={p.cardIcon}>🧪</div>
            <div style={p.cardBody}>
              <h2 style={p.cardTitle}>Tinciones</h2>
              <p style={p.cardDesc}>Administra el catalogo de tinciones: crear, editar y eliminar.</p>
            </div>
            <div style={p.btnGroup}>
              <button
                type="button"
                style={{ ...p.actionBtn, color: '#b45309', background: '#fffbeb', borderColor: '#fde68a' }}
                onClick={() => navigate('/gestion-tinciones')}
                onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg,#f59e0b,#fbbf24)'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'transparent'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#fffbeb'; e.currentTarget.style.color = '#b45309'; e.currentTarget.style.borderColor = '#fde68a'; }}
              >
                ⚙️ Gestionar tinciones
              </button>
            </div>
          </div>

          {/* Eliminar */}
          <div style={p.card}>
            <div style={{ ...p.cardAccent, background: 'linear-gradient(135deg, #ef4444, #f87171)' }} />
            <div style={p.cardIcon}>🗑️</div>
            <div style={p.cardBody}>
              <h2 style={p.cardTitle}>Eliminar placas</h2>
              <p style={p.cardDesc}>Borra permanentemente placas del atlas. Esta acción no se puede deshacer.</p>
            </div>
            <div style={p.btnGroup}>
              <button
                style={{ ...p.actionBtn, color: '#dc2626', background: '#fff1f2', borderColor: '#fecaca' }}
                onClick={() => navigate('/eliminar-placas')}
                onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg,#ef4444,#f87171)'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'transparent'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#fff1f2'; e.currentTarget.style.color = '#dc2626'; e.currentTarget.style.borderColor = '#fecaca'; }}
              >
                🗑️ Eliminar
              </button>
            </div>
          </div>

          </>)}
        </div>
      </main>

      <Footer />
      <LoadingToast visible={isSaving} type="uploading" message="Guardando placa" />

      {editingSenaladoIndex !== null && selectedFilePreviewUrl && (
        <SenaladoLocationPicker
          imageSrc={selectedFilePreviewUrl}
          senaladoLabel={senalados[editingSenaladoIndex] ?? ''}
          initialLocation={senaladosPos[editingSenaladoIndex] ?? null}
          onCancel={() => setEditingSenaladoIndex(null)}
          onRemove={() => {
            const targetIndex = editingSenaladoIndex;
            setSenalados(prev => prev.filter((_, i) => i !== targetIndex));
            setSenaladosPos(prev => prev.filter((_, i) => i !== targetIndex));
            setEditingSenaladoIndex(null);
            setNamingSenaladoIndex(null);
          }}
          onSave={(location) => {
            const targetIndex = editingSenaladoIndex;
            setSenaladosPos(prev => {
              const next = [...prev];
              next[targetIndex] = location;
              return next;
            });

            const currentLabel = (senalados[targetIndex] ?? '').trim();
            if (!currentLabel) {
              setNamingSenaladoIndex(targetIndex);
            }

            setEditingSenaladoIndex(null);
          }}
        />
      )}

      {namingSenaladoIndex !== null && (
        <RequiredTextPromptModal
          title="Nombre del señalado"
          description="Después de ubicar el señalado, debes escribir su nombre para continuar."
          placeholder="Ej: Núcleo de hepatocito"
          required
          cancelLabel="Cancelar y señalar de nuevo"
          onCancel={() => {
            const targetIndex = namingSenaladoIndex;
            setNamingSenaladoIndex(null);
            setEditingSenaladoIndex(targetIndex);
          }}
          onSubmit={(value) => {
            setSenalados(prev => {
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

const p: { [key: string]: React.CSSProperties } = {
  page: {
    minHeight: '100vh',
    display: 'flex', flexDirection: 'column',
    fontFamily: '"Montserrat", "Segoe UI", sans-serif',
    color: '#0f172a',
    backgroundColor: 'transparent',
  },
  main: {
    flex: 1,
    width: '100%',
    maxWidth: '1280px',
    margin: '0 auto',
    boxSizing: 'border-box',
    display: 'flex', flexDirection: 'column',
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
    transition: 'background 0.15s', fontFamily: 'inherit', letterSpacing: '0.01em',
  },
  breadcrumbSep: { color: '#94a3b8', fontWeight: 700, fontSize: '0.75em', userSelect: 'none' },
  breadcrumbCurrent: {
    color: '#0f172a', fontWeight: 800, fontSize: '0.88em', padding: '4px 8px',
    background: 'linear-gradient(135deg, #e0f2fe, #ede9fe)', borderRadius: '8px',
    border: '1px solid #bae6fd', letterSpacing: '0.01em',
  },
  pageHeader: { width: '100%', display: 'flex', flexDirection: 'column', gap: '6px' },
  pageTitle: {
    fontSize: 'clamp(1.6em, 4vw, 2.4em)', fontWeight: 900, color: '#0f172a',
    letterSpacing: '-0.03em', margin: 0,
  },
  pageSubtitle: { fontSize: 'clamp(0.88em, 2vw, 1em)', color: '#64748b', margin: 0, lineHeight: 1.6 },
  accentLine: {
    marginTop: '10px', width: '56px', height: '4px',
    background: 'linear-gradient(90deg, #10b981, #34d399)', borderRadius: '4px',
  },
  grid: {
    width: '100%',
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 'clamp(12px, 2.5vw, 20px)',
    alignItems: 'start',
  },
  card: {
    background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
    borderRadius: '18px',
    padding: 'clamp(18px, 2.5vw, 28px)',
    boxShadow: '0 6px 24px rgba(15,23,42,0.08), 0 2px 6px rgba(15,23,42,0.04)',
    border: '1px solid rgba(15,23,42,0.05)',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    position: 'relative',
    overflow: 'hidden',
    boxSizing: 'border-box',
  } as React.CSSProperties,
  cardAccent: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '4px',
    borderRadius: '18px 18px 0 0',
  } as React.CSSProperties,
  cardIcon: { fontSize: 'clamp(1.8em, 2.5vw, 2.2em)', lineHeight: 1, marginTop: '4px' },
  cardBody: { display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 },
  cardTitle: {
    fontSize: 'clamp(1em, 2vw, 1.25em)', fontWeight: 800, color: '#0f172a',
    letterSpacing: '-0.02em', margin: 0,
  },
  cardDesc: { fontSize: 'clamp(0.78em, 1.4vw, 0.88em)', color: '#64748b', margin: 0, lineHeight: 1.6 },
  btnGroup: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  actionBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '5px',
    padding: '9px 14px', borderRadius: '10px', border: '1.5px solid #c7d2fe',
    background: '#f5f3ff', color: '#6366f1', fontSize: '0.82em', fontWeight: 700,
    cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s ease',
    letterSpacing: '0.01em',
  } as React.CSSProperties,
  formPanel: {
    background: 'rgba(248,250,252,0.9)',
    borderRadius: '12px',
    border: '1px solid rgba(15,23,42,0.08)',
    overflow: 'hidden',
    marginTop: '4px',
  },
  formPanelHeader: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '12px 16px', borderBottom: '1px solid rgba(15,23,42,0.07)',
    background: 'rgba(255,255,255,0.6)',
  },
  formPanelDot: {
    display: 'inline-block', width: '10px', height: '10px',
    borderRadius: '50%', flexShrink: 0,
  } as React.CSSProperties,
  formPanelTitle: { fontSize: '0.9em', fontWeight: 700, color: '#0f172a' },
  formPanelBody: { padding: '16px' },
  cancelBtn: {
    marginTop: '14px', padding: '9px 16px', border: '1.5px solid #fecaca',
    borderRadius: '10px', background: '#fff1f2', color: '#dc2626',
    fontSize: '0.84em', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
    transition: 'all 0.2s ease',
  } as React.CSSProperties,
};

export default Placas;





