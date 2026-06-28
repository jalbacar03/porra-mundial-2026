/**
 * Loading skeleton component with shimmer animation.
 * Usage:
 *   <Skeleton width="100%" height="20px" />
 *   <Skeleton variant="card" />
 *   <Skeleton variant="leaderboard" rows={10} />
 */

const shimmerStyle = {
  background: 'linear-gradient(90deg, var(--bg-card) 25%, #2d3040 50%, var(--bg-card) 75%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.5s infinite',
  borderRadius: '6px',
}

export function Skeleton({ width = '100%', height = '16px', borderRadius = '6px', style = {} }) {
  return (
    <div style={{
      ...shimmerStyle,
      width,
      height,
      borderRadius,
      ...style,
    }} />
  )
}

export function SkeletonCard({ height = '80px' }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      borderRadius: '10px',
      border: '0.5px solid var(--border)',
      padding: '16px',
      marginBottom: '8px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <Skeleton width="40%" height="14px" />
        <Skeleton width="60px" height="14px" />
      </div>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <Skeleton width="30%" height="18px" />
        <Skeleton width="50px" height="28px" borderRadius="4px" />
        <Skeleton width="10px" height="14px" />
        <Skeleton width="50px" height="28px" borderRadius="4px" />
        <Skeleton width="30%" height="18px" />
      </div>
    </div>
  )
}

export function SkeletonLeaderboard({ rows = 10 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} style={{
          background: 'var(--bg-card)',
          borderRadius: '8px',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          border: '0.5px solid var(--border)',
        }}>
          <Skeleton width="24px" height="24px" borderRadius="50%" />
          <Skeleton width="40%" height="14px" />
          <div style={{ marginLeft: 'auto' }}>
            <Skeleton width="40px" height="18px" />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Pulsing soccer ball — discrete but with character.
 * Usage:
 *   <FootballSpinner />
 *   <FootballSpinner size={32} text="Cargando partido…" />
 */
export function FootballSpinner({ size = 28, text = null, padded = true }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: text ? '10px' : 0,
      padding: padded ? '32px 16px' : 0
    }}>
      <div className="football-spin" style={{
        position: 'relative',
        width: `${size}px`,
        height: `${size}px`
      }}>
        <svg viewBox="0 0 32 32" width={size} height={size}
             style={{ display: 'block', filter: 'drop-shadow(0 4px 8px rgba(37,99,235,0.18))' }}>
          <circle cx="16" cy="16" r="14" fill="#22252f" stroke="rgba(255,255,255,0.18)" strokeWidth="0.6" />
          <polygon points="16,8 21,12 19,18 13,18 11,12" fill="#0e1014" />
          <line x1="16" y1="3" x2="16" y2="8"   stroke="#0e1014" strokeWidth="0.7" />
          <line x1="22.5" y1="6.5" x2="21" y2="12" stroke="#0e1014" strokeWidth="0.7" />
          <line x1="9.5"  y1="6.5" x2="11" y2="12" stroke="#0e1014" strokeWidth="0.7" />
          <line x1="26"   y1="14"  x2="21" y2="18.5" stroke="#0e1014" strokeWidth="0.7" />
          <line x1="6"    y1="14"  x2="11" y2="18.5" stroke="#0e1014" strokeWidth="0.7" />
          <line x1="22"   y1="25"  x2="19" y2="20" stroke="#0e1014" strokeWidth="0.7" />
          <line x1="10"   y1="25"  x2="13" y2="20" stroke="#0e1014" strokeWidth="0.7" />
        </svg>
      </div>
      {text && (
        <span style={{
          fontSize: '12px', color: 'var(--text-dim)',
          letterSpacing: '0.4px', fontWeight: '500',
          opacity: 0.85
        }}>{text}</span>
      )}
    </div>
  )
}

/**
 * Pulsing dots loader — like Claude's thinking animation.
 * Usage: <PulseDots /> or <PulseDots color="var(--gold)" size={8} />
 */
export function PulseDots({ color = 'var(--green)', size = 6 }) {
  return (
    <span className="pulse-dots">
      <span style={{ width: size, height: size, background: color }} />
      <span style={{ width: size, height: size, background: color }} />
      <span style={{ width: size, height: size, background: color }} />
    </span>
  )
}

export function SkeletonDashboard() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px' }}>
      {/* Position widget */}
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: '10px',
        padding: '20px',
        border: '0.5px solid var(--border)',
      }}>
        <Skeleton width="60%" height="16px" style={{ marginBottom: '12px' }} />
        <Skeleton width="80px" height="32px" style={{ marginBottom: '8px' }} />
        <Skeleton width="40%" height="12px" />
      </div>
      {/* Other widgets */}
      <SkeletonCard />
      <SkeletonCard />
    </div>
  )
}
