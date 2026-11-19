import { useEffect } from 'react';
import { usePuck } from '@puckeditor/core';
import {
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  ClipboardPaste,
  Paintbrush,
  Palette,
  RotateCcw,
} from 'lucide-react';
import type { BlockStyle, LayoutIntent, SpanIntent } from '../domain/schema';
import {
  type BackgroundStyle,
  type BorderStyle,
  type MaxWidthPreset,
  type PaddingStyle,
  type RadiusStyle,
  type ShadowPreset,
} from '../domain/styleSchema';
import { hasVisualStyle } from '../domain/styleToCss';
import { useEditor2Store } from '../store/editor2Store';
import GradientPicker from './GradientPicker';
import InspectorDialog from './InspectorDialog';

const QUICK_SWATCHES = [
  { label: 'Blanco', color: '#ffffff' },
  { label: 'Hielo', color: '#f2f9fd' },
  { label: 'Celeste suave', color: '#e0f2fe' },
  { label: 'Menta suave', color: '#ecfdf5' },
  { label: 'Ámbar suave', color: '#fffbeb' },
  { label: 'Lavanda H&E', color: '#f5f3ff' },
  { label: 'Azul Atlas', color: '#0284c7' },
  { label: 'Noche', color: '#0b2545' },
] as const;

const BORDER_SIDES: Array<{ value: NonNullable<BorderStyle['sides']>; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'left', label: 'Izquierdo' },
  { value: 'top', label: 'Superior' },
  { value: 'bottom', label: 'Inferior' },
  { value: 'right', label: 'Derecho' },
];

const SHADOW_OPTIONS: Array<{ value: ShadowPreset; label: string }> = [
  { value: 'none', label: 'Ninguna' },
  { value: 'soft', label: 'Suave' },
  { value: 'medium', label: 'Media' },
  { value: 'elevated', label: 'Elevada' },
  { value: 'glow', label: 'Brillo' },
];

const MAX_WIDTH_OPTIONS: Array<{ value: MaxWidthPreset; label: string }> = [
  { value: 'full', label: 'Completo' },
  { value: '1200', label: '1200 px' },
  { value: '960', label: '960 px' },
  { value: '760', label: '760 px' },
  { value: '560', label: '560 px' },
];

const VERTICAL_ALIGNS = [
  ['start', 'Alinear arriba', AlignVerticalJustifyStart],
  ['center', 'Centrar verticalmente', AlignVerticalJustifyCenter],
  ['end', 'Alinear abajo', AlignVerticalJustifyEnd],
] as const;

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

