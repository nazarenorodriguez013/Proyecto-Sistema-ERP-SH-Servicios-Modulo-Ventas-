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
          <div style={s.logoWrap}><span style={s.logoText}>SH</span></div>
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
            <div style={{ ...s.logoWrap, width: '48px', height: '48px' }}>
              <span style={{ ...s.logoText, fontSize: '20px' }}>SH</span>
            </div>
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
  brand:       { display: 'flex', flexDirection: 'column', gap: '16px' },
  logoWrap:    { width: '64px', height: '64px', background: '#eab308', borderRadius: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  logoText:    { color: '#0f172a', fontWeight: '900', fontSize: '26px', letterSpacing: '-1px' },
  brandName:   { color: '#f1f5f9', fontSize: '28px', fontWeight: '800', letterSpacing: '-0.5px', margin: 0 },
  brandSub:    { color: '#64748b', fontSize: '14px', margin: 0 },
  features:    { display: 'flex', flexDirection: 'column', gap: '16px' },
  featureItem: { display: 'flex', alignItems: 'center', gap: '14px' },
  featureIcon: { fontSize: '20px', width: '36px', height: '36px', background: 'rgba(234,179,8,0.1)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  featureText: { color: '#94a3b8', fontSize: '14px' },

  formHeader:  { marginBottom: '28px' },
  formTitle:   { color: '#f1f5f9', fontSize: '22px', fontWeight: '700', margin: '0 0 6px' },
  formSub:     { color: '#64748b', fontSize: '14px', margin: 0 },
  form:        { display: 'flex', flexDirection: 'column', gap: '20px' },
  field:       { display: 'flex', flexDirection: 'column', gap: '7px' },
  label:       { color: '#94a3b8', fontSize: '13px', fontWeight: '500' },
  input:       { background: '#0f172a', border: '1px solid #334155', borderRadius: '10px', padding: '12px 16px', color: '#f1f5f9', fontSize: '16px', outline: 'none', width: '100%' },
  errorBox:    { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', borderRadius: '10px', padding: '12px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' },
  btn:         { background: '#eab308', color: '#0f172a', border: 'none', borderRadius: '10px', padding: '14px', fontSize: '16px', fontWeight: '700', cursor: 'pointer', width: '100%' },

  footer:      { marginTop: '28px', paddingTop: '20px', borderTop: '1px solid #1e293b', textAlign: 'center' },
  footerLabel: { color: '#475569', fontSize: '11px', letterSpacing: '0.5px', textTransform: 'uppercase', margin: '0 0 4px' },
  footerNames: { color: '#64748b', fontSize: '12px', fontWeight: '500', margin: 0 },
}
