import { useState } from 'react'
import type { User } from '../types'
import Tabs from '../components/Tabs'
import Articulos from './Articulos'
import Categorias from './Categorias'
import RetiroRepuestos from './RetiroRepuestos'

// Artículos, stock y categorías en una sola pantalla: el stock se filtra y ajusta desde los artículos
export default function Inventario({ user }: { user: User }) {
  const [tab, setTab] = useState<'articulos' | 'categorias' | 'retiros'>('articulos')

  return (
    <div>
      <Tabs active={tab} onChange={setTab} tabs={[
        { id: 'articulos', label: 'Artículos y stock', icon: 'bi-clipboard' },
        { id: 'categorias', label: 'Categorías', icon: 'bi-tag' },
        { id: 'retiros', label: 'Retiro de repuestos', icon: 'bi-box-arrow-up-right' },
      ]} />
      {tab === 'articulos' && <Articulos user={user} />}
      {tab === 'categorias' && <Categorias user={user} />}
      {tab === 'retiros' && <RetiroRepuestos />}
    </div>
  )
}
