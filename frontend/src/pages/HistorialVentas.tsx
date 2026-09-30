import { useState, useEffect } from 'react'
import { API, TIPO_COMPROBANTE_LABEL, type TipoComprobante } from '../config'
import Comprobante, { type ComprobanteData } from '../components/Comprobante'

interface Venta {
  id: number; total: number; tipoComprobante: TipoComprobante; medioPago: string; montoRecibido: number | null
  saldoAplicado: number; creadoEn: string
  usuario: { nombre: string }; cliente: { nombre: string } | null
  detallesVenta: { id: number; cantidad: number; precioUnitario: number; producto: { nombre: string; codigo: string | null } }[]
}

const fmt = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtFecha = (d: string) => new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export default function HistorialVentas() {
  const [ventas, setVentas] = useState<Venta[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [comprobante, setComprobante] = useState<ComprobanteData | null>(null)

  const token = localStorage.getItem('token') ?? ''
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

  useEffect(() => {
    fetch(`${API}/sales`, { headers }).then(r => r.json()).then(v => { setVentas(v); setLoading(false) })
  }, [])

  const q = busqueda.trim().toLowerCase()
  const filtradas = q
    ? ventas.filter(v => v.cliente?.nombre.toLowerCase().includes(q) || String(v.id).includes(q))
    : ventas

  const reimprimir = (v: Venta) => setComprobante({
    id: v.id,
    fecha: new Date(v.creadoEn),
    tipoComprobante: v.tipoComprobante,
    items: v.detallesVenta,
    total: v.total,
    saldoAplicado: v.saldoAplicado,
    medioPago: v.medioPago,
    montoRecibido: v.montoRecibido,
    vendedor: v.usuario.nombre,
    cliente: v.cliente?.nombre ?? null,
  })

  if (loading) return <div style={s.loading}>Cargando historial...</div>

  return (
    <div className="page-container">
      <div style={s.header}>
        <div>
          <h2 style={s.title}>Historial de Ventas</h2>
          <p style={s.subtitle}>{filtradas.length} de {ventas.length} comprobantes</p>
        </div>
      </div>

      <input style={s.buscador} placeholder="Buscar por cliente o número de comprobante..."
        value={busqueda} onChange={e => setBusqueda(e.target.value)} />

      <div style={s.card}>
        {filtradas.length === 0
          ? <div style={s.empty}>No hay ventas registradas</div>
          : filtradas.map(v => (
            <div key={v.id} style={s.row}>
              <span style={s.rowTipo}>{TIPO_COMPROBANTE_LABEL[v.tipoComprobante]}</span>
              <span style={s.rowId}>#{String(v.id).padStart(6, '0')}</span>
              <span style={s.rowFecha}>{fmtFecha(v.creadoEn)}</span>
              <span style={s.rowCliente}>{v.cliente?.nombre ?? '—'}</span>
              <span style={s.rowVendedor}>{v.usuario.nombre}</span>
              <span style={s.rowTotal}>${fmt(v.total)}</span>
              <button style={s.btnReimprimir} onClick={() => reimprimir(v)}>
                <i className="bi bi-printer" /> Reimprimir
              </button>
            </div>
          ))
        }
      </div>

      {comprobante && <Comprobante data={comprobante} onClose={() => setComprobante(null)} />}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  loading:     { color: '#6B6B6B', padding: '40px', textAlign: 'center' },
  header:      { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  title:       { color: '#111111', fontSize: '20px', fontWeight: '700', margin: 0 },
  subtitle:    { color: '#6B6B6B', fontSize: '13px', margin: '3px 0 0' },
  buscador:    { background: '#FFFFFF', border: '1px solid #D3D3D3', borderRadius: '8px', padding: '9px 14px', color: '#111111', fontSize: '14px', outline: 'none', width: '100%', maxWidth: '360px', boxSizing: 'border-box' as const },

  card:        { background: '#FFFFFF', border: '1px solid #E2E4E8', borderRadius: '12px', padding: '8px 18px' },
  empty:       { color: '#6B6B6B', fontSize: '13px', textAlign: 'center', padding: '30px' },

  row:         { display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 4px', borderBottom: '1px solid #EFF1F4', flexWrap: 'wrap' as const },
  rowTipo:     { color: '#8A6D00', fontSize: '11px', fontWeight: '700', background: '#FFFDF3', border: '1px solid rgba(245,196,0,0.3)', borderRadius: '20px', padding: '3px 10px', flexShrink: 0 },
  rowId:       { color: '#111111', fontSize: '13px', fontWeight: '700', flexShrink: 0 },
  rowFecha:    { color: '#6B6B6B', fontSize: '12px', flexShrink: 0 },
  rowCliente:  { color: '#333333', fontSize: '13px', flex: 1, minWidth: '120px' },
  rowVendedor: { color: '#6B6B6B', fontSize: '12px', flexShrink: 0 },
  rowTotal:    { color: '#111111', fontSize: '14px', fontWeight: '800', minWidth: '100px', textAlign: 'right' as const },
  btnReimprimir:{ background: '#FFFFFF', border: '1px solid #E2E4E8', borderRadius: '8px', padding: '7px 12px', color: '#111111', fontSize: '12px', fontWeight: '600', cursor: 'pointer', flexShrink: 0 },
}
