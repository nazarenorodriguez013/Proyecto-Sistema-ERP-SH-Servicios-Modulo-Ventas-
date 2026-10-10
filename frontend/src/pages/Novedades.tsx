import novedades from '../content/novedades.html?raw'

// Notas de las actualizaciones del sistema. El contenido sale de src/content/novedades.html (se edita a mano)
export default function Novedades() {
  return (
    <div className="admin-page">
      <div className="card-admin card-admin--news">
        <div className="card-admin__head">
          <h2><i className="bi bi-megaphone-fill" /> Novedades</h2>
          <span className="text-muted-2" style={{ fontSize: '.875rem' }}>Notas de las actualizaciones del sistema</span>
        </div>
        <div className="card-admin__body">
          {novedades.trim()
            ? <div className="news-body" dangerouslySetInnerHTML={{ __html: novedades }} />
            : <p className="text-muted-2" style={{ margin: 0 }}>Todavía no hay novedades cargadas.</p>}
        </div>
      </div>
    </div>
  )
}
