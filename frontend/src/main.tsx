import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import 'bootstrap-icons/font/bootstrap-icons.css'
import './index.css'
import './catalogo.css'
import App from './App.tsx'
import { revisarPronto } from './socket'

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
  // Un cambio hecho desde acá: las demás pantallas abiertas de esta pestaña se enteran enseguida
  const metodo = (args[1]?.method ?? (args[0] instanceof Request ? args[0].method : 'GET')).toUpperCase()
  if (metodo !== 'GET' && res.ok && url.includes('/api/') && !url.includes('/api/auth/')) revisarPronto()
  return res
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
