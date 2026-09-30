import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import type { User } from '../types'
import { API } from '../config'
import { socket } from '../socket'
import Inventario from './Inventario'
import Ventas from './Ventas'
import HistorialVentas from './HistorialVentas'
import Clientes from './Clientes'
import ServiciosTecnicos from './ServiciosTecnicos'
import HistorialServicios from './HistorialServicios'
import Tecnicos from './Tecnicos'
import type { Servicio } from '../servicios'

interface NavItem { id: string; label: string; icon: string; path: string; roles: string[] }
interface NavGroup extends NavItem { children: NavItem[] }
type NavEntry = NavItem | NavGroup

const isGroup = (e: NavEntry): e is NavGroup => Array.isArray((e as NavGroup).children)

const ADMINISTRACION = ['ADMIN', 'VENDEDOR']
const ROL_LABEL: Record<string, string> = { ADMIN: 'Administrador', VENDEDOR: 'Vendedor', TECNICO: 'Técnico' }

// Menú de un solo nivel, salvo Servicios Técnicos que despliega Técnicos e Historial
const allEntries: NavEntry[] = [
  { id: 'punto-venta',      label: 'Punto de Venta',      icon: 'bi-receipt',       path: '/',                 roles: ADMINISTRACION, children: [] },
  { id: 'historial-ventas', label: 'Historial de Ventas', icon: 'bi-clock-history', path: '/historial-ventas', roles: ADMINISTRACION, children: [] },
  {
    id: 'servicios', label: 'Servicios Técnicos', icon: 'bi-tools', path: '/servicios', roles: [...ADMINISTRACION, 'TECNICO'],
    children: [
      { id: 'tecnicos',            label: 'Técnicos',   icon: 'bi-person-gear',   path: '/tecnicos',            roles: ADMINISTRACION },
      { id: 'historial-servicios', label: 'Historial',  icon: 'bi-clock-history', path: '/historial-servicios', roles: ADMINISTRACION },
    ],
  },
  { id: 'clientes',    label: 'Clientes',    icon: 'bi-people',   path: '/clientes',   roles: ADMINISTRACION, children: [] },
  { id: 'inventario',  label: 'Inventario',  icon: 'bi-box-seam', path: '/inventario', roles: ADMINISTRACION, children: [] },
]

