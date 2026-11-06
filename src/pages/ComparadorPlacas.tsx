import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Eye,
  EyeOff,
  Link2,
  Link2Off,
  Maximize2,
  Minimize2,
  RotateCcw,
  Repeat2,
} from 'lucide-react';
import DualPlateViewport from '../components/comparador/DualPlateViewport';
import PlatePickerModal, { type ComparadorPlacaItem } from '../components/comparador/PlatePickerModal';
import { useSmartBackNavigation } from '../hooks/useSmartBackNavigation';
import { acquireAtlasScrollLock, releaseAtlasScrollLock } from '../constants/scrollLock';
import { supabase } from '../services/supabase';
import { getPreservedSearchParam, syncUrlSearchParam } from '../services/navigationStateKeeper';
import laboratoryLogo from '../assets/logos/laboratorio.png';
import '../styles/comparador.css';

const LETTERS = ['A', 'B', 'C', 'D'] as const;
type PlateCount = 2 | 3 | 4;
type MultiLayout = 'columns' | 'featured' | 'grid';
type Layout = MultiLayout | 'horizontal' | 'vertical';
interface PlateSlot {
  plate: ComparadorPlacaItem | null;
  zoom: number;
  pan: { x: number; y: number };
  showSignalings: boolean;
}
const createSlot = (): PlateSlot => ({ plate: null, zoom: 1, pan: { x: 0, y: 0 }, showSignalings: false });

