import { DEFAULT_BOX_STYLE } from './styleSchema';
import { GRID_COLUMNS, GRID_STEP, fromGridLine, fromGridSpan } from './gridResolution';
import type {
  AccordionBlock,
  AccordionItem,
  BadgeBlock,
  BlockStyle,
  BoxChildPlacedBlock,
  BoxNode,
  ButtonBlock,
  CalloutBlock,
  CanvasDoc,
  CarouselBlock,
  CarouselItem,
  CompareBlock,
  DividerBlock,
  ExamCarouselBlock,
  ExamParcial,
  Gap,
  GifBlock,
  HeadingBlock,
  IconBlock,
  ImageBlock,
  InnerCanvasNode,
  LayoutIntent,
  LeafPlacedBlock,
  PlacedBlock,
  RichTextV1,
  SpanIntent,
  TabItem,
  TableBlock,
  TabsBlock,
  TextBlock,
  VideoBlock,
} from './types';

let fallbackIdCounter = 0;

/**
 * Imagen pública de R2 usada como valor inicial al insertar una imagen.
 * Sustituir por el selector de medios real en una parte posterior.
 */
export const EDITOR2_DEFAULT_IMAGE_SRC =
  'https://pub-49025e2296604f9db7de3c958d1fdd8e.r2.dev/placas/Epitelios/Epitelio_Cubico_Simple/1787966670933_cess.webp';

function createId(): string {
  const browserCrypto = globalThis.crypto;
  if (browserCrypto && typeof browserCrypto.randomUUID === 'function') {
    return browserCrypto.randomUUID();
  }
  fallbackIdCounter += 1;
  return `00000000-0000-4000-8000-${String(fallbackIdCounter).padStart(12, '0')}`;
}

const FULL_GRID_SPAN = fromGridSpan(GRID_COLUMNS);

export function createRichText(value = ''): RichTextV1 {
  return { format: 'plain', value };
}

export function createSpanIntent(span = FULL_GRID_SPAN, start?: number): SpanIntent {
  const safeSpan = Math.min(FULL_GRID_SPAN, Math.max(GRID_STEP, Math.round(span / GRID_STEP) * GRID_STEP));
  if (start === undefined) return { span: safeSpan };
  const safeStart = Math.min(fromGridLine(GRID_COLUMNS), Math.max(1, Math.round(start / GRID_STEP) * GRID_STEP));
  return safeStart + safeSpan <= fromGridLine(GRID_COLUMNS + 1) ? { span: safeSpan, start: safeStart } : { span: safeSpan };
}

export function createLayoutIntent(span = FULL_GRID_SPAN): LayoutIntent {
  return { base: createSpanIntent(span) };
}

export function createHeadingBlock(options: { id?: string; level?: 1 | 2 | 3; text?: string } = {}): HeadingBlock {
  return {
    id: options.id ?? createId(),
    type: 'heading',
    props: {
      level: options.level ?? 2,
      text: createRichText(options.text ?? ''),
    },
  };
}

export function createTextBlock(options: { id?: string; text?: string } = {}): TextBlock {
  return {
    id: options.id ?? createId(),
    type: 'text',
    props: {
      text: createRichText(options.text ?? ''),
    },
  };
}

export function createImageBlock(
  options: {
    id?: string;
    src?: string;
    alt?: string;
    caption?: string;
    fit?: 'cover' | 'contain';
    zoom?: boolean;
  } = {},
): ImageBlock {
  return {
    id: options.id ?? createId(),
    type: 'image',
    props: {
      src: options.src ?? EDITOR2_DEFAULT_IMAGE_SRC,
      alt: options.alt ?? '',
      ...(options.caption === undefined ? {} : { caption: createRichText(options.caption) }),
      ...(options.fit === undefined ? {} : { fit: options.fit }),
      ...(options.zoom === undefined ? {} : { zoom: options.zoom }),
    },
  };
}

export function createDividerBlock(
  options: {
    id?: string;
    orientation?: 'horizontal' | 'vertical';
    lineStyle?: 'solid' | 'dashed' | 'gradient';
    thickness?: number;
    color?: string;
  } = {},
): DividerBlock {
  return {
    id: options.id ?? createId(),
    type: 'divider',
    props: {
      ...(options.orientation ? { orientation: options.orientation } : {}),
      ...(options.lineStyle ? { lineStyle: options.lineStyle } : {}),
      ...(options.thickness ? { thickness: options.thickness } : {}),
      ...(options.color ? { color: options.color } : {}),
    },
  };
}

