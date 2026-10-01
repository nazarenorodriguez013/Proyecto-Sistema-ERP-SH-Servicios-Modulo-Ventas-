import { MEDIO_CUENTA_CORRIENTE, type TipoComprobante } from '../config'
import HojaComprobante, { tabla, type Fila, type TipoHoja } from './HojaComprobante'

interface ItemComprobante {
  id: number; cantidad: number; precioUnitario: number
  producto: { nombre: string; codigo: string | null }
}
export interface ClienteComprobante {
  nombre: string; documento: string | null; direccion: string | null; telefono: string | null
  email: string | null; condicionIva?: string
}
export interface ComprobanteData {
  id: number | null
  numero: number | null
  fecha: Date
  tipoComprobante: TipoComprobante
  items: ItemComprobante[]
  total: number
  saldoAplicado: number
  medioPago: string | null
  montoRecibido: number | null
  vendedor: string
  cliente: ClienteComprobante | null
}

// Letra y código del tipo de comprobante, como en una factura C de AFIP
const TIPOS: Record<TipoComprobante, TipoHoja> = {
  FACTURA:     { letra: 'C', cod: '11', titulo: 'FACTURA' },
  REMITO:      { letra: 'R', cod: '91', titulo: 'REMITO' },
  PRESUPUESTO: { letra: 'P', cod: '00', titulo: 'PRESUPUESTO' },
}

const fmt = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Comprobante de venta a hoja completa: se usa al cerrar una venta/presupuesto en el Punto de Venta y
// para reimprimir desde el historial. El punto de venta y el número son correlativos por tipo.
export default function Comprobante({ data, onClose }: { data: ComprobanteData; onClose: () => void }) {
  const tipo = TIPOS[data.tipoComprobante]
  const aPagar = data.total - data.saldoAplicado

  // Sin cliente elegido, el comprobante sale a nombre de Consumidor Final
  const cl = data.cliente
  const receptor: Fila[] = [
    { label: 'CUIT/DNI', value: cl?.documento ?? '' },
    { label: 'Razón Social', value: cl?.nombre ?? 'Consumidor Final' },
    { label: 'Condición frente al IVA', value: cl?.condicionIva ?? 'Consumidor Final' },
    { label: 'Domicilio', value: cl?.direccion ?? '' },
    ...(cl?.telefono ? [{ label: 'Teléfono', value: cl.telefono }] : []),
    ...(cl?.email ? [{ label: 'E-mail', value: cl.email }] : []),
    { label: 'Condición de venta', value: data.medioPago ?? '' },
    { label: 'Vendedor', value: data.vendedor },
  ]

  const lineasTotal: Fila[] = []
  if (data.saldoAplicado > 0) {
    lineasTotal.push({ label: 'Saldo a favor aplicado', value: `-$${fmt(data.saldoAplicado)}` })
    lineasTotal.push({ label: data.medioPago === MEDIO_CUENTA_CORRIENTE ? 'A cuenta corriente' : 'A pagar', value: `$${fmt(aPagar)}` })
  }
  if (data.montoRecibido !== null) {
    lineasTotal.push({ label: 'Monto recibido', value: `$${fmt(data.montoRecibido)}` })
    lineasTotal.push({ label: 'Vuelto', value: `$${fmt(data.montoRecibido - aPagar)}` })
  }

  return (
    <HojaComprobante
      tipo={tipo} titulo={tipo.titulo} numero={data.numero} fecha={data.fecha}
      receptor={receptor} lineasTotal={lineasTotal} total={`$${fmt(data.total)}`}
      nota={data.tipoComprobante === 'PRESUPUESTO' ? 'Presupuesto sin cargo, sujeto a disponibilidad' : undefined}
      onClose={onClose}
    >
      <table style={tabla.tabla}>
        <thead>
          <tr>
            <th style={{ ...tabla.th, width: '70px' }}>Código</th>
            <th style={tabla.th}>Producto / Servicio</th>
            <th style={{ ...tabla.th, textAlign: 'center', width: '60px' }}>Cantidad</th>
            <th style={{ ...tabla.th, textAlign: 'right', width: '100px' }}>Unitario</th>
            <th style={{ ...tabla.th, textAlign: 'right', width: '110px' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item, i) => (
            <tr key={i} style={tabla.tr}>
              <td style={tabla.td}>{item.producto.codigo ?? '—'}</td>
              <td style={tabla.td}>{item.producto.nombre}</td>
              <td style={{ ...tabla.td, textAlign: 'center' }}>{item.cantidad}</td>
              <td style={{ ...tabla.td, textAlign: 'right' }}>{fmt(item.precioUnitario)}</td>
              <td style={{ ...tabla.td, textAlign: 'right', fontWeight: 700 }}>{fmt(item.cantidad * item.precioUnitario)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </HojaComprobante>
  )
}
