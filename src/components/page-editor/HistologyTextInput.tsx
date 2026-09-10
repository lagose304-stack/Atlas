import React, { useRef, useState } from 'react';

export interface HistologyTextInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  minHeight?: string;
  style?: React.CSSProperties;
  className?: string;
  showBoldButton?: boolean;
  disabled?: boolean;
  onFocus?: React.FocusEventHandler<HTMLInputElement | HTMLTextAreaElement>;
  onBlur?: React.FocusEventHandler<HTMLInputElement | HTMLTextAreaElement>;
}

export const HistologyTextInput: React.FC<HistologyTextInputProps> = ({
  value,
  onChange,
  placeholder,
  multiline = false,
  rows = 3,
  minHeight,
  style = {},
  className = '',
  showBoldButton = true,
  disabled = false,
  onFocus,
  onBlur,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  /**
   * Aplica o remueve formato markdown (** para negritas, * para cursivas)
   * respetando la selección del usuario.
   */
  const applyFormatting = (marker: string) => {
    const el = inputRef.current;
    if (!el) return;

    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const markerLen = marker.length;
    const val = value || '';
    const selected = val.slice(start, end);

    if (start !== end) {
      // 1. Si el texto seleccionado ya incluye los marcadores en sus extremos: desenvolver
      if (selected.startsWith(marker) && selected.endsWith(marker) && selected.length >= markerLen * 2) {
        const unwrapped = selected.slice(markerLen, -markerLen);
        const next = val.slice(0, start) + unwrapped + val.slice(end);
        onChange(next);
        setTimeout(() => {
          el.focus();
          el.setSelectionRange(start, start + unwrapped.length);
        }, 0);
        return;
      }

      // 2. Si la selección está justo entre marcadores adyacentes: desenvolver
      if (
        start >= markerLen &&
        val.slice(start - markerLen, start) === marker &&
        val.slice(end, end + markerLen) === marker
      ) {
        const next = val.slice(0, start - markerLen) + selected + val.slice(end + markerLen);
        onChange(next);
        setTimeout(() => {
          el.focus();
          el.setSelectionRange(start - markerLen, end - markerLen);
        }, 0);
        return;
      }

      // 3. De lo contrario, envolver selección
      const wrapped = `${marker}${selected}${marker}`;
      const next = val.slice(0, start) + wrapped + val.slice(end);
      onChange(next);
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start, start + wrapped.length);
      }, 0);
    } else {
      // Sin selección: insertar marcadores y posicionar cursor al centro
      const wrapped = `${marker}${marker}`;
      const next = val.slice(0, start) + wrapped + val.slice(end);
      onChange(next);
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start + markerLen, start + markerLen);
      }, 0);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const isBold = (e.ctrlKey || e.metaKey) && ['b', 'n'].includes(e.key.toLowerCase());
    const isItalic = (e.ctrlKey || e.metaKey) && ['i', 'k'].includes(e.key.toLowerCase());

    if (isBold) {
      e.preventDefault();
      applyFormatting('**');
      return;
    }

    if (isItalic) {
      e.preventDefault();
      applyFormatting('*');
      return;
    }
  };

  const baseFieldStyle: React.CSSProperties = {
    width: '100%',
    padding: multiline ? '8px 34px 8px 12px' : '8px 34px 8px 12px',
    borderRadius: '8px',
    border: isFocused ? '1.5px solid #005953' : '1px solid #cbd5e1',
    boxShadow: isFocused ? '0 0 0 3px rgba(0, 89, 83, 0.12)' : 'none',
    fontSize: '0.88rem',
    color: '#000000',
    background: '#ffffff',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    ...style,
  };

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {multiline ? (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          rows={rows}
          style={{
            ...baseFieldStyle,
            minHeight: minHeight || `${rows * 24 + 18}px`,
            resize: 'vertical',
            lineHeight: 1.5,
          }}
          className={className}
          value={value ?? ''}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={e => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={e => {
            setIsFocused(false);
            onBlur?.(e);
          }}
          placeholder={placeholder}
          disabled={disabled}
        />
      ) : (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          style={baseFieldStyle}
          className={className}
          value={value ?? ''}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={e => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={e => {
            setIsFocused(false);
            onBlur?.(e);
          }}
          placeholder={placeholder}
          disabled={disabled}
        />
      )}

      {showBoldButton && (
        <button
          type="button"
          tabIndex={-1}
          title="Negrita (Ctrl+B / Ctrl+N)"
          onClick={() => applyFormatting('**')}
          style={{
            position: 'absolute',
            right: '6px',
            top: multiline ? '8px' : '50%',
            transform: multiline ? 'none' : 'translateY(-50%)',
            background: '#f1f5f9',
            border: '1px solid #cbd5e1',
            borderRadius: '5px',
            width: '22px',
            height: '22px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.74rem',
            fontWeight: 900,
            color: '#334155',
            cursor: 'pointer',
            padding: 0,
            transition: 'all 0.15s ease',
            zIndex: 2,
            userSelect: 'none',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = '#e2e8f0';
            e.currentTarget.style.color = '#005953';
            e.currentTarget.style.borderColor = '#005953';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = '#f1f5f9';
            e.currentTarget.style.color = '#334155';
            e.currentTarget.style.borderColor = '#cbd5e1';
          }}
        >
          N
        </button>
      )}
    </div>
  );
};

export default HistologyTextInput;
