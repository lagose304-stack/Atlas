import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Columns2,
  Eye,
  EyeOff,
  Link2,
  Link2Off,
  Maximize2,
  Minimize2,
  RotateCcw,
  Rows2,
} from 'lucide-react';
import DualPlateViewport from '../components/comparador/DualPlateViewport';
import PlatePickerModal, { type ComparadorPlacaItem } from '../components/comparador/PlatePickerModal';
import { useSmartBackNavigation } from '../hooks/useSmartBackNavigation';
import { acquireAtlasScrollLock, releaseAtlasScrollLock } from '../constants/scrollLock';
import laboratoryLogo from '../assets/logos/laboratorio.png';
import '../styles/comparador.css';

const ComparadorPlacas: React.FC = () => {
  const goBack = useSmartBackNavigation('/herramientas');
  const [plateA, setPlateA] = useState<ComparadorPlacaItem | null>(null);
  const [plateB, setPlateB] = useState<ComparadorPlacaItem | null>(null);

  // Transform states
  const [zoomA, setZoomA] = useState(1);
  const [panA, setPanA] = useState({ x: 0, y: 0 });
  const [zoomB, setZoomB] = useState(1);
  const [panB, setPanB] = useState({ x: 0, y: 0 });

  // Sync state
  const [isSynced, setIsSynced] = useState(false);

  // Signalings visibility (off by default)
  const [showSignalingsA, setShowSignalingsA] = useState(false);
  const [showSignalingsB, setShowSignalingsB] = useState(false);

  // Layout orientation
  const [layoutOrientation, setLayoutOrientation] = useState<'horizontal' | 'vertical'>('horizontal');

  // Fullscreen OS API state
  const [isOsFullscreen, setIsOsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Picker Modal
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<'A' | 'B'>('A');

  // Lock document scroll while comparator is mounted
  useEffect(() => {
    acquireAtlasScrollLock();
    return () => {
      releaseAtlasScrollLock();
    };
  }, []);

  // Open picker for A or B
  const handleOpenPicker = (target: 'A' | 'B') => {
    setPickerTarget(target);
    setPickerOpen(true);
  };

  // Select Plate handler
  const handleSelectPlate = (plate: ComparadorPlacaItem) => {
    if (pickerTarget === 'A') {
      setPlateA(plate);
      setShowSignalingsA(false);
      setZoomA(1);
      setPanA({ x: 0, y: 0 });
    } else {
      setPlateB(plate);
      setShowSignalingsB(false);
      setZoomB(1);
      setPanB({ x: 0, y: 0 });
    }
  };

  // Swap plates A and B
  const handleSwapPlates = () => {
    setPlateA(plateB);
    setPlateB(plateA);
    const tempZoom = zoomA;
    const tempPan = panA;
    setZoomA(zoomB);
    setPanA(panB);
    setZoomB(tempZoom);
    setPanB(tempPan);
  };

  // Reset both viewports
  const handleResetBoth = () => {
    setZoomA(1);
    setPanA({ x: 0, y: 0 });
    setZoomB(1);
    setPanB({ x: 0, y: 0 });
  };

  // Toggle Global Signalings
  const areAllSignalingsOn = showSignalingsA && showSignalingsB;
  const handleToggleAllSignalings = () => {
    const next = !areAllSignalingsOn;
    setShowSignalingsA(next);
    setShowSignalingsB(next);
  };

  // Sync Pan & Zoom changes from Plate A
  const handlePanZoomChangeA = useCallback((newZoom: number, newPan: { x: number; y: number }) => {
    setZoomA(newZoom);
    setPanA(newPan);

    if (isSynced) {
      setZoomB(newZoom);
      setPanB(newPan);
    }
  }, [isSynced]);

  // Sync Pan & Zoom changes from Plate B
  const handlePanZoomChangeB = useCallback((newZoom: number, newPan: { x: number; y: number }) => {
    setZoomB(newZoom);
    setPanB(newPan);

    if (isSynced) {
      setZoomA(newZoom);
      setPanA(newPan);
    }
  }, [isSynced]);

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
        if (pickerOpen) {
          setPickerOpen(false);
        } else if (!document.fullscreenElement) {
          goBack();
        }
      } else if (e.key === 's' || e.key === 'S') {
        setIsSynced(prev => !prev);
      } else if (e.key === 'x' || e.key === 'X') {
        handleSwapPlates();
      } else if (e.key === 'r' || e.key === 'R') {
        handleResetBoth();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [goBack, pickerOpen, zoomA, zoomB, panA, panB, plateA, plateB]);

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
          {/* Sync Toggle */}
          <button
            type="button"
            className={`comparador-btn comparador-btn-sync ${isSynced ? 'is-active' : ''}`}
            onClick={() => setIsSynced(prev => !prev)}
            title="Sincronizar zoom y desplazamiento entre ambas placas (Atajo: S)"
          >
            {isSynced ? <Link2 size={15} /> : <Link2Off size={15} />}
            <span>{isSynced ? 'Sincronizado' : 'Sincronizar'}</span>
          </button>

          {/* Swap Plates */}
          <button
            type="button"
            className="comparador-btn"
            onClick={handleSwapPlates}
            disabled={!plateA && !plateB}
            title="Intercambiar Placa A y Placa B (Atajo: X)"
          >
            <ArrowLeftRight size={14} />
            <span>Intercambiar</span>
          </button>

          {/* Toggle All Signalings */}
          <button
            type="button"
            className="comparador-btn"
            onClick={handleToggleAllSignalings}
            title="Mostrar u ocultar señalados en ambas placas"
          >
            {areAllSignalingsOn ? <Eye size={14} /> : <EyeOff size={14} />}
            <span>Señalados</span>
          </button>

          {/* Reset Both Views */}
          <button
            type="button"
            className="comparador-btn comparador-btn-icon-only"
            onClick={handleResetBoth}
            title="Restablecer posición y zoom (Atajo: R)"
            aria-label="Restablecer vistas"
          >
            <RotateCcw size={15} />
          </button>

          {/* Layout Orientation */}
          <button
            type="button"
            className="comparador-btn comparador-btn-icon-only"
            onClick={() => setLayoutOrientation(prev => prev === 'horizontal' ? 'vertical' : 'horizontal')}
            title={`Cambiar a vista ${layoutOrientation === 'horizontal' ? 'vertical (apilada)' : 'horizontal (lado a lado)'}`}
            aria-label="Cambiar orientación"
          >
            {layoutOrientation === 'horizontal' ? <Columns2 size={15} /> : <Rows2 size={15} />}
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

      {/* Edge-to-Edge Dual Viewport Workspace */}
      <section
        className={`comparador-viewport-workspace layout-${layoutOrientation}`}
        aria-label="Área de comparación"
      >
        {/* Plate A Viewport */}
        <DualPlateViewport
          letter="A"
          plate={plateA}
          onOpenPicker={() => handleOpenPicker('A')}
          zoom={zoomA}
          pan={panA}
          onPanZoomChange={handlePanZoomChangeA}
          showSignalings={showSignalingsA}
          onToggleSignalings={() => setShowSignalingsA(prev => !prev)}
        />

        {/* Plate B Viewport */}
        <DualPlateViewport
          letter="B"
          plate={plateB}
          onOpenPicker={() => handleOpenPicker('B')}
          zoom={zoomB}
          pan={panB}
          onPanZoomChange={handlePanZoomChangeB}
          showSignalings={showSignalingsB}
          onToggleSignalings={() => setShowSignalingsB(prev => !prev)}
        />
      </section>

      {/* Stepped Plate Picker Modal */}
      <PlatePickerModal
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelectPlate={handleSelectPlate}
        targetLetter={pickerTarget}
      />
    </div>
  );
};

export default ComparadorPlacas;
