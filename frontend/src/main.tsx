import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import 'bootstrap-icons/font/bootstrap-icons.css'
import './index.css'
import App from './App.tsx'

// Si el servidor invalida la sesión (usuario desactivado o borrado, token vencido) se vuelve al login en vez de dejar
// la pantalla con errores sueltos. Las rutas de /auth devuelven 401 por contraseña o código incorrectos y no cuentan.
const fetchOriginal = window.fetch.bind(window)
window.fetch = async (...args) => {
  const res = await fetchOriginal(...args)
  const url = String(args[0] instanceof Request ? args[0].url : args[0])
  if (res.status === 401 && url.includes('/api/') && !url.includes('/api/auth/') && localStorage.getItem('token')) {
    localStorage.removeItem('token'); localStorage.removeItem('user'); localStorage.removeItem('loginTime')
    window.location.assign('/')
  }
  return res
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
