import { MEDIO_CUENTA_CORRIENTE, formatNumero } from '../config'
import type { Servicio } from '../servicios'
import HojaComprobante, { tabla, type Fila, type TipoHoja } from './HojaComprobante'

type Modo = 'presupuesto' | 'retiro' | 'comprobante'

const fmt = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtFechaCalendario = (d: string) => new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })

// Letra y código del tipo de comprobante, como en una factura C de AFIP; la hoja de retiro no es un comprobante
const tipoDe = (modo: Modo, servicio: Servicio): TipoHoja | null => {
  if (modo === 'presupuesto') return { letra: 'P', cod: '00', titulo: 'PRESUPUESTO DE SERVICIO' }
  if (modo === 'retiro') return null
  return servicio.tipoComprobante === 'REMITO'
    ? { letra: 'R', cod: '91', titulo: 'REMITO DE SERVICIO' }
    : { letra: 'C', cod: '11', titulo: 'FACTURA DE SERVICIO' }
}

// Hoja completa para servicios técnicos: presupuesto (cotización), retiro (hoja para el depósito) y
// comprobante final. El número es correlativo por tipo, igual que en las ventas.
export default function ServicioTicket({ modo, servicio, onClose }: { modo: Modo; servicio: Servicio; onClose: () => void }) {
  const tipo = tipoDe(modo, servicio)
  const subtotalRepuestos = servicio.repuestos.reduce((sum, r) => sum + r.cantidad * r.precioUnitario, 0)
  const total = servicio.total ?? (servicio.enGarantia ? 0 : servicio.costoManoObra + subtotalRepuestos)
  const aPagar = total - servicio.saldoAplicado
  const conPrecios = modo !== 'retiro'

  const receptor: Fila[] = [
    { label: 'CUIT/DNI', value: servicio.cliente.documento ?? '' },
    { label: 'Razón Social', value: servicio.cliente.nombre },
    { label: 'Domicilio', value: servicio.cliente.direccion ?? '' },
    { label: 'Condición de venta', value: servicio.medioPago ?? '' },
    { label: 'Servicio N°', value: servicio.id ? formatNumero(servicio.id) : 'S/N' },
    { label: 'Equipo', value: servicio.equipo },
    { label: 'Técnico', value: servicio.tecnico?.nombre ?? 'Sin asignar' },
    ...(servicio.fechaEstimadaFin ? [{ label: 'Fin estimado', value: fmtFechaCalendario(servicio.fechaEstimadaFin) }] : []),
    ...(servicio.proximoMantenimiento && modo === 'comprobante' ? [{ label: 'Próximo mantenimiento', value: fmtFechaCalendario(servicio.proximoMantenimiento) }] : []),
  ].filter(f => modo !== 'retiro' || !['CUIT/DNI', 'Domicilio', 'Condición de venta'].includes(f.label))

  const lineasTotal: Fila[] = []
  if (servicio.enGarantia) lineasTotal.push({ label: 'Cubierto por garantía', value: `-$${fmt(subtotalRepuestos + servicio.costoManoObra)}` })
  if (servicio.saldoAplicado > 0) {
    lineasTotal.push({ label: 'Saldo a favor aplicado', value: `-$${fmt(servicio.saldoAplicado)}` })
    lineasTotal.push({ label: servicio.medioPago === MEDIO_CUENTA_CORRIENTE ? 'A cuenta corriente' : 'A pagar', value: `$${fmt(aPagar)}` })
  }

  const nota = modo === 'presupuesto' ? 'Presupuesto sin cargo, sujeto a disponibilidad de repuestos'
    : modo === 'retiro' ? 'Presentar esta hoja en el área de repuestos para retirar el pedido' : undefined

  return (
    <HojaComprobante
      tipo={tipo} titulo={tipo ? tipo.titulo : 'RETIRO DE REPUESTOS'} numero={servicio.numero} fecha={new Date(servicio.fechaIngreso)}
      receptor={receptor} lineasTotal={lineasTotal} total={conPrecios ? `$${fmt(total)}` : null} nota={nota} onClose={onClose}
    >
      {modo === 'retiro' && servicio.codigoRetiro && (
        <div style={s.codigoBox}>
          <span style={s.codigoLabel}>CÓDIGO DE RETIRO</span>
          <span style={s.codigoValor}>{servicio.codigoRetiro}</span>
        </div>
      )}

      <div style={s.textoBox}><b>Falla:</b> {servicio.descripcionFalla}</div>
      {servicio.tareas && <div style={s.textoBox}><b>Tareas a realizar:</b> {servicio.tareas}</div>}

      <table style={tabla.tabla}>
        <thead>
          <tr>
            <th style={{ ...tabla.th, width: '70px' }}>Código</th>
            <th style={tabla.th}>Producto / Servicio</th>
            <th style={{ ...tabla.th, textAlign: 'center', width: '60px' }}>Cantidad</th>
            {conPrecios && <th style={{ ...tabla.th, textAlign: 'right', width: '100px' }}>Unitario</th>}
            {conPrecios && <th style={{ ...tabla.th, textAlign: 'right', width: '110px' }}>Total</th>}
          </tr>
        </thead>
        <tbody>
          {servicio.repuestos.map(r => (
            <tr key={r.id} style={tabla.tr}>
              <td style={tabla.td}>{r.producto.codigo ?? '—'}</td>
              <td style={tabla.td}>{r.producto.nombre}</td>
              <td style={{ ...tabla.td, textAlign: 'center' }}>{r.cantidad}</td>
              {conPrecios && <td style={{ ...tabla.td, textAlign: 'right' }}>{fmt(r.precioUnitario)}</td>}
              {conPrecios && <td style={{ ...tabla.td, textAlign: 'right', fontWeight: 700 }}>{fmt(r.cantidad * r.precioUnitario)}</td>}
            </tr>
          ))}
          {conPrecios && (
            <tr style={tabla.tr}>
              <td style={tabla.td}>—</td>
              <td style={tabla.td}>Mano de obra</td>
              <td style={{ ...tabla.td, textAlign: 'center' }}>1</td>
              <td style={{ ...tabla.td, textAlign: 'right' }}>{fmt(servicio.costoManoObra)}</td>
              <td style={{ ...tabla.td, textAlign: 'right', fontWeight: 700 }}>{fmt(servicio.costoManoObra)}</td>
            </tr>
          )}
        </tbody>
      </table>
    </HojaComprobante>
  )
}

const s: Record<string, React.CSSProperties> = {
  codigoBox:   { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', background: '#FFFDF3', border: '2px solid #F5C400', borderRadius: '10px', padding: '12px', marginBottom: '14px' },
  codigoLabel: { fontSize: '10px', color: '#8A6D00', fontWeight: '700', letterSpacing: '2px' },
  codigoValor: { fontSize: '30px', fontWeight: '900', color: '#111111', fontFamily: 'monospace', letterSpacing: '2px' },
  textoBox:    { fontSize: '11px', color: '#111111', background: '#F5F5F5', borderRadius: '4px', padding: '7px 10px', marginBottom: '8px' },
}
