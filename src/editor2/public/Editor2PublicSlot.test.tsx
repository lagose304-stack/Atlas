import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEmptyCanvasDoc } from '../domain/defaults';
import type { Editor2PublicDoc } from '../services/editor2Api';
import Editor2PublicSlot from './Editor2PublicSlot';
import { Editor2PreviewDocProvider } from './previewDoc';
import { invalidatePublicDocCache } from './publicDocCache';

vi.mock('../render/Editor2Renderer', () => ({
  default: ({ doc, variant }: { doc: { pageKey: string }; variant?: string }) => (
    <div data-testid="mock-editor2-renderer" data-variant={variant}>
      Render v2: {doc.pageKey}
    </div>
  ),
}));

function makePublicDoc(pageKey: string, versionNumber = 2): Editor2PublicDoc {
  return {
    pageKey,
    versionId: `ver-${pageKey}-${versionNumber}`,
    versionNumber,
    publishedAt: '2026-11-19T12:00:00.000Z',
    doc: createEmptyCanvasDoc(pageKey),
  };
}

describe('Editor2PublicSlot y caché pública (Fase 3 — Parte 1)', () => {
  afterEach(() => {
    invalidatePublicDocCache();
    vi.restoreAllMocks();
  });

  it('renderiza Editor2Renderer en modo public cuando existe publicación v2', async () => {
    const loader = vi.fn().mockResolvedValue(makePublicDoc('tema-4', 3));
    const onResolved = vi.fn();

    render(
      <Editor2PublicSlot
        pageKey="tema-4"
        fallback={<div data-testid="v1-fallback">Contenido v1</div>}
        loadPublicDoc={loader}
        onResolved={onResolved}
      />,
    );

    const renderer = await screen.findByTestId('mock-editor2-renderer');
    expect(renderer).toHaveTextContent('Render v2: tema-4');
    expect(renderer).toHaveAttribute('data-variant', 'public');
    expect(screen.queryByTestId('v1-fallback')).not.toBeInTheDocument();
    expect(onResolved).toHaveBeenCalledWith(true);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('mantiene el fallback v1 cuando no hay publicación v2 (null)', async () => {
    const loader = vi.fn().mockResolvedValue(null);
    const onResolved = vi.fn();

    render(
      <Editor2PublicSlot
        pageKey="subtema-12"
        fallback={<div data-testid="v1-fallback">Contenido v1</div>}
        loadPublicDoc={loader}
        onResolved={onResolved}
      />,
    );

    await waitFor(() => {
      expect(onResolved).toHaveBeenCalledWith(false);
    });
    expect(screen.getByTestId('v1-fallback')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-editor2-renderer')).not.toBeInTheDocument();
  });

  it('cae silenciosamente al fallback v1 si la consulta falla (p. ej. RPC no desplegada)', async () => {
    const loader = vi.fn().mockRejectedValue(new Error('RPC not found'));
    const onResolved = vi.fn();

    render(
      <Editor2PublicSlot
        pageKey="home"
        fallback={<div data-testid="v1-fallback">Portada v1</div>}
        loadPublicDoc={loader}
        onResolved={onResolved}
      />,
    );

    await waitFor(() => {
      expect(onResolved).toHaveBeenCalledWith(false);
    });
    expect(screen.getByTestId('v1-fallback')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-editor2-renderer')).not.toBeInTheDocument();
  });

  it('reutiliza la caché en memoria y permite invalidarla tras publicar o despublicar', async () => {
    const loader = vi.fn().mockResolvedValue(makePublicDoc('temario', 1));

    const first = render(
      <Editor2PublicSlot
        pageKey="temario"
        fallback={<div>v1</div>}
        loadPublicDoc={loader}
      />,
    );
    await screen.findByTestId('mock-editor2-renderer');
    first.unmount();

    // Segundo montaje debe leer de caché sin volver a llamar al loader.
    const second = render(
      <Editor2PublicSlot
        pageKey="temario"
        fallback={<div>v1</div>}
        loadPublicDoc={loader}
      />,
    );
    await screen.findByTestId('mock-editor2-renderer');
    expect(loader).toHaveBeenCalledTimes(1);
    second.unmount();

    // Tras invalidar caché, vuelve a consultar y cae a v1 si fue despublicado.
    invalidatePublicDocCache('temario');
    loader.mockResolvedValueOnce(null);

    render(
      <Editor2PublicSlot
        pageKey="temario"
        fallback={<div data-testid="v1-fallback">Temario v1</div>}
        loadPublicDoc={loader}
      />,
    );
    await waitFor(() => {
      expect(loader).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByTestId('v1-fallback')).toBeInTheDocument();
  });

  it('muestra el borrador en memoria durante la vista previa real sin consultar publicación', async () => {
    const loader = vi.fn().mockResolvedValue(null);
    const draft = createEmptyCanvasDoc('home');

    render(
      <Editor2PreviewDocProvider value={{ pageKey: 'home', doc: draft }}>
        <Editor2PublicSlot
          pageKey="home"
          fallback={<div data-testid="v1-fallback">Contenido v1</div>}
          loadPublicDoc={loader}
        />
      </Editor2PreviewDocProvider>,
    );

    const renderer = await screen.findByTestId('mock-editor2-renderer');
    expect(renderer).toHaveTextContent('Render v2: home');
    expect(renderer).toHaveAttribute('data-variant', 'public');
    expect(screen.queryByTestId('v1-fallback')).not.toBeInTheDocument();
    expect(loader).not.toHaveBeenCalled();
  });
});
