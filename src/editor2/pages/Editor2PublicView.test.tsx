import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createEmptyCanvasDoc,
  createHeadingBlock,
  createLeafPlacedBlock,
  createNestedCanvasNode,
  createPlacedBlock,
} from '../domain/defaults';
import Editor2PublicView, { clearEditor2PublicCache } from './Editor2PublicView';

vi.mock('../../components/Header', () => ({ default: () => <header>Header</header> }));
vi.mock('../../components/Footer', () => ({ default: () => <footer>Footer</footer> }));
vi.mock('../render/Editor2Renderer', () => ({
  default: ({ doc }: { doc: { pageKey: string; root: { slots: { children: Array<{ block: { slots?: { children?: Array<{ block: { props?: { text?: { value?: string } } } }> } } }> } } } }) => {
    const firstText = doc.root.slots.children[0]?.block.slots?.children?.[0]?.block.props?.text?.value;
    return <div data-testid="public-renderer"><h1>{firstText ?? doc.pageKey}</h1></div>;
  },
}));

const ROOT_ID = '11111111-1111-4111-8111-111111111111';
const CANVAS_ID = '22222222-2222-4222-8222-222222222222';
const HEADING_ID = '33333333-3333-4333-8333-333333333333';
const VERSION_ID = '44444444-4444-4444-8444-444444444444';

describe('Editor2PublicView', () => {
  beforeEach(() => {
    clearEditor2PublicCache();
  });

  it('muestra la versión publicada en /vista-v2/:pageKey sin sesión', async () => {
    const doc = createEmptyCanvasDoc('home', {
      id: ROOT_ID,
      children: [
        createPlacedBlock(
          createNestedCanvasNode({
            id: CANVAS_ID,
            children: [
              createLeafPlacedBlock(createHeadingBlock({ id: HEADING_ID, level: 1, text: 'Atlas Publicado' }), 12),
            ],
          }),
        ),
      ],
    });
    const loadPublicDoc = vi.fn(async () => ({
      pageKey: 'home',
      versionId: VERSION_ID,
      versionNumber: 2,
      publishedAt: '2026-11-18T20:00:00.000Z',
      doc,
    }));

    render(
      <MemoryRouter initialEntries={['/vista-v2/home']}>
        <Routes>
          <Route path="/vista-v2/:pageKey" element={<Editor2PublicView loadPublicDoc={loadPublicDoc} />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { level: 1, name: 'Atlas Publicado' })).toBeInTheDocument();
    expect(loadPublicDoc).toHaveBeenCalledWith('home');
  });

  it('muestra estado vacío explícito cuando no existe publicación y nunca hace fallback a borrador', async () => {
    const loadPublicDoc = vi.fn(async () => null);

    render(
      <MemoryRouter initialEntries={['/vista-v2/tema-1']}>
        <Routes>
          <Route path="/vista-v2/:pageKey" element={<Editor2PublicView loadPublicDoc={loadPublicDoc} />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { level: 1, name: 'Sin versión publicada' })).toBeInTheDocument();
    expect(screen.getByText(/Los borradores nunca se muestran públicamente/i)).toBeInTheDocument();
  });

  it('rechaza claves inválidas sin llamar al servidor', async () => {
    const loadPublicDoc = vi.fn(async () => null);

    render(
      <MemoryRouter initialEntries={['/vista-v2/INVALIDA_MAYUS']}>
        <Routes>
          <Route path="/vista-v2/:pageKey" element={<Editor2PublicView loadPublicDoc={loadPublicDoc} />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(loadPublicDoc).not.toHaveBeenCalled();
  });
});
