import { useState } from 'react'
import { API } from '../config'

const CONDICIONES_IVA = ['Consumidor Final', 'Responsable Inscripto', 'Monotributo', 'IVA Exento', 'No Responsable']

export interface ClienteDatos {
  id: number; nombre: string; documento: string | null; telefono: string | null
  email: string | null; direccion: string | null; condicionIva?: string
}

// Un solo formulario de cliente para crear (desde Clientes, Punto de Venta o Servicios) y para editar
export default function ClienteFormModal({ cliente, onClose, onSaved }: {
  cliente?: ClienteDatos
  onClose: () => void
  onSaved: (cliente: ClienteDatos) => void
}) {
  const [form, setForm] = useState({
    nombre: cliente?.nombre ?? '', documento: cliente?.documento ?? '', telefono: cliente?.telefono ?? '',
    email: cliente?.email ?? '', direccion: cliente?.direccion ?? '',
    condicionIva: cliente?.condicionIva ?? 'Consumidor Final',
  })
  const [error, setError] = useState('')

  const campo = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [key]: e.target.value })),
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    // Los campos vacíos se mandan como null para poder borrarlos al editar
    const body = JSON.stringify({
      nombre: form.nombre, documento: form.documento || null, telefono: form.telefono || null,
      email: form.email || null, direccion: form.direccion || null, condicionIva: form.condicionIva,
    })
    const res = await fetch(cliente ? `${API}/clients/${cliente.id}` : `${API}/clients`, {
      method: cliente ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` },
      body,
    })
    const data = await res.json()
    if (!res.ok) { setError(data.message || 'Error al guardar el cliente'); return }
    onSaved(data)
  }

  return (
    <div style={s.overlay}>
      <div className="page-modal">
        <div style={s.modalHeader}>
          <h3 style={s.modalTitle}>{cliente ? 'Editar cliente' : 'Nuevo cliente'}</h3>
          <button style={s.closeBtn} onClick={onClose}><i className="bi bi-x-lg" /></button>
        </div>
        <form onSubmit={handleSubmit} style={s.form}>
          <div style={s.field}>
            <label style={s.label}>Nombre *</label>
            <input style={s.input} {...campo('nombre')} required autoFocus />
          </div>
          <div style={s.row}>
            <div style={s.field}>
              <label style={s.label}>Teléfono</label>
              <input style={s.input} {...campo('telefono')} />
            </div>
            <div style={s.field}>
              <label style={s.label}>Documento</label>
              <input style={s.input} {...campo('documento')} />
            </div>
          </div>
          <div style={s.field}>
            <label style={s.label}>Email</label>
            <input style={s.input} type="email" {...campo('email')} />
          </div>
          <div style={s.field}>
            <label style={s.label}>Condición frente al IVA</label>
            <select style={s.input} value={form.condicionIva} onChange={e => setForm(f => ({ ...f, condicionIva: e.target.value }))}>
              {CONDICIONES_IVA.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={s.field}>
            <label style={s.label}>Dirección</label>
            <input style={s.input} {...campo('direccion')} />
          </div>
          {error && <p style={s.errorText}>{error}</p>}
          <div style={s.modalActions}>
            <button type="button" style={s.btnSecondary} onClick={onClose}>Cancelar</button>
            <button type="submit" style={s.btnPrimary}>{cliente ? 'Guardar cambios' : 'Crear cliente'}</button>
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
  row:          { display: 'flex', gap: '10px' },
  field:        { display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 },
  label:        { color: '#333333', fontSize: '11px', fontWeight: '600', letterSpacing: '0.5px' },
  input:        { background: '#FFFFFF', border: '1px solid #D3D3D3', borderRadius: '8px', padding: '10px 14px', color: '#111111', fontSize: '14px', outline: 'none', width: '100%', boxSizing: 'border-box' as const },
  errorText:    { color: '#C6402F', fontSize: '13px', margin: 0 },
  modalActions: { display: 'flex', gap: '10px', justifyContent: 'flex-end' },
  btnPrimary:   { background: '#F5C400', color: '#111111', border: 'none', borderRadius: '8px', padding: '9px 18px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' },
  btnSecondary: { background: '#FFFFFF', color: '#6B6B6B', border: '1px solid #E2E4E8', borderRadius: '8px', padding: '9px 18px', fontWeight: '600', fontSize: '13px', cursor: 'pointer' },
}
