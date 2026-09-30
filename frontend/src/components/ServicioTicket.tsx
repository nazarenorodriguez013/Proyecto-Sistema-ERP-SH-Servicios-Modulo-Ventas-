import { MEDIO_CUENTA_CORRIENTE } from '../config'
import type { Servicio } from '../servicios'

type Modo = 'presupuesto' | 'retiro' | 'comprobante'

const fmt = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtFecha = (d: string) => new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
const fmtFechaCalendario = (d: string) => new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })

const TITULO: Record<Modo, string> = {
  presupuesto: 'PRESUPUESTO DE SERVICIO', retiro: 'RETIRO DE REPUESTOS', comprobante: 'SERVICIO TÉCNICO',
}

// Ticket compartido para servicios técnicos: presupuesto (cotización), retiro (hoja para el depósito) y comprobante final
export default function ServicioTicket({ modo, servicio, onClose }: { modo: Modo; servicio: Servicio; onClose: () => void }) {
  const subtotalRepuestos = servicio.repuestos.reduce((sum, r) => sum + r.cantidad * r.precioUnitario, 0)
  const total = servicio.total ?? (servicio.enGarantia ? 0 : servicio.costoManoObra + subtotalRepuestos)
  const aPagar = total - servicio.saldoAplicado

  return (
    <div style={s.overlay}>
      <div style={s.modal}>
        <div id="ticket" style={s.ticket}>
          <img src="/logosh.png" alt="" style={s.watermark} />
          <div style={s.header}>
            <h1 style={s.empresa}>SH Servicios</h1>
            <p style={s.sub}>Insumos y Soluciones Técnicas</p>
            <p style={s.tipo}>{TITULO[modo]}</p>
          </div>

          {modo === 'retiro' && servicio.codigoRetiro && (
            <div style={s.codigoBox}><span style={s.codigoLabel}>CÓDIGO</span><span style={s.codigoValor}>{servicio.codigoRetiro}</span></div>
          )}

          <div style={s.row}><span>N° Servicio</span><strong>{servicio.id ? `#${String(servicio.id).padStart(6, '0')}` : 'S/N'}</strong></div>
          <div style={s.row}><span>Fecha</span><strong>{fmtFecha(servicio.fechaIngreso)}</strong></div>
          <div style={s.row}><span>Cliente</span><strong>{servicio.cliente.nombre}</strong></div>
          <div style={s.row}><span>Equipo</span><strong>{servicio.equipo}</strong></div>
          <div style={s.row}><span>Técnico</span><strong>{servicio.tecnico?.nombre ?? 'Sin asignar'}</strong></div>
          {servicio.fechaEstimadaFin && <div style={s.row}><span>Fin estimado</span><strong>{fmtFechaCalendario(servicio.fechaEstimadaFin)}</strong></div>}

          <p style={s.sep}>- - - - - - - - - - - - - - - - - - - - - - -</p>
          <p style={s.falla}><strong>Falla:</strong> {servicio.descripcionFalla}</p>
          {servicio.tareas && <p style={s.falla}><strong>Tareas a realizar:</strong> {servicio.tareas}</p>}

          {servicio.repuestos.length > 0 && (
            <>
              <p style={s.sep}>- - - - - - - - - - - - - - - - - - - - - - -</p>
              <p style={s.seccion}>Repuestos</p>
              {servicio.repuestos.map(r => (
                <div key={r.id} style={s.row}><span>{r.cantidad} × {r.producto.nombre}</span>{modo !== 'retiro' && <span>${fmt(r.cantidad * r.precioUnitario)}</span>}</div>
              ))}
            </>
          )}

          {modo !== 'retiro' && (
            <>
              <p style={s.sep}>━━━━━━━━━━━━━━━━━━━━━━━━</p>
              <div style={s.row}><span>Mano de obra</span><span>${fmt(servicio.costoManoObra)}</span></div>
              <div style={s.total}><span>TOTAL</span><span>${fmt(total)}{servicio.enGarantia && ' (garantía)'}</span></div>
              {servicio.saldoAplicado > 0 && (
                <>
                  <div style={s.row}><span>Saldo a favor aplicado</span><span>-${fmt(servicio.saldoAplicado)}</span></div>
                  <div style={s.total}><span>{servicio.medioPago === MEDIO_CUENTA_CORRIENTE ? 'A CTA. CTE.' : 'A PAGAR'}</span><span>${fmt(aPagar)}</span></div>
                </>
              )}
            </>
          )}

          {modo === 'comprobante' && servicio.medioPago && (
            <div style={s.row}><span>Medio de pago</span><strong>{servicio.medioPago}</strong></div>
          )}
          {modo === 'comprobante' && servicio.proximoMantenimiento && (
            <div style={s.row}><span>Próximo mantenimiento</span><strong>{fmtFechaCalendario(servicio.proximoMantenimiento)}</strong></div>
          )}
          {modo === 'presupuesto' && <p style={s.nota}>Presupuesto sin cargo, sujeto a disponibilidad de repuestos</p>}
        </div>

        <div style={s.acciones}>
          <button style={s.btnImprimir} onClick={() => window.print()}><i className="bi bi-printer" /> Imprimir</button>
          <button style={s.btnCerrar} onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  overlay:     { position: 'fixed', inset: 0, background: 'rgba(17,17,17,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal:       { background: '#fff', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '90vh', overflowY: 'auto' },
  ticket:      { position: 'relative', background: '#fff', width: '320px', fontFamily: '"Courier New", monospace', color: '#1A1A1A', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px', padding: '8px 0' },
  watermark:   { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '70%', opacity: 0.06, pointerEvents: 'none' as const, zIndex: 0 },
  header:      { textAlign: 'center', marginBottom: '8px', position: 'relative', zIndex: 1 },
  empresa:     { fontSize: '18px', fontWeight: '900', margin: 0 },
  sub:         { fontSize: '11px', color: '#3A3A3A', margin: '2px 0 8px' },
  tipo:        { fontWeight: '700', fontSize: '12px', letterSpacing: '1px', margin: 0 },
  codigoBox:   { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', background: '#FFFDF3', border: '1px solid #F5C400', borderRadius: '8px', padding: '8px', margin: '4px 0 8px', position: 'relative', zIndex: 1 },
  codigoLabel: { fontSize: '10px', color: '#8A6D00', fontWeight: '700', letterSpacing: '1px' },
  codigoValor: { fontSize: '20px', fontWeight: '900', color: '#111111' },
  row:         { display: 'flex', justifyContent: 'space-between', gap: '8px', position: 'relative', zIndex: 1 },
  sep:         { color: '#9A9A9A', fontSize: '11px', textAlign: 'center', margin: '4px 0', position: 'relative', zIndex: 1 },
  seccion:     { fontWeight: '700', fontSize: '11px', margin: '0 0 2px', position: 'relative', zIndex: 1 },
  falla:       { fontStyle: 'italic', margin: '0 0 4px', position: 'relative', zIndex: 1 },
  total:       { display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: '900', position: 'relative', zIndex: 1 },
  nota:        { textAlign: 'center', fontSize: '11px', margin: '4px 0 0', position: 'relative', zIndex: 1 },

  acciones:    { display: 'flex', gap: '10px' },
  btnImprimir: { flex: 1, padding: '12px', background: '#111111', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' },
  btnCerrar:   { flex: 1, padding: '12px', background: '#F5C400', color: '#111111', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '800', cursor: 'pointer' },
}
