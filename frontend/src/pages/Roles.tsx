import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { API } from '../config'
import { SLUG_ADMIN } from '../permisos'

interface Rol { id: number; nombre: string; slug: string; descripcion: string | null; esSistema: boolean; activo: boolean; usuarios: number; permisos: string[] }
interface Modulo { modulo: string; nombre: string; permisos: { clave: string; nombre: string }[] }

const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` })

const pedir = async (method: string, path: string, body?: object) => {
  const res = await fetch(`${API}/roles${path}`, { method, headers: headers(), body: body && JSON.stringify(body) })
  if (res.status === 204) return null
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || 'No se pudo guardar')
  return data
}

// Listado de roles + alta (como "Roles" del panel del catálogo); con rolId muestra la edición de permisos
export default function Roles({ rolId }: { rolId?: number }) {
  return rolId ? <EditarRol id={rolId} /> : <ListaRoles />
}

function ListaRoles() {
  const navegar = useNavigate()
  const [roles, setRoles] = useState<Rol[]>([])
  const [modulos, setModulos] = useState<Modulo[]>([])
  const [nuevo, setNuevo] = useState({ nombre: '', descripcion: '', permisos: [] as string[] })
  const [borrando, setBorrando] = useState<Rol | null>(null)
  const [error, setError] = useState('')
  const [errorAlta, setErrorAlta] = useState('')

  const cargar = () => Promise.all([pedir('GET', ''), pedir('GET', '/permisos')]).then(([r, m]) => { setRoles(r); setModulos(m) })
  useEffect(() => { cargar() }, [])

  const crear = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorAlta('')
    try {
      await pedir('POST', '', nuevo)
      setNuevo({ nombre: '', descripcion: '', permisos: [] }); cargar()
    } catch (err) { setErrorAlta((err as Error).message) }
  }

  const eliminar = async () => {
    setError('')
    try { await pedir('DELETE', `/${borrando!.id}`); setBorrando(null); cargar() }
    catch (err) { setError((err as Error).message) }
  }

  const alternar = (clave: string) =>
    setNuevo(n => ({ ...n, permisos: n.permisos.includes(clave) ? n.permisos.filter(p => p !== clave) : [...n.permisos, clave] }))

  return (
    <div className="admin-page">
      <div className="admin-grid-8-4">
        <div className="card-admin">
          <div className="card-admin__head">
            <h2><i className="bi bi-key-fill" /> Roles</h2>
            <span className="text-muted-2" style={{ fontSize: '.875rem' }}>{roles.length} rol(es)</span>
          </div>
          <div className="card-admin__body card-admin__body--flush">
            <div className="table-responsive-admin">
              <table className="table-admin">
                <thead>
                  <tr><th>Rol</th><th>Descripción</th><th className="num">Usuarios</th><th className="num">Permisos</th><th>Tipo</th><th className="actions">Acciones</th></tr>
                </thead>
                <tbody>
                  {roles.map(r => (
                    <tr key={r.id}>
                      <td>
                        <span className="table-product__name">{r.nombre}</span>
                        <span className="table-product__meta text-mono">{r.slug}</span>
                        {!r.activo && <span className="chip chip--danger" style={{ marginTop: 4 }}>Desactivado</span>}
                      </td>
                      <td className="text-muted-2 small-text">{r.descripcion}</td>
                      <td className="num">{r.usuarios}</td>
                      <td className="num">{r.slug === SLUG_ADMIN ? <span className="chip chip--accent">Todos</span> : r.permisos.length}</td>
                      <td>{r.esSistema ? <span className="chip chip--neutral">Sistema</span> : <span className="chip chip--info">Personalizado</span>}</td>
                      <td className="actions">
                        <button type="button" className="btn-icon" title="Editar permisos" onClick={() => navegar(`/roles/${r.id}`)}><i className="bi bi-sliders" /></button>{' '}
                        {!r.esSistema && (
                          <button type="button" className="btn-icon btn-icon--danger" title="Eliminar" onClick={() => { setError(''); setBorrando(r) }}><i className="bi bi-trash" /></button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="card-admin">
          <div className="card-admin__head"><h2><i className="bi bi-plus-circle" /> Nuevo rol</h2></div>
          <div className="card-admin__body">
            <form onSubmit={crear} className="form-stack">
              <div>
                <label className="form-label" htmlFor="r-name">Nombre *</label>
                <input className="form-control" id="r-name" required maxLength={60} placeholder="Ej: Encargado de depósito"
                  value={nuevo.nombre} onChange={e => setNuevo({ ...nuevo, nombre: e.target.value })} />
              </div>
              <div>
                <label className="form-label" htmlFor="r-desc">Descripción</label>
                <input className="form-control" id="r-desc" maxLength={255} value={nuevo.descripcion} onChange={e => setNuevo({ ...nuevo, descripcion: e.target.value })} />
              </div>
              <div>
                <label className="form-label">Permisos iniciales</label>
                <div className="picker" style={{ maxHeight: 340 }}>
                  {modulos.map(m => (
                    <div key={m.modulo}>
                      <div className="perm-module__head"><strong>{m.nombre}</strong></div>
                      {m.permisos.map(p => (
                        <label key={p.clave} className="picker__item">
                          <input type="checkbox" checked={nuevo.permisos.includes(p.clave)} onChange={() => alternar(p.clave)} />
                          <span>{p.nombre}</span>
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
              {errorAlta && <p className="form-error">{errorAlta}</p>}
              <button type="submit" className="btn btn-accent" style={{ width: '100%' }}><i className="bi bi-plus-lg" /> Crear rol</button>
            </form>
          </div>
        </div>
      </div>

      {borrando && (
        <div className="modal-admin-backdrop modal-admin-backdrop--center" onMouseDown={e => { if (e.target === e.currentTarget) setBorrando(null) }}>
          <div className="modal-admin modal-admin--sm" role="dialog" aria-modal="true">
            <div className="modal-admin__head">
              <h3>Eliminar rol</h3>
              <button type="button" className="modal-admin__close" aria-label="Cerrar" onClick={() => setBorrando(null)}><i className="bi bi-x-lg" /></button>
            </div>
            <div className="modal-admin__body">
              <p style={{ margin: 0 }}>¿Eliminar el rol «{borrando.nombre}»?</p>
              {error && <p className="form-error">{error}</p>}
            </div>
            <div className="modal-admin__foot" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setBorrando(null)}>Cancelar</button>
              <button type="button" className="btn btn-danger" onClick={eliminar}><i className="bi bi-trash" /> Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function EditarRol({ id }: { id: number }) {
  const navegar = useNavigate()
  const [rol, setRol] = useState<Rol | null>(null)
  const [modulos, setModulos] = useState<Modulo[]>([])
  const [form, setForm] = useState({ nombre: '', descripcion: '', activo: true, permisos: [] as string[] })
  const [error, setError] = useState('')
  const [guardado, setGuardado] = useState(false)

  useEffect(() => {
    Promise.all([pedir('GET', `/${id}`), pedir('GET', '/permisos')])
      .then(([r, m]: [Rol, Modulo[]]) => {
        setRol(r); setModulos(m)
        setForm({ nombre: r.nombre, descripcion: r.descripcion ?? '', activo: r.activo, permisos: r.permisos })
      })
      .catch(err => setError(err.message))
  }, [id])

  if (!rol) return <div className="admin-page text-muted-2" style={{ textAlign: 'center', padding: '40px' }}>{error || 'Cargando...'}</div>

  const esAdmin = rol.slug === SLUG_ADMIN
  const todas = modulos.flatMap(m => m.permisos.map(p => p.clave))
  const todasMarcadas = todas.every(p => form.permisos.includes(p))
  const alternar = (clave: string) =>
    setForm(f => ({ ...f, permisos: f.permisos.includes(clave) ? f.permisos.filter(p => p !== clave) : [...f.permisos, clave] }))

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setGuardado(false)
    try {
      const r: Rol = await pedir('PUT', `/${id}`, { nombre: form.nombre, descripcion: form.descripcion, ...(rol.esSistema ? {} : { activo: form.activo }), permisos: form.permisos })
      setRol(r); setGuardado(true)
    } catch (err) { setError((err as Error).message) }
  }

  return (
    <form className="admin-page" onSubmit={guardar}>
      <div className="card-admin">
        <div className="card-admin__head">
          <h2><i className="bi bi-key-fill" /> {rol.nombre}</h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => navegar('/roles')}><i className="bi bi-arrow-left" /> Volver</button>
        </div>
        <div className="card-admin__body">
          <div className="rol-datos">
            <div>
              <label className="form-label" htmlFor="r-name">Nombre *</label>
              <input className="form-control" id="r-name" required maxLength={60} value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
            </div>
            <div>
              <label className="form-label" htmlFor="r-desc">Descripción</label>
              <input className="form-control" id="r-desc" maxLength={255} value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} />
            </div>
            <label className="filter-check" title={rol.esSistema ? 'Los roles de sistema no se pueden desactivar' : undefined}>
              <input type="checkbox" checked={form.activo} disabled={rol.esSistema} onChange={e => setForm({ ...form, activo: e.target.checked })} /> Activo
            </label>
          </div>
          {esAdmin && (
            <div className="admin-alert" style={{ marginTop: 16, marginBottom: 0 }}>
              <span><i className="bi bi-shield-fill-exclamation" /> El rol <strong>Administrador</strong> siempre conserva acceso total: sus permisos no se pueden recortar
                desde acá para evitar que el sistema quede sin nadie que lo administre.</span>
            </div>
          )}
        </div>
      </div>

      <div className="card-admin">
        <div className="card-admin__head">
          <h2><i className="bi bi-list-check" /> Permisos</h2>
          {!esAdmin && (
            <label className="filter-check" style={{ margin: 0 }}>
              <input type="checkbox" checked={todasMarcadas} onChange={() => setForm(f => ({ ...f, permisos: todasMarcadas ? [] : todas }))} /> Marcar todos
            </label>
          )}
        </div>
        <div className="card-admin__body">
          {modulos.map(m => (
            <div key={m.modulo} className="perm-module">
              <div className="perm-module__head">
                <strong>{m.nombre}</strong>
                <span className="text-muted-2 small-text">{m.permisos.length} permiso(s)</span>
              </div>
              <div className="perm-module__body">
                {m.permisos.map(p => (
                  <label key={p.clave} className="perm-check" title={p.clave}>
                    <input type="checkbox" checked={esAdmin || form.permisos.includes(p.clave)} disabled={esAdmin} onChange={() => alternar(p.clave)} />
                    <span>{p.nombre}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="form-sticky-actions">
        {error && <span className="form-error" style={{ margin: 0, marginRight: 'auto' }}>{error}</span>}
        {guardado && <span className="text-ok" style={{ marginRight: 'auto' }}><i className="bi bi-check-circle-fill" /> Permisos guardados</span>}
        <button type="button" className="btn btn-ghost" onClick={() => navegar('/roles')}>Cancelar</button>
        <button type="submit" className="btn btn-accent"><i className="bi bi-check-lg" /> Guardar permisos</button>
      </div>
    </form>
  )
}
