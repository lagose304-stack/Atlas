import type { BlockType } from '../PageContentEditor';

export interface BlockMeta {
  label: string;
  icon: string;
  description: string;
  color: string;
}

export interface BlockDefinition {
  meta: BlockMeta;
  schemaVersion: number;
  defaultContent: Record<string, string>;
}

const CTA_DEFAULT_CONTENT: Record<string, string> = {
  cta_position: 'after',
  cta_layout: 'row',
  cta_align: 'left',
  cta_gap: '12',
  cta_style: 'soft',
  cta_size: 'md',
  cta_shape: 'rounded',
  cta_color: '#2563eb',
  cta_text_color: '#ffffff',
  cta_1_text: '',
  cta_1_url: '',
  cta_1_new_tab: 'false',
  cta_2_text: '',
  cta_2_url: '',
  cta_2_new_tab: 'false',
  cta_3_text: '',
  cta_3_url: '',
  cta_3_new_tab: 'false',
  cta_4_text: '',
  cta_4_url: '',
  cta_4_new_tab: 'false',
};

export const BLOCK_REGISTRY: Record<BlockType, BlockDefinition> = {
  heading: {
    meta: { label: 'Titulo principal', icon: 'TIT', description: 'Encabezado grande para abrir una seccion.', color: '#6366f1' },
    schemaVersion: 1,
    defaultContent: { text: '' },
  },
  subheading: {
    meta: { label: 'Subtitulo', icon: 'SUB', description: 'Encabezado secundario para organizar contenido.', color: '#8b5cf6' },
    schemaVersion: 1,
    defaultContent: { text: '' },
  },
  paragraph: {
    meta: { label: 'Texto', icon: 'TXT', description: 'Bloque de texto normal para cuerpo de contenido.', color: '#0ea5e9' },
    schemaVersion: 1,
    defaultContent: { text: '' },
  },
  image: {
    meta: { label: 'Imagen', icon: 'IMG', description: 'Una sola imagen con pie opcional.', color: '#10b981' },
    schemaVersion: 2,
    defaultContent: {
      url: '',
      caption: '',
      size: 'large',
      align: 'center',
      image_width: '100',
      image_height: '',
      image_fit: 'contain',
    },
  },
  text_image: {
    meta: { label: 'Texto con imagen', icon: 'T+IMG', description: 'Texto acompanado de una imagen al lado.', color: '#f59e0b' },
    schemaVersion: 2,
    defaultContent: {
      text: '',
      image_url: '',
      image_position: 'right',
      image_caption: '',
      ti_vertical_align: 'start',
      ti_image_width: '42',
      ti_image_height: '',
      ti_image_fit: 'cover',
    },
  },
  two_images: {
    meta: { label: 'Dos imagenes', icon: '2IMG', description: 'Muestra dos imagenes en paralelo.', color: '#ec4899' },
    schemaVersion: 1,
    defaultContent: {
      image_url_left: '',
      image_caption_left: '',
      image_url_right: '',
      image_caption_right: '',
    },
  },
  three_images: {
    meta: { label: 'Tres imagenes', icon: '3IMG', description: 'Galeria corta de tres imagenes.', color: '#a855f7' },
    schemaVersion: 1,
    defaultContent: {
      image_url_1: '',
      image_caption_1: '',
      image_url_2: '',
      image_caption_2: '',
      image_url_3: '',
      image_caption_3: '',
    },
  },
  callout: {
    meta: { label: 'Caja destacada', icon: 'INFO', description: 'Resalta una idea importante o aviso.', color: '#f97316' },
    schemaVersion: 1,
    defaultContent: { text: '', variant: 'info' },
  },
  list: {
    meta: { label: 'Lista', icon: 'LISTA', description: 'Elementos en formato de lista.', color: '#06b6d4' },
    schemaVersion: 1,
    defaultContent: { items: '', style: 'bullet' },
  },
  divider: {
    meta: { label: 'Separador', icon: 'SEP', description: 'Linea divisoria entre secciones.', color: '#94a3b8' },
    schemaVersion: 1,
    defaultContent: { style: 'gradient' },
  },
  carousel: {
    meta: { label: 'Galeria deslizante', icon: 'GAL', description: 'Carrusel de imagenes automatico o manual.', color: '#6366f1' },
    schemaVersion: 1,
    defaultContent: { interval: '4', auto: 'true' },
  },
  text_carousel: {
    meta: { label: 'Texto + galeria', icon: 'TXT+GAL', description: 'Texto junto a un carrusel de imagenes.', color: '#3b82f6' },
    schemaVersion: 1,
    defaultContent: { text: '', image_position: 'right', ti_text_align: 'left', interval: '4', auto: 'true' },
  },
  double_carousel: {
    meta: { label: 'Doble galeria', icon: '2GAL', description: 'Dos galerias deslizantes en el mismo bloque.', color: '#8b5cf6' },
    schemaVersion: 1,
    defaultContent: { interval: '4', auto: 'true' },
  },
  section: {
    meta: { label: 'Seccion', icon: 'SECC', description: 'Bloque contenedor para agrupar contenido.', color: '#14b8a6' },
    schemaVersion: 1,
    defaultContent: { title: '', subtitle: '', tone: 'neutral' },
  },
  columns_2: {
    meta: { label: 'Columnas', icon: 'COL', description: 'Distribuye texto en columnas.', color: '#0ea5e9' },
    schemaVersion: 1,
    defaultContent: {
      columns: '2',
      col_1: '',
      col_2: '',
      col_3: '',
      col_4: '',
      left: '',
      right: '',
      ratio: '1:1',
    },
  },
};

export const BLOCK_TYPES = Object.keys(BLOCK_REGISTRY) as BlockType[];

export const getBlockMeta = (type: BlockType): BlockMeta => BLOCK_REGISTRY[type].meta;

export const createDefaultBlockContent = (type: BlockType): Record<string, string> => {
  const def = BLOCK_REGISTRY[type];
  return {
    ...CTA_DEFAULT_CONTENT,
    ...def.defaultContent,
    __schema_version: String(def.schemaVersion),
  };
};

export const normalizeBlockContent = (
  type: BlockType,
  rawContent: unknown
): Record<string, string> => {
  const base = createDefaultBlockContent(type);
  if (!rawContent || typeof rawContent !== 'object') return base;

  const entries = Object.entries(rawContent as Record<string, unknown>).reduce<Record<string, string>>((acc, [k, v]) => {
    if (v === undefined || v === null) return acc;
    acc[k] = typeof v === 'string' ? v : String(v);
    return acc;
  }, {});

  return {
    ...base,
    ...entries,
    __schema_version: String(BLOCK_REGISTRY[type].schemaVersion),
  };
};
