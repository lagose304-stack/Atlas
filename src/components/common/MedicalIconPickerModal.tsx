import React, { useState, useMemo, useEffect } from 'react';
import { Search, X, Sparkles, Layers } from 'lucide-react';
import {
  MEDICAL_ICONS_CATALOG,
  MedicalIcon,
  HISTOLOGY_TOPIC_LABELS,
  HistologyTopicCategory,
} from './MedicalIcon';

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

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setSelectedTopic('all');
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

  const filteredIcons = useMemo(() => {
    const term = search.trim().toLowerCase();

    return MEDICAL_ICONS_CATALOG.filter(icon => {
      // Filtro por tema histológico
      if (selectedTopic !== 'all' && icon.topic !== selectedTopic) {
        return false;
      }

      // Filtro por término de búsqueda (nombre, id, keywords, categoría)
      if (!term) return true;

      const topicLabel = HISTOLOGY_TOPIC_LABELS[icon.topic]?.label.toLowerCase() || '';
      return (
        icon.name.toLowerCase().includes(term) ||
        icon.id.toLowerCase().includes(term) ||
        icon.topic.toLowerCase().includes(term) ||
        topicLabel.includes(term) ||
        icon.keywords.some(k => k.toLowerCase().includes(term))
      );
    });
  }, [search, selectedTopic]);

  if (!isOpen) return null;

  const topicEntries = Object.entries(HISTOLOGY_TOPIC_LABELS) as [HistologyTopicCategory, { label: string; icon: string }][];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
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
          maxWidth: '760px',
          maxHeight: '88vh',
          backgroundColor: '#ffffff',
          borderRadius: '24px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
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
            padding: '20px 24px 16px 24px',
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
                fontSize: '1.18rem',
                fontWeight: 800,
                color: '#0f172a',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Sparkles size={20} color="#4f46e5" />
              {title}
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
              Biblioteca con más de 120 íconos para los 20 temas de histología y correlación médica
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
            padding: '16px 24px',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            background: '#ffffff',
          }}
        >
          {/* Input de búsqueda */}
          <div style={{ position: 'relative' }}>
            <Search
              size={18}
              style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#94a3b8',
                pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por tema, órgano, célula o término (ej: epitelio, tiroides, adiposo, hueso, neurona, frotis, mama, ojo)..."
              style={{
                width: '100%',
                padding: '11px 40px 11px 42px',
                borderRadius: '12px',
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
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  display: 'flex',
                  padding: 2,
                }}
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Selector horizontal de los 20 temas de histología */}
          <div
            style={{
              display: 'flex',
              gap: '6px',
              overflowX: 'auto',
              paddingBottom: '6px',
              scrollbarWidth: 'thin',
            }}
          >
            {topicEntries.map(([topicKey, meta]) => {
              const isActive = selectedTopic === topicKey;
              const count = topicKey === 'all'
                ? MEDICAL_ICONS_CATALOG.length
                : MEDICAL_ICONS_CATALOG.filter(i => i.topic === topicKey).length;

              return (
                <button
                  key={topicKey}
                  type="button"
                  onClick={() => setSelectedTopic(topicKey)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '10px',
                    border: '1px solid',
                    borderColor: isActive ? '#4f46e5' : '#e2e8f0',
                    background: isActive ? '#4f46e5' : '#f8fafc',
                    color: isActive ? '#ffffff' : '#334155',
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
                      background: isActive ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
                      color: isActive ? '#ffffff' : '#64748b',
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

        {/* Grid de Íconos */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px 24px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(136px, 1fr))',
            gap: '12px',
            alignContent: 'start',
          }}
        >
          {filteredIcons.length === 0 ? (
            <div
              style={{
                gridColumn: '1 / -1',
                textAlign: 'center',
                padding: '48px 16px',
                color: '#64748b',
              }}
            >
              <Search size={36} style={{ opacity: 0.3, marginBottom: '10px' }} />
              <p style={{ margin: 0, fontWeight: 700, fontSize: '1rem' }}>No se encontraron íconos</p>
              <small style={{ color: '#94a3b8', marginTop: '4px', display: 'block' }}>
                Intenta con otro término o selecciona "🌟 Todos los Íconos"
              </small>
            </div>
          ) : (
            filteredIcons.map(icon => {
              const isSelected = selectedIconId === icon.id;
              const topicMeta = HISTOLOGY_TOPIC_LABELS[icon.topic];

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
                    gap: '7px',
                    padding: '12px 8px',
                    borderRadius: '16px',
                    border: '1.5px solid',
                    borderColor: isSelected ? '#4f46e5' : '#f1f5f9',
                    background: isSelected ? '#eef2ff' : '#ffffff',
                    cursor: 'pointer',
                    transition: 'all 0.18s ease',
                    boxShadow: isSelected ? '0 4px 14px rgba(79, 70, 229, 0.18)' : '0 1px 2px rgba(0,0,0,0.02)',
                    position: 'relative',
                  }}
                  onMouseEnter={e => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = '#c7d2fe';
                      e.currentTarget.style.background = '#f8fafc';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = '#f1f5f9';
                      e.currentTarget.style.background = '#ffffff';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }
                  }}
                  title={`${icon.name} (${topicMeta?.label || icon.topic})`}
                >
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '12px',
                      background: isSelected ? '#4f46e5' : '#f8fafc',
                      color: isSelected ? '#ffffff' : '#334155',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.18s ease',
                      border: isSelected ? 'none' : '1px solid #e2e8f0',
                    }}
                  >
                    <MedicalIcon name={icon.id} size={23} color={isSelected ? '#ffffff' : '#4f46e5'} />
                  </div>

                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      color: isSelected ? '#3730a3' : '#1e293b',
                      textAlign: 'center',
                      lineHeight: 1.25,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      padding: '0 2px',
                    }}
                  >
                    {icon.name}
                  </span>

                  {topicMeta && icon.topic !== 'all' && (
                    <span
                      style={{
                        fontSize: '0.62rem',
                        fontWeight: 650,
                        color: isSelected ? '#4338ca' : '#64748b',
                        background: isSelected ? '#e0e7ff' : '#f1f5f9',
                        padding: '1px 6px',
                        borderRadius: '999px',
                        maxWidth: '92%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {topicMeta.icon} {topicMeta.label}
                    </span>
                  )}
                </button>
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
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <Layers size={13} color="#4f46e5" />
            20 temas de histología integrados
          </span>
        </div>
      </div>
    </div>
  );
};

export default MedicalIconPickerModal;
