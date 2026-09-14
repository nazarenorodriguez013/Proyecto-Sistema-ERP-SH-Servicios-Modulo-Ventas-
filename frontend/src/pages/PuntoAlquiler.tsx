import { useState, useEffect, useRef, useCallback } from 'react'
import type { User } from '../types'
import { API } from '../config'

interface Maquina {
  id: number; codigo: string | null; nombre: string
  marca: string | null; tipo: string | null
  tarifaDiaria: number; stock: number; activo: boolean
}
interface Cliente { id: number; nombre: string }
interface ItemCarrito {
  maquina: Maquina
  cantidad: number
}
interface ComprobanteData {
  ids: number[]
  fecha: Date
  items: ItemCarrito[]
  dias: number
  total: number
  cliente: string | null
  fechaInicio: string
  fechaFin: string
  registradoPor: string
}

const fmt = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtFecha = (d: Date) => d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
// Son fechas de calendario (sin hora): se formatean en UTC para que no varíen según la zona horaria del navegador
const fmtFechaCorta = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })

const calcDias = (inicio: string, fin: string) => {
  if (!inicio || !fin) return 0
  const d = Math.ceil((new Date(fin).getTime() - new Date(inicio).getTime()) / (1000 * 60 * 60 * 24))
  return d > 0 ? d : 0
}

