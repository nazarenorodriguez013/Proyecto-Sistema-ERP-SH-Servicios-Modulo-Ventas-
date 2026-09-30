import { MEDIO_CUENTA_CORRIENTE, type TipoComprobante } from '../config'

interface ItemComprobante {
  id: number; cantidad: number; precioUnitario: number
  producto: { nombre: string; codigo: string | null }
}
export interface ComprobanteData {
  id: number | null
  numero: number | null
  fecha: Date
  tipoComprobante: TipoComprobante
  items: ItemComprobante[]
  total: number
  saldoAplicado: number
  medioPago: string | null
  montoRecibido: number | null
  vendedor: string
  cliente: string | null
}

const TIPO_TITULO: Record<TipoComprobante, string> = {
  FACTURA: 'FACTURA', REMITO: 'REMITO', PRESUPUESTO: 'PRESUPUESTO',
}
// Letra que identifica el tipo de comprobante, como en una factura C de AFIP
const TIPO_LETRA: Record<TipoComprobante, string> = { FACTURA: 'C', REMITO: 'R', PRESUPUESTO: 'P' }
const TIPO_COD: Record<TipoComprobante, string> = { FACTURA: '006', REMITO: '009', PRESUPUESTO: '000' }

const fmt = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtFecha = (d: Date) => d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
const fmtHora = (d: Date) => d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })

// Comprobante a hoja completa (tamaño carta/A4): se usa al cerrar una venta/presupuesto en el Punto de
// Venta y para reimprimir desde el historial. La letra y el número de comprobante son correlativos.
export default function Comprobante({ data, onClose }: { data: ComprobanteData; onClose: () => void }) {
  const aPagar = data.total - data.saldoAplicado

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

            <div style={s.letraBox}>
              <span style={s.letraGrande}>{TIPO_LETRA[data.tipoComprobante]}</span>
              <span style={s.letraCod}>COD. {TIPO_COD[data.tipoComprobante]}</span>
            </div>

            <div style={s.datosComprobante}>
              <p style={s.tipoTitulo}>{TIPO_TITULO[data.tipoComprobante]}</p>
              <p style={s.numero}>N° {data.numero ? String(data.numero).padStart(8, '0') : 'S/N'}</p>
              <p style={s.fechaLinea}>{fmtFecha(data.fecha)} · {fmtHora(data.fecha)} hs</p>
            </div>
          </div>

          <div style={s.divisor} />

          <div style={s.metaGrid}>
            <div style={s.metaItem}>
              <span style={s.metaLabel}>CLIENTE</span>
              <span style={s.metaValor}>{data.cliente ?? 'Consumidor final'}</span>
            </div>
            <div style={s.metaItem}>
              <span style={s.metaLabel}>VENDEDOR</span>
              <span style={s.metaValor}>{data.vendedor}</span>
            </div>
          </div>

          <table style={s.tabla}>
            <thead>
              <tr>
                <th style={{ ...s.th, textAlign: 'left' }}>Descripción</th>
                <th style={{ ...s.th, textAlign: 'center', width: '70px' }}>Cant.</th>
                <th style={{ ...s.th, textAlign: 'right', width: '110px' }}>P. Unit.</th>
                <th style={{ ...s.th, textAlign: 'right', width: '120px' }}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item, i) => (
                <tr key={i} style={s.tr}>
                  <td style={s.tdNombre}>
                    {item.producto.nombre}
                    {item.producto.codigo && <span style={s.tdCod}> · Cód: {item.producto.codigo}</span>}
                  </td>
                  <td style={{ ...s.td, textAlign: 'center' }}>{item.cantidad}</td>
                  <td style={{ ...s.td, textAlign: 'right' }}>${fmt(item.precioUnitario)}</td>
                  <td style={{ ...s.td, textAlign: 'right', fontWeight: 700, color: '#111111' }}>${fmt(item.cantidad * item.precioUnitario)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={s.totalesWrap}>
            <div style={s.totalesBox}>
              <div style={s.totalRow}><span>TOTAL</span><span>${fmt(data.total)}</span></div>
              {data.saldoAplicado > 0 && (
                <>
                  <div style={s.subRow}><span>Saldo a favor aplicado</span><span>-${fmt(data.saldoAplicado)}</span></div>
                  <div style={s.totalRow}>
                    <span>{data.medioPago === MEDIO_CUENTA_CORRIENTE ? 'A CTA. CTE.' : 'A PAGAR'}</span>
                    <span>${fmt(aPagar)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {data.medioPago && (
            <div style={s.pagoBox}>
              <div style={s.subRow}><span>Medio de pago</span><span style={s.pagoValor}>{data.medioPago}</span></div>
              {data.montoRecibido !== null && (
                <>
                  <div style={s.subRow}><span>Monto recibido</span><span style={s.pagoValor}>${fmt(data.montoRecibido)}</span></div>
                  <div style={s.subRow}><span>Vuelto</span><span style={{ ...s.pagoValor, fontWeight: 800 }}>${fmt(data.montoRecibido - aPagar)}</span></div>
                </>
              )}
            </div>
          )}

          <p style={s.footer}>
            {data.tipoComprobante === 'PRESUPUESTO' ? 'Presupuesto sin cargo, sujeto a disponibilidad' : '¡Gracias por su compra!'}
          </p>
        </div>

        <div style={s.modalBtns}>
          <button style={s.btnImprimir} onClick={() => window.print()}><i className="bi bi-printer" /> Imprimir</button>
          <button style={s.btnCerrar} onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  overlay:    { position: 'fixed', inset: 0, background: 'rgba(17,17,17,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '20px' },
  modalWrap:  { background: '#EFF1F4', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' },

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
  tipoTitulo:       { fontSize: '15px', fontWeight: '800', color: '#111111', margin: 0, letterSpacing: '1px' },
  numero:           { fontSize: '13px', fontWeight: '700', color: '#333333', margin: 0, fontFamily: 'monospace' },
  fechaLinea:       { fontSize: '12px', color: '#6B6B6B', margin: 0 },

  divisor:          { height: '2px', background: '#111111', margin: '16px 0', position: 'relative', zIndex: 1 },

  metaGrid:         { display: 'flex', gap: '24px', marginBottom: '18px', position: 'relative', zIndex: 1 },
  metaItem:         { display: 'flex', flexDirection: 'column', gap: '2px' },
  metaLabel:        { fontSize: '10px', fontWeight: '700', color: '#6B6B6B', letterSpacing: '1px' },
  metaValor:        { fontSize: '14px', fontWeight: '600', color: '#111111' },

  tabla:            { width: '100%', borderCollapse: 'collapse' as const, position: 'relative', zIndex: 1 },
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

  modalBtns:   { display: 'flex', gap: '10px' },
  btnImprimir: { flex: 1, padding: '12px', background: '#111111', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' },
  btnCerrar:   { flex: 1, padding: '12px', background: '#F5C400', color: '#111111', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '800', cursor: 'pointer' },
}
