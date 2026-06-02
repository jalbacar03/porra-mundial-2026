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

export function displayName(profile) {
  if (!profile) return 'Participante'
  return profile.nickname || profile.full_name || 'Participante'
}

export function validateNickname(n) {
  if (!n || typeof n !== 'string') return { ok: false, error: 'Escribe un nickname' }
  const trimmed = n.trim()
  if (trimmed.length < 3) return { ok: false, error: 'Mínimo 3 caracteres' }
  if (trimmed.length > 30) return { ok: false, error: 'Máximo 30 caracteres' }
  if (!/^[a-z0-9._-]+$/i.test(trimmed)) {
    return { ok: false, error: 'Solo letras, números, puntos, guiones y _ (sin espacios)' }
  }
  return { ok: true, value: trimmed }
}
