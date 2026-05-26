import { useState } from 'react'
import type { User } from '../types'
import { API } from '../config'

interface Props { onLogin: (user: User) => void }

export default function Login({ onLogin }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correo: email, contrasena: password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      localStorage.setItem('token', data.token)
      onLogin(data.user)
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={s.page}>
      {/* Panel izquierdo — branding */}
      <div style={s.left}>
        <div style={s.brand}>
          <div style={s.logoWrap}>
            <span style={s.logoText}>SH</span>
          </div>
          <h1 style={s.brandName}>SH Servicios</h1>
          <p style={s.brandSub}>Sistema ERP — Módulo de Ventas</p>
        </div>
        <div style={s.features}>
          {[
            { icon: '📦', text: 'Control total de inventario' },
            { icon: '📊', text: 'Stock en tiempo real' },
            { icon: '🔒', text: 'Acceso por roles' },
          ].map(f => (
            <div key={f.text} style={s.featureItem}>
              <span style={s.featureIcon}>{f.icon}</span>
              <span style={s.featureText}>{f.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Panel derecho — formulario */}
      <div style={s.right}>
        <div style={s.formCard}>
          <div style={s.formHeader}>
            <h2 style={s.formTitle}>Iniciar sesión</h2>
            <p style={s.formSub}>Ingresá tus credenciales para continuar</p>
          </div>

          <form onSubmit={handleSubmit} style={s.form}>
            <div style={s.field}>
              <label style={s.label}>Correo electrónico</label>
              <input
                type="email"
                style={s.input}
                placeholder="usuario@shservicios.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <div style={s.field}>
              <label style={s.label}>Contraseña</label>
              <input
                type="password"
                style={s.input}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <div style={s.errorBox}>
                <span>⚠</span> {error}
              </div>
            )}

            <button type="submit" style={s.btn} disabled={loading}>
              {loading ? 'Ingresando...' : 'Ingresar al sistema'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page:        { display: 'flex', width: '100%', minHeight: '100vh' },
  left:        { width: '420px', background: 'linear-gradient(160deg, #1e3a5f 0%, #0f172a 100%)', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px 48px', gap: '48px', flexShrink: 0 },
  brand:       { display: 'flex', flexDirection: 'column', gap: '16px' },
  logoWrap:    { width: '64px', height: '64px', background: '#eab308', borderRadius: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  logoText:    { color: '#0f172a', fontWeight: '900', fontSize: '26px', letterSpacing: '-1px' },
  brandName:   { color: '#f1f5f9', fontSize: '28px', fontWeight: '800', letterSpacing: '-0.5px' },
  brandSub:    { color: '#64748b', fontSize: '14px' },
  features:    { display: 'flex', flexDirection: 'column', gap: '16px' },
  featureItem: { display: 'flex', alignItems: 'center', gap: '14px' },
  featureIcon: { fontSize: '20px', width: '36px', height: '36px', background: 'rgba(234,179,8,0.1)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  featureText: { color: '#94a3b8', fontSize: '14px' },
  right:       { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', padding: '40px' },
  formCard:    { width: '100%', maxWidth: '420px', background: '#1e293b', borderRadius: '20px', padding: '40px', border: '1px solid #334155' },
  formHeader:  { marginBottom: '32px' },
  formTitle:   { color: '#f1f5f9', fontSize: '22px', fontWeight: '700', margin: '0 0 6px' },
  formSub:     { color: '#64748b', fontSize: '14px' },
  form:        { display: 'flex', flexDirection: 'column', gap: '20px' },
  field:       { display: 'flex', flexDirection: 'column', gap: '7px' },
  label:       { color: '#94a3b8', fontSize: '13px', fontWeight: '500' },
  input:       { background: '#0f172a', border: '1px solid #334155', borderRadius: '10px', padding: '12px 16px', color: '#f1f5f9', fontSize: '14px', outline: 'none' },
  errorBox:    { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', borderRadius: '10px', padding: '12px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' },
  btn:         { background: '#eab308', color: '#0f172a', border: 'none', borderRadius: '10px', padding: '13px', fontSize: '15px', fontWeight: '700', cursor: 'pointer', marginTop: '4px' },
}
