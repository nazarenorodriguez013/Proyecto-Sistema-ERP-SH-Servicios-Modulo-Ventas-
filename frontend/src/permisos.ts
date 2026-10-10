import type { User } from './types'

// ¿El usuario tiene alguno de estos permisos? (la API los vuelve a validar en cada pedido)
export const puede = (user: User, ...permisos: string[]) => permisos.some(p => user.permisos.includes(p))

export const SLUG_ADMIN = 'admin'
