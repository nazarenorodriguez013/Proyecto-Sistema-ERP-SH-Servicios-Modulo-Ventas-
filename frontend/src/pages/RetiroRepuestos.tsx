import { useState, useEffect } from 'react'
import { API } from '../config'
import { socket } from '../socket'
import { ESTADO_RETIRO_LABEL, ESTADO_RETIRO_COLOR, type Servicio, type EstadoRetiro } from '../servicios'

const SIGUIENTE: Record<EstadoRetiro, EstadoRetiro | null> = { PENDIENTE: 'LISTO', LISTO: 'RETIRADO', RETIRADO: null }
const ACCION_LABEL: Record<EstadoRetiro, string> = { PENDIENTE: 'Marcar como listo', LISTO: 'Marcar como retirado', RETIRADO: '' }
const fmtFecha = (d: string) => new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

// Cola del depósito: prepara los repuestos que pidió cada servicio técnico y avisa cuando están listos para retirar
export default function RetiroRepuestos() {
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` }

  const fetchAll = () => fetch(`${API}/repairs/retiros`, { headers }).then(r => r.json()).then(data => { setServicios(data); setLoading(false) })

  useEffect(() => {
    fetchAll()
    socket.on('servicios-actualizados', fetchAll)
    return () => { socket.off('servicios-actualizados', fetchAll) }
  }, [])

  const avanzar = async (sv: Servicio) => {
    if (!sv.estadoRetiro) return
    const siguiente = SIGUIENTE[sv.estadoRetiro]
    if (!siguiente) return
    setError('')
    const res = await fetch(`${API}/repairs/retiros/${sv.id}`, { method: 'PUT', headers, body: JSON.stringify({ estado: siguiente }) })
    if (!res.ok) { const data = await res.json(); setError(data.message || 'No se pudo actualizar el retiro'); return }
    fetchAll()
  }

  if (loading) return <div style={s.loading}>Cargando retiros...</div>

  const pendientes = servicios.filter(sv => sv.estadoRetiro !== 'RETIRADO')
  const retirados = servicios.filter(sv => sv.estadoRetiro === 'RETIRADO')

  return (
    <div style={s.container}>
      {error && <div style={s.errorBanner}><i className="bi bi-exclamation-triangle-fill" /> {error}</div>}

      <div className="stock-table-wrap">
        <div style={s.thead}>
          <span style={{ ...s.th, width: '110px' }}>Código</span>
          <span style={{ ...s.th, flex: 1 }}>Servicio</span>
          <span style={{ ...s.th, width: '150px' }}>Técnico</span>
          <span style={{ ...s.th, width: '140px' }}>Pedido</span>
          <span style={{ ...s.th, width: '160px' }}>Estado</span>
          <span style={{ ...s.th, width: '160px' }} />
        </div>
        {pendientes.length === 0
          ? <div style={s.empty}>No hay retiros pendientes</div>
          : pendientes.map(sv => (
            <div key={sv.id} style={s.row}>
              <span style={{ ...s.td, width: '110px', fontFamily: 'monospace', fontWeight: 700 }}>{sv.codigoRetiro}</span>
              <span style={{ ...s.td, flex: 1, flexDirection: 'column', alignItems: 'flex-start' }}>
                <span style={s.name}>#{sv.id} · {sv.equipo}</span>
                <span style={s.sub}>{sv.cliente.nombre}</span>
              </span>
              <span style={{ ...s.td, width: '150px' }}>{sv.tecnico?.nombre ?? 'Sin asignar'}</span>
              <span style={{ ...s.td, width: '140px' }}>{fmtFecha(sv.fechaIngreso)}</span>
              <span style={{ ...s.td, width: '160px' }}>
                <span style={{ ...s.badge, ...ESTADO_RETIRO_COLOR[sv.estadoRetiro!] }}>{ESTADO_RETIRO_LABEL[sv.estadoRetiro!]}</span>
              </span>
              <span style={{ ...s.td, width: '160px' }}>
                <button style={s.btnPrimary} onClick={() => avanzar(sv)}>{ACCION_LABEL[sv.estadoRetiro!]}</button>
              </span>
            </div>
          ))
        }
      </div>

      {retirados.length > 0 && (
        <details>
          <summary style={s.summary}>Retirados ({retirados.length})</summary>
          <div className="stock-table-wrap" style={{ marginTop: '10px' }}>
            {retirados.map(sv => (
              <div key={sv.id} style={s.row}>
                <span style={{ ...s.td, width: '110px', fontFamily: 'monospace' }}>{sv.codigoRetiro}</span>
                <span style={{ ...s.td, flex: 1 }}>#{sv.id} · {sv.equipo} · {sv.cliente.nombre}</span>
                <span style={{ ...s.td, width: '150px' }}>{sv.tecnico?.nombre ?? '—'}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  container:    { padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: '14px' },
  loading:      { color: '#6B6B6B', padding: '40px', textAlign: 'center' },
  errorBanner:  { background: 'rgba(198,64,47,0.1)', border: '1px solid rgba(198,64,47,0.3)', color: '#C6402F', padding: '10px 14px', borderRadius: '8px', fontSize: '13px' },

  thead:        { display: 'flex', alignItems: 'center', padding: '10px 16px', background: '#FAFBFC', borderBottom: '2px solid #E7E9ED' },
  th:           { color: '#6B6B6B', fontSize: '11px', fontWeight: '700', letterSpacing: '0.8px', textTransform: 'uppercase' as const, display: 'flex', alignItems: 'center' },
  row:          { display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #EFF1F4', background: '#FFFFFF' },
  td:           { display: 'flex', alignItems: 'center', fontSize: '14px', color: '#333333' },
  name:         { color: '#111111', fontWeight: '600' },
  sub:          { color: '#6B6B6B', fontSize: '12px', marginTop: '2px' },
  empty:        { padding: '40px', textAlign: 'center', color: '#6B6B6B', fontSize: '14px' },
  badge:        { padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap' as const },
  btnPrimary:   { background: '#F5C400', color: '#111111', border: 'none', borderRadius: '8px', padding: '7px 14px', fontWeight: '700', fontSize: '12px', cursor: 'pointer' },
  summary:      { color: '#6B6B6B', fontSize: '13px', fontWeight: '600', cursor: 'pointer' },
}
