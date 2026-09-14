import { useState, useEffect } from 'react'
import { API } from '../config'

type TipoMovimiento = 'VENTA' | 'ALQUILER' | 'SERVICIO' | 'PAGO'
interface Movimiento {
  id: number; tipo: TipoMovimiento; concepto: string; monto: number; creadoEn: string
}
interface ClienteFicha {
  id: number; nombre: string; documento: string | null; telefono: string | null
  email: string | null; direccion: string | null; activo: boolean
  movimientos: Movimiento[]; saldo: number
}
interface NuevoMovimientoForm { tipo: TipoMovimiento; concepto: string; monto: string }

const TIPO_LABEL: Record<TipoMovimiento, string> = {
  VENTA: 'Venta', ALQUILER: 'Alquiler', SERVICIO: 'Servicio Técnico', PAGO: 'Pago',
}
const TIPOS_CARGABLES: TipoMovimiento[] = ['ALQUILER', 'SERVICIO', 'PAGO']
const EMPTY_FORM: NuevoMovimientoForm = { tipo: 'ALQUILER', concepto: '', monto: '' }
const fmt = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtFecha = (d: string) => new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })

export default function ClienteDetalle({ clienteId, isAdmin, onBack }: { clienteId: number; isAdmin: boolean; onBack: () => void }) {
  const [cliente, setCliente] = useState<ClienteFicha | null>(null)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<NuevoMovimientoForm>(EMPTY_FORM)
  const [error, setError] = useState('')

  const token = localStorage.getItem('token') ?? ''
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

  const fetchCliente = async () => {
    const res = await fetch(`${API}/clients/${clienteId}`, { headers })
    setCliente(await res.json())
    setLoading(false)
  }

  useEffect(() => { fetchCliente() }, [clienteId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const res = await fetch(`${API}/clients/${clienteId}/movements`, {
      method: 'POST', headers,
      body: JSON.stringify({ tipo: form.tipo, concepto: form.concepto, monto: Number(form.monto) }),
    })
    if (!res.ok) {
      const data = await res.json()
      setError(data.message || 'No se pudo registrar el movimiento')
      return
    }
    setForm(EMPTY_FORM); fetchCliente()
  }

  if (loading || !cliente) return <div style={s.loading}>Cargando cliente...</div>

  return (
    <div className="page-container">
      <div style={s.header}>
        <button style={s.btnVolver} onClick={onBack}>← Volver</button>
        <div style={s.saldoBox}>
          <span style={s.saldoLabel}>SALDO</span>
          <span style={{ ...s.saldoValor, color: cliente.saldo > 0 ? '#C6402F' : '#2E9E5B' }}>${fmt(cliente.saldo)}</span>
        </div>
      </div>

      <div style={s.datosCard}>
        <h2 style={s.title}>{cliente.nombre}</h2>
        <div style={s.datosGrid}>
          <span style={s.dato}>📄 {cliente.documento || '—'}</span>
          <span style={s.dato}>📞 {cliente.telefono || '—'}</span>
          <span style={s.dato}>✉️ {cliente.email || '—'}</span>
          <span style={s.dato}>📍 {cliente.direccion || '—'}</span>
        </div>
      </div>

      {isAdmin && (
        <div style={s.formCard}>
          <p style={s.sectionTitle}>Registrar movimiento</p>
          <form onSubmit={handleSubmit} style={s.form}>
            <select style={s.select} value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value as TipoMovimiento }))}>
              {TIPOS_CARGABLES.map(t => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
            </select>
            <input style={s.inputConcepto} placeholder="Concepto" value={form.concepto}
              onChange={e => setForm(f => ({ ...f, concepto: e.target.value }))} required />
            <input style={s.inputMonto} type="number" min="0.01" step="0.01" placeholder="Monto" value={form.monto}
              onChange={e => setForm(f => ({ ...f, monto: e.target.value }))} required />
            <button type="submit" style={s.btnPrimary}>Registrar</button>
          </form>
          {error && <p style={s.errorText}>⚠ {error}</p>}
        </div>
      )}

      <div style={s.histCard}>
        <p style={s.sectionTitle}>Historial de movimientos</p>
        {cliente.movimientos.length === 0
          ? <div style={s.empty}>Sin movimientos registrados</div>
          : cliente.movimientos.map(m => (
            <div key={m.id} style={s.movRow}>
              <span style={s.movTipo}>{TIPO_LABEL[m.tipo]}</span>
              <span style={s.movConcepto}>{m.concepto}</span>
              <span style={s.movFecha}>{fmtFecha(m.creadoEn)}</span>
              <span style={{ ...s.movMonto, color: m.tipo === 'PAGO' ? '#2E9E5B' : '#C6402F' }}>
                {m.tipo === 'PAGO' ? '-' : '+'}${fmt(m.monto)}
              </span>
            </div>
          ))
        }
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  loading:      { color: '#9A9A9A', padding: '40px', textAlign: 'center' },
  header:       { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  btnVolver:    { background: 'transparent', border: '1px solid #2B2B2B', borderRadius: '8px', color: '#CFCFCF', fontSize: '13px', padding: '8px 16px', cursor: 'pointer' },
  saldoBox:     { display: 'flex', flexDirection: 'column', alignItems: 'flex-end' },
  saldoLabel:   { color: '#9A9A9A', fontSize: '11px', fontWeight: '700', letterSpacing: '1.5px' },
  saldoValor:   { fontSize: '26px', fontWeight: '800' },

  datosCard:    { background: '#1A1A1A', border: '1px solid #2B2B2B', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' },
  title:        { color: '#FFFFFF', fontSize: '19px', fontWeight: '700', margin: 0 },
  datosGrid:    { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' },
  dato:         { color: '#CFCFCF', fontSize: '13px' },

  formCard:     { background: '#1A1A1A', border: '1px solid #2B2B2B', borderRadius: '12px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '10px' },
  sectionTitle: { color: '#9A9A9A', fontSize: '11px', fontWeight: '700', letterSpacing: '1px', textTransform: 'uppercase' as const, margin: 0 },
  form:         { display: 'flex', gap: '8px', flexWrap: 'wrap' as const },
  select:       { background: '#111111', border: '1px solid #2B2B2B', borderRadius: '8px', padding: '9px 10px', color: '#FFFFFF', fontSize: '13px', outline: 'none' },
  inputConcepto:{ flex: 1, minWidth: '160px', background: '#111111', border: '1px solid #2B2B2B', borderRadius: '8px', padding: '9px 12px', color: '#FFFFFF', fontSize: '13px', outline: 'none' },
  inputMonto:   { width: '130px', background: '#111111', border: '1px solid #2B2B2B', borderRadius: '8px', padding: '9px 12px', color: '#FFFFFF', fontSize: '13px', outline: 'none' },
  btnPrimary:   { background: '#F5C400', color: '#111111', border: 'none', borderRadius: '8px', padding: '9px 18px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' },
  errorText:    { color: '#C6402F', fontSize: '13px', margin: 0 },

  histCard:     { background: '#1A1A1A', border: '1px solid #2B2B2B', borderRadius: '12px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '10px' },
  empty:        { color: '#9A9A9A', fontSize: '13px', textAlign: 'center', padding: '20px' },
  movRow:       { display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 4px', borderBottom: '1px solid #111111', flexWrap: 'wrap' as const },
  movTipo:      { color: '#F5C400', fontSize: '11px', fontWeight: '700', background: '#111111', border: '1px solid #2B2B2B', borderRadius: '20px', padding: '3px 10px', flexShrink: 0 },
  movConcepto:  { color: '#FFFFFF', fontSize: '13px', flex: 1, minWidth: '120px' },
  movFecha:     { color: '#9A9A9A', fontSize: '12px', flexShrink: 0 },
  movMonto:     { fontSize: '14px', fontWeight: '700', flexShrink: 0, minWidth: '90px', textAlign: 'right' as const },
}
