import { useState } from 'react'
import type { User } from '../types'
import { API } from '../config'
import { puede } from '../permisos'
import { descargar, generarCsv, generarXlsx, hoy, imprimirTabla } from '../archivos'

interface Tabla { titulo: string; columnas: string[]; principales: string[]; filas: (string | number | null)[][] }
interface Producto { codigo: string | null; nombre: string; precio: number; stock: number; activo: boolean; tipoProducto: 'MAQUINARIA' | 'REPUESTO'; categoria: { id: number; nombre: string } }
interface Categoria { id: number; nombre: string }
type Formato = 'xlsx' | 'csv' | 'pdf'

const DATASETS: { clave: string; nombre: string; icono: string; descripcion: string }[] = [
  { clave: 'maquinaria', nombre: 'Maquinaria',         icono: 'bi-truck-front-fill', descripcion: 'Todas las máquinas con precios, stock y estado. Mismas columnas que la plantilla de importación.' },
  { clave: 'repuestos',  nombre: 'Repuestos',          icono: 'bi-nut-fill',         descripcion: 'Todos los repuestos con precios, stock y estado. Mismas columnas que la plantilla de importación.' },
  { clave: 'precios',    nombre: 'Lista de precios',   icono: 'bi-cash-stack',       descripcion: 'Lista de precios de todo lo activo (costo y ganancia si tu rol los puede ver, y precio final).' },
  { clave: 'clientes',   nombre: 'Clientes',           icono: 'bi-people-fill',      descripcion: 'Clientes con sus datos de contacto, condición frente al IVA y saldo de cuenta corriente.' },
  { clave: 'ventas',     nombre: 'Ventas',             icono: 'bi-receipt',          descripcion: 'Comprobantes emitidos, con cliente, vendedor, medio de pago, productos y total.' },
  { clave: 'servicios',  nombre: 'Servicios técnicos', icono: 'bi-tools',            descripcion: 'Servicios con cliente, equipo, técnico, estado y total cobrado.' },
  { clave: 'auditoria',  nombre: 'Auditoría',          icono: 'bi-shield-check',     descripcion: 'Registro de quién hizo cada cambio en el sistema (últimos 7 días).' },
]

const pesos = (n: number) => `$${n.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`

