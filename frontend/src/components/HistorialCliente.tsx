import { useState } from 'react'
import { useFormatComprobante } from '../empresa'
import type { Servicio } from '../servicios'
import Comprobante, { type ComprobanteData, type ClienteComprobante } from './Comprobante'
import ServicioTicket from './ServicioTicket'

export interface VentaCliente {
  id: number; numero: number; tipoComprobante: 'FACTURA' | 'REMITO'; total: number; medioPago: string
  montoRecibido: number | null; saldoAplicado: number; saldoCliente?: number | null; creadoEn: string; usuario: { nombre: string }
  detallesVenta: { id: number; cantidad: number; precioUnitario: number; producto: { nombre: string; codigo: string | null } }[]
}
export type ServicioCliente = Omit<Servicio, 'cliente'>
export interface MovimientoCliente {
  id: number; tipo: 'VENTA' | 'SERVICIO' | 'PAGO'; concepto: string; monto: number; creadoEn: string
  ventaId: number | null; servicioId: number | null
}
interface Ficha extends ClienteComprobante { id: number; ventas: VentaCliente[]; servicios: ServicioCliente[]; movimientos: MovimientoCliente[] }

type Evento =
  | { kind: 'compra'; clave: string; fecha: string; venta: VentaCliente }
  | { kind: 'servicio'; clave: string; fecha: string; servicio: ServicioCliente }
  | { kind: 'pago'; clave: string; fecha: string; movimiento: MovimientoCliente }

const fmt = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtFecha = (d: string) => new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
const fmtFechaHora = (d: string) => new Date(d).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
const fmtCalendario = (d: string) => new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })

