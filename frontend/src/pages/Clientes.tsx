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
        {isAdmin && <button style={s.btnPrimary} onClick={openCreate}>+ Nuevo Cliente</button>}
      </div>

      {error && !modal.open && <div style={s.errorBanner}>⚠ {error}</div>}

      <input style={s.searchInput} placeholder="Buscar por nombre o documento..."
        value={search} onChange={e => setSearch(e.target.value)} />

      {filtered.length === 0
        ? <div style={s.empty}>No hay clientes que coincidan con la búsqueda</div>
        : (
          <div style={s.grid}>
            {filtered.map(c => (
              <div key={c.id} style={s.card}>
                <div style={s.cardTop} onClick={() => setVerCliente(c.id)}>
                  <div style={s.cardIcon}>👤</div>
                  <div style={s.cardBody}>
                    <p style={s.cardName}>{c.nombre}</p>
                    <p style={s.cardSub}>{c.documento || c.telefono || 'Sin datos de contacto'}</p>
                  </div>
                  <div style={{ ...s.saldoBadge, color: c.saldo > 0 ? '#f87171' : '#4ade80' }}>
                    ${fmt(c.saldo)}
                  </div>
                </div>
                {isAdmin && (
                  <div style={s.cardActions}>
                    <button style={s.btnIcon} onClick={() => setVerCliente(c.id)} title="Ver cuenta">📋</button>
                    <button style={s.btnIcon} onClick={() => openEdit(c)} title="Editar">✏️</button>
                    <button style={s.btnIconDanger} onClick={() => setDeleteConfirm(c.id)} title="Eliminar">🗑️</button>
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
              <button style={s.closeBtn} onClick={closeModal}>✕</button>
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
              {error && <p style={{ color: '#f87171', fontSize: '13px', margin: 0 }}>{error}</p>}
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
            <p style={{ color: '#94a3b8', fontSize: '14px', margin: '0 0 24px' }}>
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
  loading:      { color: '#94a3b8', padding: '40px', textAlign: 'center' },
  header:       { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  title:        { color: '#f1f5f9', fontSize: '20px', fontWeight: '700', margin: 0 },
  subtitle:     { color: '#cbd5e1', fontSize: '13px', margin: '3px 0 0' },
  errorBanner:  { background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', padding: '12px 16px', borderRadius: '8px', fontSize: '14px' },
  searchInput:  { background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '9px 14px', color: '#f1f5f9', fontSize: '14px', outline: 'none', width: '100%', boxSizing: 'border-box' as const, maxWidth: '340px' },

  empty:        { color: '#cbd5e1', textAlign: 'center', padding: '60px', background: '#1e293b', borderRadius: '12px', border: '1px solid #334155' },
  grid:         { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' },
  card:         { background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' },
  cardTop:      { display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' },
  cardIcon:     { fontSize: '22px', flexShrink: 0, width: '40px', height: '40px', background: '#0f172a', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  cardBody:     { flex: 1, minWidth: 0 },
  cardName:     { color: '#f1f5f9', fontWeight: '600', fontSize: '14px', margin: 0 },
  cardSub:      { color: '#cbd5e1', fontSize: '12px', margin: '3px 0 0' },
  saldoBadge:   { fontWeight: '800', fontSize: '14px', flexShrink: 0 },
  cardActions:  { display: 'flex', gap: '6px', borderTop: '1px solid #0f172a', paddingTop: '10px' },
  btnIcon:      { flex: 1, background: '#334155', border: 'none', borderRadius: '7px', padding: '7px 10px', cursor: 'pointer', fontSize: '13px' },
  btnIconDanger:{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: '7px', padding: '7px 10px', cursor: 'pointer', fontSize: '13px' },

  btnPrimary:   { background: '#eab308', color: '#0f172a', border: 'none', borderRadius: '8px', padding: '9px 18px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' },
  btnSecondary: { background: 'transparent', color: '#94a3b8', border: '1px solid #334155', borderRadius: '8px', padding: '9px 18px', fontWeight: '600', fontSize: '13px', cursor: 'pointer' },
  btnDanger:    { background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' },

  overlay:      { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal:        { background: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '440px' },
  modalHeader:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  modalTitle:   { color: '#f1f5f9', fontSize: '17px', fontWeight: '700', margin: 0 },
  closeBtn:     { background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '18px', cursor: 'pointer' },
  form:         { display: 'flex', flexDirection: 'column', gap: '16px' },
  row:          { display: 'flex', gap: '10px' },
  field:        { display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 },
  label:        { color: '#94a3b8', fontSize: '11px', fontWeight: '600', letterSpacing: '0.5px' },
  input:        { background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '10px 14px', color: '#f1f5f9', fontSize: '14px', outline: 'none', width: '100%', boxSizing: 'border-box' as const },
  modalActions: { display: 'flex', gap: '10px', justifyContent: 'flex-end' },
}
