/**
 * Empty state component for when there's no data to show.
 * Usage:
 *   <EmptyState icon="⚽" title="Sin predicciones" subtitle="Empieza a predecir..." />
 */
export default function EmptyState({ icon = '📭', title, subtitle, action }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 24px',
      textAlign: 'center',
    }}>
      <span style={{ fontSize: '40px', marginBottom: '16px', opacity: 0.8 }}>{icon}</span>
      <h3 style={{
        margin: '0 0 8px',
        fontSize: '16px',
        fontWeight: '600',
        color: 'var(--text-primary)',
      }}>
        {title}
      </h3>
      {subtitle && (
        <p style={{
          margin: 0,
          fontSize: '13px',
          color: 'var(--text-muted)',
          maxWidth: '280px',
          lineHeight: '1.5',
        }}>
          {subtitle}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          style={{
            marginTop: '20px',
            padding: '10px 24px',
            background: 'var(--green)',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
