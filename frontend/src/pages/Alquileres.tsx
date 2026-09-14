import { useState, useEffect } from 'react'
import type { User } from '../types'
import { API } from '../config'

interface Maquina { id: number; nombre: string; tarifaDiaria: number; stock: number; activo: boolean }
interface Cliente { id: number; nombre: string }
interface Alquiler {
  id: number; cliente: Cliente | null
  fechaInicio: string; fechaFin: string; total: number
  estado: 'ACTIVO' | 'FINALIZADO' | 'CANCELADO'
  maquina: Maquina
  usuario: { nombre: string }
  creadoEn: string
}
interface AlquilerForm { maquinaId: string; clienteId: string; fechaInicio: string; fechaFin: string }

const EMPTY_FORM: AlquilerForm = { maquinaId: '', clienteId: '', fechaInicio: '', fechaFin: '' }

const fmt = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
// Son fechas de calendario (sin hora): se formatean en UTC para que no varíen según la zona horaria del navegador
const fmtFecha = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })

const ESTADO_LABEL: Record<Alquiler['estado'], string> = {
  ACTIVO: 'Activo', FINALIZADO: 'Finalizado', CANCELADO: 'Cancelado',
}

export default function Alquileres({ user }: { user: User }) {
  const [alquileres, setAlquileres] = useState<Alquiler[]>([])
  const [maquinas, setMaquinas] = useState<Maquina[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'ACTIVO' | 'FINALIZADO' | 'CANCELADO'>('all')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<AlquilerForm>(EMPTY_FORM)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const token = localStorage.getItem('token') ?? ''
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
  const isAdmin = user.rol === 'ADMIN'

  const fetchAll = async () => {
    const [aRes, mRes, cRes] = await Promise.all([
      fetch(`${API}/rentals`, { headers }),
      fetch(`${API}/machines`, { headers }),
      fetch(`${API}/clients`, { headers }),
    ])
    setAlquileres(await aRes.json())
    setMaquinas(await mRes.json())
    setClientes(await cRes.json())
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  const openCreate = () => { setForm(EMPTY_FORM); setError(''); setModal(true) }
  const closeModal = () => setModal(false)

  const maquinaSel = maquinas.find(m => String(m.id) === form.maquinaId)
  const diasPreview = form.fechaInicio && form.fechaFin
    ? Math.max(1, Math.ceil((new Date(form.fechaFin).getTime() - new Date(form.fechaInicio).getTime()) / (1000 * 60 * 60 * 24)))
    : 0
  const totalPreview = maquinaSel && diasPreview ? diasPreview * maquinaSel.tarifaDiaria : 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setSaving(true)
    try {
      const res = await fetch(`${API}/rentals`, {
        method: 'POST', headers,
        body: JSON.stringify({
          maquinaId: Number(form.maquinaId),
          clienteId: form.clienteId ? Number(form.clienteId) : null,
          fechaInicio: form.fechaInicio,
          fechaFin: form.fechaFin,
        }),
      })
      if (!res.ok) { const data = await res.json(); throw new Error(data.message) }
      closeModal(); fetchAll()
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

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
          <p style={s.subtitle}>{alquileres.length} registrados · {activosCount} activos</p>
        </div>
        <button style={s.btnPrimary} onClick={openCreate}>+ Nuevo Alquiler</button>
      </div>

      {error && !modal && <div style={s.errorBanner}>⚠ {error}</div>}

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

      {/* Modal nuevo alquiler */}
      {modal && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <div style={s.modalHeader}>
              <h3 style={s.modalTitle}>Nuevo Alquiler</h3>
              <button style={s.closeBtn} onClick={closeModal}>✕</button>
            </div>
            <form onSubmit={handleSubmit} style={s.form}>
              {error && <div style={s.errorBanner}>⚠ {error}</div>}

              <div style={s.field}>
                <label style={s.label}>Máquina *</label>
                <select style={s.input} value={form.maquinaId}
                  onChange={e => setForm(f => ({ ...f, maquinaId: e.target.value }))} required>
                  <option value="">Seleccionar...</option>
                  {maquinas.filter(m => m.activo).map(m => (
                    <option key={m.id} value={m.id} disabled={m.stock < 1}>
                      {m.nombre} — ${fmt(m.tarifaDiaria)}/día {m.stock < 1 ? '(sin unidades)' : `(${m.stock} disp.)`}
                    </option>
                  ))}
                </select>
              </div>

              <div style={s.field}>
                <label style={s.label}>Cliente</label>
                <select style={s.input} value={form.clienteId}
                  onChange={e => setForm(f => ({ ...f, clienteId: e.target.value }))}>
                  <option value="">Sin cliente</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>

              <div style={s.formRow}>
                <div style={s.field}>
                  <label style={s.label}>Fecha de inicio *</label>
                  <input style={s.input} type="date" value={form.fechaInicio}
                    onChange={e => setForm(f => ({ ...f, fechaInicio: e.target.value }))} required />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Fecha de fin *</label>
                  <input style={s.input} type="date" value={form.fechaFin}
                    onChange={e => setForm(f => ({ ...f, fechaFin: e.target.value }))} required />
                </div>
              </div>

              {totalPreview > 0 && (
                <div style={s.preview}>
                  <span style={{ color: '#94a3b8', fontSize: '13px' }}>{diasPreview} día(s) —</span>
                  <span style={{ color: '#eab308', fontWeight: '700', fontSize: '15px' }}>Total estimado: ${fmt(totalPreview)}</span>
                </div>
              )}

              <div style={s.modalActions}>
                <button type="button" style={s.btnSecondary} onClick={closeModal}>Cancelar</button>
                <button type="submit" style={s.btnPrimary} disabled={saving}>
                  {saving ? 'Guardando...' : 'Registrar alquiler'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
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

  btnPrimary:   { background: '#eab308', color: '#0f172a', border: 'none', borderRadius: '8px', padding: '9px 18px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' },
  btnSecondary: { background: 'transparent', color: '#94a3b8', border: '1px solid #334155', borderRadius: '8px', padding: '9px 18px', fontWeight: '600', fontSize: '13px', cursor: 'pointer' },

  overlay:     { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal:       { background: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  modalTitle:  { color: '#f1f5f9', fontSize: '17px', fontWeight: '700', margin: 0 },
  closeBtn:    { background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '18px', cursor: 'pointer' },
  form:        { display: 'flex', flexDirection: 'column', gap: '14px' },
  formRow:     { display: 'flex', gap: '10px' },
  field:       { display: 'flex', flexDirection: 'column', gap: '5px', flex: 1 },
  label:       { color: '#94a3b8', fontSize: '11px', fontWeight: '600', letterSpacing: '0.5px' },
  input:       { background: '#0f172a', border: '1px solid #334155', borderRadius: '7px', padding: '9px 12px', color: '#f1f5f9', fontSize: '13px', outline: 'none', width: '100%', boxSizing: 'border-box' as const },
  preview:     { display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 12px', background: 'rgba(234,179,8,0.05)', border: '1px solid rgba(234,179,8,0.15)', borderRadius: '7px' },
  modalActions:{ display: 'flex', gap: '10px', justifyContent: 'flex-end' },
}
