export type TipoComprobante = 'FACTURA' | 'REMITO' | 'CTA_CTE' | 'PRESUPUESTO'

interface ItemComprobante {
  id: number; cantidad: number; precioUnitario: number
  producto: { nombre: string; codigo: string | null }
}
export interface ComprobanteData {
  id: number | null
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
  FACTURA: 'FACTURA', REMITO: 'REMITO', CTA_CTE: 'CUENTA CORRIENTE', PRESUPUESTO: 'PRESUPUESTO',
}

const fmt = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtFecha = (d: Date) => d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

// Ticket compartido: se usa al cerrar una venta/presupuesto en el Punto de Venta y para reimprimir desde el historial
export default function Comprobante({ data, onClose }: { data: ComprobanteData; onClose: () => void }) {
  const aPagar = data.total - data.saldoAplicado

  return (
    <div style={s.overlay}>
      <div style={s.modal}>
        <div id="ticket" style={s.ticket}>
          <img src="/logosh.png" alt="" style={s.watermark} />

          <div style={s.ticketHeader}>
            <div style={s.ticketLogo}>SH</div>
            <h1 style={s.ticketEmpresa}>SH Servicios</h1>
            <p style={s.ticketSubEmpresa}>Insumos y Soluciones Técnicas</p>
            <div style={s.ticketSep}>━━━━━━━━━━━━━━━━━━━━━━━━</div>
            <p style={s.ticketTipo}>{TIPO_TITULO[data.tipoComprobante]}</p>
            <div style={s.ticketSep}>━━━━━━━━━━━━━━━━━━━━━━━━</div>
          </div>

          <div style={s.ticketMeta}>
            <div style={s.ticketMetaRow}>
              <span style={s.ticketMetaKey}>N° Comprobante</span>
              <span style={s.ticketMetaVal}>{data.id ? `#${String(data.id).padStart(6, '0')}` : 'S/N'}</span>
            </div>
            <div style={s.ticketMetaRow}>
              <span style={s.ticketMetaKey}>Fecha</span>
              <span style={s.ticketMetaVal}>{fmtFecha(data.fecha)}</span>
            </div>
            <div style={s.ticketMetaRow}>
              <span style={s.ticketMetaKey}>Vendedor</span>
              <span style={s.ticketMetaVal}>{data.vendedor}</span>
            </div>
            {data.cliente && (
              <div style={s.ticketMetaRow}>
                <span style={s.ticketMetaKey}>Cliente</span>
                <span style={s.ticketMetaVal}>{data.cliente}</span>
              </div>
            )}
          </div>

          <div style={s.ticketSep}>- - - - - - - - - - - - - - - - - - - - - - -</div>

          <div style={s.ticketItemHead}>
            <span style={{ flex: 1, minWidth: 0 }}>Descripción</span>
            <span style={s.ticketCol1}>Cant</span>
            <span style={{ ...s.ticketColNum, textAlign: 'right' }}>P.U.</span>
            <span style={{ ...s.ticketColNum, textAlign: 'right' }}>Subtotal</span>
          </div>
          <div style={s.ticketSep}>- - - - - - - - - - - - - - - - - - - - - - -</div>

          {data.items.map((item, i) => (
            <div key={i} style={s.ticketItem}>
              <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                <p style={s.ticketItemNombre}>{item.producto.nombre}</p>
                {item.producto.codigo && <p style={s.ticketItemCod}>Cód: {item.producto.codigo}</p>}
              </div>
              <span style={{ ...s.ticketCol1, textAlign: 'center', color: '#1A1A1A' }}>{item.cantidad}</span>
              <span style={{ ...s.ticketColNum, textAlign: 'right', color: '#1A1A1A' }}>${fmt(item.precioUnitario)}</span>
              <span style={{ ...s.ticketColNum, textAlign: 'right', fontWeight: 700, color: '#1A1A1A' }}>${fmt(item.cantidad * item.precioUnitario)}</span>
            </div>
          ))}

          <div style={s.ticketSep}>━━━━━━━━━━━━━━━━━━━━━━━━</div>

          <div style={s.ticketTotal}>
            <span>TOTAL</span>
            <span>${fmt(data.total)}</span>
          </div>
          {data.saldoAplicado > 0 && (
            <>
              <div style={s.ticketMetaRow}>
                <span style={s.ticketMetaKey}>Saldo a favor aplicado</span>
                <span style={s.ticketMetaVal}>-${fmt(data.saldoAplicado)}</span>
              </div>
              <div style={s.ticketTotal}>
                <span>{data.tipoComprobante === 'CTA_CTE' ? 'A CTA. CTE.' : 'A PAGAR'}</span>
                <span>${fmt(aPagar)}</span>
              </div>
            </>
          )}

          {data.medioPago && (
            <>
              <div style={s.ticketSep}>- - - - - - - - - - - - - - - - - - - - - - -</div>
              <div style={s.ticketPago}>
                <div style={s.ticketMetaRow}>
                  <span style={s.ticketMetaKey}>Medio de pago</span>
                  <span style={s.ticketMetaVal}>{data.medioPago}</span>
                </div>
                {data.montoRecibido !== null && (
                  <>
                    <div style={s.ticketMetaRow}>
                      <span style={s.ticketMetaKey}>Monto recibido</span>
                      <span style={s.ticketMetaVal}>${fmt(data.montoRecibido)}</span>
                    </div>
                    <div style={s.ticketMetaRow}>
                      <span style={s.ticketMetaKey}>Vuelto</span>
                      <span style={{ ...s.ticketMetaVal, fontWeight: 700 }}>${fmt(data.montoRecibido - aPagar)}</span>
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          <div style={s.ticketSep}>━━━━━━━━━━━━━━━━━━━━━━━━</div>
          <p style={s.ticketGracias}>
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
  overlay:     { position: 'fixed', inset: 0, background: 'rgba(17,17,17,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 },
  modal:       { background: '#fff', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' },

  ticket:           { position: 'relative', background: '#fff', width: '320px', fontFamily: '"Courier New", monospace', color: '#1A1A1A', padding: '8px 0' },
  watermark:        { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '70%', opacity: 0.06, pointerEvents: 'none' as const, zIndex: 0 },
  ticketHeader:     { textAlign: 'center', marginBottom: '8px', position: 'relative', zIndex: 1 },
  ticketLogo:       { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', background: '#F5C400', borderRadius: '10px', color: '#111111', fontWeight: '900', fontSize: '18px', marginBottom: '8px' },
  ticketEmpresa:    { fontSize: '18px', fontWeight: '900', color: '#111111', margin: '0 0 2px' },
  ticketSubEmpresa: { fontSize: '11px', color: '#3A3A3A', margin: '0 0 8px' },
  ticketSep:        { color: '#9A9A9A', fontSize: '11px', textAlign: 'center', margin: '6px 0', position: 'relative', zIndex: 1 },
  ticketTipo:       { fontWeight: '700', fontSize: '13px', letterSpacing: '2px', color: '#111111', margin: '4px 0' },

  ticketMeta:       { margin: '4px 0', position: 'relative', zIndex: 1 },
  ticketMetaRow:    { display: 'flex', justifyContent: 'space-between', fontSize: '12px', margin: '3px 0' },
  ticketMetaKey:    { color: '#6B6B6B' },
  ticketMetaVal:    { color: '#111111', fontWeight: '600' },

  ticketItemHead:   { display: 'flex', fontSize: '11px', fontWeight: '700', color: '#6B6B6B', margin: '4px 0', position: 'relative', zIndex: 1 },
  ticketItem:       { display: 'flex', alignItems: 'flex-start', margin: '5px 0', gap: '2px', position: 'relative', zIndex: 1 },
  ticketItemNombre: { fontSize: '11px', fontWeight: '700', color: '#111111', margin: 0, wordBreak: 'break-word' as const },
  ticketItemCod:    { fontSize: '10px', color: '#9A9A9A', margin: '1px 0 0' },
  ticketCol1:       { width: '32px', flexShrink: 0, fontSize: '11px' },
  ticketColNum:     { width: '88px', flexShrink: 0, fontSize: '11px', whiteSpace: 'nowrap' as const },

  ticketTotal:      { display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: '900', color: '#111111', margin: '4px 0', position: 'relative', zIndex: 1 },
  ticketPago:       { margin: '4px 0', position: 'relative', zIndex: 1 },
  ticketGracias:    { textAlign: 'center', fontSize: '12px', color: '#6B6B6B', margin: '8px 0 4px', fontStyle: 'italic', position: 'relative', zIndex: 1 },

  modalBtns:   { display: 'flex', gap: '10px' },
  btnImprimir: { flex: 1, padding: '12px', background: '#111111', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' },
  btnCerrar:   { flex: 1, padding: '12px', background: '#F5C400', color: '#111111', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '800', cursor: 'pointer' },
}
