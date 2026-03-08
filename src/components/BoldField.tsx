/**
 * BoldField — editor WYSIWYG con contentEditable.
 * Las negritas se muestran EN NEGRITA tanto en edición como en visualización.
 * Almacenamiento interno: **texto** markdown → convertido a/desde HTML en tiempo real.
 *
 * Modos:
 *  - full (default): barra de herramientas conectada encima.
 *  - inline: campo + micro-botón como hermanos en flex del padre.
 */

import React, { useRef, useEffect, useCallback } from 'react';

// ─── Conversión markdown ↔ HTML ───────────────────────────────────────────────

/** **texto** → <strong>texto</strong>  (para el div editable) */
function toHtml(text: string): string {
  const safe = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
  return safe.replace(/\*\*([\s\S]*?)\*\*/g, '<strong>$1</strong>');
}

/** innerHTML → **texto**  (para guardar en estado/BD) */
function fromHtml(html: string): string {
  return html
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**')
    .replace(/<br\s*\/?>\s*/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\n+$/, '');
}

/** Renderiza **texto** como <strong> en vistas de solo lectura */
export function renderBoldText(text: string | null | undefined): React.ReactNode {
  if (!text || !text.includes('**')) return text ?? '';
  const parts = text.split(/(\*\*[\s\S]*?\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**') && part.length >= 5
          ? <strong key={i}>{part.slice(2, -2)}</strong>
          : part
      )}
    </>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface BoldFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** 'input' (una línea) o 'textarea' (multilinea). Default: 'input' */
  as?: 'input' | 'textarea';
  /** Sin contenedor: coloca campo + micro-botón como hermanos en el flex del padre */
  inline?: boolean;
  placeholder?: string;
  style?: React.CSSProperties;
  required?: boolean;
  disabled?: boolean;
  onFocus?: React.FocusEventHandler<HTMLDivElement>;
  onBlur?: React.FocusEventHandler<HTMLDivElement>;
}

// ─── Componente ───────────────────────────────────────────────────────────────

