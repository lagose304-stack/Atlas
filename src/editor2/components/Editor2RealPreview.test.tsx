import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createEmptyCanvasDoc } from '../domain/defaults';
import type { CanvasDoc } from '../domain/schema';
import Editor2RealPreview, { resolveEditor2PreviewPage } from './Editor2RealPreview';

vi.mock('../render/Editor2Renderer', () => ({
  default: ({ doc, variant }: { doc: { pageKey: string }; variant?: string }) => (
    <div data-testid="plain-renderer" data-variant={variant}>
      Contenido de {doc.pageKey}
      <div className="e2-block--button"><a className="e2-cta-btn" href="#destino">Ver destino</a></div>
      <div className="e2-block--exam-carousel">
        <button type="button" className="e2-exam-nav-btn">Siguiente prueba</button>
        <a className="e2-exam-card__cta" href="#prueba">Iniciar prueba</a>
      </div>
      <div className="e2-block--tabs">
        <button type="button" className="e2-tabs-nav__btn" role="tab">Segunda pestaña</button>
      </div>
      <div className="e2-block--accordion">
        <button type="button" className="e2-accordion-trigger">Abrir sección</button>
      </div>
      <button type="button">Otra acción</button>
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

  it('permite los controles de los bloques y bloquea las demás acciones', () => {
    renderInEditor(createEmptyCanvasDoc('creditos'));
    expect(fireEvent.click(screen.getByRole('link', { name: 'Ver destino' }))).toBe(true);
    expect(fireEvent.click(screen.getByRole('link', { name: 'Iniciar prueba' }))).toBe(true);
    expect(fireEvent.click(screen.getByRole('button', { name: 'Siguiente prueba' }))).toBe(true);
    expect(fireEvent.click(screen.getByRole('tab', { name: 'Segunda pestaña' }))).toBe(true);
    expect(fireEvent.click(screen.getByRole('button', { name: 'Abrir sección' }))).toBe(true);
    expect(fireEvent.click(screen.getByRole('button', { name: 'Otra acción' }))).toBe(false);
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
