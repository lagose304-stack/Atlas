import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { BlockType, ContentBlock } from '../../types/contentBlocks';
import ContentBlockRenderer from '../ContentBlockRenderer';
import ImageExpansionControl from '../page-editor/ImageExpansionControl';
import { createDefaultBlockContent, normalizeBlockContent } from './blockRegistry';
import { IMAGE_EXPANSION_FIELDS } from './imageExpansion';

vi.mock('../ImageViewerModal', () => ({ default: () => <div role="dialog">Visor de imagen</div> }));
vi.mock('../ExamWeekTestsCarousel', () => ({ default: () => null }));
vi.mock('embla-carousel-react', () => ({ default: () => [vi.fn(), undefined] }));
vi.mock('../../services/supabase', () => ({
  supabase: {
    from: () => {
      const query = { select: () => query, eq: () => query, ilike: () => query, limit: () => query, maybeSingle: async () => ({ data: null }) };
      return query;
    },
  },
}));

const types = Object.keys(IMAGE_EXPANSION_FIELDS) as BlockType[];
const photo = 'https://example.com/expansion.jpg';

function makeBlock(type: BlockType): ContentBlock {
  return {
    id: `expansion-${type}`, entity_type: 'home_page', entity_id: 0, sort_order: 0, block_type: type,
    content: {
      url: photo, image_url: photo, image_url_left: photo, image_url_right: photo,
      image_url_1: photo, image_url_2: photo, image_url_3: photo,
      image_1: photo, image_1_url: photo, left_image_url_1: photo, right_image_url_1: photo,
      function_image_url: photo, main_function_name: 'Función',
      items_count: '1', item_1_name: 'Tinción', item_1_image_url: photo, auto: 'false',
    },
  };
}

describe.each(types)('Ampliación en %s', (type) => {
  it('activa por defecto y conserva la preferencia desactivada al normalizar', () => {
    const field = IMAGE_EXPANSION_FIELDS[type]!;
    expect(createDefaultBlockContent(type)[field]).toBe('true');
    const block = makeBlock(type);
    const onChange = vi.fn();
    const { rerender } = render(<ImageExpansionControl block={block} onChange={onChange} />);
    const control = screen.getByRole('switch', { name: 'Permitir ampliación de imagen' });
    expect(control).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(control);
    expect(onChange).toHaveBeenCalledWith({ [field]: 'false' });
    block.content = normalizeBlockContent(type, { ...block.content, [field]: 'false' });
    rerender(<ImageExpansionControl block={block} onChange={onChange} />);
    expect(control).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(control);
    expect(onChange).toHaveBeenLastCalledWith({ [field]: 'true' });
  });

  it('abre con contenido anterior sin el ajuste y deja de abrir al desactivarlo', async () => {
    const block = makeBlock(type);
    const { container, unmount } = render(<ContentBlockRenderer blocks={[block]} />);
    const photoElement = container.querySelector('img');
    expect(photoElement).not.toBeNull();
    fireEvent.click(photoElement!);
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    unmount();

    const disabled = { ...block, content: { ...block.content, [IMAGE_EXPANSION_FIELDS[type]!]: 'false' } };
    const view = render(<ContentBlockRenderer blocks={[disabled]} />);
    for (const image of view.container.querySelectorAll('img')) {
      fireEvent.click(image);
      fireEvent.keyDown(image, { key: 'Enter' });
      fireEvent.keyDown(image, { key: ' ' });
    }
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('Ampliar')).not.toBeInTheDocument();
    expect(view.container.querySelector('.cb-zoom-trigger')).toBeNull();
  });
});
