import { useState, useEffect } from 'react'
import type { User } from '../types'
import { API } from '../config'
import { socket } from '../socket'
import ClienteSelector from '../components/ClienteSelector'
import ServicioTicket from '../components/ServicioTicket'
import ServicioDetalle from './ServicioDetalle'
import { ESTADO_LABEL, ESTADO_COLOR, ESTADO_RETIRO_LABEL, ESTADO_RETIRO_COLOR, type Servicio } from '../servicios'

interface Cliente { id: number; nombre: string; documento: string | null }
interface Tecnico { id: number; nombre: string }
interface Producto { id: number; codigo: string | null; nombre: string; tipoProducto: 'REPUESTO' | 'MAQUINARIA'; precio: number; stock: number; activo: boolean }
interface RepuestoForm { producto: Producto; cantidad: number }

const EMPTY_FORM = {
  clienteId: '', tecnicoId: '', equipo: '', descripcionFalla: '', tareas: '',
  enGarantia: false, costoManoObra: '', fechaEstimadaFin: '',
}
const fmtFecha = (d: string) => new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })

export default function ServiciosTecnicos({ user }: { user: User }) {
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(EMPTY_FORM)
  const [repuestos, setRepuestos] = useState<RepuestoForm[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [error, setError] = useState('')
  const [ticket, setTicket] = useState<{ modo: 'presupuesto' | 'retiro'; servicio: Servicio } | null>(null)
  const [verServicio, setVerServicio] = useState<number | null>(null)

  const token = localStorage.getItem('token') ?? ''
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
  const esAdministracion = user.rol !== 'TECNICO'

  const fetchAll = () => fetch(`${API}/repairs`, { headers }).then(r => r.json()).then(data => { setServicios(data); setLoading(false) })

  useEffect(() => {
    fetchAll()
    if (esAdministracion) {
      fetch(`${API}/clients`, { headers }).then(r => r.json()).then(setClientes)
      fetch(`${API}/technicians`, { headers }).then(r => r.json()).then(setTecnicos)
      fetch(`${API}/products`, { headers }).then(r => r.json()).then(setProductos)
    }
    socket.on('servicios-actualizados', fetchAll)
    return () => { socket.off('servicios-actualizados', fetchAll) }
  }, [])

  const q = busqueda.trim().toLowerCase()
  const sugerencias = q
    ? productos.filter(p => p.activo && p.stock > 0 && p.tipoProducto === 'REPUESTO' && (p.nombre.toLowerCase().includes(q) || p.codigo?.toLowerCase().includes(q))).slice(0, 6)
    : []

  const agregarRepuesto = (producto: Producto) => {
    setRepuestos(prev => prev.some(r => r.producto.id === producto.id)
      ? prev.map(r => r.producto.id === producto.id ? { ...r, cantidad: Math.min(r.cantidad + 1, producto.stock) } : r)
      : [...prev, { producto, cantidad: 1 }])
    setBusqueda('')
  }
  const cambiarCantidadRepuesto = (idx: number, delta: number) =>
    setRepuestos(prev => { const c = [...prev]; const n = Math.max(1, Math.min(c[idx].cantidad + delta, c[idx].producto.stock)); c[idx] = { ...c[idx], cantidad: n }; return c })
  const quitarRepuesto = (idx: number) => setRepuestos(prev => prev.filter((_, i) => i !== idx))

  const limpiarForm = () => { setForm(EMPTY_FORM); setRepuestos([]); setBusqueda('') }

  const armarPayload = () => ({
    clienteId: Number(form.clienteId), tecnicoId: form.tecnicoId ? Number(form.tecnicoId) : null,
    equipo: form.equipo, descripcionFalla: form.descripcionFalla, tareas: form.tareas || null,
    enGarantia: form.enGarantia, costoManoObra: Number(form.costoManoObra) || 0,
    fechaEstimadaFin: form.fechaEstimadaFin || null,
    repuestos: repuestos.map(r => ({ productoId: r.producto.id, cantidad: r.cantidad })),
  })

  const generarPresupuesto = async () => {
    if (!form.clienteId) { setError('Seleccioná el cliente'); return }
    setError('')
    const res = await fetch(`${API}/repairs/presupuesto`, { method: 'POST', headers, body: JSON.stringify(armarPayload()) })
    const data = await res.json()
    if (!res.ok) { setError(data.message || 'No se pudo generar el presupuesto'); return }
    setTicket({ modo: 'presupuesto', servicio: data })
  }

  const crearServicio = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.clienteId) { setError('Seleccioná el cliente'); return }
    setError('')
    const res = await fetch(`${API}/repairs`, { method: 'POST', headers, body: JSON.stringify(armarPayload()) })
    const data = await res.json()
    if (!res.ok) { setError(data.message || 'No se pudo crear el servicio'); return }
    limpiarForm()
    if (data.repuestos.length > 0) setTicket({ modo: 'retiro', servicio: data })
  }

  if (verServicio !== null) return <ServicioDetalle servicioId={verServicio} user={user} onBack={() => setVerServicio(null)} />
  if (loading) return <div style={s.loading}>Cargando servicios...</div>

  const enCurso = servicios.filter(sv => sv.estado === 'EN_CURSO')

  const listaServicios = (
    <div style={s.card}>
      <p style={s.sectionTitle}>
        {esAdministracion ? `Servicios en curso (${enCurso.length})` : `Tus servicios asignados (${enCurso.length})`}
      </p>
      <div style={s.lista}>
        {enCurso.length === 0
          ? <div style={s.empty}>No hay servicios en curso</div>
          : enCurso.map(sv => (
            <div key={sv.id} style={s.svRow} onClick={() => setVerServicio(sv.id!)}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={s.svEquipo}>{sv.equipo}{!sv.tecnico && <span style={s.badgeSinTecnico}>Sin técnico</span>}</p>
                <p style={s.svFalla}>{sv.cliente.nombre} · {sv.descripcionFalla}</p>
              </div>
              <div style={s.svMeta}>
                <span style={s.svFecha}>{sv.tecnico?.nombre ?? '—'} · {fmtFecha(sv.fechaIngreso)}</span>
                {sv.estadoRetiro && <span style={{ ...s.badge, ...ESTADO_RETIRO_COLOR[sv.estadoRetiro] }}>{ESTADO_RETIRO_LABEL[sv.estadoRetiro]}</span>}
                <span style={{ ...s.badge, ...ESTADO_COLOR[sv.estado] }}>{ESTADO_LABEL[sv.estado]}</span>
              </div>
            </div>
          ))
        }
      </div>
    </div>
  )

  return (
    <div style={s.wrap}>
      <div style={esAdministracion ? s.grid : s.gridSolo}>
        {esAdministracion && (
          <form onSubmit={crearServicio} style={{ ...s.card, ...s.formCard }}>
            <p style={s.sectionTitle}>Nuevo servicio</p>
            <div style={s.row3}>
              <div style={s.field}>
                <label style={s.label}>Cliente *</label>
                <ClienteSelector clientes={clientes} value={form.clienteId}
                  onChange={id => setForm(f => ({ ...f, clienteId: id }))}
                  onCreated={c => setClientes(prev => [...prev, c])} />
              </div>
              <div style={s.field}>
                <label style={s.label}>Técnico (opcional)</label>
                <select style={s.input} value={form.tecnicoId} onChange={e => setForm(f => ({ ...f, tecnicoId: e.target.value }))}>
                  <option value="">Sin asignar todavía</option>
                  {tecnicos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </div>
              <div style={s.field}>
                <label style={s.label}>Fin estimado</label>
                <input style={s.input} type="date" value={form.fechaEstimadaFin}
                  onChange={e => setForm(f => ({ ...f, fechaEstimadaFin: e.target.value }))} />
              </div>
            </div>
            <div style={s.row2}>
              <div style={s.field}>
                <label style={s.label}>Equipo *</label>
                <input style={s.input} value={form.equipo} required placeholder="Ej: Autoelevador Heli 2.5 Ton"
                  onChange={e => setForm(f => ({ ...f, equipo: e.target.value }))} />
              </div>
              <div style={s.field}>
                <label style={s.label}>Mano de obra estimada</label>
                <div style={s.manoObra}>
                  <input style={{ ...s.input, ...(form.enGarantia ? s.inputOff : {}) }} type="number" min="0" step="0.01"
                    value={form.enGarantia ? '' : form.costoManoObra} disabled={form.enGarantia}
                    onChange={e => setForm(f => ({ ...f, costoManoObra: e.target.value }))} />
                  <label style={s.checkLabel}>
                    <input type="checkbox" checked={form.enGarantia} onChange={e => setForm(f => ({ ...f, enGarantia: e.target.checked }))} />
                    <span>En garantía</span>
                  </label>
                </div>
              </div>
            </div>
            <div style={s.row2}>
              <div style={s.field}>
                <label style={s.label}>Descripción de la falla *</label>
                <textarea style={s.textarea} value={form.descripcionFalla} required
                  onChange={e => setForm(f => ({ ...f, descripcionFalla: e.target.value }))} />
              </div>
              <div style={s.field}>
                <label style={s.label}>Tareas a realizar</label>
                <textarea style={s.textarea} value={form.tareas} placeholder="Ej: Cambiar filtros, purgar circuito"
                  onChange={e => setForm(f => ({ ...f, tareas: e.target.value }))} />
              </div>
            </div>

            <div style={{ ...s.field, flex: 1, minHeight: 0 }}>
              <label style={s.label}>Repuestos a utilizar (opcional)</label>
              <div style={{ position: 'relative' }}>
                <input style={s.input} value={busqueda} placeholder="Buscar repuesto por nombre o código..."
                  onChange={e => setBusqueda(e.target.value)} />
                {sugerencias.length > 0 && (
                  <div style={s.dropdown}>
                    {sugerencias.map(p => (
                      <div key={p.id} style={s.dropItem} onMouseDown={() => agregarRepuesto(p)}>
                        <span style={s.dropNom}>{p.nombre}</span>
                        <span style={s.dropStock}>stock {p.stock}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={s.repLista}>
                {repuestos.map((r, idx) => (
                  <div key={r.producto.id} style={s.repRow}>
                    <span style={s.repNombre}>{r.producto.nombre}</span>
                    <div style={s.cantControl}>
                      <button type="button" style={s.cantBtn} onClick={() => cambiarCantidadRepuesto(idx, -1)}>−</button>
                      <span style={s.cantValor}>{r.cantidad}</span>
                      <button type="button" style={s.cantBtn} onClick={() => cambiarCantidadRepuesto(idx, 1)}>+</button>
                    </div>
                    <button type="button" style={s.btnX} onClick={() => quitarRepuesto(idx)}><i className="bi bi-x-lg" /></button>
                  </div>
                ))}
              </div>
            </div>

            {error && <p style={s.errorText}>{error}</p>}
            <div style={s.modalActions}>
              <button type="button" style={s.btnSecondary} onClick={generarPresupuesto}><i className="bi bi-printer" /> Generar presupuesto</button>
              <button type="submit" style={s.btnPrimary}><i className="bi bi-check-lg" /> Crear servicio</button>
            </div>
          </form>
        )}

        {listaServicios}
      </div>

      {ticket && <ServicioTicket modo={ticket.modo} servicio={ticket.servicio} onClose={() => setTicket(null)} />}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  loading:      { color: '#6B6B6B', padding: '40px', textAlign: 'center' },
  wrap:         { padding: '16px 24px', height: '100%', boxSizing: 'border-box' as const, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  grid:         { display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)', gap: '16px', flex: 1, minHeight: 0 },
  gridSolo:     { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', flex: 1, minHeight: 0 },
  card:         { background: '#FFFFFF', border: '1px solid #E2E4E8', borderRadius: '12px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px', minHeight: 0, overflow: 'hidden' },
  formCard:     { gap: '10px' },
  sectionTitle: { color: '#6B6B6B', fontSize: '11px', fontWeight: '700', letterSpacing: '1px', textTransform: 'uppercase' as const, margin: 0 },
  row2:         { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' },
  row3:         { display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 0.8fr)', gap: '10px' },
  field:        { display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 },
  label:        { color: '#333333', fontSize: '11px', fontWeight: '600', letterSpacing: '0.5px' },
  input:        { background: '#FFFFFF', border: '1px solid #D3D3D3', borderRadius: '8px', padding: '8px 12px', color: '#111111', fontSize: '13px', outline: 'none', width: '100%', boxSizing: 'border-box' as const },
  inputOff:     { background: '#F5F5F5', color: '#9A9A9A' },
  textarea:     { background: '#FFFFFF', border: '1px solid #D3D3D3', borderRadius: '8px', padding: '8px 12px', color: '#111111', fontSize: '13px', outline: 'none', width: '100%', boxSizing: 'border-box' as const, resize: 'none', height: '56px', fontFamily: 'inherit' },
  manoObra:     { display: 'flex', alignItems: 'center', gap: '10px' },
  checkLabel:   { display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: '#333333', fontSize: '12px', whiteSpace: 'nowrap' as const },
  errorText:    { color: '#C6402F', fontSize: '13px', margin: 0 },
  modalActions: { display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' as const },
  btnPrimary:   { background: '#F5C400', color: '#111111', border: 'none', borderRadius: '8px', padding: '9px 18px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' },
  btnSecondary: { background: '#FFFFFF', color: '#333333', border: '1px solid #E2E4E8', borderRadius: '8px', padding: '9px 18px', fontWeight: '600', fontSize: '13px', cursor: 'pointer' },

  dropdown:     { position: 'absolute', top: '100%', left: 0, right: 0, background: '#FFFFFF', border: '1px solid #E2E4E8', borderRadius: '10px', zIndex: 100, marginTop: '4px', overflow: 'hidden', boxShadow: '0 8px 24px rgba(17,17,17,.18)' },
  dropItem:     { display: 'flex', justifyContent: 'space-between', gap: '10px', padding: '9px 14px', cursor: 'pointer', borderBottom: '1px solid #EFF1F4' },
  dropNom:      { color: '#111111', fontSize: '13px', fontWeight: '600' },
  dropStock:    { color: '#6B6B6B', fontSize: '12px' },

  repLista:     { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflowY: 'auto' as const },
  repRow:       { display: 'flex', alignItems: 'center', gap: '10px', padding: '5px 4px', borderBottom: '1px solid #EFF1F4' },
  repNombre:    { flex: 1, color: '#111111', fontSize: '13px', fontWeight: '600' },
  cantControl:  { display: 'flex', alignItems: 'center', gap: '6px' },
  cantBtn:      { width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFFFFF', border: '1px solid #D3D3D3', borderRadius: '6px', color: '#111111', fontSize: '14px', fontWeight: '700', cursor: 'pointer', padding: 0, lineHeight: 1 },
  cantValor:    { minWidth: '20px', textAlign: 'center' as const, color: '#111111', fontSize: '13px', fontWeight: '600' },
  btnX:         { background: 'transparent', border: 'none', color: '#6B6B6B', cursor: 'pointer', fontSize: '13px', padding: '4px 6px' },

  lista:        { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflowY: 'auto' as const },
  empty:        { color: '#6B6B6B', fontSize: '13px', textAlign: 'center', padding: '20px' },
  svRow:        { display: 'flex', flexDirection: 'column', gap: '6px', padding: '10px 4px', borderBottom: '1px solid #EFF1F4', cursor: 'pointer' },
  svEquipo:     { color: '#111111', fontSize: '14px', fontWeight: '600', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' },
  svFalla:      { color: '#6B6B6B', fontSize: '12px', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  svMeta:       { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' as const },
  svFecha:      { color: '#6B6B6B', fontSize: '12px' },
  badge:        { padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap' as const },
  badgeSinTecnico: { background: '#FBE5E2', color: '#C6402F', border: '1px solid rgba(198,64,47,0.2)', borderRadius: '20px', padding: '2px 8px', fontSize: '10px', fontWeight: '700' },
}
