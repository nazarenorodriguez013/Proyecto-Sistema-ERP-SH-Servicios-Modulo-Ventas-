import { useState, useEffect, useRef } from 'react'
import type { User } from '../types'
import { API } from '../config'

interface Props { onLogin: (user: User) => void; resetToken?: string | null }
type Modo = 'login' | 'forgot' | 'reset'

export default function Login({ onLogin, resetToken }: Props) {
  const [modo, setModo]         = useState<Modo>(resetToken ? 'reset' : 'login')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [repetir, setRepetir]   = useState('')
  const [error, setError]       = useState('')
  const [info, setInfo]         = useState('')
  const [loading, setLoading]   = useState(false)
  const [googleId, setGoogleId] = useState<string | null>(null)
  const googleRef = useRef<HTMLDivElement>(null)

  const post = async (path: string, body: object) => {
    const res = await fetch(`${API}/auth/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message)
    return data
  }

  const ingresar = (data: { token: string; user: User }) => { localStorage.setItem('token', data.token); onLogin(data.user) }

  // El botón de Google solo aparece si el servidor tiene configurado el Client ID
  useEffect(() => {
    fetch(`${API}/auth/config`).then(r => r.json()).then(c => setGoogleId(c.googleClientId)).catch(() => {})
  }, [])

  useEffect(() => {
    if (!googleId || modo !== 'login') return
    const iniciar = () => {
      const google = (window as any).google
      google.accounts.id.initialize({
        client_id: googleId,
        callback: async ({ credential }: { credential: string }) => {
          setError('')
          try { ingresar(await post('google', { credential })) } catch (err) { setError((err as Error).message || 'No se pudo iniciar sesión con Google') }
        },
      })
      if (googleRef.current) google.accounts.id.renderButton(googleRef.current, { theme: 'filled_black', size: 'large', text: 'signin_with', locale: 'es', width: 340 })
    }
    if ((window as any).google?.accounts) { iniciar(); return }
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.onload = iniciar
    document.head.appendChild(script)
  }, [googleId, modo])

  const cambiarModo = (m: Modo) => { setModo(m); setError(''); setInfo('') }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setInfo('')
    setLoading(true)
    try {
      if (modo === 'login') {
        ingresar(await post('login', { correo: email, contrasena: password }))
      } else if (modo === 'forgot') {
        const data = await post('forgot', { correo: email })
        setInfo(data.message)
      } else {
        if (password !== repetir) throw new Error('Las contraseñas no coinciden')
        const data = await post('reset', { token: resetToken, contrasena: password })
        window.history.replaceState({}, '', window.location.pathname)
        setPassword(''); setRepetir(''); setModo('login'); setInfo(data.message)
      }
    } catch (err) {
      setError((err as Error).message || 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  const titulo = modo === 'login' ? 'Iniciar sesión' : modo === 'forgot' ? 'Recuperar contraseña' : 'Elegí una contraseña nueva'
  const subtitulo = modo === 'login' ? 'Ingresá tus credenciales para continuar'
    : modo === 'forgot' ? 'Te enviamos un link por mail para elegir una contraseña nueva' : 'Mínimo 8 caracteres y una mayúscula'

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
            { icon: 'bi-box-seam', text: 'Control total de inventario' },
            { icon: 'bi-bar-chart', text: 'Stock en tiempo real' },
            { icon: 'bi-shield-lock', text: 'Acceso por roles' },
          ].map(f => (
            <div key={f.text} style={s.featureItem}>
              <span style={s.featureIcon}><i className={`bi ${f.icon}`} /></span>
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
            <h2 style={s.formTitle}>{titulo}</h2>
            <p style={s.formSub}>{subtitulo}</p>
          </div>

          <form onSubmit={handleSubmit} style={s.form}>
            {modo !== 'reset' && (
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
            )}
            {modo !== 'forgot' && (
              <div style={s.field}>
                <label style={s.label}>{modo === 'reset' ? 'Contraseña nueva' : 'Contraseña'}</label>
                <input
                  type="password"
                  style={s.input}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  pattern={modo === 'reset' ? '(?=.*[A-ZÁÉÍÓÚÑ]).{8,}' : undefined}
                  title="Al menos 8 caracteres y una mayúscula"
                  required
                />
              </div>
            )}
            {modo === 'reset' && (
              <div style={s.field}>
                <label style={s.label}>Repetir contraseña</label>
                <input type="password" style={s.input} placeholder="••••••••" value={repetir} onChange={e => setRepetir(e.target.value)} required />
              </div>
            )}

            {error && (
              <div style={s.errorBox}>
                <i className="bi bi-exclamation-triangle-fill" /> {error}
              </div>
            )}
            {info && (
              <div style={s.infoBox}>
                <i className="bi bi-check-circle-fill" /> {info}
              </div>
            )}

            <button type="submit" style={s.btn} disabled={loading}>
              {loading ? 'Procesando...' : modo === 'login' ? 'Ingresar al sistema' : modo === 'forgot' ? 'Enviar link' : 'Guardar contraseña'}
            </button>

            {modo === 'login' && (
              <button type="button" style={s.linkBtn} onClick={() => cambiarModo('forgot')}>¿Olvidaste tu contraseña?</button>
            )}
            {modo !== 'login' && (
              <button type="button" style={s.linkBtn} onClick={() => cambiarModo('login')}>Volver a iniciar sesión</button>
            )}
          </form>

          {modo === 'login' && googleId && (
            <div style={s.googleWrap}>
              <div style={s.separador}><span style={s.separadorTxt}>o</span></div>
              <div ref={googleRef} style={{ display: 'flex', justifyContent: 'center' }} />
            </div>
          )}

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

  infoBox:     { background: 'rgba(30,122,69,0.12)', border: '1px solid rgba(30,122,69,0.35)', color: '#4CC285', borderRadius: '10px', padding: '12px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' },
  linkBtn:     { background: 'transparent', border: 'none', color: '#9A9A9A', fontSize: '13px', cursor: 'pointer', textDecoration: 'underline', padding: 0 },
  googleWrap:  { marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '16px' },
  separador:   { borderTop: '1px solid #2B2B2B', textAlign: 'center', height: 0 },
  separadorTxt:{ position: 'relative', top: '-9px', background: '#1A1A1A', color: '#6B6B6B', fontSize: '12px', padding: '0 10px' },

  footer:      { marginTop: '28px', paddingTop: '20px', borderTop: '1px solid #1A1A1A', textAlign: 'center' },
  footerLabel: { color: '#3A3A3A', fontSize: '11px', letterSpacing: '0.5px', textTransform: 'uppercase', margin: '0 0 4px' },
  footerNames: { color: '#6B6B6B', fontSize: '12px', fontWeight: '500', margin: 0 },
}
