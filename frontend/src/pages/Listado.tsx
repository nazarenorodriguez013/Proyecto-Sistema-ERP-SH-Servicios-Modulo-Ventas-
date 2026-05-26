import { useState, useEffect } from 'react'
import type { User } from '../types'
import { API } from '../config'

interface Categoria { id: number; nombre: string }
interface Producto {
  id: number; nombre: string; descripcion: string | null
  precio: number; stock: number; stockMinimo: number
  activo: boolean; categoria: Categoria
}


export default function Listado({ user }: { user: User }) {
  const [productos, setProductos] = useState<Producto[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const token = localStorage.getItem('token') ?? ''
  const headers = { Authorization: `Bearer ${token}` }

  useEffect(() => {
    Promise.all([
      fetch(`${API}/products`, { headers }).then(r => r.json()),
      fetch(`${API}/categories`, { headers }).then(r => r.json()),
    ]).then(([prods, cats]) => {
      setProductos(prods); setCategorias(cats); setLoading(false)
    })
  }, [])

  const filtered = productos.filter(p => {
    if (filterCat && String(p.categoria.id) !== filterCat) return false
    if (filterStatus === 'active' && !p.activo) return false
    if (filterStatus === 'inactive' && p.activo) return false
    if (filterStatus === 'low' && !(p.activo && p.stock <= p.stockMinimo)) return false
    if (search && !p.nombre.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const handlePrint = () => window.print()

  if (loading) return <div style={s.loading}>Cargando listado...</div>

  return (
    <div style={s.container}>
      <div style={s.header}>
        <div>
          <h2 style={s.title}>Listado de Productos</h2>
          <p style={s.subtitle}>{filtered.length} de {productos.length} productos</p>
        </div>
        <button style={s.btnPrint} onClick={handlePrint}>🖨️ Imprimir</button>
      </div>

      <div style={s.filters}>
        <input style={s.searchInput} placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
        <select style={s.select} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
          <option value="">Todas las categorías</option>
          {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <select style={s.select} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
          <option value="low">Stock bajo</option>
        </select>
      </div>

      <div style={s.tableWrapper}>
        <table style={s.table}>
          <thead>
            <tr>
              {['#', 'Artículo', 'Descripción', 'Categoría', 'Precio', 'Stock', 'Stock mín.', 'Estado'].map(h => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0
              ? <tr><td colSpan={8} style={s.empty}>No hay productos que coincidan</td></tr>
              : filtered.map(p => {
                const stockStatus = p.stock === 0 ? 'out' : p.stock <= p.stockMinimo ? 'low' : 'ok'
                return (
                  <tr key={p.id} style={{ ...s.tr, opacity: p.activo ? 1 : 0.6 }}>
                    <td style={{ ...s.td, color: '#4b5563' }}>#{p.id}</td>
                    <td style={s.td}><span style={s.name}>{p.nombre}</span></td>
                    <td style={s.td}><span style={s.desc}>{p.descripcion || '—'}</span></td>
                    <td style={s.td}><span style={s.catBadge}>{p.categoria.nombre}</span></td>
                    <td style={s.td}><span style={s.price}>${p.precio.toFixed(2)}</span></td>
                    <td style={s.td}>
                      <span style={{ fontWeight: '700', color: stockStatus === 'out' ? '#ef4444' : stockStatus === 'low' ? '#f59e0b' : '#22c55e' }}>
                        {p.stock}
                      </span>
                    </td>
                    <td style={{ ...s.td, color: '#6b7280' }}>{p.stockMinimo}</td>
                    <td style={s.td}>
                      <span style={{ ...s.badge, ...(p.activo ? s.badgeOn : s.badgeOff) }}>
                        {p.activo ? 'Activo' : 'Inactivo'}
                      </span>
                      {stockStatus === 'low' && <span style={{ ...s.badge, ...s.badgeLow, marginLeft: '4px' }}>⚠️</span>}
                      {stockStatus === 'out' && <span style={{ ...s.badge, ...s.badgeOut, marginLeft: '4px' }}>🔴</span>}
                    </td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>

      <p style={s.footer}>
        Generado el {new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} — Usuario: {user.nombre}
      </p>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  container: { padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px' },
  loading: { color: '#9ca3af', padding: '40px', textAlign: 'center' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: '#fff', fontSize: '22px', fontWeight: '700', margin: 0 },
  subtitle: { color: '#6b7280', fontSize: '13px', margin: '4px 0 0' },
  filters: { display: 'flex', gap: '12px', flexWrap: 'wrap' },
  searchInput: { flex: 1, minWidth: '200px', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '10px 14px', color: '#fff', fontSize: '14px', outline: 'none' },
  select: { background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '10px 14px', color: '#d1d5db', fontSize: '14px', outline: 'none', cursor: 'pointer' },
  btnPrint: { background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', padding: '10px 20px', color: '#d1d5db', fontSize: '14px', cursor: 'pointer' },
  tableWrapper: { background: '#111', border: '1px solid #1f1f1f', borderRadius: '12px', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '14px 16px', textAlign: 'left', color: '#6b7280', fontSize: '12px', fontWeight: '600', letterSpacing: '0.5px', background: '#0d0d0d', borderBottom: '1px solid #1f1f1f' },
  tr: { borderBottom: '1px solid #1a1a1a' },
  td: { padding: '12px 16px', color: '#d1d5db', fontSize: '14px' },
  empty: { padding: '40px', textAlign: 'center', color: '#4b5563' },
  name: { color: '#fff', fontWeight: '600' },
  desc: { color: '#6b7280', fontSize: '13px' },
  catBadge: { background: '#1f2937', color: '#9ca3af', padding: '3px 10px', borderRadius: '20px', fontSize: '12px' },
  price: { color: '#eab308', fontWeight: '700' },
  badge: { padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' },
  badgeOn: { background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' },
  badgeOff: { background: 'rgba(107,114,128,0.1)', color: '#6b7280', border: '1px solid rgba(107,114,128,0.2)' },
  badgeLow: { background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' },
  badgeOut: { background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' },
  footer: { color: '#374151', fontSize: '12px', textAlign: 'right', marginTop: '8px' },
}
