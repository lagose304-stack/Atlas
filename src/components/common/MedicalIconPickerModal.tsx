import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, X, Sparkles, Layers, Check } from 'lucide-react';
import {
  ORDERED_HISTOLOGY_TOPICS,
  HISTOLOGY_TOPIC_LABELS,
  HISTOLOGY_TOPIC_SYNONYMS,
  HistologyTopicCategory,
  MEDICAL_ICONS_CATALOG,
  normalizeSearchTerm,
  getTermVariations,
} from './medicalIconCatalog';
import { MedicalIcon } from './MedicalIcon';

export interface MedicalIconPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectIcon: (iconId: string) => void;
  selectedIconId?: string;
  title?: string;
}

export const MedicalIconPickerModal: React.FC<MedicalIconPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectIcon,
  selectedIconId,
  title = 'Seleccionar Ícono Médico e Histológico',
}) => {
  const [search, setSearch] = useState('');
  const [selectedTopic, setSelectedTopic] = useState<HistologyTopicCategory>('all');
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setSelectedTopic('all');
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lista ordenada de pestañas: 'all' primero, luego los 20 temas en orden y al final 'otros'
  const allTopicTabs: HistologyTopicCategory[] = useMemo(() => {
    return ['all', ...ORDERED_HISTOLOGY_TOPICS];
  }, []);

  // Búsqueda multi-término, insensible a mayúsculas y acentos/diacríticos
  const filteredIcons = useMemo(() => {
    const rawTokens = search.trim().split(/\s+/).filter(Boolean);

    return MEDICAL_ICONS_CATALOG.filter(icon => {
      // Si hay un tema específico seleccionado y no es 'all'
      if (selectedTopic !== 'all' && icon.topic !== selectedTopic) {
        return false;
      }

      // Si no hay término de búsqueda, mostrar todos los de la categoría seleccionada
      if (rawTokens.length === 0) {
        return true;
      }

      // Generar variantes morfológicas (singular/plural) para cada token
      const tokenVariantsList = rawTokens.map(t => getTermVariations(t));

      const normName = normalizeSearchTerm(icon.name);
      const normId = normalizeSearchTerm(icon.id);
      const normTopic = normalizeSearchTerm(icon.topic);
      const topicLabel = normalizeSearchTerm(HISTOLOGY_TOPIC_LABELS[icon.topic]?.label || '');
      const normKeywords = icon.keywords.map(k => normalizeSearchTerm(k));
      const topicSynonyms = (HISTOLOGY_TOPIC_SYNONYMS[icon.topic] || []).map(s => normalizeSearchTerm(s));

      // Cada palabra de búsqueda debe coincidir con alguna propiedad
      return tokenVariantsList.every(variants => {
        return variants.some(v => {
          return (
            normName.includes(v) ||
            normId.includes(v) ||
            normTopic.includes(v) ||
            topicLabel.includes(v) ||
            normKeywords.some(k => k.includes(v)) ||
            topicSynonyms.some(s => s.includes(v))
          );
        });
      });
    });
  }, [search, selectedTopic]);

  // Agrupación ordenada de los resultados por tema para una visualización perfectamente estructurada
  const groupedResults = useMemo(() => {
    const topicsOrder = selectedTopic === 'all'
      ? ORDERED_HISTOLOGY_TOPICS
      : [selectedTopic];

    return topicsOrder
      .map(topicKey => {
        const meta = HISTOLOGY_TOPIC_LABELS[topicKey];
        const icons = filteredIcons.filter(icon => icon.topic === topicKey);
        return {
          topicKey,
          meta,
          icons,
        };
      })
      .filter(group => group.icons.length > 0);
  }, [filteredIcons, selectedTopic]);

  // Conteo global de resultados para saber si hay coincidencias en otros temas
  const globalMatchCount = useMemo(() => {
    const rawTokens = search.trim().split(/\s+/).filter(Boolean);
    if (rawTokens.length === 0) return MEDICAL_ICONS_CATALOG.length;

    const tokenVariantsList = rawTokens.map(t => getTermVariations(t));

    return MEDICAL_ICONS_CATALOG.filter(icon => {
      const normName = normalizeSearchTerm(icon.name);
      const normId = normalizeSearchTerm(icon.id);
      const normTopic = normalizeSearchTerm(icon.topic);
      const topicLabel = normalizeSearchTerm(HISTOLOGY_TOPIC_LABELS[icon.topic]?.label || '');
      const normKeywords = icon.keywords.map(k => normalizeSearchTerm(k));
      const topicSynonyms = (HISTOLOGY_TOPIC_SYNONYMS[icon.topic] || []).map(s => normalizeSearchTerm(s));

      return tokenVariantsList.every(variants => {
        return variants.some(v => {
          return (
            normName.includes(v) ||
            normId.includes(v) ||
            normTopic.includes(v) ||
            topicLabel.includes(v) ||
            normKeywords.some(k => k.includes(v)) ||
            topicSynonyms.some(s => s.includes(v))
          );
        });
      });
    }).length;
  }, [search]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.72)',
        backdropFilter: 'blur(6px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.15s ease-out',
      }}
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '880px',
          maxHeight: '90vh',
          backgroundColor: '#ffffff',
          borderRadius: '24px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid #e2e8f0',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div
          style={{
            padding: '18px 24px 14px 24px',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(to right, #f8fafc, #ffffff)',
          }}
        >
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: '1.2rem',
                fontWeight: 800,
                color: '#0f172a',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Sparkles size={21} color="#4f46e5" />
              {title}
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
              Catálogo organizado en los <strong>20 temas histológicos</strong> + sección de diagnóstico y tinciones (<strong>{MEDICAL_ICONS_CATALOG.length} íconos</strong>)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal"
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#475569',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#e2e8f0';
              e.currentTarget.style.color = '#0f172a';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = '#f1f5f9';
              e.currentTarget.style.color = '#475569';
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Buscador & Selector de Temas Histológicos */}
        <div
          style={{
            padding: '14px 24px',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            background: '#ffffff',
          }}
        >
          {/* Input de búsqueda inteligente */}
          <div style={{ position: 'relative' }}>
            <Search
              size={18}
              style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#6366f1',
                pointerEvents: 'none',
              }}
            />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Escribe órgano, célula, tejido o tema (ej: epitelio, rinon, cartilago, musculo, ojo, mama, sangre, hueso, traquea)..."
              style={{
                width: '100%',
                padding: '11px 40px 11px 42px',
                borderRadius: '14px',
                border: '1.5px solid #cbd5e1',
                fontSize: '0.88rem',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s, box-shadow 0.2s',
              }}
              onFocus={e => {
                e.target.style.borderColor = '#4f46e5';
                e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.15)';
              }}
              onBlur={e => {
                e.target.style.borderColor = '#cbd5e1';
                e.target.style.boxShadow = 'none';
              }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Limpiar búsqueda"
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '50%',
                  color: '#64748b',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '24px',
                  height: '24px',
                  padding: 0,
                }}
                title="Borrar búsqueda"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Banner si hay 0 resultados en la pestaña activa pero sí en otros temas */}
          {selectedTopic !== 'all' && filteredIcons.length === 0 && globalMatchCount > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                borderRadius: '10px',
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                fontSize: '0.8rem',
                color: '#1e40af',
              }}
            >
              <span>
                No hay coincidencias en <strong>{HISTOLOGY_TOPIC_LABELS[selectedTopic]?.label}</strong>, pero hay <strong>{globalMatchCount}</strong> en otros temas.
              </span>
              <button
                type="button"
                onClick={() => setSelectedTopic('all')}
                style={{
                  background: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Buscar en todos los temas
              </button>
            </div>
          )}

          {/* Selector horizontal ordenado estrictamente: 'all', 20 temas del usuario, y 'otros' */}
          <div
            ref={scrollContainerRef}
            style={{
              display: 'flex',
              gap: '6px',
              overflowX: 'auto',
              paddingBottom: '4px',
              scrollbarWidth: 'thin',
            }}
          >
            {allTopicTabs.map(topicKey => {
              const meta = HISTOLOGY_TOPIC_LABELS[topicKey];
              const isActive = selectedTopic === topicKey;
              const count = topicKey === 'all'
                ? MEDICAL_ICONS_CATALOG.length
                : MEDICAL_ICONS_CATALOG.filter(i => i.topic === topicKey).length;

              return (
                <button
                  key={topicKey}
                  type="button"
                  onClick={() => {
                    setSelectedTopic(topicKey);
                    // Si al cambiar de tema la búsqueda deja 0 resultados, se limpia automáticamente para mostrar los íconos de inmediato
                    if (search) {
                      const hasMatchesInTopic = MEDICAL_ICONS_CATALOG.some(i => {
                        if (topicKey !== 'all' && i.topic !== topicKey) return false;
                        const v = normalizeSearchTerm(search);
                        return (
                          normalizeSearchTerm(i.name).includes(v) ||
                          normalizeSearchTerm(i.id).includes(v) ||
                          i.keywords.some(k => normalizeSearchTerm(k).includes(v))
                        );
                      });
                      if (!hasMatchesInTopic) {
                        setSearch('');
                      }
                    }
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '10px',
                    border: '1px solid',
                    borderColor: isActive ? '#4f46e5' : '#e2e8f0',
                    background: isActive ? '#4f46e5' : (topicKey === 'otros' ? '#fdf4ff' : '#f8fafc'),
                    color: isActive ? '#ffffff' : (topicKey === 'otros' ? '#86198f' : '#334155'),
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease',
                    flexShrink: 0,
                  }}
                  title={meta.label}
                >
                  <span>{meta.icon}</span>
                  <span>{meta.label}</span>
                  <span
                    style={{
                      background: isActive ? 'rgba(255,255,255,0.25)' : (topicKey === 'otros' ? '#f5d0fe' : '#e2e8f0'),
                      color: isActive ? '#ffffff' : (topicKey === 'otros' ? '#701a75' : '#64748b'),
                      fontSize: '0.68rem',
                      padding: '1px 5px',
                      borderRadius: '999px',
                      fontWeight: 800,
                    }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Contenedor con secciones ordenadas por tema */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          {groupedResults.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '48px 16px',
                color: '#64748b',
              }}
            >
              <Search size={38} style={{ opacity: 0.3, marginBottom: '12px' }} />
              <p style={{ margin: 0, fontWeight: 800, fontSize: '1.05rem', color: '#1e293b' }}>
                No se encontraron íconos para "{search}"
              </p>
              <p style={{ color: '#64748b', marginTop: '6px', fontSize: '0.85rem' }}>
                Prueba buscando por órgano, célula o término histológico (ej: <em>epitelio, riñon, musculo, ojo, cartilago</em>)
              </p>
              <div style={{ marginTop: '14px', display: 'flex', gap: '8px', justifyContent: 'center' }}>
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    style={{
                      background: '#4f46e5',
                      color: '#ffffff',
                      border: 'none',
                      padding: '7px 16px',
                      borderRadius: '10px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Borrar texto de búsqueda
                  </button>
                )}
                {selectedTopic !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setSelectedTopic('all')}
                    style={{
                      background: '#f1f5f9',
                      color: '#334155',
                      border: '1px solid #cbd5e1',
                      padding: '7px 16px',
                      borderRadius: '10px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Ver todos los temas
                  </button>
                )}
              </div>
            </div>
          ) : (
            groupedResults.map(group => {
              const isOtherCategory = group.topicKey === 'otros';

              return (
                <div key={group.topicKey} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {/* Encabezado del tema con su ícono y contador */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 14px',
                      borderRadius: '12px',
                      background: isOtherCategory ? '#fdf4ff' : '#f8fafc',
                      borderLeft: `4px solid ${isOtherCategory ? '#c026d3' : '#4f46e5'}`,
                      borderTop: '1px solid #f1f5f9',
                      borderRight: '1px solid #f1f5f9',
                      borderBottom: '1px solid #f1f5f9',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '1.2rem' }}>{group.meta.icon}</span>
                      <strong style={{ fontSize: '0.88rem', color: isOtherCategory ? '#701a75' : '#0f172a' }}>
                        {group.meta.label}
                      </strong>
                    </div>

                    <span
                      style={{
                        background: isOtherCategory ? '#f5d0fe' : '#e0e7ff',
                        color: isOtherCategory ? '#86198f' : '#3730a3',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: '999px',
                      }}
                    >
                      {group.icons.length} {group.icons.length === 1 ? 'ícono' : 'íconos'}
                    </span>
                  </div>

                  {/* Grid de íconos de este tema */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                      gap: '10px',
                    }}
                  >
                    {group.icons.map(icon => {
                      const isSelected = selectedIconId === icon.id;

                      return (
                        <button
                          key={icon.id}
                          type="button"
                          onClick={() => {
                            onSelectIcon(icon.id);
                            onClose();
                          }}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            padding: '12px 8px',
                            borderRadius: '16px',
                            border: '1.5px solid',
                            borderColor: isSelected ? '#4f46e5' : '#e2e8f0',
                            background: isSelected ? '#eef2ff' : '#ffffff',
                            cursor: 'pointer',
                            transition: 'all 0.18s ease',
                            boxShadow: isSelected ? '0 4px 14px rgba(79, 70, 229, 0.2)' : '0 1px 3px rgba(0,0,0,0.03)',
                            position: 'relative',
                          }}
                          onMouseEnter={e => {
                            if (!isSelected) {
                              e.currentTarget.style.borderColor = '#818cf8';
                              e.currentTarget.style.background = '#f8fafc';
                              e.currentTarget.style.transform = 'translateY(-2px)';
                            }
                          }}
                          onMouseLeave={e => {
                            if (!isSelected) {
                              e.currentTarget.style.borderColor = '#e2e8f0';
                              e.currentTarget.style.background = '#ffffff';
                              e.currentTarget.style.transform = 'translateY(0)';
                            }
                          }}
                          title={`${icon.name}\nTema: ${group.meta.label}\nID: ${icon.id}\nPalabras clave: ${icon.keywords.join(', ')}`}
                        >
                          {/* Badge de seleccionado */}
                          {isSelected && (
                            <div
                              style={{
                                position: 'absolute',
                                top: '6px',
                                right: '6px',
                                background: '#4f46e5',
                                color: '#ffffff',
                                borderRadius: '50%',
                                width: '18px',
                                height: '18px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '10px',
                              }}
                            >
                              <Check size={11} strokeWidth={3} />
                            </div>
                          )}

                          {/* Contenedor del ícono */}
                          <div
                            style={{
                              width: '46px',
                              height: '46px',
                              borderRadius: '12px',
                              background: isSelected ? '#4f46e5' : (isOtherCategory ? '#fdf4ff' : '#f1f5f9'),
                              color: isSelected ? '#ffffff' : (isOtherCategory ? '#c026d3' : '#4f46e5'),
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.18s ease',
                              border: isSelected ? 'none' : '1px solid #e2e8f0',
                            }}
                          >
                            <MedicalIcon name={icon.id} size={24} color={isSelected ? '#ffffff' : (isOtherCategory ? '#c026d3' : '#4f46e5')} />
                          </div>

                          {/* Nombre del ícono */}
                          <span
                            style={{
                              fontSize: '0.73rem',
                              fontWeight: 700,
                              color: isSelected ? '#3730a3' : '#1e293b',
                              textAlign: 'center',
                              lineHeight: 1.25,
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              padding: '0 2px',
                              minHeight: '2.5em',
                            }}
                          >
                            {icon.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 24px',
            borderTop: '1px solid #f1f5f9',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#fafafa',
            fontSize: '0.78rem',
            color: '#64748b',
          }}
        >
          <span>
            Mostrando <strong>{filteredIcons.length}</strong> de <strong>{MEDICAL_ICONS_CATALOG.length}</strong> íconos disponibles
            {search && ` (coincidencias para "${search}")`}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Layers size={14} color="#4f46e5" />
            20 temas ordenados + diagnóstico y tinciones
          </span>
        </div>
      </div>
    </div>
  );
};

export default MedicalIconPickerModal;
