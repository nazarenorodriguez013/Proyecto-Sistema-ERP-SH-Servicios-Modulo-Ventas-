import { useState } from 'react'
import type { User } from '../types'
import Tabs from '../components/Tabs'
import ConfigCuenta from './ConfigCuenta'
import ConfigUsuarios from './ConfigUsuarios'
import ConfigEmpresa from './ConfigEmpresa'

interface Sesion { token: string; user: User }
type Pestana = 'cuenta' | 'usuarios' | 'empresa'

// Cuenta propia para todos; usuarios y datos de la empresa solo para el administrador
export default function Configuracion({ user, onUserUpdate }: { user: User; onUserUpdate: (s: Sesion) => void }) {
  const esAdmin = user.rol === 'ADMIN'
  const [tab, setTab] = useState<Pestana>(esAdmin ? 'usuarios' : 'cuenta')

  return (
    <div>
      {esAdmin && (
        <Tabs active={tab} onChange={setTab} tabs={[
          { id: 'usuarios', label: 'Usuarios', icon: 'bi-people' },
          { id: 'empresa',  label: 'Datos de la empresa', icon: 'bi-building' },
          { id: 'cuenta',   label: 'Mi cuenta', icon: 'bi-person-gear' },
        ]} />
      )}
      <div className="page-container">
        {tab === 'usuarios' && esAdmin && <ConfigUsuarios yoId={user.id} />}
        {tab === 'empresa' && esAdmin && <ConfigEmpresa />}
        {tab === 'cuenta' && <ConfigCuenta user={user} onActualizado={onUserUpdate} />}
      </div>
    </div>
  )
}
