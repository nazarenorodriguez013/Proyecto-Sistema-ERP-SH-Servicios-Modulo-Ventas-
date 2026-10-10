import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import type { User } from '../types'
import { API } from '../config'
import { socket } from '../socket'
import Dropdown from '../components/Dropdown'
import { puede } from '../permisos'

interface Categoria { id: number; nombre: string }
type TipoProducto = 'REPUESTO' | 'MAQUINARIA'
interface Producto {
  id: number; codigo: string | null; nombre: string; descripcion: string | null
  tipoProducto: TipoProducto
  precioCosto: number; precio: number; stock: number; stockMinimo: number
  activo: boolean; categoriaId: number; categoria: Categoria
}
interface ProductoForm {
  nombre: string; descripcion: string; tipoProducto: TipoProducto; categoriaId: string
  precioCosto: string; precio: string; margen: string
  stock: string; stockMinimo: string
}

// Textos de cada listado: Maquinaria y Repuestos son la misma pantalla filtrada por tipo, como en el catálogo
const TEXTOS: Record<TipoProducto, { titulo: string; icono: string; columna: string; plural: string; nuevo: string; crear: string; uno: string; ninguno: string; archivo: string }> = {
  MAQUINARIA: { titulo: 'Maquinaria', icono: 'bi-truck-front-fill', columna: 'Máquina',  plural: 'máquinas',  nuevo: 'Nueva máquina',  crear: 'Crear máquina',  uno: 'esta máquina',  ninguno: 'No hay máquinas que coincidan con los filtros.',  archivo: 'maquinaria' },
  REPUESTO:   { titulo: 'Repuestos',  icono: 'bi-nut-fill',         columna: 'Repuesto', plural: 'repuestos', nuevo: 'Nuevo repuesto', crear: 'Crear repuesto', uno: 'este repuesto', ninguno: 'No hay repuestos que coincidan con los filtros.', archivo: 'repuestos' },
}
const TIPO_LABEL: Record<TipoProducto, string> = { REPUESTO: 'Repuesto', MAQUINARIA: 'Maquinaria' }

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
const exportarCsv = (productos: Producto[], archivo: string) => {
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
  link.download = `${archivo}-${new Date().toLocaleDateString('sv-SE')}.csv`
  link.click()
  // Se libera en el ciclo siguiente: revocarlo en el acto puede cancelar la descarga en Firefox y Safari
  setTimeout(() => URL.revokeObjectURL(link.href))
}

type Filtro = 'activos' | 'reponer' | 'inactivos' | 'todos'
const FILTROS: { key: Filtro; label: string; cumple: (p: Producto) => boolean }[] = [
  { key: 'activos',   label: 'Activos',      cumple: p => p.activo },
  { key: 'reponer',   label: 'Para reponer', cumple: paraReponer },
  { key: 'inactivos', label: 'Inactivos',    cumple: p => !p.activo },
  { key: 'todos',     label: 'Todos',        cumple: () => true },
]

// Orden del listado: menú en el encabezado de la columna, agrupado como en el catálogo
type Orden = 'az' | 'za' | 'codigo_desc' | 'codigo' | 'precio_asc' | 'precio_desc' | 'stock_asc' | 'stock_desc'
const GRUPOS_ORDEN: { grupo: string; opciones: { key: Orden; label: string }[] }[] = [
  { grupo: 'Nombre', opciones: [{ key: 'az', label: 'A-Z' }, { key: 'za', label: 'Z-A' }] },
  { grupo: 'Código', opciones: [{ key: 'codigo_desc', label: 'Mayor a menor' }, { key: 'codigo', label: 'Menor a mayor' }] },
  { grupo: 'Precio', opciones: [{ key: 'precio_asc', label: 'Menor a mayor' }, { key: 'precio_desc', label: 'Mayor a menor' }] },
  { grupo: 'Stock',  opciones: [{ key: 'stock_asc', label: 'Menor a mayor' }, { key: 'stock_desc', label: 'Mayor a menor' }] },
]
const COMPARAR: Record<Orden, (a: Producto, b: Producto) => number> = {
  az:          (a, b) => a.nombre.localeCompare(b.nombre, 'es'),
  za:          (a, b) => b.nombre.localeCompare(a.nombre, 'es'),
  codigo:      (a, b) => (a.codigo ?? '').localeCompare(b.codigo ?? '', 'es', { numeric: true }),
  codigo_desc: (a, b) => (b.codigo ?? '').localeCompare(a.codigo ?? '', 'es', { numeric: true }),
  precio_asc:  (a, b) => a.precio - b.precio,
  precio_desc: (a, b) => b.precio - a.precio,
  stock_asc:   (a, b) => a.stock - b.stock,
  stock_desc:  (a, b) => b.stock - a.stock,
}

