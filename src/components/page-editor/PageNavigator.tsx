import React, { useEffect, useMemo, useState } from 'react';
import { BadgeInfo, FileText, FlaskConical, Home, Layers3, PanelLeftClose, Search, ChevronDown, ChevronRight, X, Sparkles, Folder } from 'lucide-react';
import { getRenderableBlocks } from '../../services/contentPublication';
import { collectWeeklyThemeIds } from '../../pages/evaluacionesUtils';

export type PageSelection =
  | { kind: 'home'; label: string }
  | { kind: 'temario'; label: string }
  | { kind: 'credits'; label: string }
  | { kind: 'tema'; id: number; label: string }
  | { kind: 'subtema'; id: number; temaId: number; label: string; parentLabel: string };

export interface EditorTemaItem {
  id: number;
  nombre: string;
  parcial: string;
  sort_order?: number | null;
}

export interface EditorSubtemaItem {
  id: number;
  nombre: string;
  tema_id: number;
  sort_order?: number | null;
}

interface PageNavigatorProps {
  selection: PageSelection | null;
  temas: EditorTemaItem[];
  subtemas: EditorSubtemaItem[];
  loading: boolean;
  onSelect: (selection: PageSelection) => void;
  onClose?: () => void;
  showCredits?: boolean;
}

const normalize = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

type FilterCategory = 'semana' | 'primer' | 'segundo' | 'tercer' | 'principales' | 'todos';

