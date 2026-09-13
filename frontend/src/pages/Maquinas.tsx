import { useState, useEffect } from 'react'
import type { User } from '../types'
import { API } from '../config'

interface Maquina {
  id: number; codigo: string | null; nombre: string
  marca: string | null; tipo: string | null
  tarifaDiaria: number; stock: number; stockMinimo: number
  activo: boolean
}
interface MaquinaForm {
  nombre: string; marca: string; tipo: string
  tarifaDiaria: string; stock: string; stockMinimo: string; activo: boolean
}

const EMPTY_FORM: MaquinaForm = {
  nombre: '', marca: '', tipo: '',
  tarifaDiaria: '', stock: '1', stockMinimo: '1', activo: true,
}

const fmt = (n: number) =>
  n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

export default function Maquinas({ user }: { user: User }) {
  const [maquinas, setMaquinas] = useState<Maquina[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('active')
  const [modal, setModal] = useState<{ open: boolean; editing: Maquina | null }>({ open: false, editing: null })
  const [form, setForm] = useState<MaquinaForm>(EMPTY_FORM)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const [error, setError] = useState('')

  const token = localStorage.getItem('token') ?? ''
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
  const isAdmin = user.rol === 'ADMIN'

  const fetchAll = async () => {
    const res = await fetch(`${API}/machines`, { headers })
    setMaquinas(await res.json())
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  const openCreate = () => { setForm(EMPTY_FORM); setError(''); setModal({ open: true, editing: null }) }
  const openEdit = (m: Maquina) => {
    setForm({
      nombre: m.nombre, marca: m.marca ?? '', tipo: m.tipo ?? '',
      tarifaDiaria: String(m.tarifaDiaria),
      stock: String(m.stock), stockMinimo: String(m.stockMinimo), activo: m.activo,
    })
    setError(''); setModal({ open: true, editing: m })
  }
  const closeModal = () => setModal({ open: false, editing: null })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const body = {
      nombre: form.nombre, marca: form.marca || undefined, tipo: form.tipo || undefined,
      tarifaDiaria: Number(form.tarifaDiaria) || 0,
      stock: Number(form.stock), stockMinimo: Number(form.stockMinimo), activo: form.activo,
    }
    const res = modal.editing
      ? await fetch(`${API}/machines/${modal.editing.id}`, { method: 'PUT', headers, body: JSON.stringify(body) })
      : await fetch(`${API}/machines`, { method: 'POST', headers, body: JSON.stringify(body) })
    if (!res.ok) {
      const data = await res.json()
      setError(data.message || 'Error al guardar la máquina')
      return
    }
    closeModal(); fetchAll()
  }

  const handleDelete = async (id: number) => {
    const res = await fetch(`${API}/machines/${id}`, { method: 'DELETE', headers })
    if (!res.ok) {
      const data = await res.json()
      setError(data.message || 'No se pudo eliminar la máquina')
    }
    setDeleteConfirm(null); fetchAll()
  }

  const handleToggle = async (m: Maquina) => {
    const res = await fetch(`${API}/machines/${m.id}`, { method: 'PUT', headers, body: JSON.stringify({ activo: !m.activo }) })
    if (!res.ok) {
      const data = await res.json()
      setError(data.message || 'No se pudo cambiar el estado de la máquina')
    }
    fetchAll()
  }

  const filtered = maquinas.filter(m => {
    if (filterStatus === 'active' && !m.activo) return false
    if (filterStatus === 'inactive' && m.activo) return false
    if (search) {
      const q = search.toLowerCase()
      if (!m.nombre.toLowerCase().includes(q) && !(m.codigo?.toLowerCase().includes(q)) && !(m.marca?.toLowerCase().includes(q))) return false
    }
    return true
  })

  if (loading) return <div style={s.loading}>Cargando máquinas...</div>

  return (
    <div style={s.container}>
      {/* Encabezado */}
      <div style={s.header}>
        <div>
          <h2 style={s.title}>Máquinas</h2>
          <p style={s.subtitle}>{filtered.length} de {maquinas.length} máquinas de la flota</p>
        </div>
        {isAdmin && <button style={s.btnPrimary} onClick={openCreate}>+ Nueva Máquina</button>}
      </div>

      {error && !modal.open && <div style={s.errorBanner}>⚠ {error}</div>}

      {/* Filtros */}
      <div style={s.filterBar}>
        <input
          style={s.searchInput}
          placeholder="Buscar por nombre, código o marca..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div style={s.tabs}>
          {(['all', 'active', 'inactive'] as const).map(f => (
            <button
              key={f}
              style={{ ...s.tab, ...(filterStatus === f ? s.tabActive : {}) }}
              onClick={() => setFilterStatus(f)}
            >
              {f === 'all' ? 'Todas' : f === 'active' ? 'Activas' : 'Inactivas'}
            </button>
          ))}
        </div>
      </div>

      {/* Grid de cards */}
      {filtered.length === 0
        ? <div style={s.empty}>No hay máquinas que coincidan con los filtros</div>
        : (
          <div style={s.grid}>
            {filtered.map(m => {
              const stockStatus = m.stock === 0 ? 'out' : m.stock <= m.stockMinimo ? 'low' : 'ok'
              const stockPct = Math.min((m.stock / (m.stockMinimo * 3)) * 100, 100)

              return (
                <div key={m.id} style={{ ...s.card, opacity: m.activo ? 1 : 0.6 }}>
                  {/* Cabecera de la card */}
                  <div style={s.cardTop}>
                    <span style={s.code}>{m.codigo ?? '—'}</span>
                    <span style={{ ...s.statusDot, ...(m.activo ? s.dotActive : s.dotInactive) }}>
                      {m.activo ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>

                  {/* Nombre y tipo/marca */}
                  <div style={s.cardBody}>
                    <h3 style={s.machineName}>{m.nombre}</h3>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' as const }}>
                      {m.tipo && <span style={s.catBadge}>{m.tipo}</span>}
                      {m.marca && <span style={s.catBadge}>{m.marca}</span>}
                    </div>
                  </div>

                  <div style={s.divider} />

                  {/* Tarifa */}
                  <div style={s.priceRow}>
                    <div style={s.priceItem}>
                      <span style={s.priceLabel}>Tarifa diaria</span>
                      <span style={s.priceSale}>${fmt(m.tarifaDiaria)}</span>
                    </div>
                  </div>

                  {/* Stock (unidades disponibles de la flota) */}
                  <div style={s.stockRow}>
                    <div style={s.stockInfo}>
                      <span style={s.stockLabel}>Disponibles</span>
                      <span style={{ ...s.stockNum, color: stockStatus === 'out' ? '#f87171' : stockStatus === 'low' ? '#fbbf24' : '#4ade80' }}>
                        {m.stock}
                      </span>
                      <span style={s.stockMin}>/ mín {m.stockMinimo}</span>
                      {stockStatus === 'out' && <span style={s.badgeOut}>Sin unidades</span>}
                      {stockStatus === 'low' && <span style={s.badgeLow}>Stock bajo</span>}
                    </div>
                    <div style={s.stockBarWrap}>
                      <div style={{ ...s.stockBar, width: `${stockPct}%`, background: stockStatus === 'out' ? '#f87171' : stockStatus === 'low' ? '#fbbf24' : '#4ade80' }} />
                    </div>
                  </div>

                  {/* Acciones */}
                  {isAdmin && (
                    <div style={s.cardActions}>
                      <button style={s.btnEdit} onClick={() => openEdit(m)}>✏️ Editar</button>
                      <button style={s.btnToggle} onClick={() => handleToggle(m)}>
                        {m.activo ? '🔒 Desactivar' : '🔓 Activar'}
                      </button>
                      <button style={s.btnDelete} onClick={() => { setError(''); setDeleteConfirm(m.id) }}>🗑️</button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      }

      {/* Modal crear/editar */}
      {modal.open && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <div style={s.modalHeader}>
              <h3 style={s.modalTitle}>{modal.editing ? `Editar — ${modal.editing.codigo}` : 'Nueva Máquina'}</h3>
              <button style={s.closeBtn} onClick={closeModal}>✕</button>
            </div>
            <form onSubmit={handleSubmit} style={s.form}>
              {error && <div style={s.errorBanner}>⚠ {error}</div>}

              <div style={s.section}>
                <p style={s.sectionTitle}>Datos generales</p>
                <div style={s.row}>
                  <div style={s.field}>
                    <label style={s.label}>Nombre *</label>
                    <input style={s.input} value={form.nombre}
                      onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} required />
                  </div>
                </div>
                <div style={s.row}>
                  <div style={s.field}>
                    <label style={s.label}>Tipo</label>
                    <input style={s.input} placeholder="Autoelevador, Compresor, Grupo electrógeno..."
                      value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))} />
                  </div>
                  <div style={s.field}>
                    <label style={s.label}>Marca</label>
                    <input style={s.input} placeholder="Heli, Hyster, Hangcha, Hertz, Himoinsa..."
                      value={form.marca} onChange={e => setForm(f => ({ ...f, marca: e.target.value }))} />
                  </div>
                </div>
              </div>

              <div style={s.section}>
                <p style={s.sectionTitle}>Tarifa</p>
                <div style={s.field}>
                  <label style={s.label}>Tarifa diaria *</label>
                  <div style={s.inputGroup}>
                    <span style={s.inputPrefix}>$</span>
                    <input style={s.inputInner} type="number" min="0" step="0.01"
                      value={form.tarifaDiaria} onChange={e => setForm(f => ({ ...f, tarifaDiaria: e.target.value }))} required />
                  </div>
                </div>
              </div>

              <div style={s.section}>
                <p style={s.sectionTitle}>Flota</p>
                <div style={s.row}>
                  <div style={s.field}>
                    <label style={s.label}>Unidades disponibles *</label>
                    <input style={s.input} type="number" min="0" value={form.stock}
                      onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} required />
                  </div>
                  <div style={s.field}>
                    <label style={s.label}>Mínimo</label>
                    <input style={s.input} type="number" min="0" value={form.stockMinimo}
                      onChange={e => setForm(f => ({ ...f, stockMinimo: e.target.value }))} />
                  </div>
                </div>
              </div>

              <label style={s.checkLabel}>
                <input type="checkbox" checked={form.activo}
                  onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} />
                <span style={{ color: '#cbd5e1', fontSize: '14px' }}>Máquina activa</span>
              </label>

              <div style={s.modalActions}>
                <button type="button" style={s.btnSecondary} onClick={closeModal}>Cancelar</button>
                <button type="submit" style={s.btnPrimary}>
                  {modal.editing ? 'Guardar cambios' : 'Crear máquina'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmar eliminar */}
      {deleteConfirm !== null && (
        <div style={s.overlay}>
          <div style={{ ...s.modal, maxWidth: '400px' }}>
            <h3 style={{ ...s.modalTitle, marginBottom: '12px' }}>Eliminar máquina</h3>
            <p style={{ color: '#94a3b8', fontSize: '14px', margin: '0 0 24px' }}>¿Estás seguro? Esta acción no se puede deshacer.</p>
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
  container:    { padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '20px', overflowX: 'hidden' },
  loading:      { color: '#94a3b8', padding: '40px', textAlign: 'center' },
  header:       { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  title:        { color: '#f1f5f9', fontSize: '20px', fontWeight: '700', margin: 0 },
  subtitle:     { color: '#cbd5e1', fontSize: '13px', margin: '3px 0 0' },
  errorBanner:  { background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', padding: '10px 14px', borderRadius: '8px', fontSize: '13px' },

  filterBar:    { display: 'flex', gap: '10px', flexWrap: 'wrap' as const, alignItems: 'center' },
  searchInput:  { flex: 1, minWidth: '200px', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '9px 14px', color: '#f1f5f9', fontSize: '14px', outline: 'none' },
  tabs:         { display: 'flex', gap: '4px', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '3px' },
  tab:          { background: 'transparent', border: 'none', borderRadius: '6px', padding: '5px 12px', color: '#94a3b8', fontSize: '12px', fontWeight: '500', cursor: 'pointer' },
  tabActive:    { background: '#334155', color: '#f1f5f9', fontWeight: '600' },

  empty:        { color: '#cbd5e1', textAlign: 'center', padding: '60px 20px', background: '#1e293b', borderRadius: '12px', border: '1px solid #334155', fontSize: '14px' },

  grid:         { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: '16px' },

  card:         { background: '#1e293b', border: '1px solid #334155', borderRadius: '14px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px', transition: 'border-color 0.2s' },
  cardTop:      { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  code:         { fontFamily: 'monospace', background: '#0f172a', color: '#eab308', border: '1px solid #334155', borderRadius: '6px', padding: '3px 9px', fontSize: '12px', fontWeight: '700', letterSpacing: '1px' },
  statusDot:    { fontSize: '11px', fontWeight: '600', padding: '3px 8px', borderRadius: '20px' },
  dotActive:    { background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)' },
  dotInactive:  { background: 'rgba(100,116,139,0.1)', color: '#94a3b8', border: '1px solid rgba(100,116,139,0.2)' },

  cardBody:     { display: 'flex', flexDirection: 'column', gap: '6px' },
  machineName:  { color: '#f1f5f9', fontSize: '15px', fontWeight: '700', margin: 0, lineHeight: '1.3' },
  catBadge:     { display: 'inline-block', background: '#0f172a', color: '#94a3b8', border: '1px solid #334155', padding: '2px 9px', borderRadius: '20px', fontSize: '11px' },

  divider:      { height: '1px', background: '#334155' },

  priceRow:     { display: 'flex', alignItems: 'center', gap: '8px' },
  priceItem:    { display: 'flex', flexDirection: 'column', gap: '1px' },
  priceLabel:   { color: '#cbd5e1', fontSize: '10px', fontWeight: '600', textTransform: 'uppercase' as const, letterSpacing: '0.5px' },
  priceSale:    { color: '#eab308', fontWeight: '800', fontSize: '17px' },

  stockRow:     { display: 'flex', flexDirection: 'column', gap: '6px' },
  stockInfo:    { display: 'flex', alignItems: 'center', gap: '6px' },
  stockLabel:   { color: '#cbd5e1', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' as const, letterSpacing: '0.5px' },
  stockNum:     { fontWeight: '800', fontSize: '16px' },
  stockMin:     { color: '#cbd5e1', fontSize: '11px' },
  badgeOut:     { background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.2)', padding: '1px 7px', borderRadius: '20px', fontSize: '10px', fontWeight: '600', marginLeft: 'auto', whiteSpace: 'nowrap' as const },
  badgeLow:     { background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)', padding: '1px 7px', borderRadius: '20px', fontSize: '10px', fontWeight: '600', marginLeft: 'auto', whiteSpace: 'nowrap' as const },
  stockBarWrap: { height: '4px', background: '#0f172a', borderRadius: '2px', overflow: 'hidden' },
  stockBar:     { height: '100%', borderRadius: '2px', transition: 'width 0.3s' },

  cardActions:  { display: 'flex', gap: '6px', marginTop: '2px' },
  btnEdit:      { flex: 1, background: '#334155', border: 'none', borderRadius: '7px', padding: '7px 10px', color: '#cbd5e1', fontSize: '12px', fontWeight: '600', cursor: 'pointer' },
  btnToggle:    { flex: 1, background: 'transparent', border: '1px solid #334155', borderRadius: '7px', padding: '7px 10px', color: '#94a3b8', fontSize: '12px', fontWeight: '600', cursor: 'pointer' },
  btnDelete:    { background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: '7px', padding: '7px 10px', color: '#f87171', fontSize: '12px', cursor: 'pointer' },

  btnPrimary:   { background: '#eab308', color: '#0f172a', border: 'none', borderRadius: '8px', padding: '9px 18px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' },
  btnSecondary: { background: 'transparent', color: '#94a3b8', border: '1px solid #334155', borderRadius: '8px', padding: '9px 18px', fontWeight: '600', fontSize: '13px', cursor: 'pointer' },
  btnDanger:    { background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' },

  overlay:      { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal:        { background: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' },
  modalHeader:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  modalTitle:   { color: '#f1f5f9', fontSize: '17px', fontWeight: '700', margin: 0 },
  closeBtn:     { background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '18px', cursor: 'pointer' },
  form:         { display: 'flex', flexDirection: 'column', gap: '16px' },
  section:      { display: 'flex', flexDirection: 'column', gap: '12px', background: '#0f172a', borderRadius: '10px', padding: '14px' },
  sectionTitle: { color: '#cbd5e1', fontSize: '10px', fontWeight: '700', letterSpacing: '1px', textTransform: 'uppercase' as const, margin: 0 },
  row:          { display: 'flex', gap: '10px' },
  field:        { display: 'flex', flexDirection: 'column', gap: '5px', flex: 1 },
  label:        { color: '#94a3b8', fontSize: '11px', fontWeight: '600', letterSpacing: '0.5px' },
  input:        { background: '#1e293b', border: '1px solid #334155', borderRadius: '7px', padding: '9px 12px', color: '#f1f5f9', fontSize: '13px', outline: 'none', width: '100%', boxSizing: 'border-box' as const },
  inputGroup:   { display: 'flex', alignItems: 'center', background: '#1e293b', border: '1px solid #334155', borderRadius: '7px', overflow: 'hidden' },
  inputPrefix:  { color: '#eab308', fontWeight: '700', padding: '0 8px', fontSize: '13px', flexShrink: 0 },
  inputInner:   { flex: 1, background: 'transparent', border: 'none', padding: '9px 8px 9px 0', color: '#f1f5f9', fontSize: '13px', outline: 'none', width: '100%' },
  checkLabel:   { display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' },
  modalActions: { display: 'flex', gap: '10px', justifyContent: 'flex-end' },
}
