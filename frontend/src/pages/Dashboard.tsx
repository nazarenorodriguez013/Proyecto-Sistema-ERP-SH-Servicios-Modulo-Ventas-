import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import type { User } from '../types'
import Categorias from './Categorias'
import Articulos from './Articulos'
import Stock from './Stock'
import Ventas from './Ventas'
import Clientes from './Clientes'
import PuntoAlquiler from './PuntoAlquiler'
import Maquinas from './Maquinas'
import Alquileres from './Alquileres'

interface PageItem   { id: string; label: string; icon: string }
interface SubSection { id: string; label: string; icon: string; children?: PageItem[] }
interface Section    { id: string; label: string; icon: string; roles: string[]; children?: SubSection[] }

const allSections: Section[] = [
  {
    id: 'ventas', label: 'Ventas', icon: 'bi-cart3', roles: ['ADMIN', 'VENDEDOR'],
    children: [
      { id: 'punto-venta',  label: 'Punto de Venta',  icon: 'bi-receipt' },
      {
        id: 'inventario', label: 'Inventario', icon: 'bi-box-seam',
        children: [
          { id: 'categorias', label: 'Categorías', icon: 'bi-tag' },
          { id: 'articulos',  label: 'Artículos',  icon: 'bi-clipboard' },
          { id: 'stock',      label: 'Stock',        icon: 'bi-bar-chart' },
        ],
      },
    ],
  },
  { id: 'clientes',   label: 'Clientes',           icon: 'bi-people', roles: ['ADMIN', 'VENDEDOR'] },
  {
    id: 'alquiler', label: 'Alquiler', icon: 'bi-house-door', roles: ['ADMIN'],
    children: [
      { id: 'punto-alquiler', label: 'Punto de Alquiler', icon: 'bi-cart-check' },
      { id: 'maquinas',       label: 'Máquinas',          icon: 'bi-truck' },
      { id: 'alquileres',     label: 'Alquileres',        icon: 'bi-calendar3' },
    ],
  },
  { id: 'servicios',  label: 'Servicios Técnicos',  icon: 'bi-tools', roles: ['ADMIN'] },
]

const pageLabels: Record<string, string> = {
  'punto-venta': 'Punto de Venta',
  categorias: 'Categorías', articulos: 'Artículos', stock: 'Stock',
  clientes: 'Clientes', 'punto-alquiler': 'Punto de Alquiler', maquinas: 'Máquinas', alquileres: 'Alquileres', servicios: 'Servicios Técnicos',
}

const contentPages = ['punto-venta', 'categorias', 'articulos', 'stock', 'clientes', 'punto-alquiler', 'maquinas', 'alquileres']

// Mapeo entre ID de página y segmento de URL
const pageToPath: Record<string, string> = {
  'punto-venta': '/', categorias: '/categorias', articulos: '/articulos',
  stock: '/stock', clientes: '/clientes', 'punto-alquiler': '/punto-alquiler',
  maquinas: '/maquinas', alquileres: '/alquileres', servicios: '/servicios',
}
const pathToPage: Record<string, string> = Object.fromEntries(
  Object.entries(pageToPath).map(([k, v]) => [v, k])
)

