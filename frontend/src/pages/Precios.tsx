import { useState, useEffect } from 'react'
import type { User } from '../types'
import { API } from '../config'

interface Categoria { id: number; nombre: string }
interface Producto { id: number; nombre: string; precio: number; activo: boolean; categoria: Categoria }


export default function Precios({ user }: { user: User }) {
  const [productos, setProductos] = useState<Producto[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<{ id: number; value: string } | null>(null)
  const [filterCat, setFilterCat] = useState('')
  const [search, setSearch] = useState('')

  const token = localStorage.getItem('token') ?? ''
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
  const isAdmin = user.rol === 'ADMIN'

  const fetchAll = async () => {
    const [pRes, cRes] = await Promise.all([
      fetch(`${API}/products`, { headers }),
      fetch(`${API}/categories`, { headers }),
    ])
    setProductos(await pRes.json())
    setCategorias(await cRes.json())
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  const handleSave = async (id: number) => {
    if (!editing) return
    await fetch(`${API}/products/${id}`, { method: 'PUT', headers, body: JSON.stringify({ precio: Number(editing.value) }) })
    setEditing(null)
    fetchAll()
  }

  const filtered = productos.filter(p => {
    if (filterCat && String(p.categoria.id) !== filterCat) return false
    if (search && !p.nombre.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  if (loading) return <div style={s.loading}>Cargando precios...</div>

  return (
    <div style={s.container}>
      <div style={s.header}>
        <div>
          <h2 style={s.title}>Precios</h2>
          <p style={s.subtitle}>{productos.length} productos</p>
        </div>
      </div>

      <div style={s.filters}>
        <input style={s.searchInput} placeholder="Buscar producto..." value={search} onChange={e => setSearch(e.target.value)} />
        <select style={s.select} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
          <option value="">Todas las categorías</option>
          {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>

      <div style={s.tableWrapper}>
        <table style={s.table}>
          <thead>
            <tr>{['Producto', 'Categoría', 'Precio actual', isAdmin ? 'Acciones' : ''].filter(Boolean).map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {filtered.length === 0
              ? <tr><td colSpan={4} style={s.empty}>No hay productos</td></tr>
              : filtered.map(p => (
                <tr key={p.id} style={{ ...s.tr, opacity: p.activo ? 1 : 0.5 }}>
                  <td style={s.td}><span style={s.name}>{p.nombre}</span></td>
                  <td style={s.td}><span style={s.catBadge}>{p.categoria.nombre}</span></td>
                  <td style={s.td}>
                    {isAdmin && editing?.id === p.id ? (
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <span style={s.currencySign}>$</span>
                        <input
                          style={s.adjustInput}
                          type="number" min="0" step="0.01"
                          value={editing.value}
                          onChange={e => setEditing({ id: p.id, value: e.target.value })}
                          autoFocus
                        />
                        <button style={s.btnSave} onClick={() => handleSave(p.id)}>✓</button>
                        <button style={s.btnCancel} onClick={() => setEditing(null)}>✕</button>
                      </div>
                    ) : (
                      <span style={s.price}>${p.precio.toFixed(2)}</span>
                    )}
                  </td>
                  {isAdmin && (
                    <td style={s.td}>
                      {editing?.id !== p.id && (
                        <button style={s.btnEdit} onClick={() => setEditing({ id: p.id, value: String(p.precio) })}>
                          Editar precio
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  container: { padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px' },
  loading: { color: '#9ca3af', padding: '40px', textAlign: 'center' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: '#fff', fontSize: '22px', fontWeight: '700', margin: 0 },
  subtitle: { color: '#6b7280', fontSize: '13px', margin: '4px 0 0' },
  filters: { display: 'flex', gap: '12px' },
  searchInput: { flex: 1, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '10px 14px', color: '#fff', fontSize: '14px', outline: 'none' },
  select: { background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '10px 14px', color: '#d1d5db', fontSize: '14px', outline: 'none', cursor: 'pointer' },
  tableWrapper: { background: '#111', border: '1px solid #1f1f1f', borderRadius: '12px', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '14px 16px', textAlign: 'left', color: '#6b7280', fontSize: '12px', fontWeight: '600', letterSpacing: '0.5px', background: '#0d0d0d', borderBottom: '1px solid #1f1f1f' },
  tr: { borderBottom: '1px solid #1a1a1a' },
  td: { padding: '14px 16px', color: '#d1d5db', fontSize: '14px' },
  empty: { padding: '40px', textAlign: 'center', color: '#4b5563' },
  name: { color: '#fff', fontWeight: '600' },
  catBadge: { background: '#1f2937', color: '#9ca3af', padding: '3px 10px', borderRadius: '20px', fontSize: '12px' },
  price: { color: '#eab308', fontWeight: '700', fontSize: '18px' },
  currencySign: { color: '#eab308', fontWeight: '700', fontSize: '16px' },
  adjustInput: { background: '#1a1a1a', border: '1px solid #eab308', borderRadius: '6px', padding: '6px 10px', color: '#fff', fontSize: '14px', outline: 'none', width: '100px' },
  btnSave: { background: '#22c55e', border: 'none', borderRadius: '6px', padding: '6px 10px', color: '#fff', fontWeight: '700', cursor: 'pointer', fontSize: '14px' },
  btnCancel: { background: '#374151', border: 'none', borderRadius: '6px', padding: '6px 10px', color: '#9ca3af', cursor: 'pointer', fontSize: '14px' },
  btnEdit: { background: '#1f2937', border: '1px solid #374151', borderRadius: '6px', padding: '6px 14px', color: '#d1d5db', fontSize: '13px', cursor: 'pointer' },
}