const BoldField: React.FC<BoldFieldProps> = ({
  value,
  onChange,
  as = 'input',
  inline = false,
  placeholder,
  style = {},
  disabled,
  onFocus,
  onBlur,
}) => {
  const divRef = useRef<HTMLDivElement>(null);
  const isFocused = useRef(false);

  // Sincronizar value → innerHTML solo cuando el campo NO está enfocado
  // (evita mover el cursor mientras el usuario escribe)
  useEffect(() => {
    if (!divRef.current || isFocused.current) return;
    const next = toHtml(value);
    if (divRef.current.innerHTML !== next) divRef.current.innerHTML = next;
  });

  // Sincroniza el innerHTML → estado (filtra <br> residual de Chrome al vaciar)
  const sync = useCallback(() => {
    if (!divRef.current) return;
    if (divRef.current.innerHTML === '<br>') divRef.current.innerHTML = '';
    onChange(fromHtml(divRef.current.innerHTML));
  }, [onChange]);

  // Aplica negrita con execCommand (toggle: aplica o quita según selección)
  const applyBold = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    divRef.current?.focus();
    document.execCommand('bold', false);
    sync();
  }, [sync]);

  // Ctrl+B / Enter (bloqueado en modo input)
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (as === 'input' && e.key === 'Enter') e.preventDefault();
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      document.execCommand('bold', false);
      sync();
    }
  }, [as, sync]);

  // Al pegar: solo texto plano (sin HTML externo)
  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    let text = e.clipboardData.getData('text/plain');
    if (as === 'input') text = text.replace(/\n/g, ' ');
    document.execCommand('insertText', false, text);
    sync();
  }, [as, sync]);

  // ── Extraer parámetros de borde para el toolbar ──────────────────────────
  const borderStr = (style.border as string) ?? '';
  const bColorMatch = borderStr.match(/#[\da-fA-F]{3,8}/);
  const bWidthMatch = borderStr.match(/(\d+(?:\.\d+)?px)/);
  const bColor = typeof style.borderColor === 'string'
    ? style.borderColor
    : (bColorMatch?.[0] ?? '#d1d5db');
  const bWidth = bWidthMatch?.[0] ?? '1.5px';
  const bRadius = typeof style.borderRadius === 'string'
    ? style.borderRadius
    : typeof style.borderRadius === 'number'
    ? `${style.borderRadius}px`
    : '8px';

  // ── Estilo del div editable (imita input/textarea) ───────────────────────
  // Filtramos propiedades que no aplican a divs (resize)
  const { resize: _r, ...safeStyle } = style as React.CSSProperties & { resize?: string };

  const divStyle: React.CSSProperties = {
    ...safeStyle,
    outline: 'none',
    cursor: disabled ? 'default' : 'text',
    whiteSpace: as === 'textarea' ? 'pre-wrap' : 'nowrap',
    overflowX: as === 'input' ? 'auto' : undefined,
    overflowY: as === 'textarea' ? 'auto' : 'hidden',
    wordBreak: as === 'textarea' ? 'break-word' : undefined,
    userSelect: 'text',
    WebkitUserSelect: 'text',
  };

  // En modo full, las esquinas superiores se aplanan para conectar con el toolbar
  const divStyleFull: React.CSSProperties = {
    ...divStyle,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: bRadius,
    borderBottomRightRadius: bRadius,
    borderTop: 'none',
    overflow: 'hidden',
  };

  // ── Hover helpers ────────────────────────────────────────────────────────
  const hover = (e: React.MouseEvent<HTMLButtonElement>, on: boolean) => {
    const b = e.currentTarget;
    b.style.background = on ? '#dbeafe' : (inline ? '#f8fafc' : '#fff');
    b.style.borderColor = on ? '#93c5fd' : (inline ? '#cbd5e1' : bColor);
  };

  // ── Div editable ─────────────────────────────────────────────────────────
  const editableDiv = (
    <div
      ref={divRef}
      contentEditable={!disabled}
      suppressContentEditableWarning
      spellCheck
      lang="es"
      data-placeholder={placeholder}
      style={inline ? divStyle : divStyleFull}
      onFocus={e => { isFocused.current = true; onFocus?.(e); }}
      onBlur={e => { isFocused.current = false; sync(); onBlur?.(e); }}
      onInput={sync}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
    />
  );

  // ── Modo inline ──────────────────────────────────────────────────────────
  if (inline) {
    return (
      <React.Fragment>
        {editableDiv}
        <button
          type="button"
          title="Negrita (Ctrl+B)"
          style={{
            flexShrink: 0,
            width: 28,
            height: 28,
            border: '1.5px solid #cbd5e1',
            borderRadius: 6,
            background: '#f8fafc',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 900,
            fontSize: '0.78em',
            color: '#374151',
            padding: 0,
            lineHeight: 1,
            fontFamily: 'inherit',
            userSelect: 'none',
          }}
          onMouseDown={applyBold}
          onMouseEnter={e => hover(e, true)}
          onMouseLeave={e => hover(e, false)}
        >
          <strong>N</strong>
        </button>
      </React.Fragment>
    );
  }

  // ── Modo full (con toolbar) ───────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: safeStyle.width ?? '100%' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 10px',
          background: '#f8fafc',
          border: `${bWidth} solid ${bColor}`,
          borderBottom: 'none',
          borderRadius: `${bRadius} ${bRadius} 0 0`,
        }}
      >
        <button
          type="button"
          title="Negrita (Ctrl+B)"
          style={{
            fontWeight: 900,
            fontSize: '0.82em',
            padding: '3px 10px',
            border: `1px solid ${bColor}`,
            borderRadius: 5,
            background: '#fff',
            cursor: 'pointer',
            color: '#1e293b',
            lineHeight: 1.3,
            boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
            transition: 'background 0.12s, border-color 0.12s',
            fontFamily: 'inherit',
            userSelect: 'none',
          }}
          onMouseDown={applyBold}
          onMouseEnter={e => hover(e, true)}
          onMouseLeave={e => hover(e, false)}
        >
          <strong>N</strong>
        </button>
        <span
          style={{
            fontSize: '0.7em',
            color: '#94a3b8',
            fontStyle: 'italic',
            userSelect: 'none',
          }}
        >
          Selecciona texto → negrita
        </span>
      </div>
      {editableDiv}
    </div>
  );
};

export default BoldField;
