import { useSyncExternalStore } from 'react'
import { API } from './config'

export interface Empresa {
  razonSocial: string; rubro: string; domicilio: string; condicionIva: string; telefono: string
  email: string; cuit: string; ingresosBrutos: string; inicioActividades: string; puntoVenta: number
}

const VACIA: Empresa = {
  razonSocial: 'SH Servicios', rubro: 'Insumos y Soluciones Técnicas', domicilio: '', condicionIva: '', telefono: '',
  email: '', cuit: '', ingresosBrutos: '', inicioActividades: '', puntoVenta: 1,
}

// Datos de la empresa para los comprobantes: se cargan una vez al entrar y se actualizan al guardar en Configuración
let actual: Empresa = VACIA
const oyentes = new Set<() => void>()

export const setEmpresa = (e: Empresa) => { actual = { ...VACIA, ...e }; oyentes.forEach(o => o()) }

export const cargarEmpresa = () =>
  fetch(`${API}/company`, { headers: { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` } })
    .then(r => r.ok ? r.json() : null).then(e => { if (e) setEmpresa(e) }).catch(() => {})

export const useEmpresa = () =>
  useSyncExternalStore(cb => { oyentes.add(cb); return () => { oyentes.delete(cb) } }, () => actual)

// Punto de venta de 4 dígitos y número de comprobante de 8, como en las facturas de AFIP
export const formatNumero = (n: number) => String(n).padStart(8, '0')
export const formatPuntoVenta = (pv: number) => String(pv).padStart(4, '0')
export const useFormatComprobante = () => {
  const { puntoVenta } = useEmpresa()
  return (n: number) => `${formatPuntoVenta(puntoVenta)}-${formatNumero(n)}`
}
