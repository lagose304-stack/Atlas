import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../services/supabase';

interface TincionOption {
  id: number;
  nombre: string;
  sort_order: number | null;
  activo: boolean | null;
}

interface TincionAccordionSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

const TincionAccordionSelector: React.FC<TincionAccordionSelectorProps> = ({
  value,
  onChange,
}) => {
  const [items, setItems] = useState<TincionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const fetchTinciones = async () => {
      setLoading(true);
      setLoadError('');

      const { data, error } = await supabase
        .from('tinciones')
        .select('id, nombre, sort_order, activo')
        .eq('activo', true)
        .order('id', { ascending: true });

      if (error) {
        setLoadError('No se pudo cargar el catalogo de tinciones.');
        setItems([]);
      } else {
        setItems((data ?? []) as TincionOption[]);
      }

      setLoading(false);
    };

    fetchTinciones();
  }, []);

  const hasValue = value.trim() !== '';

  const selectedLabel = useMemo(() => {
    const current = value.trim();
    if (!current) return '';
    return current;
  }, [value]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        style={{
          border: '1.5px solid #fde68a',
          background: open ? 'linear-gradient(135deg, #fef3c7, #fffbeb)' : '#fffbeb',
          color: '#92400e',
          borderRadius: '10px',
          padding: '8px 12px',
          cursor: 'pointer',
          fontWeight: 700,
          fontSize: '0.88em',
          textAlign: 'left',
          fontFamily: 'inherit',
        }}
      >
        {open ? '▾' : '▸'} Catalogo de tinciones
      </button>

      {open && (
        <div
          style={{
            border: '1px solid #fde68a',
            background: '#fffdf4',
            borderRadius: '10px',
            padding: '10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {loading && (
            <span style={{ color: '#a16207', fontSize: '0.84em', fontWeight: 600 }}>
              Cargando tinciones...
            </span>
          )}

          {!loading && loadError && (
            <span style={{ color: '#b91c1c', fontSize: '0.84em', fontWeight: 600 }}>
              {loadError}
            </span>
          )}

          {!loading && !loadError && items.length === 0 && (
            <span style={{ color: '#a16207', fontSize: '0.84em' }}>
              No hay tinciones configuradas.
            </span>
          )}

          {!loading && !loadError && items.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {items.map(item => {
                const selected = item.nombre === value;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onChange(selected ? '' : item.nombre)}
                    style={{
                      border: selected ? '1px solid #f59e0b' : '1px solid #fde68a',
                      background: selected
                        ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                        : 'linear-gradient(135deg, #ffffff, #fffbeb)',
                      color: selected ? '#ffffff' : '#92400e',
                      borderRadius: '999px',
                      padding: '6px 12px',
                      cursor: 'pointer',
                      fontWeight: selected ? 700 : 600,
                      fontSize: '0.8em',
                      fontFamily: 'inherit',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.nombre}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {hasValue && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            border: '1px solid #fde68a',
            background: '#fff7ed',
            borderRadius: '9px',
            padding: '8px 10px',
          }}
        >
          <span style={{ color: '#92400e', fontSize: '0.84em', fontWeight: 700 }}>
            Seleccionada: {selectedLabel}
          </span>
          <button
            type="button"
            onClick={() => onChange('')}
            style={{
              border: '1px solid #fde68a',
              background: '#ffffff',
              color: '#92400e',
              borderRadius: '8px',
              padding: '4px 8px',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.78em',
              fontFamily: 'inherit',
            }}
          >
            🗑️ Eliminar
          </button>
        </div>
      )}
    </div>
  );
};

export default TincionAccordionSelector;
