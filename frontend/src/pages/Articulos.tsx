import { useState, useEffect } from 'react'
import type { User } from '../types'
import { API } from '../config'
import { socket } from '../socket'

interface Categoria { id: number; nombre: string }
interface Producto {
  id: number; codigo: string | null; nombre: string; descripcion: string | null
  precioCosto: number; precio: number; stock: number; stockMinimo: number
  activo: boolean; categoriaId: number; categoria: Categoria
}
interface ProductoForm {
  nombre: string; descripcion: string; categoriaId: string
  precioCosto: string; precio: string; margen: string
  stock: string; stockMinimo: string
}

const EMPTY_FORM: ProductoForm = {
  nombre: '', descripcion: '', categoriaId: '',
  precioCosto: '', precio: '', margen: '',
  stock: '0', stockMinimo: '5',
}

const calcMargen = (costo: number, venta: number) =>
  costo ? (((venta - costo) / costo) * 100).toFixed(2) : ''

const calcVenta = (costo: number, margen: number) =>
  costo ? (costo * (1 + margen / 100)).toFixed(2) : ''

const fmt = (n: number) =>
  n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

// Para reponer: activo y en el stock mínimo o por debajo (incluye sin stock); coincide con el contador del menú
const paraReponer = (p: Producto) => p.activo && p.stock <= p.stockMinimo

// Números con coma decimal para que Excel en español los tome como números
const numeroCsv = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',')
const campoCsv = (valor: string) => `"${valor.replace(/"/g, '""')}"`

// Descarga lo que se está viendo en pantalla; el BOM hace que Excel respete los acentos
const exportarCsv = (productos: Producto[]) => {
  const encabezado = ['Código', 'Nombre', 'Categoría', 'Costo', 'Precio de venta', 'Margen %', 'Stock', 'Stock mínimo', 'Estado']
  const filas = productos.map(p => [
    p.codigo ?? '', p.nombre, p.categoria.nombre, numeroCsv(p.precioCosto), numeroCsv(p.precio),
    p.precioCosto ? numeroCsv((p.precio - p.precioCosto) / p.precioCosto * 100) : '',
    String(p.stock), String(p.stockMinimo), p.activo ? 'Activo' : 'Inactivo',
  ])
  const csv = [encabezado, ...filas].map(fila => fila.map(campoCsv).join(';')).join('\r\n')
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }))
  // Fecha local en formato AAAA-MM-DD (toISOString usaría UTC y de noche daría el día siguiente)
  link.download = `inventario-${new Date().toLocaleDateString('sv-SE')}.csv`
  link.click()
  // Se libera en el ciclo siguiente: revocarlo en el acto puede cancelar la descarga en Firefox y Safari
  setTimeout(() => URL.revokeObjectURL(link.href))
}

type Orden = 'asc' | 'desc' | null
// Cada click en "Stock" pasa a la siguiente: menor a mayor, mayor a menor y de vuelta al orden alfabético
const SIGUIENTE_ORDEN: Record<string, Orden> = { null: 'asc', asc: 'desc', desc: null }

type Filtro = 'activos' | 'reponer' | 'inactivos'
const FILTROS: { key: Filtro; label: string; cumple: (p: Producto) => boolean }[] = [
  { key: 'activos',   label: 'Activos',      cumple: p => p.activo },
  { key: 'reponer',   label: 'Para reponer', cumple: paraReponer },
  { key: 'inactivos', label: 'Inactivos',    cumple: p => !p.activo },
]

