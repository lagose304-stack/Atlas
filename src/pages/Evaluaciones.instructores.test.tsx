import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Evaluaciones from './Evaluaciones';

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock('../services/supabase', () => ({ supabase: mocks }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: null, isAuthenticated: false }) }));
vi.mock('../components/Header', () => ({ default: () => null }));
vi.mock('../components/Footer', () => ({ default: () => null }));
vi.mock('../services/contentPublication', () => ({ getRenderableBlocks: vi.fn().mockResolvedValue([]) }));
vi.mock('../services/catalogService', () => ({ getCachedTemas: vi.fn().mockResolvedValue([]) }));
vi.mock('../services/siteMaintenance', () => ({
  fetchSiteMaintenanceStatus: vi.fn().mockResolvedValue({ disabledFeatures: [] }),
  canBypassMaintenance: () => false, isFeatureDisabled: () => false,
  isParcialDisabled: () => false, isTemaDisabled: () => false,
}));

describe('Pruebas de instructores al final de evaluaciones', () => {
  beforeEach(() => {
    const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: ['primer', 'segundo', 'tercer'].map((parcial_key, index) => ({
        id: `partial-${index}`, nombre: `Prueba parcial ${index}`, instrucciones: '', scope: 'tema', parcial_key, created_at: '2026-11-14',
        mode: 'bank', bank_config: { general_count: 2, subtema_counts: {}, shuffle_options: true, shuffle_questions: true },
      })), error: null }),
    };
    mocks.from.mockReset().mockReturnValue(query);
    mocks.rpc.mockReset().mockResolvedValue({ data: [{ id: 'teacher-1', nombre: 'Evaluación docente', instrucciones: 'Lee atentamente.', question_count: 1 }], error: null });
  });

  it('coloca la sección de instructores después de la navegación y pruebas de parciales y enlaza al acceso con código', async () => {
    render(<MemoryRouter><Evaluaciones /></MemoryRouter>);
    const section = await screen.findByRole('heading', { name: 'Prueba de instructores' });
    for (const label of [/PRIMER PARCIAL/i, /SEGUNDO PARCIAL/i, /TERCER PARCIAL/i]) {
      const tab = screen.getByRole('button', { name: label });
      expect(tab.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    expect(screen.getByRole('link', { name: 'Realizar Evaluación docente' })).toHaveAttribute('href', '/evaluaciones/instructores/teacher-1');
    expect(mocks.rpc).toHaveBeenCalledWith('atlas_public_instructor_tests', undefined);
    expect(screen.queryByLabelText('Código de acceso')).not.toBeInTheDocument();
  });

  it('no presenta una sección vacía cuando no hay pruebas de instructores publicadas', async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });
    render(<MemoryRouter><Evaluaciones /></MemoryRouter>);
    await screen.findByRole('button', { name: /TERCER PARCIAL/i });
    expect(screen.queryByRole('heading', { name: 'Prueba de instructores' })).not.toBeInTheDocument();
  });

  it('conserva los parciales si falla la consulta de instructores', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: 'FETCH_ERROR' } });
    render(<MemoryRouter><Evaluaciones /></MemoryRouter>);
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar las pruebas de instructores');
    expect(screen.getByRole('button', { name: /TERCER PARCIAL/i })).toBeInTheDocument();
  });
});
