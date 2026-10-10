import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import type { User } from '../types'
import { API, CATALOGO_URL } from '../config'
import { socket } from '../socket'
import { puede } from '../permisos'
import Inicio from './Inicio'
import Articulos from './Articulos'
import Categorias from './Categorias'
import RetiroRepuestos from './RetiroRepuestos'
import Ventas from './Ventas'
import HistorialVentas from './HistorialVentas'
import Clientes from './Clientes'
import ServiciosTecnicos from './ServiciosTecnicos'
import HistorialServicios from './HistorialServicios'
import Tecnicos from './Tecnicos'
import Novedades from './Novedades'
import Importar from './Importar'
import Exportar from './Exportar'
import Configuracion from './Configuracion'
import Usuarios from './Usuarios'
import Roles from './Roles'
import Auditoria from './Auditoria'
import Perfil from './Perfil'
import Campana, { type Notificacion } from '../components/Campana'
import Dropdown from '../components/Dropdown'
import { cargarEmpresa } from '../empresa'
import type { Servicio } from '../servicios'

// Cada entrada se ve si el rol del usuario tiene alguno de sus permisos (vacío = la ven todos)
interface NavItem { id: string; label: string; icon: string; path: string; permisos: string[] }
type NavEntry = { section: string } | NavItem

// Menú agrupado en secciones, igual que el panel del catálogo
const NAV: NavEntry[] = [
  { section: 'General' },
  { id: 'inicio',              label: 'Inicio',                 icon: 'bi-speedometer2',         path: '/',                    permisos: [] },

  { section: 'Catálogo' },
  { id: 'maquinaria',          label: 'Maquinaria',             icon: 'bi-truck-front-fill',     path: '/maquinaria',          permisos: ['productos.ver'] },
  { id: 'repuestos',           label: 'Repuestos',              icon: 'bi-nut-fill',             path: '/repuestos',           permisos: ['productos.ver'] },
  { id: 'categorias',          label: 'Categorías',             icon: 'bi-diagram-3-fill',       path: '/categorias',          permisos: ['productos.ver', 'categorias.gestionar'] },

  { section: 'Ventas' },
  { id: 'punto-venta',         label: 'Punto de Venta',         icon: 'bi-receipt',              path: '/punto-venta',         permisos: ['ventas.crear'] },
  { id: 'historial-ventas',    label: 'Historial de Ventas',    icon: 'bi-clock-history',        path: '/historial-ventas',    permisos: ['ventas.ver'] },
  { id: 'clientes',            label: 'Clientes',               icon: 'bi-people',               path: '/clientes',            permisos: ['clientes.gestionar'] },

  { section: 'Servicio técnico' },
  { id: 'servicios',           label: 'Servicios Técnicos',     icon: 'bi-tools',                path: '/servicios',           permisos: ['servicios.gestionar', 'servicios.tecnico'] },
  { id: 'tecnicos',            label: 'Técnicos',               icon: 'bi-person-gear',          path: '/tecnicos',            permisos: ['tecnicos.ver', 'tecnicos.gestionar'] },
  { id: 'historial-servicios', label: 'Historial de servicios', icon: 'bi-journal-text',         path: '/historial-servicios', permisos: ['servicios.gestionar'] },
  { id: 'retiros',             label: 'Retiro de repuestos',    icon: 'bi-box-arrow-up-right',   path: '/retiros',             permisos: ['retiros.gestionar'] },

  { section: 'Gestión' },
  { id: 'novedades',           label: 'Novedades',              icon: 'bi-megaphone-fill',       path: '/novedades',           permisos: [] },
  { id: 'importar',            label: 'Importar',               icon: 'bi-upload',               path: '/importar',            permisos: ['datos.importar'] },
  { id: 'exportar',            label: 'Exportar',               icon: 'bi-download',             path: '/exportar',            permisos: ['datos.exportar'] },
  { id: 'configuracion',       label: 'Configuración',          icon: 'bi-gear-fill',            path: '/configuracion',       permisos: ['configuracion.gestionar'] },

  { section: 'Seguridad' },
  { id: 'usuarios',            label: 'Usuarios',               icon: 'bi-people-fill',          path: '/usuarios',            permisos: ['usuarios.ver', 'usuarios.gestionar'] },
  { id: 'roles',               label: 'Roles',                  icon: 'bi-shield-lock-fill',     path: '/roles',               permisos: ['roles.gestionar'] },
  { id: 'auditoria',           label: 'Auditoría',              icon: 'bi-clipboard-check-fill', path: '/auditoria',           permisos: ['auditoria.ver'] },
]

