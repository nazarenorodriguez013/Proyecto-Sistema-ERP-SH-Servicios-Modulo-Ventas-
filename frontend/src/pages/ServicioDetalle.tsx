import { useState, useEffect } from 'react'
import type { User } from '../types'
import { API, MEDIOS_PAGO, MEDIO_CUENTA_CORRIENTE } from '../config'
import { socket } from '../socket'
import { ESTADO_LABEL, ESTADO_COLOR, type Servicio } from '../servicios'

interface Producto { id: number; codigo: string | null; nombre: string; precio: number; stock: number; activo: boolean }
interface Tecnico { id: number; nombre: string }

const fmt = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtFecha = (d: string) => new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
// La fecha de próximo mantenimiento es de calendario (sin hora): se muestra en UTC para que no cambie de día
const fmtFechaCalendario = (d: string) => new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })

export default function ServicioDetalle({ servicioId, user, onBack }: { servicioId: number; user: User; onBack: () => void }) {
  const [servicio, setServicio] = useState<Servicio | null>(null)
  const [productos, setProductos] = useState<Producto[]>([])
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([])
  const [tecnicoId, setTecnicoId] = useState('')
  const [repuestoId, setRepuestoId] = useState('')
  const [cantidad, setCantidad] = useState('1')
  const [medioPago, setMedioPago] = useState('Efectivo')
  const [saldoCliente, setSaldoCliente] = useState(0)
  const [usarSaldo, setUsarSaldo] = useState(true)
  const [proximoMantenimiento, setProximoMantenimiento] = useState('')
  const [verRecibo, setVerRecibo] = useState(false)
  const [error, setError] = useState('')

  const token = localStorage.getItem('token') ?? ''
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
  const esAdministracion = user.rol === 'ADMIN' || user.rol === 'VENDEDOR'
  const esTaller = user.rol === 'ADMIN' || user.rol === 'TECNICO'

  const fetchServicio = () =>
    fetch(`${API}/repairs/${servicioId}`, { headers }).then(r => r.json()).then(setServicio)
  const fetchProductos = () =>
    fetch(`${API}/products`, { headers }).then(r => r.json()).then(setProductos)

  useEffect(() => {
    fetchServicio()
    if (esTaller) fetchProductos()
    if (esAdministracion) fetch(`${API}/technicians`, { headers }).then(r => r.json()).then(setTecnicos)
    // Si otra terminal cambia el servicio o el stock, se ve al instante
    socket.on('servicios-actualizados', fetchServicio)
    socket.on('stock-actualizado', fetchProductos)
    return () => {
      socket.off('servicios-actualizados', fetchServicio)
      socket.off('stock-actualizado', fetchProductos)
    }
  }, [servicioId])

  // Para cobrar hace falta saber si el cliente tiene saldo a favor
  const clienteId = servicio?.cliente.id
  const listoParaEntregar = esAdministracion && servicio?.estado === 'REPARADO'
  useEffect(() => {
    if (listoParaEntregar) fetch(`${API}/clients/${clienteId}`, { headers }).then(r => r.json()).then(c => setSaldoCliente(c.saldo))
  }, [listoParaEntregar, clienteId])

  // Todas las acciones siguen el mismo patrón: llamar a la API y mostrar el error si falla
  const accion = async (method: string, path: string, body?: object) => {
    setError('')
    const res = await fetch(`${API}/repairs/${servicioId}${path}`, { method, headers, body: body && JSON.stringify(body) })
    if (!res.ok) {
      const data = await res.json()
      setError(data.message || 'No se pudo completar la acción')
      return false
    }
    fetchServicio()
    return true
  }

  const agregarRepuesto = async (e: React.FormEvent) => {
    e.preventDefault()
    if (await accion('POST', '/repuestos', { productoId: Number(repuestoId), cantidad: Number(cantidad) })) {
      setRepuestoId(''); setCantidad('1')
    }
  }

  const entregar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (await accion('PUT', '/entregar', { medioPago, usarSaldo, proximoMantenimiento: proximoMantenimiento || null })) setVerRecibo(true)
  }

  if (!servicio) return <div style={s.loading}>Cargando servicio...</div>

  const subtotalRepuestos = servicio.repuestos.reduce((sum, r) => sum + r.cantidad * r.precioUnitario, 0)
  const total = servicio.total ?? (servicio.enGarantia ? 0 : servicio.costoManoObra + subtotalRepuestos)
  // Antes de entregar se calcula con el saldo actual del cliente; ya entregado, se usa lo que quedó registrado
  const saldoAFavor = Math.max(0, -saldoCliente)
  const saldoAplicado = servicio.estado === 'ENTREGADO'
    ? servicio.saldoAplicado
    : saldoAFavor && (medioPago === MEDIO_CUENTA_CORRIENTE || usarSaldo) ? Math.min(saldoAFavor, total) : 0
  const editaRepuestos = esTaller && servicio.estado === 'EN_REPARACION'

  return (
    <div className="page-container">
      <div style={s.header}>
        <button style={s.btnVolver} onClick={onBack}><i className="bi bi-arrow-left" /> Volver</button>
        <span style={{ ...s.badge, ...ESTADO_COLOR[servicio.estado] }}>{ESTADO_LABEL[servicio.estado]}</span>
      </div>

      {error && <div style={s.errorBanner}><i className="bi bi-exclamation-triangle-fill" /> {error}</div>}

      <div style={s.card}>
        <div style={s.titleRow}>
          <h2 style={s.title}>#{servicio.id} · {servicio.equipo}</h2>
          {servicio.enGarantia && <span style={s.garantia}>En garantía</span>}
        </div>
        <p style={s.falla}>{servicio.descripcionFalla}</p>
        {servicio.repuestosSolicitados && (
          <p style={s.texto}><strong>Repuestos necesarios:</strong> {servicio.repuestosSolicitados}</p>
        )}
        <div style={s.datosGrid}>
          <span style={s.dato}><i className="bi bi-person" /> {servicio.cliente.nombre}</span>
          <span style={s.dato}><i className="bi bi-calendar3" /> Ingreso {fmtFecha(servicio.fechaIngreso)}</span>
          <span style={s.dato}><i className="bi bi-wrench" /> {servicio.tecnico?.nombre ?? 'Sin técnico asignado'}</span>
        </div>
      </div>

      {esAdministracion && servicio.estado === 'PRESUPUESTADO' && (
        <div style={s.card}>
          <p style={s.sectionTitle}>Presupuesto</p>
          <p style={s.texto}>Mano de obra presupuestada: <strong>${fmt(servicio.costoManoObra)}</strong> (los repuestos se suman al cargarlos). ¿El cliente acepta?</p>
          <div style={s.acciones}>
            <button style={s.btnPrimary} onClick={() => accion('PUT', '/presupuesto', { aceptado: true })}>Cliente aceptó</button>
            <button style={s.btnDanger} onClick={() => accion('PUT', '/presupuesto', { aceptado: false })}>Cliente rechazó</button>
          </div>
        </div>
      )}

      {esAdministracion && (servicio.estado === 'PENDIENTE' || servicio.estado === 'EN_REPARACION') && (
        <div style={s.card}>
          <p style={s.sectionTitle}>{servicio.tecnico ? 'Reasignar técnico' : 'Asignar técnico'}</p>
          <div style={s.acciones}>
            <select style={s.input} value={tecnicoId} onChange={e => setTecnicoId(e.target.value)}>
              <option value="">Seleccionar técnico...</option>
              {tecnicos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
            <button style={s.btnPrimary} disabled={!tecnicoId}
              onClick={() => accion('PUT', '/tecnico', { tecnicoId: Number(tecnicoId) }).then(ok => ok && setTecnicoId(''))}>
              Asignar
            </button>
          </div>
        </div>
      )}

      <div style={s.card}>
        <p style={s.sectionTitle}>Repuestos utilizados</p>
        {editaRepuestos && (
          <form onSubmit={agregarRepuesto} style={s.acciones}>
            <select style={{ ...s.input, flex: 1 }} value={repuestoId} onChange={e => setRepuestoId(e.target.value)} required>
              <option value="">Seleccionar repuesto del depósito...</option>
              {productos.filter(p => p.activo && p.stock > 0).map(p => (
                <option key={p.id} value={p.id}>{p.codigo ? `${p.codigo} · ` : ''}{p.nombre} (stock {p.stock}) · ${fmt(p.precio)}</option>
              ))}
            </select>
            <input style={{ ...s.input, width: '80px' }} type="number" min="1" value={cantidad} onChange={e => setCantidad(e.target.value)} required />
            <button type="submit" style={s.btnPrimary}>Agregar</button>
          </form>
        )}
        {servicio.repuestos.length === 0
          ? <div style={s.empty}>Sin repuestos cargados</div>
          : servicio.repuestos.map(r => (
            <div key={r.id} style={s.repRow}>
              <span style={s.repNombre}>{r.cantidad} × {r.producto.nombre}</span>
              <span style={s.repPrecio}>${fmt(r.precioUnitario)} c/u</span>
              <span style={s.repSubtotal}>${fmt(r.cantidad * r.precioUnitario)}</span>
              {editaRepuestos && (
                <button style={s.btnX} title="Devolver al depósito" onClick={() => accion('DELETE', `/repuestos/${r.producto.id}`)}>
                  <i className="bi bi-x-lg" />
                </button>
              )}
            </div>
          ))
        }
        <div style={s.totales}>
          <span>Mano de obra: ${fmt(servicio.costoManoObra)}</span>
          <span>Repuestos: ${fmt(subtotalRepuestos)}</span>
          <span style={s.total}>Total: ${fmt(total)}{servicio.enGarantia && ' (cubierto por garantía)'}</span>
        </div>
        {editaRepuestos && (
          <button style={s.btnConfirmar} onClick={() => accion('PUT', '/reparado')}>
            <i className="bi bi-check-lg" /> Reparación terminada
          </button>
        )}
      </div>

      {esAdministracion && servicio.estado === 'REPARADO' && (
        <form style={s.card} onSubmit={entregar}>
          <p style={s.sectionTitle}>Entrega y cobro</p>
          <div style={s.medios}>
            {MEDIOS_PAGO.map(m => (
              <button type="button" key={m} style={{ ...s.medioBtn, ...(medioPago === m ? s.medioBtnOn : {}) }} onClick={() => setMedioPago(m)}>{m}</button>
            ))}
          </div>
          <label style={s.label}>
            Próximo mantenimiento (opcional)
            <input style={{ ...s.input, width: '180px' }} type="date" value={proximoMantenimiento} onChange={e => setProximoMantenimiento(e.target.value)} />
          </label>
          {saldoAFavor > 0 && total > 0 && (medioPago === MEDIO_CUENTA_CORRIENTE
            ? <span style={s.saldoNota}>A cuenta corriente se descuenta primero su saldo a favor de ${fmt(saldoAFavor)}</span>
            : (
              <label style={s.saldoCheck}>
                <input type="checkbox" checked={usarSaldo} onChange={e => setUsarSaldo(e.target.checked)} />
                Usar saldo a favor (${fmt(saldoAFavor)})
              </label>
            ))}
          {saldoAplicado > 0 && (
            <div style={s.totales}>
              <span>Total: ${fmt(total)}</span>
              <span style={s.saldoNota}>Saldo a favor: −${fmt(saldoAplicado)}</span>
            </div>
          )}
          <button type="submit" style={s.btnConfirmar}>
            <i className="bi bi-cash-coin" /> Entregar y {medioPago === MEDIO_CUENTA_CORRIENTE ? 'cargar a cuenta corriente' : 'cobrar'} ${fmt(total - saldoAplicado)}
          </button>
        </form>
      )}

      {servicio.estado === 'ENTREGADO' && (
        <div style={s.card}>
          <p style={s.texto}>
            Entregado el {fmtFecha(servicio.entregadoEn!)} · {servicio.medioPago}
            {servicio.proximoMantenimiento && ` · Próximo mantenimiento: ${fmtFechaCalendario(servicio.proximoMantenimiento)}`}
          </p>
          <button style={s.btnSecondary} onClick={() => setVerRecibo(true)}><i className="bi bi-printer" /> Ver recibo</button>
        </div>
      )}

      {verRecibo && servicio.estado === 'ENTREGADO' && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <div id="ticket" style={s.ticket}>
              <div style={s.ticketHeader}>
                <h1 style={s.ticketEmpresa}>SH Servicios</h1>
                <p style={s.ticketSub}>Insumos y Soluciones Técnicas</p>
                <p style={s.ticketTipo}>RECIBO DE SERVICIO TÉCNICO</p>
              </div>
              <div style={s.ticketRow}><span>N° Servicio</span><strong>#{String(servicio.id).padStart(6, '0')}</strong></div>
              <div style={s.ticketRow}><span>Entrega</span><strong>{fmtFecha(servicio.entregadoEn!)}</strong></div>
              <div style={s.ticketRow}><span>Cliente</span><strong>{servicio.cliente.nombre}</strong></div>
              <div style={s.ticketRow}><span>Equipo</span><strong>{servicio.equipo}</strong></div>
              <div style={s.ticketRow}><span>Técnico</span><strong>{servicio.tecnico?.nombre ?? '—'}</strong></div>
              <p style={s.ticketSep}>- - - - - - - - - - - - - - - - - - - - - - -</p>
              <p style={s.ticketFalla}>{servicio.descripcionFalla}</p>
              <div style={s.ticketRow}><span>Mano de obra</span><span>${fmt(servicio.costoManoObra)}</span></div>
              {servicio.repuestos.map(r => (
                <div key={r.id} style={s.ticketRow}><span>{r.cantidad} × {r.producto.nombre}</span><span>${fmt(r.cantidad * r.precioUnitario)}</span></div>
              ))}
              <p style={s.ticketSep}>━━━━━━━━━━━━━━━━━━━━━━━━</p>
              <div style={s.ticketTotal}><span>TOTAL</span><span>${fmt(total)}</span></div>
              {saldoAplicado > 0 && (
                <>
                  <div style={s.ticketRow}><span>Saldo a favor aplicado</span><span>-${fmt(saldoAplicado)}</span></div>
                  <div style={s.ticketTotal}>
                    <span>{servicio.medioPago === MEDIO_CUENTA_CORRIENTE ? 'A CTA. CTE.' : 'A PAGAR'}</span><span>${fmt(total - saldoAplicado)}</span>
                  </div>
                </>
              )}
              {servicio.enGarantia && <p style={s.ticketNota}>Trabajo cubierto por garantía</p>}
              <div style={s.ticketRow}><span>Medio de pago</span><strong>{servicio.medioPago}</strong></div>
              {servicio.proximoMantenimiento && (
                <div style={s.ticketRow}><span>Próximo mantenimiento</span><strong>{fmtFechaCalendario(servicio.proximoMantenimiento)}</strong></div>
              )}
            </div>
            <div style={s.acciones}>
              <button style={s.btnImprimir} onClick={() => window.print()}><i className="bi bi-printer" /> Imprimir</button>
              <button style={s.btnPrimary} onClick={() => setVerRecibo(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  loading:      { color: '#6B6B6B', padding: '40px', textAlign: 'center' },
  header:       { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  btnVolver:    { background: '#FFFFFF', border: '1px solid #E2E4E8', borderRadius: '8px', color: '#333333', fontSize: '13px', padding: '8px 16px', cursor: 'pointer' },
  badge:        { padding: '5px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '700' },
  errorBanner:  { background: 'rgba(198,64,47,0.1)', border: '1px solid rgba(198,64,47,0.3)', color: '#C6402F', padding: '10px 14px', borderRadius: '8px', fontSize: '13px' },

  card:         { background: '#FFFFFF', border: '1px solid #E2E4E8', borderRadius: '12px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' },
  titleRow:     { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' as const },
  title:        { color: '#111111', fontSize: '19px', fontWeight: '700', margin: 0 },
  garantia:     { background: '#E4F5EA', color: '#1E7A45', border: '1px solid #CDEBD9', borderRadius: '20px', padding: '3px 10px', fontSize: '11px', fontWeight: '700' },
  falla:        { color: '#333333', fontSize: '14px', margin: 0, background: '#F5F5F5', borderRadius: '8px', padding: '10px 12px' },
  datosGrid:    { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' },
  dato:         { color: '#333333', fontSize: '13px' },
  sectionTitle: { color: '#6B6B6B', fontSize: '11px', fontWeight: '700', letterSpacing: '1px', textTransform: 'uppercase' as const, margin: 0 },
  texto:        { color: '#333333', fontSize: '13px', margin: 0 },
  empty:        { color: '#6B6B6B', fontSize: '13px', textAlign: 'center', padding: '12px' },
  acciones:     { display: 'flex', gap: '8px', flexWrap: 'wrap' as const, alignItems: 'center' },
  label:        { display: 'flex', flexDirection: 'column', gap: '6px', color: '#333333', fontSize: '11px', fontWeight: '600' },
  input:        { background: '#FFFFFF', border: '1px solid #D3D3D3', borderRadius: '8px', padding: '9px 12px', color: '#111111', fontSize: '13px', outline: 'none' },

  repRow:       { display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 4px', borderBottom: '1px solid #EFF1F4' },
  repNombre:    { flex: 1, color: '#111111', fontSize: '13px', fontWeight: '600' },
  repPrecio:    { color: '#6B6B6B', fontSize: '12px' },
  repSubtotal:  { color: '#111111', fontSize: '13px', fontWeight: '700', minWidth: '100px', textAlign: 'right' as const },
  btnX:         { background: 'transparent', border: 'none', color: '#6B6B6B', cursor: 'pointer', fontSize: '13px', padding: '4px 6px' },
  totales:      { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', color: '#6B6B6B', fontSize: '13px' },
  total:        { color: '#111111', fontSize: '18px', fontWeight: '800' },

  medios:       { display: 'flex', gap: '6px', flexWrap: 'wrap' as const },
  medioBtn:     { padding: '7px 16px', background: '#FFFFFF', border: '1px solid #D3D3D3', borderRadius: '8px', color: '#6B6B6B', fontSize: '13px', fontWeight: '600', cursor: 'pointer' },
  medioBtnOn:   { background: 'rgba(245,196,0,0.15)', border: '1px solid #F5C400', color: '#8A6D00' },

  btnPrimary:   { background: '#F5C400', color: '#111111', border: 'none', borderRadius: '8px', padding: '9px 18px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' },
  btnSecondary: { background: '#FFFFFF', color: '#333333', border: '1px solid #E2E4E8', borderRadius: '8px', padding: '9px 18px', fontWeight: '600', fontSize: '13px', cursor: 'pointer', alignSelf: 'flex-start' },
  btnDanger:    { background: '#C6402F', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' },
  btnConfirmar: { padding: '12px', background: '#F5C400', color: '#111111', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '800', cursor: 'pointer' },
  btnImprimir:  { background: '#111111', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' },

  overlay:      { position: 'fixed', inset: 0, background: 'rgba(17,17,17,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal:        { background: '#fff', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '90vh', overflowY: 'auto' },
  ticket:       { background: '#fff', width: '320px', fontFamily: '"Courier New", monospace', color: '#1A1A1A', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px' },
  ticketHeader: { textAlign: 'center', marginBottom: '8px' },
  ticketEmpresa:{ fontSize: '18px', fontWeight: '900', margin: 0 },
  ticketSub:    { fontSize: '11px', color: '#3A3A3A', margin: '2px 0 8px' },
  ticketTipo:   { fontWeight: '700', fontSize: '12px', letterSpacing: '1px', margin: 0 },
  ticketRow:    { display: 'flex', justifyContent: 'space-between', gap: '8px' },
  ticketSep:    { color: '#9A9A9A', fontSize: '11px', textAlign: 'center', margin: '4px 0' },
  ticketFalla:  { fontStyle: 'italic', margin: '0 0 4px' },
  saldoNota:    { color: '#1E7A45', fontSize: '12px', fontWeight: '600' },
  saldoCheck:   { display: 'flex', alignItems: 'center', gap: '8px', color: '#1E7A45', fontSize: '13px', fontWeight: '600', cursor: 'pointer' },
  ticketTotal:  { display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: '900' },
  ticketNota:   { textAlign: 'center', fontSize: '11px', margin: 0 },
}
