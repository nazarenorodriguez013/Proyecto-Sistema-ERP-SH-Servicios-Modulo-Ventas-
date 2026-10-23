import { useState, useEffect } from 'react'
import { API } from '../config'

interface PagoEliminado {
  id: number; concepto: string; monto: number; creadoEn: string; registradoPorNombre: string | null
  eliminadoEn: string; eliminadoPorNombre: string | null; motivoEliminacion: string | null
  cliente: { id: number; nombre: string }
}
interface Respuesta { total: number; pagina: number; paginas: number; pagos: PagoEliminado[] }

const fecha = (iso: string) => new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const pesos = (n: number) => `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// Pagos de cuenta corriente que se eliminaron. No figuran en la cuenta del cliente ni en su saldo, pero quedan acá
// para siempre (no se borran a los 7 días como el resto de la auditoría), aunque se hayan eliminado por un error de carga
export default function PagosEliminados() {
  const [buscar, setBuscar] = useState('')
  const [q, setQ] = useState('')
  const [pagina, setPagina] = useState(1)
  const [datos, setDatos] = useState<Respuesta | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const qs = new URLSearchParams({ q, pagina: String(pagina) })
    fetch(`${API}/audit/pagos-eliminados?${qs}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` } })
      .then(r => r.json()).then(setDatos).catch(() => setError('No se pudieron cargar los pagos eliminados'))
  }, [q, pagina])

  const filtrar = (e: React.FormEvent) => { e.preventDefault(); setPagina(1); setQ(buscar) }

  return (
    <div className="card-admin">
      <div className="card-admin__head">
        <h2><i className="bi bi-cash-coin" /> Pagos eliminados</h2>
        <span className="text-muted-2" style={{ fontSize: '.875rem' }}>{datos?.total ?? 0} pago(s)</span>
      </div>
      <div className="card-admin__body">
        <p className="text-muted-2 small-text" style={{ margin: '0 0 10px' }}>
          <i className="bi bi-info-circle" /> Los pagos que se eliminan de la cuenta corriente de un cliente dejan de figurar y no cuentan para el saldo, pero quedan registrados acá y no se borran.
        </p>
        <form className="card-admin__actions" onSubmit={filtrar}>
          <input type="search" className="form-control" style={{ flex: 1, minWidth: 0, maxWidth: 360 }} placeholder="Cliente, usuario o motivo" value={buscar} onChange={e => setBuscar(e.target.value)} />
          <button type="submit" className="btn btn-dark-2"><i className="bi bi-search" /> Buscar</button>
        </form>
        {error && <div className="admin-alert admin-alert--danger" style={{ marginTop: '10px' }}><span>{error}</span></div>}
      </div>
      <div className="card-admin__body card-admin__body--flush">
        <div className="table-responsive-admin">
          <table className="table-admin">
            <thead><tr><th>Eliminado</th><th>Eliminado por</th><th>Cliente</th><th>Monto</th><th>Cargado</th><th>Motivo</th></tr></thead>
            <tbody>
              {datos?.pagos.map(p => (
                <tr key={p.id}>
                  <td className="small-text" style={{ whiteSpace: 'nowrap' }}>{fecha(p.eliminadoEn)}</td>
                  <td>{p.eliminadoPorNombre ?? '—'}</td>
                  <td>{p.cliente.nombre}</td>
                  <td style={{ whiteSpace: 'nowrap' }}><strong>{pesos(p.monto)}</strong></td>
                  <td className="small-text text-muted-2" style={{ whiteSpace: 'nowrap' }}>{fecha(p.creadoEn)}{p.registradoPorNombre && <small className="d-block">por {p.registradoPorNombre}</small>}</td>
                  <td className="small-text">{p.motivoEliminacion ?? '—'}</td>
                </tr>
              ))}
              {datos && datos.pagos.length === 0 && (
                <tr><td colSpan={6} className="table-admin__empty"><i className="bi bi-inbox" />No hay pagos eliminados.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {datos && datos.paginas > 1 && (
        <div className="card-admin__foot paginacion">
          <button type="button" className="btn btn-ghost btn-sm" disabled={pagina <= 1} onClick={() => setPagina(p => p - 1)}><i className="bi bi-chevron-left" /> Anterior</button>
          <span className="text-muted-2 small-text">Página {datos.pagina} de {datos.paginas}</span>
          <button type="button" className="btn btn-ghost btn-sm" disabled={pagina >= datos.paginas} onClick={() => setPagina(p => p + 1)}>Siguiente <i className="bi bi-chevron-right" /></button>
        </div>
      )}
    </div>
  )
}
