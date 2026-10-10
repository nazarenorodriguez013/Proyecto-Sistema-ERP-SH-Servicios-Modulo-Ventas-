import { useState, useEffect } from 'react'
import type { User } from '../types'
import { API } from '../config'
import { puede } from '../permisos'

interface Categoria { id: number; nombre: string; _count: { productos: number } }

// Misma disposición que Categorías en el panel del catálogo: listado a la izquierda, alta a la derecha y edición en modal
export default function Categorias({ user }: { user: User }) {
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [nuevo, setNuevo] = useState('')
  const [errorAlta, setErrorAlta] = useState('')
  const [editando, setEditando] = useState<Categoria | null>(null)
  const [nombre, setNombre] = useState('')
  const [borrando, setBorrando] = useState<Categoria | null>(null)
  const [error, setError] = useState('')

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` }
  // Editan los roles con "categorias.gestionar"; el resto solo consulta
  const isAdmin = puede(user, 'categorias.gestionar')

  const fetchAll = () =>
    fetch(`${API}/categories`, { headers })
      .then(r => r.json())
      .then(data => { setCategorias(data); setLoading(false) })

  useEffect(() => { fetchAll() }, [])

  const cerrar = () => { setEditando(null); setBorrando(null); setError('') }

  // Devuelve el mensaje de error de la API, o null si salió bien (y en ese caso refresca la lista)
  const llamar = async (method: string, path: string, body?: object) => {
    const res = await fetch(`${API}/categories${path}`, { method, headers, body: body && JSON.stringify(body) })
    if (!res.ok) return (await res.json()).message || 'No se pudo guardar la categoría'
    fetchAll()
    return null
  }

  const crear = async (e: React.FormEvent) => {
    e.preventDefault()
    const err = await llamar('POST', '', { nombre: nuevo })
    setErrorAlta(err ?? '')
    if (!err) setNuevo('')
  }

  const guardarEdicion = async (e: React.FormEvent) => {
    e.preventDefault()
    const err = await llamar('PUT', `/${editando!.id}`, { nombre })
    if (err) setError(err)
    else cerrar()
  }

  const eliminar = async () => {
    const err = await llamar('DELETE', `/${borrando!.id}`)
    if (err) setError(err)
    else cerrar()
  }

  if (loading) return <div className="admin-page text-muted-2" style={{ textAlign: 'center', padding: '40px' }}>Cargando...</div>

  return (
    <div className="admin-page">
      <div className={isAdmin ? 'admin-grid-8-4' : undefined}>
        <div className="card-admin">
          <div className="card-admin__head">
            <h2><i className="bi bi-diagram-3-fill" /> Categorías</h2>
            <span className="text-muted-2" style={{ fontSize: '.875rem' }}>{categorias.length} categoría(s)</span>
          </div>
          <div className="card-admin__body card-admin__body--flush">
            <div className="table-responsive-admin">
              <table className="table-admin">
                <thead>
                  <tr>
                    <th>Categoría</th>
                    <th className="num">Productos</th>
                    {isAdmin && <th className="actions">Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {categorias.map(c => (
                    <tr key={c.id}>
                      <td>
                        <div className="table-product">
                          <span className="table-thumb table-thumb--dark"><i className="bi bi-folder" /></span>
                          <span className="table-product__name">{c.nombre}</span>
                        </div>
                      </td>
                      <td className="num">{c._count.productos}</td>
                      {isAdmin && (
                        <td className="actions">
                          <button type="button" className="btn-icon" title="Editar"
                            onClick={() => { setNombre(c.nombre); setError(''); setEditando(c) }}>
                            <i className="bi bi-pencil" />
                          </button>{' '}
                          <button type="button" className="btn-icon btn-icon--danger" title="Eliminar"
                            onClick={() => { setError(''); setBorrando(c) }}>
                            <i className="bi bi-trash" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {categorias.length === 0 && (
                    <tr><td colSpan={3} className="table-admin__empty"><i className="bi bi-inbox" />Todavía no hay categorías.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {isAdmin && (
          <div className="card-admin">
            <div className="card-admin__head"><h2><i className="bi bi-plus-circle" /> Nueva categoría</h2></div>
            <div className="card-admin__body">
              <form onSubmit={crear} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label className="form-label" htmlFor="c-name">Nombre *</label>
                  <input type="text" className="form-control" id="c-name" required maxLength={120}
                    placeholder="Herramientas neumáticas" value={nuevo} onChange={e => setNuevo(e.target.value)} />
                  {errorAlta && <p className="form-error">{errorAlta}</p>}
                </div>
                <button type="submit" className="btn btn-accent" style={{ width: '100%' }}><i className="bi bi-plus-lg" /> Crear categoría</button>
              </form>
            </div>
          </div>
        )}
      </div>

      {editando && (
        <div className="modal-admin-backdrop modal-admin-backdrop--center" onMouseDown={e => { if (e.target === e.currentTarget) cerrar() }}>
          <div className="modal-admin modal-admin--sm" role="dialog" aria-modal="true">
            <div className="modal-admin__head">
              <h3>Editar «{editando.nombre}»</h3>
              <button type="button" className="modal-admin__close" aria-label="Cerrar" onClick={cerrar}><i className="bi bi-x-lg" /></button>
            </div>
            <form onSubmit={guardarEdicion}>
              <div className="modal-admin__body">
                <div>
                  <label className="form-label">Nombre *</label>
                  <input type="text" className="form-control" required maxLength={120} autoFocus value={nombre} onChange={e => setNombre(e.target.value)} />
                </div>
                {error && <p className="form-error">{error}</p>}
              </div>
              <div className="modal-admin__foot" style={{ justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost" onClick={cerrar}>Cancelar</button>
                <button type="submit" className="btn btn-accent"><i className="bi bi-check-lg" /> Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {borrando && (
        <div className="modal-admin-backdrop modal-admin-backdrop--center" onMouseDown={e => { if (e.target === e.currentTarget) cerrar() }}>
          <div className="modal-admin modal-admin--sm" role="dialog" aria-modal="true">
            <div className="modal-admin__head">
              <h3>Eliminar categoría</h3>
              <button type="button" className="modal-admin__close" aria-label="Cerrar" onClick={cerrar}><i className="bi bi-x-lg" /></button>
            </div>
            <div className="modal-admin__body">
              <p style={{ margin: 0 }}>¿Eliminar la categoría «{borrando.nombre}»?</p>
              {error && <p className="form-error">{error}</p>}
            </div>
            <div className="modal-admin__foot" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={cerrar}>Cancelar</button>
              <button type="button" className="btn btn-danger" onClick={eliminar}><i className="bi bi-trash" /> Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
