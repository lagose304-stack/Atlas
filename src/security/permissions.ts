export type UserRole = 'Instructor' | 'Microscopía' | 'Administrador';

export type PermissionKey =
  | 'temario'
  | 'placas'
  | 'editar_paginas'
  | 'pruebas'
  | 'gestion_usuarios'
  | 'estadisticas';

const ROLE_PERMISSIONS: Record<UserRole, PermissionKey[]> = {
  Instructor: ['pruebas'],
  'Microscopía': ['temario', 'placas', 'editar_paginas', 'pruebas'],
  Administrador: ['temario', 'placas', 'editar_paginas', 'pruebas', 'gestion_usuarios', 'estadisticas'],
};

export const hasPermission = (role: UserRole | undefined, permission: PermissionKey): boolean => {
  if (!role) {
    return false;
  }
  return ROLE_PERMISSIONS[role].includes(permission);
};
