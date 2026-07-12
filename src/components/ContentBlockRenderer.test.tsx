import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ContentBlockRenderer from './ContentBlockRenderer';
import type { ContentBlock } from '../types/contentBlocks';

vi.mock('./ImageViewerModal', () => ({
  default: () => null,
}));

vi.mock('embla-carousel-react', () => ({
  default: () => [vi.fn(), undefined],
}));

const headingBlock: ContentBlock = {
  id: 'block-heading-1',
  entity_type: 'home_page',
  entity_id: 0,
  block_type: 'heading',
  sort_order: 0,
  content: {
    text: 'Título con fondo',
    style_max_width: 'full',
    style_align: 'center',
    style_bg: '#fef3c7',
  },
};

const subheadingBlock: ContentBlock = {
  id: 'block-subheading-1',
  entity_type: 'home_page',
  entity_id: 0,
  block_type: 'subheading',
  sort_order: 0,
  content: {
    text: 'Subtítulo con contorno',
    subtitle_decoration: 'outline',
    subtitle_accent: '#0ea5e9',
  },
};

const centeredSubheadingBlock: ContentBlock = {
  ...subheadingBlock,
  id: 'block-subheading-centered',
  content: {
    ...subheadingBlock.content,
    text: 'Subtítulo centrado',
    text_align: 'center',
    style_align: 'center',
    style_max_width: 'full',
    style_bg: '#f8fafc',
    subtitle_decoration: 'side-line',
  },
};

const paragraphBlock: ContentBlock = {
  id: 'block-paragraph-1',
  entity_type: 'home_page',
  entity_id: 0,
  block_type: 'paragraph',
  sort_order: 0,
  content: {
    text: 'Párrafo con aire',
    style_text_space_top: '24',
    style_text_space_bottom: '32',
  },
};

const listBlock: ContentBlock = {
  id: 'block-list-1',
  entity_type: 'home_page',
  entity_id: 0,
  block_type: 'list',
  sort_order: 0,
  content: {
    items: 'Uno\nDos',
    list_item_style: 'cards',
    style_font_family: 'classic',
  },
};

const weeklyBlock: ContentBlock = {
  id: 'block-weekly-1',
  entity_type: 'home_page',
  entity_id: 0,
  block_type: 'weekly_publication',
  sort_order: 0,
  content: {
    title: 'Semana tipográfica',
    image_url: 'https://example.com/placa.jpg',
    image_caption: 'Placa de la semana',
    weekly_font_family: 'Georgia, Times New Roman, serif',
    weekly_text_align: 'center',
    weekly_title_weight: '800',
    weekly_image_fit: 'contain',
    style_align: 'center',
    style_max_width: 'full',
    style_bg: '#f8fafc',
  },
};

const calloutBlock: ContentBlock = {
  id: 'block-callout-1',
  entity_type: 'home_page',
  entity_id: 0,
  block_type: 'callout',
  sort_order: 0,
  content: {
    text: 'Mensaje importante',
    variant: 'warning',
    callout_style: 'outline',
    callout_width: 'full',
    callout_show_icon: 'false',
    callout_label: 'Atención personalizada',
    callout_label_color: '#dc2626',
    text_align: 'center',
    style_bg: '#f8fafc',
    style_align: 'center',
    style_max_width: 'full',
    cta_position: 'before',
    cta_1_text: 'Leer más',
    cta_1_url: '/temario',
  },
};

const sectionBlock: ContentBlock = { id: 'section-1', entity_type: 'home_page', entity_id: 0, block_type: 'section', sort_order: 0, content: { title: 'Grupo moderno', eyebrow: 'Unidad 1', section_layout: 'card', section_accent: '#8b5cf6', section_bg: '#faf5ff', section_gap: '28' } };
const columnsBlock: ContentBlock = { id: 'columns-1', entity_type: 'home_page', entity_id: 0, block_type: 'columns_2', sort_order: 1, content: { columns: '2', ratio: '2:1', col_title_1: 'Ventajas', col_title_2: 'Límites', col_1: 'Contenido principal', col_2: 'Contenido secundario', column_style: 'soft', column_bg: '#eff6ff', column_gap: '30', column_vertical_align: 'stretch' } };
const dividerBlock: ContentBlock = { id: 'divider-1', entity_type: 'home_page', entity_id: 0, block_type: 'divider', sort_order: 0, content: { style: 'dashed', divider_color: '#dc2626', divider_thickness: '4', divider_width: '65', divider_spacing: '32' } };
const nestedHeadingBlock: ContentBlock = { ...headingBlock, id: 'nested-heading', sort_order: 2, content: { ...headingBlock.content, text: 'Componente en columna uno', layout_parent_id: 'columns-1', layout_column: '1' } };
const nestedParagraphBlock: ContentBlock = { ...paragraphBlock, id: 'nested-paragraph', sort_order: 3, content: { ...paragraphBlock.content, text: 'Componente en columna dos', layout_parent_id: 'columns-1', layout_column: '2' } };
const sectionEndBlock: ContentBlock = { id: 'section-end-1', entity_type: 'home_page', entity_id: 0, block_type: 'section_end', sort_order: 2, content: {} };
const imageBlock: ContentBlock = { id: 'image-1', entity_type: 'home_page', entity_id: 0, block_type: 'image', sort_order: 0, content: { url: 'https://example.com/image.jpg', caption: 'Detalle histológico', image_alt: 'Corte histológico del tejido', size: 'large', align: 'right', image_width: '55', image_fit: 'cover', image_aspect: 'wide', image_position: 'center top', image_style: 'framed', image_border: '#dbeafe', image_frame_bg: '#eff6ff', image_radius: '24', image_shadow: 'dramatic', image_zoom: 'false', image_filter: 'vivid', image_caption_style: 'overlay', image_caption_position: 'top', image_caption_align: 'left', image_caption_color: '#ffffff', image_caption_bg: '#0f172a', style_font_family: 'classic', style_font_size: 'lg', style_font_weight: '600', style_line_height: 'relaxed', style_letter_spacing: 'wide', style_text_transform: 'uppercase' } };

