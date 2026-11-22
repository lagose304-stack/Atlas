import { ChevronDown, Palette } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ATLAS_PAGE_THEMES, hexColorSchema } from '../domain/styleSchema';
import { useEditor2Store } from '../store/editor2Store';

const THEME_COLORS = [
  ['surface', 'Superficie'], ['text', 'Texto'], ['primary', 'Primario'], ['accent', 'Acento'],
  ['textMuted', 'Texto secundario'], ['surfaceMuted', 'Superficie suave'], ['border', 'Bordes'], ['pageBg', 'Fondo'],
] as const;

const STANDARD_COLORS = [
  ['#c62828', 'Rojo'], ['#f57c00', 'Naranja'], ['#fdd835', 'Amarillo'], ['#2e7d32', 'Verde'],
  ['#00838f', 'Turquesa'], ['#1565c0', 'Azul'], ['#6a1b9a', 'Violeta'], ['#ad1457', 'Rosa'],
] as const;

const SHADES = [
  ['muy claro', 255, 0.72], ['claro', 255, 0.4], ['oscuro', 0, 0.26], ['muy oscuro', 0, 0.53],
] as const;

type Swatch = readonly [color: string, name: string];

function mixColor(color: string, target: number, amount: number): string {
  const channels = color.slice(1).match(/../g) ?? [];
  return '#' + channels.map((channel) => {
    const value = Number.parseInt(channel, 16);
    return Math.round(value + (target - value) * amount).toString(16).padStart(2, '0');
  }).join('');
}

function SwatchGrid({ label, colors, selected, onSelect }: {
  label: string;
  colors: readonly Swatch[];
  selected?: string;
  onSelect: (color: string) => void;
}) {
  const [focused, setFocused] = useState<number>();
  const selectedIndex = colors.findIndex(([color]) => color.toLowerCase() === selected);
  const tabStop = focused ?? Math.max(0, selectedIndex);

  function navigate(event: KeyboardEvent<HTMLDivElement>) {
    const buttons = Array.from(event.currentTarget.querySelectorAll('button'));
    const index = buttons.indexOf(event.target as HTMLButtonElement);
    if (index < 0) return;
    const columns = THEME_COLORS.length;
    const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns };
    const offset = offsets[event.key];
    if (offset === undefined) return;
    event.preventDefault();
    buttons[Math.max(0, Math.min(buttons.length - 1, index + offset))]?.focus();
  }

  return (
    <div className="e2-color-palette__section" role="group" aria-label={label}>
      <span className="e2-color-palette__label" aria-hidden="true">{label}</span>
      <div className="e2-color-palette__grid" onKeyDown={navigate}>
        {colors.map(([color, name], index) => (
          <button key={name} type="button" className="e2-color-palette__swatch"
            title={`${name} · ${color.toUpperCase()}`} aria-label={name}
            aria-pressed={index === selectedIndex} tabIndex={index === tabStop ? 0 : -1}
            onFocus={() => setFocused(index)} onClick={() => onSelect(color)}>
            <span style={{ backgroundColor: color }} aria-hidden="true" />
          </button>
        ))}
      </div>
    </div>
  );
}

type Props = {
  label: string;
  value?: string;
  fallback: string;
  onChange: (color: string) => void;
  onReset?: () => void;
  resetLabel?: string;
  icon?: ReactNode;
};

