import React, { useMemo, useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Layers, Check, Search, X, RefreshCw, FolderTree, Sparkles } from 'lucide-react';
import { getCloudinaryImageUrl } from '../../services/cloudinaryImages';

export interface EditorTema {
  id: number;
  nombre: string;
  parcial?: string | null;
  sort_order?: number | null;
  logo_url?: string | null;
}

export interface EditorSubtema {
  id: number;
  nombre: string;
  tema_id: number;
  sort_order?: number | null;
  logo_url?: string | null;
}

export type ParcialKey = 'primer' | 'segundo' | 'tercer';

export interface ParcialConfig {
  key: ParcialKey;
  label: string;
  shortLabel: string;
  number: number;
  accent: string;
  gradient: string;
  glow: string;
  soft: string;
  border: string;
  badgeBg: string;
}

export const PARCIALES_CONFIG: ParcialConfig[] = [
  {
    key: 'primer',
    label: 'Primer Parcial',
    shortLabel: '1er Parcial',
    number: 1,
    accent: '#0284c7',
    gradient: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
    glow: 'rgba(2, 132, 199, 0.18)',
    soft: '#f0f9ff',
    border: '#bae6fd',
    badgeBg: 'linear-gradient(135deg, #0284c7, #0ea5e9)',
  },
  {
    key: 'segundo',
    label: 'Segundo Parcial',
    shortLabel: '2do Parcial',
    number: 2,
    accent: '#4f46e5',
    gradient: 'linear-gradient(135deg, #4f46e5 0%, #818cf8 100%)',
    glow: 'rgba(79, 70, 229, 0.18)',
    soft: '#eef2ff',
    border: '#c7d2fe',
    badgeBg: 'linear-gradient(135deg, #4f46e5, #6366f1)',
  },
  {
    key: 'tercer',
    label: 'Tercer Parcial',
    shortLabel: '3er Parcial',
    number: 3,
    accent: '#7c3aed',
    gradient: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
    glow: 'rgba(124, 58, 237, 0.18)',
    soft: '#f5f3ff',
    border: '#ddd6fe',
    badgeBg: 'linear-gradient(135deg, #7c3aed, #8b5cf6)',
  },
];

export interface EditorParcialAccordionPickerProps {
  temas: EditorTema[];
  subtemas?: EditorSubtema[];
  selectedTemaId: number | null;
  selectedSubtemaId?: number | null;
  onSelectTema: (temaId: number) => void;
  onSelectSubtema?: (subtemaId: number) => void;
  loadingTemas?: boolean;
  loadingSubtemas?: boolean;
  temasError?: string | null;
  subtemasError?: string | null;
  mode?: 'tema-only' | 'tema-and-subtema';
  title?: string;
  subtitle?: string;
  showSearch?: boolean;
}

