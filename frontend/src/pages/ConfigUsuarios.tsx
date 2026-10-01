import { useState, useEffect } from 'react'
import { API } from '../config'
import { MODULOS_UI, modulosPorRol, ROL_LABEL } from '../modulos'
import { campo as c } from './configEstilos'

interface Usuario { id: number; nombre: string; correo: string; rol: string; modulos: string[]; activo: boolean }
interface Form { nombre: string; correo: string; contrasena: string; rol: string; modulos: string[]; activo: boolean }

const ROLES = ['ADMIN', 'VENDEDOR', 'TECNICO']
const nuevoForm = (): Form => ({ nombre: '', correo: '', contrasena: '', rol: 'VENDEDOR', modulos: modulosPorRol('VENDEDOR'), activo: true })

export default function ConfigUsuarios({ yoId }: { yoId: number }) {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [modal, setModal] = useState<{ open: boolean; editing: Usuario | null }>({ open: false, editing: null })
  const [form, setForm] = useState<Form>(nuevoForm())
  const [borrar, setBorrar] = useState<Usuario | null>(null)
  const [error, setError] = useState('')

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` }
  const fetchAll = () => fetch(`${API}/users`, { headers }).then(r => r.json()).then(setUsuarios)
  useEffect(() => { fetchAll() }, [])

  const abrir = (u: Usuario | null) => {
    setForm(u ? { nombre: u.nombre, correo: u.correo, contrasena: '', rol: u.rol, modulos: u.modulos, activo: u.activo } : nuevoForm())
    setError(''); setModal({ open: true, editing: u })
  }
  const cerrar = () => setModal({ open: false, editing: null })

  const cambiarRol = (rol: string) => setForm(f => ({ ...f, rol, modulos: modulosPorRol(rol) }))
  // Los submódulos de Servicios Técnicos solo tienen sentido si el módulo padre está activo
  const alternar = (id: string) => setForm(f => {
    const activo = f.modulos.includes(id)
    const hijos = MODULOS_UI.filter(m => m.padre === id).map(m => m.id)
    const padre = MODULOS_UI.find(m => m.id === id)?.padre
    let modulos = activo ? f.modulos.filter(m => m !== id && !hijos.includes(m)) : [...f.modulos, id]
    if (!activo && padre && !modulos.includes(padre)) modulos = [...modulos, padre]
    return { ...f, modulos }
  })

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const res = await fetch(modal.editing ? `${API}/users/${modal.editing.id}` : `${API}/users`, {
      method: modal.editing ? 'PUT' : 'POST', headers, body: JSON.stringify({ ...form, contrasena: form.contrasena || undefined }),
    })
    if (!res.ok) { setError((await res.json()).message || 'No se pudo guardar el usuario'); return }
    cerrar(); fetchAll()
  }

  const eliminar = async (u: Usuario) => {
    const res = await fetch(`${API}/users/${u.id}`, { method: 'DELETE', headers })
    if (!res.ok) setError((await res.json()).message || 'No se pudo eliminar el usuario')
    setBorrar(null); fetchAll()
  }

  return (
    <div style={c.card}>
      <div style={s.cabecera}>
        <p style={c.seccion}>Usuarios ({usuarios.length})</p>
        <button style={c.btnPrimary} onClick={() => abrir(null)}><i className="bi bi-plus-lg" /> Nuevo usuario</button>
      </div>
      {error && !modal.open && <p style={c.error}>{error}</p>}

      <div style={s.lista}>
        {usuarios.map(u => (
          <div key={u.id} style={{ ...s.fila, opacity: u.activo ? 1 : 0.55 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={s.nombre}>{u.nombre}{u.id === yoId && <span style={s.yo}>vos</span>}</p>
              <p style={s.sub}>{u.correo}</p>
            </div>
            <span style={s.rol}>{ROL_LABEL[u.rol]}</span>
            <span style={s.sub}>{u.rol === 'ADMIN' ? 'Todos los módulos' : `${u.modulos.length} ${u.modulos.length === 1 ? 'módulo' : 'módulos'}`}{!u.activo && ' · desactivado'}</span>
            <button style={s.btnIcon} title="Editar" onClick={() => abrir(u)}><i className="bi bi-pencil" /></button>
            {u.id !== yoId && <button style={s.btnIconDanger} title="Eliminar" onClick={() => { setError(''); setBorrar(u) }}><i className="bi bi-trash" /></button>}
          </div>
        ))}
      </div>

      {modal.open && (
        <div style={s.overlay}>
          <form className="page-modal" style={{ maxWidth: '560px' }} onSubmit={guardar}>
            <div style={s.modalHead}>
              <h3 style={s.modalTitulo}>{modal.editing ? 'Editar usuario' : 'Nuevo usuario'}</h3>
              <button type="button" style={s.cerrar} onClick={cerrar}><i className="bi bi-x-lg" /></button>
            </div>
            <div style={{ ...c.grid2, marginBottom: '12px' }}>
              <div style={c.field}><label style={c.label}>Nombre *</label>
                <input style={c.input} value={form.nombre} required autoFocus onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} /></div>
              <div style={c.field}><label style={c.label}>Correo *</label>
                <input style={c.input} type="email" value={form.correo} required onChange={e => setForm(f => ({ ...f, correo: e.target.value }))} /></div>
              <div style={c.field}><label style={c.label}>{modal.editing ? 'Nueva contraseña (vacío = no cambiar)' : 'Contraseña * (mín. 8)'}</label>
                <input style={c.input} type="password" value={form.contrasena} minLength={8} required={!modal.editing} autoComplete="new-password"
                  onChange={e => setForm(f => ({ ...f, contrasena: e.target.value }))} /></div>
              <div style={c.field}><label style={c.label}>Rol</label>
                <div style={s.roles}>
                  {ROLES.map(r => (
                    <button type="button" key={r} style={{ ...s.rolBtn, ...(form.rol === r ? s.rolBtnOn : {}) }} onClick={() => cambiarRol(r)}>{ROL_LABEL[r]}</button>
                  ))}
                </div></div>
            </div>

            <label style={c.label}>MÓDULOS QUE VE</label>
            {form.rol === 'ADMIN'
              ? <p style={s.nota}>El administrador ve todos los módulos y además Configuración.</p>
              : (
                <div style={s.modulos}>
                  {MODULOS_UI.filter(m => m.roles.includes(form.rol)).map(m => (
                    <label key={m.id} style={{ ...s.modulo, paddingLeft: m.padre ? '24px' : '8px' }}>
                      <input type="checkbox" checked={form.modulos.includes(m.id)} onChange={() => alternar(m.id)} /> {m.label}
                    </label>
                  ))}
                </div>
              )}

            {modal.editing && modal.editing.id !== yoId && (
              <label style={{ ...s.modulo, marginTop: '10px' }}>
                <input type="checkbox" checked={form.activo} onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} /> Usuario activo (puede entrar al sistema)
              </label>
            )}
            {error && <p style={{ ...c.error, marginTop: '10px' }}>{error}</p>}
            <div style={{ ...c.acciones, marginTop: '14px' }}>
              <button type="button" style={c.btnSecondary} onClick={cerrar}>Cancelar</button>
              <button type="submit" style={c.btnPrimary}>{modal.editing ? 'Guardar cambios' : 'Crear usuario'}</button>
            </div>
          </form>
        </div>
      )}

      {borrar && (
        <div style={s.overlay}>
          <div className="page-modal">
            <h3 style={s.modalTitulo}>Eliminar usuario</h3>
            <p style={s.nota}>¿Eliminar a {borrar.nombre}? Si tiene ventas o servicios registrados no se puede eliminar: desactivalo en su lugar.</p>
            <div style={{ ...c.acciones, marginTop: '16px' }}>
              <button style={c.btnSecondary} onClick={() => setBorrar(null)}>Cancelar</button>
              <button style={c.btnDanger} onClick={() => eliminar(borrar)}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  cabecera:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  lista:     { display: 'flex', flexDirection: 'column', maxHeight: '48vh', overflowY: 'auto' },
  fila:      { display: 'flex', alignItems: 'center', gap: '12px', padding: '9px 4px', borderBottom: '1px solid #EFF1F4' },
  nombre:    { color: '#111111', fontSize: '14px', fontWeight: '600', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' },
  sub:       { color: '#6B6B6B', fontSize: '12px', margin: 0 },
  yo:        { background: '#FFFDF3', color: '#8A6D00', border: '1px solid rgba(245,196,0,0.4)', borderRadius: '20px', padding: '1px 8px', fontSize: '10px', fontWeight: '700' },
  rol:       { background: '#F5F5F5', color: '#333333', border: '1px solid #E2E4E8', borderRadius: '20px', padding: '3px 10px', fontSize: '11px', fontWeight: '700' },
  btnIcon:   { background: '#FFFFFF', border: '1px solid #E2E4E8', borderRadius: '7px', padding: '6px 9px', cursor: 'pointer', fontSize: '13px', color: '#111111' },
  btnIconDanger: { background: 'rgba(198,64,47,0.08)', border: '1px solid rgba(198,64,47,0.2)', borderRadius: '7px', padding: '6px 9px', cursor: 'pointer', fontSize: '13px', color: '#C6402F' },
  overlay:   { position: 'fixed', inset: 0, background: 'rgba(17,17,17,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' },
  modalTitulo: { color: '#111111', fontSize: '17px', fontWeight: '700', margin: 0 },
  cerrar:    { background: 'transparent', border: 'none', color: '#6B6B6B', fontSize: '18px', cursor: 'pointer' },
  roles:     { display: 'flex', gap: '6px' },
  rolBtn:    { flex: 1, padding: '9px 6px', background: '#FFFFFF', border: '1px solid #D3D3D3', borderRadius: '8px', color: '#6B6B6B', fontSize: '12px', fontWeight: '600', cursor: 'pointer' },
  rolBtnOn:  { background: 'rgba(245,196,0,0.15)', border: '1px solid #F5C400', color: '#8A6D00' },
  modulos:   { display: 'flex', flexDirection: 'column', marginTop: '4px' },
  modulo:    { display: 'flex', alignItems: 'center', gap: '8px', color: '#333333', fontSize: '13px', padding: '3px 8px', cursor: 'pointer' },
  nota:      { color: '#6B6B6B', fontSize: '13px', margin: '6px 0 0' },
}
