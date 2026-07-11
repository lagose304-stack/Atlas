export type UserRole = 'Instructor' | 'Microscopía' | 'Administrador';

export type PermissionKey =
  | 'temario'
  | 'placas'
  | 'editar_paginas'
  | 'gestion_usuarios'
  | 'estadisticas';

const ROLE_PERMISSIONS: Record<UserRole, PermissionKey[]> = {
  Instructor: [],
  'Microscopía': ['temario', 'placas', 'editar_paginas'],
  Administrador: ['temario', 'placas', 'editar_paginas', 'gestion_usuarios', 'estadisticas'],
};

export const hasPermission = (role: UserRole | undefined, permission: PermissionKey): boolean => {
  if (!role || !Object.prototype.hasOwnProperty.call(ROLE_PERMISSIONS, role)) {
    return false;
  }
  return ROLE_PERMISSIONS[role].includes(permission);
};
