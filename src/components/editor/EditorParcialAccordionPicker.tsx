import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Layers, Sparkles, Check, Search, X } from 'lucide-react';
import { getCloudinaryImageUrl } from '../../services/cloudinaryImages';

export interface EditorTema {
  id: number;
  nombre: string;
  parcial: string;
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
  number: number;
  accent: string;
  soft: string;
  border: string;
}

export const PARCIALES_CONFIG: ParcialConfig[] = [
  { key: 'primer', label: 'Primer parcial', number: 1, accent: '#0ea5e9', soft: '#f0f9ff', border: '#bae6fd' },
  { key: 'segundo', label: 'Segundo parcial', number: 2, accent: '#6366f1', soft: '#eef2ff', border: '#c7d2fe' },
  { key: 'tercer', label: 'Tercer parcial', number: 3, accent: '#8b5cf6', soft: '#f5f3ff', border: '#ddd6fe' },
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
  title = 'Selecciona tema',
  subtitle = 'Elige un parcial para desplegar sus temas en orden',
  showSearch = true,
}) => {
  const [search, setSearch] = useState('');
  const [openParciales, setOpenParciales] = useState<Record<ParcialKey, boolean>>({
    primer: true,
    segundo: true,
    tercer: true,
  });

  // Agrupación y ordenamiento estricto por parcial y sort_order
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

    // Ordenar ascendentemente por sort_order
    Object.keys(map).forEach((k) => {
      map[k as ParcialKey].sort((a, b) => (a.sort_order ?? a.id) - (b.sort_order ?? b.id));
    });

    return map;
  }, [temas, search]);

  const selectedTema = useMemo(() => temas.find((t) => t.id === selectedTemaId) ?? null, [selectedTemaId, temas]);

  // Subtemas del tema seleccionado ordenados
  const relevantSubtemas = useMemo(() => {
    if (!selectedTemaId) return [];
    return subtemas
      .filter((st) => st.tema_id === selectedTemaId)
      .sort((a, b) => (a.sort_order ?? a.id) - (b.sort_order ?? b.id));
  }, [selectedTemaId, subtemas]);

  const toggleParcial = (key: ParcialKey) => {
    setOpenParciales((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div style={styles.container}>
      {/* Encabezado del selector */}
      <div style={styles.header}>
        <div style={styles.headerTitleRow}>
          <div style={styles.headerIconWrap}>
            <Layers size={18} color="#0ea5e9" />
          </div>
          <div>
            <h3 style={styles.title}>{title}</h3>
            <p style={styles.subtitle}>{subtitle}</p>
          </div>
        </div>

        {showSearch && (
          <div style={styles.searchWrap}>
            <Search size={15} color="#64748b" style={styles.searchIcon} />
            <input
              type="text"
              placeholder="Buscar tema..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={styles.searchInput}
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} style={styles.searchClearBtn} title="Limpiar búsqueda">
                <X size={13} />
              </button>
            )}
          </div>
        )}
      </div>

      {loadingTemas ? (
        <div style={styles.loadingBox}>
          <div style={styles.spinner} />
          <span>Cargando temas del atlas...</span>
        </div>
      ) : temasError ? (
        <div style={styles.errorBox}>⚠️ {temasError}</div>
      ) : (
        <div style={styles.accordionStack}>
          {PARCIALES_CONFIG.map((parcial) => {
            const list = temasByParcial[parcial.key] || [];
            const isOpen = openParciales[parcial.key];
            const hasSelectedInParcial = list.some((t) => t.id === selectedTemaId);

            return (
              <div
                key={parcial.key}
                style={{
                  ...styles.accordionCard,
                  borderColor: hasSelectedInParcial ? parcial.accent : styles.accordionCard.borderColor,
                }}
              >
                {/* Cabecera del Parcial */}
                <button
                  type="button"
                  onClick={() => toggleParcial(parcial.key)}
                  style={{
                    ...styles.accordionSummary,
                    background: hasSelectedInParcial ? parcial.soft : '#ffffff',
                  }}
                  aria-expanded={isOpen}
                >
                  <div style={styles.summaryLeft}>
                    <span
                      style={{
                        ...styles.parcialBadge,
                        background: hasSelectedInParcial
                          ? `linear-gradient(135deg, ${parcial.accent}, #38bdf8)`
                          : '#f1f5f9',
                        color: hasSelectedInParcial ? '#ffffff' : '#475569',
                      }}
                    >
                      {parcial.number}
                    </span>
                    <span style={styles.parcialTitle}>{parcial.label}</span>
                    <span style={styles.countBadge}>{list.length} temas</span>
                  </div>

                  <div style={styles.summaryRight}>
                    {isOpen ? <ChevronDown size={18} color="#64748b" /> : <ChevronRight size={18} color="#64748b" />}
                  </div>
                </button>

                {/* Contenido expandible de Temas */}
                {isOpen && (
                  <div style={styles.accordionBody}>
                    {list.length === 0 ? (
                      <div style={styles.emptyState}>
                        {search ? 'No se encontraron temas con este filtro.' : 'No hay temas en este parcial.'}
                      </div>
                    ) : (
                      <div style={styles.themeGrid}>
                        {list.map((tema, index) => {
                          const isSelected = selectedTemaId === tema.id;

                          return (
                            <button
                              key={tema.id}
                              type="button"
                              onClick={() => onSelectTema(tema.id)}
                              style={{
                                ...styles.themeCard,
                                borderColor: isSelected ? parcial.accent : '#e2e8f0',
                                background: isSelected ? 'linear-gradient(135deg, #ffffff, #f0f9ff)' : '#ffffff',
                                boxShadow: isSelected
                                  ? '0 8px 20px rgba(14,165,233,0.18)'
                                  : '0 2px 6px rgba(15,23,42,0.04)',
                              }}
                            >
                              <div style={styles.themeCardTop}>
                                <span style={styles.themeIndex}>{(tema.sort_order ?? index) + 1}</span>
                                {tema.logo_url && (
                                  <img
                                    src={getCloudinaryImageUrl(tema.logo_url, 'thumb')}
                                    alt={tema.nombre}
                                    style={styles.themeLogo}
                                    loading="lazy"
                                  />
                                )}
                                {isSelected && (
                                  <span style={{ ...styles.checkBadge, background: parcial.accent }}>
                                    <Check size={12} strokeWidth={3} />
                                  </span>
                                )}
                              </div>
                              <span
                                style={{
                                  ...styles.themeName,
                                  color: isSelected ? '#0369a1' : '#1e293b',
                                  fontWeight: isSelected ? 800 : 700,
                                }}
                              >
                                {tema.nombre}
                              </span>
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

      {/* Selector de Subtemas si está en modo tema-and-subtema y hay un tema seleccionado */}
      {mode === 'tema-and-subtema' && selectedTema && (
        <div style={styles.subtemasSection}>
          <div style={styles.subtemasHeading}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={16} color="#8b5cf6" />
              <h4 style={styles.subtemasTitle}>Subtemas de {selectedTema.nombre}</h4>
            </div>
            <span style={styles.subtemasCount}>{relevantSubtemas.length} disponibles</span>
          </div>

          {loadingSubtemas ? (
            <div style={styles.loadingBox}>
              <div style={styles.spinner} />
              <span>Cargando subtemas...</span>
            </div>
          ) : subtemasError ? (
            <div style={styles.errorBox}>⚠️ {subtemasError}</div>
          ) : relevantSubtemas.length === 0 ? (
            <div style={styles.emptyState}>Este tema no tiene subtemas registrados aún.</div>
          ) : (
            <div style={styles.subtemaGrid}>
              {relevantSubtemas.map((subtema, index) => {
                const isSelected = selectedSubtemaId === subtema.id;

                return (
                  <button
                    key={subtema.id}
                    type="button"
                    onClick={() => onSelectSubtema && onSelectSubtema(subtema.id)}
                    style={{
                      ...styles.subtemaCard,
                      borderColor: isSelected ? '#8b5cf6' : '#e2e8f0',
                      background: isSelected ? 'linear-gradient(135deg, #faf5ff, #ffffff)' : '#ffffff',
                      boxShadow: isSelected
                        ? '0 8px 20px rgba(139,92,246,0.18)'
                        : '0 2px 6px rgba(15,23,42,0.04)',
                    }}
                  >
                    <div style={styles.themeCardTop}>
                      <span style={{ ...styles.themeIndex, background: '#ede9fe', color: '#6d28d9' }}>
                        {(subtema.sort_order ?? index) + 1}
                      </span>
                      {subtema.logo_url && (
                        <img
                          src={getCloudinaryImageUrl(subtema.logo_url, 'thumb')}
                          alt={subtema.nombre}
                          style={styles.themeLogo}
                          loading="lazy"
                        />
                      )}
                      {isSelected && (
                        <span style={{ ...styles.checkBadge, background: '#8b5cf6' }}>
                          <Check size={12} strokeWidth={3} />
                        </span>
                      )}
                    </div>
                    <span
                      style={{
                        ...styles.themeName,
                        color: isSelected ? '#6d28d9' : '#1e293b',
                        fontWeight: isSelected ? 800 : 700,
                      }}
                    >
                      {subtema.nombre}
                    </span>
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

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    width: '100%',
    boxSizing: 'border-box',
  },
  header: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '14px 18px',
    borderRadius: '16px',
    background: 'linear-gradient(135deg, #ffffff, #f8fafc)',
    border: '1px solid #e2e8f0',
    boxShadow: '0 2px 10px rgba(15,23,42,0.04)',
  },
  headerTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  headerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    background: '#e0f2fe',
    display: 'grid',
    placeItems: 'center',
  },
  title: {
    margin: 0,
    fontSize: '1rem',
    fontWeight: 800,
    color: '#0f172a',
    letterSpacing: '-0.02em',
  },
  subtitle: {
    margin: '2px 0 0',
    fontSize: '0.78rem',
    color: '#64748b',
  },
  searchWrap: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    minWidth: 220,
  },
  searchIcon: {
    position: 'absolute',
    left: 10,
    pointerEvents: 'none',
  },
  searchInput: {
    width: '100%',
    padding: '7px 28px 7px 32px',
    fontSize: '0.82rem',
    borderRadius: 999,
    border: '1px solid #cbd5e1',
    background: '#ffffff',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  searchClearBtn: {
    position: 'absolute',
    right: 8,
    border: 0,
    background: 'none',
    color: '#94a3b8',
    cursor: 'pointer',
    padding: 2,
    display: 'grid',
    placeItems: 'center',
  },
  accordionStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  accordionCard: {
    borderRadius: '16px',
    border: '1.5px solid #e2e8f0',
    overflow: 'hidden',
    background: '#ffffff',
    boxShadow: '0 4px 14px rgba(15,23,42,0.04)',
    transition: 'all 0.2s ease',
  },
  accordionSummary: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 18px',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'left',
    transition: 'background 0.15s ease',
  },
  summaryLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  parcialBadge: {
    width: 24,
    height: 24,
    borderRadius: '50%',
    display: 'grid',
    placeItems: 'center',
    fontSize: '0.72rem',
    fontWeight: 900,
  },
  parcialTitle: {
    fontSize: '0.92rem',
    fontWeight: 800,
    color: '#1e293b',
  },
  countBadge: {
    padding: '2px 8px',
    borderRadius: 999,
    fontSize: '0.7rem',
    fontWeight: 700,
    background: '#f1f5f9',
    color: '#64748b',
  },
  summaryRight: {
    display: 'grid',
    placeItems: 'center',
  },
  accordionBody: {
    padding: '14px 16px 16px',
    borderTop: '1px solid #f1f5f9',
    background: '#f8fafc',
  },
  themeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 210px), 1fr))',
    gap: '10px',
  },
  themeCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '8px',
    padding: '12px 14px',
    borderRadius: '12px',
    border: '1.5px solid #e2e8f0',
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: 'inherit',
    transition: 'all 0.18s ease',
  },
  themeCardTop: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  themeIndex: {
    padding: '2px 6px',
    borderRadius: 6,
    background: '#f1f5f9',
    color: '#475569',
    fontSize: '0.68rem',
    fontWeight: 800,
  },
  themeLogo: {
    width: 22,
    height: 22,
    borderRadius: 6,
    objectFit: 'cover',
  },
  checkBadge: {
    width: 18,
    height: 18,
    borderRadius: '50%',
    color: '#ffffff',
    display: 'grid',
    placeItems: 'center',
  },
  themeName: {
    fontSize: '0.84rem',
    lineHeight: 1.35,
  },
  subtemasSection: {
    marginTop: '6px',
    padding: '18px',
    borderRadius: '18px',
    background: 'linear-gradient(135deg, #ffffff, #faf5ff)',
    border: '1.5px solid #e9d5ff',
    boxShadow: '0 6px 20px rgba(139,92,246,0.06)',
  },
  subtemasHeading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '14px',
  },
  subtemasTitle: {
    margin: 0,
    fontSize: '0.94rem',
    fontWeight: 850,
    color: '#581c87',
  },
  subtemasCount: {
    padding: '3px 10px',
    borderRadius: 999,
    fontSize: '0.72rem',
    fontWeight: 800,
    background: '#f3e8ff',
    color: '#7e22ce',
  },
  subtemaGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))',
    gap: '10px',
  },
  subtemaCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '8px',
    padding: '12px 14px',
    borderRadius: '12px',
    border: '1.5px solid #e2e8f0',
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: 'inherit',
    transition: 'all 0.18s ease',
  },
  emptyState: {
    padding: '18px',
    textAlign: 'center',
    color: '#64748b',
    fontSize: '0.82rem',
    fontStyle: 'italic',
  },
  loadingBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    padding: '24px',
    color: '#64748b',
    fontSize: '0.86rem',
  },
  spinner: {
    width: 20,
    height: 20,
    borderRadius: '50%',
    border: '2.5px solid #cbd5e1',
    borderTopColor: '#0ea5e9',
    animation: 'spin 0.8s linear infinite',
  },
  errorBox: {
    padding: '14px 18px',
    borderRadius: '12px',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#b91c1c',
    fontSize: '0.84rem',
  },
};

export default EditorParcialAccordionPicker;