export function createButtonBlock(
  options: {
    id?: string;
    label?: string;
    href?: string;
    variant?: 'solid' | 'outline' | 'soft' | 'gradient' | 'pill';
    newTab?: boolean;
    color?: string;
  } = {},
): ButtonBlock {
  return {
    id: options.id ?? createId(),
    type: 'button',
    props: {
      label: createRichText(options.label ?? 'Explorar'),
      href: options.href ?? '/temario',
      ...(options.variant ? { variant: options.variant } : {}),
      ...(options.newTab !== undefined ? { newTab: options.newTab } : {}),
      ...(options.color ? { color: options.color } : {}),
    },
  };
}

export function createTableBlock(
  options: {
    id?: string;
    headers?: string[];
    rows?: string[][];
    accentColor?: string;
  } = {},
): TableBlock {
  return {
    id: options.id ?? createId(),
    type: 'table',
    props: {
      headers: options.headers ?? ['Estructura', 'Característica', 'Ubicación'],
      rows: options.rows ?? [
        ['Epitelio simple', 'Una sola capa celular', 'Alvéolos y endotelio'],
        ['Epitelio estratificado', 'Dos o más capas celulares', 'Epidermis y esófago'],
      ],
      ...(options.accentColor ? { accentColor: options.accentColor } : {}),
    },
  };
}