const PageNavigator: React.FC<PageNavigatorProps> = ({
  selection,
  temas,
  subtemas,
  loading,
  onSelect,
  onClose,
  showCredits = false,
}) => {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<FilterCategory>('semana');
  const [weeklyThemeIds, setWeeklyThemeIds] = useState<number[]>([]);
  const [collapsedTemas, setCollapsedTemas] = useState<Record<number, boolean>>({});

  useEffect(() => {
    let isCancelled = false;
    const fetchWeeklyThemes = async () => {
      try {
        const blocks = await getRenderableBlocks('home_page', 0);
        const ids = collectWeeklyThemeIds(blocks);
        if (!isCancelled) {
          setWeeklyThemeIds(ids);
          if (ids.length === 0) {
            setCategoryFilter('primer');
          }
        }
      } catch (err) {
        console.warn('Error al cargar temas de la semana en navegador:', err);
      }
    };

    void fetchWeeklyThemes();
    return () => {
      isCancelled = true;
    };
  }, []);

  const normalizedSearch = normalize(search.trim());

  const toggleTemaCollapse = (temaId: number) => {
    setCollapsedTemas(prev => ({ ...prev, [temaId]: !prev[temaId] }));
  };

  const filteredTemas = useMemo(() => {
    return temas.filter(tema => {
      // 1. Filtro exclusivo de Temas de la Semana
      if (categoryFilter === 'semana') {
        if (weeklyThemeIds.length > 0 && !weeklyThemeIds.includes(tema.id)) {
          return false;
        }
      }

      // 2. Filtro por Parcial
      if (categoryFilter === 'primer' || categoryFilter === 'segundo' || categoryFilter === 'tercer') {
        const temaParcial = normalize(tema.parcial || '');
        if (!temaParcial.includes(categoryFilter)) return false;
      }

      // 3. Filtro de búsqueda
      if (!normalizedSearch) return true;
      if (normalize(tema.nombre).includes(normalizedSearch)) return true;
      return subtemas.some(
        subtema => subtema.tema_id === tema.id && normalize(subtema.nombre).includes(normalizedSearch)
      );
    });
  }, [categoryFilter, normalizedSearch, subtemas, temas, weeklyThemeIds]);

  const showMainPages = categoryFilter === 'todos' || categoryFilter === 'principales';

  return (
    <aside className="page-editor-nav" aria-label="Páginas editables">
      {/* ─── CABECERA DEL SELECTOR ─── */}
      <div className="page-editor-nav-heading">
        <div className="page-editor-nav-heading-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={14} color="#0284c7" />
            <span className="page-editor-eyebrow">Explorador de Contenido</span>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Ocultar selector de páginas"
              aria-label="Ocultar selector de páginas"
              className="page-editor-nav-close-btn"
            >
              <PanelLeftClose size={17} />
            </button>
          )}
        </div>
        <h2>Páginas del Sitio</h2>
        <p>Selecciona una sección para diseñar y publicar.</p>
      </div>

      {/* ─── BARRA DE BÚSQUEDA INSTANTÁNEA ─── */}
      <div className="page-editor-search-wrapper">
        <label className="page-editor-search">
          <Search size={16} aria-hidden="true" color="#64748b" />
          <input
            type="search"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Buscar tema o subtema..."
            aria-label="Buscar tema o subtema"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              style={{ background: 'none', border: 'none', padding: '2px', cursor: 'pointer', color: '#94a3b8' }}
              title="Borrar búsqueda"
            >
              <X size={14} />
            </button>
          )}
        </label>
      </div>

      {/* ─── CHIPS DE FILTRO RÁPIDO ─── */}
      <div className="page-editor-filter-chips" role="radiogroup" aria-label="Filtrar por sección">
        {[
          { id: 'semana', label: '⭐ Semana', isWeekly: true },
          { id: 'primer', label: '1° Parcial', isWeekly: false },
          { id: 'segundo', label: '2° Parcial', isWeekly: false },
          { id: 'tercer', label: '3° Parcial', isWeekly: false },
          { id: 'principales', label: 'Principales', isWeekly: false },
          { id: 'todos', label: 'Todos', isWeekly: false },
        ].map(chip => (
          <button
            key={chip.id}
            type="button"
            className={`page-editor-filter-chip ${categoryFilter === chip.id ? 'is-active' : ''}`}
            onClick={() => setCategoryFilter(chip.id as FilterCategory)}
          >
            <span>{chip.label}</span>
          </button>
        ))}
      </div>

      {/* ─── LISTA DE PÁGINAS ─── */}
      <nav className="page-editor-nav-list">
        {/* Páginas Principales del Sistema */}
        {showMainPages && !normalizedSearch && (
          <div className="page-editor-nav-section">
            <div className="page-editor-tree-label">
              <Home size={14} color="#0284c7" />
              <span>Páginas Principales</span>
            </div>

            <button
              type="button"
              className={`page-editor-nav-item ${selection?.kind === 'home' ? 'is-active' : ''}`}
              onClick={() => onSelect({ kind: 'home', label: 'Inicio' })}
            >
              <div className="page-editor-nav-item-icon">
                <Home size={16} />
              </div>
              <div className="page-editor-nav-item-text">
                <strong>Inicio</strong>
                <small>Portada y hero principal</small>
              </div>
            </button>

            <button
              type="button"
              className={`page-editor-nav-item ${selection?.kind === 'temario' ? 'is-active' : ''}`}
              onClick={() => onSelect({ kind: 'temario', label: 'Temario' })}
            >
              <div className="page-editor-nav-item-icon">
                <Layers3 size={16} />
              </div>
              <div className="page-editor-nav-item-text">
                <strong>Temario</strong>
                <small>Catálogo global de temas</small>
              </div>
            </button>

            {showCredits && (
              <button
                type="button"
                className={`page-editor-nav-item ${selection?.kind === 'credits' ? 'is-active' : ''}`}
                onClick={() => onSelect({ kind: 'credits', label: 'Créditos' })}
              >
                <div className="page-editor-nav-item-icon">
                  <BadgeInfo size={16} />
                </div>
                <div className="page-editor-nav-item-text">
                  <strong>Créditos</strong>
                  <small>Fotografías y reconocimientos</small>
                </div>
              </button>
            )}
          </div>
        )}

        {/* Temas y Subtemas */}
        <div className="page-editor-nav-section">
          <div className="page-editor-tree-label">
            <FlaskConical size={14} color="#0284c7" />
            <span>Temas & Subtemas ({filteredTemas.length})</span>
          </div>

          {loading ? (
            <div className="page-editor-nav-empty">Cargando páginas del temario…</div>
          ) : filteredTemas.length === 0 ? (
            <div className="page-editor-nav-empty">
              No se encontraron temas con los filtros aplicados.
            </div>
          ) : (
            filteredTemas.map(tema => {
              const children = subtemas.filter(
                subtema =>
                  subtema.tema_id === tema.id &&
                  (!normalizedSearch ||
                    normalize(tema.nombre).includes(normalizedSearch) ||
                    normalize(subtema.nombre).includes(normalizedSearch))
              );

              const isTemaActive = selection?.kind === 'tema' && selection.id === tema.id;
              const isCollapsed = Boolean(collapsedTemas[tema.id]) && !normalizedSearch;

              return (
                <div className="page-editor-tree-group" key={tema.id}>
                  {/* Fila del Tema */}
                  <div className="page-editor-tema-row">
                    <button
                      type="button"
                      className={`page-editor-tree-item tema ${isTemaActive ? 'is-active' : ''}`}
                      onClick={() => onSelect({ kind: 'tema', id: tema.id, label: tema.nombre })}
                    >
                      <Folder size={15} color={isTemaActive ? '#0284c7' : '#64748b'} />
                      <span className="page-editor-tree-tema-title">{tema.nombre}</span>
                    </button>

                    {children.length > 0 && (
                      <button
                        type="button"
                        className="page-editor-collapse-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTemaCollapse(tema.id);
                        }}
                        title={isCollapsed ? 'Desplegar subtemas' : 'Colapsar subtemas'}
                      >
                        <span className="page-editor-subtemas-badge">{children.length}</span>
                        {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                      </button>
                    )}
                  </div>

                  {/* Lista de Subtemas */}
                  {!isCollapsed && children.length > 0 && (
                    <div className="page-editor-subtemas-list">
                      {children.map(subtema => {
                        const isSubtemaActive = selection?.kind === 'subtema' && selection.id === subtema.id;
                        return (
                          <button
                            type="button"
                            key={subtema.id}
                            className={`page-editor-tree-item subtema ${isSubtemaActive ? 'is-active' : ''}`}
                            onClick={() =>
                              onSelect({
                                kind: 'subtema',
                                id: subtema.id,
                                temaId: tema.id,
                                label: subtema.nombre,
                                parentLabel: tema.nombre,
                              })
                            }
                          >
                            <span className="page-editor-tree-line" aria-hidden="true" />
                            <FileText size={14} />
                            <span>{subtema.nombre}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </nav>
    </aside>
  );
};

export default PageNavigator;
