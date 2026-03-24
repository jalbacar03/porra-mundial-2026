const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']

export default function GroupSelector({ value, onChange, disabled }) {
  const selected = value?.group

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(6, 1fr)',
      gap: '6px'
    }}>
      {GROUPS.map(g => {
        const isActive = selected === g
        return (
          <button
            key={g}
            onClick={() => !disabled && onChange({ group: g })}
            disabled={disabled}
            style={{
              padding: '10px 0',
              borderRadius: '6px',
              border: isActive ? '1.5px solid var(--gold)' : '1px solid var(--border)',
              background: isActive ? 'var(--gold-dim)' : 'var(--bg-input)',
              color: isActive ? 'var(--gold)' : 'var(--text-muted)',
              fontSize: '13px',
              fontWeight: isActive ? '700' : '500',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.5 : 1,
              textAlign: 'center'
            }}
          >
            {g}
          </button>
        )
      })}
    </div>
  )
}
