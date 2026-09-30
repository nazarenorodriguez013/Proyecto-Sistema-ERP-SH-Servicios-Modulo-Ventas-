import type { ReactNode } from 'react'
import { EMPRESA, formatPuntoVenta, formatNumero } from '../config'

export interface TipoHoja { letra: string; cod: string; titulo: string }
export interface Fila { label: string; value: string }

interface Props {
  tipo: TipoHoja | null
  titulo: string
  numero: number | null
  fecha: Date
  receptor: Fila[]
  children: ReactNode
  lineasTotal?: Fila[]
  total?: string | null
  nota?: string
  onClose: () => void
}

const fmtFecha = (d: Date) => d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })

// Hoja A4 completa con el formato de una factura de AFIP: encabezado con la letra del tipo, datos del
// cliente, detalle en el medio y el TOTAL siempre abajo de la página. Es el #ticket que toma el CSS de impresión.
export default function HojaComprobante({ tipo, titulo, numero, fecha, receptor, children, lineasTotal, total, nota, onClose }: Props) {
  const emisor: Fila[] = [
    { label: 'Domicilio Comercial', value: EMPRESA.domicilio },
    { label: 'Condición frente al IVA', value: EMPRESA.condicionIva },
    { label: 'Teléfono', value: EMPRESA.telefono },
    { label: 'E-mail', value: EMPRESA.email },
  ].filter(f => f.value)
  const fiscales: Fila[] = [
    { label: 'CUIT', value: EMPRESA.cuit },
    { label: 'Ingresos Brutos', value: EMPRESA.ingresosBrutos },
    { label: 'Fecha de Inicio de Actividades', value: EMPRESA.inicioActividades },
  ].filter(f => f.value)

  return (
    <div style={s.overlay}>
      <div style={s.modalWrap}>
        <div id="ticket" style={s.hoja}>
          <img src="/logosh.png" alt="" style={s.watermark} />

          <div style={s.encabezado}>
            <div style={s.colIzq}>
              <div style={s.marca}>
                <div style={s.logoBox}>SH</div>
                <div>
                  <h1 style={s.empresaNombre}>{EMPRESA.razonSocial}</h1>
                  <p style={s.empresaSub}>{EMPRESA.rubro}</p>
                </div>
              </div>
              {emisor.map(f => <p key={f.label} style={s.dato}><b>{f.label}:</b> {f.value}</p>)}
            </div>

            <div style={s.colCentro}>
              {tipo && (
                <div style={s.letraBox}>
                  <span style={s.letraGrande}>{tipo.letra}</span>
                  <span style={s.letraCod}>Cód. {tipo.cod}</span>
                </div>
              )}
            </div>

            <div style={s.colDer}>
              <p style={s.tipoTitulo}>{titulo}</p>
              {tipo && (
                <p style={s.dato}>
                  <b>Punto de Venta:</b> {formatPuntoVenta()} &nbsp;&nbsp; <b>Comp. Nro.:</b> {numero ? formatNumero(numero) : 'S/N'}
                </p>
              )}
              <p style={s.dato}><b>Fecha de Emisión:</b> {fmtFecha(fecha)}</p>
              {fiscales.map(f => <p key={f.label} style={s.dato}><b>{f.label}:</b> {f.value}</p>)}
            </div>
          </div>

          <div style={s.receptor}>
            {receptor.map(f => (
              <p key={f.label} style={s.receptorFila}><b>{f.label}:</b> {f.value || '—'}</p>
            ))}
          </div>

          <div style={s.cuerpo}>{children}</div>

          <div style={s.pie}>
            {total != null && (
              <>
                {lineasTotal?.map(f => (
                  <div key={f.label} style={s.lineaTotal}><span>{f.label}</span><span>{f.value}</span></div>
                ))}
                <div style={s.totalBloque}>
                  <span style={s.totalLabel}>TOTAL</span>
                  <span style={s.totalValor}>{total}</span>
                </div>
                <div style={s.cae}>
                  <span>Página 1/1</span>
                  <span>CAE Nº: ______________________</span>
                  <span>Fecha de Vto. de CAE: ____/____/________</span>
                </div>
              </>
            )}
            {nota && <p style={s.nota}>{nota}</p>}
          </div>
        </div>

        <div style={s.acciones}>
          <button style={s.btnImprimir} onClick={() => window.print()}><i className="bi bi-printer" /> Imprimir</button>
          <button style={s.btnCerrar} onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}

export const tabla: Record<string, React.CSSProperties> = {
  tabla:   { width: '100%', borderCollapse: 'collapse' as const },
  th:      { fontSize: '10px', fontWeight: '700', color: '#111111', padding: '0 6px 5px', borderBottom: '1px solid #111111', textAlign: 'left' },
  tr:      { borderBottom: '1px solid #E2E4E8' },
  td:      { fontSize: '11px', color: '#111111', padding: '7px 6px' },
}

const s: Record<string, React.CSSProperties> = {
  overlay:    { position: 'fixed', inset: 0, background: 'rgba(17,17,17,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' },
  modalWrap:  { background: '#EFF1F4', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' },

  hoja:       { position: 'relative', display: 'flex', flexDirection: 'column', minHeight: '297mm', background: '#fff', width: '210mm', maxWidth: '100%', boxSizing: 'border-box' as const, padding: '12mm', fontFamily: 'Arial, Helvetica, sans-serif', color: '#111111', boxShadow: '0 2px 12px rgba(17,17,17,0.15)' },
  watermark:  { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '60%', opacity: 0.08, filter: 'invert(1) grayscale(1)', mixBlendMode: 'multiply', pointerEvents: 'none' as const, zIndex: 0 },

  encabezado: { display: 'grid', gridTemplateColumns: '1fr 62px 1fr', border: '1px solid #111111', position: 'relative', zIndex: 1 },
  colIzq:     { padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '3px' },
  colCentro:  { borderLeft: '1px solid #111111', borderRight: '1px solid #111111', display: 'flex', flexDirection: 'column' },
  colDer:     { padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '3px' },
  marca:      { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' },
  logoBox:    { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '46px', height: '46px', background: '#F5C400', borderRadius: '8px', color: '#111111', fontWeight: '900', fontSize: '16px', flexShrink: 0 },
  empresaNombre: { fontSize: '17px', fontWeight: '900', margin: 0 },
  empresaSub: { fontSize: '10px', color: '#444444', margin: '2px 0 0' },
  letraBox:   { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #111111', padding: '4px 0 3px' },
  letraGrande:{ fontSize: '34px', fontWeight: '900', lineHeight: 1 },
  letraCod:   { fontSize: '8px', fontWeight: '600' },
  tipoTitulo: { fontSize: '17px', fontWeight: '800', margin: '0 0 4px', letterSpacing: '0.5px' },
  dato:       { fontSize: '11px', margin: 0, color: '#111111' },

  receptor:   { border: '1px solid #111111', borderTop: 'none', padding: '8px 12px', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '4px 16px', position: 'relative', zIndex: 1 },
  receptorFila: { fontSize: '11px', margin: 0 },

  cuerpo:     { marginTop: '14px', position: 'relative', zIndex: 1 },

  pie:        { marginTop: 'auto', paddingTop: '16px', position: 'relative', zIndex: 1 },
  lineaTotal: { display: 'flex', justifyContent: 'flex-end', gap: '24px', fontSize: '11px', color: '#444444', marginBottom: '2px' },
  totalBloque:{ display: 'flex', justifyContent: 'flex-end', alignItems: 'baseline', gap: '24px', borderTop: '1px solid #111111', paddingTop: '6px', marginTop: '4px' },
  totalLabel: { fontSize: '13px', fontWeight: '800' },
  totalValor: { fontSize: '20px', fontWeight: '900' },
  cae:        { display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' as const, fontSize: '10px', color: '#444444', marginTop: '14px', paddingTop: '8px', borderTop: '1px solid #E2E4E8' },
  nota:       { textAlign: 'center' as const, fontSize: '11px', color: '#6B6B6B', fontStyle: 'italic', margin: '10px 0 0' },

  acciones:    { display: 'flex', gap: '10px' },
  btnImprimir: { flex: 1, padding: '12px', background: '#111111', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' },
  btnCerrar:   { flex: 1, padding: '12px', background: '#F5C400', color: '#111111', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '800', cursor: 'pointer' },
}
