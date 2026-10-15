import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BadgeInfo, BookOpen, ClipboardList, GraduationCap, House, Search, Wrench } from 'lucide-react';
import { IMAGE_VIEWER_VISIBILITY_EVENT, ImageViewerVisibilityDetail, OPEN_HEADER_SEARCH_EVENT } from '../constants/uiEvents';
import { useAuth } from '../contexts/AuthContext';
import {
  canBypassMaintenance,
  fetchSiteMaintenanceStatus,
  isFeatureDisabled,
  isTemaDisabled,
} from '../services/siteMaintenance';
import { getCachedTemas, getCachedSubtemas, getQuickTemas, getQuickSubtemas } from '../services/catalogService';

import logoFacultad from '../assets/logos/facultad.png';
import microscopioHeader from '../assets/logos/laboratorio.png';
import fondoHeader from '../assets/imagenes/fondo.webp';
import HalloweenPumpkin from './HalloweenPumpkin';
import HalloweenBats from './HalloweenBats';

const MENU_ITEMS = [
  { key: 'inicio', label: 'Inicio', icon: House, path: '/' },
  { key: 'temario', label: 'Temario', icon: BookOpen, path: '/temario' },
  { key: 'evaluaciones', label: 'Evaluaciones', icon: ClipboardList, path: '/evaluaciones' },
  { key: 'herramientas', label: 'Herramientas', icon: Wrench, path: '/herramientas' },
  { key: 'registro', label: 'Registro', icon: GraduationCap, path: 'https://registro-histolab.7w7.workers.dev/' },
  { key: 'creditos', label: 'Créditos', icon: BadgeInfo, path: '/creditos' },
] as const;

interface SearchTemaRecord {
  id: number;
  nombre: string;
}

interface SearchSubtemaRecord {
  id: number;
  nombre: string;
  tema_id: number;
  tema_nombre: string;
}

interface SearchSuggestion {
  id: string;
  kind: 'tema' | 'subtema';
  title: string;
  targetPath: string;
  score: number;
}

interface HeaderProps {
  disableInteractions?: boolean;
}

const stripDiacritics = (value: string): string =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const normalizeSearchText = (value: string): string =>
  stripDiacritics(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const levenshteinDistance = (leftValue: string, rightValue: string): number => {
  if (leftValue === rightValue) return 0;
  if (!leftValue.length) return rightValue.length;
  if (!rightValue.length) return leftValue.length;

  const previousRow = Array.from({ length: rightValue.length + 1 }, (_, index) => index);

  for (let leftIndex = 1; leftIndex <= leftValue.length; leftIndex += 1) {
    let previousDiagonal = previousRow[0];
    previousRow[0] = leftIndex;

    for (let rightIndex = 1; rightIndex <= rightValue.length; rightIndex += 1) {
      const temp = previousRow[rightIndex];
      const cost = leftValue[leftIndex - 1] === rightValue[rightIndex - 1] ? 0 : 1;
      previousRow[rightIndex] = Math.min(
        previousRow[rightIndex] + 1,
        previousRow[rightIndex - 1] + 1,
        previousDiagonal + cost,
      );
      previousDiagonal = temp;
    }
  }

  return previousRow[rightValue.length];
};

const scoreTextMatch = (query: string, candidate: string): number => {
  const normalizedQuery = normalizeSearchText(query);
  const normalizedCandidate = normalizeSearchText(candidate);

  if (!normalizedQuery || !normalizedCandidate) {
    return 0;
  }

  if (normalizedQuery === normalizedCandidate) {
    return 240;
  }

  let score = 0;

  if (normalizedCandidate.startsWith(normalizedQuery)) {
    score += 90;
  }

  if (normalizedCandidate.includes(normalizedQuery)) {
    score += 75;
  }

  const queryTokens = normalizedQuery.split(' ').filter(Boolean);
  const candidateTokens = normalizedCandidate.split(' ').filter(Boolean);

  queryTokens.forEach((token) => {
    if (normalizedCandidate === token) {
      score += 48;
      return;
    }

    if (normalizedCandidate.includes(token)) {
      score += 22;
      return;
    }

    if (candidateTokens.some((candidateToken) => candidateToken.startsWith(token))) {
      score += 12;
    }
  });

  const distance = levenshteinDistance(normalizedQuery, normalizedCandidate);
  const maxLength = Math.max(normalizedQuery.length, normalizedCandidate.length);
  const similarity = maxLength > 0 ? 1 - distance / maxLength : 0;
  score += Math.max(0, similarity * 70);

  return score;
};

const buildSearchSuggestions = (
  query: string,
  temas: SearchTemaRecord[],
  subtemas: SearchSubtemaRecord[],
  limit = 8,
): SearchSuggestion[] => {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return [];
  }

  const suggestions: SearchSuggestion[] = [];

  temas.forEach((tema) => {
    const score = scoreTextMatch(normalizedQuery, tema.nombre);
    if (score <= 0) return;

    suggestions.push({
      id: `tema-${tema.id}`,
      kind: 'tema',
      title: `Tema: ${tema.nombre}`,
      targetPath: `/subtemas/${tema.id}`,
      score,
    });
  });

  subtemas.forEach((subtema) => {
    const themeScore = scoreTextMatch(normalizedQuery, subtema.tema_nombre);
    const subtemaScore = scoreTextMatch(normalizedQuery, subtema.nombre);
    const combinedScore = scoreTextMatch(normalizedQuery, `${subtema.tema_nombre} ${subtema.nombre}`);
    const score = Math.max(themeScore * 0.9, subtemaScore, combinedScore);

    if (score <= 0) return;

    suggestions.push({
      id: `subtema-${subtema.id}`,
      kind: 'subtema',
      title: `${subtema.tema_nombre}: ${subtema.nombre}`,
      targetPath: `/ver-placas/${subtema.id}`,
      score,
    });
  });

  return suggestions
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      if (left.kind !== right.kind) return left.kind === 'tema' ? -1 : 1;
      return left.title.localeCompare(right.title, 'es', { sensitivity: 'base' });
    })
    .slice(0, limit);
};

