import { useState, useEffect } from 'react'
import type { User } from '../types'
import { API } from '../config'

interface Categoria { id: number; nombre: string; creadoEn: string }


export default function Categorias({ user }: { user: User }) {
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ open: boolean; editing: Categoria | null }>({ open: false, editing: null })
  const [nombre, setNombre] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const [error, setError] = useState('')

  const token = localStorage.getItem('token') ?? ''
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
  const isAdmin = user.rol === 'ADMIN'

  const fetchAll = async () => {
    const res = await fetch(`${API}/categories`, { headers })
    setCategorias(await res.json())
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  const openCreate = () => { setNombre(''); setError(''); setModal({ open: true, editing: null }) }
  const openEdit = (c: Categoria) => { setNombre(c.nombre); setError(''); setModal({ open: true, editing: c }) }
  const closeModal = () => setModal({ open: false, editing: null })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const body = JSON.stringify({ nombre })
    let res: Response
    if (modal.editing) {
      res = await fetch(`${API}/categories/${modal.editing.id}`, { method: 'PUT', headers, body })
    } else {
      res = await fetch(`${API}/categories`, { method: 'POST', headers, body })
    }
    if (!res.ok) {
      const data = await res.json()
      setError(data.message || 'Error al guardar')
      return
    }
    closeModal(); fetchAll()
  }

  const handleDelete = async (id: number) => {
    const res = await fetch(`${API}/categories/${id}`, { method: 'DELETE', headers })
    if (!res.ok) {
      const data = await res.json()
      setError(data.message || 'No se puede eliminar')
    }
    setDeleteConfirm(null); fetchAll()
  }

  if (loading) return <div style={s.loading}>Cargando categorías...</div>

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2 style={s.title}>Categorías</h2>
          <p style={s.subtitle}>{categorias.length} categorías registradas</p>
        </div>
        {isAdmin && <button style={s.btnPrimary} onClick={openCreate}>+ Nueva Categoría</button>}
      </div>

      {error && <div style={s.errorBanner}>⚠ {error}</div>}

      {categorias.length === 0
        ? <div style={s.empty}>No hay categorías. Creá la primera.</div>
        : (
          <div className="page-grid-2">
            {categorias.map(c => (
              <div key={c.id} style={s.card}>
                <div style={s.cardIcon}>🏷️</div>
                <div style={s.cardBody}>
                  <p style={s.cardName}>{c.nombre}</p>
                  <p style={s.cardDate}>Creada: {new Date(c.creadoEn).toLocaleDateString('es-AR')}</p>
                </div>
                {isAdmin && (
                  <div style={s.cardActions}>
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
              <h3 style={s.modalTitle}>{modal.editing ? 'Editar Categoría' : 'Nueva Categoría'}</h3>
              <button style={s.closeBtn} onClick={closeModal}>✕</button>
            </div>
            <form onSubmit={handleSubmit} style={s.form}>
              <div style={s.field}>
                <label style={s.label}>Nombre *</label>
                <input style={s.input} value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  placeholder="Ej: Herramientas Neumáticas..."
                  required autoFocus />
              </div>
              {error && <p style={{ color: '#f87171', fontSize: '13px', margin: 0 }}>{error}</p>}
              <div style={s.modalActions}>
                <button type="button" style={s.btnSecondary} onClick={closeModal}>Cancelar</button>
                <button type="submit" style={s.btnPrimary}>{modal.editing ? 'Guardar cambios' : 'Crear categoría'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteConfirm !== null && (
        <div style={s.overlay}>
          <div style={{ ...s.modal, maxWidth: '400px' }}>
            <h3 style={{ ...s.modalTitle, marginBottom: '12px' }}>Eliminar categoría</h3>
            <p style={{ color: '#94a3b8', fontSize: '14px', margin: '0 0 24px' }}>
              ¿Estás seguro? Si la categoría tiene productos asignados no se podrá eliminar.
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
  container:    { padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '20px' },
  loading:      { color: '#94a3b8', padding: '40px', textAlign: 'center' },
  header:       { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  title:        { color: '#f1f5f9', fontSize: '20px', fontWeight: '700', margin: 0 },
  subtitle:     { color: '#cbd5e1', fontSize: '13px', margin: '3px 0 0' },
  errorBanner:  { background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', padding: '12px 16px', borderRadius: '8px', fontSize: '14px' },
  empty:        { color: '#cbd5e1', textAlign: 'center', padding: '60px', background: '#1e293b', borderRadius: '12px', border: '1px solid #334155' },
  grid:         { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' },
  card:         { background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '18px', display: 'flex', alignItems: 'center', gap: '14px' },
  cardIcon:     { fontSize: '26px', flexShrink: 0, width: '44px', height: '44px', background: '#0f172a', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  cardBody:     { flex: 1, minWidth: 0 },
  cardName:     { color: '#f1f5f9', fontWeight: '600', fontSize: '15px', margin: 0 },
  cardDate:     { color: '#cbd5e1', fontSize: '12px', margin: '4px 0 0' },
  cardActions:  { display: 'flex', gap: '6px', flexShrink: 0 },
  btnIcon:      { background: '#334155', border: 'none', borderRadius: '7px', padding: '7px 10px', cursor: 'pointer', fontSize: '14px' },
  btnIconDanger:{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: '7px', padding: '7px 10px', cursor: 'pointer', fontSize: '14px' },
  btnPrimary:   { background: '#eab308', color: '#0f172a', border: 'none', borderRadius: '8px', padding: '9px 18px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' },
  btnSecondary: { background: 'transparent', color: '#94a3b8', border: '1px solid #334155', borderRadius: '8px', padding: '9px 18px', fontWeight: '600', fontSize: '13px', cursor: 'pointer' },
  btnDanger:    { background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' },
  overlay:      { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal:        { background: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '440px' },
  modalHeader:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  modalTitle:   { color: '#f1f5f9', fontSize: '17px', fontWeight: '700', margin: 0 },
  closeBtn:     { background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '18px', cursor: 'pointer' },
  form:         { display: 'flex', flexDirection: 'column', gap: '16px' },
  field:        { display: 'flex', flexDirection: 'column', gap: '6px' },
  label:        { color: '#94a3b8', fontSize: '11px', fontWeight: '600', letterSpacing: '0.5px' },
  input:        { background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '10px 14px', color: '#f1f5f9', fontSize: '14px', outline: 'none', width: '100%', boxSizing: 'border-box' as const },
  modalActions: { display: 'flex', gap: '10px', justifyContent: 'flex-end' },
}
