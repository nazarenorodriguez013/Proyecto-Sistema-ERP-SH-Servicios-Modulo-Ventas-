import { useState } from 'react'
import type { User } from '../types'
import { API } from '../config'

interface Props { onLogin: (user: User) => void }

export default function Login({ onLogin }: Props) {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

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
    <div className="login-page">

      {/* Panel izquierdo — se oculta en móvil vía CSS */}
      <div className="login-left">
        <div style={s.brand}>
          <img src="/logosh.png" alt="SH Servicios" style={s.logoImg} />
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

      {/* Panel derecho */}
      <div className="login-right">
        <div className="login-card">

          {/* Logo compacto — solo visible en móvil vía CSS */}
          <div className="login-mobile-logo">
            <img src="/logosh.png" alt="SH Servicios" style={{ ...s.logoImg, width: '48px', height: '48px' }} />
            <div>
              <p style={{ ...s.brandName, fontSize: '20px' }}>SH Servicios</p>
              <p style={s.brandSub}>Sistema ERP — Módulo de Ventas</p>
            </div>
          </div>

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

          <div style={s.footer}>
            <p style={s.footerLabel}>Proyecto desarrollado por</p>
            <p style={s.footerNames}>Rodríguez Nazareno · Jacobo Santiago · Mover Leonardo</p>
          </div>
        </div>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  brand:       { display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' as const, gap: '18px' },
  logoImg:     { width: '96px', height: '96px', objectFit: 'contain', borderRadius: '14px' },
  brandName:   { color: '#FFFFFF', fontSize: '38px', fontWeight: '800', letterSpacing: '-0.5px', margin: 0 },
  brandSub:    { color: '#9A9A9A', fontSize: '18px', margin: 0 },
  features:    { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' },
  featureItem: { display: 'flex', alignItems: 'center', gap: '14px' },
  featureIcon: { fontSize: '24px', width: '44px', height: '44px', background: 'rgba(245,196,0,0.1)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  featureText: { color: '#CFCFCF', fontSize: '17px' },

  formHeader:  { marginBottom: '28px' },
  formTitle:   { color: '#FFFFFF', fontSize: '22px', fontWeight: '700', margin: '0 0 6px' },
  formSub:     { color: '#6B6B6B', fontSize: '14px', margin: 0 },
  form:        { display: 'flex', flexDirection: 'column', gap: '20px' },
  field:       { display: 'flex', flexDirection: 'column', gap: '7px' },
  label:       { color: '#9A9A9A', fontSize: '13px', fontWeight: '500' },
  input:       { background: '#111111', border: '1px solid #2B2B2B', borderRadius: '10px', padding: '12px 16px', color: '#FFFFFF', fontSize: '16px', outline: 'none', width: '100%' },
  errorBox:    { background: 'rgba(198,64,47,0.1)', border: '1px solid rgba(198,64,47,0.3)', color: '#C6402F', borderRadius: '10px', padding: '12px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' },
  btn:         { background: '#F5C400', color: '#111111', border: 'none', borderRadius: '10px', padding: '14px', fontSize: '16px', fontWeight: '700', cursor: 'pointer', width: '100%' },

  footer:      { marginTop: '28px', paddingTop: '20px', borderTop: '1px solid #1A1A1A', textAlign: 'center' },
  footerLabel: { color: '#3A3A3A', fontSize: '11px', letterSpacing: '0.5px', textTransform: 'uppercase', margin: '0 0 4px' },
  footerNames: { color: '#6B6B6B', fontSize: '12px', fontWeight: '500', margin: 0 },
}