// Un único historial cronológico del cliente: compras, servicios técnicos y pagos. Cada fila se abre para ver el detalle
// completo y volver a ver el comprobante. Los cargos que compras y servicios dejan en la cuenta corriente no se repiten.
export default function HistorialCliente({ cliente, esAdmin, onBorrarVenta, onBorrarServicio, onBorrarMovimiento }: {
  cliente: Ficha; esAdmin: boolean
  onBorrarVenta: (id: number) => void; onBorrarServicio: (id: number) => void; onBorrarMovimiento: (id: number) => void
}) {
  const formatComprobante = useFormatComprobante()
  const [abierto, setAbierto] = useState<string | null>(null)
  const [verVenta, setVerVenta] = useState<ComprobanteData | null>(null)
  const [verServicio, setVerServicio] = useState<Servicio | null>(null)

  const eventos: Evento[] = [
    ...cliente.ventas.map(venta => ({ kind: 'compra' as const, clave: `venta-${venta.id}`, fecha: venta.creadoEn, venta })),
    ...cliente.servicios.map(servicio => ({ kind: 'servicio' as const, clave: `servicio-${servicio.id}`, fecha: servicio.finalizadoEn ?? servicio.fechaIngreso, servicio })),
    ...cliente.movimientos.filter(m => m.tipo === 'PAGO' || (!m.ventaId && !m.servicioId))
      .map(movimiento => ({ kind: 'pago' as const, clave: `mov-${movimiento.id}`, fecha: movimiento.creadoEn, movimiento })),
  ].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())

  const datosCliente: ClienteComprobante = {
    nombre: cliente.nombre, documento: cliente.documento, direccion: cliente.direccion, telefono: cliente.telefono,
    email: cliente.email, condicionIva: cliente.condicionIva,
  }

  const abrirComprobanteVenta = (v: VentaCliente) => setVerVenta({
    id: v.id, numero: v.numero, fecha: new Date(v.creadoEn), tipoComprobante: v.tipoComprobante, items: v.detallesVenta,
    total: v.total, saldoAplicado: v.saldoAplicado, saldoCliente: v.saldoCliente, medioPago: v.medioPago, montoRecibido: v.montoRecibido,
    vendedor: v.usuario.nombre, cliente: datosCliente,
  })

  const fila = (ev: Evento) => {
    if (ev.kind === 'compra') {
      const v = ev.venta
      return {
        tag: v.tipoComprobante === 'REMITO' ? 'Remito' : 'Factura', titulo: `N° ${formatComprobante(v.numero)}`,
        sub: `${v.detallesVenta.length} ${v.detallesVenta.length === 1 ? 'producto' : 'productos'} · ${v.medioPago}`,
        importe: `$${fmt(v.total)}`, color: '#111111', borrar: () => onBorrarVenta(v.id), tituloBorrar: 'Eliminar comprobante',
      }
    }
    if (ev.kind === 'servicio') {
      const sv = ev.servicio
      return {
        tag: 'Servicio técnico', titulo: sv.estado === 'FINALIZADO' && sv.numero ? `${sv.tipoComprobante === 'REMITO' ? 'Remito' : 'Factura'} N° ${formatComprobante(sv.numero)}` : `#${String(sv.id).padStart(6, '0')}`,
        sub: sv.equipo, importe: sv.estado === 'FINALIZADO' ? `$${fmt(sv.total ?? 0)}` : 'En curso', color: sv.estado === 'FINALIZADO' ? '#111111' : '#8A6D00',
        borrar: () => onBorrarServicio(sv.id!), tituloBorrar: 'Eliminar servicio técnico',
      }
    }
    const m = ev.movimiento
    return {
      tag: 'Pago', titulo: m.concepto, sub: '', importe: `-$${fmt(m.monto)}`, color: '#2E9E5B',
      borrar: !m.ventaId && !m.servicioId ? () => onBorrarMovimiento(m.id) : null, tituloBorrar: 'Eliminar movimiento',
    }
  }

  const detalle = (ev: Evento) => {
    if (ev.kind === 'compra') {
      const v = ev.venta
      return (
        <>
          <div style={s.datos}>
            <Dato k="Fecha" v={fmtFechaHora(v.creadoEn)} /><Dato k="Vendedor" v={v.usuario.nombre} /><Dato k="Medio de pago" v={v.medioPago} />
            {v.montoRecibido !== null && <Dato k="Monto recibido" v={`$${fmt(v.montoRecibido)}`} />}
            {v.saldoAplicado > 0 && <Dato k="Saldo a favor aplicado" v={`-$${fmt(v.saldoAplicado)}`} />}
          </div>
          <Tabla filas={v.detallesVenta.map(d => ({ c: d.producto.codigo ?? '—', n: d.producto.nombre, q: d.cantidad, u: d.precioUnitario }))} total={v.total} />
          <button style={s.btnVer} onClick={() => abrirComprobanteVenta(v)}><i className="bi bi-printer" /> Ver comprobante</button>
        </>
      )
    }
    if (ev.kind === 'servicio') {
      const sv = ev.servicio
      const finalizado = sv.estado === 'FINALIZADO'
      const filas = [
        ...sv.repuestos.map(r => ({ c: r.producto.codigo ?? '—', n: r.producto.nombre, q: r.cantidad, u: r.precioUnitario })),
        { c: '—', n: 'Mano de obra', q: 1, u: sv.costoManoObra },
      ]
      return (
        <>
          <div style={s.datos}>
            <Dato k="Equipo" v={sv.equipo} /><Dato k="Técnico" v={sv.tecnico?.nombre ?? 'Sin asignar'} />
            <Dato k="Ingreso" v={fmtFecha(sv.fechaIngreso)} />
            {sv.fechaEstimadaFin && !finalizado && <Dato k="Fin estimado" v={fmtCalendario(sv.fechaEstimadaFin)} />}
            {finalizado && sv.finalizadoEn && <Dato k="Finalizado" v={fmtFechaHora(sv.finalizadoEn)} />}
            {finalizado && sv.medioPago && <Dato k="Medio de pago" v={sv.medioPago} />}
            {sv.enGarantia && <Dato k="Garantía" v="Sin costo para el cliente" />}
          </div>
          <Texto k="Falla" v={sv.descripcionFalla} /><Texto k="Tareas a realizar" v={sv.tareas} />
          <Texto k="Diagnóstico" v={sv.diagnostico} /><Texto k="Trabajo realizado" v={sv.trabajoRealizado} />
          <Tabla filas={filas} total={sv.total ?? (sv.enGarantia ? 0 : filas.reduce((t, f) => t + f.q * f.u, 0))} etiqueta={finalizado ? 'Total' : 'Total estimado'} />
          {finalizado && <button style={s.btnVer} onClick={() => setVerServicio({ ...sv, cliente: { id: cliente.id, ...datosCliente } } as Servicio)}><i className="bi bi-printer" /> Ver comprobante</button>}
        </>
      )
    }
    const m = ev.movimiento
    return <div style={s.datos}><Dato k="Fecha" v={fmtFechaHora(m.creadoEn)} /><Dato k="Importe" v={`$${fmt(m.monto)}`} /><Dato k="Concepto" v={m.concepto} /></div>
  }

  return (
    <>
      {eventos.length === 0
        ? <div style={s.vacio}>Todavía no hay compras, pagos ni servicios registrados</div>
        : eventos.map(ev => {
          const f = fila(ev)
          const abiertoAhora = abierto === ev.clave
          return (
            <div key={ev.clave} style={s.fila}>
              <div style={s.cabecera} onClick={() => setAbierto(abiertoAhora ? null : ev.clave)}>
                <i className={`bi bi-chevron-${abiertoAhora ? 'down' : 'right'}`} style={s.chevron} />
                <span style={s.tag}>{f.tag}</span>
                <span style={s.titulo}>{f.titulo}{f.sub && <span style={s.sub}> · {f.sub}</span>}</span>
                <span style={s.fecha}>{fmtFecha(ev.fecha)}</span>
                <span style={{ ...s.importe, color: f.color }}>{f.importe}</span>
                {esAdmin && f.borrar && (
                  <button style={s.btnBorrar} title={f.tituloBorrar} onClick={e => { e.stopPropagation(); f.borrar!() }}><i className="bi bi-trash" /></button>
                )}
              </div>
              {abiertoAhora && <div style={s.detalle}>{detalle(ev)}</div>}
            </div>
          )
        })}

      {verVenta && <Comprobante data={verVenta} onClose={() => setVerVenta(null)} />}
      {verServicio && <ServicioTicket modo="comprobante" servicio={verServicio} onClose={() => setVerServicio(null)} />}
    </>
  )
}