const Header: React.FC<HeaderProps> = ({ disableInteractions = false }) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, isAuthenticated } = useAuth();
  const headerRef = React.useRef<HTMLElement | null>(null);
  const searchInputRef = React.useRef<HTMLInputElement | null>(null);
  const searchFieldShellRef = React.useRef<HTMLDivElement | null>(null);
  const [isLeftLogoHover, setIsLeftLogoHover] = React.useState(false);
  const [isRightLogoHover, setIsRightLogoHover] = React.useState(false);
  const [showCompactBar, setShowCompactBar] = React.useState(false);
  const [openImageViewerCount, setOpenImageViewerCount] = React.useState(0);
  const [compactBarFrame, setCompactBarFrame] = React.useState({ left: 8, width: 320 });
  const [showSearchBar, setShowSearchBar] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchTemas, setSearchTemas] = React.useState<SearchTemaRecord[]>([]);
  const [searchSubtemas, setSearchSubtemas] = React.useState<SearchSubtemaRecord[]>([]);
  const [searchIndexLoading, setSearchIndexLoading] = React.useState(false);
  const [searchIndexLoaded, setSearchIndexLoaded] = React.useState(false);
  const [searchSuggestionsFrame, setSearchSuggestionsFrame] = React.useState<{ top: number; left: number; width: number } | null>(null);;
  const isImageViewerOpen = openImageViewerCount > 0;
  const isHeaderLocked = disableInteractions;
  const isMenuItemActive = React.useCallback((key: typeof MENU_ITEMS[number]['key']) => {
    if (key === 'inicio') return pathname === '/';
    if (key === 'temario') {
      return pathname === '/temario' || pathname.startsWith('/subtemas/') || pathname.startsWith('/ver-placas/');
    }
    if (key === 'evaluaciones') return pathname === '/evaluaciones' || pathname.startsWith('/evaluaciones/');
    if (key === 'herramientas') return pathname === '/herramientas' || pathname.startsWith('/herramientas/');
    if (key === 'registro') return false;
    if (key === 'creditos') return pathname === '/creditos';
    return false;
  }, [pathname]);

  const isInAdminEditingFlow = React.useMemo(() => {
    const adminPaths = [
      '/edicion',
      '/temario-admin',
      '/placas',
      '/editar-temario',
      '/editar-subtemas',
      '/editar-placas',
      '/eliminar-placas',
      '/mover-placa',
      '/lista-espera',
      '/mapas-interactivos',
      '/gestion-usuarios',
      '/estadisticas',
    ];

    return adminPaths.some((basePath) => pathname === basePath || pathname.startsWith(`${basePath}/`));
  }, [pathname]);

  const navigateFromHeader = React.useCallback((targetPath: string) => {
    if (isHeaderLocked) {
      return;
    }

    if (/^https?:\/\//i.test(targetPath)) {
      window.open(targetPath, '_blank', 'noopener,noreferrer');
      return;
    }

    if (isInAdminEditingFlow) {
      window.location.replace(targetPath);
      return;
    }

    navigate(targetPath);
  }, [isHeaderLocked, isInAdminEditingFlow, navigate]);

  React.useEffect(() => {
    let rafId: number | null = null;

    const handleScroll = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        if (!headerRef.current) {
          setShowCompactBar(false);
          return;
        }

        const rect = headerRef.current.getBoundingClientRect();
        const shouldShow = rect.bottom <= 0;
        setShowCompactBar(shouldShow);

        const nextLeft = Math.max(0, Math.round(rect.left));
        const nextRight = Math.min(window.innerWidth, Math.round(rect.right));
        const nextWidth = Math.max(0, nextRight - nextLeft);

        setCompactBarFrame((prev) => (
          prev.left === nextLeft && prev.width === nextWidth
            ? prev
            : { left: nextLeft, width: nextWidth }
        ));
      });
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, []);

  React.useEffect(() => {
    const handleImageViewerVisibility = (event: Event) => {
      const customEvent = event as CustomEvent<ImageViewerVisibilityDetail>;
      const delta = customEvent.detail?.delta;

      if (delta !== 1 && delta !== -1) {
        return;
      }

      setOpenImageViewerCount((prev) => Math.max(0, prev + delta));
    };

    window.addEventListener(IMAGE_VIEWER_VISIBILITY_EVENT, handleImageViewerVisibility as EventListener);

    return () => {
      window.removeEventListener(IMAGE_VIEWER_VISIBILITY_EVENT, handleImageViewerVisibility as EventListener);
    };
  }, []);

  React.useEffect(() => {
    const handleOpenHeaderSearch = () => {
      if (isHeaderLocked) return;
      setShowSearchBar(true);
    };

    window.addEventListener(OPEN_HEADER_SEARCH_EVENT, handleOpenHeaderSearch);

    return () => {
      window.removeEventListener(OPEN_HEADER_SEARCH_EVENT, handleOpenHeaderSearch);
    };
  }, [isHeaderLocked]);

  React.useEffect(() => {
    if (!showSearchBar) return;
    searchInputRef.current?.focus();
  }, [showSearchBar]);

  React.useEffect(() => {
    if (showSearchBar) return;
    setSearchQuery('');
  }, [showSearchBar]);

  React.useEffect(() => {
    if (!showSearchBar || !searchFieldShellRef.current) {
      setSearchSuggestionsFrame(null);
      return;
    }

    let rafId: number | null = null;

    const syncSearchFrame = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        const rect = searchFieldShellRef.current?.getBoundingClientRect();
        if (!rect) {
          setSearchSuggestionsFrame(null);
          return;
        }

        const viewportPadding = 8;
        const maxWidth = Math.max(0, window.innerWidth - viewportPadding * 2);
        const preferredWidth = Math.round(rect.width);
        const boundedWidth = Math.min(preferredWidth, maxWidth);
        const boundedLeft = Math.max(
          viewportPadding,
          Math.min(Math.round(rect.left), window.innerWidth - viewportPadding - boundedWidth),
        );
        const boundedTop = Math.max(viewportPadding, Math.round(rect.bottom + 8));

        const nextFrame = {
          top: boundedTop,
          left: boundedLeft,
          width: boundedWidth,
        };

        setSearchSuggestionsFrame((prev) => (
          prev?.top === nextFrame.top && prev?.left === nextFrame.left && prev?.width === nextFrame.width
            ? prev
            : nextFrame
        ));
      });
    };

    syncSearchFrame();
    window.addEventListener('resize', syncSearchFrame);
    window.addEventListener('scroll', syncSearchFrame, { passive: true, capture: true });

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      window.removeEventListener('resize', syncSearchFrame);
      window.removeEventListener('scroll', syncSearchFrame, true);
    };
  }, [searchIndexLoaded, searchIndexLoading, searchQuery, searchSubtemas.length, searchTemas.length, showSearchBar]);

  React.useEffect(() => {
    if (!showSearchBar || searchIndexLoading || searchIndexLoaded) {
      return;
    }

    const loadSearchIndex = async () => {
      setSearchIndexLoading(true);

      try {
        const [temasRes, subtemasRes, maintenanceRes] = await Promise.allSettled([
          getCachedTemas(),
          getCachedSubtemas(),
          fetchSiteMaintenanceStatus(),
        ]);

        const temasData = temasRes.status === 'fulfilled' ? temasRes.value : (getQuickTemas() ?? []);
        const subtemasData = subtemasRes.status === 'fulfilled' ? subtemasRes.value : (getQuickSubtemas() ?? []);
        const maintenanceStatus = maintenanceRes.status === 'fulfilled' ? maintenanceRes.value : { enabled: false, disabledFeatures: [] };

        const canBypass = canBypassMaintenance(user, isAuthenticated);

        if (
          !canBypass &&
          (maintenanceStatus.enabled ||
            isFeatureDisabled('search', maintenanceStatus.disabledFeatures) ||
            isFeatureDisabled('public_catalog', maintenanceStatus.disabledFeatures))
        ) {
          setSearchTemas([]);
          setSearchSubtemas([]);
        } else {
          let validTemas = (temasData ?? []) as Array<SearchTemaRecord & { parcial?: string }>;
          if (!canBypass) {
            validTemas = validTemas.filter((t) => !isTemaDisabled(t.id, t.parcial, maintenanceStatus.disabledFeatures));
          }
          setSearchTemas(validTemas);

          const validTemaMap = new Map(validTemas.map((t) => [t.id, t.nombre]));
          const nextSubtemas = (subtemasData ?? [])
            .filter((row) => canBypass || validTemaMap.has(row.tema_id))
            .map((row) => ({
              id: row.id,
              nombre: row.nombre,
              tema_id: row.tema_id,
              tema_nombre: validTemaMap.get(row.tema_id) || '',
            }));
          setSearchSubtemas(nextSubtemas);
        }

        setSearchIndexLoaded(true);
      } catch (err) {
        console.error('Error cargando índice de búsqueda en Header:', err);
      } finally {
        setSearchIndexLoading(false);
      }
    };

    void loadSearchIndex();
  }, [searchIndexLoaded, searchIndexLoading, showSearchBar, user, isAuthenticated]);

  const searchSuggestions = React.useMemo(
    () => buildSearchSuggestions(searchQuery, searchTemas, searchSubtemas, 7),
    [searchQuery, searchSubtemas, searchTemas],
  );

  return (
    <>
      <header ref={headerRef} className="atlas-header-wrapper" style={styles.wrapper}>
        <section
          className="atlas-header-hero"
          style={{
            ...styles.hero,
            backgroundImage: `linear-gradient(108deg, rgba(14, 7, 34, 0.94) 0%, rgba(26, 12, 56, 0.88) 22%, rgba(53, 20, 96, 0.72) 50%, rgba(26, 12, 56, 0.88) 78%, rgba(14, 7, 34, 0.94) 100%), url(${fondoHeader})`,
          }}
        >
          <div className="atlas-header-glass" style={styles.heroGlass} />
          <div className="atlas-header-readable-overlay" style={styles.heroReadableOverlay} />

          <div className="atlas-header-main-row" style={styles.heroMainRow}>
            <div className="atlas-header-left-area" style={styles.leftArea}>
              <button
                type="button"
                onClick={() => navigateFromHeader('/')}
                className="atlas-header-logo-action-button"
                style={{ ...styles.logoActionButton, ...(isHeaderLocked ? styles.lockedActionButton : {}) }}
                disabled={isHeaderLocked}
                onMouseEnter={() => setIsLeftLogoHover(true)}
                onMouseLeave={() => setIsLeftLogoHover(false)}
                aria-label="Ir a inicio"
              >
                <div className="atlas-header-left-logo-aura" style={{ ...styles.leftLogoAura, ...(isLeftLogoHover ? styles.leftLogoAuraHover : {}) }}>
                  <img className="atlas-header-microscope-image" src={microscopioHeader} alt="Microscopio" style={styles.microscopeImage} />
                </div>
              </button>
            </div>

            <div className="atlas-header-center-area" style={styles.centerArea}>
              {/* Marco interno con borde discontinuo estilo Halloween de la referencia */}
              <div className="atlas-halloween-inner-frame" aria-hidden="true" />

              {/* Telarañas en las esquinas superiores */}
              <svg className="atlas-halloween-web atlas-halloween-web-left" viewBox="0 0 100 100" aria-hidden="true" fill="none">
                <path d="M 0 0 L 100 0 M 0 0 L 92 38 M 0 0 L 71 71 M 0 0 L 38 92 M 0 0 L 0 100" stroke="rgba(245, 235, 255, 0.38)" strokeWidth="1.2" />
                <path d="M 28 0 Q 24 10 20 20 Q 10 24 0 28" stroke="rgba(245, 235, 255, 0.4)" strokeWidth="1" fill="none" />
                <path d="M 52 0 Q 45 19 37 37 Q 19 45 0 52" stroke="rgba(245, 235, 255, 0.4)" strokeWidth="1" fill="none" />
                <path d="M 76 0 Q 66 28 54 54 Q 28 66 0 76" stroke="rgba(245, 235, 255, 0.4)" strokeWidth="1" fill="none" />
                <path d="M 98 0 Q 86 36 70 70 Q 36 86 0 98" stroke="rgba(245, 235, 255, 0.4)" strokeWidth="1" fill="none" />
              </svg>
              <svg className="atlas-halloween-web atlas-halloween-web-right" viewBox="0 0 100 100" aria-hidden="true" fill="none">
                <path d="M 0 0 L 100 0 M 0 0 L 92 38 M 0 0 L 71 71 M 0 0 L 38 92 M 0 0 L 0 100" stroke="rgba(245, 235, 255, 0.38)" strokeWidth="1.2" />
                <path d="M 28 0 Q 24 10 20 20 Q 10 24 0 28" stroke="rgba(245, 235, 255, 0.4)" strokeWidth="1" fill="none" />
                <path d="M 52 0 Q 45 19 37 37 Q 19 45 0 52" stroke="rgba(245, 235, 255, 0.4)" strokeWidth="1" fill="none" />
                <path d="M 76 0 Q 66 28 54 54 Q 28 66 0 76" stroke="rgba(245, 235, 255, 0.4)" strokeWidth="1" fill="none" />
                <path d="M 98 0 Q 86 36 70 70 Q 36 86 0 98" stroke="rgba(245, 235, 255, 0.4)" strokeWidth="1" fill="none" />
              </svg>

              {/* Goteo anaranjado de calabaza/cera a lo largo del borde superior */}
              <div className="atlas-halloween-drips" aria-hidden="true">
                <svg viewBox="0 0 800 24" preserveAspectRatio="none" fill="none">
                  <defs>
                    <linearGradient id="halloDripGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#ff9a3c" />
                      <stop offset="60%" stopColor="#ea580c" />
                      <stop offset="100%" stopColor="#c2410c" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0,0 L800,0 L800,3 C785,3 783,16 776,16 C769,16 767,3 755,3 C745,3 743,10 738,10 C733,10 731,3 720,3 C710,3 708,20 700,20 C692,20 690,3 675,3 C662,3 660,12 654,12 C648,12 646,3 630,3 C618,3 616,18 608,18 C600,18 598,3 585,3 C572,3 570,9 564,9 C558,9 556,3 540,3 C528,3 526,22 518,22 C510,22 508,3 490,3 C478,3 476,14 470,14 C464,14 462,3 450,3 C438,3 436,19 428,19 C420,19 418,3 400,3 C382,3 380,19 372,19 C364,19 362,3 350,3 C338,3 336,14 330,14 C324,14 322,3 310,3 C292,3 290,22 282,22 C274,22 272,3 260,3 C244,3 242,9 236,9 C230,9 228,3 215,3 C202,3 200,18 192,18 C184,18 182,3 170,3 C154,3 152,12 146,12 C140,12 138,3 125,3 C110,3 108,20 100,20 C92,20 90,3 80,3 C69,3 67,10 62,10 C57,10 55,3 45,3 C33,3 31,16 24,16 C17,16 15,3 0,3 Z"
                    fill="url(#halloDripGrad)"
                    filter="drop-shadow(0 2px 4px rgba(0,0,0,0.4))"
                  />
                </svg>
              </div>

              {/* Chispas y partículas sutiles de Halloween */}
              <div className="atlas-halloween-embers" aria-hidden="true">
                <span className="atlas-ember e1" />
                <span className="atlas-ember e2" />
                <span className="atlas-ember e3" />
                <span className="atlas-ember e4" />
                <span className="atlas-ember e5" />
                <span className="atlas-ember e6" />
              </div>

              <h1 className="atlas-header-title" style={styles.title}>
                <span className="atlas-header-title-text">
                  {/* Murciélagos animados de Halloween del lado izquierdo */}
                  <HalloweenBats />
                  <span className="atlas-halloween-title-gradient">Atlas de Histología</span>
                  <span
                    className="atlas-header-flag-stamp atlas-header-autumn-stamp"
                    title="¡Bienvenido Octubre! 🍂🎃 Otoño y Halloween"
                    aria-label="Decoración de Octubre: Otoño y Halloween"
                    role="img"
                  >
                    {/* Hojas otoñales flotantes y destellos dorados de celebración */}
                    <span className="atlas-header-confetti-cluster" aria-hidden="true">
                      <span className="atlas-confetti-item c1" />
                      <span className="atlas-confetti-item c2" />
                      <span className="atlas-confetti-item c3" />
                      <span className="atlas-confetti-item c4" />
                      <span className="atlas-confetti-item c5" />
                      <span className="atlas-confetti-item c6" />
                      <span className="atlas-confetti-item c7" />
                      <span className="atlas-confetti-item c8" />
                    </span>

                    <HalloweenPumpkin />
                  </span>
                </span>
              </h1>

              <p className="atlas-header-subtitle" style={styles.subtitle}>
                Laboratorio de Histología – <span className="atlas-halloween-doctor-name">Dr. Rafael Perdomo Vaquero</span>
              </p>

              <div className="atlas-header-separator atlas-halloween-separator" style={styles.separator}>
                <span className="atlas-halloween-sep-line" />
                <span className="atlas-halloween-sep-pumpkin" aria-hidden="true">🎃</span>
                <span className="atlas-halloween-sep-line" />
              </div>

              <p className="atlas-header-subtitle2" style={styles.subtitle2}>Facultad de Ciencias Médicas – UNAH</p>
            </div>

            <div className="atlas-header-right-area" style={styles.rightArea}>
              <button
                type="button"
                onClick={() => navigateFromHeader('/')}
                className="atlas-header-logo-action-button"
                style={{ ...styles.logoActionButton, ...(isHeaderLocked ? styles.lockedActionButton : {}) }}
                disabled={isHeaderLocked}
                onMouseEnter={() => setIsRightLogoHover(true)}
                onMouseLeave={() => setIsRightLogoHover(false)}
                aria-label="Ir a inicio"
              >
                <div className="atlas-header-right-logo-aura" style={{ ...styles.rightLogoAura, ...(isRightLogoHover ? styles.rightLogoAuraHover : {}) }}>
                  <img className="atlas-header-university-logo" src={logoFacultad} alt="Logo Facultad" style={styles.universityLogo} />
                </div>
              </button>
            </div>
          </div>
        </section>

        {showSearchBar && (
          <div id="atlas-header-search-panel" className="atlas-header-search-panel" style={styles.searchPanel}>
            <div className="atlas-header-search-panel-inner" style={styles.searchPanelInner}>
              <div ref={searchFieldShellRef} className="atlas-header-search-field-shell" style={styles.searchFieldShell}>
                <div className="atlas-header-search-field-row" style={styles.searchFieldRow}>
                  <Search size={18} color="#5b7ea6" strokeWidth={2.2} />
                  <input
                    ref={searchInputRef}
                    type="search"
                    className="atlas-header-search-input"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Buscar temas y subtemas"
                    aria-label="Buscar temas y subtemas"
                    style={styles.searchInput}
                  />
                  <button
                    type="button"
                    className="atlas-header-search-close-button"
                    onClick={() => setShowSearchBar(false)}
                    aria-label="Cerrar búsqueda"
                    style={{ ...styles.searchCloseButton, ...(isHeaderLocked ? styles.lockedActionButton : {}) }}
                    disabled={isHeaderLocked}
                  >
                    ×
                  </button>
                </div>

                {searchQuery.trim() && searchSuggestionsFrame && (
                  <div
                    className="atlas-header-search-suggestions"
                    style={{
                      ...styles.searchSuggestions,
                      top: `${searchSuggestionsFrame.top}px`,
                      left: `${searchSuggestionsFrame.left}px`,
                      width: `${searchSuggestionsFrame.width}px`,
                    }}
                    role="listbox"
                    aria-label="Sugerencias de búsqueda"
                  >
                    {searchIndexLoading && searchSuggestions.length === 0 ? (
                      <div className="atlas-header-search-empty" style={styles.searchEmptyState}>Cargando sugerencias...</div>
                    ) : searchSuggestions.length > 0 ? (
                      searchSuggestions.map((suggestion) => (
                        <button
                          key={suggestion.id}
                          type="button"
                          className="atlas-header-search-suggestion-item"
                          style={styles.searchSuggestionItem}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            navigateFromHeader(suggestion.targetPath);
                            setShowSearchBar(false);
                          }}
                        >
                          <span className="atlas-header-search-suggestion-badge" style={styles.searchSuggestionBadge}>
                            {suggestion.kind === 'tema' ? 'Tema' : 'Subtema'}
                          </span>
                          <span className="atlas-header-search-suggestion-content" style={styles.searchSuggestionContent}>
                            <span className="atlas-header-search-suggestion-title" style={styles.searchSuggestionTitle}>
                              {suggestion.title}
                            </span>
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="atlas-header-search-empty" style={styles.searchEmptyState}>No encontramos coincidencias. Prueba con otro nombre o una parte de la palabra.</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <nav
          className="atlas-header-bottom-nav"
          style={{
            ...styles.bottomNav,
            '--atlas-header-nav-background': `linear-gradient(180deg, rgba(14, 7, 34, 0.45), rgba(14, 7, 34, 0.7)), linear-gradient(105deg, rgba(26, 12, 56, 0.8), rgba(53, 20, 96, 0.45) 50%, rgba(26, 12, 56, 0.8)), url(${fondoHeader})`,
          } as React.CSSProperties}
          aria-label="Menú principal"
        >
          <ul className="atlas-header-nav-list" style={styles.navList}>
            {MENU_ITEMS.map((item) => {
              const Icon = item.icon;
              const isExternal = /^https?:\/\//i.test(item.path);
              return (
                <li className="atlas-header-nav-item" key={item.key} style={styles.navItem}>
                  <button
                    type="button"
                    className={`atlas-header-nav-button${isMenuItemActive(item.key) ? ' is-active' : ''}`}
                    style={{ ...styles.navButton, ...(isHeaderLocked ? styles.lockedActionButton : {}) }}
                    disabled={isHeaderLocked}
                    aria-current={isMenuItemActive(item.key) ? 'page' : undefined}
                    title={isExternal ? `${item.label} (abre en nueva pestaña)` : undefined}
                    onClick={() => {
                      if ('path' in item && item.path) navigateFromHeader(item.path);
                    }}
                  >
                    <span className="atlas-header-nav-icon-shell" aria-hidden="true">
                      <Icon size={17} strokeWidth={2.3} />
                    </span>
                    <span className="atlas-header-nav-label">{item.label}</span>
                  </button>
                </li>
              );
            })}
            <li className="atlas-header-nav-item" key="buscar" style={styles.navItem}>
              <button
                type="button"
                className={`atlas-header-nav-button${showSearchBar ? ' is-active' : ''}`}
                style={{ ...styles.navButton, ...(isHeaderLocked ? styles.lockedActionButton : {}) }}
                disabled={isHeaderLocked}
                aria-label="Buscar temas y subtemas"
                aria-expanded={showSearchBar}
                aria-controls="atlas-header-search-panel"
                onClick={() => {
                  setShowSearchBar((prev) => {
                    const next = !prev;
                    if (next && window.scrollY > 150) {
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                    return next;
                  });
                }}
              >
                <span className="atlas-header-nav-icon-shell" aria-hidden="true">
                  <Search size={17} strokeWidth={2.3} />
                </span>
                <span className="atlas-header-nav-label">Buscar</span>
              </button>
            </li>
          </ul>
        </nav>
      </header>

      <div
        className="atlas-compact-bar"
        style={{
          ...styles.compactBar,
          left: `${compactBarFrame.left}px`,
          width: `${compactBarFrame.width}px`,
          ...(showCompactBar && !isImageViewerOpen ? styles.compactBarVisible : styles.compactBarHidden),
        }}
      >
        <button
          type="button"
          className="atlas-compact-brand-button"
            style={{ ...styles.compactBrandButton, ...(isHeaderLocked ? styles.lockedActionButton : {}) }}
            disabled={isHeaderLocked}
          onClick={() => navigateFromHeader('/')}
          aria-label="Ir a inicio"
        >
          <div className="atlas-compact-logo-aura" style={styles.compactLogoAura}>
            <img className="atlas-compact-logo" src={microscopioHeader} alt="Logo Laboratorio" style={styles.compactLogo} />
          </div>
          <span className="atlas-compact-brand-text" style={styles.compactBrandText}>Atlas</span>
        </button>

        <div className="atlas-compact-divider" style={styles.compactDivider} />

        <div className="atlas-compact-nav-scroller" style={styles.compactNavScroller}>
          <ul className="atlas-compact-nav-list" style={styles.compactNavList}>
            {MENU_ITEMS.map((item) => {
              const Icon = item.icon;
              const isExternal = /^https?:\/\//i.test(item.path);
              return (
              <li className="atlas-compact-nav-item" key={`compact-${item.key}`} style={styles.compactNavItem}>
                <button
                  type="button"
                  className={`atlas-compact-nav-button${isMenuItemActive(item.key) ? ' is-active' : ''}`}
                  style={{ ...styles.compactNavButton, ...(isHeaderLocked ? styles.lockedActionButton : {}) }}
                  disabled={isHeaderLocked}
                  aria-current={isMenuItemActive(item.key) ? 'page' : undefined}
                  title={isExternal ? `${item.label} (abre en nueva pestaña)` : undefined}
                  onClick={() => {
                    if ('path' in item && item.path) navigateFromHeader(item.path);
                  }}
                >
                  <span className="atlas-compact-nav-icon-shell" aria-hidden="true">
                    <Icon className="atlas-compact-nav-icon" size={15} strokeWidth={2.3} />
                  </span>
                  <span>{item.label}</span>
                </button>
              </li>
            );})}
            <li className="atlas-compact-nav-item" key="compact-buscar" style={styles.compactNavItem}>
              <button
                type="button"
                className={`atlas-compact-nav-button${showSearchBar ? ' is-active' : ''}`}
                style={{ ...styles.compactNavButton, ...(isHeaderLocked ? styles.lockedActionButton : {}) }}
                disabled={isHeaderLocked}
                aria-label="Buscar temas y subtemas"
                aria-expanded={showSearchBar}
                aria-controls="atlas-header-search-panel"
                onClick={() => {
                  setShowSearchBar(true);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                <span className="atlas-compact-nav-icon-shell" aria-hidden="true">
                  <Search className="atlas-compact-nav-icon" size={15} strokeWidth={2.3} />
                </span>
                <span>Buscar</span>
              </button>
            </li>
          </ul>
        </div>
      </div>
    </>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  wrapper: {
    width: '100%',
    maxWidth: '1600px',
    margin: '0 auto',
    boxShadow: '0 18px 48px rgba(6, 2, 18, 0.45)',
    borderRadius: '22px 22px 0 0',
    overflow: 'hidden',
    border: '1px solid rgba(251, 146, 60, 0.38)',
    backgroundColor: '#0d051c',
  },
  hero: {
    position: 'relative',
    minHeight: '228px',
    display: 'flex',
    alignItems: 'center',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    width: '100%',
    borderBottom: '1px solid rgba(251, 146, 60, 0.35)',
  },
  heroGlass: {
    position: 'absolute',
    inset: '11px',
    borderRadius: '17px',
    border: '1px solid rgba(251, 146, 60, 0.3)',
    boxShadow: 'inset 0 0 55px rgba(168, 85, 247, 0.18), 0 0 0 1px rgba(249, 115, 22, 0.15)',
    pointerEvents: 'none',
  },
  heroReadableOverlay: {
    position: 'absolute',
    inset: 0,
    background:
      'radial-gradient(circle at 50% 50%, rgba(147, 51, 234, 0.16) 0%, rgba(67, 18, 110, 0.22) 48%, rgba(12, 5, 28, 0.48) 100%)',
    backdropFilter: 'blur(0.8px)',
    pointerEvents: 'none',
  },
  heroMainRow: {
    position: 'relative',
    zIndex: 1,
    width: '100%',
    minHeight: '212px',
    display: 'grid',
    gridTemplateColumns: '216px minmax(0, 1fr) 216px',
    alignItems: 'center',
    gap: '12px',
    padding: '0 16px',
  },
  leftArea: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoActionButton: {
    border: 'none',
    background: 'transparent',
    padding: 0,
    margin: 0,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leftLogoAura: {
    width: '180px',
    height: '180px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background:
      'radial-gradient(circle at 35% 32%, rgba(254, 243, 199, 0.38) 0%, rgba(147, 51, 234, 0.26) 48%, rgba(26, 10, 56, 0.85) 100%)',
    boxShadow: '0 12px 28px rgba(5, 2, 18, 0.65), 0 0 20px rgba(245, 158, 11, 0.2), inset 0 0 18px rgba(254, 215, 170, 0.25)',
    border: '1.5px solid rgba(251, 191, 36, 0.55)',
    transition: 'transform 180ms ease, box-shadow 220ms ease, filter 220ms ease, border-color 220ms ease',
  },
  leftLogoAuraHover: {
    transform: 'scale(1.035)',
    filter: 'brightness(1.06)',
    boxShadow: '0 16px 32px rgba(5, 2, 18, 0.75), 0 0 28px rgba(249, 115, 22, 0.45), inset 0 0 24px rgba(254, 215, 170, 0.45)',
    border: '1.5px solid rgba(251, 146, 60, 0.85)',
  },
  microscopeImage: {
    width: '166px',
    height: '166px',
    objectFit: 'contain',
    objectPosition: 'center center',
    filter: 'drop-shadow(0 12px 20px rgba(5, 2, 18, 0.65)) drop-shadow(0 0 10px rgba(251, 191, 36, 0.3))',
  },
  centerArea: {
    width: '100%',
    maxWidth: 'none',
    margin: '0 auto',
    padding: '20px clamp(18px, 3.2vw, 44px) 16px',
    textAlign: 'center',
    position: 'relative',
  },
  title: {
    margin: 0,
    fontSize: 'clamp(46px, 4.6vw, 70px)',
    lineHeight: 1.2,
    letterSpacing: '0.5px',
    fontWeight: 700,
    fontFamily: '"Playfair Display", "Times New Roman", serif',
    whiteSpace: 'nowrap',
    position: 'relative',
    zIndex: 3,
    overflow: 'visible',
  },
  subtitle: {
    margin: '9px 0 0 0',
    fontSize: 'clamp(18px, 1.45vw, 25px)',
    lineHeight: 1.2,
    fontWeight: 600,
    color: '#f8fafc',
    fontFamily: '"Montserrat", "Segoe UI", sans-serif',
    whiteSpace: 'nowrap',
    position: 'relative',
    zIndex: 3,
  },
  separator: {
    width: '100%',
    maxWidth: '640px',
    margin: '7px auto 6px auto',
    position: 'relative',
    zIndex: 3,
  },
  subtitle2: {
    margin: 0,
    fontSize: 'clamp(16px, 1.25vw, 22px)',
    lineHeight: 1.25,
    fontWeight: 550,
    color: '#e9d5ff',
    fontFamily: '"Montserrat", "Segoe UI", sans-serif',
    whiteSpace: 'nowrap',
    position: 'relative',
    zIndex: 3,
  },
  rightArea: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  universityLogo: {
    width: '166px',
    height: '166px',
    objectFit: 'contain',
    objectPosition: 'center center',
    borderRadius: '50%',
    boxShadow: '0 10px 22px rgba(5, 2, 18, 0.65)',
    filter: 'drop-shadow(0 12px 20px rgba(5, 2, 18, 0.65)) drop-shadow(0 0 10px rgba(251, 191, 36, 0.3))',
  },
  rightLogoAura: {
    width: '180px',
    height: '180px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background:
      'radial-gradient(circle at 35% 32%, rgba(254, 243, 199, 0.38) 0%, rgba(147, 51, 234, 0.26) 48%, rgba(26, 10, 56, 0.85) 100%)',
    boxShadow: '0 12px 28px rgba(5, 2, 18, 0.65), 0 0 20px rgba(245, 158, 11, 0.2), inset 0 0 18px rgba(254, 215, 170, 0.25)',
    border: '1.5px solid rgba(251, 191, 36, 0.55)',
    transition: 'transform 180ms ease, box-shadow 220ms ease, filter 220ms ease, border-color 220ms ease',
  },
  rightLogoAuraHover: {
    transform: 'scale(1.035)',
    filter: 'brightness(1.06)',
    boxShadow: '0 16px 32px rgba(5, 2, 18, 0.75), 0 0 28px rgba(249, 115, 22, 0.45), inset 0 0 24px rgba(254, 215, 170, 0.45)',
    border: '1.5px solid rgba(251, 146, 60, 0.85)',
  },
  lockedActionButton: {
    opacity: 0.55,
    cursor: 'not-allowed',
    pointerEvents: 'none',
  },
  searchPanel: {
    width: '100%',
    padding: '12px 20px',
    background: 'linear-gradient(180deg, rgba(26, 12, 54, 0.98) 0%, rgba(18, 8, 38, 0.98) 100%)',
    borderTop: '1px solid rgba(251, 146, 60, 0.35)',
    borderBottom: '1px solid rgba(251, 146, 60, 0.35)',
    boxShadow: 'inset 0 1px 0 rgba(251, 191, 36, 0.2)',
  },
  searchPanelInner: {
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'stretch',
    gap: 0,
    maxWidth: '1600px',
    margin: '0 auto',
  },
  searchFieldShell: {
    position: 'relative',
    width: '100%',
    maxWidth: '1120px',
  },
  searchFieldRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    height: '40px',
    borderRadius: '999px',
    border: '1.5px solid rgba(251, 146, 60, 0.55)',
    background: 'rgba(38, 16, 75, 0.88)',
    color: '#f8fafc',
    fontSize: '15px',
    fontFamily: '"Montserrat", "Segoe UI", sans-serif',
    padding: '0 14px',
    outline: 'none',
  },
  searchCloseButton: {
    width: '40px',
    height: '40px',
    borderRadius: '999px',
    border: '1px solid rgba(155, 194, 227, 0.9)',
    background: '#ffffff',
    color: '#143768',
    fontSize: '24px',
    lineHeight: 1,
    cursor: 'pointer',
  },
  searchSuggestions: {
    position: 'fixed',
    zIndex: 2600,
    maxHeight: 'min(48vh, 360px)',
    overflowY: 'auto',
    padding: '8px',
    borderRadius: '18px',
    border: '1px solid rgba(183, 212, 238, 0.95)',
    background: 'rgba(255,255,255,0.99)',
    boxShadow: '0 18px 36px rgba(12, 47, 93, 0.18)',
    backdropFilter: 'blur(10px)',
  },
  searchSuggestionItem: {
    width: '100%',
    border: 'none',
    background: 'transparent',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    padding: '10px 12px',
    borderRadius: '14px',
    textAlign: 'left',
    cursor: 'pointer',
  },
  searchSuggestionBadge: {
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '78px',
    padding: '4px 10px',
    borderRadius: '999px',
    background: 'linear-gradient(180deg, #eaf4ff 0%, #d7eaff 100%)',
    color: '#194274',
    fontSize: '12px',
    fontWeight: 700,
    letterSpacing: '0.2px',
    textTransform: 'uppercase',
  },
  searchSuggestionContent: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    flex: 1,
  },
  searchSuggestionTitle: {
    color: '#0c2346',
    fontSize: '15px',
    lineHeight: 1.2,
    fontWeight: 700,
    wordBreak: 'break-word',
  },
  searchEmptyState: {
    padding: '10px 12px',
    color: '#5c7596',
    fontSize: '14px',
    lineHeight: 1.35,
  },
  bottomNav: {
    background: 'linear-gradient(180deg, rgba(252,254,255,.98), rgba(248,245,255,.98))',
    borderTop: '1px solid rgba(251, 146, 60, 0.35)',
    borderBottom: '3px solid #ea580c',
    padding: '6px 12px 7px',
    width: '100%',
    boxSizing: 'border-box',
  },
  navList: {
    listStyle: 'none',
    margin: '0 auto',
    padding: 0,
    display: 'grid',
    gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
    gap: '8px',
    width: '100%',
    maxWidth: '1600px',
    boxSizing: 'border-box',
  },
  navItem: {
    margin: 0,
    padding: 0,
    width: '100%',
    minWidth: 0,
    display: 'flex',
  },
  navButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    border: '1px solid rgba(194, 224, 247, 0.75)',
    borderRadius: '8px',
    background: 'rgba(255, 255, 255, 0.7)',
    cursor: 'pointer',
    color: '#1a315e',
    textTransform: 'none',
    fontSize: '14.5px',
    letterSpacing: '0.01em',
    fontWeight: 650,
    fontFamily: '"Montserrat", "Segoe UI", sans-serif',
    padding: '8px 6px',
    width: '100%',
    minHeight: '44px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    boxSizing: 'border-box',
    transition: 'all 0.2s ease',
  },
  compactBar: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    zIndex: 1300,
    minHeight: '52px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 12px',
    background:
      'linear-gradient(180deg, rgba(252, 254, 255, 0.94) 0%, rgba(239, 248, 255, 0.88) 100%)',
    backdropFilter: 'blur(12px)',
    borderBottom: '3px solid #8ec8ff',
    borderLeft: '1px solid rgba(184, 216, 241, 0.42)',
    borderRight: '1px solid rgba(184, 216, 241, 0.42)',
    borderRadius: 0,
    boxShadow: '0 7px 16px rgba(29, 84, 135, 0.14)',
    transition: 'opacity 220ms ease, transform 220ms ease, visibility 220ms ease',
  },
  compactBarVisible: {
    opacity: 1,
    transform: 'translateY(0)',
    visibility: 'visible',
    pointerEvents: 'auto',
  },
  compactBarHidden: {
    opacity: 0,
    transform: 'translateY(-14px)',
    visibility: 'hidden',
    pointerEvents: 'none',
  },
  compactBrandButton: {
    border: 'none',
    background: 'transparent',
    color: '#173564',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '7px',
    cursor: 'pointer',
    padding: 0,
    margin: 0,
    flexShrink: 0,
    transition: 'transform 180ms ease, filter 180ms ease',
  },
  compactLogoAura: {
    width: '38px',
    height: '38px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background:
      'radial-gradient(circle at 35% 30%, rgba(235, 248, 255, 0.84) 0%, rgba(114, 166, 218, 0.54) 52%, rgba(32, 79, 145, 0.44) 100%)',
    border: '1px solid rgba(214, 235, 254, 0.72)',
    boxShadow: '0 6px 12px rgba(4, 23, 64, 0.35)',
  },
  compactLogo: {
    width: '31px',
    height: '31px',
    objectFit: 'contain',
    objectPosition: 'center center',
  },
  compactBrandText: {
    color: '#143768',
    fontWeight: 700,
    fontSize: '19px',
    letterSpacing: '0.2px',
    fontFamily: '"Playfair Display", "Times New Roman", serif',
    textShadow: '0 1px 5px rgba(152, 198, 232, 0.45)',
  },
  compactDivider: {
    width: '1px',
    height: '26px',
    background: 'linear-gradient(180deg, rgba(141, 186, 220, 0.15) 0%, rgba(121, 171, 210, 0.7) 50%, rgba(141, 186, 220, 0.15) 100%)',
    flexShrink: 0,
  },
  compactNavScroller: {
    flex: 1,
    minWidth: 0,
    width: '100%',
    overflowX: 'auto',
    overflowY: 'hidden',
    scrollbarWidth: 'none',
  },
  compactNavList: {
    listStyle: 'none',
    margin: 0,
    padding: '0 4px',
    display: 'grid',
    gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
    gap: '6px',
    width: '100%',
    boxSizing: 'border-box',
  },
  compactNavItem: {
    margin: 0,
    padding: 0,
    width: '100%',
    minWidth: 0,
    display: 'flex',
  },
  compactNavButton: {
    border: '1px solid rgba(194, 224, 247, 0.75)',
    borderRadius: '6px',
    background: 'rgba(255, 255, 255, 0.65)',
    color: '#1a315e',
    padding: '5px 6px',
    fontSize: '13px',
    fontWeight: 650,
    letterSpacing: '0.01em',
    textTransform: 'none',
    fontFamily: '"Montserrat", "Segoe UI", sans-serif',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    width: '100%',
    minHeight: '38px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    boxSizing: 'border-box',
    transition: 'all 0.2s ease',
  },
};

export default Header;
