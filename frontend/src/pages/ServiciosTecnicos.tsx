import { useState, useEffect } from 'react'
import type { User } from '../types'
import { API } from '../config'
import { socket } from '../socket'
import ClienteSelector from '../components/ClienteSelector'
import ServicioDetalle from './ServicioDetalle'
import { ESTADO_LABEL, ESTADO_COLOR, type Servicio, type EstadoServicio } from '../servicios'

interface Cliente { id: number; nombre: string; documento: string | null }
interface SolicitudForm { clienteId: string; equipo: string; descripcionFalla: string; repuestosSolicitados: string; enGarantia: boolean; costoManoObra: string }

const EMPTY_FORM: SolicitudForm = { clienteId: '', equipo: '', descripcionFalla: '', repuestosSolicitados: '', enGarantia: false, costoManoObra: '' }
type Filtro = 'curso' | 'all' | EstadoServicio
const FILTROS: Filtro[] = ['curso', 'PRESUPUESTADO', 'PENDIENTE', 'EN_REPARACION', 'REPARADO', 'ENTREGADO', 'RECHAZADO', 'all']
// Al técnico solo le llegan servicios ya asignados: no ve las etapas previas del presupuesto
const FILTROS_TECNICO: Filtro[] = ['EN_REPARACION', 'REPARADO', 'ENTREGADO']
const FILTRO_LABEL: Record<Filtro, string> = { curso: 'En curso', all: 'Todos', ...ESTADO_LABEL }
// "En curso" es todo lo que todavía requiere trabajo: ni entregado ni rechazado
const cumple = (filtro: Filtro, sv: Servicio) =>
  filtro === 'all' || (filtro === 'curso' ? sv.estado !== 'ENTREGADO' && sv.estado !== 'RECHAZADO' : sv.estado === filtro)
const fmtFecha = (d: string) => new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })

