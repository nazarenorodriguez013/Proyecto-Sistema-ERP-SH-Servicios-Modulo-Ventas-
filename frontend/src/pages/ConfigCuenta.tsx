import { useState } from 'react'
import type { User } from '../types'
import { API } from '../config'
import { campo as c } from './configEstilos'

interface Sesion { token: string; user: User }

// Cambio de nombre, correo y contraseña del usuario que está logueado
type PasoDosPasos = 'inactivo' | 'codigo' | 'desactivar'

export default function ConfigCuenta({ user, onActualizado }: { user: User; onActualizado: (s: Sesion) => void }) {
  const [nombre, setNombre] = useState(user.nombre)
  const [correo, setCorreo] = useState(user.correo)
  const [nueva, setNueva] = useState('')
  const [repetir, setRepetir] = useState('')
  const [actual, setActual] = useState('')
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [paso, setPaso] = useState<PasoDosPasos>('inactivo')
  const [codigo, setCodigo] = useState('')
  const [passDesactivar, setPassDesactivar] = useState('')
  const [errorDp, setErrorDp] = useState('')
  const [okDp, setOkDp] = useState('')

  const cambiaCredenciales = correo.trim().toLowerCase() !== user.correo || !!nueva

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setOk('')
    if (nueva && nueva !== repetir) { setError('Las contraseñas nuevas no coinciden'); return }
    const res = await fetch(`${API}/auth/me`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` },
      body: JSON.stringify({ nombre, correo, contrasenaActual: actual, contrasenaNueva: nueva || undefined }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.message || 'No se pudo guardar'); return }
    onActualizado(data)
    setNueva(''); setRepetir(''); setActual(''); setOk('Datos actualizados')
  }

  const headersAuth = { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` }
  const llamarDosPasos = async (ruta: string, body: object = {}) => {
    setErrorDp(''); setOkDp('')
    const res = await fetch(`${API}/auth/2fa/${ruta}`, { method: 'POST', headers: headersAuth, body: JSON.stringify(body) })
    const data = await res.json()
    if (!res.ok) { setErrorDp(data.message || 'No se pudo completar la acción'); return null }
    return data
  }
  const pedirCodigo = async () => { if (await llamarDosPasos('activar')) { setPaso('codigo'); setCodigo(''); setOkDp(`Te enviamos un código a ${user.correo}`) } }
  const confirmarActivacion = async (e: React.FormEvent) => {
    e.preventDefault()
    const data = await llamarDosPasos('activar/confirmar', { codigo })
    if (data) { onActualizado(data); setPaso('inactivo'); setOkDp('Verificación en dos pasos activada') }
  }
  const desactivar = async (e: React.FormEvent) => {
    e.preventDefault()
    const data = await llamarDosPasos('desactivar', { contrasenaActual: passDesactivar })
    if (data) { onActualizado(data); setPaso('inactivo'); setPassDesactivar(''); setOkDp('Verificación en dos pasos desactivada') }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
    <form onSubmit={guardar} style={c.card}>
      <p style={c.seccion}>Mi cuenta</p>
      <div style={c.grid2}>
        <div style={c.field}><label style={c.label}>Nombre</label>
          <input style={c.input} value={nombre} required onChange={e => setNombre(e.target.value)} /></div>
        <div style={c.field}><label style={c.label}>Correo</label>
          <input style={c.input} type="email" value={correo} required onChange={e => setCorreo(e.target.value)} /></div>
        <div style={c.field}><label style={c.label}>Contraseña nueva (8+, mayúscula y número)</label>
          <input style={c.input} type="password" value={nueva} pattern="(?=.*[A-ZÁÉÍÓÚÑ])(?=.*[0-9]).{8,}" title="Al menos 8 caracteres, una mayúscula y un número" autoComplete="new-password" onChange={e => setNueva(e.target.value)} /></div>
        <div style={c.field}><label style={c.label}>Repetir contraseña nueva</label>
          <input style={c.input} type="password" value={repetir} required={!!nueva} autoComplete="new-password" onChange={e => setRepetir(e.target.value)} /></div>
      </div>
      {cambiaCredenciales && (
        <div style={{ ...c.field, maxWidth: '320px' }}>
          <label style={c.label}>Contraseña actual (para confirmar el cambio) *</label>
          <input style={c.input} type="password" value={actual} required autoComplete="current-password" onChange={e => setActual(e.target.value)} />
        </div>
      )}
      {error && <p style={c.error}>{error}</p>}
      {ok && <p style={c.ok}>{ok}</p>}
      <div style={c.acciones}><button type="submit" style={c.btnPrimary}>Guardar cambios</button></div>
    </form>

    <div style={c.card}>
      <p style={c.seccion}>Verificación en dos pasos</p>
      <p style={{ color: '#6B6B6B', fontSize: '13px', margin: 0 }}>
        {user.dosPasos
          ? `Activada: al iniciar sesión te pedimos además un código que llega a ${user.correo}.`
          : 'Opcional. Si la activás, al iniciar sesión te pedimos además un código que te llega por mail.'}
      </p>
      {paso === 'codigo' && (
        <form onSubmit={confirmarActivacion} style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ ...c.field, width: '200px' }}><label style={c.label}>Código recibido por mail</label>
            <input style={{ ...c.input, letterSpacing: '4px', textAlign: 'center' }} inputMode="numeric" maxLength={6} autoFocus value={codigo}
              onChange={e => setCodigo(e.target.value.replace(/\D/g, ''))} required /></div>
          <button type="submit" style={c.btnPrimary}>Confirmar y activar</button>
          <button type="button" style={c.btnSecondary} onClick={pedirCodigo}>Reenviar código</button>
          <button type="button" style={c.btnSecondary} onClick={() => { setPaso('inactivo'); setErrorDp(''); setOkDp('') }}>Cancelar</button>
        </form>
      )}
      {paso === 'desactivar' && (
        <form onSubmit={desactivar} style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ ...c.field, width: '260px' }}><label style={c.label}>Contraseña actual para confirmar</label>
            <input style={c.input} type="password" autoFocus value={passDesactivar} onChange={e => setPassDesactivar(e.target.value)} required /></div>
          <button type="submit" style={c.btnDanger}>Desactivar</button>
          <button type="button" style={c.btnSecondary} onClick={() => { setPaso('inactivo'); setErrorDp('') }}>Cancelar</button>
        </form>
      )}
      {paso === 'inactivo' && (
        <div style={c.acciones}>
          {user.dosPasos
            ? <button type="button" style={c.btnSecondary} onClick={() => { setPaso('desactivar'); setErrorDp(''); setOkDp('') }}>Desactivar verificación en dos pasos</button>
            : <button type="button" style={c.btnPrimary} onClick={pedirCodigo}>Activar verificación en dos pasos</button>}
        </div>
      )}
      {errorDp && <p style={c.error}>{errorDp}</p>}
      {okDp && <p style={c.ok}>{okDp}</p>}
    </div>
    </div>
  )
}
