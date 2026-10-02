// Módulos del menú que el administrador puede mostrar u ocultar por usuario (mismos ids que el backend)
export interface ModuloUI { id: string; label: string; roles: string[]; padre?: string }

export const MODULOS_UI: ModuloUI[] = [
  { id: 'punto-venta',         label: 'Punto de Venta',      roles: ['ADMIN', 'VENDEDOR'] },
  { id: 'historial-ventas',    label: 'Historial de Ventas', roles: ['ADMIN', 'VENDEDOR'] },
  { id: 'servicios',           label: 'Servicios Técnicos',  roles: ['ADMIN', 'VENDEDOR', 'TECNICO'] },
  { id: 'tecnicos',            label: 'Técnicos',            roles: ['ADMIN', 'VENDEDOR'], padre: 'servicios' },
  { id: 'historial-servicios', label: 'Historial de servicios', roles: ['ADMIN', 'VENDEDOR'], padre: 'servicios' },
  { id: 'clientes',            label: 'Clientes',            roles: ['ADMIN', 'VENDEDOR'] },
  { id: 'inventario',          label: 'Inventario',          roles: ['ADMIN', 'VENDEDOR', 'INVENTARIO'] },
]

export const modulosPorRol = (rol: string) => MODULOS_UI.filter(m => m.roles.includes(rol)).map(m => m.id)

export const ROL_LABEL: Record<string, string> = { ADMIN: 'Administrador', VENDEDOR: 'Vendedor', TECNICO: 'Técnico', INVENTARIO: 'Inventario' }
