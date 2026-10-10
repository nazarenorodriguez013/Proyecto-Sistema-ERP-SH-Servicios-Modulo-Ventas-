// Permisos del sistema, agrupados por módulo como en "Roles" del panel del catálogo.
// Los roles guardan qué permisos tienen (tabla rol_permisos); el rol Administrador (slug "admin") los tiene siempre todos.
export const MODULOS_PERMISOS: { modulo: string; nombre: string; permisos: { clave: string; nombre: string }[] }[] = [
  {
    modulo: 'catalogo', nombre: 'Catálogo', permisos: [
      { clave: 'productos.ver',         nombre: 'Ver maquinaria y repuestos' },
      { clave: 'productos.editar',      nombre: 'Crear, editar y eliminar maquinaria y repuestos' },
      { clave: 'productos.costos',      nombre: 'Ver costos y ganancias' },
      { clave: 'categorias.gestionar',  nombre: 'Administrar categorías' },
    ],
  },
  {
    modulo: 'ventas', nombre: 'Ventas y clientes', permisos: [
      { clave: 'ventas.crear',          nombre: 'Registrar ventas (Punto de Venta)' },
      { clave: 'ventas.ver',            nombre: 'Ver el historial de ventas' },
      { clave: 'ventas.anular',         nombre: 'Anular ventas' },
      { clave: 'clientes.gestionar',    nombre: 'Ver, crear y editar clientes y registrar pagos' },
      { clave: 'clientes.eliminar',     nombre: 'Eliminar clientes y movimientos de cuenta corriente' },
    ],
  },
  {
    modulo: 'servicios', nombre: 'Servicio técnico', permisos: [
      { clave: 'servicios.gestionar',   nombre: 'Gestionar todos los servicios (registrar, asignar, finalizar e historial)' },
      { clave: 'servicios.tecnico',     nombre: 'Trabajar como técnico (se le pueden asignar servicios y ve los suyos)' },
      { clave: 'servicios.repuestos',   nombre: 'Cargar y quitar repuestos de un servicio' },
      { clave: 'servicios.eliminar',    nombre: 'Eliminar servicios' },
      { clave: 'tecnicos.ver',          nombre: 'Ver técnicos' },
      { clave: 'tecnicos.gestionar',    nombre: 'Crear, editar y eliminar técnicos' },
      { clave: 'retiros.gestionar',     nombre: 'Preparar y entregar retiros de repuestos' },
    ],
  },
  {
    modulo: 'gestion', nombre: 'Gestión', permisos: [
      { clave: 'datos.importar',        nombre: 'Importar datos' },
      { clave: 'datos.exportar',        nombre: 'Exportar datos' },
      { clave: 'configuracion.gestionar', nombre: 'Editar la configuración (datos de la empresa)' },
    ],
  },
  {
    modulo: 'seguridad', nombre: 'Seguridad', permisos: [
      { clave: 'usuarios.ver',          nombre: 'Ver usuarios' },
      { clave: 'usuarios.gestionar',    nombre: 'Crear, editar, desactivar y eliminar usuarios' },
      { clave: 'roles.gestionar',       nombre: 'Administrar roles y permisos' },
      { clave: 'auditoria.ver',         nombre: 'Ver el registro de auditoría' },
    ],
  },
];

export const TODOS_LOS_PERMISOS = MODULOS_PERMISOS.flatMap(m => m.permisos.map(p => p.clave));

export const SLUG_ADMIN = 'admin';

type RolConPermisos = { slug: string; activo: boolean; permisos: { permiso: string }[] };

// Permisos efectivos de un rol: el Administrador todos; un rol desactivado, ninguno
export const permisosDeRol = (rol: RolConPermisos): string[] => {
  if (rol.slug === SLUG_ADMIN) return TODOS_LOS_PERMISOS;
  if (!rol.activo) return [];
  return rol.permisos.map(p => p.permiso).filter(p => TODOS_LOS_PERMISOS.includes(p));
};

// Solo se guardan claves conocidas y sin repetir
export const normalizarPermisos = (permisos: unknown): string[] =>
  Array.isArray(permisos) ? [...new Set(permisos.filter((p): p is string => typeof p === 'string' && TODOS_LOS_PERMISOS.includes(p)))] : [];
