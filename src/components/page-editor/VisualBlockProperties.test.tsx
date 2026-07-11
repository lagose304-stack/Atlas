import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import VisualBlockProperties from './VisualBlockProperties';
import type { ContentBlock } from '../../types/contentBlocks';

const headingBlock: ContentBlock = {
  id: 'block-1',
  entity_type: 'home_page',
  entity_id: 0,
  block_type: 'heading',
  sort_order: 0,
  content: { text: 'Título original', style_align: 'left' },
};

describe('panel visual de propiedades', () => {
  it('envía cambios de contenido al motor de bloques', () => {
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

    fireEvent.change(screen.getByPlaceholderText('Escribe aquí…'), { target: { value: 'Nuevo título' } });
    expect(onChange).toHaveBeenCalledWith({ text: 'Nuevo título' });
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
