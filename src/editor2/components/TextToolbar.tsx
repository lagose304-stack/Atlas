import { usePuck } from '@puckeditor/core';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  Bold,
  CaseSensitive,
  Italic,
  List,
  ListCollapse,
  ListOrdered,
  Sparkles,
  Strikethrough,
  Underline,
} from 'lucide-react';
import type { RichTextV2 } from '../domain/richText';
import { EDITOR_FONTS, type LayoutIntent, type SpanIntent, type TextAppearance } from '../domain/schema';
import InlineRichText from './InlineRichText';
import InspectorDialog from './InspectorDialog';

const toggles = [
  ['bold', 'Negrita', Bold], ['italic', 'Cursiva', Italic],
  ['underline', 'Subrayado', Underline], ['strike', 'Tachado', Strikethrough],
  ['uppercase', 'Mayúsculas', CaseSensitive],
] as const;

const alignments = [
  ['left', 'Alinear a la izquierda', AlignLeft],
  ['center', 'Centrar', AlignCenter],
  ['right', 'Alinear a la derecha', AlignRight],
  ['justify', 'Justificar', AlignJustify],
] as const;

const verticalAlignments = [
  ['start', 'Alinear arriba', AlignVerticalJustifyStart],
  ['center', 'Centrar verticalmente', AlignVerticalJustifyCenter],
  ['end', 'Alinear abajo', AlignVerticalJustifyEnd],
] as const;

