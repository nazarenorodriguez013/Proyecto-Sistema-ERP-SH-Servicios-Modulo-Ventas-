import { useState, useEffect, useRef } from 'react'
import type { User } from '../types'
import { API, MEDIOS_PAGO, MEDIO_CUENTA_CORRIENTE, TIPOS_COMPROBANTE, TIPO_COMPROBANTE_LABEL, type TipoComprobante } from '../config'
import { socket } from '../socket'
import ClienteSelector from '../components/ClienteSelector'
import Comprobante, { type ComprobanteData } from '../components/Comprobante'

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

const fmt = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function Ventas({ user }: { user: User }) {
  const [productos, setProductos] = useState<Producto[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [clienteId, setClienteId] = useState('')
  const [usarSaldo, setUsarSaldo] = useState(true)
  const [tipoComprobante, setTipoComprobante] = useState<TipoComprobante>('FACTURA')
  const [carrito, setCarrito] = useState<ItemCarrito[]>([])
  const [cantidad, setCantidad] = useState('1')
  const [busqueda, setBusqueda] = useState('')
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

  const esPresupuesto = tipoComprobante === 'PRESUPUESTO'
  const requierePago = !esPresupuesto
  const esCuentaCorriente = requierePago && medioPago === MEDIO_CUENTA_CORRIENTE

  const fetchProductos = () => fetch(`${API}/products`, { headers }).then(r => r.json()).then(setProductos)
  const fetchClientes = () => fetch(`${API}/clients`, { headers }).then(r => r.json()).then(setClientes)

  useEffect(() => {
    fetchProductos()
    fetchClientes()
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

  // Agrega la cantidad tipeada arriba (si el producto ya está, la suma); después vuelve el foco a CANT.
  const agregarProducto = (producto: Producto) => {
    const cant = Math.max(1, parseInt(cantidad) || 1)
    const enCarrito = carrito.find(i => i.producto.id === producto.id)
    if ((enCarrito?.cantidad ?? 0) + cant > producto.stock) { setError(`Stock insuficiente (disponible: ${producto.stock})`); return }
    setCarrito(prev => enCarrito
      ? prev.map(i => i.producto.id === producto.id ? { ...i, cantidad: i.cantidad + cant } : i)
      : [...prev, { producto, cantidad: cant, precioUnitario: producto.precio }])
    setError(''); setBusqueda(''); setCantidad('1')
    cantidadRef.current?.focus(); cantidadRef.current?.select()
  }

  const quitarItem = (idx: number) => setCarrito(prev => prev.filter((_, i) => i !== idx))

  const incrementarCantidad = (idx: number) => {
    const item = carrito[idx]
    if (item.cantidad + 1 > item.producto.stock) { setError(`Stock insuficiente (disponible: ${item.producto.stock})`); return }
    setError('')
    setCarrito(prev => { const c = [...prev]; c[idx] = { ...c[idx], cantidad: c[idx].cantidad + 1 }; return c })
  }

  const decrementarCantidad = (idx: number) => {
    setError('')
    setCarrito(prev => { const c = [...prev]; c[idx] = { ...c[idx], cantidad: Math.max(1, c[idx].cantidad - 1) }; return c })
  }

  const onCantidadKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); busquedaRef.current?.focus(); busquedaRef.current?.select() }
  }

  const total = carrito.reduce((s, i) => s + i.cantidad * i.precioUnitario, 0)
  // El saldo a favor del cliente se descuenta del total; a cuenta corriente se descuenta siempre (es la misma cuenta)
  const saldoAFavor = Math.max(0, -(clientes.find(c => String(c.id) === clienteId)?.saldo ?? 0))
  const saldoAplicado = !esPresupuesto && saldoAFavor && (esCuentaCorriente || usarSaldo) ? Math.min(saldoAFavor, total) : 0
  const aPagar = total - saldoAplicado
  const vuelto = requierePago && medioPago === 'Efectivo' && montoRecibido ? parseFloat(montoRecibido) - aPagar : null

  const elegirCliente = (id: string) => { setClienteId(id); setUsarSaldo(true) }

  const cambiarTipoComprobante = (t: TipoComprobante) => {
    setTipoComprobante(t)
    if (t !== 'FACTURA' && t !== 'REMITO') setMontoRecibido('')
  }

  const confirmarVenta = async () => {
    if (!carrito.length) { setError(esPresupuesto ? 'El presupuesto está vacío' : 'El comprobante está vacío'); return }
    if (esCuentaCorriente && !clienteId) { setError('Seleccioná un cliente para vender a cuenta corriente'); return }
    setProcesando(true); setError('')
    try {
      const res = await fetch(`${API}/sales`, {
        method: 'POST', headers,
        body: JSON.stringify({
          items: carrito.map(i => ({ productoId: i.producto.id, cantidad: i.cantidad })),
          tipoComprobante,
          medioPago: requierePago ? medioPago : null,
          montoRecibido: requierePago && medioPago === 'Efectivo' && montoRecibido ? parseFloat(montoRecibido) : null,
          clienteId: clienteId ? Number(clienteId) : null,
          usarSaldo,
        })
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.message) }
      const venta = await res.json()
      setComprobante({
        id: venta.id,
        fecha: new Date(),
        tipoComprobante,
        items: venta.detallesVenta,
        total: venta.total,
        saldoAplicado: venta.saldoAplicado,
        medioPago: venta.medioPago,
        montoRecibido: requierePago && medioPago === 'Efectivo' && montoRecibido ? parseFloat(montoRecibido) : null,
        vendedor: user.nombre,
        cliente: venta.cliente?.nombre ?? null,
      })
      setCarrito([]); setCantidad('1'); setBusqueda(''); setMontoRecibido(''); setClienteId(''); setUsarSaldo(true); setMedioPago('Efectivo'); setTipoComprobante('FACTURA')
      if (!esPresupuesto) fetchClientes()
    } catch (e) { setError((e as Error).message) }
    finally { setProcesando(false) }
  }

  const cerrarComprobante = () => {
    setComprobante(null)
    setTimeout(() => { cantidadRef.current?.focus() }, 100)
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

        {/* ── Tipo de comprobante + Cliente (siempre arriba) ── */}
        <div style={s.topRow}>
          <div style={s.inputGroup}>
            <label style={s.label}>TIPO DE COMPROBANTE</label>
            <div style={s.tipos}>
              {TIPOS_COMPROBANTE.map(t => (
                <button key={t} type="button"
                  style={{ ...s.tipoBtn, ...(tipoComprobante === t ? s.tipoBtnOn : {}) }}
                  onClick={() => cambiarTipoComprobante(t)}
                >{TIPO_COMPROBANTE_LABEL[t]}</button>
              ))}
            </div>
          </div>
          <div style={{ ...s.inputGroup, flex: 1, minWidth: '260px' }}>
            <label style={s.label}>CLIENTE {esCuentaCorriente ? '(obligatorio)' : '(opcional)'}</label>
            <ClienteSelector clientes={clientes} value={clienteId} onChange={elegirCliente}
              onCreated={c => setClientes(prev => [...prev, { ...c, saldo: 0 }])} />
            {saldoAFavor > 0 && !esPresupuesto && (esCuentaCorriente
              ? <span style={s.saldoNota}>A cuenta corriente se descuenta primero su saldo a favor de ${fmt(saldoAFavor)}</span>
              : (
                <label style={s.saldoCheck}>
                  <input type="checkbox" checked={usarSaldo} onChange={e => setUsarSaldo(e.target.checked)} />
                  Usar saldo a favor (${fmt(saldoAFavor)})
                </label>
              ))}
          </div>
        </div>

        <div style={s.divider} />

        {/* ── Ingreso ── */}
        <div style={s.ingresoRow}>
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
            <label style={s.label}>PRODUCTO — buscá por nombre o código y presioná Enter</label>
            <input
              ref={busquedaRef} style={s.inputBusqueda}
              type="text" placeholder="Ej: compresor, 0006..."
              value={busqueda}
              onChange={e => cambiarBusqueda(e.target.value)}
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
                      <span style={{ ...s.dropStock, color: p.stock <= 5 ? '#97640B' : '#1E7A45' }}>{p.stock} u.</span>
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
          <span style={{ ...s.th, flex: 1 }}>Producto</span>
          <span style={{ ...s.th, width: '96px', textAlign: 'center' }}>Cant.</span>
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
              <div style={{ width: '96px', display: 'flex', justifyContent: 'center' }}>
                <div style={s.cantControl}>
                  <button type="button" style={s.cantBtn} onClick={() => decrementarCantidad(idx)}>−</button>
                  <span style={s.cantValor}>{item.cantidad}</span>
                  <button type="button" style={s.cantBtn} onClick={() => incrementarCantidad(idx)}>+</button>
                </div>
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

        {/* ── Medios de pago | Monto recibido | Total ── */}
        <div style={s.totalPagoRow}>
          {requierePago && (
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
          )}

          {requierePago && medioPago === 'Efectivo' && (
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
              {saldoAplicado > 0 ? (
                <>
                  <span style={s.subtotal}>Total ${fmt(total)}</span>
                  <span style={s.descuento}>Saldo a favor −${fmt(saldoAplicado)}</span>
                  <span style={s.totalLabel}>{esCuentaCorriente ? 'A CUENTA CORRIENTE' : 'A PAGAR'}</span>
                  <span style={s.totalValor}>${fmt(aPagar)}</span>
                </>
              ) : (
                <>
                  <span style={s.totalLabel}>TOTAL</span>
                  <span style={s.totalValor}>${fmt(total)}</span>
                </>
              )}
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
            <button style={s.btnLimpiar} onClick={() => { setCarrito([]); setError('') }}>Cancelar</button>
          )}
          <button
            style={{ ...s.btnConfirmar, ...(!carrito.length || procesando ? s.btnOff : {}) }}
            onClick={confirmarVenta}
            disabled={!carrito.length || procesando}
          >
            <i className="bi bi-check-lg" /> {procesando ? 'Procesando...' : esPresupuesto ? 'Generar Presupuesto' : 'Confirmar Venta'}
          </button>
        </div>

      </div>

      {comprobante && <Comprobante data={comprobante} onClose={cerrarComprobante} />}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrap:        { padding: '20px 24px', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxSizing: 'border-box' as const },
  container:   { background: '#FFFFFF', border: '1px solid #E2E4E8', borderRadius: '16px', padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '860px', flex: 1, minHeight: 0, overflow: 'hidden' },

  topRow:      { display: 'flex', gap: '20px', flexWrap: 'wrap' as const, alignItems: 'flex-start' },
  tipos:       { display: 'flex', gap: '6px', flexWrap: 'wrap' as const },
  tipoBtn:     { padding: '7px 14px', background: '#FFFFFF', border: '1px solid #D3D3D3', borderRadius: '8px', color: '#6B6B6B', fontSize: '13px', fontWeight: '600', cursor: 'pointer' },
  tipoBtnOn:   { background: 'rgba(245,196,0,0.15)', border: '1px solid #F5C400', color: '#8A6D00' },

  btnLimpiar:  { background: '#FFFFFF', border: '1px solid #E2E4E8', borderRadius: '10px', color: '#6B6B6B', fontSize: '14px', fontWeight: '600', padding: '12px 20px', cursor: 'pointer' },

  divider:     { height: '1px', background: '#EFF1F4' },

  inputGroup:  { display: 'flex', flexDirection: 'column', gap: '5px' },
  label:       { color: '#6B6B6B', fontSize: '10px', fontWeight: '700', letterSpacing: '1px' },
  inputBusqueda: { width: '100%', background: '#FFFFFF', border: '1px solid #D3D3D3', borderRadius: '8px', padding: '9px 14px', color: '#111111', fontSize: '14px', outline: 'none', boxSizing: 'border-box' as const },
  ingresoRow:  { display: 'flex', gap: '10px', alignItems: 'flex-end' },
  inputCant:   { width: '64px', background: '#FFFFFF', border: '2px solid #F5C400', borderRadius: '8px', padding: '9px', color: '#8A6D00', fontSize: '15px', fontWeight: '700', outline: 'none', textAlign: 'center' as const },

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
  itemRow:     { display: 'flex', alignItems: 'center', padding: '8px 4px', borderBottom: '1px solid #EFF1F4', gap: '8px' },
  itemNombre:  { color: '#111111', fontSize: '14px', fontWeight: '600', margin: 0 },
  itemSub:     { color: '#6B6B6B', fontSize: '11px', margin: '2px 0 0' },
  cell:        { color: '#333333', fontSize: '14px', display: 'flex', alignItems: 'center' },
  cantControl: { display: 'flex', alignItems: 'center', gap: '6px' },
  cantBtn:     { width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFFFFF', border: '1px solid #D3D3D3', borderRadius: '6px', color: '#111111', fontSize: '14px', fontWeight: '700', cursor: 'pointer', padding: 0, lineHeight: 1 },
  cantValor:   { minWidth: '20px', textAlign: 'center' as const, color: '#111111', fontSize: '13px', fontWeight: '600' },
  btnX:        { background: 'transparent', border: 'none', color: '#6B6B6B', cursor: 'pointer', fontSize: '13px', padding: '4px 6px', borderRadius: '4px', width: '32px' },

  totalPagoRow:{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap' as const },
  totalBlock:  { display: 'flex', alignItems: 'flex-end', gap: '16px' },
  totalLabel:  { color: '#6B6B6B', fontSize: '11px', fontWeight: '700', letterSpacing: '2px' },
  totalValor:  { color: '#111111', fontSize: '26px', fontWeight: '800' },
  pagoBlock:   { display: 'flex', flexDirection: 'column', gap: '6px' },
  medios:      { display: 'flex', gap: '6px', flexWrap: 'wrap' as const },
  medioBtn:    { padding: '7px 14px', background: '#FFFFFF', border: '1px solid #D3D3D3', borderRadius: '8px', color: '#6B6B6B', fontSize: '13px', fontWeight: '600', cursor: 'pointer' },
  medioBtnOn:  { background: 'rgba(245,196,0,0.15)', border: '1px solid #F5C400', color: '#8A6D00' },

  montoWrap:   { display: 'flex', alignItems: 'center', background: '#FFFFFF', border: '1px solid #D3D3D3', borderRadius: '8px', overflow: 'hidden' },
  montoSign:   { color: '#8A6D00', fontWeight: '700', padding: '0 10px', fontSize: '15px' },
  montoInput:  { background: 'transparent', border: 'none', padding: '9px 10px 9px 0', color: '#111111', fontSize: '15px', outline: 'none', width: '130px' },
  subtotal:    { color: '#6B6B6B', fontSize: '13px' },
  descuento:   { color: '#1E7A45', fontSize: '13px', fontWeight: '600' },
  saldoNota:   { color: '#1E7A45', fontSize: '12px' },
  saldoCheck:  { display: 'flex', alignItems: 'center', gap: '8px', color: '#1E7A45', fontSize: '13px', fontWeight: '600', cursor: 'pointer' },
  vueltoBox:   { padding: '6px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' },
  vueltoPos:   { background: '#E4F5EA', border: '1px solid #CDEBD9' },
  vueltoNeg:   { background: '#FBE5E2', border: '1px solid rgba(198,64,47,0.2)' },
  vueltoLabel: { fontSize: '10px', fontWeight: '700', letterSpacing: '1px', color: '#1E7A45' },
  vueltoValor: { fontSize: '18px', fontWeight: '800', color: '#1E7A45' },

  confirmarRow: { display: 'flex', gap: '10px' },
  btnConfirmar: { flex: 1, padding: '12px', background: '#F5C400', color: '#111111', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: '800', cursor: 'pointer', letterSpacing: '0.5px' },
  btnOff:       { opacity: 0.35, cursor: 'not-allowed' },
}