const Dato = ({ k, v }: { k: string; v: string }) => (
  <div style={s.dato}><span style={s.datoK}>{k}</span><span style={s.datoV}>{v}</span></div>
)
const Texto = ({ k, v }: { k: string; v?: string | null }) => v ? <p style={s.texto}><strong>{k}:</strong> {v}</p> : null
const Tabla = ({ filas, total, etiqueta = 'Total' }: { filas: { c: string; n: string; q: number; u: number }[]; total: number; etiqueta?: string }) => (
  <table style={s.tabla}>
    <thead><tr>
      <th style={s.th}>Código</th><th style={s.th}>Detalle</th><th style={{ ...s.th, textAlign: 'center' }}>Cant.</th>
      <th style={{ ...s.th, textAlign: 'right' }}>Unitario</th><th style={{ ...s.th, textAlign: 'right' }}>Subtotal</th>
    </tr></thead>
    <tbody>
      {filas.map((f, i) => (
        <tr key={i}><td style={s.td}>{f.c}</td><td style={s.td}>{f.n}</td><td style={{ ...s.td, textAlign: 'center' }}>{f.q}</td>
          <td style={{ ...s.td, textAlign: 'right' }}>${fmt(f.u)}</td><td style={{ ...s.td, textAlign: 'right', fontWeight: 700 }}>${fmt(f.q * f.u)}</td></tr>
      ))}
      <tr><td colSpan={4} style={{ ...s.td, textAlign: 'right', fontWeight: 700 }}>{etiqueta}</td><td style={{ ...s.td, textAlign: 'right', fontWeight: 800, color: '#111111' }}>${fmt(total)}</td></tr>
    </tbody>
  </table>
)

const s: Record<string, React.CSSProperties> = {
  vacio:     { color: '#6B6B6B', fontSize: '13px', textAlign: 'center', padding: '20px' },
  fila:      { borderBottom: '1px solid #EFF1F4' },
  cabecera:  { display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 4px', cursor: 'pointer', flexWrap: 'wrap' },
  chevron:   { color: '#9A9A9A', fontSize: '12px', width: '14px' },
  tag:       { color: '#8A6D00', fontSize: '11px', fontWeight: '700', background: '#FFFDF3', border: '1px solid rgba(245,196,0,0.3)', borderRadius: '20px', padding: '3px 10px', flexShrink: 0 },
  titulo:    { color: '#111111', fontSize: '13px', fontWeight: '700', flex: 1, minWidth: '140px' },
  sub:       { color: '#6B6B6B', fontWeight: '500' },
  fecha:     { color: '#6B6B6B', fontSize: '12px', flexShrink: 0 },
  importe:   { fontSize: '14px', fontWeight: '800', minWidth: '100px', textAlign: 'right' },
  btnBorrar: { background: 'rgba(198,64,47,0.08)', border: '1px solid rgba(198,64,47,0.2)', borderRadius: '7px', padding: '5px 9px', cursor: 'pointer', color: '#C6402F', fontSize: '13px', flexShrink: 0 },
  detalle:   { background: '#FAFBFC', borderRadius: '10px', padding: '12px 14px', margin: '0 4px 12px 26px', display: 'flex', flexDirection: 'column', gap: '10px' },
  datos:     { display: 'flex', flexWrap: 'wrap', gap: '8px 28px' },
  dato:      { display: 'flex', flexDirection: 'column', gap: '1px' },
  datoK:     { color: '#6B6B6B', fontSize: '10px', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase' },
  datoV:     { color: '#111111', fontSize: '13px', fontWeight: '600' },
  texto:     { color: '#333333', fontSize: '13px', margin: 0, background: '#FFFFFF', border: '1px solid #EFF1F4', borderRadius: '8px', padding: '8px 10px' },
  tabla:     { width: '100%', borderCollapse: 'collapse' },
  th:        { color: '#6B6B6B', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', textAlign: 'left', padding: '0 6px 6px', borderBottom: '1px solid #E2E4E8' },
  td:        { color: '#333333', fontSize: '12px', padding: '6px', borderBottom: '1px solid #EFF1F4' },
  btnVer:    { alignSelf: 'flex-start', background: '#FFFFFF', border: '1px solid #E2E4E8', borderRadius: '8px', padding: '8px 14px', color: '#111111', fontSize: '12px', fontWeight: '600', cursor: 'pointer' },
}
