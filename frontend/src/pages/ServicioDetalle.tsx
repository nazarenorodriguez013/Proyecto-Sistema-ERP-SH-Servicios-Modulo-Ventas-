import { useState, useEffect } from 'react'
import type { User } from '../types'
import { API, MEDIOS_PAGO, MEDIO_CUENTA_CORRIENTE } from '../config'
import { socket } from '../socket'
import ServicioTicket from '../components/ServicioTicket'
import { ESTADO_LABEL, ESTADO_COLOR, ESTADO_RETIRO_LABEL, ESTADO_RETIRO_COLOR, type Servicio } from '../servicios'

interface Producto { id: number; codigo: string | null; nombre: string; precio: number; stock: number; activo: boolean }
interface Tecnico { id: number; nombre: string }

const fmt = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function ServicioDetalle({ servicioId, user, onBack }: { servicioId: number; user: User; onBack: () => void }) {
  const [servicio, setServicio] = useState<Servicio | null>(null)
  const [productos, setProductos] = useState<Producto[]>([])
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([])
  const [tecnicoId, setTecnicoId] = useState('')
  const [repuestoId, setRepuestoId] = useState('')
  const [cantidad, setCantidad] = useState('1')
  const [tipoComprobante, setTipoComprobante] = useState<'FACTURA' | 'REMITO'>('FACTURA')
  const [medioPago, setMedioPago] = useState('Efectivo')
  const [costoManoObra, setCostoManoObra] = useState('')
  const [saldoCliente, setSaldoCliente] = useState(0)
  const [usarSaldo, setUsarSaldo] = useState(true)
  const [proximoMantenimiento, setProximoMantenimiento] = useState('')
  const [verTicket, setVerTicket] = useState(false)
  const [error, setError] = useState('')

  const token = localStorage.getItem('token') ?? ''
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
  const esAdministracion = user.rol === 'ADMIN' || user.rol === 'VENDEDOR'
  const esTaller = user.rol === 'ADMIN' || user.rol === 'TECNICO'

  const fetchServicio = () =>
    fetch(`${API}/repairs/${servicioId}`, { headers }).then(r => r.json()).then(data => { setServicio(data); setCostoManoObra(String(data.costoManoObra)) })
  const fetchProductos = () => fetch(`${API}/products`, { headers }).then(r => r.json()).then(setProductos)

  useEffect(() => {
    fetchServicio()
    if (esTaller) fetchProductos()
    if (esAdministracion) fetch(`${API}/technicians`, { headers }).then(r => r.json()).then(setTecnicos)
    socket.on('servicios-actualizados', fetchServicio)
    socket.on('stock-actualizado', fetchProductos)
    return () => {
      socket.off('servicios-actualizados', fetchServicio)
      socket.off('stock-actualizado', fetchProductos)
    }
  }, [servicioId])

  const clienteId = servicio?.cliente.id
  useEffect(() => {
    if (esAdministracion && servicio?.estado === 'EN_CURSO' && clienteId)
      fetch(`${API}/clients/${clienteId}`, { headers }).then(r => r.json()).then(c => setSaldoCliente(c.saldo))
  }, [servicio?.estado, clienteId])

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

  const asignarTecnico = () => accion('PUT', '/tecnico', { tecnicoId: Number(tecnicoId) }).then(ok => ok && setTecnicoId(''))

  const agregarRepuesto = async (e: React.FormEvent) => {
    e.preventDefault()
    if (await accion('POST', '/repuestos', { productoId: Number(repuestoId), cantidad: Number(cantidad) })) {
      setRepuestoId(''); setCantidad('1')
    }
  }

  const finalizar = async (e: React.FormEvent) => {
    e.preventDefault()
    const ok = await accion('PUT', '/finalizar', {
      tipoComprobante, medioPago, costoManoObra: Number(costoManoObra) || 0, usarSaldo,
      proximoMantenimiento: proximoMantenimiento || null,
    })
    if (ok) setVerTicket(true)
  }

  if (!servicio) return <div style={s.loading}>Cargando servicio...</div>

  const subtotalRepuestos = servicio.repuestos.reduce((sum, r) => sum + r.cantidad * r.precioUnitario, 0)
  const totalEstimado = servicio.enGarantia ? 0 : (Number(costoManoObra) || 0) + subtotalRepuestos
  const saldoAFavor = Math.max(0, -saldoCliente)
  const saldoAplicado = servicio.estado === 'FINALIZADO'
    ? servicio.saldoAplicado
    : saldoAFavor && (medioPago === MEDIO_CUENTA_CORRIENTE || usarSaldo) ? Math.min(saldoAFavor, totalEstimado) : 0

  return (
    <div className="page-container">
      <div style={s.header}>
        <button style={s.btnVolver} onClick={onBack}><i className="bi bi-arrow-left" /> Volver</button>
        <div style={s.badges}>
          {servicio.estadoRetiro && (
            <span style={{ ...s.badge, ...ESTADO_RETIRO_COLOR[servicio.estadoRetiro] }}>
              <i className="bi bi-box-seam" /> {ESTADO_RETIRO_LABEL[servicio.estadoRetiro]} · {servicio.codigoRetiro}
            </span>
          )}
          <span style={{ ...s.badge, ...ESTADO_COLOR[servicio.estado] }}>{ESTADO_LABEL[servicio.estado]}</span>
        </div>
      </div>

      {error && <div style={s.errorBanner}><i className="bi bi-exclamation-triangle-fill" /> {error}</div>}

      <div style={s.card}>
        <div style={s.titleRow}>
          <h2 style={s.title}>#{servicio.id} · {servicio.equipo}</h2>
          {servicio.enGarantia && <span style={s.garantia}>En garantía</span>}
        </div>
        <p style={s.falla}>{servicio.descripcionFalla}</p>
        {servicio.tareas && <p style={s.texto}><strong>Tareas a realizar:</strong> {servicio.tareas}</p>}
        <div style={s.datosGrid}>
          <span style={s.dato}><i className="bi bi-person" /> {servicio.cliente.nombre}</span>
          <span style={s.dato}><i className="bi bi-calendar3" /> Ingreso {new Date(servicio.fechaIngreso).toLocaleDateString('es-AR')}</span>
          <span style={s.dato}><i className="bi bi-wrench" /> {servicio.tecnico?.nombre ?? 'Sin técnico asignado'}</span>
          {servicio.fechaEstimadaFin && <span style={s.dato}><i className="bi bi-hourglass-split" /> Fin estimado {new Date(servicio.fechaEstimadaFin).toLocaleDateString('es-AR', { timeZone: 'UTC' })}</span>}
        </div>
      </div>

      {esAdministracion && servicio.estado === 'EN_CURSO' && (
        <div style={s.card}>
          <p style={s.sectionTitle}>{servicio.tecnico ? 'Reasignar técnico' : 'Asignar técnico'}</p>
          <div style={s.acciones}>
            <select style={s.input} value={tecnicoId} onChange={e => setTecnicoId(e.target.value)}>
              <option value="">Seleccionar técnico...</option>
              {tecnicos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
            <button style={s.btnPrimary} disabled={!tecnicoId} onClick={asignarTecnico}>Asignar</button>
          </div>
        </div>
      )}

      <div style={s.card}>
        <p style={s.sectionTitle}>Repuestos utilizados</p>
        {esTaller && servicio.estado === 'EN_CURSO' && (
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
              {esTaller && servicio.estado === 'EN_CURSO' && (
                <button style={s.btnX} title="Devolver al depósito" onClick={() => accion('DELETE', `/repuestos/${r.producto.id}`)}>
                  <i className="bi bi-x-lg" />
                </button>
              )}
            </div>
          ))
        }
      </div>

      {esAdministracion && servicio.estado === 'EN_CURSO' && (
        <form style={s.card} onSubmit={finalizar}>
          <p style={s.sectionTitle}>Finalizar servicio</p>
          <div style={s.row}>
            <div style={s.field}>
              <label style={s.label}>Mano de obra final</label>
              <input style={s.input} type="number" min="0" step="0.01" value={costoManoObra} disabled={servicio.enGarantia}
                onChange={e => setCostoManoObra(e.target.value)} />
            </div>
            <div style={s.field}>
              <label style={s.label}>Próximo mantenimiento (opcional)</label>
              <input style={s.input} type="date" value={proximoMantenimiento} onChange={e => setProximoMantenimiento(e.target.value)} />
            </div>
          </div>
          <div style={s.field}>
            <label style={s.label}>Tipo de comprobante</label>
            <div style={s.tipos}>
              {(['FACTURA', 'REMITO'] as const).map(t => (
                <button type="button" key={t} style={{ ...s.tipoBtn, ...(tipoComprobante === t ? s.tipoBtnOn : {}) }} onClick={() => setTipoComprobante(t)}>
                  {t === 'FACTURA' ? 'Factura' : 'Remito'}
                </button>
              ))}
            </div>
          </div>
          <div style={s.field}>
            <label style={s.label}>Medio de pago</label>
            <div style={s.medios}>
              {MEDIOS_PAGO.map(m => (
                <button type="button" key={m} style={{ ...s.medioBtn, ...(medioPago === m ? s.medioBtnOn : {}) }} onClick={() => setMedioPago(m)}>{m}</button>
              ))}
            </div>
          </div>
          {saldoAFavor > 0 && totalEstimado > 0 && (medioPago === MEDIO_CUENTA_CORRIENTE
            ? <span style={s.saldoNota}>A cuenta corriente se descuenta primero su saldo a favor de ${fmt(saldoAFavor)}</span>
            : (
              <label style={s.saldoCheck}>
                <input type="checkbox" checked={usarSaldo} onChange={e => setUsarSaldo(e.target.checked)} />
                Usar saldo a favor (${fmt(saldoAFavor)})
              </label>
            ))}
          <div style={s.totales}>
            <span>Mano de obra: ${fmt(Number(costoManoObra) || 0)}</span>
            <span>Repuestos: ${fmt(subtotalRepuestos)}</span>
            <span style={s.total}>Total: ${fmt(totalEstimado)}{servicio.enGarantia && ' (cubierto por garantía)'}</span>
            {saldoAplicado > 0 && <span style={s.saldoNota}>Saldo a favor: −${fmt(saldoAplicado)}</span>}
          </div>
          <button type="submit" style={s.btnConfirmar}>
            <i className="bi bi-cash-coin" /> Finalizar y {medioPago === MEDIO_CUENTA_CORRIENTE ? 'cargar a cuenta corriente' : 'cobrar'} ${fmt(totalEstimado - saldoAplicado)}
          </button>
        </form>
      )}

      {servicio.estado === 'FINALIZADO' && (
        <div style={s.card}>
          <p style={s.texto}>
            Finalizado el {servicio.finalizadoEn && new Date(servicio.finalizadoEn).toLocaleDateString('es-AR')} · {servicio.tipoComprobante} · {servicio.medioPago}
          </p>
          <button style={s.btnSecondary} onClick={() => setVerTicket(true)}><i className="bi bi-printer" /> Ver comprobante</button>
        </div>
      )}

      {verTicket && <ServicioTicket modo="comprobante" servicio={servicio} onClose={() => setVerTicket(false)} />}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  loading:      { color: '#6B6B6B', padding: '40px', textAlign: 'center' },
  header:       { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' as const, gap: '8px' },
  btnVolver:    { background: '#FFFFFF', border: '1px solid #E2E4E8', borderRadius: '8px', color: '#333333', fontSize: '13px', padding: '8px 16px', cursor: 'pointer' },
  badges:       { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' as const },
  badge:        { padding: '5px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '6px' },
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
  row:          { display: 'flex', gap: '12px', flexWrap: 'wrap' as const },
  field:        { display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: '180px' },
  label:        { display: 'block', color: '#333333', fontSize: '11px', fontWeight: '600', marginBottom: '2px' },
  input:        { background: '#FFFFFF', border: '1px solid #D3D3D3', borderRadius: '8px', padding: '9px 12px', color: '#111111', fontSize: '13px', outline: 'none', width: '100%', boxSizing: 'border-box' as const },

  repRow:       { display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 4px', borderBottom: '1px solid #EFF1F4' },
  repNombre:    { flex: 1, color: '#111111', fontSize: '13px', fontWeight: '600' },
  repPrecio:    { color: '#6B6B6B', fontSize: '12px' },
  repSubtotal:  { color: '#111111', fontSize: '13px', fontWeight: '700', minWidth: '100px', textAlign: 'right' as const },
  btnX:         { background: 'transparent', border: 'none', color: '#6B6B6B', cursor: 'pointer', fontSize: '13px', padding: '4px 6px' },
  totales:      { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', color: '#6B6B6B', fontSize: '13px' },
  total:        { color: '#111111', fontSize: '18px', fontWeight: '800' },

  tipos:        { display: 'flex', gap: '6px' },
  tipoBtn:      { padding: '7px 16px', background: '#FFFFFF', border: '1px solid #D3D3D3', borderRadius: '8px', color: '#6B6B6B', fontSize: '13px', fontWeight: '600', cursor: 'pointer' },
  tipoBtnOn:    { background: 'rgba(245,196,0,0.15)', border: '1px solid #F5C400', color: '#8A6D00' },
  medios:       { display: 'flex', gap: '6px', flexWrap: 'wrap' as const },
  medioBtn:     { padding: '7px 16px', background: '#FFFFFF', border: '1px solid #D3D3D3', borderRadius: '8px', color: '#6B6B6B', fontSize: '13px', fontWeight: '600', cursor: 'pointer' },
  medioBtnOn:   { background: 'rgba(245,196,0,0.15)', border: '1px solid #F5C400', color: '#8A6D00' },
  saldoNota:    { color: '#1E7A45', fontSize: '12px', fontWeight: '600' },
  saldoCheck:   { display: 'flex', alignItems: 'center', gap: '8px', color: '#1E7A45', fontSize: '13px', fontWeight: '600', cursor: 'pointer' },

  btnPrimary:   { background: '#F5C400', color: '#111111', border: 'none', borderRadius: '8px', padding: '9px 18px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' },
  btnSecondary: { background: '#FFFFFF', color: '#333333', border: '1px solid #E2E4E8', borderRadius: '8px', padding: '9px 18px', fontWeight: '600', fontSize: '13px', cursor: 'pointer', alignSelf: 'flex-start' },
  btnConfirmar: { padding: '12px', background: '#F5C400', color: '#111111', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '800', cursor: 'pointer' },
}