const ComparadorPlacas: React.FC = () => {
  const goBack = useSmartBackNavigation('/herramientas');
  const [initialParams] = useState(() => ({
    ids: LETTERS.map(letter => Number(getPreservedSearchParam(`placa${letter}`)) || null),
    count: getPreservedSearchParam('modo'),
    layout: getPreservedSearchParam('distribucion'),
  }));
  const [plateCount, setPlateCount] = useState<PlateCount>(() =>
    initialParams.count === '2' ? 2 : initialParams.count === '3' ? 3 : initialParams.count === '4' ? 4 :
      initialParams.ids[3] ? 4 : initialParams.ids[2] ? 3 : 2);
  const [slots, setSlots] = useState<PlateSlot[]>(() => LETTERS.map(createSlot));
  const [restored, setRestored] = useState(false);
  const [isSynced, setIsSynced] = useState(false);
  const [layoutOrientation, setLayoutOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
  const [multiLayouts, setMultiLayouts] = useState<Record<3 | 4, MultiLayout>>(() => ({
    3: initialParams.layout === 'featured' ? 'featured' : 'columns',
    4: initialParams.layout === 'columns' || initialParams.layout === 'featured' ? initialParams.layout : 'grid',
  }));
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);
  const [isOsFullscreen, setIsOsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const layoutControlRef = useRef<HTMLDivElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState(0);
  const activeSlots = slots.slice(0, plateCount);
  const plateIds = slots.map(slot => slot.plate?.id ?? '').join(',');
  const activeLayout = plateCount === 2 ? layoutOrientation : multiLayouts[plateCount];

  useEffect(() => {
    acquireAtlasScrollLock();
    return () => releaseAtlasScrollLock();
  }, []);

  // Mantener la restauración de enlaces antiguos A/B y ampliar a C/D.
  useEffect(() => {
    let cancelled = false;
    const idsToFetch = initialParams.ids.filter((id): id is number => id !== null && Number.isFinite(id) && id > 0);
    if (!idsToFetch.length) {
      setRestored(true);
      return;
    }
    void (async () => {
      try {
        const { data, error } = await supabase
          .from('placas')
          .select('id, photo_url, aumento, tincion, comentario, senalados, senalados_meta, subtema_id, subtemas(id, nombre, tema_id, temas(id, nombre, parcial))')
          .in('id', idsToFetch);
        if (!cancelled && !error && data) {
          const items = data.map((row: any): ComparadorPlacaItem => {
            const subtema = Array.isArray(row.subtemas) ? row.subtemas[0] : row.subtemas;
            const tema = subtema ? (Array.isArray(subtema.temas) ? subtema.temas[0] : subtema.temas) : null;
            return {
              id: row.id,
              photo_url: row.photo_url,
              aumento: row.aumento,
              tincion: row.tincion,
              comentario: row.comentario,
              senalados: row.senalados,
              senalados_meta: row.senalados_meta,
              subtema_id: subtema?.id ?? row.subtema_id,
              subtema_nombre: subtema?.nombre ?? '',
              tema_id: tema?.id ?? 0,
              tema_nombre: tema?.nombre ?? '',
              parcial_key: tema?.parcial ?? '',
            };
          });
          setSlots(prev => prev.map((slot, index) => ({
            ...slot, plate: slot.plate ?? items.find(item => item.id === initialParams.ids[index]) ?? null,
          })));
        }
      } catch (err) {
        console.warn('Error al restaurar placas comparadas:', err);
      } finally {
        if (!cancelled) setRestored(true);
      }
    })();
    return () => { cancelled = true; };
  }, [initialParams]);

  useEffect(() => {
    if (!restored) return;
    const ids = plateIds.split(',');
    LETTERS.forEach((letter, index) => syncUrlSearchParam(`placa${letter}`, ids[index] || null));
    syncUrlSearchParam('modo', plateCount);
    syncUrlSearchParam('distribucion', plateCount === 2 ? null : multiLayouts[plateCount]);
  }, [plateIds, plateCount, multiLayouts, restored]);

  useEffect(() => {
    if (!layoutMenuOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (!layoutControlRef.current?.contains(event.target as Node)) setLayoutMenuOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [layoutMenuOpen]);

  const handleOpenPicker = (target: number) => {
    setPickerTarget(target);
    setPickerOpen(true);
  };
  const handleSelectPlate = (plate: ComparadorPlacaItem) => {
    setSlots(prev => prev.map((slot, index) => index === pickerTarget ? { ...createSlot(), plate } : slot));
  };
  const handleSwapPlates = useCallback(() => {
    setSlots(prev => [...prev.slice(1, plateCount), prev[0], ...prev.slice(plateCount)]);
  }, [plateCount]);
  const handleResetViews = useCallback(() => {
    setSlots(prev => prev.map((slot, index) => index < plateCount ? { ...slot, zoom: 1, pan: { x: 0, y: 0 } } : slot));
  }, [plateCount]);
  const areAllSignalingsOn = activeSlots.every(slot => slot.showSignalings);
  const handleToggleAllSignalings = () => {
    setSlots(prev => prev.map((slot, index) => index < plateCount ? { ...slot, showSignalings: !areAllSignalingsOn } : slot));
  };
  const handlePanZoomChange = (target: number, zoom: number, pan: { x: number; y: number }) => {
    setSlots(prev => prev.map((slot, index) => index === target || (isSynced && index < plateCount)
      ? { ...slot, zoom, pan } : slot));
  };

  // Toggle OS Fullscreen
  const handleToggleOsFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().then(() => setIsOsFullscreen(true)).catch(() => undefined);
    } else {
      document.exitFullscreen?.().then(() => setIsOsFullscreen(false)).catch(() => undefined);
    }
  };

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsOsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, []);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key === 'Escape') {
        if (layoutMenuOpen) {
          setLayoutMenuOpen(false);
        } else if (pickerOpen) {
          setPickerOpen(false);
        } else if (!document.fullscreenElement) {
          goBack();
        }
      } else if (e.key === 's' || e.key === 'S') {
        setIsSynced(prev => !prev);
      } else if (e.key === 'x' || e.key === 'X') {
        handleSwapPlates();
      } else if (e.key === 'r' || e.key === 'R') {
        handleResetViews();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [goBack, pickerOpen, layoutMenuOpen, handleSwapPlates, handleResetViews]);

  return (
    <div ref={containerRef} className="comparador-fullscreen-app">
      {/* Top accent line */}
      <div className="comparador-top-accent-line" aria-hidden="true" />

      {/* Top App Control Bar */}
      <header className="comparador-appbar" aria-label="Barra superior del comparador">
        <div className="comparador-appbar-left">
          <button
            type="button"
            className="comparador-appbar-close-btn"
            onClick={goBack}
            title="Volver a Herramientas (Esc)"
          >
            <span className="comparador-appbar-close-badge" aria-hidden="true">✕</span>
            <span>Salir</span>
          </button>

          <div className="comparador-appbar-divider" />

          <div className="comparador-appbar-brand">
            <div className="comparador-appbar-logo-aura">
              <img src={laboratoryLogo} alt="UNAH Logo" className="comparador-appbar-logo" />
            </div>
            <div className="comparador-appbar-title-wrap">
              <h1 className="comparador-appbar-title">Versus de Placas</h1>
              <span className="comparador-appbar-tag">VS</span>
            </div>
          </div>
        </div>

        <div className="comparador-appbar-actions">
          <label className="comparador-mode-control">
            <span className="comparador-sr-only">Número de placas</span>
            <select
              className="comparador-btn comparador-mode-select"
              value={plateCount}
              onChange={event => {
                setPlateCount(Number(event.target.value) as PlateCount);
                setLayoutMenuOpen(false);
              }}
            >
              <option value={2}>2 placas</option>
              <option value={3}>3 placas</option>
              <option value={4}>4 placas</option>
            </select>
          </label>
          {/* Sync Toggle */}
          <button
            type="button"
            className={`comparador-btn comparador-btn-sync ${isSynced ? 'is-active' : ''}`}
            onClick={() => setIsSynced(prev => !prev)}
            title="Sincronizar zoom y desplazamiento entre las placas visibles (Atajo: S)"
          >
            {isSynced ? <Link2 size={15} /> : <Link2Off size={15} />}
            <span>{isSynced ? 'Sincronizado' : 'Sincronizar'}</span>
          </button>

          {/* Swap Plates */}
          <button
            type="button"
            className="comparador-btn"
            onClick={handleSwapPlates}
            disabled={!activeSlots.some(slot => slot.plate)}
            title={plateCount === 2 ? 'Intercambiar Placa A y Placa B (Atajo: X)' : 'Rotar las placas entre las posiciones visibles (Atajo: X)'}
          >
            <ArrowLeftRight size={14} />
            <span>Intercambiar</span>
          </button>

          {/* Toggle All Signalings */}
          <button
            type="button"
            className="comparador-btn"
            onClick={handleToggleAllSignalings}
            title="Mostrar u ocultar señalados en las placas visibles"
          >
            {areAllSignalingsOn ? <Eye size={14} /> : <EyeOff size={14} />}
            <span>Señalados</span>
          </button>

          {/* Reset Visible Views */}
          <button
            type="button"
            className="comparador-btn comparador-btn-icon-only"
            onClick={handleResetViews}
            title="Restablecer posición y zoom (Atajo: R)"
            aria-label="Restablecer vistas"
          >
            <RotateCcw size={15} />
          </button>

          {/* OS Fullscreen */}
          <button
            type="button"
            className="comparador-btn comparador-btn-icon-only"
            onClick={handleToggleOsFullscreen}
            title={isOsFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa de pantalla'}
            aria-label="Pantalla completa"
          >
            {isOsFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
        </div>
      </header>

      <section
        className={`comparador-viewport-workspace count-${plateCount} layout-${activeLayout}`}
        aria-label="Área de comparación"
      >
        {activeSlots.map((slot, index) => (
          <DualPlateViewport
            key={LETTERS[index]}
            letter={LETTERS[index]}
            plate={slot.plate}
            onOpenPicker={() => handleOpenPicker(index)}
            zoom={slot.zoom}
            pan={slot.pan}
            onPanZoomChange={(zoom, pan) => handlePanZoomChange(index, zoom, pan)}
            showSignalings={slot.showSignalings}
            onToggleSignalings={() => setSlots(prev => prev.map((entry, i) => i === index
              ? { ...entry, showSignalings: !entry.showSignalings } : entry))}
          />
        ))}
      </section>

      <footer className="comparador-layout-bar">
        <div className="comparador-layout-control" ref={layoutControlRef}>
          <button
            type="button"
            className="comparador-btn"
            aria-expanded={layoutMenuOpen}
            aria-controls="comparador-layout-options"
            onClick={() => setLayoutMenuOpen(prev => !prev)}
          >
            <span
              className={`comparador-layout-preview comparador-layout-icon count-${plateCount} layout-${activeLayout}`}
              aria-hidden="true"
            >
              {activeSlots.map((_, index) => <span key={index} />)}
            </span>
            <span>Distribución</span>
          </button>
          {layoutMenuOpen && (
            <div id="comparador-layout-options" className="comparador-layout-options" role="group" aria-label="Distribución de placas">
              {(plateCount === 2 ? ['horizontal', 'vertical'] : ['columns', 'featured', ...(plateCount === 4 ? ['grid'] : [])] as Layout[]).map(layout => (
                <button
                  key={layout}
                  type="button"
                  aria-pressed={activeLayout === layout}
                  onClick={() => {
                    if (plateCount === 2) setLayoutOrientation(layout as 'horizontal' | 'vertical');
                    else setMultiLayouts(prev => ({ ...prev, [plateCount]: layout as MultiLayout }));
                    setLayoutMenuOpen(false);
                  }}
                >
                  <span className={`comparador-layout-preview count-${plateCount} layout-${layout}`} aria-hidden="true">
                    {activeSlots.map((_, index) => <span key={index}>{LETTERS[index]}</span>)}
                  </span>
                  <span>{layout === 'columns' || layout === 'horizontal' ? 'Una al lado de otra' : layout === 'vertical'
                    ? 'Una arriba de otra' : layout === 'featured'
                    ? `Una mitad + ${plateCount - 1} apiladas` : '2 × 2'}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {plateCount !== 2 && activeLayout === 'featured' && (
          <button
            type="button"
            className="comparador-btn"
            onClick={() => {
              setLayoutMenuOpen(false);
              handleSwapPlates();
            }}
            disabled={!activeSlots.some(slot => slot.plate)}
            title="Pasar la primera placa pequeña a la vista grande y enviar la grande al final"
          >
            <Repeat2 size={16} />
            <span>Alternar destacada</span>
          </button>
        )}
      </footer>

      {/* Stepped Plate Picker Modal */}
      <PlatePickerModal
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelectPlate={handleSelectPlate}
        targetLetter={LETTERS[pickerTarget]}
      />
    </div>
  );
};

export default ComparadorPlacas;
