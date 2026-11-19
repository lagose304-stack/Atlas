import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createEmptyCanvasDoc,
  createPlacedBlock,
  createNestedCanvasNode,
} from '../domain/defaults';
import { useEditor2Store } from '../store/editor2Store';
import SaveBar from './SaveBar';

const ROOT_ID = '11111111-1111-4111-8111-111111111111';
const TEXT_ID = '22222222-2222-4222-8222-222222222222';

function loadDocWithChange() {
  useEditor2Store.getState().setDoc(createEmptyCanvasDoc('home', { id: ROOT_ID }));
  useEditor2Store
    .getState()
    .applyDoc(
      createEmptyCanvasDoc('home', {
        id: ROOT_ID,
        children: [createPlacedBlock(createNestedCanvasNode({ id: TEXT_ID }))],
      }),
    );
}

describe('SaveBar', () => {
  beforeEach(() => {
    useEditor2Store.getState().reset();
  });

  it('deshabilita deshacer y rehacer sin historial', () => {
    render(<SaveBar preview={false} onTogglePreview={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Deshacer' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Rehacer' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Borrador al día');
    expect(screen.getByRole('status')).toHaveTextContent('Sin publicar');
  });

  it('marca cambios sin guardar y permite deshacer y rehacer', () => {
    loadDocWithChange();
    render(<SaveBar preview={false} onTogglePreview={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Deshacer' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Rehacer' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Cambios sin guardar');

    fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }));
    expect(useEditor2Store.getState().doc?.root.slots.children).toEqual([]);
    expect(screen.getByRole('button', { name: 'Rehacer' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Rehacer' }));
    expect(useEditor2Store.getState().doc?.root.slots.children).toHaveLength(1);
  });

  it('alterna la vista previa', () => {
    const onTogglePreview = vi.fn();
    const { rerender } = render(<SaveBar preview={false} onTogglePreview={onTogglePreview} />);

    fireEvent.click(screen.getByRole('button', { name: /Vista previa/ }));
    expect(onTogglePreview).toHaveBeenCalledTimes(1);

    rerender(<SaveBar preview onTogglePreview={onTogglePreview} />);
    expect(screen.getByRole('button', { name: /Volver a editar/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('muestra los errores recuperables del lienzo', () => {
    useEditor2Store.getState().markSaveError('Documento inválido');

    render(<SaveBar preview={false} onTogglePreview={vi.fn()} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Documento inválido');
  });

  it('muestra estado En vivo v2, enlace al sitio y confirmación en 2 pasos para Volver a v1', () => {
    useEditor2Store.setState({
      publication: {
        pageKey: 'home',
        versionId: ROOT_ID,
        versionNumber: 4,
        label: 'Lanzamiento',
        actorId: null,
        publishedAt: '2026-11-19T12:00:00.000Z',
      },
    });
    const onUnpublish = vi.fn();

    render(
      <SaveBar
        preview={false}
        onTogglePreview={vi.fn()}
        onUnpublish={onUnpublish}
        publicSitePath="/"
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('En vivo v2 · v4');
    expect(screen.getByRole('link', { name: /Ver en sitio/i })).toHaveAttribute('href', '/');

    fireEvent.click(screen.getByRole('button', { name: /Volver a v1/i }));
    expect(onUnpublish).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Confirmar v1/i }));
    expect(onUnpublish).toHaveBeenCalledTimes(1);
  });
});
