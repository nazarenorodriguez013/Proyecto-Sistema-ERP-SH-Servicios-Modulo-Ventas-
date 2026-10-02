import { useState, useEffect } from 'react'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import type { User } from './types'

const SESSION_DURATION = 8 * 60 * 60 * 1000 // 8 horas en ms, igual que la expiración del JWT

function clearSession() {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  localStorage.removeItem('loginTime')
}

function App() {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('user')
    if (!saved) return null
    const parsed = JSON.parse(saved)
    if (!parsed.nombre) {
      clearSession()
      return null
    }
    const loginTime = Number(localStorage.getItem('loginTime') ?? 0)
    if (Date.now() - loginTime > SESSION_DURATION) {
      clearSession()
      return null
    }
    return parsed
  })

  const handleLogout = () => {
    clearSession()
    setUser(null)
  }

  useEffect(() => {
    if (!user) return
    const loginTime = Number(localStorage.getItem('loginTime') ?? 0)
    const remaining = SESSION_DURATION - (Date.now() - loginTime)
    const timer = setTimeout(handleLogout, remaining)
    return () => clearTimeout(timer)
  }, [user])

  // Tras cambiar correo o contraseña el backend devuelve una sesión nueva
  const handleUserUpdate = ({ token, user: userData }: { token: string; user: User }) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(userData))
    setUser(userData)
  }

  const handleLogin = (userData: User) => {
    localStorage.setItem('loginTime', String(Date.now()))
    localStorage.setItem('user', JSON.stringify(userData))
    setUser(userData)
  }

  if (!user) return <Login onLogin={handleLogin} resetToken={new URLSearchParams(window.location.search).get('reset')} confirmarToken={new URLSearchParams(window.location.search).get('confirmar')} />
  return <Dashboard user={user} onLogout={handleLogout} onUserUpdate={handleUserUpdate} />
}

export default App
