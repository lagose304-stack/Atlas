import React, { useEffect, useState } from 'react';

interface RequiredTextPromptModalProps {
  title: string;
  description?: string;
  placeholder?: string;
  initialValue?: string;
  required?: boolean;
  cancelLabel?: string;
  onSubmit: (value: string) => void;
  onCancel?: () => void;
}

const RequiredTextPromptModal: React.FC<RequiredTextPromptModalProps> = ({
  title,
  description,
  placeholder,
  initialValue = '',
  required = true,
  cancelLabel = 'Cancelar',
  onSubmit,
  onCancel,
}) => {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && onCancel) onCancel();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [required, onCancel]);

  const handleSubmit = () => {
    const normalized = value.trim();
    if (!normalized) return;
    onSubmit(normalized);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1700,
        background: 'rgba(15, 23, 42, 0.68)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onCancel ? onCancel : undefined}
    >
      <div
        style={{
          width: 'min(520px, 96vw)',
          borderRadius: '14px',
          background: '#fff',
          boxShadow: '0 24px 64px rgba(15,23,42,0.35)',
          overflow: 'hidden',
        }}
        onClick={event => event.stopPropagation()}
      >
        <div style={{ padding: '16px 18px', borderBottom: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: 0, fontSize: '1.03em', color: '#0f172a', fontWeight: 800 }}>{title}</h3>
          {description && (
            <p style={{ margin: '8px 0 0', color: '#475569', fontSize: '0.9em', lineHeight: 1.5 }}>
              {description}
            </p>
          )}
        </div>

        <div style={{ padding: '16px 18px' }}>
          <input
            autoFocus
            value={value}
            onChange={event => setValue(event.target.value)}
            placeholder={placeholder ?? ''}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleSubmit();
              }
            }}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              border: '2px solid #c7d2fe',
              borderRadius: '10px',
              padding: '12px 14px',
              fontSize: '0.98em',
              outline: 'none',
              fontFamily: 'inherit',
              color: '#0f172a',
            }}
          />
        </div>

        <div
          style={{
            padding: '12px 18px 16px',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px',
            borderTop: '1px solid #e2e8f0',
          }}
        >
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              style={{
                border: '1px solid #cbd5e1',
                background: '#fff',
                color: '#475569',
                borderRadius: '8px',
                padding: '8px 12px',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {cancelLabel}
            </button>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            style={{
              border: 'none',
              background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
              color: '#fff',
              borderRadius: '8px',
              padding: '8px 12px',
              fontWeight: 800,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Guardar nombre
          </button>
        </div>
      </div>
    </div>
  );
};

export default RequiredTextPromptModal;
