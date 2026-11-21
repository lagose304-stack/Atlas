import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createEmptyCanvasDoc } from '../domain/defaults';
import type { CanvasDoc } from '../domain/schema';
import Editor2RealPreview, { resolveEditor2PreviewPage } from './Editor2RealPreview';

vi.mock('../render/Editor2Renderer', () => ({
  default: ({ doc, variant }: { doc: { pageKey: string }; variant?: string }) => (
    <div data-testid="plain-renderer" data-variant={variant}>
      Contenido de {doc.pageKey}
    </div>
  ),
}));

vi.mock('../../pages/Home', () => ({
  default: () => <div data-testid="public-home">Portada pública</div>,
}));
vi.mock('../../pages/TemarioPublico', () => ({
  default: () => <div data-testid="public-temario">Temario público</div>,
}));
vi.mock('../../pages/Subtemas', async () => {
  const { useParams } = await import('react-router-dom');
  return {
    default: () => {
      const { temaId } = useParams();
      return <div data-testid="public-tema">Tema {temaId}</div>;
    },
  };
});
vi.mock('../../pages/PlacasSubtema', async () => {
  const { useParams } = await import('react-router-dom');
  return {
    default: () => {
      const { subtemaId } = useParams();
      return <div data-testid="public-subtema">Subtema {subtemaId}</div>;
    },
  };
});

describe('Editor2RealPreview', () => {
  function renderInEditor(doc: CanvasDoc) {
    return render(<Editor2RealPreview doc={doc} />);
  }

  it.each([
    ['home', '/', '/'],
    ['temario', '/temario', '/temario'],
    ['tema-7', '/subtemas/7', '/subtemas/:temaId'],
    ['subtema-12', '/ver-placas/12', '/ver-placas/:subtemaId'],
  ])('resuelve %s en la ruta pública %s con el patrón %s', (pageKey, path, pattern) => {
    const resolved = resolveEditor2PreviewPage(pageKey);
    expect(resolved?.path).toBe(path);
    expect(resolved?.pattern).toBe(pattern);
    expect(resolved?.Page).toBeDefined();
  });

  it('descarta claves sin integración pública', () => {
    expect(resolveEditor2PreviewPage('creditos')).toBeNull();
    expect(resolveEditor2PreviewPage('tema-')).toBeNull();
  });

  it('cae al render aislado cuando la página aún no se integra en público', () => {
    render(<Editor2RealPreview doc={createEmptyCanvasDoc('creditos')} />);

    expect(screen.getByRole('status')).toHaveTextContent(/todavía no se integra/);
    expect(screen.getByTestId('plain-renderer')).toHaveAttribute('data-variant', 'public');
  });

  it('monta la página pública directamente en la raíz de la vista previa', async () => {
    renderInEditor(createEmptyCanvasDoc('home'));

    expect(await screen.findByTestId('public-home')).toBeInTheDocument();
  });

  it('entrega los parámetros públicos al montar temas y subtemas', async () => {
    const { unmount } = renderInEditor(createEmptyCanvasDoc('tema-29'));
    expect(await screen.findByTestId('public-tema')).toHaveTextContent('Tema 29');
    unmount();

    renderInEditor(createEmptyCanvasDoc('subtema-36'));
    expect(await screen.findByTestId('public-subtema')).toHaveTextContent('Subtema 36');
  });
});
