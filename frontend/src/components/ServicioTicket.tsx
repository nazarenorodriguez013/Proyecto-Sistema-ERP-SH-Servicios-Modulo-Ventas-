import { MEDIO_CUENTA_CORRIENTE } from '../config'
import type { Servicio } from '../servicios'

type Modo = 'presupuesto' | 'retiro' | 'comprobante'

const fmt = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtFecha = (d: string) => new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
const fmtFechaCalendario = (d: string) => new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })

// Letra y código del tipo de comprobante, como en una factura C de AFIP; la hoja de retiro no es un comprobante
const letraDe = (modo: Modo, servicio: Servicio) => {
  if (modo === 'presupuesto') return { letra: 'P', cod: '000', titulo: 'PRESUPUESTO DE SERVICIO' }
  if (modo === 'retiro') return null
  return servicio.tipoComprobante === 'REMITO'
    ? { letra: 'R', cod: '009', titulo: 'REMITO DE SERVICIO' }
    : { letra: 'C', cod: '006', titulo: 'FACTURA DE SERVICIO' }
}

// Hoja completa (tamaño carta/A4) para servicios técnicos: presupuesto (cotización), retiro (hoja para el
// depósito) y comprobante final. El número es correlativo por tipo, igual que en las ventas.
export default function ServicioTicket({ modo, servicio, onClose }: { modo: Modo; servicio: Servicio; onClose: () => void }) {
  const subtotalRepuestos = servicio.repuestos.reduce((sum, r) => sum + r.cantidad * r.precioUnitario, 0)
  const total = servicio.total ?? (servicio.enGarantia ? 0 : servicio.costoManoObra + subtotalRepuestos)
  const aPagar = total - servicio.saldoAplicado
  const tipo = letraDe(modo, servicio)
  const numeroComprobante = servicio.numero ? String(servicio.numero).padStart(8, '0') : 'S/N'

  return (
    <div style={s.overlay}>
      <div style={s.modalWrap}>
        <div id="ticket" style={s.hoja}>
          <img src="/logosh.png" alt="" style={s.watermark} />

          <div style={s.encabezado}>
            <div style={s.empresaBlock}>
              <div style={s.logoBox}>SH</div>
              <div>
                <h1 style={s.empresaNombre}>SH Servicios</h1>
                <p style={s.empresaSub}>Insumos y Soluciones Técnicas</p>
              </div>
            </div>

            {tipo && (
              <div style={s.letraBox}>
                <span style={s.letraGrande}>{tipo.letra}</span>
                <span style={s.letraCod}>COD. {tipo.cod}</span>
              </div>
            )}

            <div style={s.datosComprobante}>
              <p style={s.tipoTitulo}>{tipo ? tipo.titulo : 'RETIRO DE REPUESTOS'}</p>
              {tipo
                ? <p style={s.numero}>N° {numeroComprobante}</p>
                : <p style={s.numero}>Servicio {servicio.id ? `#${String(servicio.id).padStart(6, '0')}` : 'S/N'}</p>}
              <p style={s.fechaLinea}>{fmtFecha(servicio.fechaIngreso)}</p>
            </div>
          </div>

          <div style={s.divisor} />

          {modo === 'retiro' && servicio.codigoRetiro && (
            <div style={s.codigoBox}>
              <span style={s.codigoLabel}>CÓDIGO DE RETIRO</span>
              <span style={s.codigoValor}>{servicio.codigoRetiro}</span>
            </div>
          )}

          <div style={s.metaGrid}>
            {tipo && <div style={s.metaItem}><span style={s.metaLabel}>SERVICIO</span><span style={s.metaValor}>{servicio.id ? `#${String(servicio.id).padStart(6, '0')}` : 'S/N'}</span></div>}
            <div style={s.metaItem}><span style={s.metaLabel}>CLIENTE</span><span style={s.metaValor}>{servicio.cliente.nombre}</span></div>
            <div style={s.metaItem}><span style={s.metaLabel}>EQUIPO</span><span style={s.metaValor}>{servicio.equipo}</span></div>
            <div style={s.metaItem}><span style={s.metaLabel}>TÉCNICO</span><span style={s.metaValor}>{servicio.tecnico?.nombre ?? 'Sin asignar'}</span></div>
            {servicio.fechaEstimadaFin && (
              <div style={s.metaItem}><span style={s.metaLabel}>FIN ESTIMADO</span><span style={s.metaValor}>{fmtFechaCalendario(servicio.fechaEstimadaFin)}</span></div>
            )}
          </div>

          <div style={s.textoBox}>
            <p style={s.textoLabel}>FALLA</p>
            <p style={s.texto}>{servicio.descripcionFalla}</p>
          </div>
          {servicio.tareas && (
            <div style={s.textoBox}>
              <p style={s.textoLabel}>TAREAS A REALIZAR</p>
              <p style={s.texto}>{servicio.tareas}</p>
            </div>
          )}

          {servicio.repuestos.length > 0 && (
            <table style={s.tabla}>
              <thead>
                <tr>
                  <th style={{ ...s.th, textAlign: 'left' }}>Repuesto</th>
                  <th style={{ ...s.th, textAlign: 'center', width: '70px' }}>Cant.</th>
                  {modo !== 'retiro' && <th style={{ ...s.th, textAlign: 'right', width: '110px' }}>P. Unit.</th>}
                  {modo !== 'retiro' && <th style={{ ...s.th, textAlign: 'right', width: '120px' }}>Subtotal</th>}
                </tr>
              </thead>
              <tbody>
                {servicio.repuestos.map(r => (
                  <tr key={r.id} style={s.tr}>
                    <td style={s.tdNombre}>
                      {r.producto.nombre}
                      {r.producto.codigo && <span style={s.tdCod}> · Cód: {r.producto.codigo}</span>}
                    </td>
                    <td style={{ ...s.td, textAlign: 'center' }}>{r.cantidad}</td>
                    {modo !== 'retiro' && <td style={{ ...s.td, textAlign: 'right' }}>${fmt(r.precioUnitario)}</td>}
                    {modo !== 'retiro' && <td style={{ ...s.td, textAlign: 'right', fontWeight: 700, color: '#111111' }}>${fmt(r.cantidad * r.precioUnitario)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {modo !== 'retiro' && (
            <div style={s.totalesWrap}>
              <div style={s.totalesBox}>
                <div style={s.subRow}><span>Repuestos</span><span>${fmt(subtotalRepuestos)}</span></div>
                <div style={s.subRow}><span>Mano de obra</span><span>${fmt(servicio.costoManoObra)}</span></div>
                <div style={s.totalRow}><span>TOTAL</span><span>${fmt(total)}{servicio.enGarantia && ' (garantía)'}</span></div>
                {servicio.saldoAplicado > 0 && (
                  <>
                    <div style={s.subRow}><span>Saldo a favor aplicado</span><span>-${fmt(servicio.saldoAplicado)}</span></div>
                    <div style={s.totalRow}>
                      <span>{servicio.medioPago === MEDIO_CUENTA_CORRIENTE ? 'A CTA. CTE.' : 'A PAGAR'}</span>
                      <span>${fmt(aPagar)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {modo === 'comprobante' && (servicio.medioPago || servicio.proximoMantenimiento) && (
            <div style={s.pagoBox}>
              {servicio.medioPago && <div style={s.subRow}><span>Medio de pago</span><span style={s.pagoValor}>{servicio.medioPago}</span></div>}
              {servicio.proximoMantenimiento && (
                <div style={s.subRow}><span>Próximo mantenimiento</span><span style={s.pagoValor}>{fmtFechaCalendario(servicio.proximoMantenimiento)}</span></div>
              )}
            </div>
          )}

          {modo === 'presupuesto' && <p style={s.footer}>Presupuesto sin cargo, sujeto a disponibilidad de repuestos</p>}
          {modo === 'retiro' && <p style={s.footer}>Presentar esta hoja en el área de repuestos para retirar el pedido</p>}
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
  overlay:    { position: 'fixed', inset: 0, background: 'rgba(17,17,17,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' },
  modalWrap:  { background: '#EFF1F4', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '92vh', overflowY: 'auto' },

  hoja:             { position: 'relative', display: 'flex', flexDirection: 'column', minHeight: '297mm', background: '#fff', width: '210mm', maxWidth: '100%', boxSizing: 'border-box' as const, padding: '16mm', fontFamily: '"Segoe UI", Arial, Helvetica, sans-serif', color: '#1A1A1A', boxShadow: '0 2px 12px rgba(17,17,17,0.15)' },
  watermark:        { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '60%', opacity: 0.08, filter: 'invert(1) grayscale(1)', mixBlendMode: 'multiply', pointerEvents: 'none' as const, zIndex: 0 },

  encabezado:       { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', position: 'relative', zIndex: 1 },
  empresaBlock:     { display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 },
  logoBox:          { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '52px', height: '52px', background: '#F5C400', borderRadius: '10px', color: '#111111', fontWeight: '900', fontSize: '18px', flexShrink: 0 },
  empresaNombre:    { fontSize: '20px', fontWeight: '900', color: '#111111', margin: 0 },
  empresaSub:       { fontSize: '12px', color: '#6B6B6B', margin: '2px 0 0' },

  letraBox:         { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '64px', height: '64px', border: '2px solid #111111', borderRadius: '6px', flexShrink: 0 },
  letraGrande:      { fontSize: '32px', fontWeight: '900', color: '#111111', lineHeight: 1 },
  letraCod:         { fontSize: '9px', fontWeight: '700', color: '#111111', letterSpacing: '0.5px' },

  datosComprobante: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', flex: 1, minWidth: '160px' },
  tipoTitulo:       { fontSize: '15px', fontWeight: '800', color: '#111111', margin: 0, letterSpacing: '1px', textAlign: 'right' as const },
  numero:           { fontSize: '13px', fontWeight: '700', color: '#333333', margin: 0, fontFamily: 'monospace' },
  fechaLinea:       { fontSize: '12px', color: '#6B6B6B', margin: 0 },

  divisor:          { height: '2px', background: '#111111', margin: '16px 0', position: 'relative', zIndex: 1 },

  codigoBox:        { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', background: '#FFFDF3', border: '2px solid #F5C400', borderRadius: '10px', padding: '14px', marginBottom: '18px', position: 'relative', zIndex: 1 },
  codigoLabel:      { fontSize: '11px', color: '#8A6D00', fontWeight: '700', letterSpacing: '2px' },
  codigoValor:      { fontSize: '34px', fontWeight: '900', color: '#111111', fontFamily: 'monospace', letterSpacing: '2px' },

  metaGrid:         { display: 'flex', gap: '24px', flexWrap: 'wrap' as const, marginBottom: '16px', position: 'relative', zIndex: 1 },
  metaItem:         { display: 'flex', flexDirection: 'column', gap: '2px' },
  metaLabel:        { fontSize: '10px', fontWeight: '700', color: '#6B6B6B', letterSpacing: '1px' },
  metaValor:        { fontSize: '14px', fontWeight: '600', color: '#111111' },

  textoBox:         { marginBottom: '12px', position: 'relative', zIndex: 1 },
  textoLabel:       { fontSize: '10px', fontWeight: '700', color: '#6B6B6B', letterSpacing: '1px', margin: '0 0 3px' },
  texto:            { fontSize: '13px', color: '#333333', margin: 0, background: '#F5F5F5', borderRadius: '6px', padding: '9px 12px' },

  tabla:            { width: '100%', borderCollapse: 'collapse' as const, marginTop: '8px', position: 'relative', zIndex: 1 },
  th:               { fontSize: '11px', fontWeight: '700', color: '#6B6B6B', letterSpacing: '0.5px', textTransform: 'uppercase' as const, padding: '0 6px 8px', borderBottom: '2px solid #111111' },
  tr:               { borderBottom: '1px solid #E2E4E8' },
  td:               { fontSize: '13px', color: '#333333', padding: '9px 6px' },
  tdNombre:         { fontSize: '13px', fontWeight: '600', color: '#111111', padding: '9px 6px' },
  tdCod:            { fontSize: '11px', fontWeight: '400', color: '#9A9A9A' },

  totalesWrap:      { display: 'flex', justifyContent: 'flex-end', marginTop: '14px', position: 'relative', zIndex: 1 },
  totalesBox:       { minWidth: '260px', display: 'flex', flexDirection: 'column', gap: '4px' },
  totalRow:         { display: 'flex', justifyContent: 'space-between', fontSize: '20px', fontWeight: '900', color: '#111111', padding: '4px 0' },
  subRow:           { display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#6B6B6B' },

  pagoBox:          { marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #E2E4E8', display: 'flex', flexDirection: 'column', gap: '4px', position: 'relative', zIndex: 1 },
  pagoValor:        { color: '#111111', fontWeight: '600' },

  footer:           { textAlign: 'center' as const, fontSize: '12px', color: '#6B6B6B', marginTop: 'auto', paddingTop: '28px', fontStyle: 'italic', position: 'relative', zIndex: 1 },

  acciones:    { display: 'flex', gap: '10px' },
  btnImprimir: { flex: 1, padding: '12px', background: '#111111', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' },
  btnCerrar:   { flex: 1, padding: '12px', background: '#F5C400', color: '#111111', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '800', cursor: 'pointer' },
}
