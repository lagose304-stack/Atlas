import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Eye, Images, Microscope, MousePointerClick, Shield } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import BackButton from '../components/BackButton';
import Header from '../components/Header';
import Footer from '../components/Footer';
import ImageViewerModal from '../components/ImageViewerModal';
import ResilientPlacaThumb from '../components/ResilientPlacaThumb';
import ContentBlockRenderer from '../components/ContentBlockRenderer';
import type { ContentBlock } from '../types/contentBlocks';
import { getCloudinaryImageUrl } from '../services/cloudinaryImages';
import { getRenderableBlocks } from '../services/contentPublication';
import { logPlacaView, logSubtemaView } from '../services/analytics';
import { useSmartBackNavigation } from '../hooks/useSmartBackNavigation';
import {
  canBypassMaintenance,
  fetchSiteMaintenanceStatus,
  isFeatureDisabled,
  isTemaDisabled,
} from '../services/siteMaintenance';
import {
  getCachedPlacasForSubtema,
  getCachedSubtemas,
  getQuickPlacasForSubtema,
  getQuickSubtemaById,
  getQuickSubtemas,
  prefetchSubtemaPlacas,
} from '../services/catalogService';
import { getPreservedSearchParam, syncUrlSearchParam } from '../services/navigationStateKeeper';

interface Placa {
  id: number;
  photo_url: string;
  aumento?: string | null;
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
  comentario?: string | null;
  tincion?: string | null;
}

interface SubtemaInfo {
  id: number;
  nombre: string;
  tema_id: number;
  sort_order?: number | null;
  logo_url?: string | null;
  temas?: { nombre: string; parcial?: string } | { nombre: string; parcial?: string }[];
}

interface SubtemaNav {
  id: number;
  nombre: string;
  tema_id: number;
  sort_order?: number | null;
}

interface PlacaGroupByAumento {
  key: string;
  title: string;
  sortValue: number;
  items: Placa[];
}

const parseAumentoSortValue = (aumento: string): number => {
  const normalized = aumento.trim().replace(',', '.');
  const match = normalized.match(/\d+(?:\.\d+)?/);
  if (!match) return Number.POSITIVE_INFINITY;

  const numeric = Number.parseFloat(match[0]);
  return Number.isFinite(numeric) ? numeric : Number.POSITIVE_INFINITY;
};

const normalizeAumentoLabel = (aumento: string): string => aumento.trim().replace(/\s+/g, '').toUpperCase();

interface AumentoVisualMeta {
  color: string;
  bg: string;
  border: string;
  badgeBg: string;
  name: string;
}

const getAumentoMeta = (aumentoRaw?: string | null): AumentoVisualMeta => {
  const normalized = (aumentoRaw ?? '').trim().toUpperCase().replace(/\s+/g, '');
  if (normalized.includes('4X') || normalized === '4') {
    return {
      color: '#ef4444',
      bg: 'rgba(239, 68, 68, 0.08)',
      border: 'rgba(239, 68, 68, 0.32)',
      badgeBg: 'rgba(239, 68, 68, 0.14)',
      name: 'Objetivo 4X · Panorámico',
    };
  }
  if (normalized.includes('10X') || normalized === '10') {
    return {
      color: '#f59e0b',
      bg: 'rgba(245, 158, 11, 0.08)',
      border: 'rgba(245, 158, 11, 0.32)',
      badgeBg: 'rgba(245, 158, 11, 0.14)',
      name: 'Objetivo 10X · Bajo Aumento',
    };
  }
  if (normalized.includes('40X') || normalized === '40') {
    return {
      color: '#3b82f6',
      bg: 'rgba(59, 130, 246, 0.08)',
      border: 'rgba(59, 130, 246, 0.32)',
      badgeBg: 'rgba(59, 130, 246, 0.14)',
      name: 'Objetivo 40X · Seco Fuerte',
    };
  }
  if (normalized.includes('100X') || normalized === '100') {
    return {
      color: '#8b5cf6',
      bg: 'rgba(139, 92, 246, 0.08)',
      border: 'rgba(139, 92, 246, 0.32)',
      badgeBg: 'rgba(139, 92, 246, 0.14)',
      name: 'Objetivo 100X · Inmersión',
    };
  }
  return {
    color: '#6366f1',
    bg: 'rgba(99, 102, 241, 0.08)',
    border: 'rgba(99, 102, 241, 0.32)',
    badgeBg: 'rgba(99, 102, 241, 0.14)',
    name: aumentoRaw && aumentoRaw.trim() !== '' ? `Aumento ${aumentoRaw}` : 'Placas Generales',
  };
};

