import { useState, useEffect, useRef, type ReactNode } from 'react'

// Menú desplegable como el del panel del catálogo (dropdown de Bootstrap). Se posiciona fijo respecto del botón
// para que no lo recorte el scroll horizontal de las tablas; se cierra al elegir una opción o al tocar afuera.
export default function Dropdown({ trigger, triggerClassName, title, align = 'start', children }: {
  trigger: ReactNode; triggerClassName: string; title?: string; align?: 'start' | 'end'
  children: (cerrar: () => void) => ReactNode
}) {
  const [pos, setPos] = useState<{ top: number; left?: number; right?: number } | null>(null)
  const boton = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const cerrar = () => setPos(null)

  const alternar = () => {
    if (pos) return cerrar()
    const r = boton.current!.getBoundingClientRect()
    setPos(align === 'end' ? { top: r.bottom + 4, right: window.innerWidth - r.right } : { top: r.bottom + 4, left: r.left })
  }

  useEffect(() => {
    if (!pos) return
    const fuera = (e: MouseEvent) => {
      const t = e.target as Node
      if (!menu.current?.contains(t) && !boton.current?.contains(t)) cerrar()
    }
    // Si se scrollea o cambia el tamaño, el menú quedaría flotando lejos del botón
    document.addEventListener('mousedown', fuera)
    window.addEventListener('scroll', cerrar, true)
    window.addEventListener('resize', cerrar)
    return () => {
      document.removeEventListener('mousedown', fuera)
      window.removeEventListener('scroll', cerrar, true)
      window.removeEventListener('resize', cerrar)
    }
  }, [pos])

  // Si no entra hacia abajo, se abre hacia arriba
  useEffect(() => {
    if (!pos || !menu.current || !boton.current) return
    const alto = menu.current.offsetHeight
    if (pos.top + alto > window.innerHeight - 8) {
      const arriba = boton.current.getBoundingClientRect().top - alto - 4
      if (arriba > 8) setPos(p => p && { ...p, top: arriba })
    }
  }, [pos?.left, pos?.right])

  return (
    <>
      <button ref={boton} type="button" className={triggerClassName} title={title} aria-expanded={!!pos} onClick={alternar}>
        {trigger}
      </button>
      {pos && <div ref={menu} className="dropdown-menu" style={pos}>{children(cerrar)}</div>}
    </>
  )
}
