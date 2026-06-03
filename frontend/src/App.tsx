import { useState, useEffect } from 'react'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import type { User } from './types'

const SESSION_DURATION = 12 * 60 * 60 * 1000 // 12 horas en ms

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

  useEffect(() => {
    if (!user) return
    const loginTime = Number(localStorage.getItem('loginTime') ?? 0)
    const remaining = SESSION_DURATION - (Date.now() - loginTime)
    if (remaining <= 0) { handleLogout(); return }
    const timer = setTimeout(handleLogout, remaining)
    return () => clearTimeout(timer)
  }, [user])

  const handleLogin = (userData: User) => {
    localStorage.setItem('loginTime', String(Date.now()))
    localStorage.setItem('user', JSON.stringify(userData))
    setUser(userData)
  }

  const handleLogout = () => {
    clearSession()
    setUser(null)
  }

  if (!user) return <Login onLogin={handleLogin} />
  return <Dashboard user={user} onLogout={handleLogout} />
}

export default App
