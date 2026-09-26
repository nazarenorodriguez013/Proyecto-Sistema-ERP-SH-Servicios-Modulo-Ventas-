export type EstadoServicio = 'PRESUPUESTADO' | 'PENDIENTE' | 'RECHAZADO' | 'EN_REPARACION' | 'REPARADO' | 'ENTREGADO'

export interface Servicio {
  id: number; equipo: string; descripcionFalla: string; enGarantia: boolean
  costoManoObra: number; estado: EstadoServicio; medioPago: string | null; total: number | null
  proximoMantenimiento: string | null; fechaIngreso: string; entregadoEn: string | null
  cliente: { id: number; nombre: string; documento: string | null }
  tecnico: { id: number; nombre: string } | null
  repuestos: { id: number; cantidad: number; precioUnitario: number; producto: { id: number; nombre: string; codigo: string | null } }[]
}

export const ESTADO_LABEL: Record<EstadoServicio, string> = {
  PRESUPUESTADO: 'Presupuestado', PENDIENTE: 'Pendiente', RECHAZADO: 'Rechazado',
  EN_REPARACION: 'En reparación', REPARADO: 'Reparado', ENTREGADO: 'Entregado',
}

export const ESTADO_COLOR: Record<EstadoServicio, React.CSSProperties> = {
  PRESUPUESTADO: { background: '#FDF0DA', color: '#97640B', border: '1px solid rgba(224,138,0,0.3)' },
  PENDIENTE:     { background: '#ECEEF1', color: '#333333', border: '1px solid #E2E4E8' },
  RECHAZADO:     { background: '#FBE5E2', color: '#C6402F', border: '1px solid rgba(198,64,47,0.2)' },
  EN_REPARACION: { background: 'rgba(245,196,0,0.15)', color: '#8A6D00', border: '1px solid rgba(245,196,0,0.4)' },
  REPARADO:      { background: '#E4F5EA', color: '#1E7A45', border: '1px solid #CDEBD9' },
  ENTREGADO:     { background: '#111111', color: '#F5C400', border: '1px solid #111111' },
}
