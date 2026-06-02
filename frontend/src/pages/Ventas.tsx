import { useState, useEffect, useRef, useCallback } from 'react'
import type { User } from '../types'
import { API } from '../config'

interface Categoria { id: number; nombre: string }
interface Producto {
  id: number; codigo: string | null; nombre: string
  precio: number; stock: number; categoria: Categoria
}
interface ItemCarrito {
  producto: Producto
  cantidad: number
  precioUnitario: number
}
interface ComprobanteData {
  id: number
  fecha: Date
  items: ItemCarrito[]
  total: number
  medioPago: string
  montoRecibido: number | null
  vendedor: string
}

const MEDIOS = ['Efectivo', 'Débito', 'Crédito', 'Transferencia']
const fmt = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtFecha = (d: Date) => d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export default function Ventas({ user }: { user: User }) {
  const [productos, setProductos] = useState<Producto[]>([])
  const [carrito, setCarrito] = useState<ItemCarrito[]>([])
  const [cantidad, setCantidad] = useState('1')
  const [busqueda, setBusqueda] = useState('')
  const [sugerencias, setSugerencias] = useState<Producto[]>([])
  const [sugerenciaIdx, setSugerenciaIdx] = useState(0)
  const [medioPago, setMedioPago] = useState('Efectivo')
  const [montoRecibido, setMontoRecibido] = useState('')
  const [error, setError] = useState('')
  const [procesando, setProcesando] = useState(false)
  const [comprobante, setComprobante] = useState<ComprobanteData | null>(null)

  const cantidadRef = useRef<HTMLInputElement>(null)
  const busquedaRef = useRef<HTMLInputElement>(null)

  const token = localStorage.getItem('token') ?? ''
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

  useEffect(() => {
    fetch(`${API}/products`, { headers }).then(r => r.json()).then(setProductos)
  }, [])

  useEffect(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) { setSugerencias([]); return }
    setSugerencias(
      productos.filter(p => p.stock > 0 && (
        p.nombre.toLowerCase().includes(q) || (p.codigo?.toLowerCase().includes(q))
      )).slice(0, 8)
    )
    setSugerenciaIdx(0)
  }, [busqueda, productos])

  const agregarProducto = useCallback((producto: Producto) => {
    const cant = Math.max(1, parseInt(cantidad) || 1)
    if (cant > producto.stock) { setError(`Stock insuficiente (disponible: ${producto.stock})`); return }
    setCarrito(prev => {
      const idx = prev.findIndex(i => i.producto.id === producto.id)
      if (idx >= 0) {
        const nueva = [...prev]
        const nuevaCant = nueva[idx].cantidad + cant
        if (nuevaCant > producto.stock) { setError(`Stock insuficiente (disponible: ${producto.stock})`); return prev }
        nueva[idx] = { ...nueva[idx], cantidad: nuevaCant }
        return nueva
      }
      return [...prev, { producto, cantidad: cant, precioUnitario: producto.precio }]
    })
    setError(''); setBusqueda(''); setSugerencias([])
    setCantidad('1'); cantidadRef.current?.focus(); cantidadRef.current?.select()
  }, [cantidad])

  const quitarItem = (idx: number) => setCarrito(prev => prev.filter((_, i) => i !== idx))

  const cambiarCantidadItem = (idx: number, val: string) => {
    const n = parseInt(val)
    if (isNaN(n) || n < 1) return
    if (n > carrito[idx].producto.stock) { setError(`Stock insuficiente (disponible: ${carrito[idx].producto.stock})`); return }
    setError('')
    setCarrito(prev => { const c = [...prev]; c[idx] = { ...c[idx], cantidad: n }; return c })
  }

  const total = carrito.reduce((s, i) => s + i.cantidad * i.precioUnitario, 0)
  const vuelto = medioPago === 'Efectivo' && montoRecibido ? parseFloat(montoRecibido) - total : null

  const confirmarVenta = async () => {
    if (!carrito.length) { setError('El comprobante está vacío'); return }
    setProcesando(true); setError('')
    try {
      const res = await fetch(`${API}/sales`, {
        method: 'POST', headers,
        body: JSON.stringify({
          items: carrito.map(i => ({ productoId: i.producto.id, cantidad: i.cantidad, precioUnitario: i.precioUnitario })),
          medioPago,
          montoRecibido: medioPago === 'Efectivo' && montoRecibido ? parseFloat(montoRecibido) : null,
        })
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.message) }
      const venta = await res.json()
      setComprobante({
        id: venta.id,
        fecha: new Date(),
        items: [...carrito],
        total,
        medioPago,
        montoRecibido: medioPago === 'Efectivo' && montoRecibido ? parseFloat(montoRecibido) : null,
        vendedor: user.nombre,
      })
      setCarrito([]); setCantidad('1'); setBusqueda(''); setMontoRecibido('')
      fetch(`${API}/products`, { headers }).then(r => r.json()).then(setProductos)
    } catch (e: any) { setError(e.message) }
    finally { setProcesando(false) }
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
    else if (e.key === 'Enter') { e.preventDefault(); if (sugerencias.length > 0) agregarProducto(sugerencias[sugerenciaIdx]) }
    else if (e.key === 'Escape') { setSugerencias([]); setBusqueda(''); cantidadRef.current?.focus() }
  }

  return (
    <div style={s.wrap}>
      <div style={s.container}>

        {/* ── Header ── */}
        <div style={s.header}>
          <div style={s.headerLeft}>
            <span style={s.headerIcon}>🧾</span>
            <div>
              <h2 style={s.title}>Punto de Venta</h2>
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
            <label style={s.label}>PRODUCTO — nombre o código interno</label>
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
                {sugerencias.map((p, i) => (
                  <div key={p.id}
                    style={{ ...s.dropItem, ...(i === sugerenciaIdx ? s.dropActive : {}) }}
                    onMouseEnter={() => setSugerenciaIdx(i)}
                    onMouseDown={() => agregarProducto(p)}
                  >
                    <span style={s.dropCod}>{p.codigo ?? '—'}</span>
                    <span style={s.dropNom}>{p.nombre}</span>
                    <span style={s.dropCat}>{p.categoria.nombre}</span>
                    <span style={s.dropPrecio}>${fmt(p.precio)}</span>
                    <span style={{ ...s.dropStock, color: p.stock <= 5 ? '#fbbf24' : '#4ade80' }}>{p.stock} u.</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {error && <div style={s.errorBanner}>⚠ {error}</div>}

        <div style={s.divider} />

        {/* ── Comprobante ── */}
        <div style={s.comprobanteHead}>
          <span style={{ ...s.th, flex: 1 }}>Producto</span>
          <span style={{ ...s.th, width: '80px', textAlign: 'center' }}>Cant.</span>
          <span style={{ ...s.th, width: '110px', textAlign: 'right' }}>P. Unit.</span>
          <span style={{ ...s.th, width: '120px', textAlign: 'right' }}>Subtotal</span>
          <span style={{ width: '32px' }} />
        </div>

        <div style={s.itemsArea}>
          {carrito.length === 0 ? (
            <div style={s.vacio}>Sin productos — buscá uno arriba y presioná Enter</div>
          ) : carrito.map((item, idx) => (
            <div key={item.producto.id} style={s.itemRow}>
              <div style={{ flex: 1 }}>
                <p style={s.itemNombre}>{item.producto.nombre}</p>
                <p style={s.itemSub}>{item.producto.codigo ?? ''}{item.producto.codigo ? ' · ' : ''}{item.producto.categoria.nombre}</p>
              </div>
              <div style={{ width: '80px', display: 'flex', justifyContent: 'center' }}>
                <input style={s.cantItem} type="number" min="1" max={item.producto.stock}
                  value={item.cantidad} onChange={e => cambiarCantidadItem(idx, e.target.value)} />
              </div>
              <span style={{ ...s.cell, width: '110px', textAlign: 'right' }}>${fmt(item.precioUnitario)}</span>
              <span style={{ ...s.cell, width: '120px', textAlign: 'right', color: '#eab308', fontWeight: 700 }}>
                ${fmt(item.cantidad * item.precioUnitario)}
              </span>
              <button style={s.btnX} onClick={() => quitarItem(idx)}>✕</button>
            </div>
          ))}
        </div>

        <div style={s.divider} />

        {/* ── Medios de pago | Monto recibido | Total ── */}
        <div style={s.totalPagoRow}>
          <div style={s.pagoBlock}>
            <span style={s.label}>MEDIO DE PAGO</span>
            <div style={s.medios}>
              {MEDIOS.map(m => (
                <button key={m}
                  style={{ ...s.medioBtn, ...(medioPago === m ? s.medioBtnOn : {}) }}
                  onClick={() => { setMedioPago(m); if (m !== 'Efectivo') setMontoRecibido('') }}
                >{m}</button>
              ))}
            </div>
          </div>

          {medioPago === 'Efectivo' && (
            <div style={s.inputGroup}>
              <label style={s.label}>MONTO RECIBIDO</label>
              <div style={s.montoWrap}>
                <span style={s.montoSign}>$</span>
                <input style={s.montoInput} type="number" min="0" step="0.01" placeholder="0.00"
                  value={montoRecibido} onChange={e => setMontoRecibido(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && confirmarVenta()} />
              </div>
            </div>
          )}

          <div style={s.totalBlock}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
              <span style={s.totalLabel}>TOTAL</span>
              <span style={s.totalValor}>${fmt(total)}</span>
              {vuelto !== null && (
                <div style={{ ...s.vueltoBox, ...(vuelto < 0 ? s.vueltoNeg : s.vueltoPos) }}>
                  <span style={s.vueltoLabel}>{vuelto < 0 ? 'FALTA' : 'VUELTO'}</span>
                  <span style={s.vueltoValor}>${fmt(Math.abs(vuelto))}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={s.divider} />

        {/* ── Confirmar ── */}
        <button
          style={{ ...s.btnConfirmar, ...(!carrito.length || procesando ? s.btnOff : {}) }}
          onClick={confirmarVenta}
          disabled={!carrito.length || procesando}
        >
          {procesando ? 'Procesando...' : '✓  Confirmar Venta'}
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
                <p style={s.ticketTipo}>COMPROBANTE DE VENTA</p>
                <div style={s.ticketSep}>━━━━━━━━━━━━━━━━━━━━━━━━</div>
              </div>

              {/* Datos de la venta */}
              <div style={s.ticketMeta}>
                <div style={s.ticketMetaRow}>
                  <span style={s.ticketMetaKey}>N° Comprobante</span>
                  <span style={s.ticketMetaVal}>#{String(comprobante.id).padStart(6, '0')}</span>
                </div>
                <div style={s.ticketMetaRow}>
                  <span style={s.ticketMetaKey}>Fecha</span>
                  <span style={s.ticketMetaVal}>{fmtFecha(comprobante.fecha)}</span>
                </div>
                <div style={s.ticketMetaRow}>
                  <span style={s.ticketMetaKey}>Vendedor</span>
                  <span style={s.ticketMetaVal}>{comprobante.vendedor}</span>
                </div>
              </div>

              <div style={s.ticketSep}>- - - - - - - - - - - - - - - - - - - - - - -</div>

              {/* Encabezado items */}
              <div style={s.ticketItemHead}>
                <span style={{ flex: 1, minWidth: 0 }}>Descripción</span>
                <span style={s.ticketCol1}>Cant</span>
                <span style={{ ...s.ticketColNum, textAlign: 'right' }}>P.U.</span>
                <span style={{ ...s.ticketColNum, textAlign: 'right' }}>Subtotal</span>
              </div>
              <div style={s.ticketSep}>- - - - - - - - - - - - - - - - - - - - - - -</div>

              {/* Items */}
              {comprobante.items.map((item, i) => (
                <div key={i} style={s.ticketItem}>
                  <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                    <p style={s.ticketItemNombre}>{item.producto.nombre}</p>
                    {item.producto.codigo && <p style={s.ticketItemCod}>Cód: {item.producto.codigo}</p>}
                  </div>
                  <span style={{ ...s.ticketCol1, textAlign: 'center', color: '#1e293b' }}>{item.cantidad}</span>
                  <span style={{ ...s.ticketColNum, textAlign: 'right', color: '#1e293b' }}>${fmt(item.precioUnitario)}</span>
                  <span style={{ ...s.ticketColNum, textAlign: 'right', fontWeight: 700, color: '#1e293b' }}>${fmt(item.cantidad * item.precioUnitario)}</span>
                </div>
              ))}

              <div style={s.ticketSep}>━━━━━━━━━━━━━━━━━━━━━━━━</div>

              {/* Total */}
              <div style={s.ticketTotal}>
                <span>TOTAL</span>
                <span>${fmt(comprobante.total)}</span>
              </div>

              <div style={s.ticketSep}>- - - - - - - - - - - - - - - - - - - - - - -</div>

              {/* Pago */}
              <div style={s.ticketPago}>
                <div style={s.ticketMetaRow}>
                  <span style={s.ticketMetaKey}>Medio de pago</span>
                  <span style={s.ticketMetaVal}>{comprobante.medioPago}</span>
                </div>
                {comprobante.montoRecibido !== null && (
                  <>
                    <div style={s.ticketMetaRow}>
                      <span style={s.ticketMetaKey}>Monto recibido</span>
                      <span style={s.ticketMetaVal}>${fmt(comprobante.montoRecibido)}</span>
                    </div>
                    <div style={s.ticketMetaRow}>
                      <span style={s.ticketMetaKey}>Vuelto</span>
                      <span style={{ ...s.ticketMetaVal, fontWeight: 700 }}>${fmt(comprobante.montoRecibido - comprobante.total)}</span>
                    </div>
                  </>
                )}
              </div>

              <div style={s.ticketSep}>━━━━━━━━━━━━━━━━━━━━━━━━</div>
              <p style={s.ticketGracias}>¡Gracias por su compra!</p>
            </div>

            {/* Botones */}
            <div style={s.modalBtns}>
              <button style={s.btnImprimir} onClick={() => window.print()}>🖨️ Imprimir</button>
              <button style={s.btnCerrar} onClick={cerrarComprobante}>Nueva venta</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrap:        { padding: '24px 28px', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxSizing: 'border-box' as const },
  container:   { background: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '860px', flex: 1, minHeight: 0, overflow: 'hidden' },

  header:      { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft:  { display: 'flex', alignItems: 'center', gap: '12px' },
  headerIcon:  { fontSize: '28px', background: '#0f172a', borderRadius: '10px', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  title:       { color: '#f1f5f9', fontSize: '18px', fontWeight: '700', margin: 0 },
  subtitle:    { color: '#cbd5e1', fontSize: '12px', margin: '2px 0 0' },
  btnLimpiar:  { background: 'transparent', border: '1px solid #334155', borderRadius: '7px', color: '#94a3b8', fontSize: '12px', padding: '6px 14px', cursor: 'pointer' },

  divider:     { height: '1px', background: '#334155' },

  inputRow:    { display: 'flex', gap: '12px', alignItems: 'flex-end' },
  inputGroup:  { display: 'flex', flexDirection: 'column', gap: '5px' },
  label:       { color: '#cbd5e1', fontSize: '10px', fontWeight: '700', letterSpacing: '1px' },
  inputCant:   { width: '72px', background: '#0f172a', border: '2px solid #eab308', borderRadius: '8px', padding: '10px', color: '#eab308', fontSize: '18px', fontWeight: '700', outline: 'none', textAlign: 'center' },
  inputBusqueda: { width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '11px 14px', color: '#f1f5f9', fontSize: '14px', outline: 'none', boxSizing: 'border-box' as const },

  dropdown:    { position: 'absolute', top: '100%', left: 0, right: 0, background: '#1e293b', border: '1px solid #475569', borderRadius: '10px', zIndex: 100, marginTop: '4px', overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' },
  dropItem:    { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #0f172a' },
  dropActive:  { background: '#334155' },
  dropCod:     { fontFamily: 'monospace', fontSize: '11px', color: '#eab308', background: '#0f172a', border: '1px solid #334155', padding: '2px 7px', borderRadius: '4px', flexShrink: 0 },
  dropNom:     { flex: 1, color: '#f1f5f9', fontSize: '13px', fontWeight: '600' },
  dropCat:     { color: '#94a3b8', fontSize: '11px', flexShrink: 0 },
  dropPrecio:  { color: '#eab308', fontWeight: '700', fontSize: '13px', flexShrink: 0 },
  dropStock:   { fontSize: '11px', fontWeight: '600', flexShrink: 0 },

  errorBanner: { background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', padding: '10px 14px', borderRadius: '8px', fontSize: '13px' },

  comprobanteHead: { display: 'flex', alignItems: 'center', padding: '0 4px' },
  th:          { color: '#cbd5e1', fontSize: '10px', fontWeight: '700', letterSpacing: '0.8px', textTransform: 'uppercase' as const },

  itemsArea:   { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflowY: 'auto' as const },
  vacio:       { color: '#94a3b8', fontSize: '13px', textAlign: 'center', padding: '24px' },
  itemRow:     { display: 'flex', alignItems: 'center', padding: '10px 4px', borderBottom: '1px solid #0f172a', gap: '8px' },
  itemNombre:  { color: '#f1f5f9', fontSize: '14px', fontWeight: '600', margin: 0 },
  itemSub:     { color: '#cbd5e1', fontSize: '11px', margin: '2px 0 0' },
  cell:        { color: '#cbd5e1', fontSize: '14px', display: 'flex', alignItems: 'center' },
  cantItem:    { width: '54px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', padding: '5px', color: '#f1f5f9', fontSize: '13px', outline: 'none', textAlign: 'center' },
  btnX:        { background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '13px', padding: '4px 6px', borderRadius: '4px', width: '32px' },

  totalPagoRow:{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '24px', flexWrap: 'wrap' as const },
  totalBlock:  { display: 'flex', alignItems: 'flex-end', gap: '16px' },
  totalLabel:  { color: '#cbd5e1', fontSize: '11px', fontWeight: '700', letterSpacing: '2px' },
  totalValor:  { color: '#eab308', fontSize: '30px', fontWeight: '800' },
  pagoBlock:   { display: 'flex', flexDirection: 'column', gap: '8px' },
  medios:      { display: 'flex', gap: '6px', flexWrap: 'wrap' as const },
  medioBtn:    { padding: '7px 16px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#94a3b8', fontSize: '13px', fontWeight: '600', cursor: 'pointer' },
  medioBtnOn:  { background: 'rgba(234,179,8,0.1)', border: '1px solid #eab308', color: '#eab308' },

  montoWrap:   { display: 'flex', alignItems: 'center', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', overflow: 'hidden' },
  montoSign:   { color: '#eab308', fontWeight: '700', padding: '0 10px', fontSize: '15px' },
  montoInput:  { background: 'transparent', border: 'none', padding: '10px 10px 10px 0', color: '#f1f5f9', fontSize: '15px', outline: 'none', width: '130px' },
  vueltoBox:   { padding: '8px 14px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' },
  vueltoPos:   { background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)' },
  vueltoNeg:   { background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' },
  vueltoLabel: { fontSize: '10px', fontWeight: '700', letterSpacing: '1px', color: '#4ade80' },
  vueltoValor: { fontSize: '18px', fontWeight: '800', color: '#4ade80' },

  btnConfirmar: { padding: '14px', background: '#eab308', color: '#0f172a', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: '800', cursor: 'pointer', letterSpacing: '0.5px' },
  btnOff:       { opacity: 0.35, cursor: 'not-allowed' },

  // Modal comprobante
  overlay:     { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 },
  modal:       { background: '#fff', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' },

  // Ticket
  ticket:           { background: '#fff', width: '320px', fontFamily: '"Courier New", monospace', color: '#1e293b', padding: '8px 0' },
  ticketHeader:     { textAlign: 'center', marginBottom: '8px' },
  ticketLogo:       { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', background: '#eab308', borderRadius: '10px', color: '#0f172a', fontWeight: '900', fontSize: '18px', marginBottom: '8px' },
  ticketEmpresa:    { fontSize: '18px', fontWeight: '900', color: '#0f172a', margin: '0 0 2px' },
  ticketSubEmpresa: { fontSize: '11px', color: '#475569', margin: '0 0 8px' },
  ticketSep:        { color: '#94a3b8', fontSize: '11px', textAlign: 'center', margin: '6px 0' },
  ticketTipo:       { fontWeight: '700', fontSize: '13px', letterSpacing: '2px', color: '#0f172a', margin: '4px 0' },

  ticketMeta:       { margin: '4px 0' },
  ticketMetaRow:    { display: 'flex', justifyContent: 'space-between', fontSize: '12px', margin: '3px 0' },
  ticketMetaKey:    { color: '#64748b' },
  ticketMetaVal:    { color: '#0f172a', fontWeight: '600' },

  ticketItemHead:   { display: 'flex', fontSize: '11px', fontWeight: '700', color: '#64748b', margin: '4px 0' },
  ticketItem:       { display: 'flex', alignItems: 'flex-start', margin: '5px 0', gap: '2px' },
  ticketItemNombre: { fontSize: '11px', fontWeight: '700', color: '#0f172a', margin: 0, wordBreak: 'break-word' as const },
  ticketItemCod:    { fontSize: '10px', color: '#94a3b8', margin: '1px 0 0' },
  ticketCol1:       { width: '32px', flexShrink: 0, fontSize: '11px' },
  ticketColNum:     { width: '88px', flexShrink: 0, fontSize: '11px', whiteSpace: 'nowrap' as const },

  ticketTotal:      { display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: '900', color: '#0f172a', margin: '4px 0' },
  ticketPago:       { margin: '4px 0' },
  ticketGracias:    { textAlign: 'center', fontSize: '12px', color: '#64748b', margin: '8px 0 4px', fontStyle: 'italic' },

  modalBtns:   { display: 'flex', gap: '10px' },
  btnImprimir: { flex: 1, padding: '12px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' },
  btnCerrar:   { flex: 1, padding: '12px', background: '#eab308', color: '#0f172a', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '800', cursor: 'pointer' },
}
