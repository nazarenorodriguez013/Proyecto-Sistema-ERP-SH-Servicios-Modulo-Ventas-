import { useState } from 'react'
import { API } from '../config'
import { useEmpresa, setEmpresa, formatPuntoVenta, type Empresa } from '../empresa'

const CONDICIONES_IVA = ['Responsable Inscripto', 'Monotributo', 'IVA Exento', 'No Responsable']

// Configuración general, como en el panel del catálogo: los datos de la empresa que salen en el encabezado
// de facturas, remitos y presupuestos
export default function Configuracion() {
  const guardada = useEmpresa()
  const [form, setForm] = useState<Empresa>(guardada)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  const set = (k: keyof Empresa, v: string) => setForm(f => ({ ...f, [k]: k === 'puntoVenta' ? Number(v) : v }))
  const campo = (k: Exclude<keyof Empresa, 'puntoVenta'>, label: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label className="form-label" htmlFor={`set-${k}`}>{label}</label>
      <input className="form-control" id={`set-${k}`} value={form[k]} onChange={e => set(k, e.target.value)} {...extra} />
    </div>
  )

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setOk('')
    const res = await fetch(`${API}/company`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.message || 'No se pudo guardar'); return }
    setEmpresa(data); setOk('Configuración guardada: ya sale en los comprobantes nuevos')
  }

  return (
    <form className="admin-page" onSubmit={guardar}>
      <div className="settings-nav">
        <button type="button" className="is-active"><i className="bi bi-building" /> Empresa y comprobantes</button>
      </div>

      <div className="card-admin">
        <div className="card-admin__head"><h2><i className="bi bi-building" /> Empresa y comprobantes</h2></div>
        <div className="card-admin__body">
          <div className="form-grid form-grid--2">
            {campo('razonSocial', 'Razón social *', { required: true })}
            {campo('rubro', 'Rubro / descripción')}
            {campo('cuit', 'CUIT', { placeholder: '30-12345678-9' })}
            {campo('domicilio', 'Domicilio comercial')}
            <div>
              <label className="form-label" htmlFor="set-iva">Condición frente al IVA</label>
              <select className="form-select" id="set-iva" value={form.condicionIva} onChange={e => set('condicionIva', e.target.value)}>
                <option value="">Sin especificar</option>
                {CONDICIONES_IVA.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            {campo('ingresosBrutos', 'Ingresos Brutos')}
            {campo('telefono', 'Teléfono')}
            {campo('email', 'E-mail', { type: 'email' })}
            {campo('inicioActividades', 'Inicio de actividades', { type: 'date' })}
            <div>
              <label className="form-label" htmlFor="set-pv">Punto de venta (4 dígitos)</label>
              <input className="form-control" id="set-pv" type="number" min="1" max="9999" value={form.puntoVenta} onChange={e => set('puntoVenta', e.target.value)} />
              <p className="form-hint">Sale como {formatPuntoVenta(form.puntoVenta || 1)}-00000001 en el comprobante.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="form-sticky-actions">
        {error && <span className="form-error" style={{ margin: 0, marginRight: 'auto' }}>{error}</span>}
        {ok && <span className="text-ok" style={{ marginRight: 'auto' }}><i className="bi bi-check-circle-fill" /> {ok}</span>}
        <button type="submit" className="btn btn-accent"><i className="bi bi-check-lg" /> Guardar configuración</button>
      </div>
    </form>
  )
}
