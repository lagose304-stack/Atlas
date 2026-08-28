import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MaintenanceGate from './MaintenanceGate';
import type { SiteMaintenanceStatus } from '../services/siteMaintenance';

const authState = vi.hoisted(() => ({
  current: {
    isAuthenticated: false,
    isLoading: false,
    user: null as null | { id: number; username: string; rol: 'Administrador' | 'Microscopía' | 'Instructor'; is_protected?: boolean },
  },
}));

const maintenanceStatusState = vi.hoisted(() => ({
  current: {
    enabled: false,
    message: 'El sitio se encuentra temporalmente fuera de servicio por mantenimiento.',
    bannerEnabled: false,
    bannerMessage: '',
    disabledFeatures: [] as string[],
    updatedAt: new Date().toISOString(),
  } as SiteMaintenanceStatus,
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => authState.current,
}));

vi.mock('../services/siteMaintenance', () => ({
  fetchSiteMaintenanceStatus: vi.fn(async () => maintenanceStatusState.current),
}));

describe('MaintenanceGate', () => {
  beforeEach(() => {
    authState.current = { isAuthenticated: false, isLoading: false, user: null };
    maintenanceStatusState.current = {
      enabled: false,
      message: 'El sitio se encuentra temporalmente fuera de servicio por mantenimiento.',
      bannerEnabled: false,
      bannerMessage: '',
      disabledFeatures: [],
      updatedAt: new Date().toISOString(),
    };
  });

  it('muestra el contenido normal cuando el mantenimiento está desactivado', async () => {
    render(
      <MemoryRouter>
        <MaintenanceGate>
          <div>Contenido del Atlas</div>
        </MaintenanceGate>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Contenido del Atlas')).toBeInTheDocument();
  });

  it('bloquea a usuarios no autenticados cuando el mantenimiento está activado', async () => {
    maintenanceStatusState.current.enabled = true;

    render(
      <MemoryRouter>
        <MaintenanceGate>
          <div>Contenido del Atlas</div>
        </MaintenanceGate>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Sitio en mantenimiento')).toBeInTheDocument();
    expect(screen.queryByText('Contenido del Atlas')).not.toBeInTheDocument();
  });

  it('bloquea a usuarios con rol Instructor cuando el mantenimiento está activado', async () => {
    maintenanceStatusState.current.enabled = true;
    authState.current = {
      isAuthenticated: true,
      isLoading: false,
      user: { id: 2, username: 'instructor1', rol: 'Instructor' },
    };

    render(
      <MemoryRouter>
        <MaintenanceGate>
          <div>Contenido del Atlas</div>
        </MaintenanceGate>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Sitio en mantenimiento')).toBeInTheDocument();
    expect(screen.queryByText('Contenido del Atlas')).not.toBeInTheDocument();
  });

  it('permite el acceso a usuarios con rol Microscopía durante el mantenimiento', async () => {
    maintenanceStatusState.current.enabled = true;
    authState.current = {
      isAuthenticated: true,
      isLoading: false,
      user: { id: 3, username: 'microscopia1', rol: 'Microscopía' },
    };

    render(
      <MemoryRouter>
        <MaintenanceGate>
          <div>Contenido del Atlas</div>
        </MaintenanceGate>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Contenido del Atlas')).toBeInTheDocument();
    expect(screen.queryByText('Sitio en mantenimiento')).not.toBeInTheDocument();
  });

  it('permite el acceso a usuarios con rol Administrador durante el mantenimiento', async () => {
    maintenanceStatusState.current.enabled = true;
    authState.current = {
      isAuthenticated: true,
      isLoading: false,
      user: { id: 1, username: 'admin1', rol: 'Administrador' },
    };

    render(
      <MemoryRouter>
        <MaintenanceGate>
          <div>Contenido del Atlas</div>
        </MaintenanceGate>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Contenido del Atlas')).toBeInTheDocument();
    expect(screen.queryByText('Sitio en mantenimiento')).not.toBeInTheDocument();
  });
});
