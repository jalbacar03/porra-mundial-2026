import { useState } from 'react'

export default function PlayerInput({ value, onChange, disabled, placeholder }) {
  const [text, setText] = useState(value?.player_name || '')

  function handleBlur() {
    const trimmed = text.trim()
    if (trimmed && trimmed !== (value?.player_name || '')) {
      onChange({ player_name: trimmed })
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.target.blur()
    }
  }

  // Sync external value changes
  const displayValue = value?.player_name || ''
  if (displayValue && !text && displayValue !== text) {
    setText(displayValue)
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        type="text"
        value={text}
        onChange={e => setText(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder || 'Nombre del jugador...'}
        style={{
          width: '100%',
          padding: '10px 14px',
          borderRadius: '6px',
          border: text
            ? '1px solid var(--border)'
            : '1px solid var(--green)',
          background: 'var(--bg-input)',
          color: text ? 'var(--text-primary)' : 'var(--text-dim)',
          fontSize: '14px',
          boxSizing: 'border-box',
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? 'not-allowed' : 'text'
        }}
      />
      {displayValue && (
        <div style={{
          position: 'absolute',
          right: '10px',
          top: '50%',
          transform: 'translateY(-50%)',
          fontSize: '10px',
          color: 'var(--green)',
          fontWeight: '600'
        }}>
          ✓
        </div>
      )}
    </div>
  )
}
