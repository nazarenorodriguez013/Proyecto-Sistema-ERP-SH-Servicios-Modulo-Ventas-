import { useState, useEffect } from 'react'
import type { User } from '../types'
import { API } from '../config'

interface Categoria { id: number; nombre: string; _count: { productos: number } }

export default function Categorias({ user }: { user: User }) {
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ open: boolean; editing: Categoria | null }>({ open: false, editing: null })
  const [nombre, setNombre] = useState('')
  const [confirmarBorrado, setConfirmarBorrado] = useState(false)
  const [error, setError] = useState('')

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` }
  // El administrador y el rol Inventario editan; el vendedor solo consulta
  const isAdmin = user.rol === 'ADMIN' || user.rol === 'INVENTARIO'

  const fetchAll = () =>
    fetch(`${API}/categories`, { headers })
      .then(r => r.json())
      .then(data => { setCategorias(data); setLoading(false) })

  useEffect(() => { fetchAll() }, [])

  const abrir = (c: Categoria | null) => {
    setNombre(c?.nombre ?? ''); setError(''); setConfirmarBorrado(false); setModal({ open: true, editing: c })
  }
  const cerrar = () => setModal({ open: false, editing: null })

  const guardar = async (method: string, path: string, body?: object) => {
    setError('')
    const res = await fetch(`${API}/categories${path}`, { method, headers, body: body && JSON.stringify(body) })
    if (!res.ok) {
      const data = await res.json()
      setError(data.message || 'No se pudo guardar la categoría')
      setConfirmarBorrado(false)
      return
    }
    cerrar(); fetchAll()
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (modal.editing) guardar('PUT', `/${modal.editing.id}`, { nombre })
    else guardar('POST', '', { nombre })
  }

  if (loading) return <div style={s.loading}>Cargando categorías...</div>

  return (
    <div className="page-container">
      <div className="page-header">
        <p style={s.subtitle}>{categorias.length} categorías</p>
        {isAdmin && <button style={s.btnPrimary} onClick={() => abrir(null)}><i className="bi bi-plus-lg" /> Nueva categoría</button>}
      </div>

      {categorias.length === 0
        ? <div style={s.empty}>Todavía no hay categorías</div>
        : (
          <div>
            {categorias.map(c => (
              <button key={c.id} style={{ ...s.row, cursor: isAdmin ? 'pointer' : 'default' }} disabled={!isAdmin} onClick={() => abrir(c)}>
                <span style={s.nombre}>{c.nombre}</span>
                <span style={s.meta}>{c._count.productos} artículos</span>
                {isAdmin && <i className="bi bi-chevron-right" style={s.chevron} />}
              </button>
            ))}
          </div>
        )
      }

      {modal.open && (
        <div style={s.overlay}>
          <div className="page-modal">
            <div style={s.modalHeader}>
              <h3 style={s.modalTitle}>{modal.editing ? 'Editar categoría' : 'Nueva categoría'}</h3>
              <button style={s.closeBtn} onClick={cerrar}><i className="bi bi-x-lg" /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <input style={s.input} value={nombre} onChange={e => setNombre(e.target.value)}
                placeholder="Herramientas neumáticas" required autoFocus />
              {error && <p style={s.errorText}>{error}</p>}
              {confirmarBorrado ? (
                <div style={s.confirmar}>
                  <span style={s.texto}>¿Eliminar esta categoría?</span>
                  <button type="button" style={s.btnSecondary} onClick={() => setConfirmarBorrado(false)}>Cancelar</button>
                  <button type="button" style={s.btnDanger} onClick={() => guardar('DELETE', `/${modal.editing!.id}`)}>Eliminar</button>
                </div>
              ) : (
                <div style={s.modalActions}>
                  {modal.editing && (
                    <button type="button" style={s.btnLink} onClick={() => setConfirmarBorrado(true)}>Eliminar</button>
                  )}
                  <span style={{ flex: 1 }} />
                  <button type="button" style={s.btnSecondary} onClick={cerrar}>Cancelar</button>
                  <button type="submit" style={s.btnPrimary}>{modal.editing ? 'Guardar' : 'Crear categoría'}</button>
                </div>
              )}
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
  empty:        { color: '#6B6B6B', textAlign: 'center', padding: '48px 20px', fontSize: '14px' },
  row:          { width: '100%', display: 'flex', alignItems: 'center', gap: '12px', background: '#FFFFFF', border: 'none', borderBottom: '1px solid #EFF1F4', padding: '14px 12px', textAlign: 'left', font: 'inherit' },
  nombre:       { flex: 1, color: '#111111', fontSize: '14px', fontWeight: '600' },
  meta:         { color: '#8A8A8A', fontSize: '13px' },
  chevron:      { color: '#B0B0B0', fontSize: '12px' },

  overlay:      { position: 'fixed', inset: 0, background: 'rgba(17,17,17,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalHeader:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  modalTitle:   { color: '#111111', fontSize: '17px', fontWeight: '700', margin: 0 },
  closeBtn:     { background: 'transparent', border: 'none', color: '#6B6B6B', fontSize: '18px', cursor: 'pointer' },
  input:        { background: '#FFFFFF', border: '1px solid #D3D3D3', borderRadius: '8px', padding: '10px 14px', color: '#111111', fontSize: '14px', outline: 'none', width: '100%', boxSizing: 'border-box' as const },
  errorText:    { color: '#C6402F', fontSize: '13px', margin: '12px 0 0' },
  texto:        { color: '#333333', fontSize: '13px', flex: 1 },
  modalActions: { display: 'flex', gap: '10px', alignItems: 'center', marginTop: '20px' },
  confirmar:    { display: 'flex', gap: '10px', alignItems: 'center', marginTop: '20px', background: '#FBE5E2', borderRadius: '10px', padding: '10px 12px' },
  btnPrimary:   { background: '#F5C400', color: '#111111', border: 'none', borderRadius: '8px', padding: '9px 18px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' },
  btnSecondary: { background: '#FFFFFF', color: '#333333', border: '1px solid #E2E4E8', borderRadius: '8px', padding: '9px 18px', fontWeight: '600', fontSize: '13px', cursor: 'pointer' },
  btnDanger:    { background: '#C6402F', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' },
  btnLink:      { background: 'transparent', border: 'none', color: '#C6402F', fontSize: '13px', fontWeight: '600', cursor: 'pointer', padding: '9px 4px' },
}
