/**
 * Reusable circular avatar.
 * Shows the user's uploaded image when avatar_url is present, falls back to
 * a single-letter initial on a muted background.
 */
export default function Avatar({
  url,
  name,
  size = 36,
  color = 'rgba(255,255,255,0.05)',
  border = '1px solid rgba(255,255,255,0.06)',
  textColor = 'var(--text-muted)',
  onClick = null,
  style = {}
}) {
  const initial = ((name || '?')[0] || '?').toUpperCase()
  const baseStyle = {
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: '50%',
    background: color,
    border,
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: `${Math.round(size * 0.42)}px`,
    fontWeight: 700,
    color: textColor,
    flexShrink: 0,
    cursor: onClick ? 'pointer' : 'default',
    ...style
  }

  return (
    <div onClick={onClick} style={baseStyle}>
      {url ? (
        <img
          src={url}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />
      ) : (
        initial
      )}
    </div>
  )
}
