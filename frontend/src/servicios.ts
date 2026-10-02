export type EstadoServicio = 'EN_CURSO' | 'FINALIZADO'
export type EstadoRetiro = 'PENDIENTE' | 'LISTO' | 'RETIRADO'

export interface RepuestoServicio {
  id: number; cantidad: number; cantidadRetirada: number; precioUnitario: number
  producto: { id: number; nombre: string; codigo: string | null; stock?: number }
}

export interface Servicio {
  id: number | null; numero: number | null; equipo: string; descripcionFalla: string; tareas: string | null; diagnostico?: string | null; trabajoRealizado?: string | null; enGarantia: boolean
  costoManoObra: number; estado: EstadoServicio; fechaEstimadaFin: string | null
  tipoComprobante: 'FACTURA' | 'REMITO' | null; medioPago: string | null; total: number | null; saldoAplicado: number
  proximoMantenimiento: string | null; codigoRetiro: string | null; estadoRetiro: EstadoRetiro | null
  fechaIngreso: string; finalizadoEn: string | null
  cliente: { id: number; nombre: string; documento: string | null; direccion?: string | null; telefono?: string | null; email?: string | null; condicionIva?: string }
  tecnico: { id: number; nombre: string } | null
  repuestos: RepuestoServicio[]
}

export const ESTADO_LABEL: Record<EstadoServicio, string> = { EN_CURSO: 'En curso', FINALIZADO: 'Finalizado' }

export const ESTADO_COLOR: Record<EstadoServicio, React.CSSProperties> = {
  EN_CURSO:   { background: 'rgba(245,196,0,0.15)', color: '#8A6D00', border: '1px solid rgba(245,196,0,0.4)' },
  FINALIZADO: { background: '#111111', color: '#F5C400', border: '1px solid #111111' },
}

export const ESTADO_RETIRO_LABEL: Record<EstadoRetiro, string> = {
  PENDIENTE: 'Pendiente de preparar', LISTO: 'Listo para retirar', RETIRADO: 'Retirado',
}

export const ESTADO_RETIRO_COLOR: Record<EstadoRetiro, React.CSSProperties> = {
  PENDIENTE: { background: '#FDF0DA', color: '#97640B', border: '1px solid rgba(224,138,0,0.3)' },
  LISTO:     { background: '#E4F5EA', color: '#1E7A45', border: '1px solid #CDEBD9' },
  RETIRADO:  { background: '#ECEEF1', color: '#333333', border: '1px solid #E2E4E8' },
}
