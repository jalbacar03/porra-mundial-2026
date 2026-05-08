/**
 * Reusable circular avatar — initials-only.
 * Photos / picker were removed by product decision; we just compute
 * initials from the user's full name (or nickname as fallback).
 *
 * Initials rules:
 *  - "Javier Albacar" -> "JA"
 *  - "Javi" -> "J"
 *  - empty -> "?"
 */
export default function Avatar({
  name,
  size = 36,
  color = 'rgba(255,255,255,0.05)',
  border = '1px solid rgba(255,255,255,0.06)',
  textColor = 'var(--text-muted)',
  onClick = null,
  style = {}
}) {
  const initials = computeInitials(name)
  return (
    <div
      onClick={onClick}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        background: color,
        border,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: `${Math.round(size * 0.4)}px`,
        fontWeight: 700,
        color: textColor,
        flexShrink: 0,
        cursor: onClick ? 'pointer' : 'default',
        letterSpacing: '0.5px',
        userSelect: 'none',
        ...style
      }}
    >
      {initials}
    </div>
  )
}

export function computeInitials(name) {
  if (!name || typeof name !== 'string') return '?'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
