/**
 * ScorePicker — compact button grid for picking match scores.
 *
 * Top row: 0 · 1 · 2 · 3 · 4 · 5+
 * If the user picks 5+ (or the current value is ≥5), a refinement row
 * appears underneath: 5 · 6 · 7 · 8+. The "5+" main button mirrors the
 * exact value (e.g. "6"). Picking 0-4 collapses the refinement row.
 *
 * The component never returns null/undefined values — onChange always
 * receives a number (0-8). Goleadas with ≥8 collapse to 8.
 *
 * Used in GroupMatchPredictions to replace the old <input type="number">
 * — inputs forced the mobile numeric keyboard, taps are quicker.
 */

const PRIMARY = [0, 1, 2, 3, 4]
const HIGH = [5, 6, 7, 8]

export default function ScorePicker({ value, onChange, disabled, accent = 'green' }) {
  const isHigh = typeof value === 'number' && value >= 5
  const mainLabel = isHigh ? (value >= 8 ? '8+' : String(value)) : '5+'

  // Border colour of selected button — matches the save-state colour of the
  // surrounding card (green = saved, gold = unsaved). Caller controls it.
  const selectedBg = accent === 'gold' ? 'var(--gold)' : 'var(--green)'
  const selectedColor = accent === 'gold' ? '#1a1d26' : '#fff'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '3px' }}>
        {PRIMARY.map(n => (
          <ScoreButton
            key={n}
            label={String(n)}
            selected={value === n}
            disabled={disabled}
            onClick={() => onChange(n)}
            selectedBg={selectedBg}
            selectedColor={selectedColor}
          />
        ))}
        <ScoreButton
          label={mainLabel}
          selected={isHigh}
          disabled={disabled}
          onClick={() => onChange(isHigh ? value : 5)}
          selectedBg={selectedBg}
          selectedColor={selectedColor}
        />
      </div>
      {isHigh && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '3px' }}>
          {HIGH.map(n => (
            <ScoreButton
              key={n}
              label={n === 8 ? '8+' : String(n)}
              selected={value === n}
              disabled={disabled}
              onClick={() => onChange(n)}
              selectedBg={selectedBg}
              selectedColor={selectedColor}
              small
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ScoreButton({ label, selected, disabled, onClick, selectedBg, selectedColor, small }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: small ? '5px 0' : '7px 0',
        borderRadius: '5px',
        border: '1px solid',
        borderColor: selected ? selectedBg : 'var(--border-light)',
        background: selected ? selectedBg : 'var(--bg-input)',
        color: selected ? selectedColor : 'var(--text-primary)',
        fontSize: small ? '12px' : '13px',
        fontWeight: '700',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        transition: 'background 0.12s ease, border-color 0.12s ease',
        fontVariantNumeric: 'tabular-nums',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {label}
    </button>
  )
}
