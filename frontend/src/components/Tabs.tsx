interface Tab<T extends string> { id: T; label: string; icon: string }

// Pestañas para dividir una pantalla del menú en secciones sin agregar niveles al menú
export default function Tabs<T extends string>({ tabs, active, onChange }: { tabs: Tab<T>[]; active: T; onChange: (id: T) => void }) {
  return (
    <div style={s.tabs}>
      {tabs.map(t => (
        <button key={t.id} style={{ ...s.tab, ...(active === t.id ? s.tabActive : {}) }} onClick={() => onChange(t.id)}>
          <i className={`bi ${t.icon}`} /> {t.label}
        </button>
      ))}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  tabs:      { display: 'flex', gap: '4px', padding: '16px 28px 0', borderBottom: '1px solid #E2E4E8' },
  tab:       { display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: 'none', borderBottom: '2px solid transparent', padding: '8px 14px', color: '#6B6B6B', fontSize: '13px', fontWeight: '600', cursor: 'pointer', marginBottom: '-1px' },
  tabActive: { color: '#111111', borderBottom: '2px solid #F5C400' },
}
