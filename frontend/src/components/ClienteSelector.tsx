import { useState } from 'react'
import ClienteFormModal, { type ClienteDatos } from './ClienteFormModal'
import { describirSaldo } from '../saldo'

interface Cliente { id: number; nombre: string; documento: string | null; saldo?: number }

// Buscador de clientes por nombre o documento, con alta rápida si el cliente todavía no existe
export default function ClienteSelector({ clientes, value, onChange, onCreated }: {
  clientes: Cliente[]
  value: string
  onChange: (id: string) => void
  onCreated: (cliente: ClienteDatos) => void
}) {
  const [busqueda, setBusqueda] = useState('')
  const [creando, setCreando] = useState(false)

  const seleccionado = clientes.find(c => String(c.id) === value)
  const q = busqueda.trim().toLowerCase()
  const resultados = q
    ? clientes.filter(c => c.nombre.toLowerCase().includes(q) || c.documento?.toLowerCase().includes(q)).slice(0, 6)
    : []

  const elegir = (id: number) => { onChange(String(id)); setBusqueda('') }

  return (
    <div style={s.wrap}>
      {seleccionado ? (
        <div style={s.chip}>
          <i className="bi bi-person" /> {seleccionado.nombre}
          {!!seleccionado.saldo && (
            <span style={{ ...s.chipSaldo, color: describirSaldo(seleccionado.saldo).color }}>· {describirSaldo(seleccionado.saldo).texto}</span>
          )}
          <button type="button" style={s.chipX} title="Quitar cliente" onClick={() => onChange('')}><i className="bi bi-x-lg" /></button>
        </div>
      ) : (
        <div style={s.buscador}>
          <input style={s.input} placeholder="Buscar cliente por nombre o documento..." value={busqueda}
            onChange={e => setBusqueda(e.target.value)} autoComplete="off" />
          {resultados.length > 0 && (
            <div style={s.dropdown}>
              {resultados.map(c => (
                <div key={c.id} style={s.dropItem} onMouseDown={() => elegir(c.id)}>
                  <span style={s.dropNombre}>{c.nombre}</span>
                  {c.documento && <span style={s.dropDoc}>{c.documento}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {!seleccionado && (
        <button type="button" style={s.btnNuevo} onClick={() => setCreando(true)}><i className="bi bi-plus-lg" /> Nuevo cliente</button>
      )}
      {creando && (
        <ClienteFormModal
          onClose={() => setCreando(false)}
          onSaved={cliente => { setCreando(false); onCreated(cliente); elegir(cliente.id) }}
        />
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrap:       { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' as const },
  buscador:   { position: 'relative', flex: 1, minWidth: '220px' },
  input:      { width: '100%', background: '#FFFFFF', border: '1px solid #D3D3D3', borderRadius: '8px', padding: '10px 14px', color: '#111111', fontSize: '14px', outline: 'none', boxSizing: 'border-box' as const },
  dropdown:   { position: 'absolute', top: '100%', left: 0, right: 0, background: '#FFFFFF', border: '1px solid #E2E4E8', borderRadius: '10px', zIndex: 100, marginTop: '4px', overflow: 'hidden', boxShadow: '0 8px 24px rgba(17,17,17,.18)' },
  dropItem:   { display: 'flex', justifyContent: 'space-between', gap: '10px', padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #EFF1F4' },
  dropNombre: { color: '#111111', fontSize: '13px', fontWeight: '600' },
  dropDoc:    { color: '#6B6B6B', fontSize: '12px' },
  chip:       { display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(245,196,0,0.15)', border: '1px solid #F5C400', color: '#8A6D00', borderRadius: '8px', padding: '8px 12px', fontSize: '14px', fontWeight: '600' },
  chipSaldo:  { fontSize: '13px', fontWeight: '700' },
  chipX:      { background: 'transparent', border: 'none', color: '#8A6D00', cursor: 'pointer', fontSize: '12px', padding: '0 2px' },
  btnNuevo:   { background: '#FFFFFF', border: '1px solid #E2E4E8', borderRadius: '8px', padding: '9px 14px', color: '#111111', fontSize: '13px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' as const },
}
