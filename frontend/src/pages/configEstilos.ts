// Estilos compartidos por las pestañas de Configuración
export const campo: Record<string, React.CSSProperties> = {
  card:      { background: '#FFFFFF', border: '1px solid #E2E4E8', borderRadius: '12px', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '12px' },
  seccion:   { color: '#6B6B6B', fontSize: '11px', fontWeight: '700', letterSpacing: '1px', textTransform: 'uppercase', margin: 0 },
  grid2:     { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' },
  grid3:     { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px' },
  field:     { display: 'flex', flexDirection: 'column', gap: '5px', minWidth: 0 },
  label:     { color: '#333333', fontSize: '11px', fontWeight: '600', letterSpacing: '0.5px' },
  input:     { background: '#FFFFFF', border: '1px solid #D3D3D3', borderRadius: '8px', padding: '9px 12px', color: '#111111', fontSize: '14px', outline: 'none', width: '100%', boxSizing: 'border-box' },
  error:     { color: '#C6402F', fontSize: '13px', margin: 0 },
  ok:        { color: '#1E7A45', fontSize: '13px', fontWeight: '600', margin: 0 },
  acciones:  { display: 'flex', gap: '10px', justifyContent: 'flex-end', alignItems: 'center' },
  btnPrimary:{ background: '#F5C400', color: '#111111', border: 'none', borderRadius: '8px', padding: '9px 18px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' },
  btnSecondary:{ background: '#FFFFFF', color: '#333333', border: '1px solid #E2E4E8', borderRadius: '8px', padding: '9px 18px', fontWeight: '600', fontSize: '13px', cursor: 'pointer' },
  btnDanger: { background: '#C6402F', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' },
}
