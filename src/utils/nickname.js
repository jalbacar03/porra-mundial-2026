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
  'Ignacio de Parellada Menéndez': 'Ignacio de Parellada',
  'Gonzalo de Parellada Menéndez': 'Gonzalo de Parellada',
  'Juan Antonio Borrell Alonso': 'Juan Antonio Borrell',
  'Alejandro Balaguer Blanco': 'Alejandro Balaguer',
  'Amadeo Arboles': 'Amadeo Árboles',
  // Tildes que el usuario no puso al registrarse (nombre real español)
  'Alvaro Macía': 'Álvaro Macía',
  'Alvaro Retana': 'Álvaro Retana',
  'Oscar Roces': 'Óscar Roces',
  'Pablo Marin': 'Pablo Marín',
  'Uri Martinez': 'Uri Martínez',
  'Victor Albanell': 'Víctor Albanell',
  'Grego Garcia': 'Grego García',
  'Guille Albacar': 'Guille Albácar',
  'Lino Davila': 'Lino Dávila',
  'Miguel Sanchez': 'Miguel Sánchez',
  'Héctor Cienfuegos Retana': 'Héctor Cienfuegos',
  'Álvaro García-Valdecasas': 'Álvaro G-Valdecasas',
  'Victor Casajuana Mukendi': 'Víctor Casajuana',
  'Miguel De pastors Negre': 'Miguel de Pastors',
  'Juan Vicentini Capecchi': 'Juan Vicentini',
  'Álvaro Rodríguez Barral': 'Álvaro Rodríguez',
  'Alvaro de Lara Fortuny': 'Álvaro de Lara',
  'Emilio Brillas Miarnau': 'Emilio Brillas',
  'Mateo Sanllehi Bertran': 'Mateo Sanllehi',
  'Santi Zaldua Lasheras': 'Santi Zaldúa',
  'José Antonio Menéndez': 'José Menéndez',
  'Emiliano Suarez Perez': 'Emiliano Suárez',
  'Marc Berenguer Garcia': 'Marc Berenguer',
  'Mateo Fernandez Bombi': 'Mateo Fernández',
  'Mateo Velja Maranesi': 'Mateo Velja',
  'Tomas Brillas Buxeda': 'Tomás Brillas',
  'Claus Biernoth Ortiz': 'Claus Biernoth',
  'David Perez Nicolau': 'David Pérez',
  'Simeon Garcia-Nieto': 'Simeon García-Nieto',
  'Daniel Jové Angerri': 'Daniel Jové',
  'Álvaro García Magro': 'Álvaro García M.',
  'Ignacio Saiz Susin': 'Ignacio Saiz',
  'Alberto Oliva-Rifa': 'Alberto Oliva-Rifa',
  'Pau Bertran Torres': 'Pau Bertran',
  'Alex Carci Nicolau': 'Alex Carci',
  'Jose Maria Guitart': 'José María Guitart',
  'Manuel Pagés Balet': 'Manuel Pagés',
  'Pau Dubé Salvador': 'Pau Dubé',
  'Ivan Lopez Torres': 'Iván López',
  'Carlos De Muller': 'Carlos de Muller',
  'Pedro J. Albácar': 'Pedro J. Albácar',
  'Kike Sala-Vivé': 'Kike Sala-Vivé',
  'Don José Macía': 'Don José Macía',
  'Nacho de Oza': 'Nacho de Oza',
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
