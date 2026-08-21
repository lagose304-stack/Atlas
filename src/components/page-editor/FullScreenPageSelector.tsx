import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Home,
  Layers3,
  BadgeInfo,
  Folder,
  FileText,
  ArrowRight,
  FlaskConical,
  X,
  Compass,
} from 'lucide-react';
import type { EditorSubtemaItem, EditorTemaItem, PageSelection } from './PageNavigator';
import { getRenderableBlocks } from '../../services/contentPublication';
import { collectWeeklyThemeIds } from '../../pages/evaluacionesUtils';

interface FullScreenPageSelectorProps {
  temas: EditorTemaItem[];
  subtemas: EditorSubtemaItem[];
  loading: boolean;
  onSelect: (selection: PageSelection) => void;
  showCredits?: boolean;
}

export type FilterCategory = 'semana' | 'primer' | 'segundo' | 'tercer' | 'principales' | 'todos';

const normalize = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const FullScreenPageSelector: React.FC<FullScreenPageSelectorProps> = ({
  temas,
  subtemas,
  loading,
  onSelect,
  showCredits = false,
}) => {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<FilterCategory>('semana');
  const [weeklyThemeIds, setWeeklyThemeIds] = useState<number[]>([]);
  const [loadingWeekly, setLoadingWeekly] = useState(true);

  // Cargar exactamente los IDs de los temas de la semana desde la portada pública
  useEffect(() => {
    let isCancelled = false;
    const fetchWeeklyThemes = async () => {
      setLoadingWeekly(true);
      try {
        const blocks = await getRenderableBlocks('home_page', 0);
        const ids = collectWeeklyThemeIds(blocks);
        if (!isCancelled) {
          setWeeklyThemeIds(ids);
          // Si no hay temas configurados en la semana, pasar a 'primer' por seguridad
          if (ids.length === 0) {
            setCategoryFilter('primer');
          }
        }
      } catch (err) {
        console.warn('Error al cargar temas de la semana:', err);
      } finally {
        if (!isCancelled) setLoadingWeekly(false);
      }
    };

    void fetchWeeklyThemes();
    return () => {
      isCancelled = true;
    };
  }, []);

  const normalizedSearch = normalize(search.trim());

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

      // 3. Filtro de búsqueda textual
      if (!normalizedSearch) return true;
      if (normalize(tema.nombre).includes(normalizedSearch)) return true;
      return subtemas.some(
        subtema => subtema.tema_id === tema.id && normalize(subtema.nombre).includes(normalizedSearch)
      );
    });
  }, [categoryFilter, normalizedSearch, subtemas, temas, weeklyThemeIds]);

  const showMainPages = categoryFilter === 'todos' || categoryFilter === 'principales';

  return (
    <div style={{ width: '100%', maxWidth: '1360px', margin: '0 auto', padding: '10px 0 40px' }}>
      {/* ─── BANNER / BARRA PRINCIPAL DE BÚSQUEDA Y FILTROS ─── */}
      <div style={{
        background: 'linear-gradient(135deg, #ffffff 0%, #f0f7fc 100%)',
        borderRadius: '24px',
        padding: '32px 28px',
        border: '1px solid #dce7ef',
        boxShadow: '0 12px 36px rgba(23,65,101,0.06)',
        marginBottom: '32px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px 12px', borderRadius: '999px', background: '#e0f2fe', color: '#0284c7', fontSize: '0.78rem', fontWeight: 800, marginBottom: '8px' }}>
              <Compass size={14} />
              <span>Explorador Visual de Páginas</span>
            </div>
            <h2 style={{ fontSize: 'clamp(1.4rem, 2.5vw, 1.9rem)', fontWeight: 900, color: '#0f3b5c', margin: 0 }}>
              ¿Qué página deseas diseñar o editar?
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.92rem', margin: '6px 0 0' }}>
              {categoryFilter === 'semana'
                ? 'Mostrando exclusivamente los temas activos de la semana en curso.'
                : 'Selecciona una sección del catálogo para gestionar su historial de versiones y contenido.'}
            </p>
          </div>

          {/* Buscador grande */}
          <div style={{ position: 'relative', width: '100%', maxWidth: '380px' }}>
            <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar tema, subtema o portada..."
              style={{
                width: '100%',
                padding: '12px 38px 12px 42px',
                borderRadius: '14px',
                border: '1.5px solid #cbd5e1',
                background: '#ffffff',
                fontSize: '0.9rem',
                fontWeight: 600,
                outline: 'none',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                boxSizing: 'border-box',
              }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Chips de filtro rápido */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          {[
            { id: 'semana', label: '⭐ Temas de la Semana', isWeeklyHighlight: true },
            { id: 'primer', label: '1° Parcial', isWeeklyHighlight: false },
            { id: 'segundo', label: '2° Parcial', isWeeklyHighlight: false },
            { id: 'tercer', label: '3° Parcial', isWeeklyHighlight: false },
            { id: 'principales', label: '⭐ Portada y Temario', isWeeklyHighlight: false },
            { id: 'todos', label: 'Todos los Temas', isWeeklyHighlight: false },
          ].map(chip => {
            const isSelected = categoryFilter === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setCategoryFilter(chip.id as FilterCategory)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '10px',
                  border: isSelected
                    ? '1.5px solid #0284c7'
                    : chip.isWeeklyHighlight
                      ? '1.5px solid #93c5fd'
                      : '1px solid #cbd5e1',
                  background: isSelected
                    ? '#0284c7'
                    : chip.isWeeklyHighlight
                      ? '#eff6ff'
                      : '#ffffff',
                  color: isSelected
                    ? '#ffffff'
                    : chip.isWeeklyHighlight
                      ? '#1d4ed8'
                      : '#334155',
                  fontSize: '0.84rem',
                  fontWeight: 850,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: isSelected ? '0 4px 12px rgba(2,132,199,0.25)' : 'none',
                }}
              >
                <span>{chip.label}</span>
                {chip.isWeeklyHighlight && (
                  <span style={{
                    fontSize: '0.66rem',
                    fontWeight: 900,
                    background: isSelected ? 'rgba(255,255,255,0.25)' : '#dbeafe',
                    color: isSelected ? '#ffffff' : '#1d4ed8',
                    padding: '2px 6px',
                    borderRadius: '999px',
                    letterSpacing: '0.02em',
                  }}>
                    {weeklyThemeIds.length} activos
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── SECCIÓN 1: PÁGINAS PRINCIPALES DEL SISTEMA (SI APLICA) ─── */}
      {showMainPages && !normalizedSearch && (
        <div style={{ marginBottom: '36px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Home size={18} color="#0284c7" />
            <h3 style={{ fontSize: '1.15rem', fontWeight: 850, color: '#0f3b5c', margin: 0 }}>
              Páginas Principales del Atlas
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '18px' }}>
            {/* Tarjeta Inicio */}
            <div
              onClick={() => onSelect({ kind: 'home', label: 'Inicio' })}
              style={{
                padding: '22px',
                borderRadius: '18px',
                background: '#ffffff',
                border: '1.5px solid #dce7ef',
                boxShadow: '0 6px 18px rgba(23,65,101,0.05)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.2s ease',
              }}
              className="page-selector-card"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)', color: '#0284c7', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <Home size={24} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <h4 style={{ fontSize: '1.05rem', fontWeight: 850, color: '#0f172a', margin: 0 }}>Portada / Inicio</h4>
                    <span style={{ fontSize: '0.65rem', background: '#dbeafe', color: '#1d4ed8', padding: '1px 6px', borderRadius: '4px', fontWeight: 800 }}>Hero</span>
                  </div>
                  <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '4px 0 0' }}>
                    Diseño de la portada principal, banner de bienvenida y accesos directos.
                  </p>
                </div>
              </div>
              <div style={{ color: '#0284c7', display: 'grid', placeItems: 'center', padding: '8px' }}>
                <ArrowRight size={20} />
              </div>
            </div>

            {/* Tarjeta Temario */}
            <div
              onClick={() => onSelect({ kind: 'temario', label: 'Temario' })}
              style={{
                padding: '22px',
                borderRadius: '18px',
                background: '#ffffff',
                border: '1.5px solid #dce7ef',
                boxShadow: '0 6px 18px rgba(23,65,101,0.05)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.2s ease',
              }}
              className="page-selector-card"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)', color: '#0284c7', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <Layers3 size={24} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <h4 style={{ fontSize: '1.05rem', fontWeight: 850, color: '#0f172a', margin: 0 }}>Temario General</h4>
                    <span style={{ fontSize: '0.65rem', background: '#dbeafe', color: '#1d4ed8', padding: '1px 6px', borderRadius: '4px', fontWeight: 800 }}>Catálogo</span>
                  </div>
                  <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '4px 0 0' }}>
                    Catálogo de parciales y listado de temas académicos.
                  </p>
                </div>
              </div>
              <div style={{ color: '#0284c7', display: 'grid', placeItems: 'center', padding: '8px' }}>
                <ArrowRight size={20} />
              </div>
            </div>

            {/* Tarjeta Créditos (si aplica) */}
            {showCredits && (
              <div
                onClick={() => onSelect({ kind: 'credits', label: 'Créditos' })}
                style={{
                  padding: '22px',
                  borderRadius: '18px',
                  background: '#ffffff',
                  border: '1.5px solid #dce7ef',
                  boxShadow: '0 6px 18px rgba(23,65,101,0.05)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.2s ease',
                }}
                className="page-selector-card"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', color: '#b45309', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <BadgeInfo size={24} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '1.05rem', fontWeight: 850, color: '#0f172a', margin: 0 }}>Créditos del Sitio</h4>
                    <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '4px 0 0' }}>
                      Reconocimientos institucionales y autorías de fotografías.
                    </p>
                  </div>
                </div>
                <div style={{ color: '#b45309', display: 'grid', placeItems: 'center', padding: '8px' }}>
                  <ArrowRight size={20} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── SECCIÓN 2: CATÁLOGO DE TEMAS & SUBTEMAS ─── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FlaskConical size={18} color="#0284c7" />
            <h3 style={{ fontSize: '1.15rem', fontWeight: 850, color: '#0f3b5c', margin: 0 }}>
              {categoryFilter === 'semana'
                ? `Temas de la Semana en Curso (${filteredTemas.length})`
                : `Temas y Subtemas (${filteredTemas.length})`}
            </h3>
          </div>
          <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>
            Haz clic en un tema o subtema para abrir su historial de versiones
          </span>
        </div>

        {loading || loadingWeekly ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#64748b', background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
            <div style={{ width: '36px', height: '36px', border: '3px solid #e2e8f0', borderTop: '3px solid #0284c7', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            Cargando temas de la semana...
          </div>
        ) : filteredTemas.length === 0 ? (
          <div style={{ padding: '50px', textAlign: 'center', background: '#ffffff', borderRadius: '20px', border: '1.5px dashed #cbd5e1', color: '#64748b' }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '1rem' }}>
              {categoryFilter === 'semana'
                ? 'No hay temas marcados actualmente en la publicación de la semana.'
                : 'No se encontraron páginas en esta categoría.'}
            </p>
            <button
              type="button"
              onClick={() => { setSearch(''); setCategoryFilter('todos'); }}
              style={{
                marginTop: '14px',
                padding: '7px 16px',
                background: '#0284c7',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 750,
                fontSize: '0.82rem',
                cursor: 'pointer',
              }}
            >
              Ver todos los temas del Atlas
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
            {filteredTemas.map(tema => {
              const children = subtemas.filter(
                subtema =>
                  subtema.tema_id === tema.id &&
                  (!normalizedSearch ||
                    normalize(tema.nombre).includes(normalizedSearch) ||
                    normalize(subtema.nombre).includes(normalizedSearch))
              );

              const isWeeklyTema = weeklyThemeIds.includes(tema.id);

              return (
                <div
                  key={tema.id}
                  style={{
                    background: '#ffffff',
                    borderRadius: '20px',
                    border: isWeeklyTema ? '1.5px solid #93c5fd' : '1.5px solid #dce7ef',
                    boxShadow: isWeeklyTema ? '0 8px 24px rgba(2,132,199,0.08)' : '0 6px 20px rgba(23,65,101,0.04)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  }}
                >
                  {/* Cabecera del Tema */}
                  <div style={{
                    padding: '16px 20px',
                    background: isWeeklyTema
                      ? 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)'
                      : 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                    borderBottom: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: isWeeklyTema ? '#0284c7' : '#e0f2fe', color: isWeeklyTema ? '#fff' : '#0284c7', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                        <Folder size={18} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            {tema.parcial || 'General'}
                          </span>
                          {isWeeklyTema && (
                            <span style={{ fontSize: '0.65rem', fontWeight: 900, background: '#dbeafe', color: '#1e40af', padding: '1px 6px', borderRadius: '4px' }}>
                              SEMANA EN CURSO
                            </span>
                          )}
                        </div>
                        <h4 style={{ fontSize: '0.98rem', fontWeight: 850, color: '#0f172a', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {tema.nombre}
                        </h4>
                      </div>
                    </div>

                    {/* Botón para editar la página del tema */}
                    <button
                      type="button"
                      onClick={() => onSelect({ kind: 'tema', id: tema.id, label: tema.nombre })}
                      style={{
                        padding: '5px 10px',
                        borderRadius: '8px',
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        color: '#0f172a',
                        fontSize: '0.74rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        flexShrink: 0,
                        transition: 'background 0.15s ease',
                      }}
                      title="Editar página principal de este tema"
                    >
                      <span>Editar Tema</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>

                  {/* Subtemas de este tema */}
                  <div style={{ padding: '12px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {children.length > 0 ? (
                      children.map(subtema => (
                        <button
                          key={subtema.id}
                          type="button"
                          onClick={() =>
                            onSelect({
                              kind: 'subtema',
                              id: subtema.id,
                              temaId: tema.id,
                              label: subtema.nombre,
                              parentLabel: tema.nombre,
                            })
                          }
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 12px',
                            borderRadius: '10px',
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            color: '#334155',
                            fontSize: '0.84rem',
                            fontWeight: 750,
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = '#f0f9ff';
                            e.currentTarget.style.borderColor = '#7dd3fc';
                            e.currentTarget.style.color = '#0284c7';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = '#f8fafc';
                            e.currentTarget.style.borderColor = '#e2e8f0';
                            e.currentTarget.style.color = '#334155';
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FileText size={15} color="#0284c7" />
                            <span>{subtema.nombre}</span>
                          </div>
                          <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 800 }}>
                            Versiones →
                          </span>
                        </button>
                      ))
                    ) : (
                      <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '8px 4px' }}>
                        Sin subtemas registrados
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default FullScreenPageSelector;
