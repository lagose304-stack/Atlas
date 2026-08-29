import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  ChevronRight,
  Folder,
  Layers,
  Microscope,
} from 'lucide-react';
import { getCloudinaryImageUrl } from '../../services/cloudinaryImages';
import { useAuth } from '../../contexts/AuthContext';
import {
  canBypassMaintenance,
  fetchSiteMaintenanceStatus,
  isFeatureDisabled,
  isParcialDisabled,
  isTemaDisabled,
  type SiteMaintenanceStatus,
} from '../../services/siteMaintenance';
import {
  getCachedTemas,
  getCachedSubtemas,
  getCachedPlacasForSubtema,
  getQuickTemas,
  getQuickSubtemas,
  getQuickPlacasForSubtema,
} from '../../services/catalogService';

export interface ComparadorPlacaItem {
  id: number;
  photo_url: string;
  aumento?: string | null;
  tincion?: string | null;
  comentario?: string | null;
  senalados?: string[] | null;
  senalados_meta?: Array<{
    label: string;
    x: number | null;
    y: number | null;
    startX?: number | null;
    startY?: number | null;
    regionPoints?: number[] | null;
    regionColor?: string | null;
    regionOpacity?: number | null;
  }> | null;
  subtema_id: number;
  subtema_nombre: string;
  tema_id: number;
  tema_nombre: string;
  parcial_key: string;
}

interface PlatePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPlate: (plate: ComparadorPlacaItem) => void;
  targetLetter: 'A' | 'B';
  initialParcial?: 'primer' | 'segundo' | 'tercer';
}

interface ParcialOption {
  key: 'primer' | 'segundo' | 'tercer';
  label: string;
  num: string;
  description: string;
}

const PARCIALES: ParcialOption[] = [
  { key: 'primer', label: 'Primer Parcial', num: '1', description: 'Tejido epitelial, conectivo, adiposo...' },
  { key: 'segundo', label: 'Segundo Parcial', num: '2', description: 'Cartílago, hueso, sangre, muscular...' },
  { key: 'tercer', label: 'Tercer Parcial', num: '3', description: 'Nervioso, cardiovascular, linfoide...' },
];

interface TemaRow {
  id: number;
  nombre: string;
  logo_url?: string | null;
  parcial?: string | null;
}

interface SubtemaRow {
  id: number;
  nombre: string;
  logo_url?: string | null;
  tema_id: number;
}

interface PlacaRow {
  id: number;
  photo_url: string;
  aumento?: string | null;
  tincion?: string | null;
  comentario?: string | null;
  senalados?: string[] | null;
  senalados_meta?: Array<{
    label: string;
    x: number | null;
    y: number | null;
    startX?: number | null;
    startY?: number | null;
    regionPoints?: number[] | null;
    regionColor?: string | null;
    regionOpacity?: number | null;
  }> | null;
}

