import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import type { User } from '../types'
import { API } from '../config'
import { socket } from '../socket'
import Inventario from './Inventario'
import Ventas from './Ventas'
import Clientes from './Clientes'
import Taller from './Taller'

interface Page { id: string; label: string; icon: string; path: string; roles: string[] }

const ADMINISTRACION = ['ADMIN', 'VENDEDOR']
const ROL_LABEL: Record<string, string> = { ADMIN: 'Administrador', VENDEDOR: 'Vendedor', TECNICO: 'Técnico' }

// Menú de un solo nivel, ordenado por la tarea más frecuente
const allPages: Page[] = [
  { id: 'punto-venta', label: 'Punto de Venta',     icon: 'bi-receipt', path: '/',           roles: ADMINISTRACION },
  { id: 'servicios',   label: 'Servicios Técnicos', icon: 'bi-tools',   path: '/servicios',  roles: [...ADMINISTRACION, 'TECNICO'] },
  { id: 'clientes',    label: 'Clientes',           icon: 'bi-people',  path: '/clientes',   roles: ADMINISTRACION },
  { id: 'inventario',  label: 'Inventario',         icon: 'bi-box-seam', path: '/inventario', roles: ADMINISTRACION },
]

export default function Dashboard({ user, onLogout }: { user: User; onLogout: () => void }) {
  const pages         = allPages.filter(p => p.roles.includes(user.rol))
  const routerNav     = useNavigate()
  const { pathname }  = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [stockBajo, setStockBajo]     = useState(0)

  // La página activa sale de la URL (así funcionan atrás/adelante); si el rol no puede verla, va a su primera página
  const activePage = pages.find(p => p.path === pathname) ?? pages[0]
  const veInventario = pages.some(p => p.id === 'inventario')

  // Cantidad de productos para reponer, visible desde cualquier pantalla y actualizada en tiempo real
  useEffect(() => {
    if (!veInventario) return
    const headers = { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` }
    const fetchStockBajo = () =>
      fetch(`${API}/products/low-stock`, { headers }).then(r => r.json()).then(data => setStockBajo(data.length))
    fetchStockBajo()
    socket.on('stock-actualizado', fetchStockBajo)
    return () => { socket.off('stock-actualizado', fetchStockBajo) }
  }, [veInventario])

  const navigate = (page: Page) => {
    setSidebarOpen(false)
    routerNav(page.path)
  }

  const renderContent = () => {
    if (activePage.id === 'servicios')  return <Taller user={user} />
    if (activePage.id === 'clientes')   return <Clientes user={user} />
    if (activePage.id === 'inventario') return <Inventario user={user} />
    return <Ventas user={user} />
  }

  return (
    <div className="db-layout">

      {/* Backdrop móvil */}
      {sidebarOpen && <div className="db-backdrop" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={`db-sidebar${sidebarOpen ? ' open' : ''}`}>
        <div style={st.sidebarTop}>

          <div style={st.logoArea}>
            <button className="db-close-btn" onClick={() => setSidebarOpen(false)}><i className="bi bi-x-lg" /></button>
          </div>

          <div style={st.userCard}>
            <div style={st.avatar}>{user.nombre.charAt(0).toUpperCase()}</div>
            <div style={{ minWidth: 0 }}>
              <p style={st.userName}>{user.nombre}</p>
              <p style={st.userRole}>{ROL_LABEL[user.rol] ?? user.rol}</p>
            </div>
          </div>

          <div style={st.navSection}>
            <p style={st.navLabel}>MENÚ PRINCIPAL</p>
            <nav style={st.nav}>
              {pages.map(page => (
                <button
                  key={page.id}
                  style={{ ...st.navItem, ...(page.id === activePage.id ? st.navItemActive : {}) }}
                  onClick={() => navigate(page)}
                >
                  <span style={st.navIcon}><i className={`bi ${page.icon}`} /></span>
                  <span style={{ flex: 1, textAlign: 'left' }}>{page.label}</span>
                  {page.id === 'inventario' && stockBajo > 0 && (
                    <span style={st.navBadge} title="Productos con stock bajo o sin stock">{stockBajo}</span>
                  )}
                </button>
              ))}
            </nav>
          </div>
        </div>

        <button style={st.logoutBtn} onClick={onLogout}>
          <i className="bi bi-box-arrow-right" /><span>Cerrar Sesión</span>
        </button>
      </aside>

      {/* Contenido principal */}
      <main className="db-main">
        <div style={st.topBar}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button className="db-hamburger" onClick={() => setSidebarOpen(true)}>
              <span style={st.hLine} />
              <span style={st.hLine} />
              <span style={st.hLine} />
            </button>
            <h2 style={st.pageTitle}>{activePage.label}</h2>
          </div>
          <div style={st.topBarRight}>
            <div style={st.topBarUser}>
              <span style={st.topBarAvatar}>{user.nombre.charAt(0).toUpperCase()}</span>
              <span className="db-topbar-name" style={st.topBarName}>{user.nombre}</span>
            </div>
          </div>
        </div>

        <div style={st.contentFull}>
          {renderContent()}
        </div>

        <footer style={st.footer}>
          <span style={st.footerText}>
            Proyecto desarrollado por&nbsp;&nbsp;
            <strong>Rodríguez Nazareno</strong> · <strong>Jacobo Santiago</strong> · <strong>Mover Leonardo</strong>
          </span>
        </footer>
      </main>
    </div>
  )
}

const st: Record<string, React.CSSProperties> = {
  sidebarTop:   { display: 'flex', flexDirection: 'column', gap: '24px', flex: 1, minHeight: 0, overflow: 'hidden' },

  logoArea:     { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '4px 8px 20px', borderBottom: '1px solid #1D1D1D' },

  userCard:     { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: '#1B1B1B', borderRadius: '10px', border: '1px solid #1D1D1D' },
  avatar:       { width: '34px', height: '34px', borderRadius: '50%', background: '#F5C400', color: '#111111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '14px', flexShrink: 0 },
  userName:     { color: '#FFFFFF', fontSize: '13px', fontWeight: '600', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  userRole:     { color: '#8C8C8C', fontSize: '11px', margin: 0, marginTop: '1px' },

  navSection:   { display: 'flex', flexDirection: 'column', gap: '6px' },
  navLabel:     { color: '#5F5F5F', fontSize: '10px', fontWeight: '700', letterSpacing: '1.5px', margin: '0 0 2px 8px' },
  nav:          { display: 'flex', flexDirection: 'column', gap: '1px' },

  navItem:      { display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 12px', background: 'transparent', border: 'none', borderRadius: '8px', color: '#B7B7B7', fontSize: '13px', fontWeight: '500', cursor: 'pointer', width: '100%' },
  navItemActive:{ background: '#1E1E1E', color: '#FFFFFF', fontWeight: '600' },
  navIcon:      { fontSize: '16px', width: '20px', textAlign: 'center' },
  navBadge:     { background: '#E08A00', color: '#111111', borderRadius: '10px', padding: '1px 7px', fontSize: '11px', fontWeight: '800' },

  logoutBtn:    { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px', background: 'transparent', border: '1px solid #1D1D1D', borderRadius: '8px', color: '#B7B7B7', fontSize: '13px', cursor: 'pointer', width: '100%' },

  hLine:        { display: 'block', width: '22px', height: '2px', background: '#111111', borderRadius: '2px' },

  topBar:       { padding: '16px 20px', borderBottom: '1px solid #E2E4E8', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FFFFFF', flexShrink: 0 },
  pageTitle:    { color: '#111111', fontSize: '18px', fontWeight: '700', margin: 0 },
  topBarRight:  { display: 'flex', alignItems: 'center', gap: '12px' },
  topBarUser:   { display: 'flex', alignItems: 'center', gap: '8px', background: '#F5F5F5', border: '1px solid #E2E4E8', borderRadius: '8px', padding: '6px 12px' },
  topBarAvatar: { width: '26px', height: '26px', borderRadius: '50%', background: '#111111', color: '#F5C400', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '11px' },
  topBarName:   { color: '#111111', fontSize: '13px', fontWeight: '500' },

  contentFull:  { flex: 1, overflowY: 'auto' },

  footer:       { padding: '10px 20px', borderTop: '1px solid #E2E4E8', textAlign: 'center', flexShrink: 0, background: '#FFFFFF' },
  footerText:   { color: '#9A9A9A', fontSize: '11px' },
}
