import React, { useState, useMemo } from 'react';
import { renderBoldText } from '../BoldField';
import type { ContentBlock } from '../../types/contentBlocks';

export interface DivisionItem {
  id: string;
  index: number;
  title: string;
  subtitle?: string;
}

export interface TopicDivisionsBlockProps {
  divisionsCount?: number;
  divisions?: DivisionItem[];
  accentColor?: string;
  childrenBlocks?: ContentBlock[];
  renderChildBlock?: (child: ContentBlock) => React.ReactNode;
  editorMode?: boolean;
  selectedTab?: number;
  onTabChange?: (tabIndex: number) => void;
  onDropBlockOnTab?: (tabIndex: number, event: React.DragEvent) => void;
  onDragOverTab?: (tabIndex: number, event: React.DragEvent) => void;
}

export const TopicDivisionsBlock: React.FC<TopicDivisionsBlockProps> = ({
  divisionsCount = 3,
  divisions: customDivisions,
  accentColor = '#0284c7',
  childrenBlocks = [],
  renderChildBlock,
  editorMode = false,
  selectedTab,
  onTabChange,
  onDropBlockOnTab,
  onDragOverTab,
}) => {
  // Estado local para pestaña activa en modo lectura / previsualización
  const [internalActiveTab, setInternalActiveTab] = useState<number>(1);
  const activeTab = selectedTab !== undefined ? selectedTab : internalActiveTab;

  const handleTabClick = (idx: number) => {
    setInternalActiveTab(idx);
    onTabChange?.(idx);
  };

  // Construir la lista de divisiones si no se pasa explícita
  const effectiveDivisions = useMemo<DivisionItem[]>(() => {
    if (customDivisions && customDivisions.length > 0) {
      return customDivisions;
    }
    const count = Math.max(0, divisionsCount);
    return Array.from({ length: count }, (_, i) => ({
      id: `div-${i + 1}`,
      index: i + 1,
      title: '',
      subtitle: '',
    }));
  }, [customDivisions, divisionsCount]);

  // Contar componentes por división
  const countsByDivision = useMemo(() => {
    const map = new Map<number, number>();
    childrenBlocks.forEach(child => {
      const tabNum = Number(child.content.layout_tab || child.content.layout_column || 1);
      map.set(tabNum, (map.get(tabNum) || 0) + 1);
    });
    return map;
  }, [childrenBlocks]);

  // Filtrar los bloques hijos de la división activa
  const activeChildren = useMemo(() => {
    return childrenBlocks.filter(child => {
      const tabNum = Number(child.content.layout_tab || child.content.layout_column || 1);
      return tabNum === activeTab;
    });
  }, [childrenBlocks, activeTab]);

  const effectiveAccent = accentColor && accentColor.trim() !== '' ? accentColor : '#0284c7';

  if (effectiveDivisions.length === 0) {
    if (editorMode) {
      return (
        <div
          className="topic-divisions-block topic-divisions-empty"
          style={{
            width: '100%',
            padding: '24px 16px',
            textAlign: 'center',
            background: '#f8fafc',
            borderRadius: '16px',
            border: '1.5px dashed #cbd5e1',
            color: '#64748b',
            fontFamily: '"Montserrat", "Segoe UI", sans-serif',
            fontSize: '0.85rem',
            margin: '4px 0 0 0',
            boxSizing: 'border-box',
          }}
        >
          📂 Contenedor de Divisiones vacío. Selecciona la cantidad de apartados en el editor para comenzar.
        </div>
      );
    }
    return null;
  }

  return (
    <div
      className="topic-divisions-block"
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 'clamp(14px, 2vw, 20px)',
        fontFamily: '"Montserrat", "Segoe UI", sans-serif',
        margin: '4px 0 0 0',
      }}
    >
      {/* ─── BARRA DE NAVEGACIÓN ESTILO TEMARIO ─── */}
      <div
        className="topic-divisions-nav-bar"
        style={{
          width: '100%',
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.max(1, effectiveDivisions.length)}, minmax(0, 1fr))`,
          background: '#f8fafc',
          borderTop: `1.5px solid #cbd5e1`,
          borderBottom: `2.5px solid #e2e8f0`,
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 4px 16px -2px rgba(15, 23, 42, 0.05)',
          boxSizing: 'border-box',
        }}
      >
        {effectiveDivisions.map(div => {
          const isActive = div.index === activeTab;
          const childCount = countsByDivision.get(div.index) || 0;
          const numStr = String(div.index).padStart(2, '0');

          return (
            <button
              key={div.id || div.index}
              type="button"
              onClick={() => handleTabClick(div.index)}
              onDragOver={event => onDragOverTab?.(div.index, event)}
              onDrop={event => onDropBlockOnTab?.(div.index, event)}
              className={`topic-division-tab ${isActive ? 'is-active' : ''}`}
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'clamp(8px, 1.4vw, 14px)',
                padding: 'clamp(12px, 1.8vw, 18px) clamp(10px, 1.5vw, 16px)',
                border: 'none',
                borderBottom: isActive ? `3.5px solid ${effectiveAccent}` : '3.5px solid transparent',
                background: isActive ? '#ffffff' : 'transparent',
                color: isActive ? '#0f172a' : '#64748b',
                cursor: 'pointer',
                fontFamily: 'inherit',
                textAlign: 'left',
                transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
                minWidth: 0,
                outline: 'none',
                boxSizing: 'border-box',
              }}
              title={`Ver división: ${div.title}`}
            >
              {/* Indicador numérico circular / rounded badge */}
              <div
                style={{
                  width: 'clamp(30px, 3.2vw, 36px)',
                  height: 'clamp(30px, 3.2vw, 36px)',
                  minWidth: 'clamp(30px, 3.2vw, 36px)',
                  borderRadius: '10px',
                  background: isActive
                    ? `linear-gradient(135deg, ${effectiveAccent} 0%, #0369a1 100%)`
                    : '#e2e8f0',
                  color: isActive ? '#ffffff' : '#475569',
                  fontSize: 'clamp(0.78rem, 1.1vw, 0.86rem)',
                  fontWeight: 850,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: isActive ? `0 3px 10px ${effectiveAccent}40` : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                {numStr}
              </div>

              {/* Título y Subtítulo de la División */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  minWidth: 0,
                  flex: 1,
                }}
              >
                <span
                  style={{
                    fontSize: 'clamp(0.86rem, 1.25vw, 0.98rem)',
                    fontWeight: isActive ? 850 : 700,
                    color: isActive ? '#0b2545' : '#475569',
                    letterSpacing: '-0.01em',
                    lineHeight: 1.25,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {renderBoldText(div.title || `División ${div.index}`)}
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {div.subtitle && div.subtitle.trim() !== '' ? (
                    <span
                      style={{
                        fontSize: 'clamp(0.70rem, 0.95vw, 0.76rem)',
                        fontWeight: 550,
                        color: isActive ? '#0369a1' : '#94a3b8',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {renderBoldText(div.subtitle)}
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: '0.70rem',
                        fontWeight: 600,
                        color: isActive ? '#0284c7' : '#94a3b8',
                      }}
                    >
                      {childCount} {childCount === 1 ? 'componente' : 'componentes'}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* ─── CONTENIDO DE LA DIVISIÓN ACTIVA ─── */}
      <div
        className="topic-division-content-slot"
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        {activeChildren.length > 0 ? (
          activeChildren.map(child => {
            if (renderChildBlock) {
              return (
                <React.Fragment key={child.id}>
                  {renderChildBlock(child)}
                </React.Fragment>
              );
            }
            return null;
          })
        ) : (
          <div
            style={{
              padding: 'clamp(28px, 4vw, 42px) 20px',
              borderRadius: '16px',
              border: `2px dashed ${editorMode ? '#93c5fd' : '#e2e8f0'}`,
              background: editorMode ? '#f0f9ff' : '#fafafa',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <span style={{ fontSize: '1.8rem' }}>📂</span>
            <strong style={{ fontSize: '0.94rem', color: '#1e3a8a' }}>
              División vacía: {effectiveDivisions.find(d => d.index === activeTab)?.title || `División ${activeTab}`}
            </strong>
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b', maxWidth: '420px', lineHeight: 1.4 }}>
              {editorMode
                ? 'Arrastra cualquier componente existente o añádelo desde la lista para asignarlo a este apartado del tema.'
                : 'No hay componentes asignados a este apartado todavía.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TopicDivisionsBlock;
