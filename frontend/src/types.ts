export interface User {
  id: number
  nombre: string
  correo: string
  rol: { id: number; nombre: string; slug: string }
  // Permisos efectivos del rol (los mismos que valida la API); el menú y los botones se arman con esto
  permisos: string[]
  dosPasos?: boolean
  // Cómo llega el código del segundo paso: por mail o desde Google Authenticator
  dosPasosMetodo?: 'correo' | 'app' | null
  debeCambiarContrasena?: boolean
}
