import { useState } from 'react'
import type { User } from '../types'
import { API } from '../config'
import { campo as c } from './configEstilos'

interface Sesion { token: string; user: User }

// Cambio de nombre, correo y contraseña del usuario que está logueado
export default function ConfigCuenta({ user, onActualizado }: { user: User; onActualizado: (s: Sesion) => void }) {
  const [nombre, setNombre] = useState(user.nombre)
  const [correo, setCorreo] = useState(user.correo)
  const [nueva, setNueva] = useState('')
  const [repetir, setRepetir] = useState('')
  const [actual, setActual] = useState('')
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

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
    const cambioCorreo = correo.trim().toLowerCase() !== user.correo
    onActualizado(data)
    setNueva(''); setRepetir(''); setActual('')
    setOk(cambioCorreo ? 'Datos actualizados. Te enviamos un mail al correo nuevo: confirmalo para poder volver a entrar' : 'Datos actualizados')
  }

  return (
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
  )
}
