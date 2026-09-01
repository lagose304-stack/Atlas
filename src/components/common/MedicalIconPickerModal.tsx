import React, { useState, useMemo, useEffect } from 'react';
import { Search, X, Sparkles } from 'lucide-react';
import { MEDICAL_ICONS_CATALOG, MedicalIcon } from './MedicalIcon';

export interface MedicalIconPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectIcon: (iconId: string) => void;
  selectedIconId?: string;
  title?: string;
}

type IconCategory = 'all' | 'anatomy' | 'physiology' | 'lab' | 'clinical';

const CATEGORY_LABELS: Record<IconCategory, string> = {
  all: '🌟 Todos',
  anatomy: '🫀 Órganos & Anatomía',
  physiology: '⚡ Fisiología & Procesos',
  lab: '🔬 Laboratorio & Célula',
  clinical: '🩺 Clínica & Símbolos',
};

export const MedicalIconPickerModal: React.FC<MedicalIconPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectIcon,
  selectedIconId,
  title = 'Seleccionar Ícono Médico',
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<IconCategory>('all');

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setSelectedCategory('all');
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
      // Filtro por categoría
      if (selectedCategory !== 'all' && icon.category !== selectedCategory) {
        return false;
      }

      // Filtro por término de búsqueda
      if (!term) return true;

      return (
        icon.name.toLowerCase().includes(term) ||
        icon.id.toLowerCase().includes(term) ||
        icon.keywords.some(k => k.toLowerCase().includes(term))
      );
    });
  }, [search, selectedCategory]);

  if (!isOpen) return null;

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
          maxWidth: '680px',
          maxHeight: '85vh',
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
                fontSize: '1.15rem',
                fontWeight: 800,
                color: '#0f172a',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Sparkles size={19} color="#4f46e5" />
              {title}
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
              Elige entre más de 80 íconos médicos y fisiológicos especializados para tu plantilla
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '50%',
              width: '34px',
              height: '34px',
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

        {/* Buscador & Categorías */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
              placeholder="Buscar por nombre, órgano o función (ej: riñón, pulmón, filtro, adn, célula)..."
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

          {/* Categorías en chips */}
          <div
            style={{
              display: 'flex',
              gap: '6px',
              overflowX: 'auto',
              paddingBottom: '2px',
            }}
          >
            {(Object.keys(CATEGORY_LABELS) as IconCategory[]).map(cat => {
              const isActive = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: '1px solid',
                    borderColor: isActive ? '#4f46e5' : '#e2e8f0',
                    background: isActive ? '#4f46e5' : '#f8fafc',
                    color: isActive ? '#ffffff' : '#475569',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {CATEGORY_LABELS[cat]}
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
            gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
            gap: '12px',
            alignContent: 'start',
          }}
        >
          {filteredIcons.length === 0 ? (
            <div
              style={{
                gridColumn: '1 / -1',
                textAlign: 'center',
                padding: '40px 16px',
                color: '#64748b',
              }}
            >
              <Search size={32} style={{ opacity: 0.3, marginBottom: '8px' }} />
              <p style={{ margin: 0, fontWeight: 700 }}>No se encontraron íconos</p>
              <small style={{ color: '#94a3b8' }}>
                Intenta con otro término (ej: 'riñón', 'corazón', 'escudo', 'célula')
              </small>
            </div>
          ) : (
            filteredIcons.map(icon => {
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
                    gap: '8px',
                    padding: '14px 10px',
                    borderRadius: '16px',
                    border: '1.5px solid',
                    borderColor: isSelected ? '#4f46e5' : '#f1f5f9',
                    background: isSelected ? '#eef2ff' : '#ffffff',
                    cursor: 'pointer',
                    transition: 'all 0.18s ease',
                    boxShadow: isSelected ? '0 4px 12px rgba(79, 70, 229, 0.15)' : 'none',
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
                >
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '12px',
                      background: isSelected ? '#4f46e5' : '#f8fafc',
                      color: isSelected ? '#ffffff' : '#334155',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.18s ease',
                    }}
                  >
                    <MedicalIcon name={icon.id} size={22} color={isSelected ? '#ffffff' : '#4f46e5'} />
                  </div>
                  <span
                    style={{
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      color: isSelected ? '#3730a3' : '#334155',
                      textAlign: 'center',
                      lineHeight: 1.2,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {icon.name}
                  </span>
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
            Mostrando <strong>{filteredIcons.length}</strong> de {MEDICAL_ICONS_CATALOG.length} íconos disponibles
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '7px 16px',
              borderRadius: '999px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default MedicalIconPickerModal;
