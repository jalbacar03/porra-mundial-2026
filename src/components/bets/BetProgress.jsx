export default function BetProgress({ completed, total }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0
  const isComplete = completed === total && total > 0

  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: '0.5px solid var(--border)',
      borderRadius: '8px',
      padding: '12px 16px',
      marginBottom: '16px'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '8px'
      }}>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          Progreso predicciones pre-torneo
        </span>
        <span style={{
          fontSize: '13px',
          fontWeight: '600',
          color: isComplete ? 'var(--green)' : 'var(--gold)'
        }}>
          {completed}/{total}
        </span>
      </div>
      <div style={{
        height: '6px',
        background: 'var(--bg-input)',
        borderRadius: '3px',
        overflow: 'hidden'
      }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: isComplete
            ? 'var(--green)'
            : 'linear-gradient(90deg, var(--gold), #ffdd44)',
          borderRadius: '3px',
          transition: 'width 0.4s ease'
        }} />
      </div>
    </div>
  )
}
