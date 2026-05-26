import { useState, useEffect } from 'react'
import type { User } from '../types'

interface Categoria { id: number; nombre: string }
interface Producto {
  id: number; nombre: string; stock: number; stockMinimo: number
  activo: boolean; categoria: Categoria
}

const API = 'http://localhost:3000/api'

export default function Stock({ user }: { user: User }) {
  const [productos, setProductos] = useState<Producto[]>([])
  const [loading, setLoading] = useState(true)
  const [adjusting, setAdjusting] = useState<{ id: number; value: string } | null>(null)
  const [filter, setFilter] = useState<'all' | 'low' | 'out'>('all')

  const token = localStorage.getItem('token') ?? ''
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
  const isAdmin = user.rol === 'ADMIN'

  const fetchAll = async () => {
    const res = await fetch(`${API}/products`, { headers })
    setProductos(await res.json())
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  const handleAdjust = async (id: number, stock: number) => {
    await fetch(`${API}/products/${id}`, { method: 'PUT', headers, body: JSON.stringify({ stock }) })
    setAdjusting(null); fetchAll()
  }

  const filtered = productos.filter(p => {
    if (filter === 'low') return p.activo && p.stock > 0 && p.stock <= p.stockMinimo
    if (filter === 'out') return p.stock === 0
    return true
  })

  const lowCount = productos.filter(p => p.activo && p.stock > 0 && p.stock <= p.stockMinimo).length
  const outCount = productos.filter(p => p.stock === 0).length
  const okCount  = productos.filter(p => p.activo && p.stock > p.stockMinimo).length

  if (loading) return <div style={s.loading}>Cargando stock...</div>

  return (
    <div style={s.container}>
      <div style={s.header}>
        <h2 style={s.title}>Stock</h2>
        <p style={s.subtitle}>{productos.length} productos en inventario</p>
      </div>

      {/* Tarjetas resumen */}
      <div style={s.cards}>
        {[
          { label: 'Total', value: productos.length, color: '#f1f5f9', bg: '#1e293b', border: '#334155' },
          { label: 'Normal', value: okCount, color: '#4ade80', bg: 'rgba(74,222,128,0.05)', border: 'rgba(74,222,128,0.2)' },
          { label: 'Stock bajo', value: lowCount, color: '#fbbf24', bg: 'rgba(251,191,36,0.05)', border: 'rgba(251,191,36,0.2)' },
          { label: 'Sin stock', value: outCount, color: '#f87171', bg: 'rgba(248,113,113,0.05)', border: 'rgba(248,113,113,0.2)' },
        ].map(c => (
          <div key={c.label} style={{ ...s.card, background: c.bg, borderColor: c.border }}>
            <p style={{ ...s.cardVal, color: c.color }}>{c.value}</p>
            <p style={s.cardLbl}>{c.label}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={s.tabs}>
        {([
          { key: 'all', label: 'Todos' },
          { key: 'low', label: `⚠️ Stock bajo (${lowCount})` },
          { key: 'out', label: `🔴 Sin stock (${outCount})` },
        ] as const).map(f => (
          <button key={f.key}
            style={{ ...s.tab, ...(filter === f.key ? s.tabActive : {}) }}
            onClick={() => setFilter(f.key)}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Tabla */}
      <div style={s.tableWrap}>
        <div style={s.thead}>
          <span style={{ ...s.th, flex: 1 }}>Producto</span>
          <span style={{ ...s.th, width: '140px' }}>Categoría</span>
          <span style={{ ...s.th, width: '110px', textAlign: 'center' }}>Stock actual</span>
          <span style={{ ...s.th, width: '100px', textAlign: 'center' }}>Stock mínimo</span>
          <span style={{ ...s.th, width: '100px', textAlign: 'center' }}>Estado</span>
          {isAdmin && <span style={{ ...s.th, width: '120px', textAlign: 'center' }}>Ajustar</span>}
        </div>

        {filtered.length === 0
          ? <div style={s.empty}>No hay productos en esta categoría</div>
          : filtered.map(p => {
            const status = p.stock === 0 ? 'out' : p.stock <= p.stockMinimo ? 'low' : 'ok'
            const stockColor = status === 'out' ? '#f87171' : status === 'low' ? '#fbbf24' : '#4ade80'

            return (
              <div key={p.id} style={s.row}>
                <span style={{ ...s.td, flex: 1 }}>
                  <span style={s.name}>{p.nombre}</span>
                </span>
                <span style={{ ...s.td, width: '140px' }}>
                  <span style={s.catBadge}>{p.categoria.nombre}</span>
                </span>
                <span style={{ ...s.td, width: '110px', justifyContent: 'center' }}>
                  {isAdmin && adjusting?.id === p.id ? (
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      <input style={s.adjustInput} type="number" min="0"
                        value={adjusting.value}
                        onChange={e => setAdjusting({ id: p.id, value: e.target.value })}
                        autoFocus />
                      <button style={s.btnSave} onClick={() => handleAdjust(p.id, Number(adjusting.value))}>✓</button>
                      <button style={s.btnCancel} onClick={() => setAdjusting(null)}>✕</button>
                    </div>
                  ) : (
                    <span style={{ fontWeight: '800', fontSize: '18px', color: stockColor }}>{p.stock}</span>
                  )}
                </span>
                <span style={{ ...s.td, width: '100px', justifyContent: 'center', color: '#cbd5e1', fontWeight: '600' }}>
                  {p.stockMinimo}
                </span>
                <span style={{ ...s.td, width: '100px', justifyContent: 'center' }}>
                  {status === 'out' && <span style={s.badgeOut}>Sin stock</span>}
                  {status === 'low' && <span style={s.badgeLow}>Stock bajo</span>}
                  {status === 'ok'  && <span style={s.badgeOk}>Normal</span>}
                </span>
                {isAdmin && (
                  <span style={{ ...s.td, width: '120px', justifyContent: 'center' }}>
                    {adjusting?.id !== p.id && (
                      <button style={s.btnEdit}
                        onClick={() => setAdjusting({ id: p.id, value: String(p.stock) })}>
                        Ajustar stock
                      </button>
                    )}
                  </span>
                )}
              </div>
            )
          })
        }
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  container:  { padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '20px', overflowX: 'hidden' },
  loading:    { color: '#94a3b8', padding: '40px', textAlign: 'center' },
  header:     { display: 'flex', flexDirection: 'column', gap: '2px' },
  title:      { color: '#f1f5f9', fontSize: '20px', fontWeight: '700', margin: 0 },
  subtitle:   { color: '#cbd5e1', fontSize: '13px' },
  cards:      { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' },
  card:       { background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '18px 20px' },
  cardVal:    { fontSize: '30px', fontWeight: '800', margin: 0 },
  cardLbl:    { color: '#cbd5e1', fontSize: '12px', margin: '4px 0 0', fontWeight: '500' },
  tabs:       { display: 'flex', gap: '6px' },
  tab:        { background: 'transparent', border: '1px solid #334155', borderRadius: '8px', padding: '7px 14px', color: '#94a3b8', fontSize: '12px', fontWeight: '500', cursor: 'pointer' },
  tabActive:  { background: 'rgba(234,179,8,0.1)', borderColor: 'rgba(234,179,8,0.3)', color: '#eab308', fontWeight: '600' },
  tableWrap:  { background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', overflow: 'hidden' },
  thead:      { display: 'flex', alignItems: 'center', padding: '10px 16px', background: '#0f172a', borderBottom: '1px solid #334155' },
  th:         { color: '#cbd5e1', fontSize: '11px', fontWeight: '700', letterSpacing: '0.8px', textTransform: 'uppercase' as const, display: 'flex', alignItems: 'center' },
  row:        { display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #1e293b', background: '#1e293b' },
  td:         { display: 'flex', alignItems: 'center', fontSize: '14px', color: '#cbd5e1' },
  empty:      { padding: '40px', textAlign: 'center', color: '#cbd5e1', fontSize: '14px' },
  name:       { color: '#f1f5f9', fontWeight: '600' },
  catBadge:   { background: '#0f172a', color: '#94a3b8', border: '1px solid #334155', padding: '2px 9px', borderRadius: '20px', fontSize: '11px', whiteSpace: 'nowrap' as const },
  badgeOut:   { background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.2)', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap' as const, display: 'inline-block' },
  badgeLow:   { background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap' as const, display: 'inline-block' },
  badgeOk:    { background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap' as const, display: 'inline-block' },
  adjustInput:{ background: '#0f172a', border: '1px solid #eab308', borderRadius: '6px', padding: '5px 8px', color: '#f1f5f9', fontSize: '13px', outline: 'none', width: '64px' },
  btnSave:    { background: '#4ade80', border: 'none', borderRadius: '5px', padding: '5px 8px', color: '#0f172a', fontWeight: '700', cursor: 'pointer', fontSize: '13px' },
  btnCancel:  { background: '#334155', border: 'none', borderRadius: '5px', padding: '5px 8px', color: '#94a3b8', cursor: 'pointer', fontSize: '13px' },
  btnEdit:    { background: '#334155', border: '1px solid #475569', borderRadius: '6px', padding: '5px 12px', color: '#cbd5e1', fontSize: '12px', cursor: 'pointer', fontWeight: '500' },
}
