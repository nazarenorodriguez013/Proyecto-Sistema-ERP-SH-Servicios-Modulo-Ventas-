import { useState, useEffect } from 'react'
import type { User } from '../types'
import { API } from '../config'

interface Maquina { id: number; nombre: string }
interface Cliente { id: number; nombre: string }
interface Alquiler {
  id: number; cliente: Cliente | null
  fechaInicio: string; fechaFin: string; total: number
  estado: 'ACTIVO' | 'FINALIZADO' | 'CANCELADO'
  maquina: Maquina
  usuario: { nombre: string }
  creadoEn: string
}

const fmt = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
// Son fechas de calendario (sin hora): se formatean en UTC para que no varíen según la zona horaria del navegador
const fmtFecha = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })

const ESTADO_LABEL: Record<Alquiler['estado'], string> = {
  ACTIVO: 'Activo', FINALIZADO: 'Finalizado', CANCELADO: 'Cancelado',
}

export default function Alquileres({ user }: { user: User }) {
  const [alquileres, setAlquileres] = useState<Alquiler[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'ACTIVO' | 'FINALIZADO' | 'CANCELADO'>('all')
  const [error, setError] = useState('')

  const token = localStorage.getItem('token') ?? ''
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
  const isAdmin = user.rol === 'ADMIN'

  const fetchAll = async () => {
    const res = await fetch(`${API}/rentals`, { headers })
    setAlquileres(await res.json())
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  const handleEstado = async (id: number, estado: 'FINALIZADO' | 'CANCELADO') => {
    const res = await fetch(`${API}/rentals/${id}/estado`, { method: 'PUT', headers, body: JSON.stringify({ estado }) })
    if (!res.ok) {
      const data = await res.json()
      setError(data.message || 'No se pudo actualizar el alquiler')
    }
    fetchAll()
  }

  const filtered = alquileres.filter(a => filter === 'all' || a.estado === filter)
  const activosCount = alquileres.filter(a => a.estado === 'ACTIVO').length

  if (loading) return <div style={s.loading}>Cargando alquileres...</div>

  return (
    <div style={s.container}>
      <div style={s.header}>
        <div>
          <h2 style={s.title}>Alquileres</h2>
          <p style={s.subtitle}>{alquileres.length} registrados · {activosCount} activos — se registran desde Punto de Alquiler</p>
        </div>
      </div>

      {error && <div style={s.errorBanner}>⚠ {error}</div>}

      {/* Filtros */}
      <div style={s.tabs}>
        {([
          { key: 'all', label: 'Todos' },
          { key: 'ACTIVO', label: 'Activos' },
          { key: 'FINALIZADO', label: 'Finalizados' },
          { key: 'CANCELADO', label: 'Cancelados' },
        ] as const).map(f => (
          <button key={f.key}
            style={{ ...s.tab, ...(filter === f.key ? s.tabActive : {}) }}
            onClick={() => setFilter(f.key)}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Tabla */}
      <div style={s.tableWrap}>
        <div style={s.thead}>
          <span style={{ ...s.th, flex: 1 }}>Máquina</span>
          <span style={{ ...s.th, width: '160px' }}>Cliente</span>
          <span style={{ ...s.th, width: '100px' }}>Inicio</span>
          <span style={{ ...s.th, width: '100px' }}>Fin</span>
          <span style={{ ...s.th, width: '110px', textAlign: 'right' }}>Total</span>
          <span style={{ ...s.th, width: '100px', textAlign: 'center' }}>Estado</span>
          {isAdmin && <span style={{ ...s.th, width: '190px', textAlign: 'center' }}>Acciones</span>}
        </div>

        {filtered.length === 0
          ? <div style={s.empty}>No hay alquileres para este filtro</div>
          : filtered.map(a => (
            <div key={a.id} style={s.row}>
              <span style={{ ...s.td, flex: 1 }}>
                <span style={s.name}>{a.maquina.nombre}</span>
              </span>
              <span style={{ ...s.td, width: '160px' }}>{a.cliente?.nombre ?? '—'}</span>
              <span style={{ ...s.td, width: '100px' }}>{fmtFecha(a.fechaInicio)}</span>
              <span style={{ ...s.td, width: '100px' }}>{fmtFecha(a.fechaFin)}</span>
              <span style={{ ...s.td, width: '110px', justifyContent: 'flex-end', color: '#eab308', fontWeight: 700 }}>
                ${fmt(a.total)}
              </span>
              <span style={{ ...s.td, width: '100px', justifyContent: 'center' }}>
                <span style={{
                  ...s.badge,
                  ...(a.estado === 'ACTIVO' ? s.badgeActivo : a.estado === 'FINALIZADO' ? s.badgeFinalizado : s.badgeCancelado),
                }}>
                  {ESTADO_LABEL[a.estado]}
                </span>
              </span>
              {isAdmin && (
                <span style={{ ...s.td, width: '190px', justifyContent: 'center', gap: '6px' }}>
                  {a.estado === 'ACTIVO' && (
                    <>
                      <button style={s.btnFinalizar} onClick={() => handleEstado(a.id, 'FINALIZADO')}>Finalizar</button>
                      <button style={s.btnCancelar} onClick={() => handleEstado(a.id, 'CANCELADO')}>Cancelar</button>
                    </>
                  )}
                </span>
              )}
            </div>
          ))
        }
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  container:   { padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '20px', overflowX: 'hidden' },
  loading:     { color: '#94a3b8', padding: '40px', textAlign: 'center' },
  header:      { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  title:       { color: '#f1f5f9', fontSize: '20px', fontWeight: '700', margin: 0 },
  subtitle:    { color: '#cbd5e1', fontSize: '13px', margin: '3px 0 0' },
  errorBanner: { background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', padding: '10px 14px', borderRadius: '8px', fontSize: '13px' },

  tabs:        { display: 'flex', gap: '6px' },
  tab:         { background: 'transparent', border: '1px solid #334155', borderRadius: '8px', padding: '7px 14px', color: '#94a3b8', fontSize: '12px', fontWeight: '500', cursor: 'pointer' },
  tabActive:   { background: 'rgba(234,179,8,0.1)', borderColor: 'rgba(234,179,8,0.3)', color: '#eab308', fontWeight: '600' },

  tableWrap:   { background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', overflow: 'hidden' },
  thead:       { display: 'flex', alignItems: 'center', padding: '10px 16px', background: '#0f172a', borderBottom: '1px solid #334155' },
  th:          { color: '#cbd5e1', fontSize: '11px', fontWeight: '700', letterSpacing: '0.8px', textTransform: 'uppercase' as const, display: 'flex', alignItems: 'center' },
  row:         { display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #1e293b' },
  td:          { display: 'flex', alignItems: 'center', fontSize: '14px', color: '#cbd5e1' },
  empty:       { padding: '40px', textAlign: 'center', color: '#cbd5e1', fontSize: '14px' },
  name:        { color: '#f1f5f9', fontWeight: '600' },

  badge:       { padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap' as const, display: 'inline-block' },
  badgeActivo:     { background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)' },
  badgeFinalizado: { background: 'rgba(148,163,184,0.1)', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.2)' },
  badgeCancelado:  { background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.2)' },

  btnFinalizar: { background: '#334155', border: 'none', borderRadius: '6px', padding: '5px 10px', color: '#cbd5e1', fontSize: '11px', fontWeight: '600', cursor: 'pointer' },
  btnCancelar:  { background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: '6px', padding: '5px 10px', color: '#f87171', fontSize: '11px', fontWeight: '600', cursor: 'pointer' },
}
