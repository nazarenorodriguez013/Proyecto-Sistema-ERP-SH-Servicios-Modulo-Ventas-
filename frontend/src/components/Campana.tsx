import { useState, useEffect, useRef } from 'react'
import { API } from '../config'
import { socket } from '../socket'

export interface Notificacion {
  id: number; area: 'INVENTARIO' | 'SERVICIOS'; titulo: string; mensaje: string
  servicioId: number | null; creadoEn: string; nueva: boolean; destinatario: string
}

const hace = (iso: string) => {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  if (min < 1440) return `hace ${Math.round(min / 60)} h`
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
}

// Campanita de avisos entre áreas (pedido de repuestos, repuestos listos, etc.), visible en todos los módulos
export default function Campana({ onIr }: { onIr: (n: Notificacion) => void }) {
  const [items, setItems] = useState<Notificacion[]>([])
  const [noLeidas, setNoLeidas] = useState(0)
  const [abierta, setAbierta] = useState(false)
  const caja = useRef<HTMLDivElement>(null)

  const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` })
  const cargar = () =>
    fetch(`${API}/notifications`, { headers: headers() }).then(r => r.ok ? r.json() : null)
      .then(d => { if (d) { setItems(d.items); setNoLeidas(d.noLeidas) } }).catch(() => {})

  useEffect(() => {
    cargar()
    socket.on('notificaciones-actualizadas', cargar)
    return () => { socket.off('notificaciones-actualizadas', cargar) }
  }, [])

  // Al cerrar el panel, lo que se vio queda como leído
  const cerrar = () => {
    setAbierta(false)
    if (noLeidas > 0) fetch(`${API}/notifications/leidas`, { method: 'PUT', headers: headers() }).then(cargar)
  }

  useEffect(() => {
    if (!abierta) return
    const fuera = (e: MouseEvent) => { if (caja.current && !caja.current.contains(e.target as Node)) cerrar() }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [abierta, noLeidas])

  return (
    <div ref={caja} style={s.caja}>
      <button style={s.btn} title="Notificaciones" onClick={() => abierta ? cerrar() : setAbierta(true)}>
        <i className={`bi ${noLeidas > 0 ? 'bi-bell-fill' : 'bi-bell'}`} />
        {noLeidas > 0 && <span style={s.badge}>{noLeidas > 9 ? '9+' : noLeidas}</span>}
      </button>

      {abierta && (
        <div style={s.panel}>
          <div style={s.panelHead}>Notificaciones</div>
          <div style={s.lista}>
            {items.length === 0
              ? <div style={s.vacio}>No hay notificaciones</div>
              : items.map(n => (
                <button key={n.id} style={{ ...s.item, ...(n.nueva ? s.itemNueva : {}) }} onClick={() => { cerrar(); onIr(n) }}>
                  <span style={s.icono}><i className={`bi ${n.area === 'INVENTARIO' ? 'bi-box-seam' : 'bi-tools'}`} /></span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={s.titulo}>{n.titulo}{n.nueva && <span style={s.punto} />}</span>
                    <span style={s.para}>Para: {n.destinatario}</span>
                    <span style={s.mensaje}>{n.mensaje}</span>
                    <span style={s.hora}>{hace(n.creadoEn)}</span>
                  </span>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  caja:      { position: 'relative' },
  btn:       { position: 'relative', width: '38px', height: '38px', background: '#F5F5F5', border: '1px solid #E2E4E8', borderRadius: '8px', color: '#111111', fontSize: '17px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  badge:     { position: 'absolute', top: '-6px', right: '-6px', background: '#C6402F', color: '#FFFFFF', borderRadius: '10px', minWidth: '18px', height: '18px', padding: '0 5px', fontSize: '11px', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' },
  panel:     { position: 'absolute', top: '46px', right: 0, width: '360px', maxWidth: 'calc(100vw - 32px)', background: '#FFFFFF', border: '1px solid #E2E4E8', borderRadius: '12px', boxShadow: '0 12px 36px rgba(17,17,17,.2)', zIndex: 500, overflow: 'hidden' },
  panelHead: { padding: '12px 16px', borderBottom: '1px solid #EFF1F4', color: '#111111', fontSize: '13px', fontWeight: '700' },
  lista:     { maxHeight: '60vh', overflowY: 'auto' },
  vacio:     { color: '#6B6B6B', fontSize: '13px', textAlign: 'center', padding: '28px 16px' },
  item:      { width: '100%', display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '11px 16px', background: '#FFFFFF', border: 'none', borderBottom: '1px solid #EFF1F4', cursor: 'pointer', textAlign: 'left', font: 'inherit' },
  itemNueva: { background: '#FFFDF3' },
  icono:     { width: '30px', height: '30px', borderRadius: '8px', background: '#F5F5F5', color: '#111111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0 },
  titulo:    { display: 'flex', alignItems: 'center', gap: '6px', color: '#111111', fontSize: '13px', fontWeight: '700' },
  punto:     { width: '7px', height: '7px', borderRadius: '50%', background: '#E08A00', display: 'inline-block' },
  para:      { display: 'inline-block', marginTop: '3px', padding: '1px 7px', borderRadius: '10px', background: '#EEF1F6', color: '#3B4A63', fontSize: '10.5px', fontWeight: '700' },
  mensaje:   { display: 'block', color: '#333333', fontSize: '12px', marginTop: '2px' },
  hora:      { display: 'block', color: '#9A9A9A', fontSize: '11px', marginTop: '3px' },
}
