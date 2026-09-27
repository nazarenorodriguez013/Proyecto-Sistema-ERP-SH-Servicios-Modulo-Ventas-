import { useState, useEffect, useRef } from 'react'
import type { User } from '../types'
import { API, MEDIOS_PAGO, MEDIO_CUENTA_CORRIENTE } from '../config'
import { socket } from '../socket'
import ClienteSelector from '../components/ClienteSelector'

interface Categoria { id: number; nombre: string }
interface Producto {
  id: number; codigo: string | null; nombre: string
  precio: number; stock: number; activo: boolean; categoria: Categoria
}
interface Cliente { id: number; nombre: string; documento: string | null; saldo: number }
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
  cliente: string | null
}

const fmt = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtFecha = (d: Date) => d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export default function Ventas({ user }: { user: User }) {
  const [productos, setProductos] = useState<Producto[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [clienteId, setClienteId] = useState('')
  const [carrito, setCarrito] = useState<ItemCarrito[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [sugerenciaIdx, setSugerenciaIdx] = useState(0)
  const [medioPago, setMedioPago] = useState('Efectivo')
  const [montoRecibido, setMontoRecibido] = useState('')
  const [error, setError] = useState('')
  const [procesando, setProcesando] = useState(false)
  const [comprobante, setComprobante] = useState<ComprobanteData | null>(null)

  const busquedaRef = useRef<HTMLInputElement>(null)

  const token = localStorage.getItem('token') ?? ''
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

  const fetchProductos = () => fetch(`${API}/products`, { headers }).then(r => r.json()).then(setProductos)

  useEffect(() => {
    fetchProductos()
    fetch(`${API}/clients`, { headers }).then(r => r.json()).then(setClientes)
    // Otra terminal vendió o ajustó stock: se recargan los productos para no ofrecer unidades que ya no existen
    socket.on('stock-actualizado', fetchProductos)
    return () => { socket.off('stock-actualizado', fetchProductos) }
  }, [])

  const q = busqueda.trim().toLowerCase()
  const sugerencias = q
    ? productos.filter(p => p.activo && p.stock > 0 && (
        p.nombre.toLowerCase().includes(q) || (p.codigo?.toLowerCase().includes(q))
      )).slice(0, 8)
    : []

  const cambiarBusqueda = (valor: string) => { setBusqueda(valor); setSugerenciaIdx(0) }

  // Cada Enter agrega una unidad (si el producto ya está, suma una); la cantidad se ajusta en el carrito
  const agregarProducto = (producto: Producto) => {
    const enCarrito = carrito.find(i => i.producto.id === producto.id)
    if ((enCarrito?.cantidad ?? 0) + 1 > producto.stock) { setError(`Stock insuficiente (disponible: ${producto.stock})`); return }
    setCarrito(prev => enCarrito
      ? prev.map(i => i.producto.id === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i)
      : [...prev, { producto, cantidad: 1, precioUnitario: producto.precio }])
    setError(''); setBusqueda('')
    busquedaRef.current?.focus()
  }

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
    if (medioPago === MEDIO_CUENTA_CORRIENTE && !clienteId) { setError('Seleccioná un cliente para vender a cuenta corriente'); return }
    setProcesando(true); setError('')
    try {
      const res = await fetch(`${API}/sales`, {
        method: 'POST', headers,
        body: JSON.stringify({
          items: carrito.map(i => ({ productoId: i.producto.id, cantidad: i.cantidad })),
          medioPago,
          montoRecibido: medioPago === 'Efectivo' && montoRecibido ? parseFloat(montoRecibido) : null,
          clienteId: clienteId ? Number(clienteId) : null,
        })
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.message) }
      const venta = await res.json()
      setComprobante({
        id: venta.id,
        fecha: new Date(),
        items: venta.detallesVenta,
        total: venta.total,
        medioPago,
        montoRecibido: medioPago === 'Efectivo' && montoRecibido ? parseFloat(montoRecibido) : null,
        vendedor: user.nombre,
        cliente: venta.cliente?.nombre ?? null,
      })
      setCarrito([]); setBusqueda(''); setMontoRecibido(''); setClienteId(''); setMedioPago('Efectivo')
    } catch (e) { setError((e as Error).message) }
    finally { setProcesando(false) }
  }

  const cerrarComprobante = () => {
    setComprobante(null)
    setTimeout(() => { busquedaRef.current?.focus() }, 100)
  }

  const onBusquedaKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSugerenciaIdx(i => Math.min(i + 1, sugerencias.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSugerenciaIdx(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (sugerencias.length > 0) agregarProducto(sugerencias[sugerenciaIdx]) }
    else if (e.key === 'Escape') setBusqueda('')
  }

  return (
    <div style={s.wrap}>
      <div style={s.container}>

        {/* ── Ingreso ── */}
        <div style={{ ...s.inputGroup, position: 'relative' }}>
          <label style={s.label}>PRODUCTO — buscá por nombre o código y presioná Enter</label>
          <input
            ref={busquedaRef} style={s.inputBusqueda}
            type="text" placeholder="Ej: compresor, 0006..."
            value={busqueda}
            onChange={e => cambiarBusqueda(e.target.value)}
            onKeyDown={onBusquedaKeyDown}
            autoComplete="off"
            autoFocus
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
                    <span style={{ ...s.dropStock, color: p.stock <= 5 ? '#97640B' : '#1E7A45' }}>{p.stock} u.</span>
                  </div>
                ))}
              </div>
            )}
        </div>

        {error && <div style={s.errorBanner}><i className="bi bi-exclamation-triangle-fill" /> {error}</div>}

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
              <span style={{ ...s.cell, width: '120px', textAlign: 'right', color: '#111111', fontWeight: 700 }}>
                ${fmt(item.cantidad * item.precioUnitario)}
              </span>
              <button style={s.btnX} onClick={() => quitarItem(idx)}><i className="bi bi-x-lg" /></button>
            </div>
          ))}
        </div>

        <div style={s.divider} />

        {/* ── Cliente ── */}
        <div style={s.inputGroup}>
          <label style={s.label}>CLIENTE {medioPago === MEDIO_CUENTA_CORRIENTE ? '(obligatorio)' : '(opcional)'}</label>
          <ClienteSelector clientes={clientes} value={clienteId} onChange={setClienteId}
            onCreated={c => setClientes(prev => [...prev, { ...c, saldo: 0 }])} />
        </div>

        <div style={s.divider} />

        {/* ── Medios de pago | Monto recibido | Total ── */}
        <div style={s.totalPagoRow}>
          <div style={s.pagoBlock}>
            <span style={s.label}>MEDIO DE PAGO</span>
            <div style={s.medios}>
              {MEDIOS_PAGO.map(m => (
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
        <div style={s.confirmarRow}>
          {carrito.length > 0 && (
            <button style={s.btnLimpiar} onClick={() => { setCarrito([]); setError('') }}>Cancelar venta</button>
          )}
          <button
            style={{ ...s.btnConfirmar, ...(!carrito.length || procesando ? s.btnOff : {}) }}
            onClick={confirmarVenta}
            disabled={!carrito.length || procesando}
          >
            <i className="bi bi-check-lg" /> {procesando ? 'Procesando...' : 'Confirmar Venta'}
          </button>
        </div>

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
                  <span style={{ ...s.ticketCol1, textAlign: 'center', color: '#1A1A1A' }}>{item.cantidad}</span>
                  <span style={{ ...s.ticketColNum, textAlign: 'right', color: '#1A1A1A' }}>${fmt(item.precioUnitario)}</span>
                  <span style={{ ...s.ticketColNum, textAlign: 'right', fontWeight: 700, color: '#1A1A1A' }}>${fmt(item.cantidad * item.precioUnitario)}</span>
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
              <button style={s.btnImprimir} onClick={() => window.print()}><i className="bi bi-printer" /> Imprimir</button>
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
  container:   { background: '#FFFFFF', border: '1px solid #E2E4E8', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '860px', flex: 1, minHeight: 0, overflow: 'hidden' },

  btnLimpiar:  { background: '#FFFFFF', border: '1px solid #E2E4E8', borderRadius: '10px', color: '#6B6B6B', fontSize: '14px', fontWeight: '600', padding: '14px 20px', cursor: 'pointer' },

  divider:     { height: '1px', background: '#EFF1F4' },

  inputGroup:  { display: 'flex', flexDirection: 'column', gap: '5px' },
  label:       { color: '#6B6B6B', fontSize: '10px', fontWeight: '700', letterSpacing: '1px' },
  inputBusqueda: { width: '100%', background: '#FFFFFF', border: '1px solid #D3D3D3', borderRadius: '8px', padding: '11px 14px', color: '#111111', fontSize: '14px', outline: 'none', boxSizing: 'border-box' as const },

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

  totalPagoRow:{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '24px', flexWrap: 'wrap' as const },
  totalBlock:  { display: 'flex', alignItems: 'flex-end', gap: '16px' },
  totalLabel:  { color: '#6B6B6B', fontSize: '11px', fontWeight: '700', letterSpacing: '2px' },
  totalValor:  { color: '#111111', fontSize: '30px', fontWeight: '800' },
  pagoBlock:   { display: 'flex', flexDirection: 'column', gap: '8px' },
  medios:      { display: 'flex', gap: '6px', flexWrap: 'wrap' as const },
  medioBtn:    { padding: '7px 16px', background: '#FFFFFF', border: '1px solid #D3D3D3', borderRadius: '8px', color: '#6B6B6B', fontSize: '13px', fontWeight: '600', cursor: 'pointer' },
  medioBtnOn:  { background: 'rgba(245,196,0,0.15)', border: '1px solid #F5C400', color: '#8A6D00' },

  montoWrap:   { display: 'flex', alignItems: 'center', background: '#FFFFFF', border: '1px solid #D3D3D3', borderRadius: '8px', overflow: 'hidden' },
  montoSign:   { color: '#8A6D00', fontWeight: '700', padding: '0 10px', fontSize: '15px' },
  montoInput:  { background: 'transparent', border: 'none', padding: '10px 10px 10px 0', color: '#111111', fontSize: '15px', outline: 'none', width: '130px' },
  vueltoBox:   { padding: '8px 14px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' },
  vueltoPos:   { background: '#E4F5EA', border: '1px solid #CDEBD9' },
  vueltoNeg:   { background: '#FBE5E2', border: '1px solid rgba(198,64,47,0.2)' },
  vueltoLabel: { fontSize: '10px', fontWeight: '700', letterSpacing: '1px', color: '#1E7A45' },
  vueltoValor: { fontSize: '18px', fontWeight: '800', color: '#1E7A45' },

  confirmarRow: { display: 'flex', gap: '10px' },
  btnConfirmar: { flex: 1, padding: '14px', background: '#F5C400', color: '#111111', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: '800', cursor: 'pointer', letterSpacing: '0.5px' },
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
  ticketPago:       { margin: '4px 0' },
  ticketGracias:    { textAlign: 'center', fontSize: '12px', color: '#6B6B6B', margin: '8px 0 4px', fontStyle: 'italic' },

  modalBtns:   { display: 'flex', gap: '10px' },
  btnImprimir: { flex: 1, padding: '12px', background: '#111111', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' },
  btnCerrar:   { flex: 1, padding: '12px', background: '#F5C400', color: '#111111', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '800', cursor: 'pointer' },
}
