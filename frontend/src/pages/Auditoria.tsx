import { useState, useEffect } from 'react'
import type { User } from '../types'
import { API } from '../config'
import { puede } from '../permisos'
import { descargar, generarXlsx, hoy } from '../archivos'
import PagosEliminados from '../components/PagosEliminados'

interface Evento {
  id: number; usuarioNombre: string | null; accion: string; seccion: string; descripcion: string
  datos: Record<string, unknown> | null; ip: string | null; creadoEn: string
}
interface Respuesta {
  total: number; pagina: number; paginas: number; eventos: Evento[]
  secciones: string[]; acciones: string[]; usuarios: { id: number; nombre: string }[]
}
type Filtros = { q: string; seccion: string; accion: string; usuario: string; desde: string; hasta: string }

const VACIOS: Filtros = { q: '', seccion: '', accion: '', usuario: '', desde: '', hasta: '' }

const ACCIONES: Record<string, string> = {
  create: 'Alta', update: 'Cambio', delete: 'Baja', deactivate: 'Desactivación', login: 'Ingreso', login_failed: 'Ingreso fallido',
  access_denied: 'Acceso denegado', price_change: 'Cambio de precio', permissions_change: 'Cambio de permisos',
  settings_change: 'Configuración', import: 'Importación', export: 'Exportación',
}
const SECCIONES: Record<string, string> = {
  acceso: 'Acceso', seguridad: 'Seguridad', usuarios: 'Usuarios', roles: 'Roles', maquinaria: 'Maquinaria', repuestos: 'Repuestos',
  categorias: 'Categorías', clientes: 'Clientes', ventas: 'Ventas', servicios: 'Servicios técnicos', tecnicos: 'Técnicos',
  configuracion: 'Configuración', importar: 'Importar', exportar: 'Exportar',
}

// Verde lo normal, amarillo los cambios importantes y rojo lo que conviene revisar (igual que el catálogo)
const claseChip = (accion: string) =>
  ['delete', 'deactivate', 'access_denied', 'login_failed'].includes(accion) ? 'danger'
    : ['create', 'login'].includes(accion) ? 'ok'
    : ['price_change', 'permissions_change', 'settings_change', 'update'].includes(accion) ? 'warn'
    : 'neutral'

const fecha = (iso: string) => new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const hace = (iso: string) => {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'recién'
  if (min < 60) return `hace ${min} min`
  if (min < 1440) return `hace ${Math.round(min / 60)} h`
  return `hace ${Math.round(min / 1440)} día(s)`
}
const origen = (ip: string | null) => !ip || ['::1', '127.0.0.1', 'localhost'].includes(ip) ? 'Este equipo' : ip
const texto = (v: unknown) => v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)
const esCambio = (c: unknown): c is { antes: unknown; ahora: unknown } => !!c && typeof c === 'object' && 'antes' in c