// "Mi perfil" no está en el menú lateral: se entra desde el menú del usuario (como en el catálogo)
const PERFIL: NavItem = { id: 'perfil', label: 'Mi perfil', icon: 'bi-person', path: '/perfil', permisos: [] }

const isItem = (e: NavEntry): e is NavItem => 'id' in e

export default function Dashboard({ user, onLogout, onUserUpdate }: { user: User; onLogout: () => void; onUserUpdate: (s: { token: string; user: User }) => void }) {
  const visible = (e: NavItem) => !e.permisos.length || puede(user, ...e.permisos)
  // Los títulos de sección que quedan sin ninguna entrada visible debajo no se muestran
  const conVisibles = NAV.filter(e => !isItem(e) || visible(e))
  const entries = conVisibles.filter((e, i) => isItem(e) || (i + 1 < conVisibles.length && isItem(conVisibles[i + 1])))
  const pages = [...entries.filter(isItem), PERFIL]

  const routerNav = useNavigate()
  const { pathname, key: claveNavegacion } = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [bajoStock, setBajoStock] = useState({ MAQUINARIA: 0, REPUESTO: 0 })
  const [retirosPendientes, setRetirosPendientes] = useState(0)
  const [avisosServicios, setAvisosServicios] = useState(0)

  // La página activa sale de la URL (así funcionan atrás/adelante; /roles/3 es la edición de un rol);
  // si el rol no puede verla, va a su primera página
  const activePage = pages.find(p => p.path === pathname)
    ?? pages.find(p => p.path !== '/' && pathname.startsWith(`${p.path}/`))
    ?? pages[0]
  const subId = Number(pathname.split('/')[2]) || undefined
  const veProductos = puede(user, 'productos.ver')
  const veRetiros = puede(user, 'retiros.gestionar')
  const veServicios = puede(user, 'servicios.gestionar', 'servicios.tecnico')

  useEffect(() => { cargarEmpresa() }, [])

  // Productos activos con stock en el mínimo o por debajo, separados en máquinas y repuestos
  useEffect(() => {
    if (!veProductos) return
    const headers = { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` }
    const actualizar = () =>
      fetch(`${API}/products/low-stock`, { headers }).then(r => r.json()).then((data: { tipoProducto: 'MAQUINARIA' | 'REPUESTO' }[]) => {
        setBajoStock({
          MAQUINARIA: data.filter(p => p.tipoProducto === 'MAQUINARIA').length,
          REPUESTO: data.filter(p => p.tipoProducto !== 'MAQUINARIA').length,
        })
      })
    actualizar()
    socket.on('stock-actualizado', actualizar)
    return () => { socket.off('stock-actualizado', actualizar) }
  }, [veProductos])

  // Retiros que el depósito todavía tiene que preparar
  useEffect(() => {
    if (!veRetiros) return
    const headers = { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` }
    const actualizar = () =>
      fetch(`${API}/repairs/retiros`, { headers }).then(r => r.json()).then((retiros: Servicio[]) => {
        setRetirosPendientes(retiros.filter(r => r.estadoRetiro === 'PENDIENTE').length)
      })
    actualizar()
    socket.on('servicios-actualizados', actualizar)
    return () => { socket.off('servicios-actualizados', actualizar) }
  }, [veRetiros])

  // Avisos para quien pidió el servicio (sin técnico asignado, o repuestos ya listos para retirar)
  const gestionaServicios = puede(user, 'servicios.gestionar')
  useEffect(() => {
    if (!veServicios) return
    const headers = { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` }
    const actualizar = () => {
      fetch(`${API}/repairs`, { headers }).then(r => r.json()).then((servicios: Servicio[]) => {
        const enCurso = servicios.filter(sv => sv.estado === 'EN_CURSO')
        setAvisosServicios(
          (gestionaServicios ? enCurso.filter(sv => !sv.tecnico).length : 0)
          + enCurso.filter(sv => sv.estadoRetiro === 'LISTO').length
        )
      })
    }
    actualizar()
    socket.on('servicios-actualizados', actualizar)
    return () => { socket.off('servicios-actualizados', actualizar) }
  }, [veServicios, gestionaServicios])

  const ir = (path: string, state?: object) => { setSidebarOpen(false); routerNav(path, { state }) }

  // Al tocar una notificación se va a la pantalla donde hay que actuar
  const irA = (n: Notificacion) => {
    if (n.area === 'INVENTARIO') ir('/retiros')
    else ir('/servicios', { servicioId: n.servicioId })
  }

  const badges: Record<string, { valor: number; titulo: string }> = {
    maquinaria: { valor: bajoStock.MAQUINARIA, titulo: 'Máquinas con stock bajo' },
    repuestos:  { valor: bajoStock.REPUESTO, titulo: 'Repuestos con stock bajo' },
    retiros:    { valor: retirosPendientes, titulo: 'Retiros de repuestos pendientes de preparar' },
    servicios:  { valor: avisosServicios, titulo: 'Servicios que necesitan atención' },
  }

  const renderContent = () => {
    switch (activePage.id) {
      case 'maquinaria':          return <Articulos key={`MAQUINARIA-${claveNavegacion}`} tipo="MAQUINARIA" user={user} />
      case 'repuestos':           return <Articulos key={`REPUESTO-${claveNavegacion}`} tipo="REPUESTO" user={user} />
      case 'categorias':          return <Categorias user={user} />
      case 'retiros':             return <RetiroRepuestos />
      case 'historial-ventas':    return <HistorialVentas />
      case 'clientes':            return <Clientes user={user} />
      case 'servicios':           return <ServiciosTecnicos key={claveNavegacion} user={user} />
      case 'tecnicos':            return <Tecnicos />
      case 'historial-servicios': return <HistorialServicios />
      case 'novedades':           return <Novedades />
      case 'importar':            return <Importar />
      case 'exportar':            return <Exportar user={user} />
      case 'configuracion':       return <Configuracion />
      case 'usuarios':            return <Usuarios user={user} />
      case 'roles':               return <Roles key={subId ?? 'lista'} rolId={subId} />
      case 'auditoria':           return <Auditoria user={user} />
      case 'perfil':              return <Perfil user={user} onUserUpdate={onUserUpdate} />
      case 'punto-venta':         return <Ventas user={user} />
      default:                    return <Inicio user={user} />
    }
  }

  return (
    <div className="admin-shell">

      {/* Barra lateral */}
      <aside className={`admin-sidebar${sidebarOpen ? ' is-open' : ''}`}>
        <div className="admin-sidebar__head">
          <button type="button" className="admin-sidebar__close" aria-label="Cerrar menú" onClick={() => setSidebarOpen(false)}>
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <nav className="admin-nav" aria-label="Menú del panel">
          {entries.map(entry => !isItem(entry)
            ? <p key={entry.section} className="admin-nav__section">{entry.section}</p>
            : (
              <button key={entry.id} type="button" className={`admin-nav__link${entry.id === activePage.id ? ' is-active' : ''}`} onClick={() => ir(entry.path)}>
                <i className={`bi ${entry.icon}`} />
                <span>{entry.label}</span>
                {badges[entry.id]?.valor > 0 && (
                  <span className="admin-nav__badge" title={badges[entry.id].titulo}>{badges[entry.id].valor}</span>
                )}
              </button>
            ))}
        </nav>

        <div className="admin-sidebar__foot">
          <a href={CATALOGO_URL} target="_blank" rel="noopener" className="admin-sidebar__site">
            <i className="bi bi-box-arrow-up-right" /> Ver el sitio
          </a>
        </div>
      </aside>

      {/* Contenido */}
      <div className="admin-main">
        <header className="admin-topbar">
          <button type="button" className="admin-topbar__toggle" aria-label="Abrir menú" onClick={() => setSidebarOpen(true)}>
            <i className="bi bi-list" />
          </button>

          <h1 className="admin-topbar__title">{activePage.label}</h1>

          <div className="admin-topbar__actions">
            <Campana onIr={irA} />
            <Dropdown align="end" triggerClassName="admin-user" trigger={<>
              <span className="admin-user__avatar">{user.nombre.charAt(0).toUpperCase()}</span>
              <span className="admin-user__info">
                <strong>{user.nombre}</strong>
                <small>{user.rol.nombre}</small>
              </span>
              <i className="bi bi-chevron-down" />
            </>}>
              {cerrar => <>
                <button className="dropdown-item" onClick={() => { cerrar(); ir('/perfil') }}><i className="bi bi-person" /> Mi perfil</button>
                <a className="dropdown-item" href={CATALOGO_URL} target="_blank" rel="noopener" onClick={cerrar}><i className="bi bi-globe" /> Ver el sitio</a>
                <hr className="dropdown-divider" />
                <button className="dropdown-item text-danger" onClick={onLogout}><i className="bi bi-box-arrow-right" /> Cerrar sesión</button>
              </>}
            </Dropdown>
          </div>
        </header>

        <div className="admin-content">
          {renderContent()}
        </div>

        <footer className="admin-footer">
          <span>Proyecto desarrollado por <strong>Rodríguez Nazareno</strong> · <strong>Jacobo Santiago</strong> · <strong>Mover Leonardo</strong></span>
        </footer>
      </div>

      <div className={`admin-backdrop${sidebarOpen ? ' is-visible' : ''}`} onClick={() => setSidebarOpen(false)} />
    </div>
  )
}
