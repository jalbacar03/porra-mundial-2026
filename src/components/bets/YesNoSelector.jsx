export default function YesNoSelector({ value, onChange, disabled }) {
  const selected = value?.answer

  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      {['yes', 'no'].map(opt => {
        const isActive = selected === opt
        return (
          <button
            key={opt}
            onClick={() => !disabled && onChange({ answer: opt })}
            disabled={disabled}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: '6px',
              border: isActive
                ? `1.5px solid ${opt === 'yes' ? 'var(--green)' : 'var(--red)'}`
                : '1px solid var(--border)',
              background: isActive
                ? opt === 'yes' ? 'var(--green-light)' : 'var(--red-bg)'
                : 'var(--bg-input)',
              color: isActive
                ? opt === 'yes' ? 'var(--green)' : 'var(--red)'
                : 'var(--text-muted)',
              fontSize: '14px',
              fontWeight: isActive ? '600' : '400',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.5 : 1
            }}
          >
            {opt === 'yes' ? 'Sí' : 'No'}
          </button>
        )
      })}
    </div>
  )
}
