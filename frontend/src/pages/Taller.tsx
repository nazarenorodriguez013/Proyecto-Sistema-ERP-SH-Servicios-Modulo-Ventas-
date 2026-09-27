import { useState } from 'react'
import type { User } from '../types'
import Tabs from '../components/Tabs'
import ServiciosTecnicos from './ServiciosTecnicos'
import Tecnicos from './Tecnicos'

// Servicios técnicos; el administrador además gestiona desde acá a los técnicos del taller
export default function Taller({ user }: { user: User }) {
  const [tab, setTab] = useState<'servicios' | 'tecnicos'>('servicios')

  if (user.rol !== 'ADMIN') return <ServiciosTecnicos user={user} />

  return (
    <div>
      <Tabs active={tab} onChange={setTab} tabs={[
        { id: 'servicios', label: 'Servicios', icon: 'bi-tools' },
        { id: 'tecnicos', label: 'Técnicos', icon: 'bi-person-gear' },
      ]} />
      {tab === 'servicios' ? <ServiciosTecnicos user={user} /> : <Tecnicos />}
    </div>
  )
}