const textImageBlock: ContentBlock = { id: 'text-image-1', entity_type: 'home_page', entity_id: 0, block_type: 'text_image', sort_order: 0, content: { text: 'Texto combinado verificable', image_url: 'https://example.com/detail.jpg', image_caption: 'Detalle ampliado', ti_image_alt: 'Detalle visual ampliado', image_position: 'right', ti_image_width: '48', ti_vertical_align: 'center', ti_image_fit: 'contain', ti_image_aspect: 'landscape', ti_object_position: 'right center', ti_image_bg: '#eef2ff', ti_style: 'soft', ti_bg: '#f0f9ff', ti_radius: '26', ti_gap: '34', ti_zoom: 'false', ti_hover: 'none', ti_image_shadow: 'none', ti_filter: 'warm', ti_loading: 'eager', ti_text_align: 'justify', style_font_family: 'classic', style_font_size: 'lg', style_font_weight: '600', style_line_height: 'relaxed', ti_caption_align: 'right', ti_caption_italic: 'false', ti_caption_size: '.95rem', ti_caption_weight: '700', ti_caption_color: '#334155' } };
const twoImagesBlock: ContentBlock = { id: 'two-images-1', entity_type: 'home_page', entity_id: 0, block_type: 'two_images', sort_order: 0, content: { image_url_left: 'https://example.com/left.jpg', image_caption_left: 'Vista inicial', image_alt_left: 'Muestra inicial', image_url_right: 'https://example.com/right.jpg', image_caption_right: 'Vista final', image_alt_right: 'Muestra final', two_style: 'cards', two_bg: '#f0f9ff', two_ratio: 'left', two_aspect: 'portrait', two_fit: 'contain', two_image_bg: '#eef2ff', two_position_left: 'center top', two_position_right: 'right center', two_gap: '30', two_radius: '24', two_zoom: 'false', two_hover: 'none', two_shadow: 'none', two_filter: 'grayscale', two_loading: 'eager', two_caption_align: 'left', two_caption_italic: 'false', two_caption_size: '.95rem', two_caption_weight: '700', two_caption_color: '#334155', style_font_family: 'classic', style_line_height: 'relaxed' } };
const threeImagesBlock: ContentBlock = { id: 'three-images-1', entity_type: 'home_page', entity_id: 0, block_type: 'three_images', sort_order: 0, content: { image_url_1: 'https://example.com/one.jpg', image_caption_1: 'Primera vista', image_alt_1: 'Primera muestra', image_url_2: 'https://example.com/two.jpg', image_caption_2: 'Segunda vista', image_alt_2: 'Segunda muestra', image_url_3: 'https://example.com/three.jpg', image_caption_3: 'Tercera vista', image_alt_3: 'Tercera muestra', three_style: 'cards', three_layout: 'featured', three_bg: '#faf5ff', three_aspect: 'square', three_fit: 'contain', three_image_bg: '#f5f3ff', three_position_1: 'center top', three_position_2: 'left center', three_position_3: 'right center', three_gap: '24', three_radius: '22', three_zoom: 'false', three_hover: 'none', three_shadow: 'none', three_filter: 'cool', three_loading: 'eager', three_caption_align: 'right', three_caption_italic: 'false', three_caption_size: '.92rem', three_caption_weight: '600', three_caption_color: '#475569', style_font_family: 'classic', style_line_height: 'relaxed' } };
const carouselBlock: ContentBlock = { id: 'carousel-1', entity_type: 'home_page', entity_id: 0, block_type: 'carousel', sort_order: 0, content: { image_url_1: 'https://example.com/slide-one.jpg', image_cap_1: 'Primera diapositiva', image_alt_1: 'Vista panorámica inicial', image_url_3: 'https://example.com/slide-three.jpg', image_cap_3: 'Tercera diapositiva', image_alt_3: 'Vista panorámica final', auto: 'false', carousel_style: 'cinema', carousel_accent: '#8b5cf6', carousel_width: 'full', carousel_aspect: 'wide', carousel_fit: 'contain', carousel_position: 'center top', carousel_image_bg: '#111827', carousel_radius: '28', carousel_zoom: 'false', carousel_arrows: 'false', carousel_dots: 'false', carousel_shadow: 'deep', carousel_filter: 'vivid', carousel_loading: 'eager', carousel_caption_align: 'left', carousel_caption_italic: 'false', carousel_caption_size: '1rem', carousel_caption_weight: '700', carousel_caption_color: '#f8fafc', style_font_family: 'classic', style_line_height: 'relaxed', style_letter_spacing: 'wide', style_text_transform: 'uppercase' } };
const textCarouselBlock: ContentBlock = { id: 'text-carousel-1', entity_type: 'home_page', entity_id: 0, block_type: 'text_carousel', sort_order: 0, content: { text: 'Descripción editorial de la galería', image_url_1: 'https://example.com/gallery-one.jpg', image_cap_1: 'Detalle principal', image_alt_1: 'Detalle microscópico principal', image_position: 'left', ti_text_align: 'justify', tc_style: 'soft', tc_bg: '#eff6ff', tc_accent: '#2563eb', tc_gallery_width: '52', tc_vertical_align: 'end', tc_gap: '36', tc_radius: '26', tc_aspect: 'portrait', tc_fit: 'contain', tc_position: 'right center', tc_image_bg: '#dbeafe', tc_zoom: 'false', tc_arrows: 'false', tc_dots: 'false', tc_shadow: 'none', tc_filter: 'soft', tc_loading: 'eager', tc_caption_align: 'right', tc_caption_size: '.95rem', tc_caption_weight: '700', tc_caption_color: '#1e3a8a', style_font_family: 'classic', style_font_size: 'lg', style_font_weight: '600', style_line_height: 'relaxed', style_letter_spacing: 'wide' } };
const doubleCarouselBlock: ContentBlock = { id: 'double-carousel-1', entity_type: 'home_page', entity_id: 0, block_type: 'double_carousel', sort_order: 0, content: { left_image_url_1: 'https://example.com/left-one.jpg', left_image_cap_1: 'Galería izquierda', left_image_alt_1: 'Primera galería comparativa', left_image_url_3: 'https://example.com/left-three.jpg', right_image_url_1: 'https://example.com/right-one.jpg', right_image_cap_1: 'Galería derecha', right_image_alt_1: 'Segunda galería comparativa', auto: 'false', dc_style: 'cards', dc_bg: '#f5f3ff', dc_accent: '#8b5cf6', dc_ratio: 'right', dc_aspect: 'wide', dc_fit: 'contain', dc_position_left: 'left center', dc_position_right: 'right center', dc_image_bg: '#ede9fe', dc_gap: '32', dc_radius: '24', dc_zoom: 'false', dc_arrows: 'false', dc_dots: 'false', dc_shadow: 'none', dc_filter: 'warm', dc_loading: 'eager', dc_caption_align: 'left', dc_caption_size: '.95rem', dc_caption_weight: '700', dc_caption_color: '#4c1d95', style_font_family: 'classic', style_line_height: 'relaxed', style_letter_spacing: 'wide' } };

