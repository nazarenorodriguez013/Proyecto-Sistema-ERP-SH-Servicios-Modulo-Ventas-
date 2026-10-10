import { useState } from 'react'
import { API } from '../config'
import { descargar, filasACsv, generarCsv, leerTexto, leerXlsx } from '../archivos'

type Tipo = 'maquinaria' | 'repuestos'
interface FilaOk { linea: number; existe: boolean; datos: { codigo: string | null; nombre?: string; categoria?: string; precio?: number; stock?: number } }
interface FilaError { linea: number; codigo: string; nombre: string; errores: string[] }
interface Vista { valid: FilaOk[]; invalid: FilaError[] }
interface Resultado { creados: number; actualizados: number; omitidos: number; conError: number }

const COLUMNAS = ['codigo', 'nombre', 'descripcion', 'categoria', 'costo', 'ganancia', 'precio', 'stock', 'stock_minimo', 'activo']
const EJEMPLO: Record<Tipo, (string | number)[]> = {
  maquinaria: ['', 'Elevador 2 columnas 4000 kg', 'Elevador electrohidráulico, incluye brazos telescópicos', 'Elevadores y Levanta Autos', 620000, 37, '', 1, 1, 'si'],
  repuestos:  ['', 'Filtro de aceite Toyota serie 8', 'Filtro original para autoelevadores Toyota', 'Filtros', 12000, '', 19200, 10, 5, 'si'],
}

const MAX_MB = 6
const pesos = (n?: number) => n === undefined ? '—' : `$${n.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`

