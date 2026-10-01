import { useState } from 'react'
import { API } from '../config'
import { useEmpresa, setEmpresa, formatPuntoVenta, type Empresa } from '../empresa'
import { campo as c } from './configEstilos'

const CONDICIONES_IVA = ['Responsable Inscripto', 'Monotributo', 'IVA Exento', 'No Responsable']

// Datos del emisor que salen en el encabezado de facturas, remitos y presupuestos
export default function ConfigEmpresa() {
  const guardada = useEmpresa()
  const [form, setForm] = useState<Empresa>(guardada)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  const set = (k: keyof Empresa, v: string) => setForm(f => ({ ...f, [k]: k === 'puntoVenta' ? Number(v) : v }))
  const texto = (k: Exclude<keyof Empresa, 'puntoVenta'>, label: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div style={c.field}><label style={c.label}>{label}</label>
      <input style={c.input} value={form[k]} onChange={e => set(k, e.target.value)} {...extra} /></div>
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
    setEmpresa(data); setOk('Datos guardados: ya salen en los comprobantes nuevos')
  }

  return (
    <form onSubmit={guardar} style={c.card}>
      <p style={c.seccion}>Datos de la empresa para los comprobantes</p>
      <div style={c.grid3}>
        {texto('razonSocial', 'Razón social *', { required: true })}
        {texto('rubro', 'Rubro / descripción')}
        {texto('cuit', 'CUIT', { placeholder: '30-12345678-9' })}
        {texto('domicilio', 'Domicilio comercial')}
        <div style={c.field}><label style={c.label}>Condición frente al IVA</label>
          <select style={c.input} value={form.condicionIva} onChange={e => set('condicionIva', e.target.value)}>
            <option value="">Sin especificar</option>
            {CONDICIONES_IVA.map(o => <option key={o} value={o}>{o}</option>)}
          </select></div>
        {texto('ingresosBrutos', 'Ingresos Brutos')}
        {texto('telefono', 'Teléfono')}
        {texto('email', 'E-mail', { type: 'email' })}
        {texto('inicioActividades', 'Inicio de actividades', { type: 'date' })}
        <div style={c.field}><label style={c.label}>Punto de venta (4 dígitos)</label>
          <input style={c.input} type="number" min="1" max="9999" value={form.puntoVenta} onChange={e => set('puntoVenta', e.target.value)} />
          <span style={{ color: '#6B6B6B', fontSize: '11px' }}>Sale como {formatPuntoVenta(form.puntoVenta || 1)}-00000001 en el comprobante</span></div>
      </div>
      {error && <p style={c.error}>{error}</p>}
      {ok && <p style={c.ok}>{ok}</p>}
      <div style={c.acciones}><button type="submit" style={c.btnPrimary}>Guardar datos</button></div>
    </form>
  )
}
