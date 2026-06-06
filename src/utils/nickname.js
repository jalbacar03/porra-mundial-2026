/**
 * Nickname helpers.
 *
 * - defaultNickname(fullName) → slugifica "Javi Albácar" → "javi.albacar"
 * - displayName(profile)      → nickname || full_name (fallback gradual mientras
 *                                la gente todavía no haya elegido nickname)
 * - validateNickname(n)       → { ok: bool, error?: string }
 */

export function defaultNickname(fullName) {
  if (!fullName) return ''
  return fullName
    .toLowerCase()
    .normalize('NFD')                  // separa letra + tilde
    .replace(/[̀-ͯ]/g, '')   // quita los diacríticos
    .replace(/[^a-z0-9\s.]/g, '')       // quita símbolos (deja puntos por si pedro.j)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .join('.')
    .replace(/\.+/g, '.')              // colapsa puntos múltiples
    .replace(/^\.+|\.+$/g, '')         // sin puntos al principio/fin
}

// ─── Modo de visualización de nombres ───────────────────────────────────
// UN SOLO interruptor para toda la app. 'real' = nombre real (formateado);
// 'nickname' = el alias elegido. Cambiar aquí lo cambia en TODOS los sitios
// que usan displayName() (leaderboard, foro, pre-mundial, admin, crónica…).
export const NAME_MODE = 'real' // 'real' | 'nickname'

// Overrides manuales de nombre real (compuestos, preposiciones, etc).
// Key = full_name exacto.
export const NAME_OVERRIDES = {
  'José Antonio Menéndez': 'José Menéndez',
  'Gonzalo de Parellada Menéndez': 'Gonzalo de Parellada',
  'Jose Maria Guitart': 'Jose María Guitart',
  'Álvaro García Magro': 'Álvaro García M.',
}

// "javi albácar" → "Javi Albácar"; coge nombre + primer apellido real,
// saltando preposiciones ("de", "del") e iniciales ("J."). Title Case.
export function formatRealName(fullName) {
  if (!fullName) return ''
  if (NAME_OVERRIDES[fullName]) return NAME_OVERRIDES[fullName]
  const PREPS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'da', 'do', 'di'])
  const isInitial = (w) => /^[a-záéíóúñ]\.?$/i.test(w)
  const titleCase = (w) => {
    if (!w) return w
    return w.split('-').map(seg =>
      seg ? seg[0].toUpperCase() + seg.slice(1).toLowerCase() : seg
    ).join('-')
  }
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  const real = parts.filter(p => !PREPS.has(p.toLowerCase()) && !isInitial(p))
  if (real.length === 0) return titleCase(parts[0])
  if (real.length === 1) return titleCase(real[0])
  return `${titleCase(real[0])} ${titleCase(real[1])}`
}

export function displayName(profile) {
  if (!profile) return 'Participante'
  const real = formatRealName(profile.full_name)
  if (NAME_MODE === 'nickname') {
    return profile.nickname || real || 'Participante'
  }
  // modo 'real'
  return real || profile.nickname || 'Participante'
}

export function validateNickname(n) {
  if (!n || typeof n !== 'string') return { ok: false, error: 'Escribe un nickname' }
  const trimmed = n.trim()
  if (trimmed.length < 3) return { ok: false, error: 'Mínimo 3 caracteres' }
  if (trimmed.length > 30) return { ok: false, error: 'Máximo 30 caracteres' }
  // Permite letras (con tildes), números, espacios, puntos, guiones y _.
  // Más permisivo que un username clásico — pensado como display name.
  if (!/^[\p{L}\p{N} ._-]+$/u.test(trimmed)) {
    return { ok: false, error: 'Solo letras, números, espacios y . _ -' }
  }
  // Collapse multiple spaces → uno
  const normalized = trimmed.replace(/\s+/g, ' ')
  return { ok: true, value: normalized }
}
