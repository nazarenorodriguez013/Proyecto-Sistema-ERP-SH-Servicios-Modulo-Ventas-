import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { User } from '../types'
import { API, CATALOGO_URL } from '../config'
import { socket } from '../socket'
import { puede } from '../permisos'
import type { Servicio } from '../servicios'

interface Producto { tipoProducto: 'MAQUINARIA' | 'REPUESTO'; activo: boolean; precio: number; stock: number; stockMinimo: number }
interface Venta { id: number; numero: number; total: number; tipoComprobante: string; medioPago: string; creadoEn: string; cliente: { nombre: string } | null }
interface Datos { productos: Producto[]; categorias: number; servicios: Servicio[]; retiros: Servicio[]; ventas: Venta[] }

const numero = (n: number) => n.toLocaleString('es-AR')
const pesos = (n: number) => `$${n.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`
const esHoy = (iso: string) => new Date(iso).toDateString() === new Date().toDateString()

// Inicio, como el del panel del catálogo: números principales, lo que hay para revisar, resumen, últimos movimientos
// y accesos rápidos. Cada bloque aparece solo si el rol puede ver esa información.
export default function Inicio({ user }: { user: User }) {
  const navegar = useNavigate()
  const [datos, setDatos] = useState<Datos | null>(null)

  const veProductos = puede(user, 'productos.ver')
  const veServicios = puede(user, 'servicios.gestionar', 'servicios.tecnico')
  const gestionaServicios = puede(user, 'servicios.gestionar')
  const veRetiros = puede(user, 'retiros.gestionar')
  const veVentas = puede(user, 'ventas.ver')
  const editaProductos = puede(user, 'productos.editar')

  useEffect(() => {
    const headers = { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` }
    const traer = <T,>(ruta: string, permitido: boolean, vacio: T): Promise<T> =>
      permitido ? fetch(`${API}${ruta}`, { headers }).then(r => r.ok ? r.json() : vacio).catch(() => vacio) : Promise.resolve(vacio)
    const cargar = () => Promise.all([
      traer<Producto[]>('/products', veProductos, []),
      traer<unknown[]>('/categories', veProductos, []),
      traer<Servicio[]>('/repairs', veServicios, []),
      traer<Servicio[]>('/repairs/retiros', veRetiros, []),
      traer<Venta[]>('/sales', veVentas, []),
    ]).then(([productos, categorias, servicios, retiros, ventas]) =>
      setDatos({ productos, categorias: categorias.length, servicios, retiros, ventas }))
    cargar()
    // Se mantiene al día con lo que pasa en las otras terminales
    socket.on('stock-actualizado', cargar)
    socket.on('servicios-actualizados', cargar)
    return () => { socket.off('stock-actualizado', cargar); socket.off('servicios-actualizados', cargar) }
  }, [])

  if (!datos) return <div className="admin-page text-muted-2" style={{ textAlign: 'center', padding: '40px' }}>Cargando...</div>

  const de = (tipo: Producto['tipoProducto']) => datos.productos.filter(p => p.tipoProducto === tipo)
  const maquinas = de('MAQUINARIA'), repuestos = de('REPUESTO')
  const stockBajo = (lista: Producto[]) => lista.filter(p => p.activo && p.stock <= p.stockMinimo).length
  const sinPrecio = (lista: Producto[]) => lista.filter(p => p.activo && p.precio === 0).length
  const enCurso = datos.servicios.filter(s => s.estado === 'EN_CURSO')
  const ventasHoy = datos.ventas.filter(v => esHoy(v.creadoEn))

  const revisar = [
    { visible: veProductos, label: 'Máquinas con stock bajo', icon: 'bi-truck-front', cantidad: stockBajo(maquinas), ir: () => navegar('/maquinaria', { state: { filtro: 'reponer' } }) },
    { visible: veProductos, label: 'Repuestos con stock bajo', icon: 'bi-nut', cantidad: stockBajo(repuestos), ir: () => navegar('/repuestos', { state: { filtro: 'reponer' } }) },
    { visible: veProductos, label: 'Máquinas sin precio (a consultar)', icon: 'bi-currency-dollar', cantidad: sinPrecio(maquinas), ir: () => navegar('/maquinaria') },
    { visible: veProductos, label: 'Repuestos sin precio (a consultar)', icon: 'bi-currency-dollar', cantidad: sinPrecio(repuestos), ir: () => navegar('/repuestos') },
    { visible: gestionaServicios, label: 'Servicios sin técnico asignado', icon: 'bi-person-gear', cantidad: enCurso.filter(s => !s.tecnico).length, ir: () => navegar('/servicios') },
    { visible: veRetiros, label: 'Retiros de repuestos para preparar', icon: 'bi-box-arrow-up-right', cantidad: datos.retiros.filter(r => r.estadoRetiro === 'PENDIENTE').length, ir: () => navegar('/retiros') },
    { visible: veServicios, label: 'Repuestos listos para retirar', icon: 'bi-box-seam', cantidad: enCurso.filter(s => s.estadoRetiro === 'LISTO').length, ir: () => navegar('/servicios') },
  ].filter(r => r.visible)
  const totalRevisar = revisar.reduce((s, r) => s + r.cantidad, 0)

  const accesos = [
    { visible: editaProductos, label: 'Cargar una máquina', icon: 'bi-plus-lg', principal: true, ir: () => navegar('/maquinaria', { state: { nuevo: true } }) },
    { visible: editaProductos, label: 'Cargar un repuesto', icon: 'bi-plus-lg', principal: true, ir: () => navegar('/repuestos', { state: { nuevo: true } }) },
    { visible: puede(user, 'ventas.crear'), label: 'Nueva venta', icon: 'bi-receipt', principal: !editaProductos, ir: () => navegar('/punto-venta') },
    { visible: puede(user, 'datos.importar'), label: 'Importar productos', icon: 'bi-upload', principal: false, ir: () => navegar('/importar') },
    { visible: puede(user, 'datos.exportar'), label: 'Exportar productos', icon: 'bi-download', principal: false, ir: () => navegar('/exportar') },
  ].filter(a => a.visible)

  return (
    <div className="admin-page">
      {/* ================= NÚMEROS PRINCIPALES ================= */}
      <div className="stat-grid">
        {veProductos && <>
          <div className="stat-card stat-card--dark">
            <div className="stat-card__label"><i className="bi bi-truck-front" /> Maquinaria</div>
            <div className="stat-card__value">{numero(maquinas.length)}</div>
            <div className="stat-card__hint">{numero(maquinas.filter(p => p.activo).length)} activas · <button type="button" className="link-btn" onClick={() => navegar('/maquinaria')}>ver</button></div>
            <i className="bi bi-truck-front stat-card__icon" />
          </div>
          <div className="stat-card stat-card--info">
            <div className="stat-card__label"><i className="bi bi-nut" /> Repuestos</div>
            <div className="stat-card__value">{numero(repuestos.length)}</div>
            <div className="stat-card__hint">{numero(repuestos.filter(p => p.activo).length)} activos · <button type="button" className="link-btn" onClick={() => navegar('/repuestos')}>ver</button></div>
            <i className="bi bi-nut stat-card__icon" />
          </div>
        </>}
        {veServicios && (
          <div className={`stat-card${enCurso.some(s => !s.tecnico) ? ' stat-card--warn' : ''}`}>
            <div className="stat-card__label"><i className="bi bi-tools" /> Servicios en curso</div>
            <div className="stat-card__value">{numero(enCurso.length)}</div>
            <div className="stat-card__hint">
              {gestionaServicios && enCurso.some(s => !s.tecnico)
                ? <span className="chip chip--accent">{enCurso.filter(s => !s.tecnico).length} sin técnico</span>
                : gestionaServicios ? 'Todos asignados' : 'Asignados a vos'}
            </div>
            <i className="bi bi-tools stat-card__icon" />
          </div>
        )}
        {veVentas && (
          <div className="stat-card stat-card--ok">
            <div className="stat-card__label"><i className="bi bi-receipt" /> Ventas de hoy</div>
            <div className="stat-card__value">{pesos(ventasHoy.reduce((s, v) => s + v.total, 0))}</div>
            <div className="stat-card__hint">{numero(ventasHoy.length)} comprobante(s) · <button type="button" className="link-btn" onClick={() => navegar('/historial-ventas')}>ver</button></div>
            <i className="bi bi-receipt stat-card__icon" />
          </div>
        )}
      </div>

      <div className="admin-grid-6-6">
        <div>
          {/* ============ PARA REVISAR ============ */}
          {revisar.length > 0 && (
            <div className="card-admin">
              <div className="card-admin__head">
                <h2><i className="bi bi-clipboard-check" /> Para revisar</h2>
                <span className="text-muted-2" style={{ fontSize: '.875rem' }}>{numero(totalRevisar)} pendiente(s)</span>
              </div>
              <div className="card-admin__body card-admin__body--flush">
                {totalRevisar === 0 ? (
                  <p className="card-admin__body text-muted-2" style={{ margin: 0 }}>
                    <i className="bi bi-check-circle" style={{ color: 'var(--yellow-dark)' }} /> No hay nada pendiente. Todo está al día.
                  </p>
                ) : (
                  <table className="table-admin">
                    <tbody>
                      {revisar.filter(r => r.cantidad > 0).map(r => (
                        <tr key={r.label}>
                          <td><i className={`bi ${r.icon} text-muted-2`} /> {r.label}</td>
                          <td className="num"><span className="chip chip--warn">{numero(r.cantidad)}</span></td>
                          <td className="actions"><button type="button" className="btn btn-ghost btn-sm" onClick={r.ir}>Ver</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* Resumen del catálogo */}
          {veProductos && (
            <div className="card-admin">
              <div className="card-admin__head"><h2><i className="bi bi-collection" /> Resumen del catálogo</h2></div>
              <div className="card-admin__body card-admin__body--flush">
                <table className="table-admin">
                  <tbody>
                    <tr><td>Categorías</td><td className="num"><strong>{numero(datos.categorias)}</strong></td>
                      <td className="actions"><button type="button" className="btn btn-ghost btn-sm" onClick={() => navegar('/categorias')}>Ver</button></td></tr>
                    <tr><td>Productos activos</td><td className="num"><strong>{numero(datos.productos.filter(p => p.activo).length)}</strong></td><td /></tr>
                    <tr><td>Productos sin stock</td><td className="num"><strong>{numero(datos.productos.filter(p => p.activo && p.stock === 0).length)}</strong></td><td /></tr>
                    <tr><td>Productos inactivos</td><td className="num"><strong>{numero(datos.productos.filter(p => !p.activo).length)}</strong></td><td /></tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div>
          {/* ============ ÚLTIMAS VENTAS / SERVICIOS + ACCESOS ============ */}
          {veVentas && (
            <div className="card-admin">
              <div className="card-admin__head">
                <h2><i className="bi bi-receipt" /> Últimas ventas</h2>
                <button type="button" className="link-btn text-muted-2" onClick={() => navegar('/historial-ventas')}>Ver todas</button>
              </div>
              <div className="card-admin__body card-admin__body--flush">
                {datos.ventas.length === 0 ? <p className="card-admin__body text-muted-2" style={{ margin: 0 }}>Todavía no hay ventas.</p> : (
                  <table className="table-admin">
                    <tbody>
                      {[...datos.ventas].sort((a, b) => b.creadoEn.localeCompare(a.creadoEn)).slice(0, 5).map(v => (
                        <tr key={v.id}>
                          <td>
                            <strong>{v.cliente?.nombre ?? 'Consumidor Final'}</strong>
                            <div className="text-muted-2 small-text">{v.tipoComprobante === 'REMITO' ? 'Remito' : 'Factura'} N° {v.numero} · {v.medioPago}</div>
                          </td>
                          <td className="num"><strong>{pesos(v.total)}</strong>
                            <div className="text-muted-2 small-text">{new Date(v.creadoEn).toLocaleDateString('es-AR')}</div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {veServicios && !veVentas && (
            <div className="card-admin">
              <div className="card-admin__head">
                <h2><i className="bi bi-tools" /> Servicios en curso</h2>
                <button type="button" className="link-btn text-muted-2" onClick={() => navegar('/servicios')}>Ver todos</button>
              </div>
              <div className="card-admin__body card-admin__body--flush">
                {enCurso.length === 0 ? <p className="card-admin__body text-muted-2" style={{ margin: 0 }}>No hay servicios en curso.</p> : (
                  <table className="table-admin">
                    <tbody>
                      {enCurso.slice(0, 5).map(s => (
                        <tr key={s.id}>
                          <td><strong>#{s.id} · {s.equipo}</strong><div className="text-muted-2 small-text">{s.cliente?.nombre}</div></td>
                          <td className="actions"><button type="button" className="btn btn-ghost btn-sm" onClick={() => navegar('/servicios', { state: { servicioId: s.id } })}>Ver</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          <div className="card-admin">
            <div className="card-admin__head"><h2><i className="bi bi-lightning-charge-fill" /> Accesos rápidos</h2></div>
            <div className="card-admin__body">
              <div className="accesos">
                {accesos.map(a => (
                  <button key={a.label} type="button" className={`btn ${a.principal ? 'btn-accent' : 'btn-ghost'}`} onClick={a.ir}><i className={`bi ${a.icon}`} /> {a.label}</button>
                ))}
                <a href={CATALOGO_URL} target="_blank" rel="noopener" className="btn btn-ghost"><i className="bi bi-box-arrow-up-right" /> Ver el sitio publicado</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
