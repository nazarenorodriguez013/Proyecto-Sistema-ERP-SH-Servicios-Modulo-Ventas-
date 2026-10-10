import type { User } from '../types'
import ConfigCuenta from './ConfigCuenta'

interface Sesion { token: string; user: User }

// "Mi perfil" del menú del usuario (como en el catálogo): nombre, correo, contraseña y verificación en dos pasos
export default function Perfil({ user, onUserUpdate }: { user: User; onUserUpdate: (s: Sesion) => void }) {
  return (
    <div className="admin-page">
      <div className="card-admin">
        <div className="card-admin__head">
          <h2><i className="bi bi-person" /> Mi perfil</h2>
          <span className="chip chip--neutral">{user.rol.nombre}</span>
        </div>
        <div className="card-admin__body">
          <ConfigCuenta user={user} onActualizado={onUserUpdate} />
        </div>
      </div>
    </div>
  )
}