export default function Importar() {
  const [tipo, setTipo] = useState<Tipo>('maquinaria')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [cotizacion, setCotizacion] = useState('')
  const [contenido, setContenido] = useState('')
  const [vista, setVista] = useState<Vista | null>(null)
  const [actualizar, setActualizar] = useState(true)
  const [confirmando, setConfirmando] = useState(false)
  const [trabajando, setTrabajando] = useState(false)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [error, setError] = useState('')

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` }
  const valorCotizacion = () => Number(cotizacion.replace(',', '.')) || undefined

  // El Excel (.xlsx) se lee en el navegador y se manda como CSV; el CSV se lee en UTF-8 o ANSI según venga
  const previsualizar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!archivo) return
    setError(''); setResultado(null); setVista(null); setConfirmando(false)
    if (archivo.size > MAX_MB * 1024 * 1024) { setError(`El archivo supera los ${MAX_MB} MB`); return }
    setTrabajando(true)
    try {
      const texto = /\.xlsx$/i.test(archivo.name) ? filasACsv(await leerXlsx(archivo)) : await leerTexto(archivo)
      setContenido(texto)
      const res = await fetch(`${API}/import/preview`, {
        method: 'POST', headers, body: JSON.stringify({ tipo, contenido: texto, cotizacion: valorCotizacion() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'No se pudo leer el archivo')
      setVista(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo leer el archivo')
    } finally { setTrabajando(false) }
  }

  // El servidor vuelve a validar todo antes de grabar (no confía en la previsualización)
  const importar = async () => {
    setTrabajando(true); setError('')
    try {
      const res = await fetch(`${API}/import/run`, {
        method: 'POST', headers,
        body: JSON.stringify({ tipo, contenido, cotizacion: valorCotizacion(), actualizar, nombreArchivo: archivo?.name }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'No se pudo importar')
      setResultado(data)
      setVista(null); setConfirmando(false); setArchivo(null); setContenido('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo importar')
    } finally { setTrabajando(false) }
  }

  const plantilla = (t: Tipo) => descargar(generarCsv(COLUMNAS, [EJEMPLO[t]]), `plantilla-${t}.csv`)

  const nuevos = vista?.valid.filter(f => !f.existe).length ?? 0
  const existentes = (vista?.valid.length ?? 0) - nuevos
  const hayDolares = !!vista?.invalid.some(f => f.errores.some(e => e.includes('dólares')))

  return (
    <div className="admin-page">
      {resultado && (
        <div className="admin-alert admin-alert--ok">
          <span><i className="bi bi-check-circle-fill" /> Importación terminada: <strong>{resultado.creados}</strong> nuevo(s), <strong>{resultado.actualizados}</strong> actualizado(s)
            {resultado.omitidos > 0 && <>, {resultado.omitidos} omitido(s) porque ya existían</>}
            {resultado.conError > 0 && <>, {resultado.conError} fila(s) con error no se importaron</>}.</span>
        </div>
      )}

      <div className={vista ? 'admin-grid-5-7' : 'admin-grid-7'}>
        <div>
          <div className="card-admin">
            <div className="card-admin__head"><h2><i className="bi bi-upload" /> Importar desde CSV o Excel</h2></div>
            <div className="card-admin__body">
              <ol className="text-muted-2 import-pasos">
                <li>Descargá la plantilla o <strong>exportá Maquinaria / Repuestos desde el panel del catálogo</strong> (CSV o Excel): ese archivo se puede subir tal cual.</li>
                <li>Si lo armás a mano, completalo en Excel o Google Sheets. No importa el tipo de CSV ni la codificación: los acentos se acomodan solos.</li>
                <li>Subilo acá: primero vas a ver una previsualización con los errores detectados.</li>
                <li>Recién después confirmás la importación.</li>
              </ol>

              <form onSubmit={previsualizar} className="form-stack">
                <div>
                  <label className="form-label" htmlFor="imp-tipo">¿Qué querés importar?</label>
                  <select className="form-select" id="imp-tipo" value={tipo} onChange={e => { setTipo(e.target.value as Tipo); setVista(null) }}>
                    <option value="maquinaria">Maquinaria</option>
                    <option value="repuestos">Repuestos</option>
                  </select>
                </div>
                <div>
                  <label className="form-label" htmlFor="imp-file">Archivo CSV o Excel</label>
                  <input type="file" className="form-control" id="imp-file" accept=".csv,.txt,.xlsx" required
                    onChange={e => {
                      const f = e.target.files?.[0] ?? null
                      setArchivo(f); setVista(null); setError('')
                      // Los archivos que exporta el catálogo se llaman maquinaria-... o repuestos-...: se elige el tipo solo
                      if (f && /maquinaria/i.test(f.name)) setTipo('maquinaria')
                      else if (f && /repuesto/i.test(f.name)) setTipo('repuestos')
                    }} />
                  <p className="form-hint">Máximo {MAX_MB} MB. Separador: punto y coma o coma (se detecta solo).</p>
                </div>
                <div>
                  <label className="form-label" htmlFor="imp-dolar">Cotización del dólar <span className="text-muted-2">(solo si hay precios en USD)</span></label>
                  <input type="number" min="0" step="0.01" className={`form-control${hayDolares && !cotizacion ? ' is-invalid' : ''}`} id="imp-dolar"
                    placeholder="Ej: 1450" value={cotizacion} onChange={e => setCotizacion(e.target.value)} />
                  <p className="form-hint">El ERP trabaja en pesos: los productos que en el catálogo están en dólares se pasan a pesos con este valor.</p>
                </div>
                <button type="submit" className="btn btn-accent" style={{ width: '100%' }} disabled={!archivo || trabajando}>
                  <i className="bi bi-search" /> {trabajando && !vista ? 'Leyendo el archivo...' : 'Previsualizar y validar'}
                </button>
                {error && <p className="form-error">{error}</p>}
              </form>

              <hr className="separador" />

              <div className="card-admin__actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => plantilla('maquinaria')}><i className="bi bi-download" /> Plantilla de maquinaria</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => plantilla('repuestos')}><i className="bi bi-download" /> Plantilla de repuestos</button>
              </div>
            </div>
          </div>

          <div className="card-admin">
            <div className="card-admin__head"><h2><i className="bi bi-list-columns" /> Columnas de la plantilla</h2></div>
            <div className="card-admin__body">
              <p className="text-muted-2 small-text">
                La misma plantilla sirve para maquinaria y repuestos. No cambies los nombres de la primera fila del archivo.
                Las que no apliquen podés dejarlas vacías.
              </p>
              <div className="chip-lista">{COLUMNAS.map(c => <code key={c} className="chip chip--neutral">{c}</code>)}</div>

              <p className="form-section__title" style={{ marginTop: '18px' }}>Valores que acepta cada columna</p>
              <ul className="text-muted-2 import-valores">
                <li><code>codigo</code>: si ya existe, se actualiza ese producto; si lo dejás vacío se genera uno nuevo automáticamente.</li>
                <li><code>costo</code>, <code>ganancia</code>, <code>precio</code>: números sin símbolos. Cargá <em>costo + ganancia</em> <u>o</u> <em>costo + precio</em>; si vienen los tres, manda el precio. Precio <strong>0</strong> (o vacío en uno nuevo) = a consultar.</li>
                <li><code>stock</code>, <code>stock_minimo</code>: números enteros (vacío = 0 y el mínimo por defecto).</li>
                <li><code>activo</code>: poné <strong>si</strong> o <strong>no</strong> (vacío = no se cambia).</li>
                <li>Del archivo del catálogo también se toman <code>marca</code> y <code>modelo</code> (van a la descripción), <code>resumen</code> y <code>moneda</code> (ARS o USD).</li>
              </ul>
              <p className="form-hint" style={{ marginBottom: 0 }}>
                Las categorías que no existan se crean automáticamente. <strong>Las columnas que dejes vacías no se tocan</strong> si
                el código ya existía: sirve para actualizar sólo algunos datos.
              </p>
            </div>
          </div>
        </div>

        {vista && (
          <div className="card-admin">
            <div className="card-admin__head">
              <h2><i className="bi bi-eye" /> Previsualización · {archivo?.name}</h2>
              <div className="card-admin__actions">
                <span className="chip chip--ok">{vista.valid.length} correcta(s)</span>
                <span className="chip chip--danger">{vista.invalid.length} con error</span>
              </div>
            </div>

            <div className="card-admin__body card-admin__body--flush">
              {vista.invalid.length > 0 && <>
                <div className="card-admin__body" style={{ paddingBottom: 8 }}>
                  <p className="form-section__title"><i className="bi bi-exclamation-triangle" /> Filas con error (no se importan)</p>
                </div>
                <div className="table-responsive-admin">
                  <table className="table-admin">
                    <thead><tr><th>Línea</th><th>Código</th><th>Nombre</th><th>Errores</th></tr></thead>
                    <tbody>
                      {vista.invalid.slice(0, 40).map(f => (
                        <tr key={f.linea} className="import-row-error">
                          <td>{f.linea}</td>
                          <td className="text-mono">{f.codigo || '—'}</td>
                          <td>{f.nombre.slice(0, 34)}</td>
                          <td className="import-errors">{f.errores.map((e, i) => <div key={i}>{e}</div>)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>}

              {vista.valid.length > 0 && <>
                <div className="card-admin__body" style={{ paddingBottom: 8 }}>
                  <p className="form-section__title"><i className="bi bi-check-circle" /> Filas correctas</p>
                </div>
                <div className="table-responsive-admin" style={{ maxHeight: 420, overflowY: 'auto' }}>
                  <table className="table-admin">
                    <thead><tr><th>Línea</th><th>Código</th><th>Nombre</th><th>Categoría</th><th className="num">Precio</th><th /></tr></thead>
                    <tbody>
                      {vista.valid.map(f => (
                        <tr key={f.linea} className="import-row-ok">
                          <td>{f.linea}</td>
                          <td className="text-mono">{f.datos.codigo ?? 'automático'}</td>
                          <td>{(f.datos.nombre ?? '').slice(0, 40) || <span className="text-muted-2">sin cambios</span>}</td>
                          <td className="text-muted-2">{f.datos.categoria ?? '—'}</td>
                          <td className="num">{pesos(f.datos.precio)}</td>
                          <td>{f.existe ? <span className="chip chip--info">Actualiza</span> : <span className="chip chip--ok">Nuevo</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>}
            </div>

            {vista.valid.length > 0 && (
              <div className="card-admin__foot">
                {existentes > 0 && (
                  <label className="filter-check">
                    <input type="checkbox" checked={actualizar} onChange={e => setActualizar(e.target.checked)} />
                    Actualizar los {existentes} producto(s) cuyo código ya existe (si lo desmarcás, se omiten)
                  </label>
                )}
                {confirmando ? (
                  <div className="modal-admin__confirm" style={{ background: 'var(--yellow-soft)' }}>
                    <span style={{ flex: 1 }}>¿Confirmás la importación de {vista.valid.length} fila(s)? ({nuevos} nuevo(s), {actualizar ? existentes : 0} a actualizar)</span>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmando(false)} disabled={trabajando}>Cancelar</button>
                    <button type="button" className="btn btn-accent btn-sm" onClick={importar} disabled={trabajando}>
                      <i className="bi bi-check-lg" /> {trabajando ? 'Importando...' : 'Sí, importar'}
                    </button>
                  </div>
                ) : (
                  <button type="button" className="btn btn-accent" onClick={() => setConfirmando(true)}>
                    <i className="bi bi-check-lg" /> Importar {vista.valid.length} fila(s)
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
