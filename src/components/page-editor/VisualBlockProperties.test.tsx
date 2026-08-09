import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import VisualBlockProperties from './VisualBlockProperties';
import type { ContentBlock } from '../../types/contentBlocks';

vi.mock('../../services/supabase', () => ({
  supabase: { from: vi.fn() },
}));

const headingBlock: ContentBlock = {
  id: 'block-1',
  entity_type: 'home_page',
  entity_id: 0,
  block_type: 'heading',
  sort_order: 0,
  content: { text: 'Título original', style_align: 'left' },
};

describe('panel visual de propiedades', () => {
  it('envía cambios de contenido enriquecido al motor de bloques', async () => {
    const onChange = vi.fn();
    render(
      <VisualBlockProperties
        block={headingBlock}
        onChange={onChange}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
        onPickImage={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const editable = screen.getByRole('textbox', { name: 'Texto' });
    editable.innerHTML = '<p>Nuevo título</p>';
    fireEvent.input(editable);

    await waitFor(() => expect(onChange).toHaveBeenCalledWith({ text: '<p>Nuevo título</p>' }));
  });

  it('expone acciones claras para duplicar y eliminar', () => {
    const onDuplicate = vi.fn();
    const onDelete = vi.fn();
    render(
      <VisualBlockProperties
        block={headingBlock}
        onChange={vi.fn()}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        onPickImage={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Duplicar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    expect(onDuplicate).toHaveBeenCalledOnce();
    expect(onDelete).toHaveBeenCalledOnce();
  });
});
