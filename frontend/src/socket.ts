import { API } from './config'

// Hostinger (hosting compartido con PHP) no permite conexiones permanentes como Socket.io. En su lugar el servidor
// lleva un contador por evento (stock-actualizado, servicios-actualizados, ...) y acá se consulta cada pocos segundos:
// si un contador cambió, se avisa a las pantallas que lo escuchan. Se mantiene la misma forma socket.on / socket.off.
type Handler = () => void

const INTERVALO_MS = 5000
const handlers = new Map<string, Set<Handler>>()
let versiones: Record<string, number> | null = null
let consultando = false
let pendiente: ReturnType<typeof setTimeout> | null = null

const revisar = async () => {
  const token = localStorage.getItem('token')
  if (!token || consultando || document.hidden) return
  consultando = true
  try {
    const res = await fetch(`${API}/eventos`, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return
    const nuevas: Record<string, number> = await res.json()
    // La primera consulta solo toma referencia: las pantallas ya cargaron sus datos al abrirse
    if (versiones) {
      for (const [evento, version] of Object.entries(nuevas)) {
        if (versiones[evento] !== version) handlers.get(evento)?.forEach(h => h())
      }
    }
    versiones = nuevas
  } catch {
    // Sin conexión: se vuelve a intentar en la próxima vuelta
  } finally {
    consultando = false
  }
}

setInterval(revisar, INTERVALO_MS)
// Al volver a la pestaña se revisa enseguida
document.addEventListener('visibilitychange', () => { if (!document.hidden) revisar() })

// Después de un cambio hecho desde esta pantalla (venta, retiro, etc.) se revisa casi en el momento
export const revisarPronto = () => {
  if (pendiente) clearTimeout(pendiente)
  pendiente = setTimeout(() => { pendiente = null; revisar() }, 300)
}

export const socket = {
  on(evento: string, handler: Handler) {
    if (!handlers.has(evento)) handlers.set(evento, new Set())
    handlers.get(evento)!.add(handler)
  },
  off(evento: string, handler: Handler) {
    handlers.get(evento)?.delete(handler)
  },
}
