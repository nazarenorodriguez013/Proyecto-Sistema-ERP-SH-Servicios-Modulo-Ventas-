import { useState, useEffect } from 'react'
import { API, formatComprobante } from '../config'
import ServicioTicket from '../components/ServicioTicket'
import type { Servicio } from '../servicios'

const fmt = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtFecha = (d: string) => new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })

export default function HistorialServicios() {
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [verTicket, setVerTicket] = useState<Servicio | null>(null)

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` }

  useEffect(() => {
    fetch(`${API}/repairs`, { headers }).then(r => r.json()).then((data: Servicio[]) => {
      setServicios(data.filter(sv => sv.estado === 'FINALIZADO')); setLoading(false)
    })
  }, [])

  const q = busqueda.trim().toLowerCase()
  const filtrados = q ? servicios.filter(sv => sv.cliente.nombre.toLowerCase().includes(q) || String(sv.id).includes(q)) : servicios

  if (loading) return <div style={s.loading}>Cargando historial...</div>

  return (
    <div className="page-container">
      <div style={s.header}>
        <div>
          <h2 style={s.title}>Historial de Servicios Técnicos</h2>
          <p style={s.subtitle}>{filtrados.length} de {servicios.length} servicios finalizados</p>
        </div>
      </div>

      <input style={s.buscador} placeholder="Buscar por cliente o número de servicio..."
        value={busqueda} onChange={e => setBusqueda(e.target.value)} />

      <div style={s.card}>
        {filtrados.length === 0
          ? <div style={s.empty}>No hay servicios finalizados</div>
          : filtrados.map(sv => (
            <div key={sv.id} style={s.row}>
              <span style={s.rowTipo}>{sv.tipoComprobante}</span>
              <span style={s.rowId}>N° {formatComprobante(sv.numero ?? sv.id!)}</span>
              <span style={s.rowFecha}>{sv.finalizadoEn && fmtFecha(sv.finalizadoEn)}</span>
              <span style={s.rowCliente}>{sv.cliente.nombre} · {sv.equipo}</span>
              <span style={s.rowTecnico}>{sv.tecnico?.nombre ?? '—'}</span>
              <span style={s.rowTotal}>${fmt(sv.total ?? 0)}</span>
              <button style={s.btnReimprimir} onClick={() => setVerTicket(sv)}><i className="bi bi-printer" /> Reimprimir</button>
            </div>
          ))
        }
      </div>

      {verTicket && <ServicioTicket modo="comprobante" servicio={verTicket} onClose={() => setVerTicket(null)} />}
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
  rowCliente:  { color: '#333333', fontSize: '13px', flex: 1, minWidth: '160px' },
  rowTecnico:  { color: '#6B6B6B', fontSize: '12px', flexShrink: 0 },
  rowTotal:    { color: '#111111', fontSize: '14px', fontWeight: '800', minWidth: '100px', textAlign: 'right' as const },
  btnReimprimir:{ background: '#FFFFFF', border: '1px solid #E2E4E8', borderRadius: '8px', padding: '7px 12px', color: '#111111', fontSize: '12px', fontWeight: '600', cursor: 'pointer', flexShrink: 0 },
}