export default function TextToolbar() {
  const { selectedItem, dispatch, getSelectorForId } = usePuck();
  if (!selectedItem || !['text', 'heading'].includes(selectedItem.type)) return null;
  const item = selectedItem;
  const heading = item.type === 'heading';
  const style: TextAppearance = item.props.appearance ?? {};
  const layout: LayoutIntent = item.props.layout ?? { base: { span: 8 } };
  const currentVerticalAlign: NonNullable<SpanIntent['verticalAlign']> =
    (layout.lg ?? layout.md ?? layout.base)?.verticalAlign ?? 'start';

  function change(patch: Partial<TextAppearance>) {
    const position = getSelectorForId(item.props.id);
    if (!position) return;
    dispatch({
      type: 'replace', destinationIndex: position.index, destinationZone: position.zone,
      data: { ...item, props: { ...item.props, appearance: { ...style, ...patch } } },
    });
  }

  function changeVerticalAlign(verticalAlign: NonNullable<SpanIntent['verticalAlign']>) {
    const position = getSelectorForId(item.props.id);
    if (!position) return;
    const nextLayout: LayoutIntent = {
      base: { ...layout.base, verticalAlign },
      ...(layout.md ? { md: { ...layout.md, verticalAlign } } : {}),
      ...(layout.lg ? { lg: { ...layout.lg, verticalAlign } } : {}),
    };
    dispatch({
      type: 'replace',
      destinationIndex: position.index,
      destinationZone: position.zone,
      data: { ...item, props: { ...item.props, layout: nextLayout } },
    });
  }

  function changeRich(nextPlain: string, nextRich: RichTextV2 | undefined) {
    const position = getSelectorForId(item.props.id);
    if (!position) return;
    const nextProps = { ...item.props, text: nextPlain } as Record<string, unknown> & { id: string };
    if (nextRich) nextProps.richText = nextRich;
    else delete nextProps.richText;
    dispatch({
      type: 'replace',
      destinationIndex: position.index,
      destinationZone: position.zone,
      data: { ...item, props: nextProps },
    });
  }

  return (
    <div role="group" aria-label="Formato del texto seleccionado" className="e2-text-toolbar">
      <select aria-label="Fuente" value={style.font ?? ''} onChange={e => change({ font: e.target.value as TextAppearance['font'] || undefined })}>
        <option value="">Fuente del tema</option>
        {EDITOR_FONTS.map(font => <option key={font}>{font}</option>)}
      </select>
      <input type="color" aria-label="Color del texto" title="Color del texto" value={style.color ?? (heading ? '#0b2545' : '#000000')}
        onChange={e => change({ color: e.target.value })} />
      {toggles.map(([key, label, Icon]) => {
        const pressed = style[key] ?? (key === 'bold' && heading);
        return <button key={key} type="button" aria-label={label} title={label} aria-pressed={pressed}
          onMouseDown={e => e.preventDefault()}
          onClick={() => change({ [key]: !pressed })}><Icon size={16} /></button>;
      })}
      <div role="group" aria-label="Alineación" className="e2-align-group">
        {alignments.map(([value, label, Icon]) => (
          <button key={value} type="button" aria-label={label} title={label}
            aria-pressed={(style.align ?? 'left') === value}
            onMouseDown={e => e.preventDefault()}
            onClick={() => change({ align: value })}>
            <Icon size={16} aria-hidden="true" />
          </button>
        ))}
      </div>
      <div role="group" aria-label="Alineación vertical" className="e2-align-group">
        {verticalAlignments.map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            aria-label={label}
            title={label}
            aria-pressed={currentVerticalAlign === value}
            onMouseDown={e => e.preventDefault()}
            onClick={() => changeVerticalAlign(value)}
          >
            <Icon size={16} aria-hidden="true" />
          </button>
        ))}
      </div>
      {!heading && (
        <>
          <button
            type="button"
            aria-label="Lista con viñetas"
            title="Lista con viñetas"
            aria-pressed={!!style.bullets}
            onMouseDown={e => e.preventDefault()}
            onClick={() => change({ bullets: !style.bullets, numbered: false })}
          >
            <List size={16} />
          </button>
          <button
            type="button"
            aria-label="Lista numerada"
            title="Lista numerada"
            aria-pressed={!!style.numbered}
            onMouseDown={e => e.preventDefault()}
            onClick={() => change({ numbered: !style.numbered, bullets: false })}
          >
            <ListOrdered size={16} />
          </button>
          {(style.bullets || style.numbered) && (
            <>
              <select
                aria-label="Estilo de viñeta"
                title="Estilo de viñeta"
                value={style.bulletStyle ?? 'disc'}
                onChange={(e) =>
                  change({ bulletStyle: e.target.value as TextAppearance['bulletStyle'] })
                }
              >
                <option value="disc">Viñeta clásica</option>
                <option value="check">Check ✓</option>
                <option value="arrow">Flecha →</option>
                <option value="circle-number">Círculo numerado</option>
              </select>
              <input
                type="color"
                aria-label="Color de viñeta"
                title="Color de viñeta"
                value={style.bulletColor ?? '#0284c7'}
                onChange={(e) => change({ bulletColor: e.target.value })}
              />
            </>
          )}
        </>
      )}
      <label className="e2-line-spacing" title={`Interlineado · ${style.lineHeight ?? 'Automático'}`}>
        <ListCollapse size={17} aria-hidden="true" />
        <select aria-label="Interlineado" value={style.lineHeight ?? ''} onChange={e => change({ lineHeight: Number(e.target.value) || undefined })}>
          <option value="">Automático</option>
          {[1, 1.25, 1.5, 1.75, 2, 2.5, 3].map(n => <option key={n} value={n}>{n} ×</option>)}
        </select>
      </label>
      <InspectorDialog
        label="Por palabra"
        icon={<Sparkles size={13} aria-hidden="true" />}
      >
        <div className="e2-rich-dialog">
          <p className="e2-rich-dialog__hint">
            Selecciona cualquier palabra o frase para aplicar negrita, color, resaltado, enlace o sub/superíndice (H₂O, 10×).
          </p>
          <InlineRichText
            value={(item.props.richText as RichTextV2 | undefined) ?? String(item.props.text ?? '')}
            editing
            singleLine={heading}
            placeholder={heading ? 'Escribe un título' : 'Escribe un párrafo'}
            onChange={(nextPlain, nextRich) => changeRich(nextPlain, nextRich)}
          />
        </div>
      </InspectorDialog>
    </div>);
}