export function createCarouselBlock(
  options: {
    id?: string;
    items?: CarouselItem[];
    fit?: 'cover' | 'contain';
  } = {},
): CarouselBlock {
  return {
    id: options.id ?? createId(),
    type: 'carousel',
    props: {
      items: options.items ?? [
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
      ...(options.fit ? { fit: options.fit } : {}),
    },
  };
}

export function createTabsBlock(
  options: {
    id?: string;
    items?: TabItem[];
    accentColor?: string;
  } = {},
): TabsBlock {
  return {
    id: options.id ?? createId(),
    type: 'tabs',
    props: {
      items: options.items ?? [
        {
          title: 'Sección 1',
          children: [],
        },
        {
          title: 'Sección 2',
          children: [],
        },
      ],
      ...(options.accentColor ? { accentColor: options.accentColor } : {}),
    },
  };
}

export function createVideoBlock(
  options: {
    id?: string;
    url?: string;
    caption?: string;
    aspect?: '16/9' | '4/3' | '1/1';
  } = {},
): VideoBlock {
  return {
    id: options.id ?? createId(),
    type: 'video',
    props: {
      url: options.url ?? '',
      ...(options.caption === undefined ? {} : { caption: createRichText(options.caption) }),
      ...(options.aspect ? { aspect: options.aspect } : {}),
    },
  };
}

export function createCompareBlock(
  options: {
    id?: string;
    leftSrc?: string;
    leftLabel?: string;
    rightSrc?: string;
    rightLabel?: string;
  } = {},
): CompareBlock {
  return {
    id: options.id ?? createId(),
    type: 'compare',
    props: {
      leftSrc: options.leftSrc ?? EDITOR2_DEFAULT_IMAGE_SRC,
      leftLabel: options.leftLabel ?? 'Vista A',
      rightSrc: options.rightSrc ?? EDITOR2_DEFAULT_IMAGE_SRC,
      rightLabel: options.rightLabel ?? 'Vista B',
    },
  };
}

export function createCalloutBlock(
  options: {
    id?: string;
    tone?: 'info' | 'clinical' | 'tip' | 'warning';
    title?: string;
    text?: string;
  } = {},
): CalloutBlock {
  return {
    id: options.id ?? createId(),
    type: 'callout',
    props: {
      tone: options.tone ?? 'info',
      title: createRichText(options.title ?? 'Nota clave'),
      text: createRichText(options.text ?? 'Escribe aquí una observación o correlación clínica.'),
    },
  };
}

export function createGifBlock(
  options: {
    id?: string;
    src?: string;
    alt?: string;
    caption?: string;
    fit?: 'cover' | 'contain';
  } = {},
): GifBlock {
  return {
    id: options.id ?? createId(),
    type: 'gif',
    props: {
      src: options.src ?? EDITOR2_DEFAULT_IMAGE_SRC,
      alt: options.alt ?? 'Animación histológica',
      ...(options.caption === undefined ? {} : { caption: createRichText(options.caption) }),
      ...(options.fit ? { fit: options.fit } : {}),
    },
  };
}

export function createAccordionBlock(
  options: {
    id?: string;
    items?: AccordionItem[];
    accentColor?: string;
  } = {},
): AccordionBlock {
  return {
    id: options.id ?? createId(),
    type: 'accordion',
    props: {
      items: options.items ?? [
        {
          title: 'Sección desplegable 1',
          openByDefault: true,
          children: [],
        },
        {
          title: 'Sección desplegable 2',
          openByDefault: false,
          children: [],
        },
      ],
      ...(options.accentColor ? { accentColor: options.accentColor } : {}),
    },
  };
}

export function createLeafPlacedBlock(block: LeafPlacedBlock['block'], span = FULL_GRID_SPAN): LeafPlacedBlock {
  return { block, layout: createLayoutIntent(span) };
}

export function createPlacedBlock(block: PlacedBlock['block'], span = FULL_GRID_SPAN): PlacedBlock {
  return { block, layout: createLayoutIntent(span) };
}

export function createBadgeBlock(
  options: {
    id?: string;
    text?: string;
    variant?: 'solid' | 'soft' | 'outline' | 'glass' | 'swatch';
    color?: string;
    icon?: string;
    size?: 'sm' | 'md' | 'lg';
    align?: 'left' | 'center' | 'right';
  } = {},
): BadgeBlock {
  return {
    id: options.id ?? createId(),
    type: 'badge',
    props: {
      text: createRichText(options.text ?? 'Etiqueta'),
      variant: options.variant ?? 'soft',
      color: options.color ?? '#0284c7',
      ...(options.icon ? { icon: options.icon } : {}),
      ...(options.size ? { size: options.size } : {}),
      ...(options.align ? { align: options.align } : {}),
    },
  };
}

export function createIconBlock(
  options: {
    id?: string;
    name?: string;
    size?: number;
    color?: string;
    bgColor?: string;
    frame?: 'none' | 'circle' | 'rounded';
    align?: 'left' | 'center' | 'right';
    label?: string;
  } = {},
): IconBlock {
  return {
    id: options.id ?? createId(),
    type: 'icon',
    props: {
      name: options.name ?? 'microscope',
      size: options.size ?? 32,
      color: options.color ?? '#0284c7',
      ...(options.bgColor ? { bgColor: options.bgColor } : {}),
      frame: options.frame ?? 'rounded',
      ...(options.align ? { align: options.align } : {}),
      ...(options.label ? { label: options.label } : {}),
    },
  };
}

export function createExamCarouselBlock(
  options: {
    id?: string;
    parcial?: ExamParcial;
    title?: string;
    accentColor?: string;
    maxItems?: number;
  } = {},
): ExamCarouselBlock {
  return {
    id: options.id ?? createId(),
    type: 'examCarousel',
    props: {
      parcial: options.parcial ?? 'primer',
      ...(options.title ? { title: options.title } : {}),
      accentColor: options.accentColor ?? '#6d28d9',
      maxItems: options.maxItems ?? 8,
    },
  };
}

export function createBoxBlock(
  options: {
    id?: string;
    gap?: Gap;
    style?: BlockStyle;
    children?: BoxChildPlacedBlock[];
  } = {},
): BoxNode {
  return {
    id: options.id ?? createId(),
    type: 'box',
    props: {
      gap: options.gap ?? 'md',
      boxDepth: 0,
      style: options.style ?? { ...DEFAULT_BOX_STYLE },
    },
    slots: {
      children: options.children ?? [],
    },
  };
}

export function createNestedCanvasNode(
  options: { id?: string; gap?: Gap; children?: LeafPlacedBlock[] } = {},
): InnerCanvasNode {
  return {
    id: options.id ?? createId(),
    type: 'canvas',
    props: {
      gap: options.gap ?? 'md',
      depth: 1,
    },
    slots: {
      children: options.children ?? [],
    },
  };
}

export function createEmptyCanvasDoc(
  pageKey: string,
  options: { id?: string; gap?: Gap; children?: PlacedBlock[] } = {},
): CanvasDoc {
  return {
    schemaVersion: 2,
    pageKey,
    root: {
      id: options.id ?? createId(),
      type: 'canvas',
      props: {
        gap: options.gap ?? 'md',
        depth: 0,
      },
      slots: {
        children: options.children ?? [],
      },
    },
  };
}