export default function Articulos({ user, tipo }: { user: User; tipo: TipoProducto }) {
  const t = TEXTOS[tipo]
  const emptyForm: ProductoForm = {
    nombre: '', descripcion: '', tipoProducto: tipo, categoriaId: '',
    precioCosto: '', precio: '', margen: '', stock: '0', stockMinimo: '5',
  }

  const [productos, setProductos] = useState<Producto[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  // Desde Inicio se puede llegar con un filtro ("Para reponer") o pidiendo abrir el alta ("Cargar una máquina")
  const { state } = useLocation()
  const [filtro, setFiltro] = useState<Filtro>(state?.filtro === 'reponer' ? 'reponer' : 'activos')
  const [orden, setOrden] = useState<Orden>('az')
  const [modal, setModal] = useState<{ open: boolean; editing: Producto | null }>({ open: false, editing: null })
  const [form, setForm] = useState<ProductoForm>(emptyForm)
  const [confirmarBorrado, setConfirmarBorrado] = useState<Producto | null>(null)
  const [error, setError] = useState('')

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` }
  // Editan los roles con "productos.editar"; el resto solo consulta. Costos y ganancia, solo con "productos.costos"
  const isAdmin = puede(user, 'productos.editar')
  const veCostos = puede(user, 'productos.costos')

  const fetchAll = () =>
    Promise.all([
      fetch(`${API}/products`, { headers }).then(r => r.json()),
      fetch(`${API}/categories`, { headers }).then(r => r.json()),
    ]).then(([prods, cats]) => { setProductos(prods); setCategorias(cats); setLoading(false) })

  useEffect(() => {
    fetchAll()
    if (state?.nuevo && isAdmin) abrir(null)
    socket.on('stock-actualizado', fetchAll)
    return () => { socket.off('stock-actualizado', fetchAll) }
  }, [])

  const abrir = (p: Producto | null) => {
    setForm(p ? {
      nombre: p.nombre, descripcion: p.descripcion ?? '', tipoProducto: p.tipoProducto, categoriaId: String(p.categoriaId),
      precioCosto: String(p.precioCosto), precio: String(p.precio),
      margen: calcMargen(p.precioCosto, p.precio),
      stock: String(p.stock), stockMinimo: String(p.stockMinimo),
    } : emptyForm)
    setError(''); setConfirmarBorrado(null); setModal({ open: true, editing: p })
  }
  const cerrar = () => { setModal({ open: false, editing: null }); setConfirmarBorrado(null) }

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

  // Todas las acciones sobre un artículo siguen el mismo patrón: llamar a la API y, si sale bien, cerrar y refrescar.
  // Si falla con el modal cerrado (acción desde el menú de la fila), el error se muestra arriba de la tabla.
  const guardar = async (method: string, path: string, body?: object) => {
    setError('')
    const res = await fetch(`${API}/products${path}`, { method, headers, body: body && JSON.stringify(body) })
    if (!res.ok) {
      const data = await res.json()
      setError(data.message || 'No se pudo guardar el artículo')
      setConfirmarBorrado(null)
      return
    }
    cerrar(); fetchAll()
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const body = {
      nombre: form.nombre, descripcion: form.descripcion || undefined, tipoProducto: form.tipoProducto,
      categoriaId: Number(form.categoriaId),
      precioCosto: Number(form.precioCosto) || 0, precio: Number(form.precio) || 0,
      stock: Number(form.stock), stockMinimo: Number(form.stockMinimo),
    }
    if (modal.editing) guardar('PUT', `/${modal.editing.id}`, body)
    else guardar('POST', '', body)
  }

  const delTipo = productos.filter(p => p.tipoProducto === tipo)
  const cumpleFiltro = FILTROS.find(f => f.key === filtro)!.cumple
  const visibles = delTipo.filter(p => {
    if (filterCat && String(p.categoriaId) !== filterCat) return false
    if (!cumpleFiltro(p)) return false
    if (search) {
      const q = search.toLowerCase()
      if (!p.nombre.toLowerCase().includes(q) && !(p.codigo?.toLowerCase().includes(q))) return false
    }
    return true
  }).sort(COMPARAR[orden])
  const hayFiltros = search !== '' || filterCat !== '' || filtro !== 'activos'
  const limpiar = () => { setSearch(''); setFilterCat(''); setFiltro('activos') }

  if (loading) return <div className="admin-page text-muted-2" style={{ textAlign: 'center', padding: '40px' }}>Cargando...</div>

  const reponer = delTipo.filter(paraReponer).length

  return (
    <div className="admin-page">
      <div className="admin-filters">
        <div>
          <label className="form-label" htmlFor="f-q">Buscar</label>
          <input type="search" className="form-control" id="f-q" placeholder="Nombre o código" autoFocus
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div>
          <label className="form-label" htmlFor="f-cat">Categoría</label>
          <select className="form-select" id="f-cat" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
            <option value="">Todas</option>
            {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label" htmlFor="f-estado">Estado</label>
          <select className="form-select" id="f-estado" value={filtro} onChange={e => setFiltro(e.target.value as Filtro)}>
            {FILTROS.map(f => <option key={f.key} value={f.key}>{f.label} ({delTipo.filter(f.cumple).length})</option>)}
          </select>
        </div>
        <div className="ms-auto">
          <button type="button" className="btn btn-ghost" onClick={limpiar} disabled={!hayFiltros}>Limpiar</button>
        </div>
      </div>

      {filtro !== 'reponer' && reponer > 0 && (
        <div className="admin-alert">
          <span><i className="bi bi-exclamation-triangle-fill" /> Hay <strong>{reponer}</strong> {reponer === 1 ? t.columna.toLowerCase() : t.plural} con stock bajo.</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFiltro('reponer')}>Ver para reponer</button>
        </div>
      )}

      {error && !modal.open && <div className="admin-alert admin-alert--danger"><span>{error}</span></div>}

      <div className="card-admin">
        <div className="card-admin__head">
          <h2>
            <i className={`bi ${t.icono}`} /> {t.titulo}
            <span className="text-muted-2">{visibles.length} registro(s)</span>
          </h2>
          <div className="card-admin__actions">
            {isAdmin && (
              <button type="button" className="btn btn-accent btn-sm" onClick={() => abrir(null)}>
                <i className="bi bi-plus-lg" /> {t.nuevo}
              </button>
            )}
            <button type="button" className="btn btn-ghost btn-sm" title="Exportar a Excel (CSV)" disabled={!visibles.length}
              onClick={() => exportarCsv(visibles, t.archivo)}>
              <i className="bi bi-file-earmark-excel" />
            </button>
          </div>
        </div>

        <div className="card-admin__body card-admin__body--flush">
          <div className="table-responsive-admin">
            <table className="table-admin">
              <thead>
                <tr>
                  <th>
                    <Dropdown triggerClassName="th-sort" title="Ordenar" trigger={<>{t.columna} <i className="bi bi-filter" /></>}>
                      {cerrarMenu => GRUPOS_ORDEN.map((g, i) => (
                        <div key={g.grupo}>
                          <h6 className="dropdown-header">{g.grupo}</h6>
                          {g.opciones.map(o => (
                            <button key={o.key} type="button" className={`dropdown-item${orden === o.key ? ' active' : ''}`}
                              onClick={() => { setOrden(o.key); cerrarMenu() }}>{o.label}</button>
                          ))}
                          {i < GRUPOS_ORDEN.length - 1 && <hr className="dropdown-divider" />}
                        </div>
                      ))}
                    </Dropdown>
                  </th>
                  <th>Categoría</th>
                  <th className="num">Precio</th>
                  <th className="num">Stock</th>
                  <th>Estado</th>
                  <th className="actions">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map(p => {
                  const margen = p.precioCosto ? (p.precio - p.precioCosto) / p.precioCosto * 100 : 0
                  return (
                    <tr key={p.id}>
                      <td>
                        <div className="table-product">
                          <span className="table-thumb"><i className={`bi ${t.icono}`} /></span>
                          <span>
                            <button type="button" className="table-product__name table-product__link" onClick={() => abrir(p)}>{p.nombre}</button>
                            <span className="table-product__meta text-mono">{p.codigo ?? '—'}</span>
                          </span>
                        </div>
                      </td>
                      <td>{p.categoria.nombre}</td>
                      <td className="num">
                        <strong>${fmt(p.precio)}</strong>
                        {veCostos && margen > 0 && <small className="d-block text-muted-2">+{Math.round(margen)}%</small>}
                      </td>
                      <td className="num">
                        <strong style={{ color: !p.activo ? 'var(--gray)' : p.stock === 0 ? 'var(--danger)' : p.stock <= p.stockMinimo ? '#97640B' : undefined }}>
                          {p.stock}
                        </strong>
                        <small className="d-block text-muted-2">mín. {p.stockMinimo}</small>
                      </td>
                      <td>
                        {!p.activo
                          ? <span className="chip chip--neutral">Inactivo</span>
                          : p.stock === 0
                            ? <span className="chip chip--danger">Sin stock</span>
                            : p.stock <= p.stockMinimo
                              ? <span className="chip chip--warn">Stock bajo</span>
                              : <span className="chip chip--ok">Activo</span>}
                      </td>
                      <td className="actions">
                        <Dropdown align="end" triggerClassName="btn-icon" title="Acciones" trigger={<i className="bi bi-three-dots-vertical" />}>
                          {cerrarMenu => <>
                            <button type="button" className="dropdown-item" onClick={() => { cerrarMenu(); abrir(p) }}>
                              <i className={`bi ${isAdmin ? 'bi-pencil' : 'bi-eye'}`} /> {isAdmin ? 'Editar' : 'Ver ficha'}
                            </button>
                            {isAdmin && <>
                              <button type="button" className="dropdown-item" onClick={() => { cerrarMenu(); guardar('PUT', `/${p.id}`, { activo: !p.activo }) }}>
                                <i className={`bi ${p.activo ? 'bi-eye-slash' : 'bi-eye'}`} /> {p.activo ? 'Desactivar' : 'Activar'}
                              </button>
                              <button type="button" className="dropdown-item"
                                onClick={() => { cerrarMenu(); guardar('PUT', `/${p.id}`, { tipoProducto: tipo === 'MAQUINARIA' ? 'REPUESTO' : 'MAQUINARIA' }) }}>
                                <i className="bi bi-arrow-repeat" /> Pasar a {tipo === 'MAQUINARIA' ? 'Repuestos' : 'Maquinaria'}
                              </button>
                              <hr className="dropdown-divider" />
                              <button type="button" className="dropdown-item text-danger" onClick={() => { cerrarMenu(); abrir(p); setConfirmarBorrado(p) }}>
                                <i className="bi bi-trash" /> Eliminar
                              </button>
                            </>}
                          </>}
                        </Dropdown>
                      </td>
                    </tr>
                  )
                })}

                {visibles.length === 0 && (
                  <tr>
                    <td colSpan={6} className="table-admin__empty">
                      <i className="bi bi-inbox" />
                      {t.ninguno}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {modal.open && (
        <div className="modal-admin-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) cerrar() }}>
          <div className="modal-admin" role="dialog" aria-modal="true">
            <div className="modal-admin__head">
              <div>
                <h3>{modal.editing ? modal.editing.nombre : t.nuevo}</h3>
                {modal.editing && (
                  <small className="text-muted-2">
                    <span className="text-mono">{modal.editing.codigo}</span> · {modal.editing.activo ? 'Activo' : 'Inactivo'}
                  </small>
                )}
              </div>
              <button type="button" className="modal-admin__close" aria-label="Cerrar" onClick={cerrar}><i className="bi bi-x-lg" /></button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-admin__body">
                {/* El vendedor ve la ficha completa pero no puede modificarla */}
                <fieldset className="form-fieldset" disabled={!isAdmin}>
                  <p className="form-section__title">Datos</p>
                  <div>
                    <label className="form-label">Nombre</label>
                    <input className="form-control" value={form.nombre} required onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
                  </div>
                  <div className="form-grid form-grid--2">
                    <div>
                      <label className="form-label">Categoría</label>
                      <select className="form-select" value={form.categoriaId} required onChange={e => setForm(f => ({ ...f, categoriaId: e.target.value }))}>
                        <option value="">Seleccionar...</option>
                        {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Tipo</label>
                      <select className="form-select" value={form.tipoProducto} onChange={e => setForm(f => ({ ...f, tipoProducto: e.target.value as TipoProducto }))}>
                        {(['MAQUINARIA', 'REPUESTO'] as const).map(x => <option key={x} value={x}>{TIPO_LABEL[x]}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="form-label">Descripción</label>
                    <textarea className="form-control" rows={2} style={{ resize: 'vertical' }} value={form.descripcion}
                      onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
                  </div>

                  <p className="form-section__title">Precio</p>
                  <div className={`form-grid ${veCostos ? 'form-grid--3' : 'form-grid--2'}`}>
                    {veCostos && <>
                      <div>
                        <label className="form-label">Costo</label>
                        <input className="form-control" type="number" min="0" step="0.01" value={form.precioCosto} onChange={e => handleCostChange(e.target.value)} />
                      </div>
                      <div>
                        <label className="form-label">Margen %</label>
                        <input className="form-control" type="number" step="0.01" value={form.margen} onChange={e => handleMargenChange(e.target.value)} />
                      </div>
                    </>}
                    <div>
                      <label className="form-label">Venta</label>
                      <input className="form-control" type="number" min="0" step="0.01" value={form.precio} required onChange={e => handleVentaChange(e.target.value)} />
                    </div>
                  </div>

                  <p className="form-section__title">Stock</p>
                  <div className="form-grid form-grid--3">
                    <div>
                      <label className="form-label">Unidades</label>
                      <input className="form-control" type="number" min="0" value={form.stock} required onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} />
                    </div>
                    <div>
                      <label className="form-label">Stock mínimo</label>
                      <input className="form-control" type="number" min="0" value={form.stockMinimo} onChange={e => setForm(f => ({ ...f, stockMinimo: e.target.value }))} />
                    </div>
                  </div>
                </fieldset>

                {error && <p className="form-error">{error}</p>}
              </div>

              <div className="modal-admin__foot">
                {confirmarBorrado ? (
                  <div className="modal-admin__confirm">
                    <span style={{ flex: 1 }}>¿Eliminar {t.uno}? Esta acción no se puede deshacer.</span>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmarBorrado(null)}>Cancelar</button>
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => guardar('DELETE', `/${confirmarBorrado.id}`)}>Eliminar</button>
                  </div>
                ) : <>
                  {isAdmin && modal.editing && <>
                    <button type="button" className="btn btn-ghost btn-sm"
                      onClick={() => guardar('PUT', `/${modal.editing!.id}`, { activo: !modal.editing!.activo })}>
                      {modal.editing.activo ? 'Desactivar' : 'Activar'}
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm text-danger" onClick={() => setConfirmarBorrado(modal.editing)}>Eliminar</button>
                  </>}
                  <span style={{ flex: 1 }} />
                  <button type="button" className="btn btn-ghost btn-sm" onClick={cerrar}>{isAdmin ? 'Cancelar' : 'Cerrar'}</button>
                  {isAdmin && <button type="submit" className="btn btn-accent btn-sm">{modal.editing ? 'Guardar' : t.crear}</button>}
                </>}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