export default function DesignInspector() {
  const { selectedItem, dispatch, getSelectorForId } = usePuck();
  const copiedStyle = useEditor2Store((state) => state.copiedStyle);
  const copyBlockStyle = useEditor2Store((state) => state.copyBlockStyle);
  const pageTheme = useEditor2Store((state) => state.doc?.pageTheme);

  const themeSwatches = pageTheme
    ? [
        { label: 'Tema · Primario', color: pageTheme.palette.primary },
        { label: 'Tema · Acento', color: pageTheme.palette.accent },
        { label: 'Tema · Superficie', color: pageTheme.palette.surface },
        { label: 'Tema · Superficie suave', color: pageTheme.palette.surfaceMuted },
        { label: 'Tema · Fondo página', color: pageTheme.palette.pageBg },
      ]
    : [];
  const allSwatches = [
    ...themeSwatches,
    ...QUICK_SWATCHES.filter((s) => !themeSwatches.some((t) => t.color.toLowerCase() === s.color.toLowerCase())),
  ];

  const item = selectedItem;
  const style: BlockStyle = (item?.props?.style as BlockStyle | undefined) ?? {};
  const layout: LayoutIntent | undefined = item?.props?.layout as LayoutIntent | undefined;
  const isStyled = hasVisualStyle(style);
  const showVerticalAlign = Boolean(item && item.type !== 'canvas' && !['text', 'heading'].includes(item.type) && layout);
  const showMaxWidth = Boolean(item && (item.type === 'canvas' || item.type === 'box'));

  const commitStyle = (nextStyle: BlockStyle | undefined) => {
    if (!item) return;
    const position = getSelectorForId(item.props.id);
    if (!position) return;
    const nextProps = { ...item.props };
    if (nextStyle && Object.keys(nextStyle).length > 0) {
      nextProps.style = nextStyle;
    } else {
      delete nextProps.style;
    }
    dispatch({
      type: 'replace',
      destinationIndex: position.index,
      destinationZone: position.zone,
      data: { ...item, props: nextProps },
    });
  };

  const patchStyle = (patch: Partial<BlockStyle>) => {
    const merged: BlockStyle = { ...style, ...patch };
    for (const key of Object.keys(merged) as Array<keyof BlockStyle>) {
      if (merged[key] === undefined) delete merged[key];
    }
    commitStyle(Object.keys(merged).length > 0 ? merged : undefined);
  };

  const handleCopyStyle = () => {
    copyBlockStyle(Object.keys(style).length > 0 ? style : {});
  };

  const handlePasteStyle = () => {
    if (!copiedStyle) return;
    commitStyle(Object.keys(copiedStyle).length > 0 ? { ...copiedStyle } : undefined);
  };

  useEffect(() => {
    if (!item) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || !event.altKey) return;
      if (isTypingTarget(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === 'c') {
        event.preventDefault();
        copyBlockStyle(Object.keys(style).length > 0 ? style : {});
      } else if (key === 'v' && copiedStyle) {
        event.preventDefault();
        commitStyle(Object.keys(copiedStyle).length > 0 ? { ...copiedStyle } : undefined);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  if (!item) return null;

  const currentBg: BackgroundStyle = style.background ?? { type: 'none' };
  const currentBorder: BorderStyle = style.border ?? {
    width: 1,
    style: 'none',
    color: '#cbd5e1',
    sides: 'all',
  };
  const currentRadius: RadiusStyle = style.radius ?? { mode: 'uniform', value: 0 };
  const currentPadding: PaddingStyle = style.padding ?? { mode: 'uniform', value: 0 };
  const currentShadow: ShadowPreset = style.shadow ?? 'none';
  const currentOpacity = style.opacity ?? 1;
  const currentBlur = style.backdropBlur ?? 0;
  const currentVerticalAlign: NonNullable<SpanIntent['verticalAlign']> =
    (layout?.lg ?? layout?.md ?? layout?.base)?.verticalAlign ?? 'start';

  const changeVerticalAlign = (verticalAlign: NonNullable<SpanIntent['verticalAlign']>) => {
    if (!layout) return;
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
  };

  const setBgType = (type: BackgroundStyle['type']) => {
    if (type === 'none') {
      patchStyle({ background: undefined });
      return;
    }
    if (type === 'solid') {
      patchStyle({ background: { type: 'solid', color: currentBg.color ?? '#f2f9fd' } });
      return;
    }
    if (type === 'gradient') {
      patchStyle({
        background: {
          type: 'gradient',
          gradient: currentBg.gradient ?? { kind: 'linear', angle: 135, stops: ['#f0f9ff', '#e0f2fe'] },
        },
      });
      return;
    }
    patchStyle({
      background: {
        type: 'image',
        imageUrl: currentBg.imageUrl,
        overlayColor: currentBg.overlayColor ?? '#0b2545',
        overlayOpacity: currentBg.overlayOpacity ?? 0.35,
      },
    });
  };

  return (
    <div className="e2-design-bar" role="group" aria-label="Herramientas de diseño del bloque">
      {/* Nivel 1: acceso rápido en 1 clic */}
      <label className="e2-design-quick-color" title="Color de fondo rápido">
        <span className="e2-design-quick-color__label">Fondo</span>
        <input
          type="color"
          aria-label="Color de fondo rápido"
          value={currentBg.type === 'solid' && currentBg.color ? currentBg.color : '#ffffff'}
          onChange={(e) => patchStyle({ background: { type: 'solid', color: e.target.value } })}
        />
      </label>

      {showVerticalAlign && (
        <span className="e2-text-toolbar__group" role="group" aria-label="Alineación vertical">
          {VERTICAL_ALIGNS.map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              aria-label={label}
              title={label}
              aria-pressed={currentVerticalAlign === value}
              onClick={() => changeVerticalAlign(value)}
            >
              <Icon size={14} aria-hidden="true" />
            </button>
          ))}
        </span>
      )}

      <span className="e2-text-toolbar__group" role="group" aria-label="Copiar o pegar estilo">
        <button
          type="button"
          aria-label="Copiar estilo (Ctrl+Alt+C)"
          title="Copiar estilo (Ctrl+Alt+C)"
          onClick={handleCopyStyle}
        >
          <Paintbrush size={14} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Pegar estilo (Ctrl+Alt+V)"
          title={copiedStyle ? 'Pegar estilo copiado (Ctrl+Alt+V)' : 'Copia primero un estilo'}
          disabled={!copiedStyle}
          onClick={handlePasteStyle}
        >
          <ClipboardPaste size={14} aria-hidden="true" />
        </button>
      </span>

      {/* Nivel 2: panel plegable de diseño avanzado */}
      <InspectorDialog
        label={isStyled ? 'Diseño ●' : 'Diseño'}
        icon={<Palette size={14} aria-hidden="true" />}
      >
        <div className="e2-design-panel">
          {/* 1. Superficie / Fondo */}
          <details className="e2-design-section" open>
            <summary>Superficie y fondo</summary>
            <div className="e2-design-section__body">
              <div className="e2-segmented" role="group" aria-label="Tipo de fondo">
                {(
                  [
                    ['none', 'Ninguno'],
                    ['solid', 'Color'],
                    ['gradient', 'Degradado'],
                    ['image', 'Imagen'],
                  ] as const
                ).map(([type, label]) => (
                  <button
                    key={type}
                    type="button"
                    className={currentBg.type === type ? 'is-active' : undefined}
                    aria-pressed={currentBg.type === type}
                    onClick={() => setBgType(type)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {currentBg.type === 'solid' && (
                <div className="e2-design-row e2-design-row--stack">
                  <div className="e2-swatch-row" role="group" aria-label="Colores rápidos de fondo">
                    {allSwatches.map((swatch) => (
                      <button
                        key={swatch.color}
                        type="button"
                        className={`e2-swatch-btn${currentBg.color === swatch.color ? ' is-active' : ''}`}
                        style={{ backgroundColor: swatch.color }}
                        title={swatch.label}
                        aria-label={`Fondo ${swatch.label}`}
                        onClick={() => patchStyle({ background: { type: 'solid', color: swatch.color } })}
                      />
                    ))}
                  </div>
                  <label className="e2-color-chip">
                    <input
                      type="color"
                      aria-label="Color de fondo personalizado"
                      value={currentBg.color ?? '#f2f9fd'}
                      onChange={(e) => patchStyle({ background: { type: 'solid', color: e.target.value } })}
                    />
                    <span className="e2-mono">{(currentBg.color ?? '#f2f9fd').toUpperCase()}</span>
                  </label>
                </div>
              )}

              {currentBg.type === 'gradient' && (
                <GradientPicker
                  value={currentBg.gradient ?? { kind: 'linear', angle: 135, stops: ['#f0f9ff', '#e0f2fe'] }}
                  onChange={(gradient) => patchStyle({ background: { type: 'gradient', gradient } })}
                />
              )}

              {currentBg.type === 'image' && (
                <div className="e2-design-row e2-design-row--stack">
                  <label className="e2-design-field">
                    <span className="e2-design-label">URL de imagen (HTTPS / R2)</span>
                    <input
                      type="url"
                      placeholder="https://pub-....r2.dev/..."
                      value={currentBg.imageUrl ?? ''}
                      onChange={(e) => {
                        const raw = e.target.value.trim();
                        patchStyle({
                          background: {
                            type: 'image',
                            ...(raw ? { imageUrl: raw } : {}),
                            overlayColor: currentBg.overlayColor ?? '#0b2545',
                            overlayOpacity: currentBg.overlayOpacity ?? 0.35,
                          },
                        });
                      }}
                    />
                  </label>
                  <div className="e2-design-row">
                    <label className="e2-color-chip">
                      <input
                        type="color"
                        aria-label="Color del velo sobre la imagen"
                        value={currentBg.overlayColor ?? '#0b2545'}
                        onChange={(e) =>
                          patchStyle({
                            background: { ...currentBg, type: 'image', overlayColor: e.target.value },
                          })
                        }
                      />
                      <span>Velo</span>
                    </label>
                    <label className="e2-design-slider">
                      <span>{Math.round((currentBg.overlayOpacity ?? 0.35) * 100)}%</span>
                      <input
                        type="range"
                        aria-label="Opacidad del velo"
                        min={0}
                        max={0.9}
                        step={0.05}
                        value={currentBg.overlayOpacity ?? 0.35}
                        onChange={(e) =>
                          patchStyle({
                            background: {
                              ...currentBg,
                              type: 'image',
                              overlayOpacity: Number(e.target.value),
                            },
                          })
                        }
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>
          </details>

          {/* 2. Borde y acento */}
          <details className="e2-design-section">
            <summary>Borde y acento lateral</summary>
            <div className="e2-design-section__body">
              <div className="e2-segmented" role="group" aria-label="Estilo de borde">
                {(
                  [
                    ['none', 'Sin borde'],
                    ['solid', 'Sólido'],
                    ['dashed', 'Guiones'],
                    ['dotted', 'Puntos'],
                  ] as const
                ).map(([bStyle, label]) => (
                  <button
                    key={bStyle}
                    type="button"
                    className={currentBorder.style === bStyle ? 'is-active' : undefined}
                    aria-pressed={currentBorder.style === bStyle}
                    onClick={() =>
                      patchStyle({
                        border:
                          bStyle === 'none'
                            ? undefined
                            : {
                                width: currentBorder.width > 0 ? currentBorder.width : 1,
                                style: bStyle,
                                color: currentBorder.color,
                                sides: currentBorder.sides ?? 'all',
                              },
                      })
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>

              {currentBorder.style !== 'none' && (
                <>
                  <div className="e2-design-row">
                    <label className="e2-color-chip">
                      <input
                        type="color"
                        aria-label="Color de borde"
                        value={currentBorder.color}
                        onChange={(e) =>
                          patchStyle({ border: { ...currentBorder, color: e.target.value } })
                        }
                      />
                      <span className="e2-mono">{currentBorder.color.toUpperCase()}</span>
                    </label>
                    <label className="e2-design-slider">
                      <span>{currentBorder.width} px</span>
                      <input
                        type="range"
                        aria-label="Grosor del borde"
                        min={1}
                        max={12}
                        step={1}
                        value={currentBorder.width}
                        onChange={(e) =>
                          patchStyle({ border: { ...currentBorder, width: Number(e.target.value) } })
                        }
                      />
                    </label>
                  </div>

                  <div className="e2-design-row e2-design-row--stack">
                    <span className="e2-design-label">Lados</span>
                    <div className="e2-angle-chips" role="group" aria-label="Lados del borde">
                      {BORDER_SIDES.map((side) => (
                        <button
                          key={side.value}
                          type="button"
                          className={`e2-chip-btn${(currentBorder.sides ?? 'all') === side.value ? ' is-active' : ''}`}
                          onClick={() =>
                            patchStyle({ border: { ...currentBorder, sides: side.value } })
                          }
                        >
                          {side.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </details>

          {/* 3. Esquinas, relleno y ancho */}
          <details className="e2-design-section">
            <summary>Esquinas, relleno y ancho</summary>
            <div className="e2-design-section__body">
              <div className="e2-design-row__head">
                <span className="e2-design-label">Redondeado</span>
                <div className="e2-angle-chips">
                  <button
                    type="button"
                    className={`e2-chip-btn${currentRadius.mode === 'uniform' ? ' is-active' : ''}`}
                    onClick={() =>
                      patchStyle({ radius: { mode: 'uniform', value: currentRadius.value ?? 12 } })
                    }
                  >
                    Uniforme
                  </button>
                  <button
                    type="button"
                    className={`e2-chip-btn${currentRadius.mode === 'custom' ? ' is-active' : ''}`}
                    onClick={() => {
                      const base = currentRadius.value ?? 12;
                      patchStyle({
                        radius: {
                          mode: 'custom',
                          tl: currentRadius.tl ?? base,
                          tr: currentRadius.tr ?? base,
                          br: currentRadius.br ?? base,
                          bl: currentRadius.bl ?? base,
                        },
                      });
                    }}
                  >
                    Por esquina
                  </button>
                </div>
              </div>

              {currentRadius.mode === 'uniform' ? (
                <label className="e2-design-slider">
                  <span>{currentRadius.value ?? 0} px</span>
                  <input
                    type="range"
                    aria-label="Radio de esquina"
                    min={0}
                    max={48}
                    step={2}
                    value={currentRadius.value ?? 0}
                    onChange={(e) =>
                      patchStyle({ radius: { mode: 'uniform', value: Number(e.target.value) } })
                    }
                  />
                </label>
              ) : (
                <div className="e2-quad-grid">
                  {(
                    [
                      ['tl', 'Sup. izq'],
                      ['tr', 'Sup. der'],
                      ['bl', 'Inf. izq'],
                      ['br', 'Inf. der'],
                    ] as const
                  ).map(([corner, label]) => (
                    <label key={corner} className="e2-num-field">
                      <span>{label}</span>
                      <input
                        type="number"
                        min={0}
                        max={64}
                        value={currentRadius[corner] ?? 0}
                        onChange={(e) =>
                          patchStyle({
                            radius: {
                              ...currentRadius,
                              mode: 'custom',
                              [corner]: Math.min(64, Math.max(0, Number(e.target.value) || 0)),
                            },
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
              )}

              <div className="e2-design-row__head">
                <span className="e2-design-label">Relleno interno</span>
                <div className="e2-angle-chips">
                  {(
                    [
                      ['uniform', 'Igual'],
                      ['axis', 'X / Y'],
                      ['custom', '4 lados'],
                    ] as const
                  ).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      className={`e2-chip-btn${currentPadding.mode === mode ? ' is-active' : ''}`}
                      onClick={() => {
                        const base = currentPadding.value ?? 16;
                        if (mode === 'uniform') {
                          patchStyle({ padding: { mode: 'uniform', value: base } });
                        } else if (mode === 'axis') {
                          patchStyle({
                            padding: { mode: 'axis', x: currentPadding.x ?? base, y: currentPadding.y ?? base },
                          });
                        } else {
                          patchStyle({
                            padding: {
                              mode: 'custom',
                              t: currentPadding.t ?? base,
                              r: currentPadding.r ?? base,
                              b: currentPadding.b ?? base,
                              l: currentPadding.l ?? base,
                            },
                          });
                        }
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {currentPadding.mode === 'uniform' && (
                <label className="e2-design-slider">
                  <span>{currentPadding.value ?? 0} px</span>
                  <input
                    type="range"
                    aria-label="Relleno interno uniforme"
                    min={0}
                    max={64}
                    step={2}
                    value={currentPadding.value ?? 0}
                    onChange={(e) =>
                      patchStyle({ padding: { mode: 'uniform', value: Number(e.target.value) } })
                    }
                  />
                </label>
              )}

              {currentPadding.mode === 'axis' && (
                <div className="e2-quad-grid">
                  <label className="e2-num-field">
                    <span>Horizontal (X)</span>
                    <input
                      type="number"
                      min={0}
                      max={96}
                      value={currentPadding.x ?? 0}
                      onChange={(e) =>
                        patchStyle({
                          padding: {
                            mode: 'axis',
                            x: Math.min(96, Math.max(0, Number(e.target.value) || 0)),
                            y: currentPadding.y ?? 0,
                          },
                        })
                      }
                    />
                  </label>
                  <label className="e2-num-field">
                    <span>Vertical (Y)</span>
                    <input
                      type="number"
                      min={0}
                      max={96}
                      value={currentPadding.y ?? 0}
                      onChange={(e) =>
                        patchStyle({
                          padding: {
                            mode: 'axis',
                            x: currentPadding.x ?? 0,
                            y: Math.min(96, Math.max(0, Number(e.target.value) || 0)),
                          },
                        })
                      }
                    />
                  </label>
                </div>
              )}

              {currentPadding.mode === 'custom' && (
                <div className="e2-quad-grid">
                  {(
                    [
                      ['t', 'Arriba'],
                      ['r', 'Derecha'],
                      ['b', 'Abajo'],
                      ['l', 'Izquierda'],
                    ] as const
                  ).map(([side, label]) => (
                    <label key={side} className="e2-num-field">
                      <span>{label}</span>
                      <input
                        type="number"
                        min={0}
                        max={96}
                        value={currentPadding[side] ?? 0}
                        onChange={(e) =>
                          patchStyle({
                            padding: {
                              ...currentPadding,
                              mode: 'custom',
                              [side]: Math.min(96, Math.max(0, Number(e.target.value) || 0)),
                            },
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
              )}

              {showMaxWidth && (
                <div className="e2-design-row e2-design-row--stack">
                  <span className="e2-design-label">Ancho máximo</span>
                  <div className="e2-angle-chips" role="group" aria-label="Ancho máximo">
                    {MAX_WIDTH_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        className={`e2-chip-btn${(style.maxWidth ?? 'full') === opt.value ? ' is-active' : ''}`}
                        onClick={() =>
                          patchStyle({ maxWidth: opt.value === 'full' ? undefined : opt.value })
                        }
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </details>

          {/* 4. Sombra, cristal y opacidad */}
          <details className="e2-design-section">
            <summary>Sombra, cristal y opacidad</summary>
            <div className="e2-design-section__body">
              <div className="e2-design-row e2-design-row--stack">
                <span className="e2-design-label">Sombra</span>
                <div className="e2-angle-chips" role="group" aria-label="Tipo de sombra">
                  {SHADOW_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`e2-chip-btn${currentShadow === opt.value ? ' is-active' : ''}`}
                      onClick={() =>
                        patchStyle({ shadow: opt.value === 'none' ? undefined : opt.value })
                      }
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {currentShadow === 'glow' && (
                  <label className="e2-color-chip">
                    <input
                      type="color"
                      aria-label="Color del brillo de sombra"
                      value={style.shadowColor ?? '#0284c7'}
                      onChange={(e) => patchStyle({ shadowColor: e.target.value })}
                    />
                    <span>Color del brillo</span>
                  </label>
                )}
              </div>

              <label className="e2-design-slider">
                <span>Cristal (desenfoque): {currentBlur} px</span>
                <input
                  type="range"
                  aria-label="Desenfoque efecto cristal"
                  min={0}
                  max={24}
                  step={2}
                  value={currentBlur}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    patchStyle({ backdropBlur: val > 0 ? val : undefined });
                  }}
                />
              </label>

              <label className="e2-design-slider">
                <span>Opacidad: {Math.round(currentOpacity * 100)}%</span>
                <input
                  type="range"
                  aria-label="Opacidad del bloque"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={currentOpacity}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    patchStyle({ opacity: val < 1 ? val : undefined });
                  }}
                />
              </label>
            </div>
          </details>

          {/* 5. Animación y hover (respeta prefers-reduced-motion) */}
          <details className="e2-design-section">
            <summary>Animación y efecto al pasar el cursor</summary>
            <div className="e2-design-section__body">
              <div className="e2-design-row e2-design-row--stack">
                <span className="e2-design-label">Entrada en vista pública</span>
                <div className="e2-angle-chips" role="group" aria-label="Animación de entrada">
                  {(
                    [
                      ['none', 'Ninguna'],
                      ['fade', 'Aparecer'],
                      ['slide-up', 'Subir suave'],
                      ['zoom', 'Zoom sutil'],
                    ] as const
                  ).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      className={`e2-chip-btn${(style.motion?.entrance ?? 'none') === val ? ' is-active' : ''}`}
                      onClick={() =>
                        patchStyle({
                          motion:
                            val === 'none' && (!style.motion?.hover || style.motion.hover === 'none')
                              ? undefined
                              : { ...style.motion, entrance: val === 'none' ? undefined : val },
                        })
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="e2-design-row e2-design-row--stack">
                <span className="e2-design-label">Efecto al pasar el cursor (hover)</span>
                <div className="e2-angle-chips" role="group" aria-label="Efecto hover">
                  {(
                    [
                      ['none', 'Ninguno'],
                      ['lift', 'Elevar'],
                      ['glow', 'Brillo'],
                      ['scale', 'Escala suave'],
                    ] as const
                  ).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      className={`e2-chip-btn${(style.motion?.hover ?? 'none') === val ? ' is-active' : ''}`}
                      onClick={() =>
                        patchStyle({
                          motion:
                            val === 'none' && (!style.motion?.entrance || style.motion.entrance === 'none')
                              ? undefined
                              : { ...style.motion, hover: val === 'none' ? undefined : val },
                        })
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </details>

          <div className="e2-design-panel__foot">
            <button
              type="button"
              className="e2-button e2-button--quiet"
              disabled={!isStyled}
              onClick={() => commitStyle(undefined)}
            >
              <RotateCcw size={13} aria-hidden="true" />
              <span>Restablecer diseño</span>
            </button>
          </div>
        </div>
      </InspectorDialog>
    </div>
  );
}
