import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { User } from '../types'
import { API } from '../config'
import { puede, SLUG_ADMIN } from '../permisos'
import Dropdown from '../components/Dropdown'

interface Rol { id: number; nombre: string; slug: string; descripcion: string | null; usuarios: number; permisos: string[]; activo: boolean }
interface Usuario {
  id: number; nombre: string; correo: string; activo: boolean; telefono: string | null; puesto: string | null
  rolId: number; rol: { id: number; nombre: string; slug: string }
  ultimoAcceso: string | null; ultimaIp: string | null; bloqueadoHasta: string | null; dosPasos: boolean; debeCambiarContrasena: boolean
}
interface Form {
  nombre: string; correo: string; contrasena: string; repetir: string; rolId: string; telefono: string; puesto: string
  activo: boolean; debeCambiarContrasena: boolean; desbloquear: boolean; quitarDosPasos: boolean
}

const fecha = (iso: string | null) => iso ? new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Nunca'
const origen = (ip: string | null) => !ip ? '' : ['::1', '127.0.0.1', 'localhost'].includes(ip) ? 'Este equipo' : ip
const bloqueado = (u: Usuario) => !!u.bloqueadoHasta && new Date(u.bloqueadoHasta) > new Date()

// Campo de texto del formulario de usuario (alta o edición)
function Campo({ datos, set, k, label, ...extra }: { datos: Form; set: (f: Form) => void; k: keyof Form; label: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'form'>) {
  return (
    <div>
      <label className="form-label">{label}</label>
      <input className="form-control" value={String(datos[k])} onChange={e => set({ ...datos, [k]: e.target.value })} {...extra} />
    </div>
  )
}

export default function Usuarios({ user }: { user: User }) {
  const navegar = useNavigate()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [roles, setRoles] = useState<Rol[]>([])
  const [cargando, setCargando] = useState(true)
  const [nuevo, setNuevo] = useState<Form | null>(null)
  const [editando, setEditando] = useState<Usuario | null>(null)
  const [form, setForm] = useState<Form | null>(null)
  const [confirmar, setConfirmar] = useState<{ tipo: 'desactivar' | 'eliminar'; usuario: Usuario } | null>(null)
  const [error, setError] = useState('')
  const [errorAlta, setErrorAlta] = useState('')
  const [aviso, setAviso] = useState('')

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` }
  const puedeGestionar = puede(user, 'usuarios.gestionar')
  const soyAdmin = user.rol.slug === SLUG_ADMIN
  // Solo un administrador puede dar el rol Administrador, y nunca se ofrece por defecto
  const rolesAsignables = roles.filter(r => soyAdmin || r.slug !== SLUG_ADMIN)
  const formVacio = (): Form => ({
    nombre: '', correo: '', contrasena: '', repetir: '', rolId: String(rolesAsignables.find(r => r.slug !== SLUG_ADMIN && r.activo)?.id ?? ''),
    telefono: '', puesto: '', activo: true, debeCambiarContrasena: false, desbloquear: false, quitarDosPasos: false,
  })

  const cargar = () => Promise.all([
    fetch(`${API}/users`, { headers }).then(r => r.json()),
    fetch(`${API}/roles`, { headers }).then(r => r.json()),
  ]).then(([u, r]) => { setUsuarios(u); setRoles(r); setCargando(false) })

  useEffect(() => { cargar() }, [])
  useEffect(() => { if (roles.length && !nuevo) setNuevo(formVacio()) }, [roles])

  const llamar = async (method: string, path: string, body?: object) => {
    const res = await fetch(`${API}/users${path}`, { method, headers, body: body && JSON.stringify(body) })
    if (res.status === 204) return null
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'No se pudo guardar')
    return data
  }

  const crear = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nuevo) return
    setErrorAlta('')
    if (nuevo.contrasena !== nuevo.repetir) { setErrorAlta('Las contraseñas no coinciden'); return }
    try {
      const { repetir: _r, desbloquear: _d, quitarDosPasos: _q, ...datos } = nuevo
      await llamar('POST', '', { ...datos, rolId: Number(nuevo.rolId) })
      setNuevo(formVacio()); setAviso('Usuario creado'); cargar()
    } catch (err) { setErrorAlta((err as Error).message) }
  }

  const abrirEdicion = (u: Usuario) => {
    setError('')
    setForm({
      nombre: u.nombre, correo: u.correo, contrasena: '', repetir: '', rolId: String(u.rolId), telefono: u.telefono ?? '', puesto: u.puesto ?? '',
      activo: u.activo, debeCambiarContrasena: u.debeCambiarContrasena, desbloquear: false, quitarDosPasos: false,
    })
    setEditando(u)
  }

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editando || !form) return
    setError('')
    try {
      const { repetir: _r, contrasena, quitarDosPasos, ...resto } = form
      await llamar('PUT', `/${editando.id}`, { ...resto, rolId: Number(form.rolId), ...(contrasena ? { contrasena } : {}), ...(quitarDosPasos ? { dosPasos: false } : {}) })
      setEditando(null); setAviso('Usuario actualizado'); cargar()
    } catch (err) { setError((err as Error).message) }
  }

  const ejecutarConfirmacion = async () => {
    if (!confirmar) return
    setError('')
    try {
      if (confirmar.tipo === 'desactivar') await llamar('PUT', `/${confirmar.usuario.id}`, { activo: false })
      else await llamar('DELETE', `/${confirmar.usuario.id}`)
      setAviso(confirmar.tipo === 'desactivar' ? 'Cuenta desactivada' : 'Usuario eliminado')
      setConfirmar(null); cargar()
    } catch (err) { setError((err as Error).message) }
  }

  if (cargando) return <div className="admin-page text-muted-2" style={{ textAlign: 'center', padding: '40px' }}>Cargando...</div>

  return (
    <div className="admin-page">
      {aviso && <div className="admin-alert admin-alert--ok"><span><i className="bi bi-check-circle-fill" /> {aviso}</span>
        <button type="button" className="modal-admin__close" style={{ color: 'inherit' }} onClick={() => setAviso('')}><i className="bi bi-x-lg" /></button></div>}

      <div className={puedeGestionar ? 'admin-grid-8-4' : undefined}>
        <div>
          <div className="card-admin">
            <div className="card-admin__head">
              <h2><i className="bi bi-people-fill" /> Usuarios</h2>
              <span className="text-muted-2" style={{ fontSize: '.875rem' }}>{usuarios.length} usuario(s)</span>
            </div>
            <div className="card-admin__body card-admin__body--flush">
              <div className="table-responsive-admin">
                <table className="table-admin">
                  <thead>
                    <tr><th>Usuario</th><th>Rol</th><th className="ocultar-movil">Último acceso</th><th>Estado</th><th className="actions">Acciones</th></tr>
                  </thead>
                  <tbody>
                    {usuarios.map(u => (
                      <tr key={u.id}>
                        <td>
                          <div className="table-product">
                            <span className="admin-user__avatar" style={{ width: 40, height: 40 }}>{u.nombre.charAt(0).toUpperCase()}</span>
                            <span style={{ minWidth: 0 }}>
                              <span className="table-product__name">{u.nombre}{u.id === user.id && <span className="chip chip--accent" style={{ marginLeft: 6 }}>Vos</span>}</span>
                              <span className="table-product__meta">{u.correo}</span>
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className={`chip chip--${u.rol.slug === SLUG_ADMIN ? 'accent' : 'neutral'}`}>{u.rol.nombre}</span>
                          {u.puesto && <small className="d-block text-muted-2">{u.puesto}</small>}
                        </td>
                        <td className="ocultar-movil">
                          {fecha(u.ultimoAcceso)}
                          {u.ultimaIp && <small className="d-block text-muted-2 text-mono">{origen(u.ultimaIp)}</small>}
                        </td>
                        <td>
                          <span className={`chip chip--${u.activo ? 'ok' : 'danger'}`}>{u.activo ? 'Activo' : 'Inactivo'}</span>
                          {bloqueado(u) && <span className="chip chip--warn d-block" style={{ marginTop: 4, width: 'fit-content' }}>Bloqueado</span>}
                        </td>
                        <td className="actions">
                          {puedeGestionar && (soyAdmin || u.rol.slug !== SLUG_ADMIN) ? (
                            <Dropdown align="end" triggerClassName="btn-icon" title="Acciones" trigger={<i className="bi bi-three-dots-vertical" />}>
                              {cerrar => <>
                                <button type="button" className="dropdown-item" onClick={() => { cerrar(); abrirEdicion(u) }}><i className="bi bi-pencil" /> Editar</button>
                                {u.id !== user.id && <>
                                  {u.activo && <button type="button" className="dropdown-item" onClick={() => { cerrar(); setError(''); setConfirmar({ tipo: 'desactivar', usuario: u }) }}><i className="bi bi-person-x" /> Desactivar</button>}
                                  <hr className="dropdown-divider" />
                                  <button type="button" className="dropdown-item text-danger" onClick={() => { cerrar(); setError(''); setConfirmar({ tipo: 'eliminar', usuario: u }) }}><i className="bi bi-trash3-fill" /> Eliminar</button>
                                </>}
                              </>}
                            </Dropdown>
                          ) : <span className="text-muted-2 small-text">Sin permisos</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="card-admin">
            <div className="card-admin__head">
              <h2><i className="bi bi-key-fill" /> Roles</h2>
              {puede(user, 'roles.gestionar') && <button type="button" className="btn btn-ghost btn-sm" onClick={() => navegar('/roles')}>Administrar roles</button>}
            </div>
            <div className="card-admin__body card-admin__body--flush">
              <div className="table-responsive-admin">
                <table className="table-admin">
                  <thead><tr><th>Rol</th><th>Descripción</th><th className="num">Usuarios</th><th className="num">Permisos</th></tr></thead>
                  <tbody>
                    {roles.map(r => (
                      <tr key={r.id}>
                        <td><strong>{r.nombre}</strong></td>
                        <td className="text-muted-2 small-text">{r.descripcion}</td>
                        <td className="num">{r.usuarios}</td>
                        <td className="num">{r.slug === SLUG_ADMIN ? 'Todos' : r.permisos.length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {puedeGestionar && nuevo && (
          <div className="card-admin">
            <div className="card-admin__head"><h2><i className="bi bi-person-plus" /> Nuevo usuario</h2></div>
            <div className="card-admin__body">
              <form onSubmit={crear} className="form-stack">
                <Campo datos={nuevo} set={setNuevo} k="nombre" label="Nombre y apellido *" required maxLength={120} />
                <Campo datos={nuevo} set={setNuevo} k="correo" label="Email *" required type="email" maxLength={160} />
                <div className="form-grid form-grid--2">
                  <Campo datos={nuevo} set={setNuevo} k="contrasena" label="Contraseña *" required type="password" minLength={8} autoComplete="new-password" />
                  <Campo datos={nuevo} set={setNuevo} k="repetir" label="Repetir *" required type="password" minLength={8} autoComplete="new-password" />
                </div>
                <div>
                  <label className="form-label">Rol *</label>
                  <select className="form-select" required value={nuevo.rolId} onChange={e => setNuevo({ ...nuevo, rolId: e.target.value })}>
                    {rolesAsignables.filter(r => r.activo).map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                  </select>
                </div>
                <div className="form-grid form-grid--2">
                  <Campo datos={nuevo} set={setNuevo} k="telefono" label="Teléfono" type="tel" maxLength={40} />
                  <Campo datos={nuevo} set={setNuevo} k="puesto" label="Puesto" maxLength={120} />
                </div>
                <div>
                  <label className="filter-check"><input type="checkbox" checked={nuevo.activo} onChange={e => setNuevo({ ...nuevo, activo: e.target.checked })} /> Cuenta activa</label>
                  <label className="filter-check"><input type="checkbox" checked={nuevo.debeCambiarContrasena} onChange={e => setNuevo({ ...nuevo, debeCambiarContrasena: e.target.checked })} /> Debe cambiar la contraseña</label>
                </div>
                {errorAlta && <p className="form-error">{errorAlta}</p>}
                <div>
                  <button type="submit" className="btn btn-accent" style={{ width: '100%' }}><i className="bi bi-person-plus" /> Crear usuario</button>
                  <p className="form-hint" style={{ marginBottom: 0 }}>La contraseña debe tener al menos 8 caracteres, una mayúscula y un número.</p>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {editando && form && (
        <div className="modal-admin-backdrop modal-admin-backdrop--center" onMouseDown={e => { if (e.target === e.currentTarget) setEditando(null) }}>
          <div className="modal-admin" role="dialog" aria-modal="true">
            <div className="modal-admin__head">
              <h3>Editar «{editando.nombre}»</h3>
              <button type="button" className="modal-admin__close" aria-label="Cerrar" onClick={() => setEditando(null)}><i className="bi bi-x-lg" /></button>
            </div>
            <form onSubmit={guardar}>
              <div className="modal-admin__body">
                <Campo datos={form} set={setForm} k="nombre" label="Nombre *" required maxLength={120} />
                <Campo datos={form} set={setForm} k="correo" label="Email *" required type="email" maxLength={160} />
                <div>
                  <label className="form-label">Rol *</label>
                  <select className="form-select" required value={form.rolId} onChange={e => setForm({ ...form, rolId: e.target.value })}>
                    {rolesAsignables.map(r => <option key={r.id} value={r.id}>{r.nombre}{!r.activo ? ' (desactivado)' : ''}</option>)}
                  </select>
                </div>
                <div className="form-grid form-grid--2">
                  <Campo datos={form} set={setForm} k="telefono" label="Teléfono" type="tel" maxLength={40} />
                  <Campo datos={form} set={setForm} k="puesto" label="Puesto" maxLength={120} />
                </div>
                <Campo datos={form} set={setForm} k="contrasena" label="Nueva contraseña" type="password" minLength={8} autoComplete="new-password" placeholder="Dejar vacío para no cambiarla" />
                <div>
                  <label className="filter-check"><input type="checkbox" checked={form.activo} disabled={editando.id === user.id} onChange={e => setForm({ ...form, activo: e.target.checked })} /> Cuenta activa</label>
                  <label className="filter-check"><input type="checkbox" checked={form.debeCambiarContrasena} onChange={e => setForm({ ...form, debeCambiarContrasena: e.target.checked })} /> Debe cambiar la contraseña al entrar</label>
                  <label className="filter-check"><input type="checkbox" checked={form.desbloquear} onChange={e => setForm({ ...form, desbloquear: e.target.checked })} /> Desbloquear intentos fallidos{bloqueado(editando) ? ' (está bloqueado)' : ''}</label>
                  {editando.dosPasos && (
                    <label className="filter-check"><input type="checkbox" checked={form.quitarDosPasos} onChange={e => setForm({ ...form, quitarDosPasos: e.target.checked })} /> Quitar la verificación en dos pasos (perdió el celular o el acceso al mail)</label>
                  )}
                </div>
                {error && <p className="form-error">{error}</p>}
              </div>
              <div className="modal-admin__foot" style={{ justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setEditando(null)}>Cancelar</button>
                <button type="submit" className="btn btn-accent"><i className="bi bi-check-lg" /> Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmar && (
        <div className="modal-admin-backdrop modal-admin-backdrop--center" onMouseDown={e => { if (e.target === e.currentTarget) setConfirmar(null) }}>
          <div className="modal-admin modal-admin--sm" role="dialog" aria-modal="true">
            <div className="modal-admin__head">
              <h3>{confirmar.tipo === 'desactivar' ? 'Desactivar cuenta' : 'Eliminar usuario'}</h3>
              <button type="button" className="modal-admin__close" aria-label="Cerrar" onClick={() => setConfirmar(null)}><i className="bi bi-x-lg" /></button>
            </div>
            <div className="modal-admin__body">
              <p style={{ margin: 0 }}>{confirmar.tipo === 'desactivar'
                ? <>¿Desactivar la cuenta de <strong>{confirmar.usuario.nombre}</strong>? Se puede reactivar después.</>
                : <>¿Eliminar <strong>DEFINITIVAMENTE</strong> la cuenta de <strong>{confirmar.usuario.nombre}</strong>? No se puede deshacer.</>}</p>
              {error && <p className="form-error">{error}</p>}
            </div>
            <div className="modal-admin__foot" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmar(null)}>Cancelar</button>
              <button type="button" className={`btn ${confirmar.tipo === 'eliminar' ? 'btn-danger' : 'btn-dark-2'}`} onClick={ejecutarConfirmacion}>
                {confirmar.tipo === 'desactivar' ? <><i className="bi bi-person-x" /> Desactivar</> : <><i className="bi bi-trash3-fill" /> Eliminar</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