export default function Dashboard({ user, onLogout }: { user: User; onLogout: () => void }) {
  const sections      = allSections.filter(s => s.roles.includes(user.rol))
  const routerNav     = useNavigate()
  const { pathname }  = useLocation()

  const [activePage, setActivePage]   = useState(() => pathToPage[pathname] ?? 'punto-venta')
  const [expanded, setExpanded]       = useState<string[]>(['ventas', 'inventario'])
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Sincroniza activePage cuando el usuario usa el botón atrás/adelante del navegador
  useEffect(() => {
    const page = pathToPage[pathname] ?? 'punto-venta'
    setActivePage(page)
  }, [pathname])

  const toggle = (id: string) =>
    setExpanded(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const isAnyPageActive = (sub: SubSection) =>
    sub.children?.some(p => p.id === activePage) ?? false

  const navigate = (id: string) => {
    setActivePage(id)
    setSidebarOpen(false)
    routerNav(pageToPath[id] ?? '/')
  }

  const renderContent = () => {
    if (activePage === 'punto-venta')  return <Ventas       user={user} />
    if (activePage === 'categorias')   return <Categorias   user={user} />
    if (activePage === 'articulos')    return <Articulos    user={user} />
    if (activePage === 'stock')        return <Stock        user={user} />
    if (activePage === 'clientes')     return <Clientes     user={user} />
    if (activePage === 'punto-alquiler') return <PuntoAlquiler user={user} />
    if (activePage === 'maquinas')     return <Maquinas     user={user} />
    if (activePage === 'alquileres')   return <Alquileres   user={user} />
    return (
      <div style={st.contentArea}>
        <div style={st.devCard}>
          <div style={st.devIcon}><i className="bi bi-cone-striped" /></div>
          <h3 style={st.devTitle}>En Desarrollo</h3>
          <p style={st.devText}>El módulo de <strong>{pageLabels[activePage]}</strong> está siendo construido.</p>
          <div style={st.devBadge}>Próximamente</div>
        </div>
      </div>
    )
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
              <p style={st.userRole}>{user.rol === 'ADMIN' ? 'Administrador' : 'Vendedor'}</p>
            </div>
          </div>

          <div style={st.navSection}>
            <p style={st.navLabel}>MENÚ PRINCIPAL</p>
            <nav style={st.nav}>
              {sections.map(section => {
                const secExpanded = expanded.includes(section.id)
                const hasChildren = !!section.children?.length
                const secHasActive = section.children?.some(sub =>
                  sub.id === activePage || sub.children?.some(p => p.id === activePage)
                )
                return (
                  <div key={section.id}>
                    <button
                      style={{ ...st.navItem, ...(secHasActive ? st.navItemActive : {}) }}
                      onClick={() => hasChildren ? toggle(section.id) : navigate(section.id)}
                    >
                      <span style={st.navIcon}><i className={`bi ${section.icon}`} /></span>
                      <span style={{ flex: 1, textAlign: 'left' }}>{section.label}</span>
                      {hasChildren && (
                        <i className="bi bi-chevron-down" style={{ ...st.arrow, transform: secExpanded ? 'rotate(180deg)' : 'none' }} />
                      )}
                    </button>

                    {hasChildren && secExpanded && section.children!.map(sub => {
                      const subExpanded = expanded.includes(sub.id)
                      const subHasChildren = !!sub.children?.length
                      const subActive = isAnyPageActive(sub)
                      return (
                        <div key={sub.id} style={st.subMenuWrap}>
                          <button
                            style={{ ...st.subItem, ...(subActive ? st.subItemActive : {}) }}
                            onClick={() => subHasChildren ? toggle(sub.id) : navigate(sub.id)}
                          >
                            <span style={st.subIcon}><i className={`bi ${sub.icon}`} /></span>
                            <span style={{ flex: 1, textAlign: 'left' }}>{sub.label}</span>
                            {subHasChildren && (
                              <i className="bi bi-chevron-down" style={{ ...st.arrow, fontSize: '10px', transform: subExpanded ? 'rotate(180deg)' : 'none' }} />
                            )}
                          </button>
                          {subHasChildren && subExpanded && (
                            <div style={st.pageMenuWrap}>
                              {sub.children!.map(page => (
                                <button
                                  key={page.id}
                                  style={{ ...st.pageItem, ...(activePage === page.id ? st.pageItemActive : {}) }}
                                  onClick={() => navigate(page.id)}
                                >
                                  <span style={st.pageIcon}><i className={`bi ${page.icon}`} /></span>
                                  <span>{page.label}</span>
                                  {activePage === page.id && <span style={st.pageDot} />}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
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
            <div>
              <h2 style={st.pageTitle}>{pageLabels[activePage] ?? ''}</h2>
              <p className="db-topbar-path" style={st.pagePath}>
                SH Servicios &rsaquo; {pageLabels[activePage] ?? ''}
              </p>
            </div>
          </div>
          <div style={st.topBarRight}>
            <div style={st.topBarUser}>
              <span style={st.topBarAvatar}>{user.nombre.charAt(0).toUpperCase()}</span>
              <span className="db-topbar-name" style={st.topBarName}>{user.nombre}</span>
            </div>
          </div>
        </div>

        <div style={contentPages.includes(activePage) ? st.contentFull : undefined}>
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
  arrow:        { fontSize: '10px', color: '#7C7C7C', display: 'inline-block', transition: 'transform 0.2s' },

  subMenuWrap:  { marginLeft: '10px', paddingLeft: '10px', borderLeft: '1px solid #1D1D1D' },
  subItem:      { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', background: 'transparent', border: 'none', borderRadius: '7px', color: '#B7B7B7', fontSize: '12px', fontWeight: '500', cursor: 'pointer', width: '100%' },
  subItemActive:{ background: '#1E1E1E', color: '#F5C400', fontWeight: '600' },
  subIcon:      { fontSize: '14px', width: '18px', textAlign: 'center' },

  pageMenuWrap: { marginLeft: '8px', paddingLeft: '8px', borderLeft: '1px solid #1A1A1A' },
  pageItem:     { display: 'flex', alignItems: 'center', gap: '7px', padding: '7px 10px', background: 'transparent', border: 'none', borderRadius: '6px', color: '#9A9A9A', fontSize: '12px', fontWeight: '500', cursor: 'pointer', width: '100%', position: 'relative' },
  pageItemActive:{ background: '#1E1E1E', color: '#F5C400', fontWeight: '600' },
  pageIcon:     { fontSize: '12px' },
  pageDot:      { position: 'absolute', right: '8px', width: '5px', height: '5px', borderRadius: '50%', background: '#F5C400' },

  logoutBtn:    { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px', background: 'transparent', border: '1px solid #1D1D1D', borderRadius: '8px', color: '#B7B7B7', fontSize: '13px', cursor: 'pointer', width: '100%' },

  hLine:        { display: 'block', width: '22px', height: '2px', background: '#111111', borderRadius: '2px' },

  topBar:       { padding: '16px 20px', borderBottom: '1px solid #E2E4E8', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FFFFFF', flexShrink: 0 },
  pageTitle:    { color: '#111111', fontSize: '18px', fontWeight: '700', margin: 0 },
  pagePath:     { color: '#6B6B6B', fontSize: '12px', margin: '3px 0 0' },
  topBarRight:  { display: 'flex', alignItems: 'center', gap: '12px' },
  topBarUser:   { display: 'flex', alignItems: 'center', gap: '8px', background: '#F5F5F5', border: '1px solid #E2E4E8', borderRadius: '8px', padding: '6px 12px' },
  topBarAvatar: { width: '26px', height: '26px', borderRadius: '50%', background: '#111111', color: '#F5C400', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '11px' },
  topBarName:   { color: '#111111', fontSize: '13px', fontWeight: '500' },

  contentFull:  { flex: 1, overflowY: 'auto' },
  contentArea:  { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' },
  devCard:      { background: '#FFFFFF', border: '1px solid #E2E4E8', borderRadius: '16px', padding: '40px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', maxWidth: '400px' },
  devIcon:      { fontSize: '48px', color: '#D6D6D6' },
  devTitle:     { color: '#111111', fontSize: '22px', fontWeight: '700', margin: 0 },
  devText:      { color: '#6B6B6B', fontSize: '15px', lineHeight: '1.6', margin: 0 },
  devBadge:     { background: 'rgba(245,196,0,0.15)', color: '#8A6D00', border: '1px solid rgba(245,196,0,0.4)', padding: '6px 20px', borderRadius: '20px', fontSize: '13px', fontWeight: '600', marginTop: '8px' },

  footer:       { padding: '10px 20px', borderTop: '1px solid #E2E4E8', textAlign: 'center', flexShrink: 0, background: '#FFFFFF' },
  footerText:   { color: '#9A9A9A', fontSize: '11px' },
}