export default function Auditoria({ user }: { user: User }) {
  const [filtros, setFiltros] = useState<Filtros>(VACIOS)
  const [aplicados, setAplicados] = useState<Filtros>(VACIOS)
  const [pagina, setPagina] = useState(1)
  const [datos, setDatos] = useState<Respuesta | null>(null)
  const [detalle, setDetalle] = useState<Evento | null>(null)
  const [error, setError] = useState('')

  const headers = { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` }

  useEffect(() => {
    const qs = new URLSearchParams({ ...aplicados, pagina: String(pagina) })
    fetch(`${API}/audit?${qs}`, { headers }).then(r => r.json()).then(setDatos).catch(() => setError('No se pudo cargar el registro'))
  }, [aplicados, pagina])

  const filtrar = (e: React.FormEvent) => { e.preventDefault(); setPagina(1); setAplicados(filtros) }
  const limpiar = () => { setFiltros(VACIOS); setAplicados(VACIOS); setPagina(1) }

  const exportar = async () => {
    const res = await fetch(`${API}/export/auditoria`, { headers })
    const t = await res.json()
    if (!res.ok) { setError(t.message || 'No se pudo exportar'); return }
    descargar(generarXlsx(t.titulo, t.columnas, t.filas), `auditoria-${hoy()}.xlsx`)
  }

  const cambios = detalle?.datos ?? null
  const conAntesAhora = !!cambios && Object.values(cambios).some(esCambio)

  return (
    <div className="admin-page">
      <p className="text-muted-2 small-text" style={{ margin: '0 0 8px' }}>
        <i className="bi bi-info-circle" /> Acá queda registrado quién hizo cada cambio en el sistema. Los registros se guardan 7 días y después se borran solos.
      </p>
      <div className="leyenda">
        <span><span className="chip chip--ok">Alta / Ingreso</span> acción normal</span>
        <span><span className="chip chip--warn">Cambio</span> modificación importante</span>
        <span><span className="chip chip--danger">Baja / Fallido</span> conviene revisar</span>
      </div>

      <form className="admin-filters admin-filters--audit" onSubmit={filtrar}>
        <div className="admin-filters__fields">
          <div>
            <label className="form-label" htmlFor="f-q">Buscar</label>
            <input type="search" className="form-control" id="f-q" placeholder="Descripción, usuario o IP" value={filtros.q} onChange={e => setFiltros({ ...filtros, q: e.target.value })} />
          </div>
          <div>
            <label className="form-label" htmlFor="f-sec">Sección</label>
            <select className="form-select" id="f-sec" value={filtros.seccion} onChange={e => setFiltros({ ...filtros, seccion: e.target.value })}>
              <option value="">Todas</option>
              {datos?.secciones.map(s => <option key={s} value={s}>{SECCIONES[s] ?? s}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="f-acc">Acción</label>
            <select className="form-select" id="f-acc" value={filtros.accion} onChange={e => setFiltros({ ...filtros, accion: e.target.value })}>
              <option value="">Todas</option>
              {datos?.acciones.map(a => <option key={a} value={a}>{ACCIONES[a] ?? a}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="f-usr">Usuario</label>
            <select className="form-select" id="f-usr" value={filtros.usuario} onChange={e => setFiltros({ ...filtros, usuario: e.target.value })}>
              <option value="">Todos</option>
              {datos?.usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="f-desde">Desde</label>
            <input type="date" className="form-control" id="f-desde" value={filtros.desde} onChange={e => setFiltros({ ...filtros, desde: e.target.value })} />
          </div>
          <div>
            <label className="form-label" htmlFor="f-hasta">Hasta</label>
            <input type="date" className="form-control" id="f-hasta" value={filtros.hasta} onChange={e => setFiltros({ ...filtros, hasta: e.target.value })} />
          </div>
        </div>
        <div className="admin-filters__actions">
          <div className="card-admin__actions">
            <button type="submit" className="btn btn-dark-2"><i className="bi bi-funnel" /> Filtrar</button>
            <button type="button" className="btn btn-ghost" onClick={limpiar}>Limpiar</button>
          </div>
          {puede(user, 'datos.exportar') && (
            <button type="button" className="btn btn-ghost" onClick={exportar}><i className="bi bi-file-earmark-excel" /> Exportar</button>
          )}
        </div>
      </form>

      {error && <div className="admin-alert admin-alert--danger"><span>{error}</span></div>}

      <div className="card-admin">
        <div className="card-admin__head">
          <h2><i className="bi bi-shield-check" /> Registro de auditoría</h2>
          <span className="text-muted-2" style={{ fontSize: '.875rem' }}>{datos?.total ?? 0} evento(s)</span>
        </div>
        <div className="card-admin__body card-admin__body--flush">
          <div className="table-responsive-admin">
            <table className="table-admin">
              <thead><tr><th>Cuándo</th><th>Quién</th><th>Acción</th><th>Sección</th><th>Qué pasó</th><th>Origen</th><th>Cambios</th></tr></thead>
              <tbody>
                {datos?.eventos.map(ev => (
                  <tr key={ev.id}>
                    <td className="small-text" style={{ whiteSpace: 'nowrap' }}>{fecha(ev.creadoEn)}<small className="d-block text-muted-2">{hace(ev.creadoEn)}</small></td>
                    <td>{ev.usuarioNombre ?? 'Sistema'}</td>
                    <td><span className={`chip chip--${claseChip(ev.accion)}`}>{ACCIONES[ev.accion] ?? ev.accion}</span></td>
                    <td className="text-muted-2 small-text">{SECCIONES[ev.seccion] ?? ev.seccion}</td>
                    <td className="small-text">{ev.descripcion}</td>
                    <td className="small-text text-muted-2">{origen(ev.ip)}</td>
                    <td>{ev.datos && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDetalle(ev)}>Ver</button>}</td>
                  </tr>
                ))}
                {datos && datos.eventos.length === 0 && (
                  <tr><td colSpan={7} className="table-admin__empty"><i className="bi bi-inbox" />No hay eventos con esos filtros.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        {datos && datos.paginas > 1 && (
          <div className="card-admin__foot paginacion">
            <button type="button" className="btn btn-ghost btn-sm" disabled={pagina <= 1} onClick={() => setPagina(p => p - 1)}><i className="bi bi-chevron-left" /> Anterior</button>
            <span className="text-muted-2 small-text">Página {datos.pagina} de {datos.paginas}</span>
            <button type="button" className="btn btn-ghost btn-sm" disabled={pagina >= datos.paginas} onClick={() => setPagina(p => p + 1)}>Siguiente <i className="bi bi-chevron-right" /></button>
          </div>
        )}
      </div>

      <PagosEliminados />

      {detalle && (
        <div className="modal-admin-backdrop modal-admin-backdrop--center" onMouseDown={e => { if (e.target === e.currentTarget) setDetalle(null) }}>
          <div className="modal-admin modal-admin--lg" role="dialog" aria-modal="true">
            <div className="modal-admin__head">
              <h3>Detalle del evento #{detalle.id}</h3>
              <button type="button" className="modal-admin__close" aria-label="Cerrar" onClick={() => setDetalle(null)}><i className="bi bi-x-lg" /></button>
            </div>
            <div className="modal-admin__body">
              <p className="text-muted-2 small-text" style={{ margin: 0 }}>{fecha(detalle.creadoEn)} · {detalle.usuarioNombre ?? 'Sistema'} · {origen(detalle.ip)}</p>
              <p style={{ margin: 0 }}>{detalle.descripcion}</p>
              {conAntesAhora ? (
                <div className="table-responsive-admin">
                  <table className="table-admin">
                    <thead><tr><th>Campo</th><th>Antes</th><th>Ahora</th></tr></thead>
                    <tbody>
                      {Object.entries(cambios!).map(([campo, c]) => (
                        <tr key={campo}>
                          <td className="small-text">{campo}</td>
                          {esCambio(c)
                            ? <><td className="small-text text-muted-2">{texto(c.antes).slice(0, 80)}</td><td className="small-text"><strong>{texto(c.ahora).slice(0, 80)}</strong></td></>
                            : <td colSpan={2} className="small-text">{texto(c)}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : cambios && (
                <ul className="small-text" style={{ margin: 0 }}>
                  {Object.entries(cambios).map(([k, v]) => <li key={k}><strong>{k}:</strong> {texto(v)}</li>)}
                </ul>
              )}
            </div>
            <div className="modal-admin__foot" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setDetalle(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
