import {
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Film,
  Grid2x2,
  Info,
  Lightbulb,
  Plus,
  Stethoscope,
  Trash2,
  ZoomIn,
} from 'lucide-react';
import InspectorDialog from './InspectorDialog';
import { GridAreaPicker } from './GridAreaPicker';
import React, { cloneElement, isValidElement, useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { Config, CustomField, CustomFieldRender, SlotComponent } from '@puckeditor/core';
import { EDITOR2_DEFAULT_IMAGE_SRC, createLayoutIntent } from '../domain/defaults';
import { gridColumnValue, layoutClasses } from '../domain/layout';
import { GRID_COLUMNS, GRID_MAX_ROW, fromGridLine, fromGridSpan, toGridLine, toGridSpan } from '../domain/gridResolution';
import { renderRichTextContent, type RichTextV2 } from '../domain/richText';
import type { BlockStyle, CarouselItem, Gap, LayoutIntent, MediaAppearance, PageTheme, SpanIntent, TextAppearance } from '../domain/schema';
import { DEFAULT_BOX_STYLE } from '../domain/styleSchema';
import {
  blockMotionClasses,
  blockStyleToCss,
  mediaImageStyle,
  mediaStageStyle,
  mergeBlockStyle,
} from '../domain/styleToCss';
import Editor2Lightbox from './Editor2Lightbox';
import ExamCarouselBlockView from './ExamCarouselBlockView';
import { renderAtlasIcon } from './IconPickerModal';
import InlineRichText from './InlineRichText';
import { CanvasScreen, ResponsiveCanvas } from './ResponsiveCanvas';
import { responsiveValues } from '../domain/responsive';

type DragRef = ((element: Element | null) => void) | null;

const BREAKPOINTS = ['base', 'md', 'lg'] as const;
type BreakpointKey = (typeof BREAKPOINTS)[number];

const BREAKPOINT_LABELS: Record<BreakpointKey, string> = {
  base: 'Base',
  md: 'Mediano',
  lg: 'Grande',
};

const COLUMN_OPTIONS = Array.from({ length: GRID_COLUMNS }, (_, index) => index + 1);

function rowStyle(layout: LayoutIntent): CSSProperties {
  const styles: Record<string, string> = {};
  if (layout.base.flexSize === 'fixed') styles['--e2-fixed-width'] = `${layout.base.widthPx ?? 240}px`;
  if (layout.base.minWidthPx) styles['--e2-min-width'] = `${layout.base.minWidthPx}px`;
  if (layout.base.maxWidthPx) styles['--e2-max-width'] = `${layout.base.maxWidthPx}px`;
  let effective = layout.base;
  for (const breakpoint of BREAKPOINTS) {
    effective = layout[breakpoint] ?? effective;
    styles[`--e2-column-${breakpoint}`] = gridColumnValue(effective);
    const row = effective.row === undefined ? 'auto' : toGridLine(effective.row);
    const rowSpan = effective.rowSpan === undefined ? 1 : toGridSpan(effective.rowSpan);
    styles[`--e2-row-${breakpoint}`] = `${row} / span ${rowSpan}`;
    styles[`--e2-align-${breakpoint}`] = effective.verticalAlign ?? (effective.rowSpan ? 'stretch' : 'start');
    styles[`--e2-overflow-${breakpoint}`] = effective.rowSpan ? 'auto' : 'visible';
  }
  return styles as CSSProperties;
}

function typography(style: TextAppearance = {}, defaultColor?: string): CSSProperties {
  return {
    fontFamily: style.font,
    color: style.color ?? defaultColor,
    fontWeight: style.bold === undefined ? undefined : style.bold ? 700 : 400,
    fontStyle: style.italic ? 'italic' : undefined,
    textDecorationLine: [style.underline && 'underline', style.strike && 'line-through'].filter(Boolean).join(' ') || undefined,
    textTransform: style.uppercase ? 'uppercase' : undefined,
    textAlign: style.align,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing !== undefined ? `${style.letterSpacing * 0.02}em` : undefined,
    WebkitTextStroke: style.textStroke ? '0.6px currentColor' : undefined,
    ...(style.bulletColor ? { ['--e2-bullet-color' as string]: style.bulletColor } : {}),
  };
}

function BlockResizeHandles() {
  return (
    <div className="e2-resize-handles" aria-hidden="true">
      <span className="e2-resize-handle e2-resize-handle--n" data-e2-resize="n" title="Ajustar borde superior" />
      <span className="e2-resize-handle e2-resize-handle--s" data-e2-resize="s" title="Ajustar alto" />
      <span className="e2-resize-handle e2-resize-handle--w" data-e2-resize="w" title="Ajustar borde izquierdo" />
      <span className="e2-resize-handle e2-resize-handle--e" data-e2-resize="e" title="Ajustar ancho" />
      <span className="e2-resize-handle e2-resize-handle--nw" data-e2-resize="nw" title="Ajustar esquina superior izquierda" />
      <span className="e2-resize-handle e2-resize-handle--sw" data-e2-resize="sw" title="Ajustar esquina inferior izquierda" />
      <span className="e2-resize-handle e2-resize-handle--se" data-e2-resize="se" title="Ajustar ancho y alto" />
    </div>
  );
}

function emitInlineTextChange(element: HTMLElement, nextText: string, onTextChange?: (value: string) => void) {
  onTextChange?.(nextText);
  element.dispatchEvent(
    new CustomEvent('e2:text-change', {
      bubbles: true,
      detail: { text: nextText },
    }),
  );
}

function emitInlineBlockPatch(element: HTMLElement, patch: Record<string, unknown>) {
  element.dispatchEvent(
    new CustomEvent('e2:block-patch', {
      bubbles: true,
      detail: { patch },
    }),
  );
}

export type HeadingBlockViewProps = {
  layout: LayoutIntent;
  level: 1 | 2 | 3;
  text: string;
  richText?: RichTextV2;
  appearance?: TextAppearance;
  blockStyle?: BlockStyle;
  editing?: boolean;
  dragRef?: DragRef;
  onTextChange?: (nextText: string) => void;
};

export function HeadingBlockView({
  layout,
  level,
  text,
  richText,
  appearance,
  blockStyle,
  editing = false,
  dragRef,
  onTextChange,
}: HeadingBlockViewProps) {
  const { textSize } = responsiveValues(blockStyle, useContext(CanvasScreen));
  const sizeStyle = typeof textSize === 'number' ? { '--e2-responsive-text-size': `${textSize}px` } : undefined;
  const Tag = `h${level}` as 'h1' | 'h2' | 'h3';
  const editableRef = useRef<HTMLHeadingElement>(null);
  const [focused, setFocused] = useState(false);
  const lastEmittedRef = useRef(text);

  useLayoutEffect(() => {
    lastEmittedRef.current = text;
    if (!editing || !editableRef.current) return;
    if (document.activeElement === editableRef.current) return;
    editableRef.current.textContent = text || 'Escribe un título';
  }, [editing, level, text]);

  const headingClasses = [
    !text && !focused ? 'e2-block__placeholder' : '',
    editing ? 'e2-inline-editable' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={dragRef ?? undefined}
      className={`e2-block e2-block--heading ${layoutClasses(layout)}`.trim()}
      style={{ ...mergeBlockStyle(rowStyle(layout), blockStyle), ...sizeStyle }}
      data-e2-text-size={sizeStyle ? '' : undefined}
      data-e2-area={Object.values(layout).some((intent) => intent.row || intent.rowSpan) || undefined}
      data-e2-block="heading"
    >
      {editing && richText ? (
        <Tag style={typography(appearance)} className={headingClasses || undefined}>
          <InlineRichText
            value={richText}
            editing
            onDemand
            singleLine
            placeholder="Escribe un título"
            editableTag="heading"
            onChange={(nextPlain, nextRich, el) => {
              onTextChange?.(nextPlain);
              if (el) emitInlineBlockPatch(el, { text: nextPlain, richText: nextRich });
            }}
          />
        </Tag>
      ) : (
        <Tag
          ref={editableRef}
          style={typography(appearance)}
          className={headingClasses || undefined}
          contentEditable={editing ? false : undefined}
          suppressContentEditableWarning={editing || undefined}
          data-puck-overlay-portal={editing ? 'true' : undefined}
          data-e2-editable={editing ? 'heading' : undefined}
          data-e2-editing-active={editing && focused ? 'true' : undefined}
          data-placeholder={editing ? 'Escribe un título' : undefined}
          onClick={editing ? (event) => event.stopPropagation() : undefined}
          onFocus={(event) => {
            if (!editing) return;
            if (!lastEmittedRef.current) {
              event.currentTarget.textContent = '';
            }
            setFocused(true);
          }}
          onBlur={(event) => {
            if (!editing) return;
            const next = (event.currentTarget.innerText ?? event.currentTarget.textContent ?? '').replace(/\r?\n/g, ' ');
            setFocused(false);
            if (next !== lastEmittedRef.current) {
              lastEmittedRef.current = next;
              emitInlineTextChange(event.currentTarget, next, onTextChange);
            }
            event.currentTarget.textContent = next || 'Escribe un título';
          }}
          onInput={(event) => {
            if (!editing) return;
            const next = (event.currentTarget.innerText ?? event.currentTarget.textContent ?? '').replace(/\r?\n/g, ' ');
            lastEmittedRef.current = next;
            emitInlineTextChange(event.currentTarget, next, onTextChange);
          }}
          onKeyDown={(event) => {
            if (!editing) return;
            event.stopPropagation();
            if (event.key === 'Enter' || event.key === 'Escape') {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
        >
          {editing ? null : richText ? renderRichTextContent(richText) : text}
        </Tag>
      )}
      {editing && <BlockResizeHandles />}
    </div>
  );
}

export type TextBlockViewProps = {
  layout: LayoutIntent;
  text: string;
  richText?: RichTextV2;
  appearance?: TextAppearance;
  blockStyle?: BlockStyle;
  editing?: boolean;
  dragRef?: DragRef;
  onTextChange?: (nextText: string) => void;
};

export function TextBlockView({
  layout,
  text,
  richText,
  appearance,
  blockStyle,
  editing = false,
  dragRef,
  onTextChange,
}: TextBlockViewProps) {
  const { textSize } = responsiveValues(blockStyle, useContext(CanvasScreen));
  const sizeStyle = typeof textSize === 'number' ? { '--e2-responsive-text-size': `${textSize}px` } : undefined;
  const editableRef = useRef<HTMLElement | null>(null);
  const [focused, setFocused] = useState(false);
  const lastEmittedRef = useRef(text);

  const isList = Boolean(appearance?.bullets || appearance?.numbered);

  useLayoutEffect(() => {
    lastEmittedRef.current = text;
    if (!editing || !editableRef.current) return;
    if (document.activeElement === editableRef.current) return;
    if (isList) {
      const lines = text ? text.split('\n') : [''];
      editableRef.current.replaceChildren(
        ...lines.map((line) => {
          const li = document.createElement('li');
          li.textContent = line || '\u00a0';
          return li;
        }),
      );
    } else {
      editableRef.current.textContent = text || 'Escribe un párrafo';
    }
  }, [isList, editing, text]);

  const readEditableText = (el: HTMLElement): string => {
    if (isList) {
      const items = el.querySelectorAll('li');
      if (items.length > 0) {
        return Array.from(items)
          .map((li) => (li.innerText ?? li.textContent ?? '').replace(/\u00a0/g, '').replace(/\r?\n/g, ''))
          .join('\n');
      }
    }
    return (el.innerText ?? el.textContent ?? '').replace(/\r\n/g, '\n');
  };

  const sharedEditableProps = editing
    ? {
      contentEditable: false as const,
      suppressContentEditableWarning: true as const,
      'data-puck-overlay-portal': 'true',
      'data-e2-editable': 'text',
      'data-e2-editing-active': focused ? 'true' : undefined,
      'data-placeholder': 'Escribe un párrafo',
      onClick: (event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation();
      },
      onFocus: (event: React.FocusEvent<HTMLElement>) => {
        if (!lastEmittedRef.current && !isList) {
          event.currentTarget.textContent = '';
        }
        setFocused(true);
      },
      onBlur: (event: React.FocusEvent<HTMLElement>) => {
        const next = readEditableText(event.currentTarget);
        setFocused(false);
        if (next !== lastEmittedRef.current) {
          lastEmittedRef.current = next;
          emitInlineTextChange(event.currentTarget, next, onTextChange);
        }
        if (!isList) {
          event.currentTarget.textContent = next || 'Escribe un párrafo';
        }
      },
      onInput: (event: React.FormEvent<HTMLElement>) => {
        const next = readEditableText(event.currentTarget);
        lastEmittedRef.current = next;
        emitInlineTextChange(event.currentTarget, next, onTextChange);
      },
      onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
        event.stopPropagation();
        if (event.key === 'Escape') {
          event.preventDefault();
          event.currentTarget.blur();
        }
      },
    }
    : {};

  const paragraphClasses = [
    !text && !focused ? 'e2-block__placeholder' : '',
    editing ? 'e2-inline-editable' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const paragraphStyle = typography(appearance, text || focused ? '#000000' : undefined);
  const ListTag = appearance?.numbered ? 'ol' : 'ul';

  return (
    <div
      ref={dragRef ?? undefined}
      className={`e2-block e2-block--text ${layoutClasses(layout)}`.trim()}
      style={{ ...mergeBlockStyle(rowStyle(layout), blockStyle), ...sizeStyle }}
      data-e2-text-size={sizeStyle ? '' : undefined}
      data-e2-area={Object.values(layout).some((intent) => intent.row || intent.rowSpan) || undefined}
      data-e2-block="text"
    >
      {isList ? (
        <ListTag
          ref={(node: HTMLUListElement | HTMLOListElement | null) => {
            editableRef.current = node;
          }}
          className={`e2-text-list ${appearance?.numbered ? 'e2-text-list--ordered' : ''} e2-list--${appearance?.bulletStyle ?? 'disc'} ${editing ? 'e2-inline-editable' : ''}`.trim()}
          style={paragraphStyle}
          {...sharedEditableProps}
        >
          {editing
            ? null
            : text.split('\n').map((line, index) => (
              <li key={index}>{line || '\u00a0'}</li>
            ))}
        </ListTag>
      ) : editing && richText ? (
        <div style={paragraphStyle} className={paragraphClasses || undefined}>
          <InlineRichText
            value={richText}
            editing
            onDemand
            placeholder="Escribe un párrafo"
            editableTag="text"
            onChange={(nextPlain, nextRich, el) => {
              onTextChange?.(nextPlain);
              if (el) emitInlineBlockPatch(el, { text: nextPlain, richText: nextRich });
            }}
          />
        </div>
      ) : (
        <p
          ref={(node) => {
            editableRef.current = node;
          }}
          style={paragraphStyle}
          className={paragraphClasses || undefined}
          {...sharedEditableProps}
        >
          {editing ? null : richText ? renderRichTextContent(richText) : text}
        </p>
      )}
      {editing && <BlockResizeHandles />}
    </div>
  );
}

export type ImageBlockViewProps = {
  layout: LayoutIntent;
  src: string;
  alt: string;
  caption?: string;
  fit?: 'cover' | 'contain';
  zoom?: boolean;
  media?: MediaAppearance;
  blockStyle?: BlockStyle;
  editing?: boolean;
  dragRef?: DragRef;
};

export function ImageBlockView({
  layout,
  src,
  alt,
  caption,
  fit = 'contain',
  zoom = true,
  media,
  blockStyle,
  editing = false,
  dragRef,
}: ImageBlockViewProps) {
  const showCaption = editing || (caption ?? '') !== '';
  const [zoomed, setZoomed] = useState(false);

  return (
    <figure
      ref={dragRef ?? undefined}
      className={`e2-block e2-block--image ${layoutClasses(layout)}`.trim()}
      style={mergeBlockStyle(rowStyle(layout), blockStyle)}
      data-e2-area={Object.values(layout).some((intent) => intent.row || intent.rowSpan) || undefined}
      data-e2-block="image"
    >
      <div className="e2-image-stage" style={mediaStageStyle(media)}>
        <img
          src={src}
          alt={alt}
          loading="lazy"
          draggable={false}
          style={mediaImageStyle(fit, media)}
          onClick={!editing && zoom ? () => setZoomed(true) : undefined}
        />
        {media?.overlayBadge && (
          <span className={`e2-media-overlay-badge e2-media-overlay-badge--${media.overlayPosition ?? 'tl'}`}>
            {media.overlayBadge}
          </span>
        )}
        {!editing && zoom && (
          <button
            type="button"
            className="e2-image-zoom-btn"
            aria-label="Ampliar imagen"
            title="Ampliar imagen"
            onClick={() => setZoomed(true)}
          >
            <ZoomIn size={14} aria-hidden="true" />
          </button>
        )}
      </div>
      {showCaption && (
        <figcaption className={caption ? undefined : 'e2-block__placeholder'}>
          {caption || (editing ? 'Añade un pie de imagen' : '')}
        </figcaption>
      )}
      <Editor2Lightbox
        open={!editing && zoomed}
        src={src}
        alt={alt}
        caption={caption}
        onClose={() => setZoomed(false)}
      />
      {editing && <BlockResizeHandles />}
    </figure>
  );
}

export type DividerBlockViewProps = {
  layout: LayoutIntent;
  orientation?: 'horizontal' | 'vertical';
  lineStyle?: 'solid' | 'dashed' | 'gradient';
  thickness?: number;
  color?: string;
  label?: string;
  widthPercent?: number;
  blockStyle?: BlockStyle;
  editing?: boolean;
  dragRef?: DragRef;
};

export function DividerBlockView({
  layout,
  orientation = 'horizontal',
  lineStyle = 'solid',
  thickness = 2,
  color = '#0284c7',
  label,
  widthPercent = 100,
  blockStyle,
  editing = false,
  dragRef,
}: DividerBlockViewProps) {
  const isVertical = orientation === 'vertical';
  const clampedWidth = Math.min(100, Math.max(20, widthPercent));
  const lineCss: CSSProperties =
    lineStyle === 'gradient'
      ? {
        background: isVertical
          ? `linear-gradient(180deg, transparent 0%, ${color} 50%, transparent 100%)`
          : `linear-gradient(90deg, transparent 0%, ${color} 50%, transparent 100%)`,
        width: isVertical ? `${thickness}px` : label ? '100%' : `${clampedWidth}%`,
        height: isVertical ? '100%' : `${thickness}px`,
      }
      : {
        borderTop: isVertical ? undefined : `${thickness}px ${lineStyle} ${color}`,
        borderLeft: isVertical ? `${thickness}px ${lineStyle} ${color}` : undefined,
        width: isVertical ? '0' : label ? '100%' : `${clampedWidth}%`,
        height: isVertical ? '100%' : '0',
      };

  return (
    <div
      ref={dragRef ?? undefined}
      role="separator"
      aria-orientation={orientation}
      className={`e2-block e2-block--divider e2-block--divider-${orientation} ${layoutClasses(layout)}`.trim()}
      style={mergeBlockStyle(rowStyle(layout), blockStyle)}
      data-e2-area={Object.values(layout).some((intent) => intent.row || intent.rowSpan) || undefined}
      data-e2-block="divider"
    >
      {!isVertical && label ? (
        <div className="e2-divider-labeled" style={{ width: `${clampedWidth}%` }}>
          <span className="e2-divider-line" style={lineCss} />
          <span className="e2-divider-label" style={{ color }}>{label}</span>
          <span className="e2-divider-line" style={lineCss} />
        </div>
      ) : (
        <span className="e2-divider-line" style={lineCss} />
      )}
      {editing && <BlockResizeHandles />}
    </div>
  );
}

export type ButtonBlockViewProps = {
  layout: LayoutIntent;
  label: string;
  href: string;
  variant?: 'solid' | 'outline' | 'soft' | 'gradient' | 'pill';
  newTab?: boolean;
  color?: string;
  icon?: string;
  align?: 'left' | 'center' | 'right';
  blockStyle?: BlockStyle;
  editing?: boolean;
  dragRef?: DragRef;
};

export function ButtonBlockView({
  layout,
  label,
  href,
  variant = 'solid',
  newTab = false,
  color = '#0284c7',
  icon,
  align = 'left',
  blockStyle,
  editing = false,
  dragRef,
}: ButtonBlockViewProps) {
  const editableRef = useRef<HTMLSpanElement>(null);
  const [focused, setFocused] = useState(false);
  const lastEmittedRef = useRef(label);

  useLayoutEffect(() => {
    lastEmittedRef.current = label;
    if (!editing || !editableRef.current) return;
    if (document.activeElement === editableRef.current) return;
    editableRef.current.textContent = label || 'Texto del botón';
  }, [editing, label]);

  const btnStyle: CSSProperties =
    variant === 'outline'
      ? { borderColor: color, color, background: 'transparent' }
      : variant === 'soft'
        ? { borderColor: color, color, background: `color-mix(in srgb, ${color} 14%, #ffffff)` }
        : variant === 'gradient'
          ? {
              borderColor: 'transparent',
              backgroundImage: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 68%, #0b2545))`,
              color: '#ffffff',
            }
          : variant === 'pill'
            ? { borderColor: color, background: color, color: '#ffffff', borderRadius: '999px' }
            : { borderColor: color, background: color, color: '#ffffff' };

  const justify = align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start';

  return (
    <div
      ref={dragRef ?? undefined}
      className={`e2-block e2-block--button ${layoutClasses(layout)}`.trim()}
      style={{ ...mergeBlockStyle(rowStyle(layout), blockStyle), display: 'flex', justifyContent: justify }}
      data-e2-area={Object.values(layout).some((intent) => intent.row || intent.rowSpan) || undefined}
      data-e2-block="button"
    >
      <a
        href={editing ? undefined : href || '#'}
        target={!editing && newTab ? '_blank' : undefined}
        rel={!editing && newTab ? 'noopener noreferrer' : undefined}
        className={`e2-cta-btn e2-cta-btn--${variant}`}
        style={btnStyle}
        onClick={editing ? (e) => e.preventDefault() : undefined}
      >
        {icon && renderAtlasIcon(icon, 15)}
        <span
          ref={editableRef}
          contentEditable={editing ? false : undefined}
          suppressContentEditableWarning={editing || undefined}
          data-puck-overlay-portal={editing ? 'true' : undefined}
          data-e2-editable={editing ? 'button' : undefined}
          data-e2-editing-active={editing && focused ? 'true' : undefined}
          data-placeholder={editing ? 'Texto del botón' : undefined}
          className={editing ? 'e2-inline-editable' : undefined}
          onFocus={(e) => {
            if (!editing) return;
            if (!lastEmittedRef.current) e.currentTarget.textContent = '';
            setFocused(true);
          }}
          onBlur={(e) => {
            if (!editing) return;
            const next = (e.currentTarget.innerText ?? e.currentTarget.textContent ?? '').replace(/\r?\n/g, ' ');
            setFocused(false);
            if (next !== lastEmittedRef.current) {
              lastEmittedRef.current = next;
              emitInlineBlockPatch(e.currentTarget, { label: next });
            }
            e.currentTarget.textContent = next || 'Texto del botón';
          }}
          onInput={(e) => {
            if (!editing) return;
            const next = (e.currentTarget.innerText ?? e.currentTarget.textContent ?? '').replace(/\r?\n/g, ' ');
            lastEmittedRef.current = next;
            emitInlineBlockPatch(e.currentTarget, { label: next });
          }}
          onKeyDown={(e) => {
            if (!editing) return;
            e.stopPropagation();
            if (e.key === 'Enter' || e.key === 'Escape') {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
        >
          {editing ? null : label}
        </span>
      </a>
      {editing && <BlockResizeHandles />}
    </div>
  );
}

export type TableBlockViewProps = {
  layout: LayoutIntent;
  headers: string[];
  rows: string[][];
  accentColor?: string;
  striped?: boolean;
  compact?: boolean;
  bordered?: boolean;
  blockStyle?: BlockStyle;
  editing?: boolean;
  dragRef?: DragRef;
};

function EditableCell({
  tag: CellTag,
  value,
  editing,
  singleLine = false,
  onCommit,
}: {
  tag: 'th' | 'td';
  value: string;
  editing: boolean;
  singleLine?: boolean;
  onCommit: (el: HTMLElement, next: string) => void;
}) {
  const cellRef = useRef<HTMLTableCellElement>(null);
  const lastRef = useRef(value);

  useLayoutEffect(() => {
    lastRef.current = value;
    if (!editing || !cellRef.current) return;
    if (document.activeElement === cellRef.current) return;
    cellRef.current.textContent = value;
  }, [editing, value]);

  return (
    <CellTag
      ref={cellRef}
      contentEditable={editing ? false : undefined}
      suppressContentEditableWarning={editing || undefined}
      data-puck-overlay-portal={editing ? 'true' : undefined}
      data-e2-editable={editing ? 'table-cell' : undefined}
      className={editing ? 'e2-inline-editable' : undefined}
      onInput={(e) => {
        if (!editing) return;
        const raw = e.currentTarget.innerText ?? e.currentTarget.textContent ?? '';
        const nextVal = singleLine ? raw.replace(/\r?\n/g, ' ') : raw.replace(/\r\n/g, '\n');
        lastRef.current = nextVal;
        onCommit(e.currentTarget, nextVal);
      }}
      onBlur={(e) => {
        if (!editing) return;
        const raw = e.currentTarget.innerText ?? e.currentTarget.textContent ?? '';
        const nextVal = (singleLine ? raw.replace(/\r?\n/g, ' ') : raw.replace(/\r\n/g, '\n')).trim();
        if (nextVal !== lastRef.current) {
          lastRef.current = nextVal;
          onCommit(e.currentTarget, nextVal);
        }
      }}
      onKeyDown={(e) => {
        if (!editing) return;
        e.stopPropagation();
        if (e.key === 'Escape' || (singleLine && e.key === 'Enter')) {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
    >
      {editing ? null : value}
    </CellTag>
  );
}

export function TableBlockView({
  layout,
  headers,
  rows,
  accentColor = '#e0f2fe',
  striped = false,
  compact = false,
  bordered = false,
  blockStyle,
  editing = false,
  dragRef,
}: TableBlockViewProps) {
  const safeHeaders = headers.length > 0 ? headers : ['Columna 1'];
  const safeRows = rows.length > 0 ? rows : [['']];
  const tableClasses = [
    'e2-table',
    striped ? 'e2-table--striped' : '',
    compact ? 'e2-table--compact' : '',
    bordered ? 'e2-table--bordered' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={dragRef ?? undefined}
      className={`e2-block e2-block--table ${layoutClasses(layout)}`.trim()}
      style={mergeBlockStyle(rowStyle(layout), blockStyle)}
      data-e2-area={Object.values(layout).some((intent) => intent.row || intent.rowSpan) || undefined}
      data-e2-block="table"
    >
      <div className="e2-table-wrap">
        <table className={tableClasses}>
          <thead>
            <tr style={{ background: accentColor }}>
              {safeHeaders.map((header, colIdx) => (
                <EditableCell
                  key={colIdx}
                  tag="th"
                  value={header}
                  editing={editing}
                  singleLine
                  onCommit={(el, nextVal) => {
                    const nextHeaders = safeHeaders.map((h, i) => (i === colIdx ? nextVal : h));
                    emitInlineBlockPatch(el, { headers: nextHeaders });
                  }}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {safeRows.map((row, rowIdx) => (
              <tr key={rowIdx}>
                {safeHeaders.map((_, colIdx) => (
                  <EditableCell
                    key={colIdx}
                    tag="td"
                    value={row[colIdx] ?? ''}
                    editing={editing}
                    onCommit={(el, nextVal) => {
                      const nextRows = safeRows.map((r, rI) =>
                        rI === rowIdx
                          ? safeHeaders.map((__, cI) => (cI === colIdx ? nextVal : r[cI] ?? ''))
                          : r,
                      );
                      emitInlineBlockPatch(el, { rows: nextRows });
                    }}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && <BlockResizeHandles />}
    </div>
  );
}

export type CarouselBlockViewProps = {
  layout: LayoutIntent;
  items: CarouselItem[];
  fit?: 'cover' | 'contain';
  autoplay?: boolean;
  intervalSec?: number;
  showArrows?: boolean;
  showDots?: boolean;
  zoom?: boolean;
  media?: MediaAppearance;
  blockStyle?: BlockStyle;
  editing?: boolean;
  dragRef?: DragRef;
};

export function CarouselBlockView({
  layout,
  items,
  fit = 'contain',
  autoplay = false,
  intervalSec = 4,
  showArrows = true,
  showDots = true,
  zoom = true,
  media,
  blockStyle,
  editing = false,
  dragRef,
}: CarouselBlockViewProps) {
  const safeItems =
    items.length > 0
      ? items
      : [{ src: EDITOR2_DEFAULT_IMAGE_SRC, alt: 'Placa histológica', caption: '' }];
  const [index, setIndex] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const currentIndex = Math.min(index, safeItems.length - 1);
  const current = safeItems[currentIndex];

  useEffect(() => {
    if (editing || !autoplay || safeItems.length <= 1) return;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    const ms = Math.max(2, Math.min(15, intervalSec)) * 1000;
    const timer = window.setInterval(() => {
      setIndex((prevIdx) => (prevIdx + 1) % safeItems.length);
    }, ms);
    return () => window.clearInterval(timer);
  }, [autoplay, editing, intervalSec, safeItems.length]);

  useEffect(() => {
    if (!editing) return;
    const onSync = (event: Event) => {
      const detail = (event as CustomEvent<{ id?: string; index?: number }>).detail;
      const myId = rootRef.current?.dataset.puckComponent;
      if (detail && (!detail.id || !myId || detail.id === myId) && typeof detail.index === 'number') {
        setIndex(detail.index);
      }
    };
    window.addEventListener('e2:carousel-select', onSync);
    return () => window.removeEventListener('e2:carousel-select', onSync);
  }, [editing]);

  const changeSlide = (nextIdx: number) => {
    setIndex(nextIdx);
    const myId = rootRef.current?.dataset.puckComponent;
    window.dispatchEvent(new CustomEvent('e2:carousel-changed', { detail: { id: myId, index: nextIdx } }));
  };

  const prev = (e: React.MouseEvent) => {
    e.stopPropagation();
    changeSlide((currentIndex - 1 + safeItems.length) % safeItems.length);
  };

  const next = (e: React.MouseEvent) => {
    e.stopPropagation();
    changeSlide((currentIndex + 1) % safeItems.length);
  };

  return (
    <div
      ref={(node) => {
        rootRef.current = node;
        if (typeof dragRef === 'function') dragRef(node);
      }}
      className={`e2-block e2-block--carousel ${layoutClasses(layout)}`.trim()}
      style={mergeBlockStyle(rowStyle(layout), blockStyle)}
      data-e2-area={Object.values(layout).some((intent) => intent.row || intent.rowSpan) || undefined}
      data-e2-block="carousel"
    >
      <div className="e2-carousel-stage" style={mediaStageStyle(media)}>
        <img
          src={current.src}
          alt={current.alt}
          loading="lazy"
          draggable={false}
          style={mediaImageStyle(fit, media)}
          onClick={!editing && zoom ? () => setZoomed(true) : undefined}
        />
        {media?.overlayBadge && (
          <span className={`e2-media-overlay-badge e2-media-overlay-badge--${media.overlayPosition ?? 'tl'}`}>
            {media.overlayBadge}
          </span>
        )}
        {!editing && zoom && (
          <button
            type="button"
            className="e2-image-zoom-btn"
            aria-label="Ampliar imagen"
            title="Ampliar imagen"
            onClick={() => setZoomed(true)}
          >
            <ZoomIn size={14} aria-hidden="true" />
          </button>
        )}
        {safeItems.length > 1 && showArrows && (
          <>
            <button
              type="button"
              className="e2-carousel-nav e2-carousel-nav--prev"
              aria-label="Imagen anterior"
              data-puck-overlay-portal="true"
              onClick={prev}
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="e2-carousel-nav e2-carousel-nav--next"
              aria-label="Siguiente imagen"
              data-puck-overlay-portal="true"
              onClick={next}
            >
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </>
        )}
        {safeItems.length > 1 && showDots && (
          <div className="e2-carousel-dots" role="tablist" aria-label="Indicadores de galería">
            {safeItems.map((_, idx) => (
              <button
                key={idx}
                type="button"
                role="tab"
                aria-selected={idx === currentIndex}
                aria-label={`Ir a imagen ${idx + 1}`}
                className={`e2-carousel-dot ${idx === currentIndex ? 'is-active' : ''}`}
                data-puck-overlay-portal="true"
                onClick={(e) => {
                  e.stopPropagation();
                  changeSlide(idx);
                }}
              />
            ))}
          </div>
        )}
      </div>
      {(current.caption || editing) && (
        <p className={`e2-carousel-caption ${current.caption ? '' : 'e2-block__placeholder'}`.trim()}>
          {current.caption || `${currentIndex + 1} / ${safeItems.length}`}
        </p>
      )}
      <Editor2Lightbox
        open={!editing && zoomed}
        src={current.src}
        alt={current.alt}
        caption={current.caption}
        onClose={() => setZoomed(false)}
      />
      {editing && <BlockResizeHandles />}
    </div>
  );
}

const activeTabByBlockId = new Map<string, number>();

export function getActiveTabIndex(id?: string): number {
  return id ? activeTabByBlockId.get(id) ?? 0 : 0;
}

export function setActiveTabIndex(id: string | undefined, index: number): void {
  if (id) activeTabByBlockId.set(id, index);
}

export type TabsBlockViewItem = {
  title: string;
  subtitle?: string;
  content?: SlotComponent | ReactNode;
  imageSrc?: string;
  imageCaption?: string;
};

export type TabsBlockViewProps = {
  id?: string;
  layout?: LayoutIntent;
  items: TabsBlockViewItem[];
  accentColor?: string;
  tabStyle?: 'underline' | 'pills' | 'cards';
  blockStyle?: BlockStyle;
  editing?: boolean;
  dragRef?: DragRef;
};

export function TabsBlockView({
  id,
  layout = defaultLayout,
  items,
  accentColor = '#0284c7',
  tabStyle = 'underline',
  blockStyle,
  editing = false,
  dragRef,
}: TabsBlockViewProps) {
  const safeItems: TabsBlockViewItem[] =
    items.length > 0
      ? items
      : [{ title: 'Sección 1', content: 'Contenido de la pestaña.' }];
  const [activeTab, setActiveTab] = useState(() => getActiveTabIndex(id));
  const rootRef = useRef<HTMLDivElement | null>(null);
  const currentIdx = Math.min(activeTab, safeItems.length - 1);
  const current = safeItems[currentIdx];

  useEffect(() => {
    const resolvedId = id ?? rootRef.current?.dataset.puckComponent;
    if (resolvedId) {
      setActiveTabIndex(resolvedId, currentIdx);
    }
  }, [currentIdx, id]);

  useEffect(() => {
    if (!editing) return;
    const onSync = (event: Event) => {
      const detail = (event as CustomEvent<{ id?: string; index?: number }>).detail;
      const myId = id ?? rootRef.current?.dataset.puckComponent;
      if (detail && (!detail.id || !myId || detail.id === myId) && typeof detail.index === 'number') {
        setActiveTabIndex(myId, detail.index);
        setActiveTab(detail.index);
      }
    };
    window.addEventListener('e2:tabs-select', onSync);
    return () => window.removeEventListener('e2:tabs-select', onSync);
  }, [editing, id]);

  const switchTab = (nextIdx: number) => {
    const myId = id ?? rootRef.current?.dataset.puckComponent;
    setActiveTabIndex(myId, nextIdx);
    setActiveTab(nextIdx);
    window.dispatchEvent(new CustomEvent('e2:tabs-changed', { detail: { id: myId, index: nextIdx } }));
  };

  return (
    <div
      ref={(node) => {
        rootRef.current = node;
        if (typeof dragRef === 'function') dragRef(node);
      }}
      className={`e2-block e2-block--tabs e2-tabs--${tabStyle} ${layoutClasses(layout)}`.trim()}
      style={{ ...mergeBlockStyle(rowStyle(layout), blockStyle), ['--e2-tab-accent' as string]: accentColor }}
      data-e2-area={Object.values(layout).some((intent) => intent.row || intent.rowSpan) || undefined}
      data-e2-block="tabs"
    >
      <div className="e2-tabs-nav" role="tablist" aria-label="Secciones de pestañas">
        {safeItems.map((tab, idx) => {
          const isActive = idx === currentIdx;
          return (
            <button
              key={idx}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`e2-tabs-nav__btn ${isActive ? 'is-active' : ''}`}
              data-puck-overlay-portal="true"
              onClick={(e) => {
                e.stopPropagation();
                switchTab(idx);
              }}
            >
              <span className="e2-tabs-nav__title">{tab.title}</span>
              {tab.subtitle && <small className="e2-tabs-nav__subtitle">{tab.subtitle}</small>}
            </button>
          );
        })}
        {editing && (
          <div className="e2-tabs-nav__actions">
            {safeItems.length < 10 && (
              <button
                type="button"
                className="e2-tabs-nav__add"
                aria-label="Añadir pestaña"
                title="Añadir pestaña con bloque de página"
                data-puck-overlay-portal="true"
                onClick={(e) => {
                  e.stopPropagation();
                  const myId = id ?? rootRef.current?.dataset.puckComponent;
                  window.dispatchEvent(new CustomEvent('e2:tabs-add', { detail: { id: myId } }));
                }}
              >
                <Plus size={13} aria-hidden="true" />
                <span>Pestaña</span>
              </button>
            )}
            <button
              type="button"
              className="e2-section-delete"
              aria-label="Eliminar bloque de pestañas"
              title="Eliminar bloque de pestañas"
              data-puck-overlay-portal="true"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                const myId = id ?? rootRef.current?.dataset.puckComponent;
                if (myId) {
                  window.dispatchEvent(new CustomEvent('e2:remove-block', { detail: { id: myId } }));
                }
              }}
            >
              <Trash2 size={12} aria-hidden="true" />
              <span>Eliminar</span>
            </button>
          </div>
        )}
      </div>
      <div className="e2-tabs-panel" role="tabpanel" data-e2-panel-index={currentIdx}>
        {typeof current.content === 'function' ? (
          (current.content as SlotComponent)({
            className: 'e2-tabs-slot e2-slot-grid',
            allow: PANEL_COMPONENT_NAMES,
          })
        ) : (
          <>
            {current.content !== undefined && (
              <div className="e2-tabs-panel__text">{current.content as ReactNode}</div>
            )}
            {current.imageSrc && (
              <figure className="e2-tabs-panel__figure">
                <img src={current.imageSrc} alt={current.imageCaption || current.title} loading="lazy" draggable={false} />
                {current.imageCaption && <figcaption>{current.imageCaption}</figcaption>}
              </figure>
            )}
          </>
        )}
      </div>
      {editing && <BlockResizeHandles />}
    </div>
  );
}

const activeAccordionByBlockId = new Map<string, number>();

export function getActiveAccordionIndex(id?: string): number {
  return id ? activeAccordionByBlockId.get(id) ?? 0 : 0;
}

export function setActiveAccordionIndex(id: string | undefined, index: number): void {
  if (id) activeAccordionByBlockId.set(id, index);
}

function parseVideoSource(rawUrl: string): { kind: 'iframe' | 'video'; src: string } | null {
  const url = rawUrl.trim();
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return null;
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const v = parsed.searchParams.get('v');
      if (v) return { kind: 'iframe', src: `https://www.youtube.com/embed/${encodeURIComponent(v)}` };
      const embedMatch = parsed.pathname.match(/^\/(?:embed|shorts)\/([a-zA-Z0-9_-]+)/);
      if (embedMatch) return { kind: 'iframe', src: `https://www.youtube.com/embed/${embedMatch[1]}` };
    }
    if (host === 'youtu.be') {
      const id = parsed.pathname.slice(1).split('/')[0];
      if (id) return { kind: 'iframe', src: `https://www.youtube.com/embed/${encodeURIComponent(id)}` };
    }
    if (host === 'vimeo.com') {
      const id = parsed.pathname.slice(1).split('/')[0];
      if (id && /^\d+$/.test(id)) return { kind: 'iframe', src: `https://player.vimeo.com/video/${id}` };
    }
    if (/\.(mp4|webm|ogg)$/i.test(parsed.pathname)) {
      return { kind: 'video', src: url };
    }
    return { kind: 'iframe', src: url };
  } catch {
    return null;
  }
}

export type VideoBlockViewProps = {
  layout: LayoutIntent;
  url: string;
  caption?: string;
  aspect?: '16/9' | '4/3' | '1/1';
  blockStyle?: BlockStyle;
  editing?: boolean;
  dragRef?: DragRef;
};

export function VideoBlockView({
  layout,
  url,
  caption,
  aspect = '16/9',
  blockStyle,
  editing = false,
  dragRef,
}: VideoBlockViewProps) {
  const media = parseVideoSource(url);
  const showCaption = editing || (caption ?? '') !== '';

  return (
    <figure
      ref={dragRef ?? undefined}
      className={`e2-block e2-block--video ${layoutClasses(layout)}`.trim()}
      style={mergeBlockStyle(rowStyle(layout), blockStyle)}
      data-e2-area={Object.values(layout).some((intent) => intent.row || intent.rowSpan) || undefined}
      data-e2-block="video"
    >
      <div className="e2-video-stage" style={{ aspectRatio: aspect.replace('/', ' / ') }}>
        {media ? (
          media.kind === 'video' ? (
            <video src={media.src} controls playsInline className="e2-video-player" />
          ) : (
            <iframe
              src={media.src}
              title={caption || 'Video educativo'}
              className="e2-video-iframe"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          )
        ) : (
          <div className="e2-video-empty">
            <Film size={22} aria-hidden="true" />
            <span>Pega una URL de YouTube, Vimeo o MP4 en la barra superior</span>
          </div>
        )}
      </div>
      {showCaption && (
        <figcaption className={caption ? undefined : 'e2-block__placeholder'}>
          {caption || (editing ? 'Añade un pie de video' : '')}
        </figcaption>
      )}
      {editing && <BlockResizeHandles />}
    </figure>
  );
}

export type CompareBlockViewProps = {
  layout: LayoutIntent;
  leftSrc: string;
  leftLabel?: string;
  rightSrc: string;
  rightLabel?: string;
  blockStyle?: BlockStyle;
  editing?: boolean;
  dragRef?: DragRef;
};

export function CompareBlockView({
  layout,
  leftSrc,
  leftLabel = 'Vista A',
  rightSrc,
  rightLabel = 'Vista B',
  blockStyle,
  editing = false,
  dragRef,
}: CompareBlockViewProps) {
  const [split, setSplit] = useState(50);

  return (
    <div
      ref={dragRef ?? undefined}
      className={`e2-block e2-block--compare ${layoutClasses(layout)}`.trim()}
      style={mergeBlockStyle(rowStyle(layout), blockStyle)}
      data-e2-area={Object.values(layout).some((intent) => intent.row || intent.rowSpan) || undefined}
      data-e2-block="compare"
    >
      <div className="e2-compare-stage">
        <img
          src={rightSrc}
          alt={rightLabel || 'Imagen derecha'}
          className="e2-compare-img e2-compare-img--right"
          loading="lazy"
          draggable={false}
        />
        <img
          src={leftSrc}
          alt={leftLabel || 'Imagen izquierda'}
          className="e2-compare-img e2-compare-img--left"
          style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}
          loading="lazy"
          draggable={false}
        />
        <div className="e2-compare-divider" style={{ left: `${split}%` }} aria-hidden="true">
          <span className="e2-compare-knob">↔</span>
        </div>
        {leftLabel && <span className="e2-compare-badge e2-compare-badge--left">{leftLabel}</span>}
        {rightLabel && <span className="e2-compare-badge e2-compare-badge--right">{rightLabel}</span>}
        <input
          type="range"
          min={0}
          max={100}
          value={split}
          aria-label="Deslizador de comparación de imágenes"
          className="e2-compare-range"
          data-puck-overlay-portal="true"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => setSplit(Number(e.target.value))}
        />
      </div>
      {editing && <BlockResizeHandles />}
    </div>
  );
}

const CALLOUT_TONES = {
  info: { label: 'Nota', Icon: Info },
  clinical: { label: 'Correlación clínica', Icon: Stethoscope },
  tip: { label: 'Dato clave', Icon: Lightbulb },
  warning: { label: 'Advertencia', Icon: AlertTriangle },
} as const;

export type CalloutBlockViewProps = {
  layout: LayoutIntent;
  tone?: 'info' | 'clinical' | 'tip' | 'warning';
  title: string;
  text: string;
  richText?: RichTextV2;
  blockStyle?: BlockStyle;
  editing?: boolean;
  dragRef?: DragRef;
};

export function CalloutBlockView({
  layout,
  tone = 'info',
  title,
  text,
  richText,
  blockStyle,
  editing = false,
  dragRef,
}: CalloutBlockViewProps) {
  const { Icon } = CALLOUT_TONES[tone] ?? CALLOUT_TONES.info;
  const titleRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const lastTitleRef = useRef(title);
  const lastTextRef = useRef(text);

  useLayoutEffect(() => {
    lastTitleRef.current = title;
    if (!editing || !titleRef.current) return;
    if (document.activeElement === titleRef.current) return;
    titleRef.current.textContent = title || 'Título de la nota';
  }, [editing, title]);

  useLayoutEffect(() => {
    lastTextRef.current = text;
    if (!editing || !bodyRef.current) return;
    if (document.activeElement === bodyRef.current) return;
    bodyRef.current.textContent = text || 'Escribe aquí el contenido de la nota.';
  }, [editing, text]);

  return (
    <aside
      ref={dragRef ?? undefined}
      className={`e2-block e2-block--callout e2-callout--${tone} ${layoutClasses(layout)}`.trim()}
      style={mergeBlockStyle(rowStyle(layout), blockStyle)}
      data-e2-area={Object.values(layout).some((intent) => intent.row || intent.rowSpan) || undefined}
      data-e2-block="callout"
    >
      <div className="e2-callout__head">
        <Icon size={16} className="e2-callout__icon" aria-hidden="true" />
        <div
          ref={titleRef}
          className={`e2-callout__title ${editing ? 'e2-inline-editable' : ''}`.trim()}
          contentEditable={editing ? false : undefined}
          suppressContentEditableWarning={editing || undefined}
          data-puck-overlay-portal={editing ? 'true' : undefined}
          data-e2-editable={editing ? 'callout-title' : undefined}
          onClick={editing ? (e) => e.stopPropagation() : undefined}
          onInput={(e) => {
            if (!editing) return;
            const next = (e.currentTarget.innerText ?? e.currentTarget.textContent ?? '').replace(/\r?\n/g, ' ');
            lastTitleRef.current = next;
            emitInlineBlockPatch(e.currentTarget, { title: next });
          }}
          onBlur={(e) => {
            if (!editing) return;
            const next = (e.currentTarget.innerText ?? e.currentTarget.textContent ?? '').replace(/\r?\n/g, ' ');
            if (next !== lastTitleRef.current) {
              lastTitleRef.current = next;
              emitInlineBlockPatch(e.currentTarget, { title: next });
            }
          }}
          onKeyDown={(e) => {
            if (!editing) return;
            e.stopPropagation();
            if (e.key === 'Enter' || e.key === 'Escape') {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
        >
          {editing ? null : title}
        </div>
      </div>
      <div
        ref={bodyRef}
        className={`e2-callout__body ${editing ? 'e2-inline-editable' : ''}`.trim()}
        contentEditable={editing ? false : undefined}
        suppressContentEditableWarning={editing || undefined}
        data-puck-overlay-portal={editing ? 'true' : undefined}
        data-e2-editable={editing ? 'callout-text' : undefined}
        onClick={editing ? (e) => e.stopPropagation() : undefined}
        onInput={(e) => {
          if (!editing) return;
          const next = (e.currentTarget.innerText ?? e.currentTarget.textContent ?? '').replace(/\r\n/g, '\n');
          lastTextRef.current = next;
          emitInlineBlockPatch(e.currentTarget, { text: next });
        }}
        onBlur={(e) => {
          if (!editing) return;
          const next = (e.currentTarget.innerText ?? e.currentTarget.textContent ?? '').replace(/\r\n/g, '\n');
          if (next !== lastTextRef.current) {
            lastTextRef.current = next;
            emitInlineBlockPatch(e.currentTarget, { text: next });
          }
        }}
        onKeyDown={(e) => {
          if (!editing) return;
          e.stopPropagation();
          if (e.key === 'Escape') {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
      >
        {editing ? null : richText ? renderRichTextContent(richText) : text}
      </div>
      {editing && <BlockResizeHandles />}
    </aside>
  );
}

export type GifBlockViewProps = {
  layout: LayoutIntent;
  src: string;
  alt: string;
  caption?: string;
  fit?: 'cover' | 'contain';
  zoom?: boolean;
  media?: MediaAppearance;
  blockStyle?: BlockStyle;
  editing?: boolean;
  dragRef?: DragRef;
};

export function GifBlockView({
  layout,
  src,
  alt,
  caption,
  fit = 'contain',
  zoom = false,
  media,
  blockStyle,
  editing = false,
  dragRef,
}: GifBlockViewProps) {
  const showCaption = editing || (caption ?? '') !== '';
  const [zoomed, setZoomed] = useState(false);

  return (
    <figure
      ref={dragRef ?? undefined}
      className={`e2-block e2-block--image e2-block--gif ${layoutClasses(layout)}`.trim()}
      style={mergeBlockStyle(rowStyle(layout), blockStyle)}
      data-e2-area={Object.values(layout).some((intent) => intent.row || intent.rowSpan) || undefined}
      data-e2-block="gif"
    >
      <div className="e2-image-stage" style={mediaStageStyle(media)}>
        <img
          src={src}
          alt={alt}
          loading="lazy"
          draggable={false}
          style={mediaImageStyle(fit, media)}
          onClick={!editing && zoom ? () => setZoomed(true) : undefined}
        />
        {media?.overlayBadge ? (
          <span className={`e2-media-overlay-badge e2-media-overlay-badge--${media.overlayPosition ?? 'tl'}`}>
            {media.overlayBadge}
          </span>
        ) : (
          <span className="e2-gif-badge" aria-hidden="true">GIF</span>
        )}
        {!editing && zoom && (
          <button
            type="button"
            className="e2-image-zoom-btn"
            aria-label="Ampliar GIF"
            title="Ampliar GIF"
            onClick={() => setZoomed(true)}
          >
            <ZoomIn size={14} aria-hidden="true" />
          </button>
        )}
      </div>
      {showCaption && (
        <figcaption className={caption ? undefined : 'e2-block__placeholder'}>
          {caption || (editing ? 'Añade un pie de GIF' : '')}
        </figcaption>
      )}
      <Editor2Lightbox
        open={!editing && zoomed}
        src={src}
        alt={alt}
        caption={caption}
        onClose={() => setZoomed(false)}
      />
      {editing && <BlockResizeHandles />}
    </figure>
  );
}

export type BadgeBlockViewProps = {
  layout: LayoutIntent;
  text: string;
  variant?: 'solid' | 'soft' | 'outline' | 'glass' | 'swatch';
  color?: string;
  icon?: string;
  size?: 'sm' | 'md' | 'lg';
  align?: 'left' | 'center' | 'right';
  blockStyle?: BlockStyle;
  editing?: boolean;
  dragRef?: DragRef;
};

export function BadgeBlockView({
  layout,
  text,
  variant = 'soft',
  color = '#0284c7',
  icon,
  size = 'md',
  align = 'left',
  blockStyle,
  editing = false,
  dragRef,
}: BadgeBlockViewProps) {
  const editableRef = useRef<HTMLSpanElement>(null);
  const lastRef = useRef(text);

  useLayoutEffect(() => {
    lastRef.current = text;
    if (!editing || !editableRef.current) return;
    if (document.activeElement === editableRef.current) return;
    editableRef.current.textContent = text || 'Etiqueta';
  }, [editing, text]);

  const badgeStyle: CSSProperties =
    variant === 'solid'
      ? { backgroundColor: color, borderColor: color, color: '#ffffff' }
      : variant === 'outline'
        ? { backgroundColor: 'transparent', borderColor: color, color }
        : variant === 'glass'
          ? {
              backgroundColor: `color-mix(in srgb, ${color} 16%, rgba(255,255,255,0.7))`,
              borderColor: `color-mix(in srgb, ${color} 35%, transparent)`,
              color,
              backdropFilter: 'blur(8px)',
            }
          : variant === 'swatch'
            ? { backgroundColor: 'var(--e2-panel)', borderColor: 'var(--e2-line-strong)', color: 'var(--e2-ink)' }
            : {
                backgroundColor: `color-mix(in srgb, ${color} 14%, #ffffff)`,
                borderColor: `color-mix(in srgb, ${color} 30%, transparent)`,
                color,
              };

  const justify = align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start';

  return (
    <div
      ref={dragRef ?? undefined}
      className={`e2-block e2-block--badge ${layoutClasses(layout)}`.trim()}
      style={{ ...mergeBlockStyle(rowStyle(layout), blockStyle), display: 'flex', justifyContent: justify }}
      data-e2-area={Object.values(layout).some((intent) => intent.row || intent.rowSpan) || undefined}
      data-e2-block="badge"
    >
      <span className={`e2-badge e2-badge--${size} e2-badge--${variant}`} style={badgeStyle}>
        {variant === 'swatch' && (
          <span className="e2-badge__swatch-dot" style={{ backgroundColor: color }} aria-hidden="true" />
        )}
        {icon && renderAtlasIcon(icon, size === 'lg' ? 15 : size === 'sm' ? 11 : 13)}
        <span
          ref={editableRef}
          contentEditable={editing ? false : undefined}
          suppressContentEditableWarning={editing || undefined}
          data-puck-overlay-portal={editing ? 'true' : undefined}
          data-e2-editable={editing ? 'badge' : undefined}
          className={editing ? 'e2-inline-editable' : undefined}
          onClick={editing ? (e) => e.stopPropagation() : undefined}
          onInput={(e) => {
            if (!editing) return;
            const next = (e.currentTarget.innerText ?? e.currentTarget.textContent ?? '').replace(/\r?\n/g, ' ');
            lastRef.current = next;
            emitInlineBlockPatch(e.currentTarget, { text: next });
          }}
          onBlur={(e) => {
            if (!editing) return;
            const next = (e.currentTarget.innerText ?? e.currentTarget.textContent ?? '').replace(/\r?\n/g, ' ').trim();
            if (next !== lastRef.current) {
              lastRef.current = next;
              emitInlineBlockPatch(e.currentTarget, { text: next || 'Etiqueta' });
            }
          }}
          onKeyDown={(e) => {
            if (!editing) return;
            e.stopPropagation();
            if (e.key === 'Enter' || e.key === 'Escape') {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
        >
          {editing ? null : text}
        </span>
      </span>
      {editing && <BlockResizeHandles />}
    </div>
  );
}

export type IconBlockViewProps = {
  layout: LayoutIntent;
  name: string;
  size?: number;
  color?: string;
  bgColor?: string;
  frame?: 'none' | 'circle' | 'rounded';
  align?: 'left' | 'center' | 'right';
  label?: string;
  blockStyle?: BlockStyle;
  editing?: boolean;
  dragRef?: DragRef;
};

export function IconBlockView({
  layout,
  name,
  size = 32,
  color = '#0284c7',
  bgColor,
  frame = 'rounded',
  align = 'left',
  label,
  blockStyle,
  editing = false,
  dragRef,
}: IconBlockViewProps) {
  const justify = align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start';
  const frameStyle: CSSProperties = {
    color,
    ...(frame !== 'none'
      ? {
          backgroundColor: bgColor ?? `color-mix(in srgb, ${color} 13%, #ffffff)`,
          borderColor: `color-mix(in srgb, ${color} 28%, transparent)`,
        }
      : {}),
  };

  return (
    <div
      ref={dragRef ?? undefined}
      className={`e2-block e2-block--icon ${layoutClasses(layout)}`.trim()}
      style={{ ...mergeBlockStyle(rowStyle(layout), blockStyle), display: 'flex', justifyContent: justify }}
      data-e2-area={Object.values(layout).some((intent) => intent.row || intent.rowSpan) || undefined}
      data-e2-block="icon"
      role={label ? 'img' : undefined}
      aria-label={label || undefined}
    >
      <span className={`e2-icon-frame e2-icon-frame--${frame}`} style={frameStyle}>
        {renderAtlasIcon(name, size)}
      </span>
      {editing && <BlockResizeHandles />}
    </div>
  );
}

export type AccordionBlockViewItem = {
  title: string;
  openByDefault?: boolean;
  content?: SlotComponent | ReactNode;
};

export type AccordionBlockViewProps = {
  id?: string;
  layout?: LayoutIntent;
  items: AccordionBlockViewItem[];
  accentColor?: string;
  mode?: 'default' | 'reveal';
  blockStyle?: BlockStyle;
  editing?: boolean;
  dragRef?: DragRef;
};

export function AccordionBlockView({
  id,
  layout = defaultLayout,
  items,
  accentColor = '#0284c7',
  mode = 'default',
  blockStyle,
  editing = false,
  dragRef,
}: AccordionBlockViewProps) {
  const safeItems: AccordionBlockViewItem[] =
    items.length > 0
      ? items
      : [{ title: 'Sección desplegable 1', openByDefault: true, content: 'Contenido desplegable.' }];
  const [openIndices, setOpenIndices] = useState<number[]>(() => {
    if (id && activeAccordionByBlockId.has(id)) {
      return [activeAccordionByBlockId.get(id)!];
    }
    const defaults = safeItems
      .map((item, idx) => (item.openByDefault ? idx : -1))
      .filter((idx) => idx >= 0);
    return defaults.length > 0 ? defaults : [0];
  });
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!editing) return;
    const onSync = (event: Event) => {
      const detail = (event as CustomEvent<{ id?: string; index?: number }>).detail;
      const myId = id ?? rootRef.current?.dataset.puckComponent;
      if (detail && (!detail.id || !myId || detail.id === myId) && typeof detail.index === 'number') {
        setActiveAccordionIndex(myId, detail.index);
        setOpenIndices((prev) => (prev.includes(detail.index!) ? prev : [...prev, detail.index!]));
      }
    };
    window.addEventListener('e2:accordion-select', onSync);
    return () => window.removeEventListener('e2:accordion-select', onSync);
  }, [editing, id]);

  const toggleItem = (idx: number) => {
    const myId = id ?? rootRef.current?.dataset.puckComponent;
    setOpenIndices((prev) => {
      const isOpen = prev.includes(idx);
      const next = isOpen ? prev.filter((i) => i !== idx) : [...prev, idx];
      if (!isOpen) {
        setActiveAccordionIndex(myId, idx);
        window.dispatchEvent(new CustomEvent('e2:accordion-changed', { detail: { id: myId, index: idx } }));
      }
      return next;
    });
  };

  return (
    <div
      ref={(node) => {
        rootRef.current = node;
        if (typeof dragRef === 'function') dragRef(node);
      }}
      className={`e2-block e2-block--accordion e2-accordion--${mode} ${layoutClasses(layout)}`.trim()}
      style={{ ...mergeBlockStyle(rowStyle(layout), blockStyle), ['--e2-accordion-accent' as string]: accentColor }}
      data-e2-area={Object.values(layout).some((intent) => intent.row || intent.rowSpan) || undefined}
      data-e2-block="accordion"
    >
      {safeItems.map((sectionItem, idx) => {
        const isOpen = openIndices.includes(idx);
        return (
          <div key={idx} className={`e2-accordion-item ${isOpen ? 'is-open' : ''}`}>
            <button
              type="button"
              className="e2-accordion-trigger"
              aria-expanded={isOpen}
              data-puck-overlay-portal="true"
              onClick={(e) => {
                e.stopPropagation();
                toggleItem(idx);
              }}
            >
              <span className="e2-accordion-trigger__label">
                {mode === 'reveal' && <Lightbulb size={15} className="e2-accordion-reveal-icon" aria-hidden="true" />}
                <span>{sectionItem.title}</span>
              </span>
              <ChevronDown size={16} className="e2-accordion-chevron" aria-hidden="true" />
            </button>
            {isOpen && (
              <div className="e2-accordion-panel" data-e2-panel-index={idx}>
                {typeof sectionItem.content === 'function' ? (
                  (sectionItem.content as SlotComponent)({
                    className: 'e2-tabs-slot e2-slot-grid',
                    allow: PANEL_COMPONENT_NAMES,
                  })
                ) : (
                  <div className="e2-tabs-panel__text">{sectionItem.content as ReactNode}</div>
                )}
              </div>
            )}
          </div>
        );
      })}
      {editing && (
        <div className="e2-accordion-footer">
          {safeItems.length < 12 && (
            <button
              type="button"
              className="e2-tabs-nav__add"
              aria-label="Añadir sección desplegable"
              title="Añadir sección desplegable con bloque de página"
              data-puck-overlay-portal="true"
              onClick={(e) => {
                e.stopPropagation();
                const myId = id ?? rootRef.current?.dataset.puckComponent;
                window.dispatchEvent(new CustomEvent('e2:accordion-add', { detail: { id: myId } }));
              }}
            >
              <Plus size={13} aria-hidden="true" />
              <span>Sección desplegable</span>
            </button>
          )}
          <button
            type="button"
            className="e2-section-delete"
            aria-label="Eliminar acordeón"
            title="Eliminar acordeón"
            data-puck-overlay-portal="true"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              const myId = id ?? rootRef.current?.dataset.puckComponent;
              if (myId) {
                window.dispatchEvent(new CustomEvent('e2:remove-block', { detail: { id: myId } }));
              }
            }}
          >
            <Trash2 size={12} aria-hidden="true" />
            <span>Eliminar</span>
          </button>
        </div>
      )}
      {editing && <BlockResizeHandles />}
    </div>
  );
}

export type BoxBlockViewProps = {
  id?: string;
  layout?: LayoutIntent;
  gap: Gap;
  blockStyle?: BlockStyle;
  children?: ReactNode;
  dragRef?: DragRef;
  editing?: boolean;
};

export function BoxBlockView({
  id,
  layout = defaultBoxLayout,
  gap,
  blockStyle,
  children,
  dragRef,
  editing = false,
}: BoxBlockViewProps) {
  const responsive = responsiveValues(blockStyle, useContext(CanvasScreen), gap);
  const flow = responsive.direction === 'grid' ? undefined : responsive.direction;
  const rootRef = useRef<HTMLDivElement | null>(null);
  return (
    <div
      ref={(node) => {
        rootRef.current = node;
        if (typeof dragRef === 'function') dragRef(node);
      }}
      className={`e2-block e2-block--box ${blockMotionClasses(blockStyle, editing)} ${layoutClasses(layout)}`.trim()}
      style={rowStyle(layout)}
      data-e2-area={Object.values(layout).some((intent) => intent.row || intent.rowSpan) || undefined}
      data-e2-block="box"
    >
      <div data-flow={flow}
        data-flow-justify={blockStyle?.flow?.justify}
        data-flow-align={flow ? responsive.align : undefined}
        data-flow-wrap={blockStyle?.flow?.wrap === false ? 'off' : undefined}
        className={`e2-box__surface e2-gap-${responsive.gap}`} style={blockStyleToCss(blockStyle, true)}>
        {editing && (
          <div className="e2-box__header">
            <span className="e2-box__label">Tarjeta / Caja</span>
            <button
              type="button"
              className="e2-section-delete"
              aria-label="Eliminar tarjeta"
              title="Eliminar tarjeta"
              data-puck-overlay-portal="true"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                const myId = id ?? rootRef.current?.dataset.puckComponent;
                if (myId) {
                  window.dispatchEvent(new CustomEvent('e2:remove-block', { detail: { id: myId } }));
                }
              }}
            >
              <Trash2 size={12} aria-hidden="true" />
              <span>Eliminar</span>
            </button>
          </div>
        )}
        {children}
      </div>
      {editing && <BlockResizeHandles />}
    </div>
  );
}

export type CanvasBlockViewProps = {
  id?: string;
  gap: Gap;
  blockStyle?: BlockStyle;
  children?: ReactNode;
  dragRef?: DragRef;
  editing?: boolean;
};

export function CanvasBlockView({ id, gap, blockStyle, children, dragRef, editing }: CanvasBlockViewProps) {
  const responsive = responsiveValues(blockStyle, useContext(CanvasScreen), gap);
  const flow = responsive.direction === 'grid' ? undefined : responsive.direction;
  const rootRef = useRef<HTMLDivElement | null>(null);
  return (
    <div
      ref={(node) => {
        rootRef.current = node;
        if (typeof dragRef === 'function') dragRef(node);
      }}
      className={`e2-block e2-block--canvas e2-gap-${responsive.gap} ${blockMotionClasses(blockStyle, editing)}`.trim()}
      style={blockStyleToCss(blockStyle)}
      data-flow={flow}
        data-flow-justify={blockStyle?.flow?.justify}
        data-flow-align={flow ? responsive.align : undefined}
        data-flow-wrap={blockStyle?.flow?.wrap === false ? 'off' : undefined}
        data-e2-block="canvas"
    >
      {editing && (
        <div className="e2-section-header">
          <span className="e2-section-label">Sección guardada</span>
          <button
            type="button"
            className="e2-section-delete"
            aria-label="Eliminar sección guardada"
            title="Eliminar sección guardada"
            data-puck-overlay-portal="true"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              const myId = id ?? rootRef.current?.dataset.puckComponent;
              if (myId) {
                window.dispatchEvent(new CustomEvent('e2:remove-block', { detail: { id: myId } }));
              }
            }}
          >
            <Trash2 size={12} aria-hidden="true" />
            <span>Eliminar</span>
          </button>
        </div>
      )}
      {children}
    </div>
  );
}

function updateBreakpoint(
  layout: LayoutIntent,
  breakpoint: BreakpointKey,
  intent: SpanIntent | undefined,
): LayoutIntent {
  const next: LayoutIntent = { ...layout };

  if (breakpoint === 'base') {
    if (intent) {
      next.base = intent;
      if (next.md) next.md = { ...intent };
      if (next.lg) next.lg = { ...intent };
    }
    return next;
  }

  if (intent) {
    next[breakpoint] = intent;
  } else {
    delete next[breakpoint];
  }

  return next;
}

const LayoutControls: CustomFieldRender<LayoutIntent> = ({ value, onChange, id }) => {
  const layout = value ?? createLayoutIntent(24);
  const [breakpoint, setBreakpoint] = useState<BreakpointKey>('base');
  const rawIntent = layout[breakpoint];
  const intent =
    breakpoint === 'base' &&
      rawIntent &&
      rawIntent.start === undefined &&
      rawIntent.row === undefined &&
      (layout.lg || layout.md)
      ? { ...(layout.md ?? {}), ...(layout.lg ?? {}), ...rawIntent, span: (layout.lg ?? layout.md ?? rawIntent).span }
      : rawIntent;
  const enabled = intent !== undefined;
  const label = BREAKPOINT_LABELS[breakpoint];
  return (
    <InspectorDialog label="Cuadrícula" icon={<Grid2x2 size={14} aria-hidden="true" />}>
      <div className="e2-layout-field">
        <div className="e2-layout-field__row" data-breakpoint={breakpoint}>
          <div className="e2-layout-field__head">
            <label className="e2-layout-field__control">
              <span>Pantalla</span>
              <select value={breakpoint} onChange={e => setBreakpoint(e.target.value as BreakpointKey)}>
                {BREAKPOINTS.map(key => <option key={key} value={key}>{BREAKPOINT_LABELS[key]}</option>)}
              </select>
            </label>
            {breakpoint !== 'base' && (
              <label className="e2-layout-field__enable">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(event) =>
                    onChange(
                      updateBreakpoint(
                        layout,
                        breakpoint,
                        event.target.checked
                          ? (breakpoint === 'lg' ? layout.md ?? layout.base : layout.base)
                          : undefined,
                      ),
                    )
                  }
                  aria-label={`Usar distribución ${label.toLowerCase()}`}
                />
                <span>Usar</span>
              </label>
            )}
          </div>

          {enabled && intent && (
            <>
              <div className="e2-layout-field__controls">
                <label className="e2-layout-field__control">
                  <span>Ancho</span>
                  <select
                    id={`${id}-${breakpoint}-span`}
                    value={toGridSpan(intent.span)}
                    aria-label={`Columnas en ${label.toLowerCase()}`}
                    onChange={(event) =>
                      onChange(updateBreakpoint(layout, breakpoint, {
                        ...intent, span: fromGridSpan(Number(event.target.value)),
                        ...(intent.start === undefined ? {} : {
                          start: Math.min(intent.start, fromGridLine(GRID_COLUMNS + 1 - Number(event.target.value))),
                        }),
                      }))
                    }
                  >
                    {COLUMN_OPTIONS.map((column) => (
                      <option key={column} value={column}>
                        {column}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="e2-layout-field__control">
                  <span>Columna</span>
                  <select
                    id={`${id}-${breakpoint}-start`}
                    value={intent.start === undefined ? '' : toGridLine(intent.start)}
                    aria-label={`Columna inicial en ${label.toLowerCase()}`}
                    onChange={(event) =>
                      onChange(
                        updateBreakpoint(
                          layout,
                          breakpoint,
                          { ...intent, start: event.target.value === '' ? undefined : fromGridLine(Number(event.target.value)) },
                        ),
                      )
                    }
                  >
                    <option value="">Auto</option>
                    {COLUMN_OPTIONS.slice(0, GRID_COLUMNS + 1 - toGridSpan(intent.span)).map((column) => (
                      <option key={column} value={column}>
                        {column}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="e2-layout-field__control">
                  <span>Fila</span>
                  <input type="number" min={1} max={GRID_MAX_ROW} placeholder="Auto"
                    value={intent.row === undefined ? '' : toGridLine(intent.row)}
                    aria-label={`Fila inicial en ${label.toLowerCase()}`}
                    onChange={(event) => {
                      const row = Number(event.target.value);
                      if (event.target.value === '' || (Number.isInteger(row) && row >= 1 && row <= GRID_MAX_ROW)) {
                        onChange(updateBreakpoint(layout, breakpoint, { ...intent, row: event.target.value === '' ? undefined : fromGridLine(row) }));
                      }
                    }}
                  />
                </label>
                <label className="e2-layout-field__control">
                  <span>Alto</span>
                  <select value={intent.rowSpan === undefined ? '' : toGridSpan(intent.rowSpan)} aria-label={`Alto en ${label.toLowerCase()}`}
                    onChange={(event) => onChange(updateBreakpoint(layout, breakpoint, {
                      ...intent, rowSpan: event.target.value === '' ? undefined : fromGridSpan(Number(event.target.value)),
                    }))}
                  >
                    <option value="">Auto</option>
                    {COLUMN_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
                <label className="e2-layout-field__control">
                  <span>Vertical</span>
                  <select value={intent.verticalAlign ?? ''} aria-label={`Alineación vertical en ${label.toLowerCase()}`}
                    onChange={event => onChange(updateBreakpoint(layout, breakpoint, {
                      ...intent, verticalAlign: event.target.value as SpanIntent['verticalAlign'] || undefined,
                    }))}>
                    <option value="">Auto</option>
                    <option value="start">Arriba</option>
                    <option value="center">Centro</option>
                    <option value="end">Abajo</option>
                  </select>
                </label>
              </div>
              <GridAreaPicker intent={intent} onChange={(area) => onChange(updateBreakpoint(layout, breakpoint, area))} />
            </>
          )}
        </div>
      </div>
    </InspectorDialog>
  );
};

const LayoutField: CustomFieldRender<LayoutIntent> = props => <LayoutControls {...props} />;

const layoutField: CustomField<LayoutIntent> = {
  type: 'custom',
  label: 'Distribución',
  render: LayoutField,
};

function createColorField(label: string, fallback: string): CustomField<string> {
  return {
    type: 'custom',
    label,
    render: ({ value, onChange }) => (
      <input
        type="color"
        aria-label={label}
        title={label}
        value={typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback}
        onChange={(e) => onChange(e.target.value)}
      />
    ),
  };
}

const defaultLayout = createLayoutIntent(24);
const defaultHeadingLayout: LayoutIntent = { base: { span: 8, rowSpan: 1 } };
const defaultTextLayout: LayoutIntent = { base: { span: 10, rowSpan: 2 } };
const defaultImageLayout: LayoutIntent = { base: { span: 6, rowSpan: 4 } };
const defaultDividerLayout: LayoutIntent = { base: { span: 12, rowSpan: 1 } };
const defaultButtonLayout: LayoutIntent = { base: { span: 6, rowSpan: 1 } };
const defaultTableLayout: LayoutIntent = { base: { span: 12, rowSpan: 4 } };
const defaultCarouselLayout: LayoutIntent = { base: { span: 10, rowSpan: 6 } };
const defaultVideoLayout: LayoutIntent = { base: { span: 12, rowSpan: 6 } };
const defaultCompareLayout: LayoutIntent = { base: { span: 10, rowSpan: 6 } };
const defaultCalloutLayout: LayoutIntent = { base: { span: 12, rowSpan: 3 } };
const defaultGifLayout: LayoutIntent = { base: { span: 6, rowSpan: 4 } };
const defaultBadgeLayout: LayoutIntent = { base: { span: 5, rowSpan: 1 } };
const defaultIconLayout: LayoutIntent = { base: { span: 3, rowSpan: 2 } };
const defaultExamCarouselLayout: LayoutIntent = { base: { span: 24, rowSpan: 5 } };
const defaultBoxLayout: LayoutIntent = { base: { span: 12, rowSpan: 4 } };

const LEAF_COMPONENT_NAMES = [
  'heading',
  'text',
  'image',
  'gif',
  'video',
  'compare',
  'callout',
  'divider',
  'button',
  'table',
  'carousel',
  'badge',
  'icon',
  'examCarousel',
];

const PANEL_COMPONENT_NAMES = [...LEAF_COMPONENT_NAMES, 'box'];
const ROOT_COMPONENT_NAMES = [...PANEL_COMPONENT_NAMES, 'tabs', 'accordion'];

export type Editor2CanvasProps = {
  layout: LayoutIntent;
  gap: Gap;
  content: SlotComponent;
  dragRef?: DragRef;
};

export const editor2PuckConfig: Config = {
  categories: {
    estructura: { title: 'Estructura', components: ['box', 'tabs', 'accordion'] },
    seccionesGuardadas: { components: ['canvas'], visible: false },
    contenido: {
      title: 'Contenido',
      components: ['heading', 'text', 'badge', 'icon', 'callout', 'table', 'button', 'divider', 'examCarousel'],
    },
    multimedia: {
      title: 'Multimedia',
      components: ['image', 'carousel', 'compare', 'gif', 'video'],
    },
  },
  components: {
    heading: {
      label: 'Título',
      inline: true,
      defaultProps: {
        layout: defaultHeadingLayout,
        level: 2,
        text: 'Subtítulo',
      },
      fields: {
        level: {
          type: 'select',
          label: 'Nivel',
          options: [
            { label: 'Título 1', value: 1 },
            { label: 'Título 2', value: 2 },
            { label: 'Título 3', value: 3 },
          ],
        },
        layout: layoutField,
      },
      render: ({ layout, level, text, richText, appearance, style, puck }) => (
        <HeadingBlockView
          layout={layout ?? defaultHeadingLayout}
          level={level ?? 2}
          text={text ?? ''}
          richText={richText}
          appearance={appearance}
          blockStyle={style}
          editing={puck?.isEditing}
          dragRef={puck?.dragRef}
        />
      ),
    },

    text: {
      label: 'Párrafo',
      inline: true,
      defaultProps: {
        layout: defaultTextLayout,
        text: 'Escribe un párrafo con el contenido de la página.',
      },
      fields: {
        layout: layoutField,
      },
      render: ({ layout, text, richText, appearance, style, puck }) => (
        <TextBlockView
          layout={layout ?? defaultTextLayout}
          text={text ?? ''}
          richText={richText}
          appearance={appearance}
          blockStyle={style}
          editing={puck?.isEditing}
          dragRef={puck?.dragRef}
        />
      ),
    },

    image: {
      label: 'Imagen',
      inline: true,
      defaultProps: {
        layout: defaultImageLayout,
        src: EDITOR2_DEFAULT_IMAGE_SRC,
        alt: 'Placa histológica de Atlas',
        caption: '',
        fit: 'contain',
        zoom: true,
      },
      fields: {
        src: { type: 'text', label: 'URL de la imagen (R2)' },
        alt: { type: 'text', label: 'Texto alternativo' },
        caption: { type: 'text', label: 'Pie de imagen' },
        fit: {
          type: 'select',
          label: 'Ajuste',
          options: [
            { label: 'Completa', value: 'contain' },
            { label: 'Cubrir', value: 'cover' },
          ],
        },
        zoom: {
          type: 'select',
          label: 'Zoom',
          options: [
            { label: 'Activado', value: true },
            { label: 'Desactivado', value: false },
          ],
        },
        layout: layoutField,
      },
      render: ({ layout, src, alt, caption, fit, zoom, media, style, puck }) => (
        <ImageBlockView
          layout={layout ?? defaultImageLayout}
          src={src ?? EDITOR2_DEFAULT_IMAGE_SRC}
          alt={alt ?? ''}
          caption={typeof caption === 'string' ? caption : undefined}
          fit={fit === 'cover' ? 'cover' : 'contain'}
          zoom={zoom !== false}
          media={media}
          blockStyle={style}
          editing={puck?.isEditing}
          dragRef={puck?.dragRef}
        />
      ),
    },

    divider: {
      label: 'Separador',
      inline: true,
      defaultProps: {
        layout: defaultDividerLayout,
        orientation: 'horizontal',
        lineStyle: 'solid',
        thickness: 2,
        color: '#0284c7',
      },
      fields: {
        orientation: {
          type: 'select',
          label: 'Dirección',
          options: [
            { label: 'Horizontal', value: 'horizontal' },
            { label: 'Vertical', value: 'vertical' },
          ],
        },
        lineStyle: {
          type: 'select',
          label: 'Estilo',
          options: [
            { label: 'Sólido', value: 'solid' },
            { label: 'Punteado', value: 'dashed' },
            { label: 'Degradado', value: 'gradient' },
          ],
        },
        thickness: {
          type: 'select',
          label: 'Grosor',
          options: [
            { label: '1 px', value: 1 },
            { label: '2 px', value: 2 },
            { label: '3 px', value: 3 },
            { label: '4 px', value: 4 },
            { label: '6 px', value: 6 },
          ],
        },
        color: createColorField('Color', '#0284c7'),
        label: { type: 'text', label: 'Etiqueta central' },
        widthPercent: {
          type: 'select',
          label: 'Ancho',
          options: [
            { label: '100 %', value: 100 },
            { label: '80 %', value: 80 },
            { label: '60 %', value: 60 },
            { label: '40 %', value: 40 },
          ],
        },
        layout: layoutField,
      },
      render: ({ layout, orientation, lineStyle, thickness, color, label, widthPercent, style, puck }) => (
        <DividerBlockView
          layout={layout ?? defaultDividerLayout}
          orientation={orientation === 'vertical' ? 'vertical' : 'horizontal'}
          lineStyle={lineStyle ?? 'solid'}
          thickness={typeof thickness === 'number' ? thickness : Number(thickness) || 2}
          color={color || '#0284c7'}
          label={typeof label === 'string' && label.trim() ? label : undefined}
          widthPercent={typeof widthPercent === 'number' ? widthPercent : Number(widthPercent) || 100}
          blockStyle={style}
          editing={puck?.isEditing}
          dragRef={puck?.dragRef}
        />
      ),
    },

    button: {
      label: 'Botón',
      inline: true,
      defaultProps: {
        layout: defaultButtonLayout,
        label: 'Explorar',
        href: '/temario',
        variant: 'solid',
        newTab: false,
        color: '#0284c7',
      },
      fields: {
        href: { type: 'text', label: 'Enlace' },
        variant: {
          type: 'select',
          label: 'Estilo',
          options: [
            { label: 'Sólido', value: 'solid' },
            { label: 'Degradado', value: 'gradient' },
            { label: 'Pastilla', value: 'pill' },
            { label: 'Contorno', value: 'outline' },
            { label: 'Suave', value: 'soft' },
          ],
        },
        align: {
          type: 'select',
          label: 'Alineación',
          options: [
            { label: 'Izquierda', value: 'left' },
            { label: 'Centro', value: 'center' },
            { label: 'Derecha', value: 'right' },
          ],
        },
        newTab: {
          type: 'select',
          label: 'Destino',
          options: [
            { label: 'Misma pestaña', value: false },
            { label: 'Nueva pestaña', value: true },
          ],
        },
        color: createColorField('Color', '#0284c7'),
        layout: layoutField,
      },
      render: ({ layout, label, href, variant, newTab, color, icon, align, style, puck }) => (
        <ButtonBlockView
          layout={layout ?? defaultButtonLayout}
          label={label ?? 'Explorar'}
          href={href ?? '/temario'}
          variant={variant ?? 'solid'}
          newTab={Boolean(newTab)}
          color={color || '#0284c7'}
          icon={typeof icon === 'string' ? icon : undefined}
          align={align === 'center' || align === 'right' ? align : 'left'}
          blockStyle={style}
          editing={puck?.isEditing}
          dragRef={puck?.dragRef}
        />
      ),
    },

    table: {
      label: 'Tabla',
      inline: true,
      defaultProps: {
        layout: defaultTableLayout,
        headers: ['Estructura', 'Característica', 'Ubicación'],
        rows: [
          ['Epitelio simple', 'Una sola capa celular', 'Alvéolos y endotelio'],
          ['Epitelio estratificado', 'Dos o más capas celulares', 'Epidermis y esófago'],
        ],
        accentColor: '#e0f2fe',
      },
      fields: {
        layout: layoutField,
      },
      render: ({ layout, headers, rows, accentColor, striped, compact, bordered, style, puck }) => (
        <TableBlockView
          layout={layout ?? defaultTableLayout}
          headers={Array.isArray(headers) ? headers : ['Columna 1']}
          rows={Array.isArray(rows) ? rows : [['']]}
          accentColor={accentColor || '#e0f2fe'}
          striped={Boolean(striped)}
          compact={Boolean(compact)}
          bordered={Boolean(bordered)}
          blockStyle={style}
          editing={puck?.isEditing}
          dragRef={puck?.dragRef}
        />
      ),
    },

    carousel: {
      label: 'Carrusel',
      inline: true,
      defaultProps: {
        layout: defaultCarouselLayout,
        items: [
          {
            src: EDITOR2_DEFAULT_IMAGE_SRC,
            alt: 'Placa histológica 1',
            caption: 'Vista panorámica de la muestra',
          },
          {
            src: EDITOR2_DEFAULT_IMAGE_SRC,
            alt: 'Placa histológica 2',
            caption: 'Detalle a mayor aumento',
          },
        ],
        fit: 'contain',
      },
      fields: {
        fit: {
          type: 'select',
          label: 'Ajuste',
          options: [
            { label: 'Completa', value: 'contain' },
            { label: 'Cubrir', value: 'cover' },
          ],
        },
        layout: layoutField,
      },
      render: ({ layout, items, fit, autoplay, intervalSec, showArrows, showDots, zoom, media, style, puck }) => (
        <CarouselBlockView
          layout={layout ?? defaultCarouselLayout}
          items={Array.isArray(items) ? items : []}
          fit={fit === 'cover' ? 'cover' : 'contain'}
          autoplay={Boolean(autoplay)}
          intervalSec={typeof intervalSec === 'number' ? intervalSec : Number(intervalSec) || 4}
          showArrows={showArrows !== false}
          showDots={showDots !== false}
          zoom={zoom !== false}
          media={media}
          blockStyle={style}
          editing={puck?.isEditing}
          dragRef={puck?.dragRef}
        />
      ),
    },

    gif: {
      label: 'GIF',
      inline: true,
      defaultProps: {
        layout: defaultGifLayout,
        src: EDITOR2_DEFAULT_IMAGE_SRC,
        alt: 'Animación histológica',
        caption: '',
        fit: 'contain',
      },
      fields: {
        src: { type: 'text', label: 'URL del GIF (R2)' },
        alt: { type: 'text', label: 'Texto alternativo' },
        caption: { type: 'text', label: 'Pie de GIF' },
        fit: {
          type: 'select',
          label: 'Ajuste',
          options: [
            { label: 'Completa', value: 'contain' },
            { label: 'Cubrir', value: 'cover' },
          ],
        },
        layout: layoutField,
      },
      render: ({ layout, src, alt, caption, fit, zoom, media, style, puck }) => (
        <GifBlockView
          layout={layout ?? defaultGifLayout}
          src={src ?? EDITOR2_DEFAULT_IMAGE_SRC}
          alt={alt ?? ''}
          caption={typeof caption === 'string' ? caption : undefined}
          fit={fit === 'cover' ? 'cover' : 'contain'}
          zoom={Boolean(zoom)}
          media={media}
          blockStyle={style}
          editing={puck?.isEditing}
          dragRef={puck?.dragRef}
        />
      ),
    },

    video: {
      label: 'Video',
      inline: true,
      defaultProps: {
        layout: defaultVideoLayout,
        url: '',
        caption: '',
        aspect: '16/9',
      },
      fields: {
        url: { type: 'text', label: 'URL (YouTube, Vimeo o MP4)' },
        caption: { type: 'text', label: 'Pie de video' },
        aspect: {
          type: 'select',
          label: 'Proporción',
          options: [
            { label: '16:9', value: '16/9' },
            { label: '4:3', value: '4/3' },
            { label: '1:1', value: '1/1' },
          ],
        },
        layout: layoutField,
      },
      render: ({ layout, url, caption, aspect, style, puck }) => (
        <VideoBlockView
          layout={layout ?? defaultVideoLayout}
          url={url ?? ''}
          caption={typeof caption === 'string' ? caption : undefined}
          aspect={aspect === '4/3' || aspect === '1/1' ? aspect : '16/9'}
          blockStyle={style}
          editing={puck?.isEditing}
          dragRef={puck?.dragRef}
        />
      ),
    },

    compare: {
      label: 'Comparador',
      inline: true,
      defaultProps: {
        layout: defaultCompareLayout,
        leftSrc: EDITOR2_DEFAULT_IMAGE_SRC,
        leftLabel: 'Vista A',
        rightSrc: EDITOR2_DEFAULT_IMAGE_SRC,
        rightLabel: 'Vista B',
      },
      fields: {
        leftLabel: { type: 'text', label: 'Etiqueta A' },
        rightLabel: { type: 'text', label: 'Etiqueta B' },
        layout: layoutField,
      },
      render: ({ layout, leftSrc, leftLabel, rightSrc, rightLabel, style, puck }) => (
        <CompareBlockView
          layout={layout ?? defaultCompareLayout}
          leftSrc={leftSrc ?? EDITOR2_DEFAULT_IMAGE_SRC}
          leftLabel={leftLabel}
          rightSrc={rightSrc ?? EDITOR2_DEFAULT_IMAGE_SRC}
          rightLabel={rightLabel}
          blockStyle={style}
          editing={puck?.isEditing}
          dragRef={puck?.dragRef}
        />
      ),
    },

    callout: {
      label: 'Nota / Aviso',
      inline: true,
      defaultProps: {
        layout: defaultCalloutLayout,
        tone: 'info',
        title: 'Nota clave',
        text: 'Escribe aquí una observación o correlación clínica.',
      },
      fields: {
        tone: {
          type: 'select',
          label: 'Tipo',
          options: [
            { label: 'Nota', value: 'info' },
            { label: 'Correlación clínica', value: 'clinical' },
            { label: 'Dato clave', value: 'tip' },
            { label: 'Advertencia', value: 'warning' },
          ],
        },
        layout: layoutField,
      },
      render: ({ layout, tone, title, text, richText, style, puck }) => (
        <CalloutBlockView
          layout={layout ?? defaultCalloutLayout}
          tone={tone ?? 'info'}
          title={title ?? 'Nota clave'}
          text={text ?? ''}
          richText={richText}
          blockStyle={style}
          editing={puck?.isEditing}
          dragRef={puck?.dragRef}
        />
      ),
    },

    badge: {
      label: 'Insignia',
      inline: true,
      defaultProps: {
        layout: defaultBadgeLayout,
        text: 'H&E · Dato clave',
        variant: 'soft',
        color: '#0284c7',
        size: 'md',
        align: 'left',
      },
      fields: {
        variant: {
          type: 'select',
          label: 'Estilo',
          options: [
            { label: 'Suave', value: 'soft' },
            { label: 'Sólida', value: 'solid' },
            { label: 'Contorno', value: 'outline' },
            { label: 'Cristal', value: 'glass' },
            { label: 'Muestra de color', value: 'swatch' },
          ],
        },
        size: {
          type: 'select',
          label: 'Tamaño',
          options: [
            { label: 'Pequeña', value: 'sm' },
            { label: 'Mediana', value: 'md' },
            { label: 'Grande', value: 'lg' },
          ],
        },
        align: {
          type: 'select',
          label: 'Alineación',
          options: [
            { label: 'Izquierda', value: 'left' },
            { label: 'Centro', value: 'center' },
            { label: 'Derecha', value: 'right' },
          ],
        },
        color: createColorField('Color', '#0284c7'),
        layout: layoutField,
      },
      render: ({ layout, text, variant, color, icon, size, align, style, puck }) => (
        <BadgeBlockView
          layout={layout ?? defaultBadgeLayout}
          text={text ?? 'Etiqueta'}
          variant={variant ?? 'soft'}
          color={color || '#0284c7'}
          icon={typeof icon === 'string' ? icon : undefined}
          size={size === 'sm' || size === 'lg' ? size : 'md'}
          align={align === 'center' || align === 'right' ? align : 'left'}
          blockStyle={style}
          editing={puck?.isEditing}
          dragRef={puck?.dragRef}
        />
      ),
    },

    icon: {
      label: 'Icono',
      inline: true,
      defaultProps: {
        layout: defaultIconLayout,
        name: 'microscope',
        size: 32,
        color: '#0284c7',
        frame: 'rounded',
        align: 'left',
      },
      fields: {
        frame: {
          type: 'select',
          label: 'Marco',
          options: [
            { label: 'Cuadrado suave', value: 'rounded' },
            { label: 'Círculo', value: 'circle' },
            { label: 'Sin marco', value: 'none' },
          ],
        },
        size: {
          type: 'select',
          label: 'Tamaño',
          options: [
            { label: '20 px', value: 20 },
            { label: '28 px', value: 28 },
            { label: '36 px', value: 36 },
            { label: '48 px', value: 48 },
            { label: '64 px', value: 64 },
          ],
        },
        align: {
          type: 'select',
          label: 'Alineación',
          options: [
            { label: 'Izquierda', value: 'left' },
            { label: 'Centro', value: 'center' },
            { label: 'Derecha', value: 'right' },
          ],
        },
        color: createColorField('Color', '#0284c7'),
        layout: layoutField,
      },
      render: ({ layout, name, size, color, bgColor, frame, align, label, style, puck }) => (
        <IconBlockView
          layout={layout ?? defaultIconLayout}
          name={typeof name === 'string' && name ? name : 'microscope'}
          size={typeof size === 'number' ? size : Number(size) || 32}
          color={color || '#0284c7'}
          bgColor={typeof bgColor === 'string' ? bgColor : undefined}
          frame={frame === 'none' || frame === 'circle' ? frame : 'rounded'}
          align={align === 'center' || align === 'right' ? align : 'left'}
          label={typeof label === 'string' ? label : undefined}
          blockStyle={style}
          editing={puck?.isEditing}
          dragRef={puck?.dragRef}
        />
      ),
    },

    box: {
      label: 'Tarjeta / Caja',
      inline: true,
      defaultProps: {
        layout: defaultBoxLayout,
        gap: 'md',
        style: DEFAULT_BOX_STYLE,
        content: [],
      },
      fields: {
        layout: layoutField,
        content: {
          type: 'slot',
          allow: [...LEAF_COMPONENT_NAMES, 'box'],
          disallow: ['canvas', 'tabs', 'accordion'],
        },
      },
      render: ({ id, layout, gap, style, content, puck }) => (
        <BoxBlockView
          id={id}
          layout={layout ?? defaultBoxLayout}
          gap={gap ?? 'md'}
          blockStyle={style}
          dragRef={puck?.dragRef}
          editing={puck?.isEditing}
        >
          {content ? content({ className: 'e2-slot-grid e2-slot-grid--box' }) : null}
        </BoxBlockView>
      ),
    },

    tabs: {
      label: 'Pestañas',
      inline: true,
      defaultProps: {
        layout: defaultLayout,
        items: [
          {
            title: 'Sección 1',
            content: [],
          },
          {
            title: 'Sección 2',
            content: [],
          },
        ],
        accentColor: '#0284c7',
      },
      fields: {
        items: {
          type: 'array',
          visible: false,
          arrayFields: {
            title: { type: 'text' },
            content: {
              type: 'slot',
              allow: PANEL_COMPONENT_NAMES,
            },
          },
        },
      },
      render: ({ id, layout, items, accentColor, tabStyle, style, puck }) => (
        <TabsBlockView
          id={id}
          layout={layout ?? defaultLayout}
          items={Array.isArray(items) ? items : []}
          accentColor={accentColor || '#0284c7'}
          tabStyle={tabStyle === 'pills' || tabStyle === 'cards' ? tabStyle : 'underline'}
          blockStyle={style}
          editing={puck?.isEditing}
          dragRef={puck?.dragRef}
        />
      ),
    },

    accordion: {
      label: 'Acordeón',
      inline: true,
      defaultProps: {
        layout: defaultLayout,
        items: [
          {
            title: 'Sección desplegable 1',
            openByDefault: true,
            content: [],
          },
          {
            title: 'Sección desplegable 2',
            openByDefault: false,
            content: [],
          },
        ],
        accentColor: '#0284c7',
      },
      fields: {
        items: {
          type: 'array',
          visible: false,
          arrayFields: {
            title: { type: 'text' },
            content: {
              type: 'slot',
              allow: PANEL_COMPONENT_NAMES,
            },
          },
        },
      },
      render: ({ id, layout, items, accentColor, mode, style, puck }) => (
        <AccordionBlockView
          id={id}
          layout={layout ?? defaultLayout}
          items={Array.isArray(items) ? items : []}
          accentColor={accentColor || '#0284c7'}
          mode={mode === 'reveal' ? 'reveal' : 'default'}
          blockStyle={style}
          editing={puck?.isEditing}
          dragRef={puck?.dragRef}
        />
      ),
    },

    examCarousel: {
      label: 'Pruebas por parcial',
      inline: true,
      defaultProps: {
        layout: defaultExamCarouselLayout,
        parcial: 'primer',
        title: '',
        accentColor: '#6d28d9',
        maxItems: 8,
      },
      fields: {
        parcial: {
          type: 'select',
          label: 'Parcial',
          options: [
            { label: 'Primer parcial', value: 'primer' },
            { label: 'Segundo parcial', value: 'segundo' },
            { label: 'Tercer parcial', value: 'tercer' },
            { label: 'Todos los parciales', value: 'all' },
          ],
        },
        title: {
          type: 'text',
          label: 'Título (opcional)',
        },
        accentColor: {
          type: 'text',
          label: 'Color de acento (#hex)',
        },
        maxItems: {
          type: 'number',
          label: 'Máximo de pruebas',
          min: 1,
          max: 24,
        },
        layout: layoutField,
      },
      render: ({ layout, parcial, title, accentColor, maxItems, style, puck }) => (
        <ExamCarouselBlockView
          layout={layout ?? defaultExamCarouselLayout}
          parcial={
            parcial === 'all' || parcial === 'primer' || parcial === 'segundo' || parcial === 'tercer'
              ? parcial
              : 'primer'
          }
          title={title}
          accentColor={accentColor}
          maxItems={typeof maxItems === 'number' ? maxItems : 8}
          blockStyle={style}
          editing={puck?.isEditing}
          dragRef={puck?.dragRef}
          rowStyleCss={rowStyle(layout ?? defaultExamCarouselLayout)}
          resizeHandles={<BlockResizeHandles />}
        />
      ),
    },
    canvas: {
      label: 'Sección guardada',
      inline: true,
      defaultProps: {
        layout: defaultLayout,
        gap: 'md',
        content: [],
      },
      fields: {
        content: {
          type: 'slot',
          allow: [...LEAF_COMPONENT_NAMES, 'box', 'tabs', 'accordion'],
          disallow: ['canvas'],
        },
      },
      render: ({ id, gap, style, content, puck }) => (
        <CanvasBlockView
          id={id}
          gap={gap ?? 'md'}
          blockStyle={style}
          dragRef={puck?.dragRef}
          editing={puck?.isEditing}
        >
          {content ? content({ className: 'e2-slot-grid' }) : null}
        </CanvasBlockView>
      ),
    },
  },

  root: {
    defaultProps: {
      rootId: '',
      pageKey: '',
      gap: 'md',
    },
    render: ({
      gap = 'md',
      minRows,
      pageTheme,
      children,
      puck,
    }: {
      gap?: Gap;
      minRows?: number;
      pageTheme?: PageTheme;
      children?: ReactNode;
      puck?: { isEditing?: boolean };
    }) => (
      <ResponsiveCanvas
        className={`e2-canvas-root e2-gap-${gap}${pageTheme ? ' has-page-theme' : ''}`}
        theme={pageTheme}
        data-e2-canvas-root=""
        data-e2-min-rows={minRows}
        style={minRows === undefined ? undefined : { ['--e2-min-rows' as string]: minRows }}
        data-e2-theme={pageTheme?.presetId ?? (pageTheme ? 'custom' : undefined)}
      >
        {isValidElement<{ allow?: string[]; className?: string }>(children)
          ? cloneElement(children, {
              className: [children.props.className, 'e2-slot-grid'].filter(Boolean).join(' '),
              ...(puck?.isEditing ? { allow: ROOT_COMPONENT_NAMES } : {}),
            })
          : children}
      </ResponsiveCanvas>
    ),
  },
};
