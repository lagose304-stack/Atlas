import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Home from './Home';
import { createDefaultBlockContent } from '../components/blocks/blockRegistry';

const mocks = vi.hoisted(() => ({ getBlocks: vi.fn() }));
vi.mock('../services/contentPublication', () => ({ getRenderableBlocks: mocks.getBlocks }));
vi.mock('../services/supabase', () => ({ supabase: { from: vi.fn() } }));
vi.mock('../components/Header', () => ({ default: () => null }));
vi.mock('../components/Footer', () => ({ default: () => null }));
vi.mock('../components/ChristmasCountdown', () => ({ default: () => null }));

describe('Datos histológicos publicados en el inicio', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    mocks.getBlocks.mockReset();
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('usa los datos de la versión publicada y muestra una sola sección', async () => {
    mocks.getBlocks.mockResolvedValue([{ id: 'facts', entity_type: 'home_page', entity_id: 0, block_type: 'weekly_histology_facts', sort_order: 0,
      content: { ...createDefaultBlockContent('weekly_histology_facts'), fact_1_title: 'Dato modificado en el editor' } }]);
    render(<MemoryRouter><Home /></MemoryRouter>);
    await screen.findByText('Dato modificado en el editor');
    expect(screen.getAllByRole('heading', { name: 'Datos histológicos de la semana' })).toHaveLength(1);
    expect(screen.queryByText('Tres formas de ver el hígado')).not.toBeInTheDocument();
  });

  it('respeta la ocultación publicada sin recuperar el bloque fijo anterior', async () => {
    mocks.getBlocks.mockResolvedValue([{ id: 'facts', entity_type: 'home_page', entity_id: 0, block_type: 'weekly_histology_facts', sort_order: 0,
      content: { ...createDefaultBlockContent('weekly_histology_facts'), facts_visible: 'false' } }]);
    render(<MemoryRouter><Home /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Datos histológicos de la semana' })).not.toBeInTheDocument());
  });
});
