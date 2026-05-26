import { useState, useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import type { User } from '../types'

interface Categoria { id: number; nombre: string }
interface Producto {
  id: number; nombre: string; descripcion: string | null
  precio: number; stock: number; stockMinimo: number
  activo: boolean; categoriaId: number; categoria: Categoria
}
interface ProductoForm {
  nombre: string; descripcion: string; precio: string
  stock: string; stockMinimo: string; categoriaId: string; activo: boolean
}

const EMPTY_FORM: ProductoForm = { nombre: '', descripcion: '', precio: '', stock: '', stockMinimo: '5', categoriaId: '', activo: true }
const API = 'http://localhost:3000/api'

export default function Inventario({ user }: { user: User }) {
  const [productos, setProductos] = useState<Producto[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ open: boolean; editing: Producto | null }>({ open: false, editing: null })
  const [form, setForm] = useState<ProductoForm>(EMPTY_FORM)
  const [filterCategoria, setFilterCategoria] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterSearch, setFilterSearch] = useState('')
  const [lowStockAlerts, setLowStockAlerts] = useState<Producto[]>([])
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const socketRef = useRef<Socket | null>(null)

  const token = localStorage.getItem('token') ?? ''
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
  const isAdmin = user.rol === 'ADMIN'

  const fetchAll = async () => {
    const [pRes, cRes] = await Promise.all([
      fetch(`${API}/products`, { headers }),
      fetch(`${API}/categories`, { headers }),
    ])
    const prods: Producto[] = await pRes.json()
    const cats: Categoria[] = await cRes.json()
    setProductos(prods)
    setCategorias(cats)
    setLowStockAlerts(prods.filter(p => p.activo && p.stock <= p.stockMinimo))
    setLoading(false)
  }

  useEffect(() => {
    fetchAll()
    socketRef.current = io('http://localhost:3000')
    socketRef.current.on('low-stock', (producto: Producto) => {
      setLowStockAlerts(prev => prev.find(p => p.id === producto.id) ? prev : [...prev, producto])
    })
    return () => { socketRef.current?.disconnect() }
  }, [])

  const openCreate = () => { setForm(EMPTY_FORM); setModal({ open: true, editing: null }) }
  const openEdit = (p: Producto) => {
    setForm({ nombre: p.nombre, descripcion: p.descripcion ?? '', precio: String(p.precio), stock: String(p.stock), stockMinimo: String(p.stockMinimo), categoriaId: String(p.categoriaId), activo: p.activo })
    setModal({ open: true, editing: p })
  }
  const closeModal = () => setModal({ open: false, editing: null })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const body = { nombre: form.nombre, descripcion: form.descripcion || undefined, precio: Number(form.precio), stock: Number(form.stock), stockMinimo: Number(form.stockMinimo), categoriaId: Number(form.categoriaId), activo: form.activo }
    if (modal.editing) {
      await fetch(`${API}/products/${modal.editing.id}`, { method: 'PUT', headers, body: JSON.stringify(body) })
    } else {
      await fetch(`${API}/products`, { method: 'POST', headers, body: JSON.stringify(body) })
    }
    closeModal()
    fetchAll()
  }

  const handleDelete = async (id: number) => {
    await fetch(`${API}/products/${id}`, { method: 'DELETE', headers })
    setDeleteConfirm(null)
    fetchAll()
  }

  const handleToggleActive = async (p: Producto) => {
    await fetch(`${API}/products/${p.id}`, { method: 'PUT', headers, body: JSON.stringify({ activo: !p.activo }) })
    fetchAll()
  }

  const filtered = productos.filter(p => {
    if (filterCategoria && String(p.categoriaId) !== filterCategoria) return false
    if (filterStatus === 'active' && !p.activo) return false
    if (filterStatus === 'inactive' && p.activo) return false
    if (filterStatus === 'low' && !(p.activo && p.stock <= p.stockMinimo)) return false
    if (filterSearch && !p.nombre.toLowerCase().includes(filterSearch.toLowerCase())) return false
    return true
  })

  if (loading) return <div style={s.loading}>Cargando inventario...</div>

  return (
    <div style={s.container}>

      {/* Banner alertas */}
      {lowStockAlerts.length > 0 && (
        <div style={s.alertBanner}>
          <span>⚠️</span>
          <span>
            <strong>{lowStockAlerts.length} producto{lowStockAlerts.length > 1 ? 's' : ''} con stock bajo: </strong>
            {lowStockAlerts.map(a => a.nombre).join(', ')}
          </span>
        </div>
      )}

      {/* Header */}
      <div style={s.header}>
        <div>
          <h2 style={s.title}>Inventario</h2>
          <p style={s.subtitle}>{productos.length} productos registrados</p>
        </div>
        {isAdmin && <button style={s.btnPrimary} onClick={openCreate}>+ Nuevo Producto</button>}
      </div>

      {/* Filtros */}
      <div style={s.filters}>
        <input style={s.searchInput} placeholder="Buscar producto..." value={filterSearch} onChange={e => setFilterSearch(e.target.value)} />
        <select style={s.select} value={filterCategoria} onChange={e => setFilterCategoria(e.target.value)}>
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

      {/* Tabla */}
      <div style={s.tableWrapper}>
        <table style={s.table}>
          <thead>
            <tr>
              {['Producto', 'Categoría', 'Precio', 'Stock', 'Estado', 'Acciones'].map(h => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} style={s.emptyRow}>No hay productos que coincidan</td></tr>
            ) : filtered.map(p => (
              <tr key={p.id} style={{ ...s.tr, opacity: p.activo ? 1 : 0.5 }}>
                <td style={s.td}>
                  <div style={s.productName}>{p.nombre}</div>
                  {p.descripcion && <div style={s.productDesc}>{p.descripcion}</div>}
                </td>
                <td style={s.td}><span style={s.categoryBadge}>{p.categoria.nombre}</span></td>
                <td style={s.td}><span style={s.price}>${p.precio.toFixed(2)}</span></td>
                <td style={s.td}>
                  <div style={s.stockCell}>
                    <span style={{ ...s.stockNum, color: p.stock === 0 ? '#ef4444' : p.stock <= p.stockMinimo ? '#f59e0b' : '#22c55e' }}>
                      {p.stock}
                    </span>
                    {p.stock === 0 && <span style={s.badgeOut}>Sin stock</span>}
                    {p.stock > 0 && p.stock <= p.stockMinimo && <span style={s.badgeLow}>Stock bajo</span>}
                    <span style={s.minStock}>mín: {p.stockMinimo}</span>
                  </div>
                </td>
                <td style={s.td}>
                  <span style={{ ...s.badge, ...(p.activo ? s.badgeActive : s.badgeInactive) }}>
                    {p.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td style={s.td}>
                  {isAdmin && (
                    <div style={s.actions}>
                      <button style={s.btnIcon} onClick={() => openEdit(p)} title="Editar">✏️</button>
                      <button style={s.btnIcon} onClick={() => handleToggleActive(p)} title={p.activo ? 'Desactivar' : 'Activar'}>
                        {p.activo ? '🔒' : '🔓'}
                      </button>
                      <button style={s.btnIconDanger} onClick={() => setDeleteConfirm(p.id)} title="Eliminar">🗑️</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal crear/editar */}
      {modal.open && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <div style={s.modalHeader}>
              <h3 style={s.modalTitle}>{modal.editing ? 'Editar Producto' : 'Nuevo Producto'}</h3>
              <button style={s.closeBtn} onClick={closeModal}>✕</button>
            </div>
            <form onSubmit={handleSubmit} style={s.modalForm}>
              <div style={s.formRow}>
                <div style={s.field}>
                  <label style={s.label}>Nombre *</label>
                  <input style={s.input} value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} required />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Categoría *</label>
                  <select style={s.input} value={form.categoriaId} onChange={e => setForm(f => ({ ...f, categoriaId: e.target.value }))} required>
                    <option value="">Seleccionar...</option>
                    {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
              </div>
              <div style={s.field}>
                <label style={s.label}>Descripción</label>
                <input style={s.input} value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
              </div>
              <div style={s.formRow}>
                <div style={s.field}>
                  <label style={s.label}>Precio *</label>
                  <input style={s.input} type="number" min="0" step="0.01" value={form.precio} onChange={e => setForm(f => ({ ...f, precio: e.target.value }))} required />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Stock *</label>
                  <input style={s.input} type="number" min="0" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} required />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Stock mínimo</label>
                  <input style={s.input} type="number" min="0" value={form.stockMinimo} onChange={e => setForm(f => ({ ...f, stockMinimo: e.target.value }))} />
                </div>
              </div>
              <label style={s.checkLabel}>
                <input type="checkbox" checked={form.activo} onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} />
                <span style={{ color: '#d1d5db', fontSize: '14px' }}>Producto activo</span>
              </label>
              <div style={s.modalActions}>
                <button type="button" style={s.btnSecondary} onClick={closeModal}>Cancelar</button>
                <button type="submit" style={s.btnPrimary}>{modal.editing ? 'Guardar cambios' : 'Crear producto'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmar eliminación */}
      {deleteConfirm !== null && (
        <div style={s.overlay}>
          <div style={{ ...s.modal, maxWidth: '400px' }}>
            <div style={s.modalHeader}>
              <h3 style={s.modalTitle}>Eliminar producto</h3>
            </div>
            <p style={{ color: '#9ca3af', fontSize: '15px', margin: '0 0 24px' }}>
              ¿Estás seguro? Esta acción no se puede deshacer.
            </p>
            <div style={s.modalActions}>
              <button style={s.btnSecondary} onClick={() => setDeleteConfirm(null)}>Cancelar</button>
              <button style={s.btnDanger} onClick={() => handleDelete(deleteConfirm)}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  container: { padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '20px', minHeight: '100%', overflowX: 'hidden' },
  loading: { color: '#94a3b8', padding: '40px', textAlign: 'center' },
  alertBanner: { display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: '10px', padding: '12px 16px', color: '#fbbf24', fontSize: '14px' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: '#f1f5f9', fontSize: '20px', fontWeight: '700', margin: 0 },
  subtitle: { color: '#cbd5e1', fontSize: '13px', margin: '3px 0 0' },
  filters: { display: 'flex', gap: '10px', flexWrap: 'wrap' as const },
  searchInput: { flex: 1, minWidth: '200px', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '9px 14px', color: '#f1f5f9', fontSize: '14px', outline: 'none' },
  select: { background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '9px 14px', color: '#cbd5e1', fontSize: '13px', outline: 'none', cursor: 'pointer' },
  tableWrapper: { background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', overflow: 'hidden', width: '100%' },
  table: { width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' as const },
  th: { padding: '10px 16px', textAlign: 'left', color: '#cbd5e1', fontSize: '11px', fontWeight: '700', letterSpacing: '0.8px', background: '#0f172a', borderBottom: '1px solid #334155' },
  tr: { borderBottom: '1px solid #334155' },
  td: { padding: '13px 16px', color: '#cbd5e1', fontSize: '14px' },
  emptyRow: { padding: '40px', textAlign: 'center', color: '#cbd5e1' },
  productName: { color: '#f1f5f9', fontWeight: '600', fontSize: '14px' },
  productDesc: { color: '#94a3b8', fontSize: '12px', marginTop: '2px' },
  categoryBadge: { background: '#0f172a', color: '#94a3b8', border: '1px solid #334155', padding: '2px 9px', borderRadius: '20px', fontSize: '11px' },
  price: { color: '#eab308', fontWeight: '700', fontSize: '15px' },
  stockCell: { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' as const },
  stockNum: { fontWeight: '800', fontSize: '17px' },
  badgeLow: { background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap' as const },
  badgeOut: { background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.2)', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap' as const },
  minStock: { color: '#cbd5e1', fontSize: '11px' },
  badge: { padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' },
  badgeActive: { background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)' },
  badgeInactive: { background: 'rgba(100,116,139,0.1)', color: '#94a3b8', border: '1px solid rgba(100,116,139,0.2)' },
  actions: { display: 'flex', gap: '6px' },
  btnIcon: { background: '#334155', border: 'none', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', fontSize: '14px' },
  btnIconDanger: { background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', fontSize: '14px' },
  btnPrimary: { background: '#eab308', color: '#0f172a', border: 'none', borderRadius: '8px', padding: '9px 18px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' },
  btnSecondary: { background: 'transparent', color: '#94a3b8', border: '1px solid #334155', borderRadius: '8px', padding: '9px 18px', fontWeight: '600', fontSize: '13px', cursor: 'pointer' },
  btnDanger: { background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  modalTitle: { color: '#f1f5f9', fontSize: '17px', fontWeight: '700', margin: 0 },
  closeBtn: { background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '18px', cursor: 'pointer' },
  modalForm: { display: 'flex', flexDirection: 'column', gap: '16px' },
  formRow: { display: 'flex', gap: '12px' },
  field: { display: 'flex', flexDirection: 'column', gap: '5px', flex: 1 },
  label: { color: '#94a3b8', fontSize: '11px', fontWeight: '600', letterSpacing: '0.5px' },
  input: { background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '9px 12px', color: '#f1f5f9', fontSize: '13px', outline: 'none', width: '100%', boxSizing: 'border-box' as const },
  checkLabel: { display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' },
  modalActions: { display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '6px' },
}
