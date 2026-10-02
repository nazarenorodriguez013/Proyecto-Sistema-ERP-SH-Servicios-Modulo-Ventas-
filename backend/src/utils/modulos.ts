// Módulos del menú que el administrador puede mostrar u ocultar por usuario. Cada rol solo puede recibir
// los que su rol permite: la lista decide qué se ve, y los permisos de la API siguen yendo por rol.
export const MODULOS = [
  { id: 'punto-venta',         roles: ['ADMIN', 'VENDEDOR'] },
  { id: 'historial-ventas',    roles: ['ADMIN', 'VENDEDOR'] },
  { id: 'servicios',           roles: ['ADMIN', 'VENDEDOR', 'TECNICO'] },
  { id: 'tecnicos',            roles: ['ADMIN', 'VENDEDOR'] },
  { id: 'historial-servicios', roles: ['ADMIN', 'VENDEDOR'] },
  { id: 'clientes',            roles: ['ADMIN', 'VENDEDOR'] },
  { id: 'inventario',          roles: ['ADMIN', 'VENDEDOR', 'INVENTARIO'] },
] as const;

export const modulosPorRol = (rol: string): string[] =>
  MODULOS.filter(m => (m.roles as readonly string[]).includes(rol)).map(m => m.id);

// Devuelve solo módulos conocidos y permitidos para el rol, sin repetidos
export const normalizarModulos = (modulos: unknown, rol: string): string[] => {
  if (!Array.isArray(modulos)) return modulosPorRol(rol);
  const permitidos = modulosPorRol(rol);
  return [...new Set(modulos.filter((m): m is string => typeof m === 'string' && permitidos.includes(m)))];
};
