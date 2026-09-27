import { useState, useEffect } from 'react'
import type { User } from '../types'
import { API } from '../config'
import ClienteDetalle from './ClienteDetalle'
import ClienteFormModal from '../components/ClienteFormModal'
import { describirSaldo } from '../saldo'

interface Cliente {
  id: number; nombre: string; documento: string | null; telefono: string | null; saldo: number
}

export default function Clientes({ user }: { user: User }) {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [creando, setCreando] = useState(false)
  const [verCliente, setVerCliente] = useState<number | null>(null)

  const headers = { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` }

  const fetchAll = () =>
    fetch(`${API}/clients`, { headers })
      .then(r => r.json())
      .then(data => { setClientes(data); setLoading(false) })

  useEffect(() => { fetchAll() }, [])

  const filtered = clientes.filter(c => {
    if (!search) return true
    const q = search.toLowerCase()
    return c.nombre.toLowerCase().includes(q) || (c.documento?.toLowerCase().includes(q))
  })

  if (verCliente !== null) {
    return <ClienteDetalle clienteId={verCliente} user={user} onBack={() => { setVerCliente(null); fetchAll() }} />
  }

  if (loading) return <div style={s.loading}>Cargando clientes...</div>

  return (
    <div className="page-container">
      <div className="page-header">
        <p style={s.subtitle}>{filtered.length} de {clientes.length} clientes · tocá un cliente para ver su cuenta</p>
        <button style={s.btnPrimary} onClick={() => setCreando(true)}><i className="bi bi-plus-lg" /> Nuevo cliente</button>
      </div>

      <input style={s.searchInput} placeholder="Buscar por nombre o documento..."
        value={search} onChange={e => setSearch(e.target.value)} />

      {filtered.length === 0
        ? <div style={s.empty}>No hay clientes que coincidan con la búsqueda</div>
        : (
          <div style={s.grid}>
            {filtered.map(c => (
              <button key={c.id} style={s.card} onClick={() => setVerCliente(c.id)}>
                <div style={s.cardIcon}><i className="bi bi-person" /></div>
                <div style={s.cardBody}>
                  <p style={s.cardName}>{c.nombre}</p>
                  <p style={s.cardSub}>{c.documento || c.telefono || 'Sin datos de contacto'}</p>
                </div>
                <div style={{ ...s.saldoBadge, color: describirSaldo(c.saldo).color }}>
                  {describirSaldo(c.saldo).texto}
                </div>
                <i className="bi bi-chevron-right" style={s.chevron} />
              </button>
            ))}
          </div>
        )
      }

      {creando && (
        <ClienteFormModal
          onClose={() => setCreando(false)}
          onSaved={cliente => { setCreando(false); setVerCliente(cliente.id) }}
        />
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  loading:      { color: '#6B6B6B', padding: '40px', textAlign: 'center' },
  subtitle:     { color: '#6B6B6B', fontSize: '13px', margin: 0 },
  searchInput:  { background: '#FFFFFF', border: '1px solid #D3D3D3', borderRadius: '8px', padding: '9px 14px', color: '#111111', fontSize: '14px', outline: 'none', width: '100%', boxSizing: 'border-box' as const, maxWidth: '340px' },

  empty:        { color: '#6B6B6B', textAlign: 'center', padding: '60px', background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E4E8' },
  grid:         { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' },
  card:         { background: '#FFFFFF', border: '1px solid #E2E4E8', borderRadius: '12px', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', textAlign: 'left', font: 'inherit' },
  cardIcon:     { fontSize: '18px', flexShrink: 0, width: '40px', height: '40px', background: '#F5F5F5', color: '#111111', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  cardBody:     { flex: 1, minWidth: 0 },
  cardName:     { color: '#111111', fontWeight: '600', fontSize: '14px', margin: 0 },
  cardSub:      { color: '#6B6B6B', fontSize: '12px', margin: '3px 0 0' },
  saldoBadge:   { fontWeight: '800', fontSize: '14px', flexShrink: 0 },
  chevron:      { color: '#9A9A9A', fontSize: '12px' },

  btnPrimary:   { background: '#F5C400', color: '#111111', border: 'none', borderRadius: '8px', padding: '9px 18px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' },
}
