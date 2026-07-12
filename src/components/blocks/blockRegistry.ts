import type { BlockType } from '../../types/contentBlocks';

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
    defaultContent: { text: '', text_vertical_align: 'start', style_text: '#000000' },
  },
  subheading: {
    meta: { label: 'Subtitulo', icon: 'SUB', description: 'Encabezado secundario para organizar contenido.', color: '#8b5cf6' },
    schemaVersion: 1,
    defaultContent: { text: '', text_vertical_align: 'start', style_text: '#000000' },
  },
  paragraph: {
    meta: { label: 'Texto', icon: 'TXT', description: 'Bloque de texto normal para cuerpo de contenido.', color: '#0ea5e9' },
    schemaVersion: 1,
    defaultContent: { text: '', text_vertical_align: 'start', style_text: '#000000' },
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
      image_style: 'editorial',
      image_radius: '18',
      image_shadow: 'medium',
      image_zoom: 'true',
      image_hover: 'lift',
      image_aspect: 'auto',
      image_position: 'center center',
      image_accent: '#38bdf8',
      image_caption_style: 'below',
      image_caption_align: 'center',
      image_caption_position: 'bottom',
      image_filter: 'none',
      image_loading: 'lazy',
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
      ti_style: 'editorial',
      ti_accent: '#38bdf8',
      ti_radius: '20',
      ti_gap: '28',
      ti_zoom: 'true',
      ti_hover: 'lift',
      ti_image_shadow: 'medium',
      ti_image_aspect: 'auto',
      ti_object_position: 'center center',
      ti_text_align: 'left',
      ti_caption_align: 'center',
      ti_caption_size: '.82rem',
      ti_filter: 'none',
      ti_loading: 'lazy',
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
      two_style: 'editorial',
      two_accent: '#38bdf8',
      two_ratio: 'equal',
      two_aspect: 'landscape',
      two_fit: 'cover',
      two_gap: '20',
      two_radius: '18',
      two_zoom: 'true',
      two_hover: 'lift',
      two_shadow: 'medium',
      two_caption_align: 'center',
      two_caption_size: '.82rem',
      two_filter: 'none',
      two_loading: 'lazy',
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
      three_style: 'editorial',
      three_layout: 'grid',
      three_accent: '#38bdf8',
      three_aspect: 'landscape',
      three_fit: 'cover',
      three_gap: '18',
      three_radius: '16',
      three_zoom: 'true',
      three_hover: 'lift',
      three_shadow: 'medium',
      three_caption_align: 'center',
      three_caption_size: '.8rem',
      three_filter: 'none',
      three_loading: 'lazy',
    },
  },
  callout: {
    meta: { label: 'Caja destacada', icon: 'INFO', description: 'Resalta una idea importante o aviso.', color: '#f97316' },
    schemaVersion: 1,
    defaultContent: { text: '', variant: 'info', style_text: '#000000', callout_style: 'modern', callout_width: 'full', callout_show_icon: 'true' },
  },
  weekly_publication: {
    meta: { label: 'Publicación semanal', icon: 'SEM', description: 'Presenta los temas y la placa destacada de la semana.', color: '#2563eb' },
    schemaVersion: 1,
    defaultContent: {
      eyebrow: 'Esta semana en el laboratorio',
      title: 'Explora lo que estudiaremos esta semana',
      topic_1: '',
      topic_2: '',
      topic_1_id: '',
      topic_2_id: '',
      topic_1_logo: '',
      topic_2_logo: '',
      image_url: '',
      weekly_image_source: '',
      weekly_placa_id: '',
      image_caption: 'Placa de la semana',
      image_subtitle: 'Descubre y explora la placa destacada del laboratorio.',
      weekly_style: 'premium',
      weekly_image_position: 'right',
      weekly_accent: '#1677b8',
      weekly_bg: '#eef8ff',
      weekly_width: 'full',
      style_text: '#000000',
    },
  },
  list: {
    meta: { label: 'Lista', icon: 'LISTA', description: 'Elementos en formato de lista.', color: '#06b6d4' },
    schemaVersion: 1,
    defaultContent: { items: '', style: 'bullet', style_text: '#000000' },
  },
  divider: {
    meta: { label: 'Separador', icon: 'SEP', description: 'Linea divisoria entre secciones.', color: '#94a3b8' },
    schemaVersion: 1,
    defaultContent: { style: 'gradient', divider_color: '#38bdf8', divider_thickness: '3', divider_width: '100', divider_spacing: '20' },
  },
  carousel: {
    meta: { label: 'Galeria deslizante', icon: 'GAL', description: 'Carrusel de imagenes automatico o manual.', color: '#6366f1' },
    schemaVersion: 1,
    defaultContent: { interval: '4', auto: 'true', carousel_style: 'editorial', carousel_accent: '#38bdf8', carousel_width: 'wide', carousel_aspect: 'landscape', carousel_fit: 'cover', carousel_position: 'center center', carousel_radius: '20', carousel_zoom: 'true', carousel_arrows: 'true', carousel_dots: 'true', carousel_shadow: 'medium', carousel_caption_align: 'center', carousel_caption_size: '.84rem', carousel_filter: 'none', carousel_loading: 'lazy' },
  },
  text_carousel: {
    meta: { label: 'Texto + galeria', icon: 'TXT+GAL', description: 'Texto junto a un carrusel de imagenes.', color: '#3b82f6' },
    schemaVersion: 1,
    defaultContent: { text: '', image_position: 'right', ti_text_align: 'left', interval: '4', auto: 'true', tc_style: 'editorial', tc_accent: '#38bdf8', tc_gallery_width: '44', tc_vertical_align: 'center', tc_gap: '28', tc_radius: '20', tc_aspect: 'landscape', tc_fit: 'cover', tc_position: 'center center', tc_zoom: 'true', tc_arrows: 'true', tc_dots: 'true', tc_shadow: 'medium', tc_caption_align: 'center', tc_caption_size: '.8rem', tc_filter: 'none', tc_loading: 'lazy' },
  },
  double_carousel: {
    meta: { label: 'Doble galeria', icon: '2GAL', description: 'Dos galerias deslizantes en el mismo bloque.', color: '#8b5cf6' },
    schemaVersion: 1,
    defaultContent: { interval: '4', auto: 'true', dc_style: 'editorial', dc_accent: '#38bdf8', dc_ratio: 'equal', dc_aspect: 'landscape', dc_fit: 'cover', dc_position_left: 'center center', dc_position_right: 'center center', dc_gap: '22', dc_radius: '18', dc_zoom: 'true', dc_arrows: 'true', dc_dots: 'true', dc_shadow: 'medium', dc_caption_align: 'center', dc_caption_size: '.8rem', dc_filter: 'none', dc_loading: 'lazy' },
  },
  section: {
    meta: { label: 'Seccion', icon: 'SECC', description: 'Bloque contenedor para agrupar contenido.', color: '#14b8a6' },
    schemaVersion: 1,
    defaultContent: { title: '', subtitle: '', tone: 'neutral', section_layout: 'guided', section_header_style: 'surface', section_guide: 'true', section_gap: '16', section_accent: '#38bdf8' },
  },
  section_end: {
    meta: { label: 'Fin de sección', icon: 'FIN', description: 'Cierra una sección sin iniciar otra.', color: '#64748b' },
    schemaVersion: 1,
    defaultContent: {},
  },
  columns_2: {
    meta: { label: 'Columnas', icon: 'COL', description: 'Distribuye texto en columnas.', color: '#0ea5e9' },
    schemaVersion: 1,
    defaultContent: {
      columns: '2',
      ratio: '1:1',
      column_style: 'cards',
      column_vertical_align: 'start',
      column_gap: '20',
      column_accent: '#38bdf8',
      col_1: '',
      col_2: '',
      col_3: '',
      col_4: '',
      left: '',
      right: '',
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
