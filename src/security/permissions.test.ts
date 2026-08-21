import { describe, expect, it } from 'vitest';
import { hasPermission, type PermissionKey, type UserRole } from './permissions';

const permissions: PermissionKey[] = [
  'temario', 'placas', 'editar_paginas', 'gestion_usuarios', 'estadisticas', 'auditoria',
];

describe('permisos por rol', () => {
  it('reserva usuarios, estadísticas y auditoría para Administrador', () => {
    expect(hasPermission('Administrador', 'gestion_usuarios')).toBe(true);
    expect(hasPermission('Administrador', 'estadisticas')).toBe(true);
    expect(hasPermission('Administrador', 'auditoria')).toBe(true);
    expect(hasPermission('Microscopía', 'gestion_usuarios')).toBe(false);
    expect(hasPermission('Microscopía', 'auditoria')).toBe(false);
  });

  it('permite edición académica a Microscopía', () => {
    expect(hasPermission('Microscopía', 'temario')).toBe(true);
    expect(hasPermission('Microscopía', 'placas')).toBe(true);
    expect(hasPermission('Microscopía', 'editar_paginas')).toBe(true);
  });

  it('no concede permisos administrativos a Instructor ni a una sesión sin rol', () => {
    for (const permission of permissions) {
      expect(hasPermission('Instructor', permission)).toBe(false);
      expect(hasPermission(undefined, permission)).toBe(false);
    }
  });

  it('rechaza combinaciones de roles no contempladas por el tipo', () => {
    expect(hasPermission('Visitante' as UserRole, 'temario')).toBe(false);
  });
});
