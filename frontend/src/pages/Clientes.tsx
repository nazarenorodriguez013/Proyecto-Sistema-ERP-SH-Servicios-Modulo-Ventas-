import { useState, useEffect } from 'react'
import type { User } from '../types'
import { API } from '../config'
import ClienteDetalle from './ClienteDetalle'

interface Cliente {
  id: number; nombre: string; documento: string | null; telefono: string | null
  email: string | null; direccion: string | null; activo: boolean; saldo: number
}
interface ClienteForm {
  nombre: string; documento: string; telefono: string; email: string; direccion: string
}

const EMPTY_FORM: ClienteForm = { nombre: '', documento: '', telefono: '', email: '', direccion: '' }
const fmt = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function Clientes({ user }: { user: User }) {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<{ open: boolean; editing: Cliente | null }>({ open: false, editing: null })
  const [form, setForm] = useState<ClienteForm>(EMPTY_FORM)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [verCliente, setVerCliente] = useState<number | null>(null)

  const token = localStorage.getItem('token') ?? ''
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
  const isAdmin = user.rol === 'ADMIN'

  const fetchAll = async () => {
    const res = await fetch(`${API}/clients`, { headers })
    setClientes(await res.json())
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  const openCreate = () => { setForm(EMPTY_FORM); setError(''); setModal({ open: true, editing: null }) }
  const openEdit = (c: Cliente) => {
    setForm({ nombre: c.nombre, documento: c.documento ?? '', telefono: c.telefono ?? '', email: c.email ?? '', direccion: c.direccion ?? '' })
    setError(''); setModal({ open: true, editing: c })
  }
  const closeModal = () => setModal({ open: false, editing: null })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const body = JSON.stringify({
      nombre: form.nombre,
      documento: form.documento || undefined,
      telefono: form.telefono || undefined,
      email: form.email || undefined,
      direccion: form.direccion || undefined,
    })
    const res = modal.editing
      ? await fetch(`${API}/clients/${modal.editing.id}`, { method: 'PUT', headers, body })
      : await fetch(`${API}/clients`, { method: 'POST', headers, body })
    if (!res.ok) {
      const data = await res.json()
      setError(data.message || 'Error al guardar el cliente')
      return
    }
    closeModal(); fetchAll()
  }

  const handleDelete = async (id: number) => {
    const res = await fetch(`${API}/clients/${id}`, { method: 'DELETE', headers })
    if (!res.ok) {
      const data = await res.json()
      setError(data.message || 'No se pudo eliminar el cliente')
    }
    setDeleteConfirm(null); fetchAll()
  }

  const filtered = clientes.filter(c => {
    if (!search) return true
    const q = search.toLowerCase()
    return c.nombre.toLowerCase().includes(q) || (c.documento?.toLowerCase().includes(q))
  })

  if (verCliente !== null) {
    return <ClienteDetalle clienteId={verCliente} isAdmin={isAdmin} onBack={() => { setVerCliente(null); fetchAll() }} />
  }

  if (loading) return <div style={s.loading}>Cargando clientes...</div>

  return (
    <div className="page-container">
      <div style={s.header}>
        <div>
          <h2 style={s.title}>Clientes</h2>
          <p style={s.subtitle}>{filtered.length} de {clientes.length} clientes</p>
        </div>
        {isAdmin && <button style={s.btnPrimary} onClick={openCreate}><i className="bi bi-plus-lg" /> Nuevo Cliente</button>}
      </div>

      {error && !modal.open && <div style={s.errorBanner}><i className="bi bi-exclamation-triangle-fill" /> {error}</div>}

      <input style={s.searchInput} placeholder="Buscar por nombre o documento..."
        value={search} onChange={e => setSearch(e.target.value)} />

      {filtered.length === 0
        ? <div style={s.empty}>No hay clientes que coincidan con la búsqueda</div>
        : (
          <div style={s.grid}>
            {filtered.map(c => (
              <div key={c.id} style={s.card}>
                <div style={s.cardTop} onClick={() => setVerCliente(c.id)}>
                  <div style={s.cardIcon}><i className="bi bi-person" /></div>
                  <div style={s.cardBody}>
                    <p style={s.cardName}>{c.nombre}</p>
                    <p style={s.cardSub}>{c.documento || c.telefono || 'Sin datos de contacto'}</p>
                  </div>
                  <div style={{ ...s.saldoBadge, color: c.saldo > 0 ? '#C6402F' : '#2E9E5B' }}>
                    ${fmt(c.saldo)}
                  </div>
                </div>
                {isAdmin && (
                  <div style={s.cardActions}>
                    <button style={s.btnIcon} onClick={() => setVerCliente(c.id)} title="Ver cuenta"><i className="bi bi-journal-text" /></button>
                    <button style={s.btnIcon} onClick={() => openEdit(c)} title="Editar"><i className="bi bi-pencil" /></button>
                    <button style={s.btnIconDanger} onClick={() => setDeleteConfirm(c.id)} title="Eliminar"><i className="bi bi-trash" /></button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      }

      {modal.open && (
        <div style={s.overlay}>
          <div className="page-modal">
            <div style={s.modalHeader}>
              <h3 style={s.modalTitle}>{modal.editing ? 'Editar Cliente' : 'Nuevo Cliente'}</h3>
              <button style={s.closeBtn} onClick={closeModal}><i className="bi bi-x-lg" /></button>
            </div>
            <form onSubmit={handleSubmit} style={s.form}>
              <div style={s.field}>
                <label style={s.label}>Nombre *</label>
                <input style={s.input} value={form.nombre}
                  onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} required autoFocus />
              </div>
              <div style={s.row}>
                <div style={s.field}>
                  <label style={s.label}>Documento</label>
                  <input style={s.input} value={form.documento}
                    onChange={e => setForm(f => ({ ...f, documento: e.target.value }))} />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Teléfono</label>
                  <input style={s.input} value={form.telefono}
                    onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} />
                </div>
              </div>
              <div style={s.field}>
                <label style={s.label}>Email</label>
                <input style={s.input} type="email" value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div style={s.field}>
                <label style={s.label}>Dirección</label>
                <input style={s.input} value={form.direccion}
                  onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))} />
              </div>
              {error && <p style={{ color: '#C6402F', fontSize: '13px', margin: 0 }}>{error}</p>}
              <div style={s.modalActions}>
                <button type="button" style={s.btnSecondary} onClick={closeModal}>Cancelar</button>
                <button type="submit" style={s.btnPrimary}>{modal.editing ? 'Guardar cambios' : 'Crear cliente'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteConfirm !== null && (
        <div style={s.overlay}>
          <div style={{ ...s.modal, maxWidth: '400px' }}>
            <h3 style={{ ...s.modalTitle, marginBottom: '12px' }}>Eliminar cliente</h3>
            <p style={{ color: '#6B6B6B', fontSize: '14px', margin: '0 0 24px' }}>
              ¿Estás seguro? Si el cliente tiene ventas o movimientos asociados no se podrá eliminar.
            </p>
            <div style={s.modalActions}>
              <button style={s.btnSecondary} onClick={() => setDeleteConfirm(null)}>Cancelar</button>
              <button style={s.btnDanger} onClick={() => handleDelete(deleteConfirm)}>Eliminar</button>
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
  title:        { color: '#111111', fontSize: '20px', fontWeight: '700', margin: 0 },
  subtitle:     { color: '#6B6B6B', fontSize: '13px', margin: '3px 0 0' },
  errorBanner:  { background: 'rgba(198,64,47,0.1)', border: '1px solid rgba(198,64,47,0.3)', color: '#C6402F', padding: '12px 16px', borderRadius: '8px', fontSize: '14px' },
  searchInput:  { background: '#FFFFFF', border: '1px solid #D3D3D3', borderRadius: '8px', padding: '9px 14px', color: '#111111', fontSize: '14px', outline: 'none', width: '100%', boxSizing: 'border-box' as const, maxWidth: '340px' },

  empty:        { color: '#6B6B6B', textAlign: 'center', padding: '60px', background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E4E8' },
  grid:         { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' },
  card:         { background: '#FFFFFF', border: '1px solid #E2E4E8', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' },
  cardTop:      { display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' },
  cardIcon:     { fontSize: '18px', flexShrink: 0, width: '40px', height: '40px', background: '#F5F5F5', color: '#111111', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  cardBody:     { flex: 1, minWidth: 0 },
  cardName:     { color: '#111111', fontWeight: '600', fontSize: '14px', margin: 0 },
  cardSub:      { color: '#6B6B6B', fontSize: '12px', margin: '3px 0 0' },
  saldoBadge:   { fontWeight: '800', fontSize: '14px', flexShrink: 0 },
  cardActions:  { display: 'flex', gap: '6px', borderTop: '1px solid #EFF1F4', paddingTop: '10px' },
  btnIcon:      { flex: 1, background: '#FFFFFF', border: '1px solid #E2E4E8', borderRadius: '7px', padding: '7px 10px', cursor: 'pointer', fontSize: '13px', color: '#111111' },
  btnIconDanger:{ background: 'rgba(198,64,47,0.08)', border: '1px solid rgba(198,64,47,0.2)', borderRadius: '7px', padding: '7px 10px', cursor: 'pointer', fontSize: '13px', color: '#C6402F' },

  btnPrimary:   { background: '#F5C400', color: '#111111', border: 'none', borderRadius: '8px', padding: '9px 18px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' },
  btnSecondary: { background: '#FFFFFF', color: '#6B6B6B', border: '1px solid #E2E4E8', borderRadius: '8px', padding: '9px 18px', fontWeight: '600', fontSize: '13px', cursor: 'pointer' },
  btnDanger:    { background: '#C6402F', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' },

  overlay:      { position: 'fixed', inset: 0, background: 'rgba(17,17,17,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal:        { background: '#FFFFFF', border: '1px solid #E2E4E8', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '440px', boxShadow: '0 18px 46px rgba(17,17,17,.18)' },
  modalHeader:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  modalTitle:   { color: '#111111', fontSize: '17px', fontWeight: '700', margin: 0 },
  closeBtn:     { background: 'transparent', border: 'none', color: '#6B6B6B', fontSize: '18px', cursor: 'pointer' },
  form:         { display: 'flex', flexDirection: 'column', gap: '16px' },
  row:          { display: 'flex', gap: '10px' },
  field:        { display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 },
  label:        { color: '#333333', fontSize: '11px', fontWeight: '600', letterSpacing: '0.5px' },
  input:        { background: '#FFFFFF', border: '1px solid #D3D3D3', borderRadius: '8px', padding: '10px 14px', color: '#111111', fontSize: '14px', outline: 'none', width: '100%', boxSizing: 'border-box' as const },
  modalActions: { display: 'flex', gap: '10px', justifyContent: 'flex-end' },
}
