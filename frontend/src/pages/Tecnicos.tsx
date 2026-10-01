import { useState, useEffect } from 'react'
import { API } from '../config'

interface Tecnico { id: number; nombre: string; correo: string; _count: { serviciosAsignados: number } }

const EMPTY_FORM = { nombre: '', correo: '', contrasena: '' }

// ABM de los usuarios con rol Técnico; solo lo usa el administrador
export default function Tecnicos() {
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([])
  const [modal, setModal] = useState<{ open: boolean; editing: Tecnico | null }>({ open: false, editing: null })
  const [form, setForm] = useState(EMPTY_FORM)
  const [deleteConfirm, setDeleteConfirm] = useState<Tecnico | null>(null)
  const [error, setError] = useState('')

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` }

  const fetchAll = () => fetch(`${API}/technicians`, { headers }).then(r => r.json()).then(setTecnicos)

  useEffect(() => { fetchAll() }, [])

  const openCreate = () => { setForm(EMPTY_FORM); setError(''); setModal({ open: true, editing: null }) }
  const openEdit = (t: Tecnico) => { setForm({ nombre: t.nombre, correo: t.correo, contrasena: '' }); setError(''); setModal({ open: true, editing: t }) }
  const closeModal = () => setModal({ open: false, editing: null })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const res = await fetch(modal.editing ? `${API}/technicians/${modal.editing.id}` : `${API}/technicians`, {
      method: modal.editing ? 'PUT' : 'POST', headers, body: JSON.stringify(form),
    })
    if (!res.ok) {
      const data = await res.json()
      setError(data.message || 'No se pudo guardar el técnico')
      return
    }
    closeModal(); fetchAll()
  }

  const handleDelete = async (id: number) => {
    const res = await fetch(`${API}/technicians/${id}`, { method: 'DELETE', headers })
    if (!res.ok) {
      const data = await res.json()
      setError(data.message || 'No se pudo eliminar el técnico')
    }
    setDeleteConfirm(null); fetchAll()
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <p style={s.subtitle}>{tecnicos.length} técnicos · entran al sistema con su correo y solo ven los servicios que tienen asignados</p>
        <button style={s.btnPrimary} onClick={openCreate}><i className="bi bi-plus-lg" /> Nuevo técnico</button>
      </div>

      {error && !modal.open && <div style={s.errorBanner}><i className="bi bi-exclamation-triangle-fill" /> {error}</div>}

      {tecnicos.length === 0
        ? <div style={s.empty}>Todavía no hay técnicos cargados</div>
        : (
          <div className="page-grid-2">
            {tecnicos.map(t => (
              <div key={t.id} style={s.card}>
                <div style={s.cardIcon}><i className="bi bi-wrench" /></div>
                <div style={s.cardBody}>
                  <p style={s.cardName}>{t.nombre}</p>
                  <p style={s.cardSub}>{t.correo} · {t._count.serviciosAsignados} servicios asignados</p>
                </div>
                <button style={s.btnIcon} onClick={() => openEdit(t)} title="Editar"><i className="bi bi-pencil" /></button>
                <button style={s.btnIconDanger} onClick={() => { setError(''); setDeleteConfirm(t) }} title="Eliminar"><i className="bi bi-trash" /></button>
              </div>
            ))}
          </div>
        )
      }

      {modal.open && (
        <div style={s.overlay}>
          <div className="page-modal">
            <div style={s.modalHeader}>
              <h3 style={{ ...s.modalTitle, margin: 0 }}>{modal.editing ? 'Editar técnico' : 'Nuevo técnico'}</h3>
              <button style={s.closeBtn} onClick={closeModal}><i className="bi bi-x-lg" /></button>
            </div>
            <form onSubmit={handleSubmit} style={s.form}>
              <div style={s.field}>
                <label style={s.label}>Nombre *</label>
                <input style={s.input} value={form.nombre} required autoFocus
                  onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
              </div>
              <div style={s.field}>
                <label style={s.label}>Correo (usuario para entrar) *</label>
                <input style={s.input} type="email" value={form.correo} required
                  onChange={e => setForm(f => ({ ...f, correo: e.target.value }))} />
              </div>
              <div style={s.field}>
                <label style={s.label}>{modal.editing ? 'Nueva contraseña (dejar vacío para no cambiarla)' : 'Contraseña *'}</label>
                <input style={s.input} type="password" value={form.contrasena} pattern="(?=.*[A-ZÁÉÍÓÚÑ])(?=.*[0-9]).{8,}" title="Al menos 8 caracteres, una mayúscula y un número" required={!modal.editing}
                  onChange={e => setForm(f => ({ ...f, contrasena: e.target.value }))} />
              </div>
              {error && <p style={s.errorText}>{error}</p>}
              <div style={s.modalActions}>
                <button type="button" style={s.btnSecondary} onClick={closeModal}>Cancelar</button>
                <button type="submit" style={s.btnPrimary}>{modal.editing ? 'Guardar cambios' : 'Crear técnico'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div style={s.overlay}>
          <div className="page-modal">
            <h3 style={s.modalTitle}>Eliminar técnico</h3>
            <p style={s.texto}>¿Eliminar a {deleteConfirm.nombre}? Si tiene servicios asignados no se podrá eliminar: reasigná esos servicios primero.</p>
            <div style={s.modalActions}>
              <button style={s.btnSecondary} onClick={() => setDeleteConfirm(null)}>Cancelar</button>
              <button style={s.btnDanger} onClick={() => handleDelete(deleteConfirm.id)}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  subtitle:     { color: '#6B6B6B', fontSize: '13px', margin: 0 },
  errorBanner:  { background: 'rgba(198,64,47,0.1)', border: '1px solid rgba(198,64,47,0.3)', color: '#C6402F', padding: '12px 16px', borderRadius: '8px', fontSize: '14px' },
  empty:        { color: '#6B6B6B', textAlign: 'center', padding: '60px', background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E4E8' },
  card:         { background: '#FFFFFF', border: '1px solid #E2E4E8', borderRadius: '12px', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' },
  cardIcon:     { fontSize: '18px', flexShrink: 0, width: '40px', height: '40px', background: '#F5F5F5', color: '#111111', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  cardBody:     { flex: 1, minWidth: 0 },
  cardName:     { color: '#111111', fontWeight: '600', fontSize: '14px', margin: 0 },
  cardSub:      { color: '#6B6B6B', fontSize: '12px', margin: '3px 0 0' },
  btnIcon:      { background: '#FFFFFF', border: '1px solid #E2E4E8', borderRadius: '7px', padding: '7px 10px', cursor: 'pointer', fontSize: '13px', color: '#111111' },
  btnIconDanger:{ background: 'rgba(198,64,47,0.08)', border: '1px solid rgba(198,64,47,0.2)', borderRadius: '7px', padding: '7px 10px', cursor: 'pointer', fontSize: '13px', color: '#C6402F' },

  btnPrimary:   { background: '#F5C400', color: '#111111', border: 'none', borderRadius: '8px', padding: '9px 18px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' },
  btnSecondary: { background: '#FFFFFF', color: '#6B6B6B', border: '1px solid #E2E4E8', borderRadius: '8px', padding: '9px 18px', fontWeight: '600', fontSize: '13px', cursor: 'pointer' },
  btnDanger:    { background: '#C6402F', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' },
  overlay:      { position: 'fixed', inset: 0, background: 'rgba(17,17,17,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalHeader:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  modalTitle:   { color: '#111111', fontSize: '17px', fontWeight: '700', margin: '0 0 12px' },
  closeBtn:     { background: 'transparent', border: 'none', color: '#6B6B6B', fontSize: '18px', cursor: 'pointer' },
  texto:        { color: '#6B6B6B', fontSize: '14px', margin: '0 0 24px' },
  form:         { display: 'flex', flexDirection: 'column', gap: '16px' },
  field:        { display: 'flex', flexDirection: 'column', gap: '6px' },
  label:        { color: '#333333', fontSize: '11px', fontWeight: '600', letterSpacing: '0.5px' },
  input:        { background: '#FFFFFF', border: '1px solid #D3D3D3', borderRadius: '8px', padding: '10px 14px', color: '#111111', fontSize: '14px', outline: 'none', width: '100%', boxSizing: 'border-box' as const },
  errorText:    { color: '#C6402F', fontSize: '13px', margin: 0 },
  modalActions: { display: 'flex', gap: '10px', justifyContent: 'flex-end' },
}
