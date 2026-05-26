import { useState, useEffect } from 'react'
import type { User } from '../types'
import { API } from '../config'

interface Categoria { id: number; nombre: string }
interface Producto {
  id: number; codigo: string | null; nombre: string; descripcion: string | null
  precioCosto: number; precio: number; stock: number; stockMinimo: number
  activo: boolean; categoriaId: number; categoria: Categoria
}
interface ProductoForm {
  nombre: string; descripcion: string; categoriaId: string
  precioCosto: string; precio: string; margen: string
  stock: string; stockMinimo: string; activo: boolean
}

const EMPTY_FORM: ProductoForm = {
  nombre: '', descripcion: '', categoriaId: '',
  precioCosto: '', precio: '', margen: '',
  stock: '0', stockMinimo: '5', activo: true,
}

const calcMargen = (costo: number, venta: number) =>
  costo ? (((venta - costo) / costo) * 100).toFixed(2) : ''

const calcVenta = (costo: number, margen: number) =>
  costo ? (costo * (1 + margen / 100)).toFixed(2) : ''

const fmt = (n: number) =>
  n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })


export default function Articulos({ user }: { user: User }) {
  const [productos, setProductos] = useState<Producto[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('active')
  const [expanded, setExpanded] = useState<number | null>(null)
  const [modal, setModal] = useState<{ open: boolean; editing: Producto | null }>({ open: false, editing: null })
  const [form, setForm] = useState<ProductoForm>(EMPTY_FORM)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)

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

  const openCreate = () => { setForm(EMPTY_FORM); setModal({ open: true, editing: null }) }
  const openEdit = (p: Producto) => {
    setForm({
      nombre: p.nombre, descripcion: p.descripcion ?? '', categoriaId: String(p.categoriaId),
      precioCosto: String(p.precioCosto), precio: String(p.precio),
      margen: calcMargen(p.precioCosto, p.precio),
      stock: String(p.stock), stockMinimo: String(p.stockMinimo), activo: p.activo,
    })
    setModal({ open: true, editing: p })
  }
  const closeModal = () => setModal({ open: false, editing: null })

  const handleCostChange = (val: string) => {
    const costo = parseFloat(val) || 0
    const margen = parseFloat(form.margen) || 0
    setForm(f => ({ ...f, precioCosto: val, precio: margen ? calcVenta(costo, margen) : f.precio }))
  }
  const handleVentaChange = (val: string) => {
    const costo = parseFloat(form.precioCosto) || 0
    setForm(f => ({ ...f, precio: val, margen: calcMargen(costo, parseFloat(val) || 0) }))
  }
  const handleMargenChange = (val: string) => {
    const costo = parseFloat(form.precioCosto) || 0
    setForm(f => ({ ...f, margen: val, precio: calcVenta(costo, parseFloat(val) || 0) }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const body = {
      nombre: form.nombre, descripcion: form.descripcion || undefined,
      categoriaId: Number(form.categoriaId),
      precioCosto: Number(form.precioCosto) || 0, precio: Number(form.precio) || 0,
      stock: Number(form.stock), stockMinimo: Number(form.stockMinimo), activo: form.activo,
    }
    if (modal.editing) {
      await fetch(`${API}/products/${modal.editing.id}`, { method: 'PUT', headers, body: JSON.stringify(body) })
    } else {
      await fetch(`${API}/products`, { method: 'POST', headers, body: JSON.stringify(body) })
    }
    closeModal(); fetchAll()
  }

  const handleDelete = async (id: number) => {
    await fetch(`${API}/products/${id}`, { method: 'DELETE', headers })
    setDeleteConfirm(null); fetchAll()
  }

  const handleToggle = async (p: Producto) => {
    await fetch(`${API}/products/${p.id}`, { method: 'PUT', headers, body: JSON.stringify({ activo: !p.activo }) })
    fetchAll()
  }

  const filtered = productos.filter(p => {
    if (filterCat && String(p.categoriaId) !== filterCat) return false
    if (filterStatus === 'active' && !p.activo) return false
    if (filterStatus === 'inactive' && p.activo) return false
    if (search) {
      const q = search.toLowerCase()
      if (!p.nombre.toLowerCase().includes(q) && !(p.codigo?.toLowerCase().includes(q))) return false
    }
    return true
  })

  if (loading) return <div style={s.loading}>Cargando artículos...</div>

  return (
    <div style={s.container}>
      {/* Encabezado */}
      <div style={s.header}>
        <div>
          <h2 style={s.title}>Artículos</h2>
          <p style={s.subtitle}>{filtered.length} de {productos.length} artículos</p>
        </div>
        {isAdmin && <button style={s.btnPrimary} onClick={openCreate}>+ Nuevo Artículo</button>}
      </div>

      {/* Filtros */}
      <div style={s.filterBar}>
        <input
          style={s.searchInput}
          placeholder="Buscar por nombre o código..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select style={s.select} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
          <option value="">Todas las categorías</option>
          {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <div style={s.tabs}>
          {(['all', 'active', 'inactive'] as const).map(f => (
            <button
              key={f}
              style={{ ...s.tab, ...(filterStatus === f ? s.tabActive : {}) }}
              onClick={() => setFilterStatus(f)}
            >
              {f === 'all' ? 'Todos' : f === 'active' ? 'Activos' : 'Inactivos'}
            </button>
          ))}
        </div>
      </div>

      {/* Grid de cards */}
      {filtered.length === 0
        ? <div style={s.empty}>No hay artículos que coincidan con los filtros</div>
        : (
          <div style={s.grid}>
            {filtered.map(p => {
              const margen = p.precioCosto > 0 ? ((p.precio - p.precioCosto) / p.precioCosto * 100) : null
              const stockStatus = p.stock === 0 ? 'out' : p.stock <= p.stockMinimo ? 'low' : 'ok'
              const stockPct = Math.min((p.stock / (p.stockMinimo * 3)) * 100, 100)
              const isExp = expanded === p.id

              return (
                <div key={p.id} style={{ ...s.card, opacity: p.activo ? 1 : 0.6 }}>
                  {/* Cabecera de la card */}
                  <div style={s.cardTop}>
                    <span style={s.code}>{p.codigo ?? '—'}</span>
                    <span style={{ ...s.statusDot, ...(p.activo ? s.dotActive : s.dotInactive) }}>
                      {p.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>

                  {/* Nombre y categoría */}
                  <div style={s.cardBody}>
                    <h3 style={s.productName}>{p.nombre}</h3>
                    <span style={s.catBadge}>{p.categoria.nombre}</span>
                  </div>

                  {/* Descripción expandible */}
                  {p.descripcion && (
                    <button style={s.descToggle} onClick={() => setExpanded(isExp ? null : p.id)}>
                      <span>{isExp ? 'Ocultar descripción ▴' : 'Ver descripción ▾'}</span>
                    </button>
                  )}
                  {isExp && p.descripcion && (
                    <p style={s.descText}>{p.descripcion}</p>
                  )}

                  {/* Divisor */}
                  <div style={s.divider} />

                  {/* Precios */}
                  <div style={s.priceRow}>
                    <div style={s.priceItem}>
                      <span style={s.priceLabel}>Costo</span>
                      <span style={s.priceCost}>${fmt(p.precioCosto)}</span>
                    </div>
                    <div style={s.priceArrow}>→</div>
                    <div style={s.priceItem}>
                      <span style={s.priceLabel}>Venta</span>
                      <span style={s.priceSale}>${fmt(p.precio)}</span>
                    </div>
                    {margen !== null && (
                      <span style={{ ...s.margenBadge, ...(margen >= 0 ? s.margenPos : s.margenNeg) }}>
                        {margen >= 0 ? '+' : ''}{margen.toFixed(1)}%
                      </span>
                    )}
                  </div>

                  {/* Stock */}
                  <div style={s.stockRow}>
                    <div style={s.stockInfo}>
                      <span style={s.stockLabel}>Stock</span>
                      <span style={{ ...s.stockNum, color: stockStatus === 'out' ? '#f87171' : stockStatus === 'low' ? '#fbbf24' : '#4ade80' }}>
                        {p.stock}
                      </span>
                      <span style={s.stockMin}>/ mín {p.stockMinimo}</span>
                      {stockStatus === 'out' && <span style={s.badgeOut}>Sin stock</span>}
                      {stockStatus === 'low' && <span style={s.badgeLow}>Stock bajo</span>}
                    </div>
                    <div style={s.stockBarWrap}>
                      <div style={{ ...s.stockBar, width: `${stockPct}%`, background: stockStatus === 'out' ? '#f87171' : stockStatus === 'low' ? '#fbbf24' : '#4ade80' }} />
                    </div>
                  </div>

                  {/* Acciones */}
                  {isAdmin && (
                    <div style={s.cardActions}>
                      <button style={s.btnEdit} onClick={() => openEdit(p)}>✏️ Editar</button>
                      <button style={s.btnToggle} onClick={() => handleToggle(p)}>
                        {p.activo ? '🔒 Desactivar' : '🔓 Activar'}
                      </button>
                      <button style={s.btnDelete} onClick={() => setDeleteConfirm(p.id)}>🗑️</button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      }

      {/* Modal crear/editar */}
      {modal.open && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <div style={s.modalHeader}>
              <h3 style={s.modalTitle}>{modal.editing ? `Editar — ${modal.editing.codigo}` : 'Nuevo Artículo'}</h3>
              <button style={s.closeBtn} onClick={closeModal}>✕</button>
            </div>
            <form onSubmit={handleSubmit} style={s.form}>

              <div style={s.section}>
                <p style={s.sectionTitle}>Datos generales</p>
                <div style={s.row}>
                  <div style={s.field}>
                    <label style={s.label}>Nombre *</label>
                    <input style={s.input} value={form.nombre}
                      onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} required />
                  </div>
                  <div style={s.field}>
                    <label style={s.label}>Categoría *</label>
                    <select style={s.input} value={form.categoriaId}
                      onChange={e => setForm(f => ({ ...f, categoriaId: e.target.value }))} required>
                      <option value="">Seleccionar...</option>
                      {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  </div>
                </div>
                <div style={s.field}>
                  <label style={s.label}>Descripción</label>
                  <textarea style={{ ...s.input, resize: 'vertical', minHeight: '70px' }}
                    value={form.descripcion}
                    onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
                </div>
              </div>

              <div style={s.section}>
                <p style={s.sectionTitle}>Precios</p>
                <div style={s.row}>
                  <div style={s.field}>
                    <label style={s.label}>Precio de costo</label>
                    <div style={s.inputGroup}>
                      <span style={s.inputPrefix}>$</span>
                      <input style={s.inputInner} type="number" min="0" step="0.01"
                        value={form.precioCosto} onChange={e => handleCostChange(e.target.value)} />
                    </div>
                  </div>
                  <div style={s.field}>
                    <label style={s.label}>Margen (%)</label>
                    <div style={s.inputGroup}>
                      <input style={{ ...s.inputInner, paddingLeft: '12px' }} type="number" step="0.01"
                        value={form.margen} onChange={e => handleMargenChange(e.target.value)} />
                      <span style={s.inputSuffix}>%</span>
                    </div>
                  </div>
                  <div style={s.field}>
                    <label style={s.label}>Precio de venta</label>
                    <div style={s.inputGroup}>
                      <span style={s.inputPrefix}>$</span>
                      <input style={s.inputInner} type="number" min="0" step="0.01"
                        value={form.precio} onChange={e => handleVentaChange(e.target.value)} />
                    </div>
                  </div>
                </div>
                {form.precioCosto && form.precio && (
                  <div style={s.margenPreview}>
                    <span style={{ color: '#94a3b8', fontSize: '13px' }}>Ganancia por unidad:</span>
                    <span style={{ color: '#eab308', fontWeight: '700', fontSize: '15px' }}>
                      ${fmt(Number(form.precio) - Number(form.precioCosto))}
                    </span>
                    {form.margen && (
                      <span style={{ ...s.margenBadge, ...(Number(form.margen) >= 0 ? s.margenPos : s.margenNeg), marginLeft: '4px' }}>
                        {Number(form.margen) >= 0 ? '+' : ''}{Number(form.margen).toFixed(1)}%
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div style={s.section}>
                <p style={s.sectionTitle}>Stock</p>
                <div style={s.row}>
                  <div style={s.field}>
                    <label style={s.label}>Stock actual *</label>
                    <input style={s.input} type="number" min="0" value={form.stock}
                      onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} required />
                  </div>
                  <div style={s.field}>
                    <label style={s.label}>Stock mínimo</label>
                    <input style={s.input} type="number" min="0" value={form.stockMinimo}
                      onChange={e => setForm(f => ({ ...f, stockMinimo: e.target.value }))} />
                  </div>
                </div>
              </div>

              <label style={s.checkLabel}>
                <input type="checkbox" checked={form.activo}
                  onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} />
                <span style={{ color: '#cbd5e1', fontSize: '14px' }}>Artículo activo</span>
              </label>

              <div style={s.modalActions}>
                <button type="button" style={s.btnSecondary} onClick={closeModal}>Cancelar</button>
                <button type="submit" style={s.btnPrimary}>
                  {modal.editing ? 'Guardar cambios' : 'Crear artículo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmar eliminar */}
      {deleteConfirm !== null && (
        <div style={s.overlay}>
          <div style={{ ...s.modal, maxWidth: '400px' }}>
            <h3 style={{ ...s.modalTitle, marginBottom: '12px' }}>Eliminar artículo</h3>
            <p style={{ color: '#94a3b8', fontSize: '14px', margin: '0 0 24px' }}>¿Estás seguro? Esta acción no se puede deshacer.</p>
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
  container:    { padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '20px', overflowX: 'hidden' },
  loading:      { color: '#94a3b8', padding: '40px', textAlign: 'center' },
  header:       { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  title:        { color: '#f1f5f9', fontSize: '20px', fontWeight: '700', margin: 0 },
  subtitle:     { color: '#cbd5e1', fontSize: '13px', margin: '3px 0 0' },

  filterBar:    { display: 'flex', gap: '10px', flexWrap: 'wrap' as const, alignItems: 'center' },
  searchInput:  { flex: 1, minWidth: '200px', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '9px 14px', color: '#f1f5f9', fontSize: '14px', outline: 'none' },
  select:       { background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '9px 14px', color: '#cbd5e1', fontSize: '13px', outline: 'none', cursor: 'pointer' },
  tabs:         { display: 'flex', gap: '4px', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '3px' },
  tab:          { background: 'transparent', border: 'none', borderRadius: '6px', padding: '5px 12px', color: '#94a3b8', fontSize: '12px', fontWeight: '500', cursor: 'pointer' },
  tabActive:    { background: '#334155', color: '#f1f5f9', fontWeight: '600' },

  empty:        { color: '#cbd5e1', textAlign: 'center', padding: '60px 20px', background: '#1e293b', borderRadius: '12px', border: '1px solid #334155', fontSize: '14px' },

  grid:         { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: '16px' },

  card:         { background: '#1e293b', border: '1px solid #334155', borderRadius: '14px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px', transition: 'border-color 0.2s' },
  cardTop:      { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  code:         { fontFamily: 'monospace', background: '#0f172a', color: '#eab308', border: '1px solid #334155', borderRadius: '6px', padding: '3px 9px', fontSize: '12px', fontWeight: '700', letterSpacing: '1px' },
  statusDot:    { fontSize: '11px', fontWeight: '600', padding: '3px 8px', borderRadius: '20px' },
  dotActive:    { background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)' },
  dotInactive:  { background: 'rgba(100,116,139,0.1)', color: '#94a3b8', border: '1px solid rgba(100,116,139,0.2)' },

  cardBody:     { display: 'flex', flexDirection: 'column', gap: '6px' },
  productName:  { color: '#f1f5f9', fontSize: '15px', fontWeight: '700', margin: 0, lineHeight: '1.3' },
  catBadge:     { display: 'inline-block', background: '#0f172a', color: '#94a3b8', border: '1px solid #334155', padding: '2px 9px', borderRadius: '20px', fontSize: '11px' },

  descToggle:   { background: 'transparent', border: 'none', color: '#cbd5e1', fontSize: '11px', cursor: 'pointer', textAlign: 'left', padding: 0, fontWeight: '500' },
  descText:     { color: '#94a3b8', fontSize: '12px', lineHeight: '1.6', background: '#0f172a', borderRadius: '8px', padding: '10px 12px' },

  divider:      { height: '1px', background: '#334155' },

  priceRow:     { display: 'flex', alignItems: 'center', gap: '8px' },
  priceItem:    { display: 'flex', flexDirection: 'column', gap: '1px' },
  priceLabel:   { color: '#cbd5e1', fontSize: '10px', fontWeight: '600', textTransform: 'uppercase' as const, letterSpacing: '0.5px' },
  priceCost:    { color: '#94a3b8', fontWeight: '600', fontSize: '14px' },
  priceSale:    { color: '#eab308', fontWeight: '800', fontSize: '17px' },
  priceArrow:   { color: '#94a3b8', fontSize: '14px', margin: '0 2px', alignSelf: 'flex-end', paddingBottom: '2px' },
  margenBadge:  { padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', marginLeft: 'auto' },
  margenPos:    { background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)' },
  margenNeg:    { background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.2)' },

  stockRow:     { display: 'flex', flexDirection: 'column', gap: '6px' },
  stockInfo:    { display: 'flex', alignItems: 'center', gap: '6px' },
  stockLabel:   { color: '#cbd5e1', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' as const, letterSpacing: '0.5px' },
  stockNum:     { fontWeight: '800', fontSize: '16px' },
  stockMin:     { color: '#cbd5e1', fontSize: '11px' },
  badgeOut:     { background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.2)', padding: '1px 7px', borderRadius: '20px', fontSize: '10px', fontWeight: '600', marginLeft: 'auto', whiteSpace: 'nowrap' as const },
  badgeLow:     { background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)', padding: '1px 7px', borderRadius: '20px', fontSize: '10px', fontWeight: '600', marginLeft: 'auto', whiteSpace: 'nowrap' as const },
  stockBarWrap: { height: '4px', background: '#0f172a', borderRadius: '2px', overflow: 'hidden' },
  stockBar:     { height: '100%', borderRadius: '2px', transition: 'width 0.3s' },

  cardActions:  { display: 'flex', gap: '6px', marginTop: '2px' },
  btnEdit:      { flex: 1, background: '#334155', border: 'none', borderRadius: '7px', padding: '7px 10px', color: '#cbd5e1', fontSize: '12px', fontWeight: '600', cursor: 'pointer' },
  btnToggle:    { flex: 1, background: 'transparent', border: '1px solid #334155', borderRadius: '7px', padding: '7px 10px', color: '#94a3b8', fontSize: '12px', fontWeight: '600', cursor: 'pointer' },
  btnDelete:    { background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: '7px', padding: '7px 10px', color: '#f87171', fontSize: '12px', cursor: 'pointer' },

  btnPrimary:   { background: '#eab308', color: '#0f172a', border: 'none', borderRadius: '8px', padding: '9px 18px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' },
  btnSecondary: { background: 'transparent', color: '#94a3b8', border: '1px solid #334155', borderRadius: '8px', padding: '9px 18px', fontWeight: '600', fontSize: '13px', cursor: 'pointer' },
  btnDanger:    { background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' },

  overlay:      { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal:        { background: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' },
  modalHeader:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  modalTitle:   { color: '#f1f5f9', fontSize: '17px', fontWeight: '700', margin: 0 },
  closeBtn:     { background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '18px', cursor: 'pointer' },
  form:         { display: 'flex', flexDirection: 'column', gap: '16px' },
  section:      { display: 'flex', flexDirection: 'column', gap: '12px', background: '#0f172a', borderRadius: '10px', padding: '14px' },
  sectionTitle: { color: '#cbd5e1', fontSize: '10px', fontWeight: '700', letterSpacing: '1px', textTransform: 'uppercase' as const, margin: 0 },
  row:          { display: 'flex', gap: '10px' },
  field:        { display: 'flex', flexDirection: 'column', gap: '5px', flex: 1 },
  label:        { color: '#94a3b8', fontSize: '11px', fontWeight: '600', letterSpacing: '0.5px' },
  input:        { background: '#1e293b', border: '1px solid #334155', borderRadius: '7px', padding: '9px 12px', color: '#f1f5f9', fontSize: '13px', outline: 'none', width: '100%', boxSizing: 'border-box' as const },
  inputGroup:   { display: 'flex', alignItems: 'center', background: '#1e293b', border: '1px solid #334155', borderRadius: '7px', overflow: 'hidden' },
  inputPrefix:  { color: '#eab308', fontWeight: '700', padding: '0 8px', fontSize: '13px', flexShrink: 0 },
  inputSuffix:  { color: '#94a3b8', fontWeight: '600', padding: '0 8px', fontSize: '13px', flexShrink: 0 },
  inputInner:   { flex: 1, background: 'transparent', border: 'none', padding: '9px 8px 9px 0', color: '#f1f5f9', fontSize: '13px', outline: 'none', width: '100%' },
  margenPreview:{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 12px', background: 'rgba(234,179,8,0.05)', border: '1px solid rgba(234,179,8,0.15)', borderRadius: '7px' },
  checkLabel:   { display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' },
  modalActions: { display: 'flex', gap: '10px', justifyContent: 'flex-end' },
}
