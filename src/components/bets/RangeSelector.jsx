export default function RangeSelector({ options, value, onChange, disabled }) {
  const selected = value?.range

  return (
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
      {options.map(opt => {
        const isActive = selected === opt
        return (
          <button
            key={opt}
            onClick={() => !disabled && onChange({ range: opt })}
            disabled={disabled}
            style={{
              flex: '1 1 auto',
              minWidth: '60px',
              padding: '10px 14px',
              borderRadius: '6px',
              border: isActive ? '1.5px solid var(--gold)' : '1px solid var(--border)',
              background: isActive ? 'var(--gold-dim)' : 'var(--bg-input)',
              color: isActive ? 'var(--gold)' : 'var(--text-muted)',
              fontSize: '13px',
              fontWeight: isActive ? '600' : '400',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.5 : 1,
              textAlign: 'center'
            }}
          >
            {opt}
          </button>
        )
      })}
    </div>
  )
}