export default function Exportar({ user }: { user: User }) {
  const [trabajando, setTrabajando] = useState('')
  const [error, setError] = useState('')
  const [pdfAbierto, setPdfAbierto] = useState(false)
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [opciones, setOpciones] = useState({ tipo: 'todos', categorias: [] as number[], conPrecios: true, soloConStock: false })

  const headers = { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` }

  const exportar = async (clave: string, formato: Formato) => {
    setError(''); setTrabajando(`${clave}-${formato}`)
    try {
      const res = await fetch(`${API}/export/${clave}`, { headers })
      const t: Tabla = await res.json()
      if (!res.ok) throw new Error((t as unknown as { message: string }).message || 'No se pudo exportar')
      if (formato === 'xlsx') descargar(generarXlsx(t.titulo, t.columnas, t.filas), `${clave}-${hoy()}.xlsx`)
      else if (formato === 'csv') descargar(generarCsv(t.columnas, t.filas), `${clave}-${hoy()}.csv`)
      else {
        // El PDF lleva solo las columnas principales, para imprimir o mandar
        const idx = t.principales.map(c => t.columnas.indexOf(c)).filter(i => i >= 0)
        if (!imprimirTabla(t.titulo, `${t.filas.length} registro(s)`, idx.map(i => t.columnas[i]), t.filas.map(f => idx.map(i => f[i]))))
          throw new Error('El navegador bloqueó la ventana del PDF: permití las ventanas emergentes para este sitio')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo exportar')
    } finally { setTrabajando('') }
  }

  const abrirCatalogo = async () => {
    setPdfAbierto(true)
    if (!categorias.length) setCategorias(await fetch(`${API}/categories`, { headers }).then(r => r.json()))
  }

  // Catálogo en PDF: la selección de productos que se quiera, agrupada por categoría, con o sin precios
  const generarCatalogo = async () => {
    setError('')
    const productos: Producto[] = await fetch(`${API}/products`, { headers }).then(r => r.json())
    const elegidos = productos
      .filter(p => p.activo)
      .filter(p => opciones.tipo === 'todos' || p.tipoProducto === opciones.tipo)
      .filter(p => !opciones.categorias.length || opciones.categorias.includes(p.categoria.id))
      .filter(p => !opciones.soloConStock || p.stock > 0)
      .sort((a, b) => a.categoria.nombre.localeCompare(b.categoria.nombre, 'es') || a.nombre.localeCompare(b.nombre, 'es'))
    if (!elegidos.length) { setError('No hay productos activos con esa selección'); return }
    const columnas = ['Categoría', 'Código', 'Producto', 'Tipo', ...(opciones.conPrecios ? ['Precio'] : [])]
    const filas = elegidos.map(p => [p.categoria.nombre, p.codigo, p.nombre, p.tipoProducto === 'MAQUINARIA' ? 'Maquinaria' : 'Repuesto', ...(opciones.conPrecios ? [pesos(p.precio)] : [])])
    if (!imprimirTabla('Catálogo de productos', `${elegidos.length} producto(s)${opciones.conPrecios ? ' · precios en pesos' : ''}`, columnas, filas))
      setError('El navegador bloqueó la ventana del PDF: permití las ventanas emergentes para este sitio')
    else setPdfAbierto(false)
  }

  const alternarCategoria = (id: number) =>
    setOpciones(o => ({ ...o, categorias: o.categorias.includes(id) ? o.categorias.filter(x => x !== id) : [...o.categorias, id] }))

  return (
    <div className="admin-page">
      <div className="card-admin">
        <div className="card-admin__head">
          <h2><i className="bi bi-file-earmark-pdf" /> Catálogo en PDF</h2>
          <button type="button" className="btn btn-accent btn-sm" onClick={abrirCatalogo}><i className="bi bi-magic" /> Generar catálogo</button>
        </div>
        <div className="card-admin__body">
          <p className="text-muted-2" style={{ margin: 0 }}>
            Armá un PDF con la selección de productos que quieras (por tipo o categoría), con o sin precios,
            listo para mandar por email o imprimir.
          </p>
        </div>
      </div>

      <div className="card-admin">
        <div className="card-admin__body">
          <p className="text-muted-2" style={{ margin: 0 }}>
            <i className="bi bi-info-circle" style={{ color: 'var(--yellow-dark)' }} /> Cada botón descarga un archivo con los datos de ese momento:{' '}
            <strong>Excel</strong> y <strong>CSV</strong> traen <strong>todas las columnas</strong> para trabajarlo en una planilla;
            el <strong>PDF</strong> muestra sólo las columnas principales, para imprimir o mandar.
            {!puede(user, 'productos.costos') && <><br /><strong>Tu rol no incluye costos ni ganancias</strong>, así que esas columnas no se exportan.</>}
          </p>
        </div>
      </div>

      {error && <div className="admin-alert admin-alert--danger"><span>{error}</span></div>}

      <div className="export-grid">
        {DATASETS.map(d => (
          <div key={d.clave} className="card-admin export-card">
            <div className="card-admin__body export-card__body">
              <div className="export-card__titulo">
                <span className="admin-user__avatar" style={{ width: 46, height: 46, fontSize: '1.2rem' }}><i className={`bi ${d.icono}`} /></span>
                <strong>{d.nombre}</strong>
              </div>
              <p className="text-muted-2 small-text" style={{ flex: 1 }}>{d.descripcion}</p>
              <div className="export-card__botones">
                <button type="button" className="btn btn-accent btn-sm" disabled={!!trabajando} onClick={() => exportar(d.clave, 'xlsx')}>
                  <i className="bi bi-file-earmark-excel" /> Excel
                </button>
                <button type="button" className="btn btn-ghost btn-sm" disabled={!!trabajando} onClick={() => exportar(d.clave, 'csv')}>
                  <i className="bi bi-filetype-csv" /> CSV
                </button>
                <button type="button" className="btn btn-ghost btn-sm" disabled={!!trabajando} onClick={() => exportar(d.clave, 'pdf')}>
                  <i className="bi bi-file-earmark-pdf" /> PDF
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {pdfAbierto && (
        <div className="modal-admin-backdrop modal-admin-backdrop--center" onMouseDown={e => { if (e.target === e.currentTarget) setPdfAbierto(false) }}>
          <div className="modal-admin" role="dialog" aria-modal="true">
            <div className="modal-admin__head">
              <h3>Generar catálogo en PDF</h3>
              <button type="button" className="modal-admin__close" aria-label="Cerrar" onClick={() => setPdfAbierto(false)}><i className="bi bi-x-lg" /></button>
            </div>
            <div className="modal-admin__body">
              <div>
                <label className="form-label">Qué productos</label>
                <select className="form-select" value={opciones.tipo} onChange={e => setOpciones(o => ({ ...o, tipo: e.target.value }))}>
                  <option value="todos">Maquinaria y repuestos</option>
                  <option value="MAQUINARIA">Solo maquinaria</option>
                  <option value="REPUESTO">Solo repuestos</option>
                </select>
              </div>
              <div>
                <label className="form-label">Categorías <span className="text-muted-2">(ninguna marcada = todas)</span></label>
                <div className="picker">
                  {categorias.map(c => (
                    <label key={c.id} className="picker__item">
                      <input type="checkbox" checked={opciones.categorias.includes(c.id)} onChange={() => alternarCategoria(c.id)} /> {c.nombre}
                    </label>
                  ))}
                </div>
              </div>
              <label className="filter-check"><input type="checkbox" checked={opciones.conPrecios} onChange={e => setOpciones(o => ({ ...o, conPrecios: e.target.checked }))} /> Incluir precios</label>
              <label className="filter-check"><input type="checkbox" checked={opciones.soloConStock} onChange={e => setOpciones(o => ({ ...o, soloConStock: e.target.checked }))} /> Solo productos con stock</label>
            </div>
            <div className="modal-admin__foot" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setPdfAbierto(false)}>Cancelar</button>
              <button type="button" className="btn btn-accent" onClick={generarCatalogo}><i className="bi bi-file-earmark-pdf" /> Generar PDF</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