export const EditorParcialAccordionPicker: React.FC<EditorParcialAccordionPickerProps> = ({
  temas,
  subtemas = [],
  selectedTemaId,
  selectedSubtemaId = null,
  onSelectTema,
  onSelectSubtema,
  loadingTemas = false,
  loadingSubtemas = false,
  temasError = null,
  subtemasError = null,
  mode = 'tema-only',
  title = 'Selecciona un tema',
  subtitle = 'Explora los temas organizados por parcial académico',
  showSearch = true,
}) => {
  const [search, setSearch] = useState('');
  const [isTemasPickerExpanded, setIsTemasPickerExpanded] = useState(!selectedTemaId);
  const [activeParcialFilter, setActiveParcialFilter] = useState<ParcialKey | 'all'>('all');

  const numSelectedTemaId = selectedTemaId !== null && selectedTemaId !== undefined ? Number(selectedTemaId) : null;
  const numSelectedSubtemaId = selectedSubtemaId !== null && selectedSubtemaId !== undefined ? Number(selectedSubtemaId) : null;

  const selectedTema = useMemo(() => temas.find((t) => Number(t.id) === numSelectedTemaId) ?? null, [numSelectedTemaId, temas]);

  useEffect(() => {
    if (!numSelectedTemaId) {
      setIsTemasPickerExpanded(true);
    }
  }, [numSelectedTemaId]);

  const selectedParcialConfig = useMemo(() => {
    if (!selectedTema?.parcial) return PARCIALES_CONFIG[0];
    const pKey = selectedTema.parcial.toLowerCase().trim() as ParcialKey;
    return PARCIALES_CONFIG.find((p) => p.key === pKey) || PARCIALES_CONFIG[0];
  }, [selectedTema]);

  const [openParciales, setOpenParciales] = useState<Record<ParcialKey, boolean>>(() => {
    if (selectedTema?.parcial) {
      const pKey = selectedTema.parcial.toLowerCase().trim() as ParcialKey;
      return { primer: pKey === 'primer', segundo: pKey === 'segundo', tercer: pKey === 'tercer' };
    }
    return { primer: true, segundo: false, tercer: false };
  });

  // Agrupación y ordenamiento estricto
  const temasByParcial = useMemo(() => {
    const map: Record<ParcialKey, EditorTema[]> = { primer: [], segundo: [], tercer: [] };
    const query = search.trim().toLowerCase();

    temas.forEach((tema) => {
      const pKey = (tema.parcial?.toLowerCase().trim() as ParcialKey) || 'primer';
      if (map[pKey]) {
        if (!query || tema.nombre.toLowerCase().includes(query)) {
          map[pKey].push(tema);
        }
      }
    });

    Object.keys(map).forEach((k) => {
      map[k as ParcialKey].sort((a, b) => (a.sort_order ?? a.id) - (b.sort_order ?? b.id));
    });

    return map;
  }, [temas, search]);

  const relevantSubtemas = useMemo(() => {
    if (!numSelectedTemaId) return [];
    return subtemas
      .filter((st) => Number(st.tema_id) === numSelectedTemaId)
      .sort((a, b) => (a.sort_order ?? a.id) - (b.sort_order ?? b.id));
  }, [numSelectedTemaId, subtemas]);

  const toggleParcial = (key: ParcialKey) => {
    setOpenParciales((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleTemaClick = (temaId: number) => {
    onSelectTema(temaId);
    if (mode === 'tema-and-subtema') {
      setIsTemasPickerExpanded(false);
    }
  };

  return (
    <div className="editor-parcial-picker-root" style={s.container}>
      {/* Inyección de micro-animaciones y efectos hover */}
      <style>{`
        .picker-card-hover {
          transition: all 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .picker-card-hover:hover {
          transform: translateY(-3px) scale(1.015);
          box-shadow: 0 12px 24px -4px rgba(15, 23, 42, 0.12), 0 4px 10px -2px rgba(15, 23, 42, 0.06) !important;
          border-color: #94a3b8 !important;
        }
        .subtema-card-hover {
          transition: all 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .subtema-card-hover:hover {
          transform: translateY(-3px) scale(1.015);
          box-shadow: 0 14px 28px -4px rgba(139, 92, 246, 0.22), 0 6px 12px -2px rgba(139, 92, 246, 0.1) !important;
          border-color: #a855f7 !important;
        }
        .pulse-dot {
          animation: pulseGlow 2s infinite ease-in-out;
        }
        @keyframes pulseGlow {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.3); opacity: 0.7; }
        }
        .filter-chip-hover:hover {
          background: #f1f5f9 !important;
        }
      `}</style>

      {/* ── BANNER HERO: TEMA ACTIVO (COMPACTO Y ELEGANTE) ── */}
      {selectedTema && !isTemasPickerExpanded && (
        <div
          style={{
            ...s.heroBanner,
            border: `1.5px solid ${selectedParcialConfig.border}`,
            background: `linear-gradient(135deg, ${selectedParcialConfig.soft} 0%, #ffffff 70%)`,
            boxShadow: `0 8px 24px -6px ${selectedParcialConfig.glow}, 0 2px 8px rgba(0,0,0,0.04)`,
          }}
        >
          <div style={s.heroLeft}>
            <div style={s.heroBadgeWrap}>
              <span
                style={{
                  ...s.heroParcialBadge,
                  background: selectedParcialConfig.badgeBg,
                }}
              >
                {selectedParcialConfig.shortLabel}
              </span>
            </div>

            {selectedTema.logo_url ? (
              <div style={s.heroLogoFrame}>
                <img
                  src={getCloudinaryImageUrl(selectedTema.logo_url, 'thumb')}
                  alt={selectedTema.nombre}
                  style={s.heroLogo}
                />
              </div>
            ) : (
              <div style={{ ...s.heroLogoPlaceholder, background: selectedParcialConfig.soft, borderColor: selectedParcialConfig.border }}>
                <Layers size={18} color={selectedParcialConfig.accent} />
              </div>
            )}

            <div style={s.heroTextCol}>
              <div style={s.heroStatusRow}>
                <span className="pulse-dot" style={{ ...s.liveDot, background: selectedParcialConfig.accent }} />
                <span style={{ ...s.heroCategory, color: selectedParcialConfig.accent }}>Tema seleccionado</span>
              </div>
              <h3 style={s.heroTemaTitle}>{selectedTema.nombre}</h3>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsTemasPickerExpanded(true)}
            style={{
              ...s.heroChangeBtn,
              background: '#ffffff',
              border: `1.5px solid ${selectedParcialConfig.accent}`,
              color: selectedParcialConfig.accent,
            }}
            title="Abrir selector para elegir otro tema"
          >
            <RefreshCw size={14} style={{ marginRight: '6px' }} />
            <span>Cambiar tema</span>
            <ChevronDown size={15} style={{ marginLeft: '4px' }} />
          </button>
        </div>
      )}

      {/* ── PANEL COMPLETO DE SELECCIÓN DE TEMAS ── */}
      {isTemasPickerExpanded && (
        <div style={s.pickerBox}>
          {/* Header con título y búsqueda */}
          <div style={s.header}>
            <div style={s.headerLeft}>
              <div style={s.iconBadge}>
                <Layers size={20} color="#0284c7" />
              </div>
              <div>
                <h3 style={s.headerTitle}>{title}</h3>
                <p style={s.headerSubtitle}>{subtitle}</p>
              </div>
            </div>

            <div style={s.headerRight}>
              {showSearch && (
                <div style={s.searchContainer}>
                  <Search size={15} color="#64748b" style={s.searchIcon} />
                  <input
                    type="text"
                    placeholder="Buscar tema por nombre..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={s.searchInput}
                  />
                  {search && (
                    <button type="button" onClick={() => setSearch('')} style={s.searchClear} title="Limpiar">
                      <X size={13} />
                    </button>
                  )}
                </div>
              )}

              {selectedTema && mode === 'tema-and-subtema' && (
                <button
                  type="button"
                  onClick={() => setIsTemasPickerExpanded(false)}
                  style={s.closePickerBtn}
                  title="Volver a los subtemas"
                >
                  Ocultar temas ✕
                </button>
              )}
            </div>
          </div>

          {/* Filtros rápidos por parcial */}
          <div style={s.filterBar}>
            <span style={s.filterLabel}>Filtrar:</span>
            <button
              type="button"
              className="filter-chip-hover"
              onClick={() => {
                setActiveParcialFilter('all');
                setOpenParciales({ primer: true, segundo: true, tercer: true });
              }}
              style={{
                ...s.filterChip,
                ...(activeParcialFilter === 'all' ? s.filterChipActive : {}),
              }}
            >
              Todos los parciales
            </button>
            {PARCIALES_CONFIG.map((p) => {
              const isActive = activeParcialFilter === p.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  className="filter-chip-hover"
                  onClick={() => {
                    setActiveParcialFilter(p.key);
                    setOpenParciales({
                      primer: p.key === 'primer',
                      segundo: p.key === 'segundo',
                      tercer: p.key === 'tercer',
                    });
                  }}
                  style={{
                    ...s.filterChip,
                    borderColor: isActive ? p.accent : '#e2e8f0',
                    background: isActive ? p.soft : '#ffffff',
                    color: isActive ? p.accent : '#475569',
                    fontWeight: isActive ? 700 : 500,
                  }}
                >
                  <span style={{ ...s.filterDot, background: p.accent }} />
                  {p.shortLabel}
                </button>
              );
            })}
          </div>

          {loadingTemas ? (
            <div style={s.loadingContainer}>
              <div style={s.spinner} />
              <p style={s.loadingText}>Cargando temario histológico...</p>
            </div>
          ) : temasError ? (
            <div style={s.errorAlert}>⚠️ {temasError}</div>
          ) : (
            <div style={s.accordionsStack}>
              {PARCIALES_CONFIG.filter((p) => activeParcialFilter === 'all' || activeParcialFilter === p.key).map((parcial) => {
                const list = temasByParcial[parcial.key] || [];
                const isOpen = openParciales[parcial.key];
                const hasSelected = list.some((t) => Number(t.id) === numSelectedTemaId);

                return (
                  <div
                    key={parcial.key}
                    style={{
                      ...s.accordionItem,
                      border: hasSelected ? `2px solid ${parcial.accent}` : `1.5px solid ${parcial.border}`,
                      boxShadow: hasSelected ? `0 6px 20px ${parcial.glow}` : '0 2px 8px rgba(0,0,0,0.02)',
                    }}
                  >
                    {/* Barra de cabecera del parcial */}
                    <button
                      type="button"
                      onClick={() => toggleParcial(parcial.key)}
                      style={{
                        ...s.accordionHeaderBtn,
                        background: hasSelected ? `linear-gradient(90deg, ${parcial.soft}, #ffffff)` : '#ffffff',
                      }}
                      aria-expanded={isOpen}
                    >
                      <div style={s.accordionHeaderLeft}>
                        <span
                          style={{
                            ...s.parcialNumberBadge,
                            background: parcial.gradient,
                          }}
                        >
                          {parcial.number}
                        </span>
                        <div style={s.parcialHeaderTextWrap}>
                          <span style={s.parcialName}>{parcial.label}</span>
                          <span style={s.parcialThemesCount}>{list.length} temas</span>
                        </div>
                      </div>

                      <div style={s.accordionHeaderRight}>
                        {isOpen ? (
                          <div style={{ ...s.chevronBox, background: parcial.soft }}>
                            <ChevronDown size={17} color={parcial.accent} />
                          </div>
                        ) : (
                          <div style={s.chevronBox}>
                            <ChevronRight size={17} color="#64748b" />
                          </div>
                        )}
                      </div>
                    </button>

                    {/* Grilla de temas */}
                    {isOpen && (
                      <div style={s.accordionBodyGrid}>
                        {list.length === 0 ? (
                          <div style={s.emptyMsg}>
                            {search ? 'Ningún tema coincide con tu búsqueda.' : 'No hay temas registrados en este parcial.'}
                          </div>
                        ) : (
                          <div style={s.themesGrid}>
                            {list.map((tema, idx) => {
                              const isSelected = numSelectedTemaId === Number(tema.id);
                              return (
                                <button
                                  key={tema.id}
                                  type="button"
                                  className="picker-card-hover"
                                  onClick={() => handleTemaClick(tema.id)}
                                  style={{
                                    ...s.themeCard,
                                    border: isSelected ? `2px solid ${parcial.accent}` : '1.5px solid #e2e8f0',
                                    background: isSelected
                                      ? `linear-gradient(145deg, #ffffff 0%, ${parcial.soft} 100%)`
                                      : '#ffffff',
                                    boxShadow: isSelected
                                      ? `0 10px 22px -4px ${parcial.glow}, 0 2px 6px rgba(0,0,0,0.04)`
                                      : '0 2px 6px rgba(15,23,42,0.03)',
                                  }}
                                >
                                  <div style={s.themeCardTopRow}>
                                    <span
                                      style={{
                                        ...s.themeIndexBadge,
                                        background: isSelected ? parcial.accent : '#f1f5f9',
                                        color: isSelected ? '#ffffff' : '#64748b',
                                      }}
                                    >
                                      {(tema.sort_order ?? idx) + 1}
                                    </span>

                                    {isSelected ? (
                                      <span style={{ ...s.checkCircle, background: parcial.gradient }}>
                                        <Check size={12} strokeWidth={3.5} color="#ffffff" />
                                      </span>
                                    ) : tema.logo_url ? (
                                      <img
                                        src={getCloudinaryImageUrl(tema.logo_url, 'thumb')}
                                        alt={tema.nombre}
                                        style={s.themeCardLogo}
                                        loading="lazy"
                                      />
                                    ) : null}
                                  </div>

                                  <div style={s.themeCardBottomRow}>
                                    <span
                                      style={{
                                        ...s.themeCardTitle,
                                        color: isSelected ? parcial.accent : '#1e293b',
                                        fontWeight: isSelected ? 800 : 600,
                                      }}
                                    >
                                      {tema.nombre}
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── SECCIÓN DE SUBTEMAS (VIBRANTE Y EN PRIMER PLANO) ── */}
      {mode === 'tema-and-subtema' && selectedTema && (
        <div style={s.subtemasRoot}>
          <div style={s.subtemasHeader}>
            <div style={s.subtemasHeaderLeft}>
              <div style={s.subtemasIconBadge}>
                <FolderTree size={20} color="#7c3aed" />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h4 style={s.subtemasHeadingTitle}>Subtemas de {selectedTema.nombre}</h4>
                  <span style={s.subtemasCounterPill}>{relevantSubtemas.length} subtemas</span>
                </div>
                <p style={s.subtemasHeadingSubtitle}>Haz clic en un subtema para cargar sus mapas o placas al instante</p>
              </div>
            </div>
          </div>

          {loadingSubtemas ? (
            <div style={s.loadingContainer}>
              <div style={{ ...s.spinner, borderTopColor: '#7c3aed' }} />
              <p style={s.loadingText}>Cargando subtemas...</p>
            </div>
          ) : subtemasError ? (
            <div style={s.errorAlert}>⚠️ {subtemasError}</div>
          ) : relevantSubtemas.length === 0 ? (
            <div style={s.subtemasEmptyBox}>
              <Sparkles size={28} color="#a855f7" />
              <p style={s.subtemasEmptyTitle}>No hay subtemas en este tema</p>
              <p style={s.subtemasEmptySub}>Puedes añadir subtemas desde el panel de administración.</p>
            </div>
          ) : (
            <div style={s.subtemasGrid}>
              {relevantSubtemas.map((subtema, idx) => {
                const isSelected = numSelectedSubtemaId === Number(subtema.id);
                return (
                  <button
                    key={subtema.id}
                    type="button"
                    className="subtema-card-hover"
                    onClick={() => onSelectSubtema && onSelectSubtema(subtema.id)}
                    style={{
                      ...s.subtemaCard,
                      border: isSelected ? '2px solid #7c3aed' : '1.5px solid #e2e8f0',
                      background: isSelected
                        ? 'linear-gradient(145deg, #ffffff 0%, #faf5ff 100%)'
                        : '#ffffff',
                      boxShadow: isSelected
                        ? '0 12px 28px -4px rgba(124, 58, 237, 0.28), 0 4px 10px rgba(0,0,0,0.04)'
                        : '0 2px 8px rgba(15,23,42,0.03)',
                    }}
                  >
                    <div style={s.subtemaCardTop}>
                      <span
                        style={{
                          ...s.subtemaIndexBadge,
                          background: isSelected ? '#7c3aed' : '#ede9fe',
                          color: isSelected ? '#ffffff' : '#6d28d9',
                        }}
                      >
                        #{(subtema.sort_order ?? idx) + 1}
                      </span>

                      {subtema.logo_url && (
                        <img
                          src={getCloudinaryImageUrl(subtema.logo_url, 'thumb')}
                          alt={subtema.nombre}
                          style={s.subtemaLogo}
                          loading="lazy"
                        />
                      )}

                      {isSelected && (
                        <span style={s.subtemaCheckBadge}>
                          <Check size={12} strokeWidth={3.5} color="#ffffff" />
                        </span>
                      )}
                    </div>

                    <div style={s.subtemaTitleWrap}>
                      <span
                        style={{
                          ...s.subtemaCardTitle,
                          color: isSelected ? '#6d28d9' : '#1e293b',
                          fontWeight: isSelected ? 800 : 700,
                        }}
                      >
                        {subtema.nombre}
                      </span>
                    </div>

                    {isSelected && (
                      <div style={s.subtemaActiveIndicator}>
                        <span style={s.subtemaActiveText}>Subtema activo</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const s: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    width: '100%',
    boxSizing: 'border-box',
    fontFamily: '"Montserrat", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  // ── HERO BANNER ──
  heroBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '14px',
    padding: '14px 20px',
    borderRadius: '16px',
    boxSizing: 'border-box',
    backdropFilter: 'blur(10px)',
  },
  heroLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    flexWrap: 'wrap',
  },
  heroBadgeWrap: {
    display: 'flex',
    alignItems: 'center',
  },
  heroParcialBadge: {
    color: '#ffffff',
    fontSize: '0.74em',
    fontWeight: 800,
    padding: '4px 10px',
    borderRadius: '20px',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
  },
  heroLogoFrame: {
    width: '38px',
    height: '38px',
    borderRadius: '10px',
    overflow: 'hidden',
    border: '2px solid #ffffff',
    boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
    flexShrink: 0,
  },
  heroLogo: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  heroLogoPlaceholder: {
    width: '38px',
    height: '38px',
    borderRadius: '10px',
    border: '1.5px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  heroTextCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  heroStatusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  liveDot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    display: 'inline-block',
  },
  heroCategory: {
    fontSize: '0.72em',
    fontWeight: 800,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
  heroTemaTitle: {
    fontSize: '1.05em',
    fontWeight: 800,
    color: '#0f172a',
    margin: 0,
    lineHeight: 1.2,
  },
  heroChangeBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '8px 16px',
    borderRadius: '12px',
    fontSize: '0.84em',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.18s ease',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  },
  // ── PICKER BOX ──
  pickerBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    background: '#ffffff',
    borderRadius: '20px',
    border: '1.5px solid #e2e8f0',
    padding: '20px',
    boxShadow: '0 8px 30px rgba(15, 23, 42, 0.05)',
  },
  header: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    paddingBottom: '12px',
    borderBottom: '1.5px solid #f1f5f9',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  iconBadge: {
    width: '40px',
    height: '40px',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    boxShadow: '0 2px 6px rgba(2, 132, 199, 0.15)',
  },
  headerTitle: {
    fontSize: '1.05em',
    fontWeight: 800,
    color: '#0f172a',
    margin: 0,
    letterSpacing: '-0.01em',
  },
  headerSubtitle: {
    fontSize: '0.82em',
    color: '#64748b',
    margin: '2px 0 0 0',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  searchContainer: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    width: '230px',
  },
  searchIcon: {
    position: 'absolute',
    left: '12px',
    pointerEvents: 'none',
  },
  searchInput: {
    width: '100%',
    padding: '8px 32px 8px 36px',
    fontSize: '0.85em',
    borderRadius: '10px',
    border: '1.5px solid #cbd5e1',
    background: '#f8fafc',
    color: '#0f172a',
    outline: 'none',
    fontFamily: 'inherit',
    transition: 'all 0.2s',
  },
  searchClear: {
    position: 'absolute',
    right: '10px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#94a3b8',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
  },
  closePickerBtn: {
    padding: '8px 14px',
    borderRadius: '10px',
    border: '1px solid #cbd5e1',
    background: '#f8fafc',
    color: '#64748b',
    fontSize: '0.82em',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.15s',
  },
  filterBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
    paddingTop: '2px',
  },
  filterLabel: {
    fontSize: '0.78em',
    fontWeight: 700,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginRight: '4px',
  },
  filterChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: '20px',
    border: '1.5px solid #e2e8f0',
    background: '#ffffff',
    fontSize: '0.8em',
    fontWeight: 600,
    color: '#475569',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.18s ease',
  },
  filterChipActive: {
    borderColor: '#0284c7',
    background: '#f0f9ff',
    color: '#0284c7',
    fontWeight: 700,
  },
  filterDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
  },
  accordionsStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  accordionItem: {
    borderRadius: '16px',
    overflow: 'hidden',
    background: '#ffffff',
    transition: 'all 0.22s ease',
  },
  accordionHeaderBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 18px',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'background 0.18s',
  },
  accordionHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  parcialNumberBadge: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#ffffff',
    fontSize: '0.82em',
    fontWeight: 800,
    boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
  },
  parcialHeaderTextWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  parcialName: {
    fontSize: '0.96em',
    fontWeight: 800,
    color: '#0f172a',
  },
  parcialThemesCount: {
    fontSize: '0.76em',
    color: '#64748b',
    background: '#f1f5f9',
    padding: '3px 9px',
    borderRadius: '12px',
    fontWeight: 600,
  },
  accordionHeaderRight: {
    display: 'flex',
    alignItems: 'center',
  },
  chevronBox: {
    width: '28px',
    height: '28px',
    borderRadius: '8px',
    background: '#f8fafc',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accordionBodyGrid: {
    padding: '16px',
    borderTop: '1px solid #f1f5f9',
    background: '#f8fafc',
  },
  themesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '12px',
  },
  themeCard: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    minHeight: '80px',
    padding: '12px 14px',
    borderRadius: '14px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'left',
    outline: 'none',
    boxSizing: 'border-box',
  },
  themeCardTopRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: '8px',
  },
  themeIndexBadge: {
    fontSize: '0.72em',
    fontWeight: 800,
    padding: '2px 8px',
    borderRadius: '8px',
  },
  themeCardLogo: {
    width: '26px',
    height: '26px',
    borderRadius: '8px',
    objectFit: 'cover',
    boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
  },
  checkCircle: {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
  },
  themeCardBottomRow: {
    marginTop: 'auto',
  },
  themeCardTitle: {
    fontSize: '0.88em',
    lineHeight: 1.35,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  // ── SUBTEMAS SECTION ──
  subtemasRoot: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    background: '#ffffff',
    borderRadius: '20px',
    border: '1.5px solid #ddd6fe',
    padding: '20px',
    boxShadow: '0 10px 30px rgba(124, 58, 237, 0.07)',
  },
  subtemasHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: '12px',
    borderBottom: '1.5px solid #f5f3ff',
  },
  subtemasHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  subtemasIconBadge: {
    width: '42px',
    height: '42px',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    boxShadow: '0 4px 10px rgba(124, 58, 237, 0.15)',
  },
  subtemasHeadingTitle: {
    fontSize: '1.05em',
    fontWeight: 800,
    color: '#4c1d95',
    margin: 0,
    letterSpacing: '-0.01em',
  },
  subtemasHeadingSubtitle: {
    fontSize: '0.8em',
    color: '#6b7280',
    margin: '3px 0 0 0',
  },
  subtemasCounterPill: {
    fontSize: '0.76em',
    fontWeight: 800,
    color: '#7c3aed',
    background: '#f5f3ff',
    padding: '3px 10px',
    borderRadius: '14px',
    border: '1px solid #ddd6fe',
  },
  subtemasGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: '12px',
  },
  subtemaCard: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    minHeight: '90px',
    padding: '14px',
    borderRadius: '16px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'left',
    outline: 'none',
    boxSizing: 'border-box',
    position: 'relative',
    overflow: 'hidden',
  },
  subtemaCardTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: '10px',
  },
  subtemaIndexBadge: {
    fontSize: '0.72em',
    fontWeight: 800,
    padding: '2px 8px',
    borderRadius: '8px',
    letterSpacing: '0.02em',
  },
  subtemaLogo: {
    width: '28px',
    height: '28px',
    borderRadius: '8px',
    objectFit: 'cover',
    boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
  },
  subtemaCheckBadge: {
    width: '22px',
    height: '22px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(124, 58, 237, 0.4)',
  },
  subtemaTitleWrap: {
    marginTop: 'auto',
  },
  subtemaCardTitle: {
    fontSize: '0.92em',
    lineHeight: 1.35,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  subtemaActiveIndicator: {
    marginTop: '6px',
    display: 'flex',
    alignItems: 'center',
  },
  subtemaActiveText: {
    fontSize: '0.7em',
    fontWeight: 800,
    color: '#7c3aed',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  subtemasEmptyBox: {
    padding: '36px 20px',
    textAlign: 'center',
    background: '#faf5ff',
    borderRadius: '16px',
    border: '2px dashed #ddd6fe',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
  },
  subtemasEmptyTitle: {
    margin: 0,
    fontSize: '0.96em',
    fontWeight: 800,
    color: '#4c1d95',
  },
  subtemasEmptySub: {
    margin: 0,
    fontSize: '0.82em',
    color: '#7c3aed',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    padding: '30px',
    justifyContent: 'center',
  },
  spinner: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    border: '2.5px solid #e2e8f0',
    borderTopColor: '#0284c7',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: {
    fontSize: '0.85em',
    color: '#64748b',
    fontWeight: 600,
    margin: 0,
  },
  errorAlert: {
    padding: '14px 18px',
    background: '#fee2e2',
    color: '#b91c1c',
    borderRadius: '12px',
    fontSize: '0.88em',
    fontWeight: 700,
  },
  emptyMsg: {
    padding: '20px',
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: '0.86em',
    fontStyle: 'italic',
  },
};

export default EditorParcialAccordionPicker;
