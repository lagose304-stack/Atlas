import React from 'react';
import { Sparkles } from 'lucide-react';
import { renderBoldText } from '../BoldField';
import { hasHtmlMarkup } from '../../services/richText';

export interface HistologyTableCellObject {
  text: string;
  pill?: 'blue' | 'amber' | 'green' | 'purple' | 'none' | string;
}

export type HistologyTableCellData = string | HistologyTableCellObject;

export interface HistologyTextTableProps {
  badgeText?: string;
  title?: string;
  text?: string;
  headers?: string[];
  rows?: Array<Array<HistologyTableCellData>>;
}

export function renderTableCellContent(cellData: HistologyTableCellData, isFirstCol = false): React.ReactNode {
  let text = '';
  let pill = '';

  if (typeof cellData === 'object' && cellData !== null) {
    text = cellData.text ?? '';
    pill = cellData.pill ?? '';
  } else {
    text = cellData ?? '';
  }

  if (!text) return '';

  // 1. Si la celda tiene píldora asignada a nivel de casilla completa
  if (pill && pill !== 'none' && pill.trim() !== '') {
    const p = pill.toLowerCase();
    let bg = '#e0f2fe';
    let color = '#0284c7';
    let border = '#bae6fd';

    if (p === 'amber' || p === 'ambar' || p === 'yellow') {
      bg = '#fef3c7';
      color = '#b45309';
      border = '#fde68a';
    } else if (p === 'green' || p === 'verde') {
      bg = '#dcfce7';
      color = '#15803d';
      border = '#bbf7d0';
    } else if (p === 'purple' || p === 'morado') {
      bg = '#f3e8ff';
      color = '#7e22ce';
      border = '#e9d5ff';
    }

    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length > 1) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', alignItems: 'flex-start' }}>
          {lines.map((line, idx) => (
            <span
              key={idx}
              style={{
                display: 'inline-block',
                padding: '4px 12px',
                borderRadius: '7px',
                background: bg,
                color: color,
                border: `1.2px solid ${border}`,
                fontSize: '0.82rem',
                fontWeight: 750,
                lineHeight: 1.25,
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              }}
            >
              {renderBoldText(line)}
            </span>
          ))}
        </div>
      );
    }

    return (
      <span
        style={{
          display: 'inline-block',
          padding: '4px 12px',
          borderRadius: '7px',
          background: bg,
          color: color,
          border: `1.2px solid ${border}`,
          fontSize: '0.82rem',
          fontWeight: 750,
          lineHeight: 1.25,
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        }}
      >
        {renderBoldText(text)}
      </span>
    );
  }

  // 2. Parse [color:label] patterns for badge highlights (soporte retrocompatible)
  const badgeRegex = /\[(blue|azul|amber|ambar|yellow|green|verde|purple|morado|tag|badge):([\s\S]*?)\]/gi;
  if (badgeRegex.test(text)) {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    const re = /\[(blue|azul|amber|ambar|yellow|green|verde|purple|morado|tag|badge):([\s\S]*?)\]/gi;
    let match: RegExpExecArray | null;

    while ((match = re.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(renderBoldText(text.slice(lastIndex, match.index)));
      }
      const type = match[1].toLowerCase();
      const label = match[2];

      let bg = '#e0f2fe';
      let color = '#0284c7';
      let border = '#bae6fd';

      if (type === 'amber' || type === 'ambar' || type === 'yellow') {
        bg = '#fef3c7';
        color = '#b45309';
        border = '#fde68a';
      } else if (type === 'green' || type === 'verde') {
        bg = '#dcfce7';
        color = '#15803d';
        border = '#bbf7d0';
      } else if (type === 'purple' || type === 'morado') {
        bg = '#f3e8ff';
        color = '#7e22ce';
        border = '#e9d5ff';
      }

      parts.push(
        <span
          key={match.index}
          style={{
            display: 'inline-block',
            padding: '3px 10px',
            borderRadius: '6px',
            background: bg,
            color: color,
            border: `1px solid ${border}`,
            fontSize: '0.80rem',
            fontWeight: 750,
            lineHeight: 1.2,
            letterSpacing: '0.01em',
            margin: '2px 0',
          }}
        >
          {label}
        </span>
      );
      lastIndex = re.lastIndex;
    }
    if (lastIndex < text.length) {
      parts.push(renderBoldText(text.slice(lastIndex)));
    }
    return <>{parts}</>;
  }

  // 3. Handle first column subtitle in parentheses e.g. "Hipodermis (Fascia subcutánea)"
  if (isFirstCol && text.includes('(') && text.includes(')')) {
    const pMatch = text.match(/^([\s\S]*?)(\s*\([\s\S]*?\))\s*$/);
    if (pMatch) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <span style={{ fontWeight: 850, color: '#0f172a', fontSize: '0.94rem' }}>
            {renderBoldText(pMatch[1].trim())}
          </span>
          <span style={{ fontWeight: 500, color: '#64748b', fontSize: '0.78rem' }}>
            {pMatch[2].trim()}
          </span>
        </div>
      );
    }
  }

  return renderBoldText(text);
}

