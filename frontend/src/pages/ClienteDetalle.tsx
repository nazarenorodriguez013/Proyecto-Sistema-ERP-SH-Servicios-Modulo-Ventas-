import { useState, useEffect } from 'react'
import type { User } from '../types'
import { API } from '../config'
import HistorialCliente, { type VentaCliente, type ServicioCliente, type MovimientoCliente } from '../components/HistorialCliente'
import ClienteFormModal from '../components/ClienteFormModal'
import { describirSaldo } from '../saldo'

interface ClienteFicha {
  id: number; nombre: string; documento: string | null; telefono: string | null
  email: string | null; direccion: string | null; condicionIva?: string
  ventas: VentaCliente[]; servicios: ServicioCliente[]; movimientos: MovimientoCliente[]; saldo: number
}


export default function ClienteDetalle({ clienteId, user, onBack }: { clienteId: number; user: User; onBack: () => void }) {
  const [cliente, setCliente] = useState<ClienteFicha | null>(null)
  const [editando, setEditando] = useState(false)
  const [confirmarBorrado, setConfirmarBorrado] = useState(false)
  const [confirmarBorrarVenta, setConfirmarBorrarVenta] = useState<number | null>(null)
  const [confirmarBorrarMovimiento, setConfirmarBorrarMovimiento] = useState<number | null>(null)
  const [confirmarBorrarServicio, setConfirmarBorrarServicio] = useState<number | null>(null)
  const [montoPago, setMontoPago] = useState('')
  const [error, setError] = useState('')
  const esAdmin = user.rol === 'ADMIN'

  const token = localStorage.getItem('token') ?? ''
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

  const fetchCliente = () =>
    fetch(`${API}/clients/${clienteId}`, { headers })
      .then(r => r.json())
      .then(setCliente)

  useEffect(() => { fetchCliente() }, [clienteId])

  const handlePago = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const res = await fetch(`${API}/clients/${clienteId}/movements`, {
      method: 'POST', headers, body: JSON.stringify({ monto: Number(montoPago) }),
    })
    if (!res.ok) {
      const data = await res.json()
      setError(data.message || 'No se pudo registrar el pago')
      return
    }
    setMontoPago(''); fetchCliente()
  }

  const handleDelete = async () => {
    const res = await fetch(`${API}/clients/${clienteId}`, { method: 'DELETE', headers })
    if (!res.ok) {
      const data = await res.json()
      setError(data.message || 'No se pudo eliminar el cliente')
      setConfirmarBorrado(false)
      return
    }
    onBack()
  }

  const handleDeleteVenta = async (ventaId: number) => {
    const res = await fetch(`${API}/sales/${ventaId}`, { method: 'DELETE', headers })
    if (!res.ok) {
      const data = await res.json()
      setError(data.message || 'No se pudo eliminar el comprobante')
    }
    setConfirmarBorrarVenta(null); fetchCliente()
  }

  const handleDeleteMovimiento = async (movementId: number) => {
    const res = await fetch(`${API}/clients/${clienteId}/movements/${movementId}`, { method: 'DELETE', headers })
    if (!res.ok) {
      const data = await res.json()
      setError(data.message || 'No se pudo eliminar el movimiento')
    }
    setConfirmarBorrarMovimiento(null); fetchCliente()
  }

  const handleDeleteServicio = async (servicioId: number) => {
    const res = await fetch(`${API}/repairs/${servicioId}`, { method: 'DELETE', headers })
    if (!res.ok) {
      const data = await res.json()
      setError(data.message || 'No se pudo eliminar el servicio técnico')
    }
    setConfirmarBorrarServicio(null); fetchCliente()
  }

  if (!cliente) return <div style={s.loading}>Cargando cliente...</div>

  return (
    <div className="page-container">
      <div style={s.header}>
        <div style={s.botones}>
          <button style={s.btnVolver} onClick={onBack}><i className="bi bi-arrow-left" /> Volver</button>
          <button style={s.btnVolver} onClick={() => setEditando(true)}><i className="bi bi-pencil" /> Editar</button>
          {esAdmin && (
            <button style={s.btnEliminar} onClick={() => { setError(''); setConfirmarBorrado(true) }}><i className="bi bi-trash" /> Eliminar</button>
          )}
        </div>
        <div style={s.saldoBox}>
          <span style={s.saldoLabel}>SALDO CUENTA CORRIENTE</span>
          <span style={{ ...s.saldoValor, color: describirSaldo(cliente.saldo).color }}>{describirSaldo(cliente.saldo).texto}</span>
        </div>
      </div>

      {error && <p style={s.errorText}><i className="bi bi-exclamation-triangle-fill" /> {error}</p>}

      <div style={s.card}>
        <h2 style={s.title}>{cliente.nombre}</h2>
        <div style={s.datosGrid}>
          <span style={s.dato}><i className="bi bi-file-earmark-text" /> {cliente.documento || '—'}</span>
          <span style={s.dato}><i className="bi bi-telephone" /> {cliente.telefono || '—'}</span>
          <span style={s.dato}><i className="bi bi-envelope" /> {cliente.email || '—'}</span>
          <span style={s.dato}><i className="bi bi-geo-alt" /> {cliente.direccion || '—'}</span>
        </div>
      </div>

      <div style={s.card}>
        <p style={s.sectionTitle}>Cuenta corriente</p>
        <form onSubmit={handlePago} style={s.form}>
          <input style={s.inputMonto} type="number" min="0.01" step="0.01" placeholder="Monto" value={montoPago}
            onChange={e => setMontoPago(e.target.value)} required />
          <button type="submit" style={s.btnPrimary}>Registrar pago o anticipo</button>
        </form>
      </div>

      <div style={s.card}>
        <p style={s.sectionTitle}>Historial ({cliente.ventas.length + cliente.servicios.length + cliente.movimientos.filter(m => m.tipo === 'PAGO' || (!m.ventaId && !m.servicioId)).length})</p>
        <HistorialCliente cliente={cliente} esAdmin={esAdmin}
          onBorrarVenta={id => { setError(''); setConfirmarBorrarVenta(id) }}
          onBorrarServicio={id => { setError(''); setConfirmarBorrarServicio(id) }}
          onBorrarMovimiento={id => { setError(''); setConfirmarBorrarMovimiento(id) }} />
      </div>

      {editando && (
        <ClienteFormModal cliente={cliente} onClose={() => setEditando(false)} onSaved={() => { setEditando(false); fetchCliente() }} />
      )}

      {confirmarBorrado && (
        <div style={s.overlay}>
          <div className="page-modal">
            <h3 style={s.modalTitle}>Eliminar cliente</h3>
            <p style={s.texto}>¿Estás seguro? Si el cliente tiene compras, pagos o servicios registrados no se podrá eliminar.</p>
            <div style={s.modalActions}>
              <button style={s.btnVolver} onClick={() => setConfirmarBorrado(false)}>Cancelar</button>
              <button style={s.btnDanger} onClick={handleDelete}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {confirmarBorrarVenta !== null && (
        <div style={s.overlay}>
          <div className="page-modal">
            <h3 style={s.modalTitle}>Eliminar comprobante</h3>
            <p style={s.texto}>¿Estás seguro? Se devuelve el stock vendido y se saca la deuda que generó en la cuenta del cliente. No se puede deshacer.</p>
            <div style={s.modalActions}>
              <button style={s.btnVolver} onClick={() => setConfirmarBorrarVenta(null)}>Cancelar</button>
              <button style={s.btnDanger} onClick={() => handleDeleteVenta(confirmarBorrarVenta)}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {confirmarBorrarMovimiento !== null && (
        <div style={s.overlay}>
          <div className="page-modal">
            <h3 style={s.modalTitle}>Eliminar movimiento</h3>
            <p style={s.texto}>¿Estás seguro? Se recalcula el saldo de la cuenta sin este movimiento. No se puede deshacer.</p>
            <div style={s.modalActions}>
              <button style={s.btnVolver} onClick={() => setConfirmarBorrarMovimiento(null)}>Cancelar</button>
              <button style={s.btnDanger} onClick={() => handleDeleteMovimiento(confirmarBorrarMovimiento)}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {confirmarBorrarServicio !== null && (
        <div style={s.overlay}>
          <div className="page-modal">
            <h3 style={s.modalTitle}>Eliminar servicio técnico</h3>
            <p style={s.texto}>¿Estás seguro? Se devuelven al depósito los repuestos que tenía cargados y se saca la deuda que generó en la cuenta del cliente. No se puede deshacer.</p>
            <div style={s.modalActions}>
              <button style={s.btnVolver} onClick={() => setConfirmarBorrarServicio(null)}>Cancelar</button>
              <button style={s.btnDanger} onClick={() => handleDeleteServicio(confirmarBorrarServicio)}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  loading:      { color: '#6B6B6B', padding: '40px', textAlign: 'center' },
  header:       { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  botones:      { display: 'flex', gap: '8px', flexWrap: 'wrap' as const },
  btnVolver:    { background: '#FFFFFF', border: '1px solid #E2E4E8', borderRadius: '8px', color: '#333333', fontSize: '13px', padding: '8px 16px', cursor: 'pointer' },
  btnEliminar:  { background: 'rgba(198,64,47,0.08)', border: '1px solid rgba(198,64,47,0.2)', borderRadius: '8px', color: '#C6402F', fontSize: '13px', padding: '8px 16px', cursor: 'pointer' },
  btnDanger:    { background: '#C6402F', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' },
  overlay:      { position: 'fixed', inset: 0, background: 'rgba(17,17,17,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalTitle:   { color: '#111111', fontSize: '17px', fontWeight: '700', margin: '0 0 12px' },
  texto:        { color: '#6B6B6B', fontSize: '14px', margin: '0 0 24px' },
  modalActions: { display: 'flex', gap: '10px', justifyContent: 'flex-end' },
  saldoBox:     { display: 'flex', flexDirection: 'column', alignItems: 'flex-end' },
  saldoLabel:   { color: '#6B6B6B', fontSize: '11px', fontWeight: '700', letterSpacing: '1.5px' },
  saldoValor:   { fontSize: '26px', fontWeight: '800' },

  card:         { background: '#FFFFFF', border: '1px solid #E2E4E8', borderRadius: '12px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '10px' },
  title:        { color: '#111111', fontSize: '19px', fontWeight: '700', margin: 0 },
  datosGrid:    { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' },
  dato:         { color: '#333333', fontSize: '13px' },
  sectionTitle: { color: '#6B6B6B', fontSize: '11px', fontWeight: '700', letterSpacing: '1px', textTransform: 'uppercase' as const, margin: 0 },


  form:         { display: 'flex', gap: '8px', flexWrap: 'wrap' as const },
  inputMonto:   { width: '160px', background: '#FFFFFF', border: '1px solid #D3D3D3', borderRadius: '8px', padding: '9px 12px', color: '#111111', fontSize: '13px', outline: 'none' },
  btnPrimary:   { background: '#F5C400', color: '#111111', border: 'none', borderRadius: '8px', padding: '9px 18px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' },
  errorText:    { color: '#C6402F', fontSize: '13px', margin: 0 },

}