export default function PuntoAlquiler({ user }: { user: User }) {
  const [maquinas, setMaquinas] = useState<Maquina[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [clienteId, setClienteId] = useState('')
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [carrito, setCarrito] = useState<ItemCarrito[]>([])
  const [cantidad, setCantidad] = useState('1')
  const [busqueda, setBusqueda] = useState('')
  const [sugerencias, setSugerencias] = useState<Maquina[]>([])
  const [sugerenciaIdx, setSugerenciaIdx] = useState(0)
  const [error, setError] = useState('')
  const [procesando, setProcesando] = useState(false)
  const [comprobante, setComprobante] = useState<ComprobanteData | null>(null)

  const cantidadRef = useRef<HTMLInputElement>(null)
  const busquedaRef = useRef<HTMLInputElement>(null)

  const token = localStorage.getItem('token') ?? ''
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

  const fetchMaquinas = () => fetch(`${API}/machines`, { headers }).then(r => r.json()).then(setMaquinas)

  useEffect(() => {
    fetchMaquinas()
    fetch(`${API}/clients`, { headers }).then(r => r.json()).then(setClientes)
  }, [])

  useEffect(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) { setSugerencias([]); return }
    setSugerencias(
      maquinas.filter(m => m.activo && m.stock > 0 && (
        m.nombre.toLowerCase().includes(q) || (m.codigo?.toLowerCase().includes(q))
      )).slice(0, 8)
    )
    setSugerenciaIdx(0)
  }, [busqueda, maquinas])

  const dias = calcDias(fechaInicio, fechaFin)

  const agregarMaquina = useCallback((maquina: Maquina) => {
    const cant = Math.max(1, parseInt(cantidad) || 1)
    if (cant > maquina.stock) { setError(`Unidades insuficientes (disponible: ${maquina.stock})`); return }
    setCarrito(prev => {
      const idx = prev.findIndex(i => i.maquina.id === maquina.id)
      if (idx >= 0) {
        const nueva = [...prev]
        const nuevaCant = nueva[idx].cantidad + cant
        if (nuevaCant > maquina.stock) { setError(`Unidades insuficientes (disponible: ${maquina.stock})`); return prev }
        nueva[idx] = { ...nueva[idx], cantidad: nuevaCant }
        return nueva
      }
      return [...prev, { maquina, cantidad: cant }]
    })
    setError(''); setBusqueda(''); setSugerencias([])
    setCantidad('1'); cantidadRef.current?.focus(); cantidadRef.current?.select()
  }, [cantidad])

  const quitarItem = (idx: number) => setCarrito(prev => prev.filter((_, i) => i !== idx))

  const cambiarCantidadItem = (idx: number, val: string) => {
    const n = parseInt(val)
    if (isNaN(n) || n < 1) return
    if (n > carrito[idx].maquina.stock) { setError(`Unidades insuficientes (disponible: ${carrito[idx].maquina.stock})`); return }
    setError('')
    setCarrito(prev => { const c = [...prev]; c[idx] = { ...c[idx], cantidad: n }; return c })
  }

  const total = dias > 0 ? carrito.reduce((s, i) => s + i.cantidad * dias * i.maquina.tarifaDiaria, 0) : 0

  const confirmarAlquiler = async () => {
    if (!carrito.length) { setError('El comprobante está vacío'); return }
    if (!fechaInicio || !fechaFin) { setError('Seleccioná la fecha de inicio y de fin del alquiler'); return }
    if (dias < 1) { setError('La fecha de fin debe ser posterior a la de inicio'); return }
    setProcesando(true); setError('')
    try {
      const ids: number[] = []
      // Cada unidad de cada máquina es un alquiler propio (así se descuenta stock de a una unidad)
      for (const item of carrito) {
        for (let i = 0; i < item.cantidad; i++) {
          const res = await fetch(`${API}/rentals`, {
            method: 'POST', headers,
            body: JSON.stringify({
              maquinaId: item.maquina.id,
              clienteId: clienteId ? Number(clienteId) : null,
              fechaInicio, fechaFin,
            }),
          })
          if (!res.ok) { const d = await res.json(); throw new Error(d.message) }
          const alquiler = await res.json()
          ids.push(alquiler.id)
        }
      }
      setComprobante({
        ids, fecha: new Date(), items: [...carrito], dias, total,
        cliente: clientes.find(c => String(c.id) === clienteId)?.nombre ?? null,
        fechaInicio, fechaFin, registradoPor: user.nombre,
      })
      setCarrito([]); setBusqueda(''); setClienteId(''); setFechaInicio(''); setFechaFin('')
      fetchMaquinas()
    } catch (e: any) { setError(e.message) }
    finally { setProcesando(false); setCantidad('1') }
  }

  const cerrarComprobante = () => {
    setComprobante(null)
    setTimeout(() => { cantidadRef.current?.focus() }, 100)
  }

  const onCantidadKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); busquedaRef.current?.focus(); busquedaRef.current?.select() }
  }
  const onBusquedaKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSugerenciaIdx(i => Math.min(i + 1, sugerencias.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSugerenciaIdx(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (sugerencias.length > 0) agregarMaquina(sugerencias[sugerenciaIdx]) }
    else if (e.key === 'Escape') { setSugerencias([]); setBusqueda(''); cantidadRef.current?.focus() }
  }

  return (
    <div style={s.wrap}>
      <div style={s.container}>

        {/* ── Header ── */}
        <div style={s.header}>
          <div style={s.headerLeft}>
            <span style={s.headerIcon}><i className="bi bi-house-door" /></span>
            <div>
              <h2 style={s.title}>Punto de Alquiler</h2>
              <p style={s.subtitle}>{user.nombre}</p>
            </div>
          </div>
          {carrito.length > 0 && (
            <button style={s.btnLimpiar} onClick={() => { setCarrito([]); setCantidad('1'); setError('') }}>
              Limpiar comprobante
            </button>
          )}
        </div>

        <div style={s.divider} />

        {/* ── Período ── */}
        <div style={s.inputRow}>
          <div style={s.inputGroup}>
            <label style={s.label}>FECHA DE INICIO</label>
            <input style={s.inputFecha} type="date" value={fechaInicio}
              onChange={e => setFechaInicio(e.target.value)} />
          </div>
          <div style={s.inputGroup}>
            <label style={s.label}>FECHA DE FIN</label>
            <input style={s.inputFecha} type="date" value={fechaFin}
              onChange={e => setFechaFin(e.target.value)} />
          </div>
          {dias > 0 && (
            <div style={s.diasBadge}>{dias} día{dias > 1 ? 's' : ''}</div>
          )}
        </div>

        {/* ── Ingreso ── */}
        <div style={s.inputRow}>
          <div style={s.inputGroup}>
            <label style={s.label}>CANT.</label>
            <input
              ref={cantidadRef} style={s.inputCant}
              type="number" min="1" value={cantidad}
              onChange={e => setCantidad(e.target.value)}
              onKeyDown={onCantidadKeyDown}
              onFocus={e => e.target.select()}
              autoFocus
            />
          </div>
          <div style={{ ...s.inputGroup, flex: 1, position: 'relative' }}>
            <label style={s.label}>MÁQUINA — nombre o código interno</label>
            <input
              ref={busquedaRef} style={s.inputBusqueda}
              type="text" placeholder="Escribí y presioná Enter..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              onKeyDown={onBusquedaKeyDown}
              autoComplete="off"
            />
            {sugerencias.length > 0 && (
              <div style={s.dropdown}>
                {sugerencias.map((m, i) => (
                  <div key={m.id}
                    style={{ ...s.dropItem, ...(i === sugerenciaIdx ? s.dropActive : {}) }}
                    onMouseEnter={() => setSugerenciaIdx(i)}
                    onMouseDown={() => agregarMaquina(m)}
                  >
                    <span style={s.dropCod}>{m.codigo ?? '—'}</span>
                    <span style={s.dropNom}>{m.nombre}</span>
                    <span style={s.dropCat}>{m.tipo ?? m.marca ?? ''}</span>
                    <span style={s.dropPrecio}>${fmt(m.tarifaDiaria)}/día</span>
                    <span style={{ ...s.dropStock, color: m.stock <= 1 ? '#97640B' : '#1E7A45' }}>{m.stock} u.</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {error && <div style={s.errorBanner}><i className="bi bi-exclamation-triangle-fill" /> {error}</div>}

        <div style={s.divider} />

        {/* ── Comprobante ── */}
        <div style={s.comprobanteHead}>
          <span style={{ ...s.th, flex: 1 }}>Máquina</span>
          <span style={{ ...s.th, width: '80px', textAlign: 'center' }}>Cant.</span>
          <span style={{ ...s.th, width: '110px', textAlign: 'right' }}>Tarifa/día</span>
          <span style={{ ...s.th, width: '120px', textAlign: 'right' }}>Subtotal</span>
          <span style={{ width: '32px' }} />
        </div>

        <div style={s.itemsArea}>
          {carrito.length === 0 ? (
            <div style={s.vacio}>Sin máquinas — buscá una arriba y presioná Enter</div>
          ) : carrito.map((item, idx) => (
            <div key={item.maquina.id} style={s.itemRow}>
              <div style={{ flex: 1 }}>
                <p style={s.itemNombre}>{item.maquina.nombre}</p>
                <p style={s.itemSub}>{item.maquina.codigo ?? ''}{item.maquina.codigo ? ' · ' : ''}{item.maquina.tipo ?? item.maquina.marca ?? ''}</p>
              </div>
              <div style={{ width: '80px', display: 'flex', justifyContent: 'center' }}>
                <input style={s.cantItem} type="number" min="1" max={item.maquina.stock}
                  value={item.cantidad} onChange={e => cambiarCantidadItem(idx, e.target.value)} />
              </div>
              <span style={{ ...s.cell, width: '110px', textAlign: 'right' }}>${fmt(item.maquina.tarifaDiaria)}</span>
              <span style={{ ...s.cell, width: '120px', textAlign: 'right', color: '#111111', fontWeight: 700 }}>
                ${fmt(item.cantidad * dias * item.maquina.tarifaDiaria)}
              </span>
              <button style={s.btnX} onClick={() => quitarItem(idx)}><i className="bi bi-x-lg" /></button>
            </div>
          ))}
        </div>

        <div style={s.divider} />

        {/* ── Cliente ── */}
        <div style={s.inputGroup}>
          <label style={s.label}>CLIENTE (opcional)</label>
          <select style={s.selectCliente} value={clienteId} onChange={e => setClienteId(e.target.value)}>
            <option value="">Sin cliente</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>

        <div style={s.divider} />

        {/* ── Total ── */}
        <div style={s.totalPagoRow}>
          <div style={s.totalBlock}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
              <span style={s.totalLabel}>TOTAL</span>
              <span style={s.totalValor}>${fmt(total)}</span>
            </div>
          </div>
        </div>

        <div style={s.divider} />

        {/* ── Confirmar ── */}
        <button
          style={{ ...s.btnConfirmar, ...(!carrito.length || dias < 1 || procesando ? s.btnOff : {}) }}
          onClick={confirmarAlquiler}
          disabled={!carrito.length || dias < 1 || procesando}
        >
          <i className="bi bi-check-lg" /> {procesando ? 'Procesando...' : 'Confirmar Alquiler'}
        </button>

      </div>

      {/* ── Modal Comprobante ── */}
      {comprobante && (
        <div style={s.overlay}>
          <div style={s.modal}>

            {/* Ticket */}
            <div id="ticket" style={s.ticket}>
              {/* Cabecera empresa */}
              <div style={s.ticketHeader}>
                <div style={s.ticketLogo}>SH</div>
                <h1 style={s.ticketEmpresa}>SH Servicios</h1>
                <p style={s.ticketSubEmpresa}>Insumos y Soluciones Técnicas</p>
                <div style={s.ticketSep}>━━━━━━━━━━━━━━━━━━━━━━━━</div>
                <p style={s.ticketTipo}>COMPROBANTE DE ALQUILER</p>
                <div style={s.ticketSep}>━━━━━━━━━━━━━━━━━━━━━━━━</div>
              </div>

              {/* Datos del alquiler */}
              <div style={s.ticketMeta}>
                <div style={s.ticketMetaRow}>
                  <span style={s.ticketMetaKey}>N° Comprobante</span>
                  <span style={s.ticketMetaVal}>#{String(comprobante.ids[0]).padStart(6, '0')}</span>
                </div>
                <div style={s.ticketMetaRow}>
                  <span style={s.ticketMetaKey}>Fecha</span>
                  <span style={s.ticketMetaVal}>{fmtFecha(comprobante.fecha)}</span>
                </div>
                <div style={s.ticketMetaRow}>
                  <span style={s.ticketMetaKey}>Período</span>
                  <span style={s.ticketMetaVal}>{fmtFechaCorta(comprobante.fechaInicio)} al {fmtFechaCorta(comprobante.fechaFin)} ({comprobante.dias} día{comprobante.dias > 1 ? 's' : ''})</span>
                </div>
                <div style={s.ticketMetaRow}>
                  <span style={s.ticketMetaKey}>Registrado por</span>
                  <span style={s.ticketMetaVal}>{comprobante.registradoPor}</span>
                </div>
                {comprobante.cliente && (
                  <div style={s.ticketMetaRow}>
                    <span style={s.ticketMetaKey}>Cliente</span>
                    <span style={s.ticketMetaVal}>{comprobante.cliente}</span>
                  </div>
                )}
              </div>

              <div style={s.ticketSep}>- - - - - - - - - - - - - - - - - - - - - - -</div>

              {/* Encabezado items */}
              <div style={s.ticketItemHead}>
                <span style={{ flex: 1, minWidth: 0 }}>Descripción</span>
                <span style={s.ticketCol1}>Cant</span>
                <span style={{ ...s.ticketColNum, textAlign: 'right' }}>Tarifa/día</span>
                <span style={{ ...s.ticketColNum, textAlign: 'right' }}>Subtotal</span>
              </div>
              <div style={s.ticketSep}>- - - - - - - - - - - - - - - - - - - - - - -</div>

              {/* Items */}
              {comprobante.items.map((item, i) => (
                <div key={i} style={s.ticketItem}>
                  <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                    <p style={s.ticketItemNombre}>{item.maquina.nombre}</p>
                    {item.maquina.codigo && <p style={s.ticketItemCod}>Cód: {item.maquina.codigo}</p>}
                  </div>
                  <span style={{ ...s.ticketCol1, textAlign: 'center', color: '#1A1A1A' }}>{item.cantidad}</span>
                  <span style={{ ...s.ticketColNum, textAlign: 'right', color: '#1A1A1A' }}>${fmt(item.maquina.tarifaDiaria)}</span>
                  <span style={{ ...s.ticketColNum, textAlign: 'right', fontWeight: 700, color: '#1A1A1A' }}>${fmt(item.cantidad * comprobante.dias * item.maquina.tarifaDiaria)}</span>
                </div>
              ))}

              <div style={s.ticketSep}>━━━━━━━━━━━━━━━━━━━━━━━━</div>

              {/* Total */}
              <div style={s.ticketTotal}>
                <span>TOTAL</span>
                <span>${fmt(comprobante.total)}</span>
              </div>

              <div style={s.ticketSep}>━━━━━━━━━━━━━━━━━━━━━━━━</div>
              <p style={s.ticketGracias}>¡Gracias por confiar en SH Servicios!</p>
            </div>

            {/* Botones */}
            <div style={s.modalBtns}>
              <button style={s.btnImprimir} onClick={() => window.print()}><i className="bi bi-printer" /> Imprimir</button>
              <button style={s.btnCerrar} onClick={cerrarComprobante}>Nuevo alquiler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrap:        { padding: '24px 28px', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxSizing: 'border-box' as const },
  container:   { background: '#FFFFFF', border: '1px solid #E2E4E8', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '860px', flex: 1, minHeight: 0, overflow: 'hidden' },

  header:      { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft:  { display: 'flex', alignItems: 'center', gap: '12px' },
  headerIcon:  { fontSize: '22px', background: '#F5F5F5', color: '#111111', borderRadius: '10px', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  title:       { color: '#111111', fontSize: '18px', fontWeight: '700', margin: 0 },
  subtitle:    { color: '#6B6B6B', fontSize: '12px', margin: '2px 0 0' },
  btnLimpiar:  { background: '#FFFFFF', border: '1px solid #E2E4E8', borderRadius: '7px', color: '#6B6B6B', fontSize: '12px', padding: '6px 14px', cursor: 'pointer' },

  divider:     { height: '1px', background: '#EFF1F4' },

  inputRow:    { display: 'flex', gap: '12px', alignItems: 'flex-end' },
  inputGroup:  { display: 'flex', flexDirection: 'column', gap: '5px' },
  label:       { color: '#6B6B6B', fontSize: '10px', fontWeight: '700', letterSpacing: '1px' },
  inputFecha:  { background: '#FFFFFF', border: '1px solid #D3D3D3', borderRadius: '8px', padding: '10px 12px', color: '#111111', fontSize: '14px', outline: 'none' },
  diasBadge:   { background: 'rgba(245,196,0,0.15)', color: '#8A6D00', border: '1px solid rgba(245,196,0,0.4)', borderRadius: '8px', padding: '9px 14px', fontSize: '13px', fontWeight: '700' },
  inputCant:   { width: '72px', background: '#FFFFFF', border: '2px solid #F5C400', borderRadius: '8px', padding: '10px', color: '#8A6D00', fontSize: '18px', fontWeight: '700', outline: 'none', textAlign: 'center' },
  inputBusqueda: { width: '100%', background: '#FFFFFF', border: '1px solid #D3D3D3', borderRadius: '8px', padding: '11px 14px', color: '#111111', fontSize: '14px', outline: 'none', boxSizing: 'border-box' as const },
  selectCliente: { background: '#FFFFFF', border: '1px solid #D3D3D3', borderRadius: '8px', padding: '10px 14px', color: '#111111', fontSize: '14px', outline: 'none', minWidth: '220px' },

  dropdown:    { position: 'absolute', top: '100%', left: 0, right: 0, background: '#FFFFFF', border: '1px solid #E2E4E8', borderRadius: '10px', zIndex: 100, marginTop: '4px', overflow: 'hidden', boxShadow: '0 8px 24px rgba(17,17,17,.18)' },
  dropItem:    { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #EFF1F4' },
  dropActive:  { background: '#FFFDF3' },
  dropCod:     { fontFamily: 'monospace', fontSize: '11px', color: '#111111', background: '#F5F5F5', border: '1px solid #E2E4E8', padding: '2px 7px', borderRadius: '4px', flexShrink: 0 },
  dropNom:     { flex: 1, color: '#111111', fontSize: '13px', fontWeight: '600' },
  dropCat:     { color: '#6B6B6B', fontSize: '11px', flexShrink: 0 },
  dropPrecio:  { color: '#8A6D00', fontWeight: '700', fontSize: '13px', flexShrink: 0 },
  dropStock:   { fontSize: '11px', fontWeight: '600', flexShrink: 0 },

  errorBanner: { background: 'rgba(198,64,47,0.1)', border: '1px solid rgba(198,64,47,0.3)', color: '#C6402F', padding: '10px 14px', borderRadius: '8px', fontSize: '13px' },

  comprobanteHead: { display: 'flex', alignItems: 'center', padding: '0 4px' },
  th:          { color: '#6B6B6B', fontSize: '10px', fontWeight: '700', letterSpacing: '0.8px', textTransform: 'uppercase' as const },

  itemsArea:   { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflowY: 'auto' as const },
  vacio:       { color: '#6B6B6B', fontSize: '13px', textAlign: 'center', padding: '24px' },
  itemRow:     { display: 'flex', alignItems: 'center', padding: '10px 4px', borderBottom: '1px solid #EFF1F4', gap: '8px' },
  itemNombre:  { color: '#111111', fontSize: '14px', fontWeight: '600', margin: 0 },
  itemSub:     { color: '#6B6B6B', fontSize: '11px', margin: '2px 0 0' },
  cell:        { color: '#333333', fontSize: '14px', display: 'flex', alignItems: 'center' },
  cantItem:    { width: '54px', background: '#FFFFFF', border: '1px solid #D3D3D3', borderRadius: '6px', padding: '5px', color: '#111111', fontSize: '13px', outline: 'none', textAlign: 'center' },
  btnX:        { background: 'transparent', border: 'none', color: '#6B6B6B', cursor: 'pointer', fontSize: '13px', padding: '4px 6px', borderRadius: '4px', width: '32px' },

  totalPagoRow:{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '24px', flexWrap: 'wrap' as const },
  totalBlock:  { display: 'flex', alignItems: 'flex-end', gap: '16px' },
  totalLabel:  { color: '#6B6B6B', fontSize: '11px', fontWeight: '700', letterSpacing: '2px' },
  totalValor:  { color: '#111111', fontSize: '30px', fontWeight: '800' },

  btnConfirmar: { padding: '14px', background: '#F5C400', color: '#111111', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: '800', cursor: 'pointer', letterSpacing: '0.5px' },
  btnOff:       { opacity: 0.35, cursor: 'not-allowed' },

  // Modal comprobante
  overlay:     { position: 'fixed', inset: 0, background: 'rgba(17,17,17,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 },
  modal:       { background: '#fff', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' },

  // Ticket
  ticket:           { background: '#fff', width: '320px', fontFamily: '"Courier New", monospace', color: '#1A1A1A', padding: '8px 0' },
  ticketHeader:     { textAlign: 'center', marginBottom: '8px' },
  ticketLogo:       { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', background: '#F5C400', borderRadius: '10px', color: '#111111', fontWeight: '900', fontSize: '18px', marginBottom: '8px' },
  ticketEmpresa:    { fontSize: '18px', fontWeight: '900', color: '#111111', margin: '0 0 2px' },
  ticketSubEmpresa: { fontSize: '11px', color: '#3A3A3A', margin: '0 0 8px' },
  ticketSep:        { color: '#9A9A9A', fontSize: '11px', textAlign: 'center', margin: '6px 0' },
  ticketTipo:       { fontWeight: '700', fontSize: '13px', letterSpacing: '2px', color: '#111111', margin: '4px 0' },

  ticketMeta:       { margin: '4px 0' },
  ticketMetaRow:    { display: 'flex', justifyContent: 'space-between', fontSize: '12px', margin: '3px 0' },
  ticketMetaKey:    { color: '#6B6B6B' },
  ticketMetaVal:    { color: '#111111', fontWeight: '600' },

  ticketItemHead:   { display: 'flex', fontSize: '11px', fontWeight: '700', color: '#6B6B6B', margin: '4px 0' },
  ticketItem:       { display: 'flex', alignItems: 'flex-start', margin: '5px 0', gap: '2px' },
  ticketItemNombre: { fontSize: '11px', fontWeight: '700', color: '#111111', margin: 0, wordBreak: 'break-word' as const },
  ticketItemCod:    { fontSize: '10px', color: '#9A9A9A', margin: '1px 0 0' },
  ticketCol1:       { width: '32px', flexShrink: 0, fontSize: '11px' },
  ticketColNum:     { width: '88px', flexShrink: 0, fontSize: '11px', whiteSpace: 'nowrap' as const },

  ticketTotal:      { display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: '900', color: '#111111', margin: '4px 0' },
  ticketGracias:    { textAlign: 'center', fontSize: '12px', color: '#6B6B6B', margin: '8px 0 4px', fontStyle: 'italic' },

  modalBtns:   { display: 'flex', gap: '10px' },
  btnImprimir: { flex: 1, padding: '12px', background: '#111111', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' },
  btnCerrar:   { flex: 1, padding: '12px', background: '#F5C400', color: '#111111', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '800', cursor: 'pointer' },
}