export const HistologyTextTableBlock: React.FC<HistologyTextTableProps> = ({
  badgeText,
  title,
  text,
  headers = [],
  rows = [],
}) => {
  const safeText = text?.trim() || '';
  const hasText = safeText !== '';
  const hasBadge = Boolean(badgeText && badgeText.trim() !== '');
  const hasTitle = Boolean(title && title.trim() !== '');
  const hasHeaders = headers.length > 0 && headers.some(h => h && h.trim() !== '');
  const hasRows = rows.length > 0 && rows.some(r => r && r.some(c => {
    const val = typeof c === 'object' && c !== null ? c.text : c;
    return val && val.trim() !== '';
  }));

  if (!hasText && !hasHeaders && !hasRows && !hasTitle && !hasBadge) {
    return null;
  }

  return (
    <div
      className="histology-text-table-block"
      style={{
        position: 'relative',
        width: '100%',
        borderRadius: '24px',
        background: 'radial-gradient(ellipse at 88% 18%, rgba(2, 132, 199, 0.05) 0%, transparent 60%), linear-gradient(180deg, #ffffff 0%, #f9fcff 100%)',
        border: '1.5px solid rgba(186, 230, 253, 0.95)',
        boxShadow: '0 14px 38px -6px rgba(2, 132, 199, 0.07), 0 2px 8px -2px rgba(0, 0, 0, 0.02), inset 0 1px 0 #ffffff',
        fontFamily: '"Montserrat", "Segoe UI", sans-serif',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* ─── Barra Superior de Acento Azul / Zafiro ─── */}
      <div
        style={{
          height: '4px',
          width: '100%',
          background: 'linear-gradient(90deg, #0284c7 0%, #38bdf8 50%, #7dd3fc 100%)',
          flexShrink: 0,
        }}
      />

      {/* ─── Trama geométrica de laboratorio ─── */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: 'radial-gradient(#0284c7 0.75px, transparent 0.75px)',
          backgroundSize: '22px 22px',
          opacity: 0.035,
          pointerEvents: 'none',
        }}
      />

      {/* ─── Contenido Interior ─── */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          padding: 'clamp(20px, 3vw, 32px)',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
        }}
      >
        {/* Cabecera Opcional: Badge y Título */}
        {(hasBadge || hasTitle) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {hasBadge && (
              <div>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.70rem',
                    fontWeight: 850,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: '#0369a1',
                    background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)',
                    padding: '4px 12px',
                    borderRadius: '999px',
                    border: '1.2px solid #7dd3fc',
                    boxShadow: '0 2px 8px rgba(2, 132, 199, 0.12)',
                  }}
                >
                  <Sparkles size={12} color="#0284c7" />
                  <span>{badgeText}</span>
                </span>
              </div>
            )}

            {hasTitle && (
              <h3
                style={{
                  margin: 0,
                  fontSize: 'clamp(1.25rem, 2.2vw, 1.55rem)',
                  fontWeight: 850,
                  color: '#0c4a6e',
                  letterSpacing: '-0.025em',
                  lineHeight: 1.22,
                }}
              >
                {title}
              </h3>
            )}
          </div>
        )}

        {/* Párrafos de Texto Superior */}
        {hasText && (
          <div
            className="histology-text-table-text"
            style={{
              fontSize: '0.96rem',
              lineHeight: 1.68,
              color: '#0f172a',
              fontWeight: 500,
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            {hasHtmlMarkup(safeText) ? (
              renderBoldText(safeText)
            ) : (
              safeText.split(/\n\s*\n/).map((para, pIdx) => (
                <p key={pIdx} style={{ margin: 0, color: '#0f172a' }}>
                  {renderBoldText(para.trim())}
                </p>
              ))
            )}
          </div>
        )}

        {/* ─── Tabla Médica Estilizada ─── */}
        {(hasHeaders || hasRows) && (
          <div
            style={{
              width: '100%',
              overflowX: 'auto',
              borderRadius: '16px',
              border: '1.4px solid #e0f2fe',
              background: '#ffffff',
              boxShadow: '0 4px 14px -2px rgba(2, 132, 199, 0.05)',
            }}
          >
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                textAlign: 'left',
                fontSize: '0.88rem',
              }}
            >
              {/* Primera Fila: Encabezados */}
              {hasHeaders && (
                <thead>
                  <tr
                    style={{
                      background: 'linear-gradient(180deg, #f0f7ff 0%, #e8f4fc 100%)',
                      borderBottom: '2px solid #bae6fd',
                    }}
                  >
                    {headers.map((h, hIdx) => (
                      <th
                        key={hIdx}
                        style={{
                          padding: '13px 18px',
                          color: '#0369a1',
                          fontWeight: 800,
                          fontSize: '0.88rem',
                          letterSpacing: '0.01em',
                          borderRight: hIdx < headers.length - 1 ? '1px solid #e0f2fe' : 'none',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {renderBoldText(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
              )}

              {/* Filas de Datos */}
              <tbody>
                {rows.map((row, rIdx) => (
                  <tr
                    key={rIdx}
                    style={{
                      borderBottom: rIdx < rows.length - 1 ? '1px solid #f1f5f9' : 'none',
                      background: rIdx % 2 === 0 ? '#ffffff' : '#fafcff',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    {row.map((cell, cIdx) => {
                      const isFirstCol = cIdx === 0;

                      return (
                        <td
                          key={cIdx}
                          style={{
                            padding: '14px 18px',
                            verticalAlign: 'top',
                            color: isFirstCol ? '#0f172a' : '#334155',
                            fontWeight: isFirstCol ? 800 : 500,
                            lineHeight: 1.5,
                            borderRight: cIdx < row.length - 1 ? '1px solid #f1f5f9' : 'none',
                          }}
                        >
                          {renderTableCellContent(cell, isFirstCol)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
