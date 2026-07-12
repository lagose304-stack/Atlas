import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BookOpen, ClipboardList, House, Search } from 'lucide-react';
import { IMAGE_VIEWER_VISIBILITY_EVENT, ImageViewerVisibilityDetail } from '../constants/uiEvents';
import { supabase } from '../services/supabase';

import logoFacultad from '../assets/logos/facultad.png';
import microscopioHeader from '../assets/logos/laboratorio.png';
import fondoHeader from '../assets/imagenes/fondo.webp';

const MENU_ITEMS = [
  { key: 'inicio', label: 'Inicio', icon: House, path: '/' },
  { key: 'temario', label: 'Temario', icon: BookOpen, path: '/temario' },
  { key: 'evaluaciones', label: 'Evaluaciones', icon: ClipboardList, path: '/evaluaciones' },
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

const getThemeNameFromRelation = (relation: unknown): string => {
  if (!relation) return '';
  if (Array.isArray(relation)) {
    const firstItem = relation[0] as { nombre?: string } | undefined;
    return firstItem?.nombre?.trim() ?? '';
  }

  if (typeof relation === 'object') {
    const maybeRelation = relation as { nombre?: string };
    return maybeRelation.nombre?.trim() ?? '';
  }

  return '';
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
  const [searchSuggestionsFrame, setSearchSuggestionsFrame] = React.useState<{ top: number; left: number; width: number } | null>(null);
  const isImageViewerOpen = openImageViewerCount > 0;
  const isHeaderLocked = disableInteractions;
  const isMenuItemActive = React.useCallback((key: typeof MENU_ITEMS[number]['key']) => {
    if (key === 'inicio') return pathname === '/';
    if (key === 'temario') {
      return pathname === '/temario' || pathname.startsWith('/subtemas/') || pathname.startsWith('/ver-placas/');
    }
    return pathname === '/evaluaciones' || pathname.startsWith('/evaluaciones/');
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

    if (isInAdminEditingFlow) {
      window.location.replace(targetPath);
      return;
    }

    navigate(targetPath);
  }, [isHeaderLocked, isInAdminEditingFlow, navigate]);

  React.useEffect(() => {
    const handleScroll = () => {
      if (!headerRef.current) {
        setShowCompactBar(false);
        return;
      }

      const rect = headerRef.current.getBoundingClientRect();
      setShowCompactBar(rect.bottom <= 0);

      const nextLeft = Math.max(0, Math.round(rect.left));
      const nextRight = Math.min(window.innerWidth, Math.round(rect.right));
      const nextWidth = Math.max(0, nextRight - nextLeft);

      setCompactBarFrame((prev) => (
        prev.left === nextLeft && prev.width === nextWidth
          ? prev
          : { left: nextLeft, width: nextWidth }
      ));
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);

    return () => {
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

    const syncSearchFrame = () => {
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
    };

    syncSearchFrame();
    window.addEventListener('resize', syncSearchFrame);
    window.addEventListener('scroll', syncSearchFrame, { passive: true, capture: true });

    return () => {
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

      const [temasResult, subtemasResult] = await Promise.all([
        supabase.from('temas').select('id, nombre').order('sort_order', { ascending: true }),
        supabase.from('subtemas').select('id, nombre, tema_id, temas(nombre)').order('sort_order', { ascending: true }),
      ]);

      if (!temasResult.error) {
        setSearchTemas((temasResult.data ?? []) as SearchTemaRecord[]);
      }

      if (!subtemasResult.error) {
        const nextSubtemas = (subtemasResult.data ?? []).map((row) => ({
          id: row.id,
          nombre: row.nombre,
          tema_id: row.tema_id,
          tema_nombre: getThemeNameFromRelation((row as { temas?: unknown }).temas),
        }));
        setSearchSubtemas(nextSubtemas);
      }

      setSearchIndexLoaded(true);
      setSearchIndexLoading(false);
    };

    void loadSearchIndex();
  }, [searchIndexLoaded, searchIndexLoading, showSearchBar]);

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
            backgroundImage: `linear-gradient(105deg, rgba(6,33,86,.88), rgba(31,91,151,.48) 25%, rgba(224,242,254,.68) 50%, rgba(125,190,232,.48) 72%, rgba(10,52,112,.7)), url(${fondoHeader})`,
          }}
        >
          <div className="atlas-header-glass" style={styles.heroGlass} />
          <div className="atlas-header-readable-overlay" style={styles.heroReadableOverlay} />
          <div className="atlas-header-right-side-panel" style={styles.rightSidePanel} />

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
              <h1 className="atlas-header-title" style={styles.title}>Atlas de Histología</h1>
              <p className="atlas-header-subtitle" style={styles.subtitle}>Laboratorio de Histología - Dr. Rafael Perdomo Vaquero</p>
              <div className="atlas-header-separator" style={styles.separator} />
              <p className="atlas-header-subtitle2" style={styles.subtitle2}>Facultad de Ciencias Médicas - UNAH</p>
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

              <button
                type="button"
                className="atlas-header-search-button"
                style={{ ...styles.searchButton, ...(isHeaderLocked ? styles.lockedActionButton : {}) }}
                disabled={isHeaderLocked}
                onClick={() => setShowSearchBar((prev) => !prev)}
                aria-label="Buscar"
                aria-expanded={showSearchBar}
                aria-controls="atlas-header-search-panel"
              >
                <Search size={24} color="#e6f5ff" strokeWidth={2.2} />
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

        <nav className="atlas-header-bottom-nav" style={styles.bottomNav} aria-label="Menú principal">
          <ul className="atlas-header-nav-list" style={styles.navList}>
            {MENU_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <li className="atlas-header-nav-item" key={item.key} style={styles.navItem}>
                  <button
                    type="button"
                    className={`atlas-header-nav-button${isMenuItemActive(item.key) ? ' is-active' : ''}`}
                    style={{ ...styles.navButton, ...(isHeaderLocked ? styles.lockedActionButton : {}) }}
                    disabled={isHeaderLocked}
                    aria-current={isMenuItemActive(item.key) ? 'page' : undefined}
                    onClick={() => {
                      if ('path' in item && item.path) navigateFromHeader(item.path);
                    }}
                  >
                    <Icon size={15} />
                    <span>{item.label}</span>
                  </button>
                </li>
              );
            })}
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
              return (
              <li className="atlas-compact-nav-item" key={`compact-${item.key}`} style={styles.compactNavItem}>
                <button
                  type="button"
                  className={`atlas-compact-nav-button${isMenuItemActive(item.key) ? ' is-active' : ''}`}
                  style={{ ...styles.compactNavButton, ...(isHeaderLocked ? styles.lockedActionButton : {}) }}
                  disabled={isHeaderLocked}
                  aria-current={isMenuItemActive(item.key) ? 'page' : undefined}
                  onClick={() => {
                    if ('path' in item && item.path) navigateFromHeader(item.path);
                  }}
                >
                  <Icon className="atlas-compact-nav-icon" size={15} />
                  {item.label}
                </button>
              </li>
            );})}
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
    boxShadow: '0 16px 42px rgba(8, 33, 75, 0.22)',
    borderRadius: '22px 22px 0 0',
    overflow: 'hidden',
    border: '1px solid rgba(186, 225, 249, 0.92)',
    backgroundColor: '#f4f7fb',
  },
  hero: {
    position: 'relative',
    minHeight: '228px',
    display: 'flex',
    alignItems: 'center',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    width: '100%',
    borderBottom: '1px solid rgba(174, 216, 255, 0.82)',
  },
  heroGlass: {
    position: 'absolute',
    inset: '11px',
    borderRadius: '17px',
    border: '1px solid rgba(210, 239, 255, 0.85)',
    boxShadow: 'inset 0 0 55px rgba(255,255,255,.25), 0 0 0 1px rgba(13,73,126,.08)',
    pointerEvents: 'none',
  },
  heroReadableOverlay: {
    position: 'absolute',
    inset: 0,
    background:
      'radial-gradient(circle at 50% 48%, rgba(241, 250, 255, 0.52) 0%, rgba(219, 237, 252, 0.16) 36%, rgba(11, 36, 86, 0.01) 64%), linear-gradient(90deg, rgba(7, 28, 78, 0.2) 0%, rgba(7, 28, 78, 0) 18%, rgba(7, 28, 78, 0) 82%, rgba(7, 28, 78, 0.2) 100%)',
    backdropFilter: 'blur(0.9px)',
    pointerEvents: 'none',
  },
  heroMainRow: {
    position: 'relative',
    zIndex: 1,
    width: '100%',
    minHeight: '212px',
    display: 'grid',
    gridTemplateColumns: '216px 1fr 184px',
    alignItems: 'center',
    gap: '12px',
    padding: '0 0 0 16px',
  },
  rightSidePanel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: '184px',
    background:
      'linear-gradient(180deg, rgba(209, 231, 255, 0.38) 0%, rgba(177, 209, 246, 0.34) 100%)',
    backdropFilter: 'blur(7px)',
    borderLeft: '1px solid rgba(193, 226, 255, 0.64)',
    boxShadow: 'inset 0 0 18px rgba(236, 246, 255, 0.26)',
    pointerEvents: 'none',
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
      'radial-gradient(circle at 32% 30%, rgba(233, 246, 255, 0.72) 0%, rgba(131, 183, 233, 0.48) 48%, rgba(31, 83, 151, 0.4) 100%)',
    boxShadow: '0 10px 24px rgba(5, 30, 80, 0.34), inset 0 0 18px rgba(226, 243, 255, 0.4)',
    border: '1px solid rgba(201, 228, 252, 0.78)',
    transition: 'transform 180ms ease, box-shadow 220ms ease, filter 220ms ease',
  },
  leftLogoAuraHover: {
    transform: 'scale(1.035)',
    filter: 'brightness(1.045)',
    boxShadow: '0 14px 28px rgba(5, 30, 80, 0.4), inset 0 0 20px rgba(236, 247, 255, 0.52)',
  },
  microscopeImage: {
    width: '166px',
    height: '166px',
    objectFit: 'contain',
    objectPosition: 'center center',
    filter: 'drop-shadow(0 12px 20px rgba(7, 38, 83, 0.42))',
  },
  centerArea: {
    width: '100%',
    maxWidth: 'none',
    margin: '0 auto',
    padding: '4px 10px 5px 10px',
    textAlign: 'center',
    color: '#081a42',
  },
  title: {
    margin: 0,
    fontSize: 'clamp(48px, 4.8vw, 72px)',
    lineHeight: 1,
    letterSpacing: '0.5px',
    fontWeight: 700,
    color: '#081d4a',
    fontFamily: '"Playfair Display", "Times New Roman", serif',
    textShadow:
      '0 0 1px rgba(245, 247, 250, 0.95), 0 0 4px rgba(232, 236, 243, 0.9), 0 0 10px rgba(216, 223, 234, 0.68), 0 0 18px rgba(196, 205, 220, 0.44), 0 0 30px rgba(184, 194, 211, 0.28), 0 0 44px rgba(176, 187, 205, 0.16)',
    whiteSpace: 'nowrap',
  },
  subtitle: {
    margin: '8px 0 0 0',
    fontSize: 'clamp(20px, 1.55vw, 28px)',
    lineHeight: 1.15,
    fontWeight: 500,
    color: '#0b214c',
    fontFamily: '"Montserrat", "Segoe UI", sans-serif',
    textShadow:
      '0 0 1px rgba(242, 246, 252, 0.9), 0 0 4px rgba(228, 234, 244, 0.78), 0 0 10px rgba(210, 219, 232, 0.52), 0 0 18px rgba(194, 205, 222, 0.3), 0 0 30px rgba(184, 196, 214, 0.18)',
    whiteSpace: 'nowrap',
  },
  separator: {
    width: '100%',
    maxWidth: '760px',
    height: '1px',
    margin: '8px auto 7px auto',
    background: 'linear-gradient(90deg, transparent, rgba(31, 72, 134, 0.45), transparent)',
  },
  subtitle2: {
    margin: 0,
    fontSize: 'clamp(18px, 1.35vw, 24px)',
    lineHeight: 1.25,
    fontWeight: 500,
    color: '#0e2a57',
    fontFamily: '"Montserrat", "Segoe UI", sans-serif',
    textShadow:
      '0 0 1px rgba(242, 246, 252, 0.88), 0 0 4px rgba(227, 233, 243, 0.74), 0 0 9px rgba(209, 218, 231, 0.48), 0 0 16px rgba(193, 204, 221, 0.28), 0 0 26px rgba(183, 195, 213, 0.16)',
    whiteSpace: 'nowrap',
  },
  rightArea: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    gap: '12px',
    background: 'transparent',
    borderRadius: 0,
    border: 'none',
    boxShadow: 'none',
    paddingRight: 0,
    paddingLeft: 0,
    paddingTop: '8px',
    paddingBottom: '8px',
  },
  universityLogo: {
    width: '104px',
    height: '104px',
    objectFit: 'contain',
    objectPosition: 'center center',
    borderRadius: '50%',
    boxShadow: '0 7px 16px rgba(8, 24, 58, 0.35)',
  },
  rightLogoAura: {
    width: '122px',
    height: '122px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background:
      'radial-gradient(circle at 32% 30%, rgba(231, 245, 255, 0.64) 0%, rgba(137, 185, 233, 0.4) 52%, rgba(34, 88, 156, 0.34) 100%)',
    boxShadow: '0 8px 18px rgba(8, 36, 86, 0.34), inset 0 0 14px rgba(229, 244, 255, 0.3)',
    border: '1px solid rgba(201, 228, 252, 0.74)',
    transition: 'transform 180ms ease, box-shadow 220ms ease, filter 220ms ease',
  },
  rightLogoAuraHover: {
    transform: 'scale(1.04)',
    filter: 'brightness(1.05)',
    boxShadow: '0 12px 24px rgba(8, 36, 86, 0.4), inset 0 0 16px rgba(236, 247, 255, 0.48)',
  },
  searchButton: {
    width: '54px',
    height: '40px',
    borderRadius: '999px',
    border: '1px solid rgba(220, 239, 255, 0.95)',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.28) 0%, rgba(220,236,255,0.12) 100%)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backdropFilter: 'blur(2px)',
  },
  lockedActionButton: {
    opacity: 0.55,
    cursor: 'not-allowed',
    pointerEvents: 'none',
  },
  searchPanel: {
    width: '100%',
    padding: '12px 20px',
    background: 'linear-gradient(180deg, rgba(243, 249, 255, 0.98) 0%, rgba(232, 243, 253, 0.98) 100%)',
    borderTop: '1px solid rgba(211, 232, 250, 0.9)',
    borderBottom: '1px solid rgba(211, 232, 250, 0.9)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.75)',
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
    border: '1px solid rgba(155, 194, 227, 0.9)',
    background: 'rgba(255,255,255,0.98)',
    color: '#0b214c',
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
    background: 'linear-gradient(180deg, rgba(252,254,255,.98), rgba(235,246,253,.98))',
    borderTop: '1px solid rgba(211, 232, 250, 0.85)',
    borderBottom: '3px solid #7dd3fc',
    padding: '9px clamp(12px,2vw,24px)',
  },
  navList: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    width: '100%',
    flexWrap: 'nowrap',
  },
  navItem: {
    margin: 0,
    padding: 0,
    flex: '1 1 0',
    minWidth: 0,
  },
  navButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '7px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    color: '#1a315e',
    textTransform: 'uppercase',
    fontSize: '16px',
    letterSpacing: '0.3px',
    fontWeight: 500,
    fontFamily: '"Montserrat", "Segoe UI", sans-serif',
    padding: '4px 1px',
    width: '100%',
    whiteSpace: 'nowrap',
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
    overflowX: 'hidden',
    overflowY: 'hidden',
  },
  compactNavList: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    gap: '8px',
    width: '100%',
    minWidth: 0,
    whiteSpace: 'nowrap',
  },
  compactNavItem: {
    margin: 0,
    padding: 0,
    flex: 1,
    minWidth: 0,
  },
  compactNavButton: {
    border: 'none',
    background: 'transparent',
    color: '#1a315e',
    borderRadius: 0,
    padding: '4px 1px',
    fontSize: '15px',
    fontWeight: 400,
    letterSpacing: '0.3px',
    textTransform: 'uppercase',
    fontFamily: '"Montserrat", "Segoe UI", sans-serif',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    width: '100%',
    transition: 'color 160ms ease, transform 160ms ease, text-shadow 180ms ease',
  },
};

export default Header;