describe('ContentBlockRenderer', () => {
  it('mantiene el título a ancho completo aunque tenga fondo', () => {
    render(<ContentBlockRenderer blocks={[headingBlock]} />);

    const heading = screen.getByText('Título con fondo');
    const shell = heading.closest('.cb-shell');

    expect(shell).not.toBeNull();
    expect(shell).toHaveStyle({ width: '100%', maxWidth: '100%' });
  });

  it('aplica al título completo sus opciones tipográficas y su alineación', () => {
    render(<ContentBlockRenderer blocks={[{
      ...headingBlock,
      content: {
        ...headingBlock.content,
        text_align: 'right',
        style_font_family: 'classic',
        style_font_weight: '800',
        style_text_transform: 'uppercase',
      },
    }]} />);

    const heading = screen.getByText('Título con fondo').parentElement;
    expect(heading).toHaveStyle({
      textAlign: 'right',
      fontWeight: '800',
      textTransform: 'uppercase',
    });
    expect(heading?.style.fontFamily).toContain('Georgia');
  });

  it('aplica contorno al subtítulo cuando se selecciona esa decoración', () => {
    render(<ContentBlockRenderer blocks={[subheadingBlock]} />);

    const subheading = screen.getByText('Subtítulo con contorno');
    const shell = subheading.parentElement;

    expect(shell).not.toBeNull();
    expect(shell).toHaveStyle({ border: '2px solid #0ea5e9' });
    expect(shell).toHaveStyle({ padding: '0.38em 0.6em' });
  });

  it('mantiene el subtítulo a ancho completo y conserva la decoración al centrarlo', () => {
    render(<ContentBlockRenderer blocks={[centeredSubheadingBlock]} />);

    const subheading = screen.getByText('Subtítulo centrado');
    const decorated = subheading.parentElement;
    const shell = subheading.closest('.cb-shell');

    expect(shell).toHaveStyle({ width: '100%', maxWidth: '100%' });
    expect(decorated).toHaveStyle({
      textAlign: 'center',
      borderLeft: '4px solid #0ea5e9',
      borderRight: '4px solid #0ea5e9',
    });
  });

  it('respeta el espacio superior e inferior del párrafo', () => {
    render(<ContentBlockRenderer blocks={[paragraphBlock]} />);

    const paragraph = screen.getByText('Párrafo con aire');

    expect(paragraph.parentElement).toHaveStyle({ marginTop: '24px', marginBottom: '32px' });
  });

  it('mantiene el ancho completo y aplica la tipografía del párrafo', () => {
    render(<ContentBlockRenderer blocks={[{
      ...paragraphBlock,
      content: {
        ...paragraphBlock.content,
        style_align: 'center',
        style_max_width: 'full',
        style_bg: '#f8fafc',
        text_align: 'justify',
        text_columns: '2',
        style_line_height: 'relaxed',
        style_text_indent: '32',
      },
    }]} />);

    const paragraph = screen.getByText('Párrafo con aire');
    const shell = paragraph.closest('.cb-shell');
    expect(shell).toHaveStyle({ width: '100%', maxWidth: '100%' });
    expect(paragraph).toHaveStyle({ textAlign: 'justify', columnCount: '2', lineHeight: '1.85', textIndent: '32px' });
  });

  it('conserva el interlineado editorial cuando no se personaliza', () => {
    render(<ContentBlockRenderer blocks={[paragraphBlock]} />);
    expect(screen.getByText('Párrafo con aire')).toHaveStyle({ lineHeight: '1.8' });
  });

  it('respeta la tipografía global en la lista', () => {
    render(<ContentBlockRenderer blocks={[listBlock]} />);

    const item = screen.getByText('Uno');

    expect(item.parentElement?.style.fontFamily).toContain('Georgia');
  });

  it('mantiene la lista a ancho completo y aplica sus opciones de presentación', () => {
    render(<ContentBlockRenderer blocks={[{
      ...listBlock,
      content: {
        ...listBlock.content,
        style_align: 'center',
        style_max_width: 'full',
        style_bg: '#f8fafc',
        list_columns: '2',
        list_gap: '18',
        list_item_bg: '#fef3c7',
        list_item_border: '#f59e0b',
        text_align: 'right',
      },
    }]} />);

    const item = screen.getByText('Uno').parentElement;
    const list = item?.parentElement;
    const shell = list?.closest('.cb-shell');
    expect(shell).toHaveStyle({ width: '100%', maxWidth: '100%' });
    expect(list).toHaveAttribute('role', 'list');
    expect(list).toHaveStyle({ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '18px' });
    expect(item).toHaveAttribute('role', 'listitem');
    expect(item).toHaveStyle({ background: '#fef3c7', border: '1px solid #f59e0b', textAlign: 'right' });
  });

  it('permite configurar la tipografía de la publicación semanal', () => {
    render(<ContentBlockRenderer blocks={[weeklyBlock]} />);

    const title = screen.getByText('Semana tipográfica');

    expect(title.parentElement?.parentElement?.style.fontFamily).toContain('Georgia');
    expect(title.closest('.cb-shell')).toHaveStyle({ width: '100%', maxWidth: '100%' });
    expect(screen.getByAltText('Placa de la semana')).toHaveStyle({ objectFit: 'contain' });
  });

  it('mantiene la caja destacada a ancho completo y ordena verticalmente sus botones', () => {
    render(<ContentBlockRenderer blocks={[calloutBlock]} />);

    const message = screen.getByText('Mensaje importante');
    const callout = message.closest('[role="note"]');
    const shell = message.closest('.cb-shell');
    expect(shell).toHaveStyle({ width: '100%', maxWidth: '100%' });
    expect(callout).toHaveStyle({ display: 'grid', width: 'min(100%, 100%)', textAlign: 'center' });
    expect(screen.getByText('Atención personalizada')).toHaveStyle({ color: '#dc2626' });
    expect(screen.getByRole('link', { name: 'Leer más' })).toBeInTheDocument();
  });

  it('convierte la sección en un contenedor visual para los bloques siguientes', () => {
    render(<ContentBlockRenderer blocks={[sectionBlock, columnsBlock]} />);
    const group = screen.getByRole('region', { name: 'Grupo moderno' });
    expect(group).toHaveStyle({ background: '#faf5ff', gap: 'clamp(10px, 2vw, 16px)' });
    const children = group.querySelector('.cb-section-children');
    expect(children).toHaveStyle({ gap: '28px', borderLeft: '2px dashed #8b5cf6' });
    expect(screen.getByText('Unidad 1')).toBeInTheDocument();
  });

  it('permite terminar una sección sin crear otra y no publica el marcador', () => {
    const inside = { ...paragraphBlock, id: 'inside-section', sort_order: 1, content: { text: 'Dentro de la sección' } };
    const outside = { ...paragraphBlock, id: 'outside-section', sort_order: 3, content: { text: 'Fuera de la sección' } };
    render(<ContentBlockRenderer blocks={[sectionBlock, inside, sectionEndBlock, outside]} />);
    const region = screen.getByRole('region', { name: 'Grupo moderno' });
    expect(region).toHaveTextContent('Dentro de la sección');
    expect(region).not.toHaveTextContent('Fuera de la sección');
    expect(screen.queryByText('Fin de sección')).not.toBeInTheDocument();
  });

  it('presenta columnas comparativas con títulos, proporción y estilo configurables', () => {
    render(<ContentBlockRenderer blocks={[columnsBlock]} />);
    const grid = screen.getByText('Ventajas').closest('.cb-columns-row');
    expect(grid).toHaveStyle({ gridTemplateColumns: '2fr 1fr', gap: '30px', alignItems: 'stretch' });
    expect(screen.getByText('Contenido principal').parentElement).toHaveStyle({ background: '#eff6ff' });
  });

  it('renderiza componentes completos dentro de cada columna sin repetirlos afuera', () => {
    render(<ContentBlockRenderer blocks={[columnsBlock, nestedHeadingBlock, nestedParagraphBlock]} />);
    const container = screen.getByText('Componente en columna uno').closest('.cb-columns-container');
    expect(container).not.toBeNull();
    const slots = container?.querySelectorAll('.cb-column-slot');
    expect(slots).toHaveLength(2);
    expect(slots?.[0]).toHaveTextContent('Componente en columna uno');
    expect(slots?.[1]).toHaveTextContent('Componente en columna dos');
    expect(screen.getAllByText('Componente en columna uno')).toHaveLength(1);
  });

  it('renderiza separadores de guiones con color, grosor, ancho y espacio reales', () => {
    render(<ContentBlockRenderer blocks={[dividerBlock]} />);
    expect(screen.getByRole('separator')).toHaveStyle({ borderTop: '4px dashed #dc2626', width: '65%', margin: '32px auto' });
  });

  it('renderiza la imagen individual con ancho, alineación, marco y pie personalizados', () => {
    render(<ContentBlockRenderer blocks={[imageBlock]} />);
    const image = screen.getByAltText('Corte histológico del tejido');
    const wrapper = image.parentElement;
    expect(wrapper).toHaveStyle({ width: '55%', margin: '0 0 0 auto', borderRadius: '24px', cursor: 'default' });
    expect(wrapper).not.toHaveAttribute('role');
    expect(image).toHaveStyle({ width: '100%', objectFit: 'cover', objectPosition: 'center top', aspectRatio: '16 / 9', filter: 'saturate(1.22) contrast(1.06)' });
    const caption = screen.getByText('Detalle histológico').closest('figcaption');
    expect(caption).toHaveStyle({ color: '#ffffff', background: '#0f172a', textAlign: 'left', fontWeight: '600', lineHeight: '1.85', letterSpacing: '0.06em', textTransform: 'uppercase' });
    expect(caption?.style.fontFamily).toContain('Georgia');
    expect(caption).toHaveStyle({ inset: '10px 10px auto' });
  });

  it('mantiene el pie inferior alineado con el ancho real de la imagen', () => {
    render(<ContentBlockRenderer blocks={[{ ...imageBlock, id: 'image-caption-below', content: { ...imageBlock.content, caption: 'Pie alineado', image_caption_style: 'card', align: 'right', image_width: '55' } }]} />);
    const caption = screen.getByText('Pie alineado').closest('figcaption');
    expect(caption).toHaveStyle({ width: '55%', margin: '0 0 0 auto', boxSizing: 'border-box' });
  });

  it('tolera contenido publicado antiguo e imagenes rotas sin romper la vista publica', () => {
    render(<ContentBlockRenderer blocks={[{ ...imageBlock, id: 'legacy-public-image', content: { url: 'https://example.com/missing.jpg', caption: 'Imagen histórica', image_alt: 'Documento histórico', image_radius: 'valor-invalido', image_width: 'valor-invalido', image_loading: 'eager' } }]} />);
    const image = screen.getByAltText('Documento histórico');
    expect(image).toHaveAttribute('loading', 'eager');
    fireEvent.error(image);
    const fallback = screen.getByRole('img', { name: 'Documento histórico' });
    expect(fallback).toHaveTextContent('Imagen no disponible');
    expect(fallback.parentElement).toHaveStyle({ borderRadius: '18px' });
    expect(screen.getByText('Imagen histórica')).toBeInTheDocument();
  });

  it('renderiza texto con imagen respetando composicion, superficie y tipografia', () => {
    render(<ContentBlockRenderer blocks={[textImageBlock]} />);
    const image = screen.getByAltText('Detalle visual ampliado');
    const imageWrapper = image.parentElement;
    const row = image.closest('.cb-ti-row');
    const text = screen.getByText('Texto combinado verificable');
    expect(row).toHaveStyle({ flexDirection: 'row-reverse', alignItems: 'center', gap: '34px', background: '#f0f9ff', borderRadius: '26px' });
    expect(imageWrapper).not.toHaveAttribute('role');
    expect(imageWrapper).toHaveStyle({ cursor: 'default', boxShadow: 'none' });
    expect(image).toHaveStyle({ objectFit: 'contain', objectPosition: 'right center', aspectRatio: '4 / 3', background: '#eef2ff', filter: 'saturate(1.08) sepia(.12) contrast(1.02)' });
    expect(image).toHaveAttribute('loading', 'eager');
    expect(text).toHaveStyle({ textAlign: 'justify', fontWeight: '600', lineHeight: '1.85' });
    expect(text.style.fontFamily).toContain('Georgia');
    const caption = screen.getByText('Detalle ampliado').closest('figcaption');
    expect(caption).toHaveStyle({ textAlign: 'right', fontStyle: 'normal', color: '#334155', fontSize: '.95rem', fontWeight: '700', lineHeight: '1.85' });
    expect(caption?.style.fontFamily).toContain('Georgia');
  });

  it('mantiene texto con imagen estable en publico ante valores antiguos e imagen rota', () => {
    render(<ContentBlockRenderer blocks={[{ ...textImageBlock, id: 'legacy-text-image', content: { text: 'Contenido público conservado', image_url: 'https://example.com/missing-ti.jpg', image_caption: 'Referencia no disponible', ti_image_alt: 'Referencia histórica', ti_radius: 'invalido', ti_gap: 'invalido' } }]} />);
    const image = screen.getByAltText('Referencia histórica');
    fireEvent.error(image);
    expect(screen.getByRole('img', { name: 'Referencia histórica' })).toHaveTextContent('Imagen no disponible');
    expect(screen.getByText('Contenido público conservado').closest('.cb-ti-row')).toHaveStyle({ gap: '28px', borderRadius: '20px' });
    expect(screen.getByText('Referencia no disponible')).toBeInTheDocument();
  });

  it('renderiza dos imagenes como galeria dual totalmente configurable', () => {
    render(<ContentBlockRenderer blocks={[twoImagesBlock]} />);
    const left = screen.getByAltText('Muestra inicial');
    const right = screen.getByAltText('Muestra final');
    const row = left.closest('.cb-two-img-row');
    expect(row).toHaveStyle({ gridTemplateColumns: 'minmax(0, 1.35fr) minmax(0, .65fr)', gap: '30px' });
    expect(left.parentElement).not.toHaveAttribute('role');
    expect(left.parentElement).toHaveStyle({ aspectRatio: '4 / 5', cursor: 'default' });
    expect(left).toHaveStyle({ objectFit: 'contain', objectPosition: 'center top', background: '#eef2ff', filter: 'grayscale(1)' });
    expect(left).toHaveAttribute('loading', 'eager');
    expect(right).toHaveStyle({ objectPosition: 'right center' });
    expect(left.closest('figure')).toHaveStyle({ background: '#f0f9ff', borderRadius: '24px', boxShadow: 'none' });
    const caption = screen.getByText('Vista inicial').closest('figcaption');
    expect(caption).toHaveStyle({ textAlign: 'left', fontStyle: 'normal', color: '#334155', fontSize: '.95rem', fontWeight: '700', lineHeight: '1.85' });
    expect(caption?.style.fontFamily).toContain('Georgia');
  });

  it('mantiene la segunda imagen publica cuando la primera falla', () => {
    render(<ContentBlockRenderer blocks={[{ ...twoImagesBlock, id: 'legacy-two-images', content: { ...twoImagesBlock.content, two_gap: 'invalido', two_radius: 'invalido' } }]} />);
    const left = screen.getByAltText('Muestra inicial');
    fireEvent.error(left);
    expect(screen.getByRole('img', { name: 'Muestra inicial' })).toHaveTextContent('Imagen no disponible');
    expect(screen.getByAltText('Muestra final')).toBeInTheDocument();
    expect(screen.getByText('Vista inicial').closest('.cb-two-img-row')).toHaveStyle({ gap: '20px' });
    expect(screen.getByText('Vista inicial').closest('figure')).toHaveStyle({ borderRadius: '18px' });
  });

  it('renderiza tres imagenes con composicion, enfoque y acabado configurables', () => {
    render(<ContentBlockRenderer blocks={[threeImagesBlock]} />);
    const first = screen.getByAltText('Primera muestra');
    const second = screen.getByAltText('Segunda muestra');
    const third = screen.getByAltText('Tercera muestra');
    expect(first.closest('.cb-three-img-row')).toHaveStyle({ gridTemplateColumns: 'minmax(0, 1.5fr) repeat(2, minmax(0, .75fr))', gap: '24px' });
    expect(first.parentElement).not.toHaveAttribute('role');
    expect(first.parentElement).toHaveStyle({ aspectRatio: '1 / 1', cursor: 'default' });
    expect(first).toHaveStyle({ objectFit: 'contain', objectPosition: 'center top', background: '#f5f3ff', filter: 'saturate(.94) hue-rotate(8deg) contrast(1.03)' });
    expect(first).toHaveAttribute('loading', 'eager');
    expect(second).toHaveStyle({ objectPosition: 'left center' });
    expect(third).toHaveStyle({ objectPosition: 'right center' });
    expect(first.closest('figure')).toHaveStyle({ background: '#faf5ff', borderRadius: '22px', boxShadow: 'none' });
    const caption = screen.getByText('Primera vista').closest('figcaption');
    expect(caption).toHaveStyle({ textAlign: 'right', fontStyle: 'normal', color: '#475569', fontSize: '.92rem', fontWeight: '600', lineHeight: '1.85' });
    expect(caption?.style.fontFamily).toContain('Georgia');
  });

  it('conserva el resto del triptico publico cuando una imagen falla', () => {
    render(<ContentBlockRenderer blocks={[{ ...threeImagesBlock, id: 'legacy-three-images', content: { ...threeImagesBlock.content, three_gap: 'invalido', three_radius: 'invalido' } }]} />);
    fireEvent.error(screen.getByAltText('Segunda muestra'));
    expect(screen.getByRole('img', { name: 'Segunda muestra' })).toHaveTextContent('Imagen no disponible');
    expect(screen.getByAltText('Primera muestra')).toBeInTheDocument();
    expect(screen.getByAltText('Tercera muestra')).toBeInTheDocument();
    expect(screen.getByText('Primera vista').closest('.cb-three-img-row')).toHaveStyle({ gap: '18px' });
    expect(screen.getByText('Primera vista').closest('figure')).toHaveStyle({ borderRadius: '16px' });
  });

  it('renderiza la galeria deslizante y conserva imagenes despues de espacios vacios', () => {
    render(<ContentBlockRenderer blocks={[carouselBlock]} />);
    const first = screen.getByAltText('Vista panorámica inicial');
    const third = screen.getByAltText('Vista panorámica final');
    const figure = first.closest('.cb-carousel-figure');
    const player = first.closest('.cb-carousel-figure')?.firstElementChild;
    expect(figure).toHaveStyle({ maxWidth: '100%', width: '100%' });
    expect(player).toHaveStyle({ background: '#0f172a', borderRadius: '28px' });
    expect(first.parentElement).not.toHaveAttribute('role');
    expect(first.parentElement).toHaveStyle({ aspectRatio: '16 / 9', cursor: 'default' });
    expect(first).toHaveStyle({ objectFit: 'contain', objectPosition: 'center top', background: '#111827', filter: 'saturate(1.22) contrast(1.06)' });
    expect(first).toHaveAttribute('loading', 'eager');
    expect(third).toBeInTheDocument();
    expect(screen.queryByTitle('Anterior')).not.toBeInTheDocument();
    const caption = screen.getByText('Primera diapositiva').closest('figcaption');
    expect(caption).toHaveStyle({ textAlign: 'left', fontStyle: 'normal', color: '#f8fafc', fontSize: '1rem', fontWeight: '700', lineHeight: '1.85', letterSpacing: '0.06em', textTransform: 'uppercase' });
    expect(caption?.style.fontFamily).toContain('Georgia');
  });

  it('mantiene la galeria publica operativa cuando una diapositiva falla', () => {
    render(<ContentBlockRenderer blocks={[{ ...carouselBlock, id: 'legacy-carousel', content: { ...carouselBlock.content, interval: 'invalido', carousel_radius: 'invalido' } }]} />);
    fireEvent.error(screen.getByAltText('Vista panorámica inicial'));
    expect(screen.getByRole('img', { name: 'Vista panorámica inicial' })).toHaveTextContent('Imagen no disponible');
    expect(screen.getByAltText('Vista panorámica final')).toBeInTheDocument();
    expect(screen.getByText('Primera diapositiva').closest('.cb-carousel-figure')?.firstElementChild).toHaveStyle({ borderRadius: '20px' });
  });

  it('combina texto enriquecido y galeria con una composicion configurable', () => {
    render(<ContentBlockRenderer blocks={[textCarouselBlock]} />);
    const image = screen.getByAltText('Detalle microscópico principal');
    const row = image.closest('.cb-text-carousel');
    const gallery = image.closest('.cb-ti-figure');
    const text = screen.getByText('Descripción editorial de la galería');
    expect(row).toHaveStyle({ flexDirection: 'row', alignItems: 'flex-end', gap: '36px', background: '#eff6ff', borderRadius: '26px' });
    expect(gallery).toHaveStyle({ flex: '0 0 52%' });
    expect(image.parentElement).not.toHaveAttribute('role');
    expect(image.parentElement).toHaveStyle({ aspectRatio: '4 / 5', cursor: 'default' });
    expect(image).toHaveStyle({ objectFit: 'contain', objectPosition: 'right center', background: '#dbeafe', filter: 'saturate(.88) contrast(.94) brightness(1.04)' });
    expect(image).toHaveAttribute('loading', 'eager');
    expect(text).toHaveStyle({ textAlign: 'justify', fontWeight: '600', lineHeight: '1.85' });
    expect(text.style.fontFamily).toContain('Georgia');
    const caption = screen.getByText('Detalle principal').closest('figcaption');
    expect(caption).toHaveStyle({ textAlign: 'right', color: '#1e3a8a', fontSize: '.95rem', fontWeight: '700', lineHeight: '1.85', letterSpacing: '0.06em' });
    expect(caption?.style.fontFamily).toContain('Georgia');
  });

  it('conserva el texto publico cuando falla la galeria acompañante', () => {
    render(<ContentBlockRenderer blocks={[{ ...textCarouselBlock, id: 'legacy-text-carousel', content: { ...textCarouselBlock.content, tc_gallery_width: 'invalido', tc_gap: 'invalido', tc_radius: 'invalido' } }]} />);
    fireEvent.error(screen.getByAltText('Detalle microscópico principal'));
    expect(screen.getByRole('img', { name: 'Detalle microscópico principal' })).toHaveTextContent('Imagen no disponible');
    const text = screen.getByText('Descripción editorial de la galería');
    expect(text).toBeInTheDocument();
    expect(text.closest('.cb-text-carousel')).toHaveStyle({ gap: '28px', borderRadius: '20px' });
    expect(text.closest('.cb-text-carousel')?.querySelector('.cb-ti-figure')).toHaveStyle({ flex: '0 0 44%' });
  });

  it('coordina dos galerias con proporciones y enfoques independientes', () => {
    render(<ContentBlockRenderer blocks={[doubleCarouselBlock]} />);
    const left = screen.getByAltText('Primera galería comparativa');
    const right = screen.getByAltText('Segunda galería comparativa');
    const row = left.closest('.cb-double-carousel');
    expect(row).toHaveStyle({ gridTemplateColumns: 'minmax(0, .65fr) minmax(0, 1.35fr)', gap: '32px', background: '#f5f3ff', borderRadius: '30px' });
    expect(left.parentElement).not.toHaveAttribute('role');
    expect(left.parentElement).toHaveStyle({ aspectRatio: '16 / 9', cursor: 'default' });
    expect(left).toHaveStyle({ objectFit: 'contain', objectPosition: 'left center', background: '#ede9fe', filter: 'saturate(1.08) sepia(.12) contrast(1.02)' });
    expect(left).toHaveAttribute('loading', 'eager');
    expect(right).toHaveStyle({ objectPosition: 'right center' });
    const caption = screen.getByText('Galería izquierda').closest('figcaption');
    expect(caption).toHaveStyle({ textAlign: 'left', color: '#4c1d95', fontSize: '.95rem', fontWeight: '700', lineHeight: '1.85', letterSpacing: '0.06em' });
    expect(caption?.style.fontFamily).toContain('Georgia');
    expect(row?.querySelectorAll('img')).toHaveLength(3);
  });

  it('mantiene una galeria publica operativa cuando falla la otra', () => {
    render(<ContentBlockRenderer blocks={[{ ...doubleCarouselBlock, id: 'legacy-double-carousel', content: { ...doubleCarouselBlock.content, interval: 'invalido', dc_gap: 'invalido', dc_radius: 'invalido' } }]} />);
    fireEvent.error(screen.getByAltText('Primera galería comparativa'));
    expect(screen.getByRole('img', { name: 'Primera galería comparativa' })).toHaveTextContent('Imagen no disponible');
    expect(screen.getByAltText('Segunda galería comparativa')).toBeInTheDocument();
    const row = screen.getByText('Galería izquierda').closest('.cb-double-carousel');
    expect(row).toHaveStyle({ gap: '22px', borderRadius: '24px' });
  });
});