const PlacasSubtemaContent: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { subtemaId } = useParams<{ subtemaId: string }>();
  const numSubtemaId = Number(subtemaId ?? 0);

  const initialSubtema = getQuickSubtemaById(numSubtemaId);
  const initialPlacasBundle = getQuickPlacasForSubtema(numSubtemaId);
  const initialSiblingSubtemas = initialSubtema ? getQuickSubtemas(initialSubtema.tema_id) : null;
  const hasCompleteInitialData = Boolean(initialSubtema && initialPlacasBundle && initialPlacasBundle.placas.length > 0);

  const [placas, setPlacas] = useState<Placa[]>((initialPlacasBundle?.placas as unknown as Placa[]) ?? []);
  const [subtema, setSubtema] = useState<SubtemaInfo | null>(
    initialSubtema
      ? {
          id: initialSubtema.id,
          nombre: initialSubtema.nombre,
          tema_id: initialSubtema.tema_id,
          sort_order: initialSubtema.sort_order,
        }
      : null
  );
  const initialPlacaIdParam = (() => {
    const raw = getPreservedSearchParam('placa');
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  })();

  const initialSelectedPlaca = initialPlacaIdParam && initialPlacasBundle?.placas
    ? ((initialPlacasBundle.placas as unknown as Placa[]).find((p) => p.id === initialPlacaIdParam) ?? null)
    : null;

  const [loading, setLoading] = useState<boolean>(!hasCompleteInitialData);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedPlaca, setSelectedPlaca] = useState<Placa | null>(initialSelectedPlaca);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>([]);
  const [placasConMapa, setPlacasConMapa] = useState<Set<number>>(
    new Set(initialPlacasBundle?.placasConMapa ?? [])
  );
  const [allSubtemas, setAllSubtemas] = useState<SubtemaNav[]>(
    (initialSiblingSubtemas as unknown as SubtemaNav[]) ?? []
  );

  // Restaurar placa seleccionada cuando el bundle o catálogo asíncrono termine de cargar
  useEffect(() => {
    if (!selectedPlaca && placas.length > 0) {
      const placaParam = getPreservedSearchParam('placa');
      if (placaParam) {
        const id = Number(placaParam);
        const match = placas.find((p) => p.id === id);
        if (match) {
          setSelectedPlaca(match);
        }
      }
    }
  }, [placas, selectedPlaca]);

  // Escuchar si el usuario navega con atrás/adelante del navegador
  useEffect(() => {
    const handlePopState = () => {
      const placaParam = getPreservedSearchParam('placa');
      if (!placaParam) {
        setSelectedPlaca(null);
      } else {
        const id = Number(placaParam);
        const match = placas.find((p) => p.id === id);
        if (match) {
          setSelectedPlaca(match);
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [placas]);

  useEffect(() => {
    if (!numSubtemaId) return;

    let isMounted = true;

    const fetchData = async () => {
      setErrorMessage(null);
      void logSubtemaView(numSubtemaId);

      try {
        const [subtemaRes, maintenanceRes, placasBundleRes, blocksRes] = await Promise.allSettled([
          supabase
            .from('subtemas')
            .select('id, nombre, tema_id, sort_order, temas(nombre, parcial)')
            .eq('id', numSubtemaId)
            .single(),
          fetchSiteMaintenanceStatus(),
          getCachedPlacasForSubtema(numSubtemaId),
          getRenderableBlocks('placas_page', numSubtemaId),
        ]);

        if (!isMounted) return;

        let subtemaData: SubtemaInfo | null = null;
        if (subtemaRes.status === 'fulfilled' && subtemaRes.value.data) {
          subtemaData = subtemaRes.value.data as unknown as SubtemaInfo;
          setSubtema(subtemaData);
        } else {
          const fallback = getQuickSubtemaById(numSubtemaId);
          if (fallback) {
            subtemaData = {
              id: fallback.id,
              nombre: fallback.nombre,
              tema_id: fallback.tema_id,
              sort_order: fallback.sort_order,
            };
            setSubtema(subtemaData);
          }
        }

        if (maintenanceRes.status === 'fulfilled') {
          const maintenanceStatus = maintenanceRes.value;
          const canBypass = canBypassMaintenance(user, isAuthenticated);
          if (!canBypass) {
            if (maintenanceStatus.enabled) {
              setErrorMessage('El sitio se encuentra temporalmente fuera de servicio por mantenimiento.');
              setLoading(false);
              return;
            }
            if (isFeatureDisabled('public_catalog', maintenanceStatus.disabledFeatures)) {
              setErrorMessage('El catálogo de temas y placas se encuentra temporalmente deshabilitado por mantenimiento.');
              setLoading(false);
              return;
            }
            if (subtemaData) {
              const rawTemas = subtemaData.temas as { nombre?: string; parcial?: string } | { nombre?: string; parcial?: string }[] | null;
              const temaParcial = Array.isArray(rawTemas) ? rawTemas[0]?.parcial : rawTemas?.parcial;
              if (isTemaDisabled(subtemaData.tema_id, temaParcial, maintenanceStatus.disabledFeatures)) {
                setErrorMessage('Este tema se encuentra temporalmente fuera de servicio por mantenimiento o actualización.');
                setLoading(false);
                return;
              }
            }
          }
        }

        const targetTemaId = subtemaData?.tema_id;
        if (targetTemaId) {
          try {
            const siblingSubtemas = await getCachedSubtemas(targetTemaId);
            if (isMounted && siblingSubtemas) {
              setAllSubtemas(siblingSubtemas as unknown as SubtemaNav[]);
            }
          } catch {}
        }

        if (placasBundleRes.status === 'fulfilled' && placasBundleRes.value) {
          const bundle = placasBundleRes.value;
          setPlacas(bundle.placas as unknown as Placa[]);
          setPlacasConMapa(new Set(bundle.placasConMapa));
        } else {
          const fallbackBundle = getQuickPlacasForSubtema(numSubtemaId);
          if (fallbackBundle) {
            setPlacas(fallbackBundle.placas as unknown as Placa[]);
            setPlacasConMapa(new Set(fallbackBundle.placasConMapa));
          } else if (!subtemaData) {
            setErrorMessage('No se pudo cargar la información de esta galería. Revisa tu conexión a internet.');
          }
        }

        if (blocksRes.status === 'fulfilled' && Array.isArray(blocksRes.value)) {
          setContentBlocks(blocksRes.value as ContentBlock[]);
        }

        setLoading(false);
      } catch (err) {
        console.error('Error cargando placas del subtema:', err);
        setLoading(false);
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [numSubtemaId, user, isAuthenticated]);

  const handleGoBack = useSmartBackNavigation('/');

  const temaNombre = Array.isArray(subtema?.temas)
    ? (subtema?.temas[0]?.nombre ?? '')
    : (subtema?.temas?.nombre ?? '');

  const currentSubtemaId = Number(subtemaId ?? 0);

  const subtemasTemaActual = useMemo(() => {
    return [...allSubtemas].sort((a, b) => {
      const aSort = typeof a.sort_order === 'number' ? a.sort_order : Number.POSITIVE_INFINITY;
      const bSort = typeof b.sort_order === 'number' ? b.sort_order : Number.POSITIVE_INFINITY;
      if (aSort !== bSort) return aSort - bSort;
      return a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });
    });
  }, [allSubtemas]);

  const currentSubtemaIndex = useMemo(() => {
    return subtemasTemaActual.findIndex((item) => item.id === currentSubtemaId);
  }, [subtemasTemaActual, currentSubtemaId]);

  const subtemaAnterior = currentSubtemaIndex > 0 ? subtemasTemaActual[currentSubtemaIndex - 1] : null;
  const subtemaSiguiente =
    currentSubtemaIndex >= 0 && currentSubtemaIndex < subtemasTemaActual.length - 1
      ? subtemasTemaActual[currentSubtemaIndex + 1]
      : null;

  const navAnterior = useMemo(() => {
    if (subtemaAnterior) {
      return {
        targetId: subtemaAnterior.id,
        label: `← Subtema anterior: ${subtemaAnterior.nombre}`,
        onClick: () => navigate(`/ver-placas/${subtemaAnterior.id}`),
      };
    }

    return null;
  }, [subtemaAnterior, navigate]);

  const navSiguiente = useMemo(() => {
    if (subtemaSiguiente) {
      return {
        targetId: subtemaSiguiente.id,
        label: `Siguiente subtema: ${subtemaSiguiente.nombre} →`,
        onClick: () => navigate(`/ver-placas/${subtemaSiguiente.id}`),
      };
    }

    return null;
  }, [subtemaSiguiente, navigate]);

  // Precarga automática en segundo plano de subtemas adyacentes para que al dar clic el cambio sea a 0 ms
  useEffect(() => {
    if (subtemaAnterior) {
      prefetchSubtemaPlacas(subtemaAnterior.id);
    }
    if (subtemaSiguiente) {
      prefetchSubtemaPlacas(subtemaSiguiente.id);
    }
  }, [subtemaAnterior?.id, subtemaSiguiente?.id]);

  const interactivePlacas = useMemo(() => {
    return placas.filter((placa) => placasConMapa.has(placa.id));
  }, [placas, placasConMapa]);

  const nonInteractivePlacas = useMemo(() => {
    return placas.filter((placa) => !placasConMapa.has(placa.id));
  }, [placas, placasConMapa]);

  const placasByAumento = useMemo<PlacaGroupByAumento[]>(() => {
    const groups = new Map<string, PlacaGroupByAumento>();

    nonInteractivePlacas.forEach((placa) => {
      const aumentoRaw = (placa.aumento ?? '').trim();
      const hasAumento = aumentoRaw.length > 0;
      const aumentoLabel = hasAumento ? normalizeAumentoLabel(aumentoRaw) : 'SIN_AUMENTO';
      const key = hasAumento ? `AUMENTO_${aumentoLabel}` : 'AUMENTO_SIN_AUMENTO';
      const title = hasAumento ? `Aumento ${aumentoLabel}` : 'Sin aumento';
      const sortValue = hasAumento ? parseAumentoSortValue(aumentoRaw) : Number.POSITIVE_INFINITY;

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          title,
          sortValue,
          items: [],
        });
      }

      const target = groups.get(key);
      if (target) {
        target.items.push(placa);
      }
    });

    return Array.from(groups.values()).sort((a, b) => {
      if (a.sortValue !== b.sortValue) return a.sortValue - b.sortValue;
      return a.title.localeCompare(b.title, 'es', { sensitivity: 'base' });
    });
  }, [nonInteractivePlacas]);

  const [activeAumentoFilter, setActiveAumentoFilter] = useState<string>('ALL');

  const availableFilters = useMemo(() => {
    const list: Array<{ key: string; label: string; count: number; color?: string }> = [
      { key: 'ALL', label: 'Todas las placas', count: placas.length, color: '#4f46e5' },
    ];
    if (interactivePlacas.length > 0) {
      list.push({
        key: 'INTERACTIVE',
        label: '⚡ Interactivas',
        count: interactivePlacas.length,
        color: '#10b981',
      });
    }
    placasByAumento.forEach((group) => {
      const meta = getAumentoMeta(group.title.replace('Aumento ', ''));
      list.push({
        key: group.key,
        label: group.title,
        count: group.items.length,
        color: meta.color,
      });
    });
    return list;
  }, [placas.length, interactivePlacas.length, placasByAumento]);

  const visibleInteractivePlacas = useMemo(() => {
    if (activeAumentoFilter === 'INTERACTIVE' || activeAumentoFilter === 'ALL') {
      return interactivePlacas;
    }
    return [];
  }, [activeAumentoFilter, interactivePlacas]);

  const visibleGroups = useMemo(() => {
    if (activeAumentoFilter === 'ALL') {
      return placasByAumento;
    }
    if (activeAumentoFilter === 'INTERACTIVE') {
      return [];
    }
    return placasByAumento.filter((g) => g.key === activeAumentoFilter);
  }, [activeAumentoFilter, placasByAumento]);

  const handlePlacaOpen = (placa: Placa) => {
    syncUrlSearchParam('placa', placa.id);
    void logPlacaView(placa.id, Number(subtemaId));
    setSelectedPlaca(placa);
  };

  const selectedPlacaIndex = selectedPlaca
    ? placas.findIndex((placa) => placa.id === selectedPlaca.id)
    : -1;

  const navigateToPlate = (index: number) => {
    const targetPlate = placas[index];
    if (!targetPlate) return;
    syncUrlSearchParam('placa', targetPlate.id);
    void logPlacaView(targetPlate.id, Number(subtemaId));
    setSelectedPlaca(targetPlate);
  };

  const renderPlacaCard = (placa: Placa, keySuffix: string) => {
    const hasInteractiveMap = placasConMapa.has(placa.id);
    const isHovered = hoveredId === placa.id;
    const meta = getAumentoMeta(placa.aumento);

    return (
      <button
        type="button"
        key={`${placa.id}-${keySuffix}`}
        className="placa-thumb-wrap placa-gallery-card"
        style={{
          ...styles.thumbWrap,
          transform: isHovered ? 'translateY(-4px)' : 'none',
          boxShadow: isHovered
            ? '0 18px 32px -4px rgba(14, 165, 233, 0.26), 0 4px 12px -2px rgba(0, 0, 0, 0.06)'
            : '0 4px 14px rgba(15, 23, 42, 0.06)',
          borderColor: isHovered ? '#38bdf8' : '#e2e8f0',
        }}
        onClick={() => handlePlacaOpen(placa)}
        onMouseEnter={() => setHoveredId(placa.id)}
        onMouseLeave={() => setHoveredId(null)}
        title="Ver en grande"
        aria-label={`Abrir placa${placa.aumento ? ` con aumento ${placa.aumento}` : ''}`}
      >
        <div style={styles.thumbSquare}>
          <ResilientPlacaThumb
            photoUrl={placa.photo_url}
            alt="Placa histológica"
            style={{
              ...styles.thumbImg,
              transform: isHovered ? 'scale(1.05)' : 'scale(1)',
              transition: 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            profile="thumb"
            subtemaLogo={subtema?.logo_url}
          />
          {(placa.aumento || hasInteractiveMap) && (
            <div style={styles.thumbBadgesRow}>
              {placa.aumento && (
                <div
                  style={{
                    height: '26px',
                    boxSizing: 'border-box',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '0 8px 0 4px',
                    borderRadius: '999px',
                    background: 'rgba(255, 255, 255, 0.94)',
                    backdropFilter: 'blur(10px) saturate(160%)',
                    WebkitBackdropFilter: 'blur(10px) saturate(160%)',
                    border: `1.2px solid ${meta.color}55`,
                    boxShadow: '0 3px 10px rgba(15, 23, 42, 0.12), inset 0 1px 0 #ffffff',
                  }}
                  title={`Aumento ${placa.aumento}`}
                  aria-label={`Aumento ${placa.aumento}`}
                >
                  <span
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      background: meta.bg,
                      border: `1px solid ${meta.color}60`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: meta.color,
                      flexShrink: 0,
                      boxShadow: `0 0 6px ${meta.color}35`,
                    }}
                  >
                    <Microscope size={11} strokeWidth={2.6} />
                  </span>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      height: '100%',
                      lineHeight: 1,
                      fontSize: '0.70rem',
                      fontWeight: 850,
                      color: '#0f172a',
                      letterSpacing: '0.02em',
                      transform: 'translateY(-0.5px)',
                    }}
                  >
                    {placa.aumento.toUpperCase()}
                  </span>
                </div>
              )}
              {hasInteractiveMap && (
                <div
                  style={{
                    height: '26px',
                    boxSizing: 'border-box',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '0 8px 0 4px',
                    borderRadius: '999px',
                    background: 'rgba(255, 255, 255, 0.94)',
                    backdropFilter: 'blur(10px) saturate(160%)',
                    WebkitBackdropFilter: 'blur(10px) saturate(160%)',
                    border: '1.2px solid rgba(16, 185, 129, 0.50)',
                    boxShadow: '0 3px 10px rgba(16, 185, 129, 0.18), inset 0 1px 0 #ffffff',
                    marginLeft: !placa.aumento ? 'auto' : undefined,
                  }}
                  title="Mapa interactivo con estructuras anatómicas señaladas"
                  aria-label="Mapa interactivo disponible"
                >
                  <span
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      background: 'rgba(16, 185, 129, 0.12)',
                      border: '1px solid rgba(16, 185, 129, 0.55)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#059669',
                      flexShrink: 0,
                      boxShadow: '0 0 6px rgba(16, 185, 129, 0.35)',
                    }}
                  >
                    <MousePointerClick size={11} strokeWidth={2.6} />
                  </span>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      height: '100%',
                      lineHeight: 1,
                      fontSize: '0.67rem',
                      fontWeight: 850,
                      color: '#065f46',
                      letterSpacing: '0.01em',
                      transform: 'translateY(-0.5px)',
                    }}
                  >
                    Interactivo
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Badge inferior de Tinción */}
          {placa.tincion && placa.tincion.trim() !== '' && (
            <div
              style={{
                position: 'absolute',
                bottom: '8px',
                left: '8px',
                height: '24px',
                boxSizing: 'border-box',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '0 8px 0 5px',
                borderRadius: '999px',
                background: 'rgba(255, 255, 255, 0.94)',
                backdropFilter: 'blur(10px) saturate(160%)',
                WebkitBackdropFilter: 'blur(10px) saturate(160%)',
                border: '1.2px solid rgba(168, 85, 247, 0.38)',
                boxShadow: '0 3px 10px rgba(15, 23, 42, 0.10), inset 0 1px 0 #ffffff',
                zIndex: 2,
                pointerEvents: 'none',
              }}
            >
              <span
                style={{
                  width: '9px',
                  height: '9px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
                  boxShadow: '0 0 5px rgba(236, 72, 153, 0.45)',
                  display: 'inline-block',
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  height: '100%',
                  lineHeight: 1,
                  fontSize: '0.67rem',
                  fontWeight: 850,
                  color: '#334155',
                  letterSpacing: '0.03em',
                  transform: 'translateY(-0.5px)',
                }}
              >
                {placa.tincion.toUpperCase()}
              </span>
            </div>
          )}

          {/* Overlay de examen al hover con retículo óptico */}
          <div style={{
            ...styles.thumbOverlay,
            opacity: isHovered ? 1 : 0,
          }}>
            {/* Esquinas ópticas de microscopio al hover */}
            <div style={{ position: 'absolute', top: '7px', left: '7px', width: '10px', height: '10px', borderTop: '2px solid rgba(255,255,255,0.85)', borderLeft: '2px solid rgba(255,255,255,0.85)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', top: '7px', right: '7px', width: '10px', height: '10px', borderTop: '2px solid rgba(255,255,255,0.85)', borderRight: '2px solid rgba(255,255,255,0.85)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: '7px', left: '7px', width: '10px', height: '10px', borderBottom: '2px solid rgba(255,255,255,0.85)', borderLeft: '2px solid rgba(255,255,255,0.85)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: '7px', right: '7px', width: '10px', height: '10px', borderBottom: '2px solid rgba(255,255,255,0.85)', borderRight: '2px solid rgba(255,255,255,0.85)', pointerEvents: 'none' }} />

            <span style={styles.thumbOverlayContent}><Eye size={15} strokeWidth={2.4} /><span>Examinar</span></span>
          </div>
        </div>
      </button>
    );
  };

  return (
    <div style={styles.page}>
      <Header />

      <main style={styles.main}>
        <BackButton onClick={handleGoBack} />

        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <div style={styles.galleryIcon}><Images size={25} /></div>
            <div style={styles.sectionTitleWrap}>
              {temaNombre && <span style={styles.breadcrumb}>{temaNombre} · Galería histológica</span>}
              <h1 style={styles.title}>
                {loading ? 'Cargando...' : subtema?.nombre ?? 'Placas'}
              </h1>
              {!loading && placas.length > 0 && (
                <span style={styles.countBadge}>
                  {placas.length} {placas.length === 1 ? 'placa' : 'placas'}
                </span>
              )}
            </div>
          </div>

          {/* Bloques de contenido editorial */}
          {!loading && contentBlocks.length > 0 && (
            <div className="public-editor-content public-editor-content-before-system">
              <ContentBlockRenderer blocks={contentBlocks} />
            </div>
          )}

          {loading ? (
            <div style={styles.spinnerWrap}>
              <div style={styles.spinner} />
            </div>
          ) : errorMessage ? (
            <div style={{ padding: '36px 20px', textAlign: 'center', background: '#fff5f5', borderRadius: '16px', border: '1px solid #fecaca', margin: '20px 0' }}>
              <p style={{ margin: '0 0 16px', color: '#991b1b', fontSize: '1rem', fontWeight: 600 }}>{errorMessage}</p>
              <button
                type="button"
                onClick={() => navigate('/temario')}
                style={{ padding: '9px 18px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}
              >
                Volver al temario
              </button>
            </div>
          ) : placas.length > 0 ? (
            <div style={styles.gridSectionsWrap}>
              {/* Barra de Filtro Rápido de Objetivos */}
              {availableFilters.length > 2 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    overflowX: 'auto',
                    padding: '6px 2px 8px 2px',
                    scrollbarWidth: 'none',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      color: '#475569',
                      fontSize: '0.80rem',
                      fontWeight: 800,
                      marginRight: '2px',
                      flexShrink: 0,
                    }}
                  >
                    <Microscope size={17} color="#6366f1" />
                    <span>Objetivo:</span>
                  </div>

                  {availableFilters.map((filter) => {
                    const isActive = activeAumentoFilter === filter.key;
                    return (
                      <button
                        key={filter.key}
                        type="button"
                        onClick={() => setActiveAumentoFilter(filter.key)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '7px',
                          padding: '6px 14px',
                          borderRadius: '999px',
                          border: isActive
                            ? `1.5px solid ${filter.color || '#4f46e5'}`
                            : '1.5px solid #e2e8f0',
                          background: isActive
                            ? 'linear-gradient(135deg, #ffffff 0%, #f8faff 100%)'
                            : '#ffffff',
                          color: isActive ? (filter.color || '#1e1b4b') : '#475569',
                          fontSize: '0.80rem',
                          fontWeight: isActive ? 850 : 650,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          boxShadow: isActive
                            ? `0 4px 14px ${filter.color || '#4f46e5'}25`
                            : '0 1px 3px rgba(0,0,0,0.03)',
                          transition: 'all 0.2s ease',
                          flexShrink: 0,
                        }}
                      >
                        {filter.color && (
                          <span
                            style={{
                              width: '7px',
                              height: '7px',
                              borderRadius: '50%',
                              background: filter.color,
                              boxShadow: isActive ? `0 0 8px ${filter.color}` : 'none',
                            }}
                          />
                        )}
                        <span>{filter.label}</span>
                        <span
                          style={{
                            fontSize: '0.70rem',
                            padding: '1px 6px',
                            borderRadius: '999px',
                            background: isActive ? `${filter.color}18` : '#f1f5f9',
                            color: isActive ? filter.color : '#64748b',
                            fontWeight: 800,
                          }}
                        >
                          {filter.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Placas Interactivas */}
              {visibleInteractivePlacas.length > 0 && (
                <section
                  style={{
                    ...styles.gridSection,
                    border: '1.5px solid #a7f3d0',
                    background: 'linear-gradient(180deg, #ffffff 0%, #f0fdf4 100%)',
                    boxShadow: '0 10px 28px -4px rgba(16, 185, 129, 0.08)',
                  }}
                >
                  <div style={styles.gridSectionHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '34px',
                          height: '34px',
                          borderRadius: '10px',
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#ffffff',
                          boxShadow: '0 4px 10px rgba(16, 185, 129, 0.35)',
                          flexShrink: 0,
                        }}
                      >
                        <MousePointerClick size={18} strokeWidth={2.4} />
                      </div>
                      <div>
                        <h2 style={{ ...styles.gridSectionTitle, color: '#065f46' }}>
                          Placas con Marcadores Interactivos
                        </h2>
                      </div>
                    </div>
                    <span
                      style={{
                        ...styles.gridSectionCount,
                        color: '#047857',
                        background: '#ecfdf5',
                        border: '1px solid #a7f3d0',
                      }}
                    >
                      {visibleInteractivePlacas.length} {visibleInteractivePlacas.length === 1 ? 'placa' : 'placas'}
                    </span>
                  </div>
                  <div className="placas-gallery-grid placas-gallery-grid--subtema">
                    {visibleInteractivePlacas.map((placa, index) => renderPlacaCard(placa, `interactive-${index}`))}
                  </div>
                </section>
              )}

              {/* Grupos de Aumento */}
              {visibleGroups.map((group) => {
                const meta = getAumentoMeta(group.title.replace('Aumento ', ''));
                return (
                  <section key={group.key} style={styles.gridSection}>
                    <div style={styles.gridSectionHeader}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '34px',
                            height: '34px',
                            borderRadius: '10px',
                            background: meta.bg,
                            border: `1.5px solid ${meta.border}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: meta.color,
                            boxShadow: `0 2px 8px ${meta.color}25`,
                            flexShrink: 0,
                          }}
                        >
                          <Microscope size={18} strokeWidth={2.3} />
                        </div>
                        <div>
                          <h2 style={{ ...styles.gridSectionTitle, color: '#0f172a' }}>
                            {meta.name}
                          </h2>
                        </div>
                      </div>
                      <span style={styles.gridSectionCount}>
                        {group.items.length} {group.items.length === 1 ? 'placa' : 'placas'}
                      </span>
                    </div>
                    <div className="placas-gallery-grid placas-gallery-grid--subtema">
                      {group.items.map((placa, index) => renderPlacaCard(placa, `${group.key}-${index}`))}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : null}

          {!loading && (navAnterior || navSiguiente) && (
            <section aria-label="Navegación entre subtemas" style={styles.navigationPanel}>
              <div style={styles.navigationButtonGrid}>
                {navAnterior && (
                  <button
                    type="button"
                    style={{ ...styles.navigationButton, ...styles.navigationButtonPrevious }}
                    onMouseEnter={() => prefetchSubtemaPlacas(navAnterior.targetId)}
                    onTouchStart={() => prefetchSubtemaPlacas(navAnterior.targetId)}
                    onClick={() => {
                      navAnterior.onClick();
                    }}
                  >
                    <span style={styles.navigationIconShell} aria-hidden="true">
                      <ArrowLeft size={19} strokeWidth={2.4} />
                    </span>
                    <span style={styles.navigationCopy}>
                      <span style={styles.navigationEyebrow}>Subtema anterior</span>
                      <span style={styles.navigationTitle}>{navAnterior.label.replace('← Subtema anterior: ', '')}</span>
                    </span>
                  </button>
                )}

                {navSiguiente && (
                  <button
                    type="button"
                    style={{ ...styles.navigationButton, ...styles.navigationButtonNext }}
                    onMouseEnter={() => prefetchSubtemaPlacas(navSiguiente.targetId)}
                    onTouchStart={() => prefetchSubtemaPlacas(navSiguiente.targetId)}
                    onClick={() => {
                      navSiguiente.onClick();
                    }}
                  >
                    <span style={styles.navigationCopy}>
                      <span style={styles.navigationEyebrow}>Siguiente subtema</span>
                      <span style={styles.navigationTitle}>{navSiguiente.label.replace('Siguiente subtema: ', '').replace(' →', '')}</span>
                    </span>
                    <span style={styles.navigationIconShell} aria-hidden="true">
                      <ArrowRight size={19} strokeWidth={2.4} />
                    </span>
                  </button>
                )}
              </div>
            </section>
          )}

          {user?.rol === 'Administrador' && subtemaId && (
            <div style={{ marginTop: '28px', display: 'flex', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => navigate(`/historial?scope=subtema&subtemaId=${subtemaId}&subtemaNombre=${encodeURIComponent(subtema?.nombre || '')}`)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  background: 'linear-gradient(135deg, #4f46e5, #3730a3)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '0.88em',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(79, 70, 229, 0.25)',
                }}
                title="Ver historial de cambios en el contenido de la página y configuración de este subtema"
              >
                <Shield size={16} />
                <span>Ver Historial y Contenido de este Subtema</span>
              </button>
            </div>
          )}
        </section>
      </main>

      <Footer />

      {selectedPlaca && (
        <ImageViewerModal
          src={getCloudinaryImageUrl(selectedPlaca.photo_url, 'view')}
          srcZoom={getCloudinaryImageUrl(selectedPlaca.photo_url, 'zoom')}
          onClose={() => {
            syncUrlSearchParam('placa', null);
            setSelectedPlaca(null);
          }}
          placaId={selectedPlaca.id}
          hasInteractiveMapHint={placasConMapa.has(selectedPlaca.id)}
          temaNombre={temaNombre}
          subtemaNombre={subtema?.nombre}
          temaId={subtema?.tema_id}
          subtemaId={subtema?.id ?? numSubtemaId}
          aumento={selectedPlaca.aumento}
          senalados={selectedPlaca.senalados}
          senaladosMeta={selectedPlaca.senalados_meta}
          comentario={selectedPlaca.comentario}
          tincion={selectedPlaca.tincion}
          platePosition={selectedPlacaIndex + 1}
          plateCount={placas.length}
          onPreviousPlate={selectedPlacaIndex > 0 ? () => navigateToPlate(selectedPlacaIndex - 1) : undefined}
          onNextPlate={selectedPlacaIndex >= 0 && selectedPlacaIndex < placas.length - 1 ? () => navigateToPlate(selectedPlacaIndex + 1) : undefined}
          onPlateUpdated={(updated) => {
            setSelectedPlaca(prev => {
              if (!prev) return null;
              return {
                ...prev,
                ...(updated.photoUrl ? { photo_url: updated.photoUrl } : {}),
                ...(updated.aumento !== undefined ? { aumento: updated.aumento } : {}),
                ...(updated.tincion !== undefined ? { tincion: updated.tincion } : {}),
                ...(updated.comentario !== undefined ? { comentario: updated.comentario } : {}),
                ...(updated.senalados !== undefined ? { senalados: updated.senalados } : {}),
                ...(updated.senaladosMeta !== undefined ? { senalados_meta: updated.senaladosMeta } : {}),
              };
            });
            setPlacas(prevPlacas => {
              return prevPlacas.map(p => {
                if (p.id !== selectedPlaca.id) return p;
                return {
                  ...p,
                  ...(updated.photoUrl ? { photo_url: updated.photoUrl } : {}),
                  ...(updated.aumento !== undefined ? { aumento: updated.aumento } : {}),
                  ...(updated.tincion !== undefined ? { tincion: updated.tincion } : {}),
                  ...(updated.comentario !== undefined ? { comentario: updated.comentario } : {}),
                  ...(updated.senalados !== undefined ? { senalados: updated.senalados } : {}),
                  ...(updated.senaladosMeta !== undefined ? { senalados_meta: updated.senaladosMeta } : {}),
                };
              });
            });
          }}
        />
      )}
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  page: {
    minHeight: '100vh',
    display: 'flex', flexDirection: 'column',
    fontFamily: '"Montserrat", "Segoe UI", sans-serif',
    color: '#0f172a',
    background: 'radial-gradient(circle at 8% 10%, rgba(186,230,253,.4), transparent 27%), linear-gradient(180deg, #f8fcff 0%, #eef6fc 55%, #f8fbfe 100%)',
  },
  main: {
    flex: 1,
    width: '100%',
    maxWidth: '1280px',
    margin: '0 auto',
    boxSizing: 'border-box',
    display: 'flex', flexDirection: 'column',
    padding: 'clamp(18px, 3vw, 34px) 14px 48px',
    gap: '16px',
  },
  backButton: {
    alignSelf: 'flex-start',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '16px',
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    color: '#4b5563',
    borderRadius: '999px',
    padding: '8px 16px',
    fontSize: '0.9em',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    fontFamily: 'inherit',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
  },
  section: {
    background: 'rgba(255,255,255,.74)',
    padding: 'clamp(18px, 3vw, 30px)',
    boxShadow: '0 18px 46px rgba(23,65,101,.08)',
    border: '1px solid rgba(195,216,232,.88)',
    borderRadius: '26px',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '28px',
    paddingBottom: '16px',
    borderBottom: '1px solid #dce7ef',
  },
  galleryIcon: {
    width: '50px', height: '50px', borderRadius: '16px', display: 'grid', placeItems: 'center', flexShrink: 0,
    color: '#fff', background: 'linear-gradient(145deg, #2386bb, #225d8f)', boxShadow: '0 10px 22px rgba(34,93,143,.22)',
  },
  accentBar: {
    width: '5px',
    height: '44px',
    borderRadius: '4px',
    background: 'linear-gradient(180deg, #38bdf8, #818cf8)',
    flexShrink: 0,
  },
  sectionTitleWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  breadcrumb: { width: '100%', color: '#64829b', fontSize: '.72rem', fontWeight: 850, letterSpacing: '.07em', textTransform: 'uppercase' },
  title: {
    margin: 0,
    fontSize: 'clamp(1.3em, 3vw, 2em)',
    fontWeight: 800,
    color: '#123b66',
    letterSpacing: '-0.02em',
  },
  countBadge: {
    background: 'linear-gradient(135deg, #bfdbfe, #e0e7ff)',
    color: '#1e40af',
    borderRadius: '99px',
    padding: '4px 14px',
    fontSize: '0.82em',
    fontWeight: 700,
    border: '1px solid #93c5fd',
  },
  spinnerWrap: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '200px',
  },
  spinner: {
    width: '48px',
    height: '48px',
    border: '5px solid #e0f2fe',
    borderTop: '5px solid #38bdf8',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  gridSectionsWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  gridSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    padding: 'clamp(14px, 2.5vw, 22px)',
    borderRadius: '22px',
    border: '1.5px solid rgba(226, 232, 240, 0.95)',
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
    boxShadow: '0 10px 30px -4px rgba(15, 23, 42, 0.04), 0 2px 6px -1px rgba(0, 0, 0, 0.02)',
  },
  gridSectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    paddingBottom: '12px',
    borderBottom: '1.5px solid #f1f5f9',
    flexWrap: 'wrap',
  },
  gridSectionTitle: {
    margin: 0,
    color: '#0f172a',
    fontSize: '1.02em',
    fontWeight: 800,
    letterSpacing: '-0.015em',
    textTransform: 'none',
  },
  gridSectionCount: {
    color: '#475569',
    fontSize: '0.78em',
    fontWeight: 750,
    border: '1px solid #e2e8f0',
    borderRadius: '999px',
    padding: '3px 12px',
    background: '#ffffff',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
  },
  thumbWrap: {
    position: 'relative',
    display: 'block',
    borderRadius: '16px',
    overflow: 'hidden',
    cursor: 'pointer',
    background: '#f8fafc',
    border: '1.5px solid #e2e8f0',
    boxShadow: '0 4px 14px rgba(15, 23, 42, 0.06)',
    outline: 'none',
    padding: 0,
    transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease, border-color 0.25s ease',
  },
  thumbSquare: {
    position: 'relative',
    width: '100%',
    aspectRatio: '1 / 1',
    overflow: 'hidden',
  },
  thumbImg: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: 'center center',
    display: 'block',
  },
  thumbOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.2) 0%, rgba(15, 23, 42, 0.65) 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'opacity 0.22s ease',
    backdropFilter: 'blur(2px)',
  },
  thumbOverlayContent: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '7px 12px',
    borderRadius: '999px',
    background: 'rgba(255, 255, 255, 0.95)',
    color: '#0f172a',
    fontSize: '.74rem',
    fontWeight: 850,
    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)',
  },
  thumbBadgesRow: {
    position: 'absolute',
    top: '8px',
    left: '8px',
    right: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '6px',
    zIndex: 2,
    pointerEvents: 'none',
  },
  aumentoBadge: {
    height: '28px',
    borderRadius: '8px',
    color: '#0f172a',
    background: 'rgba(255, 255, 255, 0.94)',
    border: '1.2px solid rgba(226, 232, 240, 0.95)',
    fontWeight: 850,
    fontSize: '0.70em',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 8px',
    boxShadow: '0 3px 10px rgba(15, 23, 42, 0.12), inset 0 1px 0 #ffffff',
    letterSpacing: '0.03em',
    flexShrink: 0,
    backdropFilter: 'blur(8px)',
  },
  aumentoBadgeText: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    lineHeight: 1,
  },
  interactiveMapBadge: {
    height: '28px',
    color: '#065f46',
    background: 'rgba(255, 255, 255, 0.94)',
    border: '1.2px solid #34d399',
    borderRadius: '8px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '0 8px',
    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)',
    backdropFilter: 'blur(6px)',
    flexShrink: 0,
  },
  navigationPanel: {
    marginTop: '18px',
    padding: '18px',
    border: '1px solid rgba(125, 211, 252, 0.34)',
    borderRadius: '18px',
    background: 'linear-gradient(135deg, rgba(239, 248, 255, 0.94), rgba(255, 255, 255, 0.96))',
    boxShadow: '0 12px 32px rgba(30, 64, 175, 0.09), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  navigationButtonGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '12px',
  },
  navigationButton: {
    minHeight: '62px',
    border: '1px solid #a9d9ed',
    background: 'linear-gradient(135deg, #eaf7fc 0%, #d9f0fa 100%)',
    color: '#0f3b5c',
    borderRadius: '14px',
    padding: '8px 12px',
    fontFamily: 'inherit',
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    boxShadow: '0 6px 15px rgba(23, 106, 157, 0.12)',
  },
  navigationButtonPrevious: {
    justifyContent: 'flex-start',
  },
  navigationButtonNext: {
    justifyContent: 'flex-end',
    textAlign: 'right',
  },
  navigationIconShell: {
    width: '38px',
    height: '38px',
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '12px',
    color: '#ffffff',
    background: 'linear-gradient(135deg, #176a9d, #2386bb)',
    boxShadow: '0 6px 13px rgba(23, 106, 157, 0.25)',
  },
  navigationCopy: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
  },
  navigationEyebrow: {
    color: '#2386bb',
    fontSize: '0.67rem',
    fontWeight: 900,
    letterSpacing: '0.09em',
    textTransform: 'uppercase',
  },
  navigationTitle: {
    color: '#0f3b5c',
    fontSize: '0.9rem',
    fontWeight: 800,
    lineHeight: 1.25,
  },
};

const PlacasSubtema: React.FC = () => {
  const { subtemaId } = useParams<{ subtemaId: string }>();
  return <PlacasSubtemaContent key={subtemaId} />;
};

export default PlacasSubtema;