export const PlatePickerModal: React.FC<PlatePickerModalProps> = ({
  isOpen,
  onClose,
  onSelectPlate,
  targetLetter,
  initialParcial,
}) => {
  const { user, isAuthenticated } = useAuth();
  const canBypass = canBypassMaintenance(user, isAuthenticated);

  const [selectedParcial, setSelectedParcial] = useState<ParcialOption | null>(null);
  const [selectedTema, setSelectedTema] = useState<TemaRow | null>(null);
  const [selectedSubtema, setSelectedSubtema] = useState<SubtemaRow | null>(null);

  const [temas, setTemas] = useState<TemaRow[]>([]);
  const [subtemas, setSubtemas] = useState<SubtemaRow[]>([]);
  const [placas, setPlacas] = useState<PlacaRow[]>([]);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [maintenanceStatus, setMaintenanceStatus] = useState<SiteMaintenanceStatus | null>(null);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!isOpen) return;
    void fetchSiteMaintenanceStatus().then(setMaintenanceStatus);

    if (initialParcial) {
      const match = PARCIALES.find((p) => p.key === initialParcial) || PARCIALES[0];
      setSelectedParcial(match);
      void handleSelectParcial(match);
    } else {
      setSelectedParcial(null);
      setSelectedTema(null);
      setSelectedSubtema(null);
      setTemas([]);
      setSubtemas([]);
      setPlacas([]);
      setError(null);
      setFailedImages({});
    }
  }, [isOpen, initialParcial]);

  const visibleParciales = useMemo(() => {
    if (canBypass || !maintenanceStatus) return PARCIALES;
    return PARCIALES.filter((p) => !isParcialDisabled(p.key, maintenanceStatus.disabledFeatures));
  }, [canBypass, maintenanceStatus]);

  const handleImageError = (key: string) => {
    setFailedImages((prev) => ({ ...prev, [key]: true }));
  };

  const handleSelectParcial = async (parcial: ParcialOption) => {
    setSelectedParcial(parcial);
    setSelectedTema(null);
    setSelectedSubtema(null);
    setPlacas([]);
    setError(null);

    const quickTemas = getQuickTemas();
    if (quickTemas && quickTemas.length > 0) {
      const filteredQuick = quickTemas.filter((t) => {
        const p = (t.parcial || '').toLowerCase();
        return p.includes(parcial.key);
      });
      if (filteredQuick.length > 0) {
        setTemas(filteredQuick as unknown as TemaRow[]);
      }
    } else {
      setLoading(true);
    }

    try {
      const currentMaintenance = await fetchSiteMaintenanceStatus();
      if (!canBypass) {
        if (currentMaintenance.enabled) {
          setError('El sitio se encuentra temporalmente fuera de servicio por mantenimiento.');
          setLoading(false);
          return;
        }
        if (isParcialDisabled(parcial.key, currentMaintenance.disabledFeatures)) {
          setError('Este parcial se encuentra temporalmente fuera de servicio por mantenimiento.');
          setLoading(false);
          return;
        }
        if (isFeatureDisabled('public_catalog', currentMaintenance.disabledFeatures)) {
          setError('El catálogo de temas y placas se encuentra temporalmente deshabilitado por mantenimiento.');
          setLoading(false);
          return;
        }
      }

      const data = await getCachedTemas();
      const filtered = (data || []).filter((t) => {
        const p = (t.parcial || '').toLowerCase();
        if (!p.includes(parcial.key)) return false;
        if (!canBypass && isTemaDisabled(t.id, t.parcial, currentMaintenance.disabledFeatures)) return false;
        return true;
      });

      setTemas(filtered as unknown as TemaRow[]);
    } catch (err: any) {
      console.error('Error fetching temas:', err);
      const fallback = getQuickTemas();
      if (fallback && fallback.length > 0) {
        const filtered = fallback.filter((t) => (t.parcial || '').toLowerCase().includes(parcial.key));
        setTemas(filtered as unknown as TemaRow[]);
      } else {
        setError('No se pudieron cargar los temas de este parcial.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTema = async (tema: TemaRow) => {
    setSelectedTema(tema);
    setSelectedSubtema(null);
    setPlacas([]);
    setError(null);

    const quick = getQuickSubtemas(tema.id);
    if (quick && quick.length > 0) {
      setSubtemas(quick as unknown as SubtemaRow[]);
    } else {
      setLoading(true);
    }

    try {
      const data = await getCachedSubtemas(tema.id);
      setSubtemas((data || []) as unknown as SubtemaRow[]);
    } catch (err: any) {
      console.error('Error fetching subtemas:', err);
      const fallback = getQuickSubtemas(tema.id);
      if (fallback && fallback.length > 0) {
        setSubtemas(fallback as unknown as SubtemaRow[]);
      } else {
        setError('No se pudieron cargar los subtemas de este tema.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSubtema = async (subtema: SubtemaRow) => {
    setSelectedSubtema(subtema);
    setError(null);

    const subtemaIdNum = Number(subtema.id);
    const quickBundle = getQuickPlacasForSubtema(subtemaIdNum);
    if (quickBundle && quickBundle.placas && quickBundle.placas.length > 0) {
      setPlacas(quickBundle.placas as unknown as PlacaRow[]);
    } else {
      setLoading(true);
    }

    try {
      const bundle = await getCachedPlacasForSubtema(subtemaIdNum);
      setPlacas((bundle.placas || []) as unknown as PlacaRow[]);
    } catch (err: any) {
      console.error('Error fetching placas:', err);
      const fallback = getQuickPlacasForSubtema(subtemaIdNum);
      if (fallback && fallback.placas && fallback.placas.length > 0) {
        setPlacas(fallback.placas as unknown as PlacaRow[]);
      } else {
        setError('No se pudieron cargar las placas de este subtema.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePickPlaca = (placa: PlacaRow) => {
    if (!selectedSubtema || !selectedTema || !selectedParcial) return;

    const fullPlacaItem: ComparadorPlacaItem = {
      id: placa.id,
      photo_url: placa.photo_url,
      aumento: placa.aumento,
      tincion: placa.tincion,
      comentario: placa.comentario,
      senalados: placa.senalados,
      senalados_meta: placa.senalados_meta,
      subtema_id: selectedSubtema.id,
      subtema_nombre: selectedSubtema.nombre,
      tema_id: selectedTema.id,
      tema_nombre: selectedTema.nombre,
      parcial_key: selectedParcial.key,
    };

    onSelectPlate(fullPlacaItem);
    onClose();
  };

  // Go back one step
  const handleStepBack = () => {
    if (selectedSubtema) {
      setSelectedSubtema(null);
      setPlacas([]);
    } else if (selectedTema) {
      setSelectedTema(null);
      setSubtemas([]);
    } else if (selectedParcial) {
      setSelectedParcial(null);
      setTemas([]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="plate-picker-backdrop" onClick={onClose}>
      <div
        className="plate-picker-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="picker-title"
      >
        {/* Modal Header */}
        <div className="plate-picker-header">
          <div className="plate-picker-title-row">
            <div className="plate-picker-icon-badge">
              <Microscope size={20} />
            </div>
            <div>
              <h2 id="picker-title" className="plate-picker-title">
                Seleccionar Placa {targetLetter}
              </h2>
            </div>
          </div>
          <button
            type="button"
            className="plate-picker-close-btn"
            onClick={onClose}
            aria-label="Cerrar modal"
          >
            ✕
          </button>
        </div>

        {/* Step Breadcrumb Bar */}
        <div className="plate-picker-breadcrumbs-bar">
          <button
            type="button"
            className={`plate-picker-breadcrumb-item ${!selectedParcial ? 'is-active' : 'is-completed'}`}
            onClick={() => {
              setSelectedParcial(null);
              setSelectedTema(null);
              setSelectedSubtema(null);
            }}
          >
            <CalendarDays size={14} />
            <span>1. Parcial {selectedParcial ? `(${selectedParcial.label.split(' ')[0]})` : ''}</span>
          </button>

          <ChevronRight size={14} className="plate-picker-breadcrumb-arrow" />

          <button
            type="button"
            className={`plate-picker-breadcrumb-item ${selectedParcial && !selectedTema ? 'is-active' : selectedTema ? 'is-completed' : 'is-disabled'}`}
            disabled={!selectedParcial}
            onClick={() => {
              setSelectedTema(null);
              setSelectedSubtema(null);
            }}
          >
            <BookOpen size={14} />
            <span>2. Tema {selectedTema ? `(${selectedTema.nombre})` : ''}</span>
          </button>

          <ChevronRight size={14} className="plate-picker-breadcrumb-arrow" />

          <button
            type="button"
            className={`plate-picker-breadcrumb-item ${selectedTema && !selectedSubtema ? 'is-active' : selectedSubtema ? 'is-completed' : 'is-disabled'}`}
            disabled={!selectedTema}
            onClick={() => {
              setSelectedSubtema(null);
            }}
          >
            <Layers size={14} />
            <span>3. Subtema {selectedSubtema ? `(${selectedSubtema.nombre})` : ''}</span>
          </button>

          <ChevronRight size={14} className="plate-picker-breadcrumb-arrow" />

          <span
            className={`plate-picker-breadcrumb-item ${selectedSubtema ? 'is-active' : 'is-disabled'}`}
          >
            <Microscope size={14} />
            <span>4. Placas</span>
          </span>
        </div>

        {/* Modal Content Body */}
        <div className="plate-picker-body">
          {/* Back Action if not on first step */}
          {selectedParcial && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <button
                type="button"
                className="plate-picker-back-btn"
                onClick={handleStepBack}
              >
                <ArrowLeft size={15} />
                <span>Volver</span>
              </button>
              <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
                {selectedSubtema
                  ? `${selectedTema?.nombre} ➔ ${selectedSubtema.nombre}`
                  : selectedTema
                  ? `${selectedParcial.label} ➔ ${selectedTema.nombre}`
                  : selectedParcial.label}
              </span>
            </div>
          )}

          {loading ? (
            <div style={{ padding: '48px 20px', textAlign: 'center', color: '#64748b' }}>
              <span className="route-loading-spinner" style={{ marginBottom: 12 }} />
              <div>Cargando...</div>
            </div>
          ) : error ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#dc2626' }}>{error}</div>
          ) : !selectedParcial ? (
            /* STEP 1: Choose Parcial */
            <div className="plate-picker-step-section">
              <h3 className="plate-picker-step-heading">Paso 1: Selecciona un Parcial</h3>
              <div className="plate-picker-parciales-grid">
                {visibleParciales.map((parcial) => (
                  <button
                    key={parcial.key}
                    type="button"
                    className="plate-picker-parcial-card"
                    onClick={() => handleSelectParcial(parcial)}
                  >
                    <div className="plate-picker-parcial-number">{parcial.num}</div>
                    <div className="plate-picker-parcial-info">
                      <h4 className="plate-picker-parcial-title">{parcial.label}</h4>
                      <p className="plate-picker-parcial-desc">{parcial.description}</p>
                    </div>
                    <ChevronRight size={20} className="plate-picker-card-arrow" />
                  </button>
                ))}
              </div>
            </div>
          ) : !selectedTema ? (
            /* STEP 2: Choose Tema */
            <div className="plate-picker-step-section">
              <h3 className="plate-picker-step-heading">Paso 2: Selecciona un Tema de {selectedParcial.label}</h3>
              {temas.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                  No hay temas registrados en este parcial.
                </div>
              ) : (
                <div className="plate-picker-list-grid">
                  {temas.map((tema) => {
                    const imgKey = `tema-${tema.id}`;
                    const hasValidImage = tema.logo_url && !failedImages[imgKey];

                    return (
                      <button
                        key={tema.id}
                        type="button"
                        className="plate-picker-list-item-btn"
                        onClick={() => handleSelectTema(tema)}
                      >
                        <div className="plate-picker-media-thumb">
                          {hasValidImage ? (
                            <img
                              src={getCloudinaryImageUrl(tema.logo_url!, 'thumb')}
                              alt={tema.nombre}
                              className="plate-picker-media-img"
                              onError={() => handleImageError(imgKey)}
                              loading="lazy"
                            />
                          ) : (
                            <div className="plate-picker-list-icon">
                              <Folder size={20} />
                            </div>
                          )}
                        </div>
                        <div className="plate-picker-media-info">
                          <span className="plate-picker-list-item-title">{tema.nombre}</span>
                        </div>
                        <ChevronRight size={18} className="plate-picker-card-arrow" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : !selectedSubtema ? (
            /* STEP 3: Choose Subtema */
            <div className="plate-picker-step-section">
              <h3 className="plate-picker-step-heading">Paso 3: Selecciona un Subtema ({selectedTema.nombre})</h3>
              {subtemas.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                  No hay subtemas registrados para este tema.
                </div>
              ) : (
                <div className="plate-picker-list-grid">
                  {subtemas.map((subtema) => {
                    const imgKey = `subtema-${subtema.id}`;
                    const hasValidImage = subtema.logo_url && !failedImages[imgKey];

                    return (
                      <button
                        key={subtema.id}
                        type="button"
                        className="plate-picker-list-item-btn"
                        onClick={() => handleSelectSubtema(subtema)}
                      >
                        <div className="plate-picker-media-thumb">
                          {hasValidImage ? (
                            <img
                              src={getCloudinaryImageUrl(subtema.logo_url!, 'thumb')}
                              alt={subtema.nombre}
                              className="plate-picker-media-img"
                              onError={() => handleImageError(imgKey)}
                              loading="lazy"
                            />
                          ) : (
                            <div className="plate-picker-list-icon">
                              <Layers size={20} />
                            </div>
                          )}
                        </div>
                        <div className="plate-picker-media-info">
                          <span className="plate-picker-list-item-title">{subtema.nombre}</span>
                        </div>
                        <ChevronRight size={18} className="plate-picker-card-arrow" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* STEP 4: Choose Plate from Subtema */
            <div className="plate-picker-step-section">
              <h3 className="plate-picker-step-heading">
                Paso 4: Selecciona una Placa ({selectedSubtema.nombre})
              </h3>
              {placas.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                  No hay placas cargadas en este subtema.
                </div>
              ) : (
                <div className="plate-picker-grid">
                  {placas.map((placa) => (
                    <button
                      key={placa.id}
                      type="button"
                      className="plate-picker-card"
                      onClick={() => handlePickPlaca(placa)}
                    >
                      <div className="plate-picker-thumb-wrap">
                        <img
                          src={getCloudinaryImageUrl(placa.photo_url, 'thumb')}
                          alt="Placa histológica"
                          className="plate-picker-thumb"
                          loading="lazy"
                        />
                      </div>
                      <div className="plate-picker-card-body">
                        <div className="plate-picker-badges-row" style={{ marginTop: 0 }}>
                          {placa.aumento && (
                            <span className="comparador-tag comparador-tag-aumento">
                              {placa.aumento}
                            </span>
                          )}
                          {placa.tincion && (
                            <span className="comparador-tag comparador-tag-tincion">
                              {placa.tincion}
                            </span>
                          )}
                          {placa.senalados && placa.senalados.length > 0 && (
                            <span
                              className="comparador-tag"
                              style={{
                                background: '#f0fdf4',
                                color: '#166534',
                                border: '1px solid #bbf7d0',
                              }}
                            >
                              {placa.senalados.length} señalados
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlatePickerModal;
