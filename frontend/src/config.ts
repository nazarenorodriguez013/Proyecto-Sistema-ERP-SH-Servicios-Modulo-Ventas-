export const API_BASE = import.meta.env.VITE_API_URL ?? ''
export const API = `${API_BASE}/api`

// Sitio público del catálogo (el link "Ver el sitio" del panel)
export const CATALOGO_URL = import.meta.env.VITE_CATALOGO_URL ?? 'http://localhost/sh-servicios/'

export const MEDIOS_PAGO = ['Efectivo', 'Débito', 'Crédito', 'Transferencia', 'Cuenta Corriente']
export const MEDIO_CUENTA_CORRIENTE = 'Cuenta Corriente'

export const TIPOS_COMPROBANTE = ['FACTURA', 'REMITO', 'PRESUPUESTO'] as const
export type TipoComprobante = typeof TIPOS_COMPROBANTE[number]
export const TIPO_COMPROBANTE_LABEL: Record<TipoComprobante, string> = {
  FACTURA: 'Factura', REMITO: 'Remito', PRESUPUESTO: 'Presupuesto',
}
