import { useState } from 'react'
import { API } from '../config'
import ClienteSelector from './ClienteSelector'
import type { ClienteDatos } from './ClienteFormModal'

interface Cliente { id: number; nombre: string; documento: string | null }

// Pedido rápido desde el punto de venta: solo cliente + nota. Sin técnico ni repuestos todavía;
// queda pendiente de asignar en Servicios Técnicos
export default function SolicitarServicioModal({ clientes, onClose, onCreated }: {
  clientes: Cliente[]
  onClose: () => void
  onCreated: () => void
}) {
  const [clientesLocal, setClientesLocal] = useState(clientes)
  const [clienteId, setClienteId] = useState('')
  const [equipo, setEquipo] = useState('')
  const [nota, setNota] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clienteId) { setError('Seleccioná el cliente'); return }
    setError(''); setEnviando(true)
    const res = await fetch(`${API}/repairs`, {
      method: 'POST', headers,
      body: JSON.stringify({ clienteId: Number(clienteId), equipo, descripcionFalla: nota }),
    })
    setEnviando(false)
    if (!res.ok) {
      const data = await res.json()
      setError(data.message || 'No se pudo enviar la solicitud')
      return
    }
    onCreated()
  }

  return (
    <div style={s.overlay}>
      <div className="page-modal">
        <div style={s.modalHeader}>
          <h3 style={s.modalTitle}>Solicitar servicio técnico</h3>
          <button style={s.closeBtn} onClick={onClose}><i className="bi bi-x-lg" /></button>
        </div>
        <form onSubmit={handleSubmit} style={s.form}>
          <div style={s.field}>
            <label style={s.label}>Cliente *</label>
            <ClienteSelector clientes={clientesLocal} value={clienteId} onChange={setClienteId}
              onCreated={(c: ClienteDatos) => setClientesLocal(prev => [...prev, c])} />
          </div>
          <div style={s.field}>
            <label style={s.label}>Equipo / Vehículo *</label>
            <input style={s.input} value={equipo} onChange={e => setEquipo(e.target.value)}
              placeholder="Ej: Camioneta Hilux 2019" required autoFocus />
          </div>
          <div style={s.field}>
            <label style={s.label}>Qué hay que hacerle *</label>
            <textarea style={{ ...s.input, resize: 'vertical', minHeight: '70px' }} value={nota}
              onChange={e => setNota(e.target.value)} placeholder="Ej: Ruido en la suspensión trasera" required />
          </div>
          {error && <p style={s.errorText}>{error}</p>}
          <p style={s.nota}><i className="bi bi-info-circle" /> Queda en Servicios Técnicos como solicitud sin técnico asignado todavía.</p>
          <div style={s.modalActions}>
            <button type="button" style={s.btnSecondary} onClick={onClose}>Cancelar</button>
            <button type="submit" style={s.btnPrimary} disabled={enviando}>{enviando ? 'Enviando...' : 'Enviar solicitud'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  overlay:      { position: 'fixed', inset: 0, background: 'rgba(17,17,17,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 },
  modalHeader:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  modalTitle:   { color: '#111111', fontSize: '17px', fontWeight: '700', margin: 0 },
  closeBtn:     { background: 'transparent', border: 'none', color: '#6B6B6B', fontSize: '18px', cursor: 'pointer' },
  form:         { display: 'flex', flexDirection: 'column', gap: '16px' },
  field:        { display: 'flex', flexDirection: 'column', gap: '6px' },
  label:        { color: '#333333', fontSize: '11px', fontWeight: '600', letterSpacing: '0.5px' },
  input:        { background: '#FFFFFF', border: '1px solid #D3D3D3', borderRadius: '8px', padding: '10px 14px', color: '#111111', fontSize: '14px', outline: 'none', width: '100%', boxSizing: 'border-box' as const },
  errorText:    { color: '#C6402F', fontSize: '13px', margin: 0 },
  nota:         { color: '#6B6B6B', fontSize: '12px', margin: 0 },
  modalActions: { display: 'flex', gap: '10px', justifyContent: 'flex-end' },
  btnPrimary:   { background: '#F5C400', color: '#111111', border: 'none', borderRadius: '8px', padding: '9px 18px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' },
  btnSecondary: { background: '#FFFFFF', color: '#6B6B6B', border: '1px solid #E2E4E8', borderRadius: '8px', padding: '9px 18px', fontWeight: '600', fontSize: '13px', cursor: 'pointer' },
}