export default function ServiciosTecnicos({ user }: { user: User }) {
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  // Cada rol arranca viendo lo que tiene que hacer: el técnico, sus reparaciones; administración, lo que está en curso
  const [filter, setFilter] = useState<Filtro>(user.rol === 'TECNICO' ? 'EN_REPARACION' : 'curso')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<SolicitudForm>(EMPTY_FORM)
  const [error, setError] = useState('')
  const [verServicio, setVerServicio] = useState<number | null>(null)

  const token = localStorage.getItem('token') ?? ''
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
  const esAdministracion = user.rol !== 'TECNICO'

  const fetchAll = () =>
    fetch(`${API}/repairs`, { headers })
      .then(r => r.json())
      .then(data => { setServicios(data); setLoading(false) })

  useEffect(() => {
    fetchAll()
    if (esAdministracion) fetch(`${API}/clients`, { headers }).then(r => r.json()).then(setClientes)
    // El taller y administración ven los cambios de estado al instante
    socket.on('servicios-actualizados', fetchAll)
    return () => { socket.off('servicios-actualizados', fetchAll) }
  }, [])

  const openCreate = () => { setForm(EMPTY_FORM); setError(''); setModalOpen(true) }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.clienteId) { setError('Seleccioná o creá el cliente'); return }
    setError('')
    const res = await fetch(`${API}/repairs`, {
      method: 'POST', headers,
      body: JSON.stringify({
        clienteId: Number(form.clienteId), equipo: form.equipo, descripcionFalla: form.descripcionFalla,
        repuestosSolicitados: form.repuestosSolicitados || null,
        enGarantia: form.enGarantia, costoManoObra: Number(form.costoManoObra) || 0,
      }),
    })
    if (!res.ok) {
      const data = await res.json()
      setError(data.message || 'No se pudo registrar la solicitud')
      return
    }
    setModalOpen(false)
  }

  if (verServicio !== null) {
    return <ServicioDetalle servicioId={verServicio} user={user} onBack={() => setVerServicio(null)} />
  }

  if (loading) return <div style={s.loading}>Cargando servicios...</div>

  const filtered = servicios.filter(sv => cumple(filter, sv))

  return (
    <div className="page-container">
      <div className="page-header">
        <p style={s.subtitle}>
          {esAdministracion ? `${servicios.length} servicios registrados` : `${servicios.length} servicios asignados a vos`} · tocá un servicio para ver el detalle
        </p>
        {esAdministracion && <button style={s.btnPrimary} onClick={openCreate}><i className="bi bi-plus-lg" /> Nueva solicitud</button>}
      </div>

      <div style={s.tabs}>
        {(esAdministracion ? FILTROS : FILTROS_TECNICO).map(f => (
          <button key={f} style={{ ...s.tab, ...(filter === f ? s.tabActive : {}) }} onClick={() => setFilter(f)}>
            {FILTRO_LABEL[f]} ({servicios.filter(sv => cumple(f, sv)).length})
          </button>
        ))}
      </div>

      <div className="stock-table-wrap">
        <div style={s.thead}>
          <span style={{ ...s.th, width: '70px' }}>N°</span>
          <span style={{ ...s.th, flex: 1 }}>Equipo</span>
          <span className="stock-cat-col" style={{ ...s.th, width: '170px' }}>Cliente</span>
          <span className="stock-min-col" style={{ ...s.th, width: '130px' }}>Técnico</span>
          <span className="stock-min-col" style={{ ...s.th, width: '100px' }}>Ingreso</span>
          <span style={{ ...s.th, width: '120px', justifyContent: 'center' }}>Estado</span>
        </div>
        {filtered.length === 0
          ? <div style={s.empty}>No hay servicios para este filtro</div>
          : filtered.map(sv => (
            <div key={sv.id} style={s.row} onClick={() => setVerServicio(sv.id)}>
              <span style={{ ...s.td, width: '70px', fontFamily: 'monospace' }}>#{sv.id}</span>
              <span style={{ ...s.td, flex: 1, flexDirection: 'column', alignItems: 'flex-start' }}>
                <span style={s.name}>{sv.equipo}</span>
                <span style={s.falla}>{sv.descripcionFalla}</span>
              </span>
              <span className="stock-cat-col" style={{ ...s.td, width: '170px' }}>{sv.cliente.nombre}</span>
              <span className="stock-min-col" style={{ ...s.td, width: '130px' }}>{sv.tecnico?.nombre ?? '—'}</span>
              <span className="stock-min-col" style={{ ...s.td, width: '100px' }}>{fmtFecha(sv.fechaIngreso)}</span>
              <span style={{ ...s.td, width: '120px', justifyContent: 'center' }}>
                <span style={{ ...s.badge, ...ESTADO_COLOR[sv.estado] }}>{ESTADO_LABEL[sv.estado]}</span>
              </span>
            </div>
          ))
        }
      </div>

      {modalOpen && (
        <div style={s.overlay}>
          <div className="page-modal">
            <div style={s.modalHeader}>
              <h3 style={s.modalTitle}>Nueva solicitud de servicio</h3>
              <button style={s.closeBtn} onClick={() => setModalOpen(false)}><i className="bi bi-x-lg" /></button>
            </div>
            <form onSubmit={handleSubmit} style={s.form}>
              <div style={s.field}>
                <label style={s.label}>Cliente *</label>
                <ClienteSelector clientes={clientes} value={form.clienteId}
                  onChange={id => setForm(f => ({ ...f, clienteId: id }))}
                  onCreated={c => setClientes(prev => [...prev, c])} />
              </div>
              <div style={s.field}>
                <label style={s.label}>Equipo *</label>
                <input style={s.input} value={form.equipo} placeholder="Ej: Autoelevador Heli 2.5 Ton" required
                  onChange={e => setForm(f => ({ ...f, equipo: e.target.value }))} />
              </div>
              <div style={s.field}>
                <label style={s.label}>Descripción de la falla *</label>
                <textarea style={{ ...s.input, resize: 'vertical', minHeight: '70px' }} value={form.descripcionFalla} required
                  onChange={e => setForm(f => ({ ...f, descripcionFalla: e.target.value }))} />
              </div>
              <div style={s.field}>
                <label style={s.label}>Repuestos necesarios (opcional)</label>
                <textarea style={{ ...s.input, resize: 'vertical', minHeight: '50px' }} value={form.repuestosSolicitados}
                  placeholder="Ej: 2 filtros de aceite, junta de tapa de cilindro"
                  onChange={e => setForm(f => ({ ...f, repuestosSolicitados: e.target.value }))} />
              </div>
              <label style={s.checkLabel}>
                <input type="checkbox" checked={form.enGarantia}
                  onChange={e => setForm(f => ({ ...f, enGarantia: e.target.checked }))} />
                <span>Equipo en garantía (sin presupuesto ni costo para el cliente)</span>
              </label>
              {!form.enGarantia && (
                <div style={s.field}>
                  <label style={s.label}>Presupuesto de mano de obra *</label>
                  <input style={s.input} type="number" min="0.01" step="0.01" value={form.costoManoObra} required
                    onChange={e => setForm(f => ({ ...f, costoManoObra: e.target.value }))} />
                </div>
              )}
              {error && <p style={s.errorText}>{error}</p>}
              <div style={s.modalActions}>
                <button type="button" style={s.btnSecondary} onClick={() => setModalOpen(false)}>Cancelar</button>
                <button type="submit" style={s.btnPrimary}>Registrar solicitud</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  loading:      { color: '#6B6B6B', padding: '40px', textAlign: 'center' },
  subtitle:     { color: '#6B6B6B', fontSize: '13px', margin: 0 },

  tabs:         { display: 'flex', gap: '6px', flexWrap: 'wrap' as const },
  tab:          { background: '#FFFFFF', border: '1px solid #E2E4E8', borderRadius: '8px', padding: '7px 14px', color: '#6B6B6B', fontSize: '12px', fontWeight: '500', cursor: 'pointer' },
  tabActive:    { background: '#111111', border: '1px solid #111111', color: '#F5C400', fontWeight: '600' },

  thead:        { display: 'flex', alignItems: 'center', padding: '10px 16px', background: '#FAFBFC', borderBottom: '2px solid #E7E9ED' },
  th:           { color: '#6B6B6B', fontSize: '11px', fontWeight: '700', letterSpacing: '0.8px', textTransform: 'uppercase' as const, display: 'flex', alignItems: 'center' },
  row:          { display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #EFF1F4', background: '#FFFFFF', cursor: 'pointer' },
  td:           { display: 'flex', alignItems: 'center', fontSize: '14px', color: '#333333' },
  name:         { color: '#111111', fontWeight: '600' },
  falla:        { color: '#6B6B6B', fontSize: '12px', marginTop: '2px' },
  empty:        { padding: '40px', textAlign: 'center', color: '#6B6B6B', fontSize: '14px' },
  badge:        { padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap' as const },

  btnPrimary:   { background: '#F5C400', color: '#111111', border: 'none', borderRadius: '8px', padding: '9px 18px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' },
  btnSecondary: { background: '#FFFFFF', color: '#6B6B6B', border: '1px solid #E2E4E8', borderRadius: '8px', padding: '9px 18px', fontWeight: '600', fontSize: '13px', cursor: 'pointer' },
  overlay:      { position: 'fixed', inset: 0, background: 'rgba(17,17,17,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalHeader:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  modalTitle:   { color: '#111111', fontSize: '17px', fontWeight: '700', margin: 0 },
  closeBtn:     { background: 'transparent', border: 'none', color: '#6B6B6B', fontSize: '18px', cursor: 'pointer' },
  form:         { display: 'flex', flexDirection: 'column', gap: '14px' },
  field:        { display: 'flex', flexDirection: 'column', gap: '6px' },
  label:        { color: '#333333', fontSize: '11px', fontWeight: '600', letterSpacing: '0.5px' },
  input:        { background: '#FFFFFF', border: '1px solid #D3D3D3', borderRadius: '8px', padding: '10px 14px', color: '#111111', fontSize: '14px', outline: 'none', width: '100%', boxSizing: 'border-box' as const },
  checkLabel:   { display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', color: '#333333', fontSize: '13px' },
  errorText:    { color: '#C6402F', fontSize: '13px', margin: 0 },
  modalActions: { display: 'flex', gap: '10px', justifyContent: 'flex-end' },
}
