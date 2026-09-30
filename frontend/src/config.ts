export const API_BASE = import.meta.env.VITE_API_URL ?? ''
export const API = `${API_BASE}/api`

export const MEDIOS_PAGO = ['Efectivo', 'Débito', 'Crédito', 'Transferencia', 'Cuenta Corriente']
export const MEDIO_CUENTA_CORRIENTE = 'Cuenta Corriente'

export const TIPOS_COMPROBANTE = ['FACTURA', 'REMITO', 'PRESUPUESTO'] as const
export type TipoComprobante = typeof TIPOS_COMPROBANTE[number]
export const TIPO_COMPROBANTE_LABEL: Record<TipoComprobante, string> = {
  FACTURA: 'Factura', REMITO: 'Remito', PRESUPUESTO: 'Presupuesto',
}

// Punto de venta de 4 dígitos y número de comprobante de 8, como en las facturas de AFIP
export const PUNTO_DE_VENTA = 1
export const formatPuntoVenta = () => String(PUNTO_DE_VENTA).padStart(4, '0')
export const formatNumero = (n: number) => String(n).padStart(8, '0')
export const formatComprobante = (n: number) => `${formatPuntoVenta()}-${formatNumero(n)}`

// Datos del emisor que salen en el encabezado del comprobante; los que queden vacíos no se imprimen
export const EMPRESA = {
  razonSocial: 'SH Servicios',
  rubro: 'Insumos y Soluciones Técnicas',
  domicilio: '',
  condicionIva: '',
  telefono: '',
  email: '',
  cuit: '',
  ingresosBrutos: '',
  inicioActividades: '',
}
