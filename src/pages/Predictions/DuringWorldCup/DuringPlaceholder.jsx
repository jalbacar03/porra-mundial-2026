import { useCountdown, WORLD_CUP_START } from '../../../hooks/useCountdown'

export default function DuringPlaceholder() {
  const countdown = useCountdown(WORLD_CUP_START)

  return (
    <div style={{
      textAlign: 'center',
      padding: '40px 20px'
    }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏟️</div>
      <h3 style={{
        fontSize: '16px',
        fontWeight: '600',
        color: 'var(--text-primary)',
        marginBottom: '8px'
      }}>
        Apuestas durante el Mundial
      </h3>
      <p style={{
        fontSize: '13px',
        color: 'var(--text-muted)',
        marginBottom: '24px',
        lineHeight: '1.5'
      }}>
        Las apuestas durante el Mundial se activarán cuando comience la competición.
      </p>

      {!countdown.expired && (
        <div style={{
          display: 'inline-flex',
          gap: '16px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: '10px',
          padding: '16px 24px'
        }}>
          {[
            { value: countdown.days, label: 'días' },
            { value: countdown.hours, label: 'horas' },
            { value: countdown.minutes, label: 'min' }
          ].map((unit, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: '22px',
                fontWeight: '700',
                color: 'var(--text-primary)',
                fontVariantNumeric: 'tabular-nums'
              }}>
                {String(unit.value).padStart(2, '0')}
              </div>
              <div style={{
                fontSize: '9px',
                color: 'var(--text-dim)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                {unit.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {countdown.expired && (
        <div style={{
          background: 'var(--green-light)',
          border: '1px solid var(--green)',
          borderRadius: '8px',
          padding: '14px 20px',
          color: 'var(--green)',
          fontSize: '14px',
          fontWeight: '600'
        }}>
          ¡Próximamente!
        </div>
      )}
    </div>
  )
}