export default function Dashboard({ user, onLogout }: { user: User; onLogout: () => void }) {
  // Cada entrada (y sus hijos) se filtra por rol; un grupo sin hijos visibles queda como link simple
  const entries = allEntries
    .filter(e => e.roles.includes(user.rol))
    .map(e => isGroup(e) ? { ...e, children: e.children.filter(c => c.roles.includes(user.rol)) } : e)

  const flatPages: NavItem[] = entries.flatMap(e => isGroup(e) ? [e, ...e.children] : [e])

  const routerNav     = useNavigate()
  const { pathname }  = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [expanded, setExpanded]       = useState<string[]>([])
  const [stockBajo, setStockBajo]     = useState(0)
  const [retirosPendientes, setRetirosPendientes] = useState(0)
  const [avisosServicios, setAvisosServicios] = useState(0)

  // La página activa sale de la URL (así funcionan atrás/adelante); si el rol no puede verla, va a su primera página
  const activePage = flatPages.find(p => p.path === pathname) ?? flatPages[0]
  const veInventario = flatPages.some(p => p.id === 'inventario')
  const veServicios  = flatPages.some(p => p.id === 'servicios')

  useEffect(() => {
    if (!veInventario) return
    const headers = { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` }
    const fetchStockBajo = () =>
      fetch(`${API}/products/low-stock`, { headers }).then(r => r.json()).then(data => setStockBajo(data.length))
    fetchStockBajo()
    socket.on('stock-actualizado', fetchStockBajo)
    return () => { socket.off('stock-actualizado', fetchStockBajo) }
  }, [veInventario])

  // Retiros que el depósito todavía tiene que preparar, y avisos para quien pidió el servicio
  // (sin técnico asignado, o repuestos ya listos para retirar)
  useEffect(() => {
    if (!veServicios) return
    const headers = { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` }
    const actualizar = () => {
      if (user.rol !== 'TECNICO') {
        fetch(`${API}/repairs/retiros`, { headers }).then(r => r.json()).then((retiros: Servicio[]) => {
          setRetirosPendientes(retiros.filter(r => r.estadoRetiro === 'PENDIENTE').length)
        })
      }
      fetch(`${API}/repairs`, { headers }).then(r => r.json()).then((servicios: Servicio[]) => {
        const enCurso = servicios.filter(sv => sv.estado === 'EN_CURSO')
        setAvisosServicios(
          (user.rol === 'TECNICO' ? 0 : enCurso.filter(sv => !sv.tecnico).length)
          + enCurso.filter(sv => sv.estadoRetiro === 'LISTO').length
        )
      })
    }
    actualizar()
    socket.on('servicios-actualizados', actualizar)
    return () => { socket.off('servicios-actualizados', actualizar) }
  }, [veServicios, user.rol])

  const navigate = (entry: NavEntry) => {
    setSidebarOpen(false)
    routerNav(entry.path)
    if (isGroup(entry) && entry.children.length > 0) setExpanded(prev => prev.includes(entry.id) ? prev : [...prev, entry.id])
  }
  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpanded(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const renderContent = () => {
    if (activePage.id === 'historial-ventas')    return <HistorialVentas />
    if (activePage.id === 'servicios')           return <ServiciosTecnicos user={user} />
    if (activePage.id === 'tecnicos')            return <Tecnicos />
    if (activePage.id === 'historial-servicios') return <HistorialServicios />
    if (activePage.id === 'clientes')            return <Clientes user={user} />
    if (activePage.id === 'inventario')          return <Inventario user={user} />
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
              {entries.map(entry => {
                const hasChildren = isGroup(entry) && entry.children.length > 0
                const isExpanded = expanded.includes(entry.id)
                const childActive = hasChildren && (entry as NavGroup).children.some(c => c.id === activePage.id)
                const badge = entry.id === 'inventario' ? stockBajo + retirosPendientes : entry.id === 'servicios' ? avisosServicios : 0
                return (
                  <div key={entry.id}>
                    <button
                      style={{ ...st.navItem, ...(entry.id === activePage.id || childActive ? st.navItemActive : {}) }}
                      onClick={() => navigate(entry)}
                    >
                      <span style={st.navIcon}><i className={`bi ${entry.icon}`} /></span>
                      <span style={{ flex: 1, textAlign: 'left' }}>{entry.label}</span>
                      {badge > 0 && (
                        <span style={st.navBadge} title={entry.id === 'inventario' ? 'Stock bajo o retiros de repuestos pendientes de preparar' : 'Servicios que necesitan atención'}>{badge}</span>
                      )}
                      {hasChildren && (
                        <span style={st.chevron} onClick={e => toggleExpand(entry.id, e)}>
                          <i className={`bi bi-chevron-${isExpanded ? 'up' : 'down'}`} />
                        </span>
                      )}
                    </button>
                    {hasChildren && isExpanded && (entry as NavGroup).children.map(child => (
                      <button key={child.id} style={{ ...st.navSubItem, ...(child.id === activePage.id ? st.navItemActive : {}) }}
                        onClick={() => navigate(child)}>
                        <span style={st.navIcon}><i className={`bi ${child.icon}`} /></span>
                        <span style={{ flex: 1, textAlign: 'left' }}>{child.label}</span>
                      </button>
                    ))}
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
  navSubItem:   { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px 8px 30px', background: 'transparent', border: 'none', borderRadius: '8px', color: '#B7B7B7', fontSize: '12px', fontWeight: '500', cursor: 'pointer', width: '100%' },
  navItemActive:{ background: '#1E1E1E', color: '#FFFFFF', fontWeight: '600' },
  navIcon:      { fontSize: '16px', width: '20px', textAlign: 'center' },
  navBadge:     { background: '#E08A00', color: '#111111', borderRadius: '10px', padding: '1px 7px', fontSize: '11px', fontWeight: '800' },
  chevron:      { fontSize: '11px', padding: '2px 4px', color: '#8C8C8C' },

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
