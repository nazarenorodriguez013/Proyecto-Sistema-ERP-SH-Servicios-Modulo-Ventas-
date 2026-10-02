// Estilos de la tabla de detalle compartidos por los comprobantes de ventas y de servicios
export const tabla: Record<string, React.CSSProperties> = {
  tabla:   { width: '100%', borderCollapse: 'collapse' as const },
  th:      { fontSize: '10px', fontWeight: '700', color: '#111111', padding: '0 6px 5px', borderBottom: '1px solid #111111', textAlign: 'left' },
  tr:      { borderBottom: '1px solid #E2E4E8' },
  td:      { fontSize: '11px', color: '#111111', padding: '7px 6px' },
}
