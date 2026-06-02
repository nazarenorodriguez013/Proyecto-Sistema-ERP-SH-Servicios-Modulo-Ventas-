import { useState, useEffect } from 'react'
import type { User } from '../types'
import { API } from '../config'

interface Categoria { id: number; nombre: string }
interface Producto { id: number; nombre: string; codigo: string | null; categoria: Categoria }
interface DetalleVenta { id: number; cantidad: number; precioUnitario: number; producto: Producto }
interface Venta {
  id: number
  total: number
  medioPago: string
  montoRecibido: number | null
  creadoEn: string
  usuario: { nombre: string }
  detallesVenta: DetalleVenta[]
}

const fmt = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtFecha = (s: string) => new Date(s).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export default function Comprobantes({ user: _user }: { user: User }) {
  const [ventas, setVentas] = useState<Venta[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Venta | null>(null)
  const [search, setSearch] = useState('')

  const token = localStorage.getItem('token') ?? ''
  const headers = { Authorization: `Bearer ${token}` }

  useEffect(() => {
    fetch(`${API}/sales`, { headers })
      .then(r => r.json())
      .then(data => { setVentas(data); setLoading(false) })
  }, [])

  const filtered = ventas.filter(v => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      String(v.id).includes(q) ||
      v.usuario.nombre.toLowerCase().includes(q) ||
      v.medioPago.toLowerCase().includes(q) ||
      v.detallesVenta.some(d => d.producto.nombre.toLowerCase().includes(q))
    )
  })

  if (loading) return <div style={s.loading}>Cargando comprobantes...</div>

  return (
    <div style={s.container}>
      <div style={s.header}>
        <div>
          <h2 style={s.title}>Comprobantes Emitidos</h2>
          <p style={s.subtitle}>{filtered.length} de {ventas.length} comprobantes</p>
        </div>
      </div>

      <input
        style={s.searchInput}
        placeholder="Buscar por N°, vendedor, producto o medio de pago..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {filtered.length === 0 ? (
        <div style={s.empty}>No hay comprobantes que coincidan</div>
      ) : (
        <div style={s.tableWrapper}>
          <table style={s.table}>
            <thead>
              <tr>
                {['N° Comp.', 'Fecha', 'Vendedor', 'Productos', 'Medio de pago', 'Total', ''].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(v => (
                <tr key={v.id} style={s.tr}>
                  <td style={s.td}>
                    <span style={s.numComp}>#{String(v.id).padStart(6, '0')}</span>
                  </td>
                  <td style={s.td}><span style={s.fecha}>{fmtFecha(v.creadoEn)}</span></td>
                  <td style={s.td}><span style={s.vendedor}>{v.usuario.nombre}</span></td>
                  <td style={s.td}>
                    <span style={s.productos}>
                      {v.detallesVenta.map(d => d.producto.nombre).join(', ')}
                    </span>
                  </td>
                  <td style={s.td}>
                    <span style={{ ...s.medioBadge, ...medioPagoStyle(v.medioPago) }}>{v.medioPago}</span>
                  </td>
                  <td style={s.td}><span style={s.total}>${fmt(v.total)}</span></td>
                  <td style={s.td}>
                    <button style={s.btnVer} onClick={() => setSelected(v)}>Ver / Reimprimir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal ticket */}
      {selected && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <div id="ticket" style={s.ticket}>
              <div style={s.ticketHeader}>
                <div style={s.ticketLogo}>SH</div>
                <h1 style={s.ticketEmpresa}>SH Servicios</h1>
                <p style={s.ticketSubEmpresa}>Insumos y Soluciones Técnicas</p>
                <div style={s.ticketSep}>━━━━━━━━━━━━━━━━━━━━━━━━</div>
                <p style={s.ticketTipo}>COMPROBANTE DE VENTA</p>
                <div style={s.ticketSep}>━━━━━━━━━━━━━━━━━━━━━━━━</div>
              </div>

              <div style={s.ticketMeta}>
                <div style={s.ticketMetaRow}>
                  <span style={s.ticketMetaKey}>N° Comprobante</span>
                  <span style={s.ticketMetaVal}>#{String(selected.id).padStart(6, '0')}</span>
                </div>
                <div style={s.ticketMetaRow}>
                  <span style={s.ticketMetaKey}>Fecha</span>
                  <span style={s.ticketMetaVal}>{fmtFecha(selected.creadoEn)}</span>
                </div>
                <div style={s.ticketMetaRow}>
                  <span style={s.ticketMetaKey}>Vendedor</span>
                  <span style={s.ticketMetaVal}>{selected.usuario.nombre}</span>
                </div>
              </div>

              <div style={s.ticketSep}>- - - - - - - - - - - - - - - - - - - - - - -</div>

              <div style={s.ticketItemHead}>
                <span style={{ flex: 1 }}>Descripción</span>
                <span style={{ width: '40px', textAlign: 'center' }}>Cant</span>
                <span style={{ width: '70px', textAlign: 'right' }}>P.U.</span>
                <span style={{ width: '80px', textAlign: 'right' }}>Subtotal</span>
              </div>
              <div style={s.ticketSep}>- - - - - - - - - - - - - - - - - - - - - - -</div>

              {selected.detallesVenta.map(d => (
                <div key={d.id} style={s.ticketItem}>
                  <div style={{ flex: 1 }}>
                    <p style={s.ticketItemNombre}>{d.producto.nombre}</p>
                    {d.producto.codigo && <p style={s.ticketItemCod}>Cód: {d.producto.codigo}</p>}
                  </div>
                  <span style={{ width: '40px', textAlign: 'center', color: '#1e293b' }}>{d.cantidad}</span>
                  <span style={{ width: '70px', textAlign: 'right', color: '#1e293b' }}>${fmt(d.precioUnitario)}</span>
                  <span style={{ width: '80px', textAlign: 'right', fontWeight: 700, color: '#1e293b' }}>${fmt(d.cantidad * d.precioUnitario)}</span>
                </div>
              ))}

              <div style={s.ticketSep}>━━━━━━━━━━━━━━━━━━━━━━━━</div>

              <div style={s.ticketTotal}>
                <span>TOTAL</span>
                <span>${fmt(selected.total)}</span>
              </div>

              <div style={s.ticketSep}>- - - - - - - - - - - - - - - - - - - - - - -</div>

              <div style={s.ticketPago}>
                <div style={s.ticketMetaRow}>
                  <span style={s.ticketMetaKey}>Medio de pago</span>
                  <span style={s.ticketMetaVal}>{selected.medioPago}</span>
                </div>
                {selected.montoRecibido !== null && (
                  <>
                    <div style={s.ticketMetaRow}>
                      <span style={s.ticketMetaKey}>Monto recibido</span>
                      <span style={s.ticketMetaVal}>${fmt(selected.montoRecibido)}</span>
                    </div>
                    <div style={s.ticketMetaRow}>
                      <span style={s.ticketMetaKey}>Vuelto</span>
                      <span style={{ ...s.ticketMetaVal, fontWeight: 700 }}>${fmt(selected.montoRecibido - selected.total)}</span>
                    </div>
                  </>
                )}
              </div>

              <div style={s.ticketSep}>━━━━━━━━━━━━━━━━━━━━━━━━</div>
              <p style={s.ticketGracias}>¡Gracias por su compra!</p>
            </div>

            <div style={s.modalBtns}>
              <button style={s.btnImprimir} onClick={() => window.print()}>Imprimir</button>
              <button style={s.btnCerrar} onClick={() => setSelected(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const medioPagoStyle = (mp: string): React.CSSProperties => {
  const map: Record<string, React.CSSProperties> = {
    'Efectivo':      { background: 'rgba(34,197,94,0.1)',   color: '#22c55e',  border: '1px solid rgba(34,197,94,0.2)' },
    'Débito':        { background: 'rgba(59,130,246,0.1)',  color: '#60a5fa',  border: '1px solid rgba(59,130,246,0.2)' },
    'Crédito':       { background: 'rgba(168,85,247,0.1)',  color: '#c084fc',  border: '1px solid rgba(168,85,247,0.2)' },
    'Transferencia': { background: 'rgba(234,179,8,0.1)',   color: '#eab308',  border: '1px solid rgba(234,179,8,0.2)' },
  }
  return map[mp] ?? { background: 'rgba(100,116,139,0.1)', color: '#94a3b8', border: '1px solid rgba(100,116,139,0.2)' }
}

const s: Record<string, React.CSSProperties> = {
  container:    { padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px' },
  loading:      { color: '#9ca3af', padding: '40px', textAlign: 'center' },
  header:       { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  title:        { color: '#fff', fontSize: '22px', fontWeight: '700', margin: 0 },
  subtitle:     { color: '#6b7280', fontSize: '13px', margin: '4px 0 0' },
  searchInput:  { background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '10px 14px', color: '#f1f5f9', fontSize: '14px', outline: 'none', width: '100%', boxSizing: 'border-box' },
  empty:        { color: '#4b5563', textAlign: 'center', padding: '48px' },

  tableWrapper: { background: '#111', border: '1px solid #1f1f1f', borderRadius: '12px', overflow: 'hidden' },
  table:        { width: '100%', borderCollapse: 'collapse' },
  th:           { padding: '14px 16px', textAlign: 'left', color: '#6b7280', fontSize: '12px', fontWeight: '600', letterSpacing: '0.5px', background: '#0d0d0d', borderBottom: '1px solid #1f1f1f' },
  tr:           { borderBottom: '1px solid #1a1a1a' },
  td:           { padding: '12px 16px', color: '#d1d5db', fontSize: '14px', verticalAlign: 'middle' },

  numComp:      { fontFamily: 'monospace', color: '#eab308', fontWeight: '700', fontSize: '13px' },
  fecha:        { color: '#9ca3af', fontSize: '13px' },
  vendedor:     { color: '#f1f5f9', fontWeight: '600' },
  productos:    { color: '#94a3b8', fontSize: '12px', display: 'block', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  medioBadge:   { padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' },
  total:        { color: '#eab308', fontWeight: '800', fontSize: '15px' },
  btnVer:       { background: 'transparent', border: '1px solid #334155', borderRadius: '7px', color: '#cbd5e1', fontSize: '12px', padding: '6px 14px', cursor: 'pointer', whiteSpace: 'nowrap' },

  // Modal
  overlay:      { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 },
  modal:        { background: '#fff', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' },

  // Ticket
  ticket:           { background: '#fff', width: '320px', fontFamily: '"Courier New", monospace', color: '#1e293b', padding: '8px 0' },
  ticketHeader:     { textAlign: 'center', marginBottom: '8px' },
  ticketLogo:       { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', background: '#eab308', borderRadius: '10px', color: '#0f172a', fontWeight: '900', fontSize: '18px', marginBottom: '8px' },
  ticketEmpresa:    { fontSize: '18px', fontWeight: '900', color: '#0f172a', margin: '0 0 2px' },
  ticketSubEmpresa: { fontSize: '11px', color: '#475569', margin: '0 0 8px' },
  ticketSep:        { color: '#94a3b8', fontSize: '11px', textAlign: 'center', margin: '6px 0' },
  ticketTipo:       { fontWeight: '700', fontSize: '13px', letterSpacing: '2px', color: '#0f172a', margin: '4px 0' },
  ticketMeta:       { margin: '4px 0' },
  ticketMetaRow:    { display: 'flex', justifyContent: 'space-between', fontSize: '12px', margin: '3px 0' },
  ticketMetaKey:    { color: '#64748b' },
  ticketMetaVal:    { color: '#0f172a', fontWeight: '600' },
  ticketItemHead:   { display: 'flex', fontSize: '11px', fontWeight: '700', color: '#64748b', margin: '4px 0' },
  ticketItem:       { display: 'flex', alignItems: 'flex-start', margin: '5px 0' },
  ticketItemNombre: { fontSize: '12px', fontWeight: '700', color: '#0f172a', margin: 0 },
  ticketItemCod:    { fontSize: '10px', color: '#94a3b8', margin: '1px 0 0' },
  ticketTotal:      { display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: '900', color: '#0f172a', margin: '4px 0' },
  ticketPago:       { margin: '4px 0' },
  ticketGracias:    { textAlign: 'center', fontSize: '12px', color: '#64748b', margin: '8px 0 4px', fontStyle: 'italic' },

  modalBtns:    { display: 'flex', gap: '10px' },
  btnImprimir:  { flex: 1, padding: '12px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' },
  btnCerrar:    { flex: 1, padding: '12px', background: '#eab308', color: '#0f172a', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '800', cursor: 'pointer' },
}
