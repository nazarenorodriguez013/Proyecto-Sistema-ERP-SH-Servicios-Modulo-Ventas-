import { useState } from 'react'
import type { User } from '../types'
import Tabs from '../components/Tabs'
import Articulos from './Articulos'
import Categorias from './Categorias'

// Artículos, stock y categorías en una sola pantalla: el stock se filtra y ajusta desde los artículos
export default function Inventario({ user }: { user: User }) {
  const [tab, setTab] = useState<'articulos' | 'categorias'>('articulos')

  return (
    <div>
      <Tabs active={tab} onChange={setTab} tabs={[
        { id: 'articulos', label: 'Artículos y stock', icon: 'bi-clipboard' },
        { id: 'categorias', label: 'Categorías', icon: 'bi-tag' },
      ]} />
      {tab === 'articulos' ? <Articulos user={user} /> : <Categorias user={user} />}
    </div>
  )
}
