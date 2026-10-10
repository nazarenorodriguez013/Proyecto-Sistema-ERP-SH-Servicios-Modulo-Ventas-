import { useState } from 'react'
import type { User } from '../types'
import { API } from '../config'

interface Sesion { token: string; user: User }

// Pantalla obligatoria cuando el administrador marcó "Debe cambiar la contraseña" (alta nueva o reseteo)
export default function CambiarContrasena({ user, onListo, onLogout }: { user: User; onListo: (s: Sesion) => void; onLogout: () => void }) {
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [repetir, setRepetir] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (nueva !== repetir) { setError('Las contraseñas nuevas no coinciden'); return }
    if (nueva === actual) { setError('La contraseña nueva tiene que ser distinta de la actual'); return }
    setGuardando(true)
    const res = await fetch(`${API}/auth/me`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` },
      body: JSON.stringify({ contrasenaActual: actual, contrasenaNueva: nueva }),
    })
    const data = await res.json()
    setGuardando(false)
    if (!res.ok) { setError(data.message || 'No se pudo cambiar la contraseña'); return }
    onListo(data)
  }

  return (
    <div className="admin-bare">
      <div className="card-admin" style={{ width: '100%', maxWidth: 440 }}>
        <div className="modal-admin__head">
          <h3><i className="bi bi-shield-lock" /> Elegí una contraseña nueva</h3>
        </div>
        <form onSubmit={guardar}>
          <div className="modal-admin__body">
            <p className="text-muted-2 small-text" style={{ margin: 0 }}>
              Hola {user.nombre}: antes de entrar tenés que reemplazar la contraseña que te dieron por una propia.
            </p>
            <div>
              <label className="form-label" htmlFor="cc-actual">Contraseña actual</label>
              <input className="form-control" id="cc-actual" type="password" required autoComplete="current-password" value={actual} onChange={e => setActual(e.target.value)} />
            </div>
            <div>
              <label className="form-label" htmlFor="cc-nueva">Contraseña nueva</label>
              <input className="form-control" id="cc-nueva" type="password" required minLength={8} autoComplete="new-password" value={nueva} onChange={e => setNueva(e.target.value)} />
              <p className="form-hint">Al menos 8 caracteres, una mayúscula y un número.</p>
            </div>
            <div>
              <label className="form-label" htmlFor="cc-repetir">Repetir contraseña nueva</label>
              <input className="form-control" id="cc-repetir" type="password" required minLength={8} autoComplete="new-password" value={repetir} onChange={e => setRepetir(e.target.value)} />
            </div>
            {error && <p className="form-error">{error}</p>}
          </div>
          <div className="modal-admin__foot">
            <button type="button" className="btn btn-ghost" onClick={onLogout}>Cerrar sesión</button>
            <span style={{ flex: 1 }} />
            <button type="submit" className="btn btn-accent" disabled={guardando}><i className="bi bi-check-lg" /> Guardar y entrar</button>
          </div>
        </form>
      </div>
    </div>
  )
}