export default function Articulos({ user }: { user: User }) {
  const [productos, setProductos] = useState<Producto[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('activos')
  const [orden, setOrden] = useState<Orden>(null)
  const [modal, setModal] = useState<{ open: boolean; editing: Producto | null }>({ open: false, editing: null })
  const [form, setForm] = useState<ProductoForm>(EMPTY_FORM)
  const [confirmarBorrado, setConfirmarBorrado] = useState(false)
  const [error, setError] = useState('')

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` }
  const isAdmin = user.rol === 'ADMIN'

  const fetchAll = () =>
    Promise.all([
      fetch(`${API}/products`, { headers }).then(r => r.json()),
      fetch(`${API}/categories`, { headers }).then(r => r.json()),
    ]).then(([prods, cats]) => { setProductos(prods); setCategorias(cats); setLoading(false) })

  useEffect(() => {
    fetchAll()
    socket.on('stock-actualizado', fetchAll)
    return () => { socket.off('stock-actualizado', fetchAll) }
  }, [])

  const abrir = (p: Producto | null) => {
    setForm(p ? {
      nombre: p.nombre, descripcion: p.descripcion ?? '', categoriaId: String(p.categoriaId),
      precioCosto: String(p.precioCosto), precio: String(p.precio),
      margen: calcMargen(p.precioCosto, p.precio),
      stock: String(p.stock), stockMinimo: String(p.stockMinimo),
    } : EMPTY_FORM)
    setError(''); setConfirmarBorrado(false); setModal({ open: true, editing: p })
  }
  const cerrar = () => setModal({ open: false, editing: null })

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

  // Todas las acciones sobre un artículo siguen el mismo patrón: llamar a la API y, si sale bien, cerrar y refrescar
  const guardar = async (method: string, path: string, body?: object) => {
    setError('')
    const res = await fetch(`${API}/products${path}`, { method, headers, body: body && JSON.stringify(body) })
    if (!res.ok) {
      const data = await res.json()
      setError(data.message || 'No se pudo guardar el artículo')
      setConfirmarBorrado(false)
      return
    }
    cerrar(); fetchAll()
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const body = {
      nombre: form.nombre, descripcion: form.descripcion || undefined,
      categoriaId: Number(form.categoriaId),
      precioCosto: Number(form.precioCosto) || 0, precio: Number(form.precio) || 0,
      stock: Number(form.stock), stockMinimo: Number(form.stockMinimo),
    }
    if (modal.editing) guardar('PUT', `/${modal.editing.id}`, body)
    else guardar('POST', '', body)
  }

  const cumpleFiltro = FILTROS.find(f => f.key === filtro)!.cumple
  const filtered = productos.filter(p => {
    if (filterCat && String(p.categoriaId) !== filterCat) return false
    if (!cumpleFiltro(p)) return false
    if (search) {
      const q = search.toLowerCase()
      if (!p.nombre.toLowerCase().includes(q) && !(p.codigo?.toLowerCase().includes(q))) return false
    }
    return true
  })
  const visibles = orden ? [...filtered].sort((a, b) => orden === 'asc' ? a.stock - b.stock : b.stock - a.stock) : filtered

  if (loading) return <div style={s.loading}>Cargando artículos...</div>

  return (
    <div className="page-container">
      <div style={s.toolbar}>
        <input style={s.search} placeholder="Buscar por nombre o código" value={search} onChange={e => setSearch(e.target.value)} />
        <select style={s.select} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
          <option value="">Todas las categorías</option>
          {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <button style={s.btnSecondary} onClick={() => exportarCsv(visibles)} disabled={!visibles.length}>
          <i className="bi bi-download" /> Exportar
        </button>
        {isAdmin && <button style={s.btnPrimary} onClick={() => abrir(null)}><i className="bi bi-plus-lg" /> Nuevo artículo</button>}
      </div>

      <div style={s.filtros}>
        {FILTROS.map(f => {
          const cantidad = productos.filter(f.cumple).length
          return (
            <button key={f.key} style={{ ...s.filtro, ...(filtro === f.key ? s.filtroActivo : {}) }} onClick={() => setFiltro(f.key)}>
              {f.label} <span style={f.key === 'reponer' && cantidad > 0 ? s.contadorAviso : s.contador}>{cantidad}</span>
            </button>
          )
        })}
      </div>

      <div>
        <div className="inv-row" style={s.thead}>
          <span>Artículo</span>
          <span className="inv-precio" style={s.derecha}>Precio</span>
          <button style={s.ordenStock} onClick={() => setOrden(o => SIGUIENTE_ORDEN[String(o)])} title="Ordenar por stock">
            Stock <i className={`bi ${orden === 'asc' ? 'bi-arrow-up' : orden === 'desc' ? 'bi-arrow-down' : 'bi-arrow-down-up'}`}
              style={{ color: orden ? '#111111' : '#C0C0C0' }} />
          </button>
          <span />
        </div>
        {visibles.length === 0
          ? <div style={s.empty}>No hay artículos para mostrar</div>
          : visibles.map(p => (
            <button key={p.id} className="inv-row" style={s.row} onClick={() => abrir(p)}>
              <span style={s.celdaNombre}>
                <span style={s.nombre}>{p.nombre}</span>
                <span style={s.meta}>{p.codigo ? `${p.codigo} · ` : ''}{p.categoria.nombre}</span>
              </span>
              <span className="inv-precio" style={{ ...s.derecha, ...s.valor }}>${fmt(p.precio)}</span>
              <span style={{ ...s.derecha, ...s.valor, ...(!p.activo ? s.inactivo : p.stock === 0 ? s.sinStock : p.stock <= p.stockMinimo ? s.bajo : {}) }}>
                {p.stock} u.
              </span>
              <i className="bi bi-chevron-right" style={s.chevron} />
            </button>
          ))
        }
      </div>

      {modal.open && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <div style={s.modalHeader}>
              <div>
                <h3 style={s.modalTitle}>{modal.editing ? modal.editing.nombre : 'Nuevo artículo'}</h3>
                {modal.editing && <p style={s.meta}>{modal.editing.codigo} · {modal.editing.activo ? 'Activo' : 'Inactivo'}</p>}
              </div>
              <button style={s.closeBtn} onClick={cerrar}><i className="bi bi-x-lg" /></button>
            </div>
            <form onSubmit={handleSubmit}>
              {/* El vendedor ve la ficha completa pero no puede modificarla */}
              <fieldset disabled={!isAdmin} style={s.fieldset}>
                <div style={s.field}>
                  <label style={s.label}>Nombre</label>
                  <input style={s.input} value={form.nombre} required onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Categoría</label>
                  <select style={s.input} value={form.categoriaId} required onChange={e => setForm(f => ({ ...f, categoriaId: e.target.value }))}>
                    <option value="">Seleccionar...</option>
                    {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
                <div style={s.field}>
                  <label style={s.label}>Descripción</label>
                  <textarea style={{ ...s.input, resize: 'vertical', minHeight: '60px' }} value={form.descripcion}
                    onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
                </div>

                <p style={s.seccion}>Precio</p>
                <div style={s.row3}>
                  <div style={s.field}>
                    <label style={s.label}>Costo</label>
                    <input style={s.input} type="number" min="0" step="0.01" value={form.precioCosto} onChange={e => handleCostChange(e.target.value)} />
                  </div>
                  <div style={s.field}>
                    <label style={s.label}>Margen %</label>
                    <input style={s.input} type="number" step="0.01" value={form.margen} onChange={e => handleMargenChange(e.target.value)} />
                  </div>
                  <div style={s.field}>
                    <label style={s.label}>Venta</label>
                    <input style={s.input} type="number" min="0" step="0.01" value={form.precio} required onChange={e => handleVentaChange(e.target.value)} />
                  </div>
                </div>

                <p style={s.seccion}>Stock</p>
                <div style={s.row3}>
                  <div style={s.field}>
                    <label style={s.label}>Unidades</label>
                    <input style={s.input} type="number" min="0" value={form.stock} required onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} />
                  </div>
                  <div style={s.field}>
                    <label style={s.label}>Stock mínimo (avisa al llegar)</label>
                    <input style={s.input} type="number" min="0" value={form.stockMinimo} onChange={e => setForm(f => ({ ...f, stockMinimo: e.target.value }))} />
                  </div>
                </div>
              </fieldset>

              {error && <p style={s.errorText}>{error}</p>}

              {confirmarBorrado ? (
                <div style={s.confirmar}>
                  <span style={s.texto}>¿Eliminar este artículo? No se puede deshacer.</span>
                  <button type="button" style={s.btnSecondary} onClick={() => setConfirmarBorrado(false)}>Cancelar</button>
                  <button type="button" style={s.btnDanger} onClick={() => guardar('DELETE', `/${modal.editing!.id}`)}>Eliminar</button>
                </div>
              ) : (
                <div style={s.modalActions}>
                  {isAdmin && modal.editing && (
                    <>
                      <button type="button" style={s.btnLink}
                        onClick={() => guardar('PUT', `/${modal.editing!.id}`, { activo: !modal.editing!.activo })}>
                        {modal.editing.activo ? 'Desactivar' : 'Activar'}
                      </button>
                      <button type="button" style={{ ...s.btnLink, color: '#C6402F' }} onClick={() => setConfirmarBorrado(true)}>Eliminar</button>
                    </>
                  )}
                  <span style={{ flex: 1 }} />
                  <button type="button" style={s.btnSecondary} onClick={cerrar}>{isAdmin ? 'Cancelar' : 'Cerrar'}</button>
                  {isAdmin && <button type="submit" style={s.btnPrimary}>{modal.editing ? 'Guardar' : 'Crear artículo'}</button>}
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  loading:      { color: '#6B6B6B', padding: '40px', textAlign: 'center' },
  toolbar:      { display: 'flex', gap: '10px', flexWrap: 'wrap' as const, alignItems: 'center' },
  search:       { flex: 1, minWidth: '200px', background: '#FFFFFF', border: '1px solid #D3D3D3', borderRadius: '8px', padding: '9px 14px', color: '#111111', fontSize: '14px', outline: 'none' },
  select:       { background: '#FFFFFF', border: '1px solid #D3D3D3', borderRadius: '8px', padding: '9px 14px', color: '#333333', fontSize: '13px', outline: 'none', cursor: 'pointer' },

  filtros:      { display: 'flex', gap: '20px', borderBottom: '1px solid #E2E4E8' },
  filtro:       { background: 'transparent', border: 'none', borderBottom: '2px solid transparent', padding: '8px 0', marginBottom: '-1px', color: '#6B6B6B', fontSize: '13px', fontWeight: '500', cursor: 'pointer' },
  filtroActivo: { color: '#111111', borderBottom: '2px solid #111111', fontWeight: '600' },
  contador:     { color: '#9A9A9A', marginLeft: '4px' },
  contadorAviso:{ color: '#B86E00', fontWeight: '700', marginLeft: '4px' },

  thead:        { color: '#9A9A9A', fontSize: '12px', padding: '8px 12px' },
  row:          { width: '100%', background: '#FFFFFF', border: 'none', borderBottom: '1px solid #EFF1F4', padding: '12px', cursor: 'pointer', textAlign: 'left', font: 'inherit' },
  celdaNombre:  { display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 },
  nombre:       { color: '#111111', fontSize: '14px', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  meta:         { color: '#8A8A8A', fontSize: '12px', margin: 0 },
  derecha:      { textAlign: 'right' as const },
  valor:        { color: '#111111', fontSize: '14px' },
  bajo:         { color: '#B86E00', fontWeight: '600' },
  inactivo:     { color: '#9A9A9A' },
  ordenStock:   { background: 'transparent', border: 'none', padding: 0, font: 'inherit', color: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifySelf: 'end', gap: '4px' },
  sinStock:     { color: '#C6402F', fontWeight: '600' },
  chevron:      { color: '#B0B0B0', fontSize: '12px', textAlign: 'right' as const },
  empty:        { color: '#6B6B6B', textAlign: 'center', padding: '48px 20px', fontSize: '14px' },

  overlay:      { position: 'fixed', inset: 0, background: 'rgba(17,17,17,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' },
  modal:        { background: '#FFFFFF', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 18px 46px rgba(17,17,17,.18)' },
  modalHeader:  { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' },
  modalTitle:   { color: '#111111', fontSize: '17px', fontWeight: '700', margin: '0 0 2px' },
  closeBtn:     { background: 'transparent', border: 'none', color: '#6B6B6B', fontSize: '18px', cursor: 'pointer' },
  fieldset:     { border: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' },
  seccion:      { color: '#6B6B6B', fontSize: '12px', fontWeight: '600', margin: '8px 0 -4px' },
  row3:         { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px' },
  field:        { display: 'flex', flexDirection: 'column', gap: '5px' },
  label:        { color: '#6B6B6B', fontSize: '12px' },
  input:        { background: '#FFFFFF', border: '1px solid #D3D3D3', borderRadius: '8px', padding: '9px 12px', color: '#111111', fontSize: '14px', outline: 'none', width: '100%', boxSizing: 'border-box' as const },
  errorText:    { color: '#C6402F', fontSize: '13px', margin: '12px 0 0' },
  texto:        { color: '#333333', fontSize: '13px', flex: 1 },

  modalActions: { display: 'flex', gap: '10px', alignItems: 'center', marginTop: '20px' },
  confirmar:    { display: 'flex', gap: '10px', alignItems: 'center', marginTop: '20px', background: '#FBE5E2', borderRadius: '10px', padding: '10px 12px' },
  btnPrimary:   { background: '#F5C400', color: '#111111', border: 'none', borderRadius: '8px', padding: '9px 18px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' },
  btnSecondary: { background: '#FFFFFF', color: '#333333', border: '1px solid #E2E4E8', borderRadius: '8px', padding: '9px 18px', fontWeight: '600', fontSize: '13px', cursor: 'pointer' },
  btnDanger:    { background: '#C6402F', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' },
  btnLink:      { background: 'transparent', border: 'none', color: '#333333', fontSize: '13px', fontWeight: '600', cursor: 'pointer', padding: '9px 4px' },
}