export default function TextColorPicker({
  label, value, fallback, onChange, onReset, resetLabel = 'Automático', icon,
}: Props) {
  const palette = useEditor2Store((state) => state.doc?.pageTheme?.palette) ?? ATLAS_PAGE_THEMES[0].theme.palette;
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const native = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const selected = hexColorSchema.safeParse(value).data?.toLowerCase();
  const current = selected ?? fallback;
  const themeColors: Swatch[] = THEME_COLORS.map(([key, name]) => [palette[key], name]);
  const allThemeColors: Swatch[] = [
    ...themeColors,
    ...SHADES.flatMap(([shade, target, amount]) =>
      themeColors.map(([color, name]) => [mixColor(color, target, amount), `${name} · ${shade}`] as const)),
  ];

  function positionPalette() {
    const button = trigger.current;
    const popover = panel.current;
    if (!button || !popover?.matches(':popover-open')) return;
    const anchor = button.getBoundingClientRect();
    const { width, height } = popover.getBoundingClientRect();
    const margin = 8;
    const gap = 6;
    const left = Math.max(margin, Math.min(anchor.left, window.innerWidth - width - margin));
    const below = anchor.bottom + gap;
    const above = anchor.top - gap - height;
    const top = below + height > window.innerHeight - margin && above >= margin ? above : below;
    popover.style.left = `${left}px`;
    popover.style.top = `${Math.max(margin, Math.min(top, window.innerHeight - height - margin))}px`;
  }

  useEffect(() => {
    const popover = panel.current;
    if (!popover?.showPopover) return;
    const syncOpen = () => {
      const isOpen = popover.matches(':popover-open');
      setOpen(isOpen);
      popover.toggleAttribute('data-positioned', isOpen);
      if (isOpen) {
        positionPalette();
        popover.focus({ preventScroll: true });
      }
    };
    popover.addEventListener('toggle', syncOpen);
    return () => popover.removeEventListener('toggle', syncOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    window.addEventListener('resize', positionPalette);
    window.addEventListener('scroll', positionPalette, true);
    return () => {
      window.removeEventListener('resize', positionPalette);
      window.removeEventListener('scroll', positionPalette, true);
    };
  }, [open]);

  function closePalette() {
    if (!panel.current?.hidePopover || !panel.current.matches(':popover-open')) return;
    panel.current.hidePopover();
    trigger.current?.focus({ preventScroll: true });
  }

  function selectColor(color: string) {
    closePalette();
    onChange(color);
  }

  function openNative() {
    const input = native.current;
    if (!input) return;
    closePalette();
    if (input.showPicker) input.showPicker();
    else input.click();
  }

  return (
    <div className="e2-text-color-control" data-puck-overlay-portal="true">
      <button ref={trigger} type="button" className="e2-text-color-control__trigger"
        {...{ popovertarget: id }}
        aria-label={label} title={label} aria-haspopup="dialog" aria-controls={id} aria-expanded={open}
        onClick={() => { if (!panel.current?.showPopover) openNative(); }}>
        {icon}
        <span className="e2-text-color-control__chip" style={{ backgroundColor: current }} aria-hidden="true" />
        <ChevronDown size={12} aria-hidden="true" />
      </button>
      <input ref={native} type="color" className="e2-text-color-control__native" aria-label="Color personalizado"
        tabIndex={-1} value={current} onChange={(event) => selectColor(event.target.value)} />
      <div id={id} ref={panel} {...{ popover: 'auto' }} tabIndex={-1}
        className="e2-color-palette" role="dialog" aria-label={`Paleta · ${label}`}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return;
          event.preventDefault();
          event.stopPropagation();
          closePalette();
        }}>
        {onReset && (
          <button type="button" className="e2-color-palette__action" aria-pressed={!selected}
            onClick={() => { closePalette(); onReset(); }}>
            <span className="e2-text-color-control__chip" style={{ backgroundColor: fallback }} aria-hidden="true" />
            {resetLabel}
          </button>
        )}
        <SwatchGrid label="Colores del tema" colors={allThemeColors} selected={selected} onSelect={selectColor} />
        <SwatchGrid label="Colores estándar" colors={STANDARD_COLORS} selected={selected} onSelect={selectColor} />
        <button type="button" className="e2-color-palette__action" onClick={openNative}>
          <Palette size={15} aria-hidden="true" />
          Más colores…
        </button>
      </div>
    </div>
  );
}
