/**
 * Feature flags — leen variables de entorno en build time (Vite).
 *
 * Para activar/desactivar sin tocar código, edita la env var en Vercel
 * y re-despliega. Default OFF (invisible en producción).
 */

// Pre-Mundial activo y abierto a todos los participantes admitidos.
// Para apagar: cambiar FRIENDLY_TOURNAMENT_ENABLED a false.
export const FRIENDLY_TOURNAMENT_ENABLED = true

// Si en algún momento hay que volver a fase de pruebas, poner a true.
export const FRIENDLY_TOURNAMENT_ADMIN_ONLY = false

/**
 * Helper: ¿debe el Pre-Mundial ser visible para este profile?
 *   - flag global ON
 *   - (si admin-only) profile.is_admin = true
 */
export function isFriendlyVisible(profile) {
  if (!FRIENDLY_TOURNAMENT_ENABLED) return false
  if (FRIENDLY_TOURNAMENT_ADMIN_ONLY && !profile?.is_admin) return false
  return true
}

/**
 * PRUEBA: al pulsar un nombre en la clasificación, ver TODAS las predicciones de
 * ese participante (perfil) en vez del H2H. En pruebas solo lo ve Javi; cuando
 * esté validado, poner PARTICIPANT_PROFILE_FOR_ALL = true para habilitarlo a todos.
 */
export const PARTICIPANT_PROFILE_FOR_ALL = true
const PARTICIPANT_PROFILE_VIEWERS = ['e2fc4937-cd8d-4cb1-8291-05fa8a66ce97'] // Javi (admin)
export function canSeeParticipantProfile(userId) {
  return PARTICIPANT_PROFILE_FOR_ALL || PARTICIPANT_PROFILE_VIEWERS.includes(userId)
}

/**
 * PRUEBA DE COLOR — paletas alternativas para valorar un cambio de aspecto.
 * De momento SOLO las ve quien esté en ACCENT_PREVIEW_VIEWERS (?accent=indigo).
 * El resto de participantes sigue viendo DEFAULT_ACCENT. Ver useAccentPreview.js.
 *
 * Cada paleta define las mismas 5 variables que index.css: --accent (acción),
 * --accent-rgb (para rgba), --accent-soft (texto legible sobre oscuro),
 * --accent-tint (fondo) y --accent-hover.
 */
export const DEFAULT_ACCENT = 'blue'
export const ACCENT_PALETTES = {
  blue: {
    '--accent': '#2563eb', '--accent-rgb': '37, 99, 235',
    '--accent-soft': '#60a5fa', '--accent-tint': '#161f2e', '--accent-hover': '#3b82f6',
  },
  indigo: {
    '--accent': '#6366f1', '--accent-rgb': '99, 102, 241',
    '--accent-soft': '#a5b4fc', '--accent-tint': '#1a1b2e', '--accent-hover': '#818cf8',
  },
  violet: {
    '--accent': '#7c3aed', '--accent-rgb': '124, 58, 237',
    '--accent-soft': '#c4b5fd', '--accent-tint': '#1e1830', '--accent-hover': '#8b5cf6',
  },
  // Rojo de la bandera (#c60b1e), el mismo de la franja de la navegación.
  // OJO: --red (#e24b4a) ya significa error/peligro en toda la app; con esta
  // paleta el color de acción y el de error quedan a un paso el uno del otro.
  red: {
    '--accent': '#c60b1e', '--accent-rgb': '198, 11, 30',
    '--accent-soft': '#f87171', '--accent-tint': '#2a1416', '--accent-hover': '#e11d2e',
  },
}
const ACCENT_PREVIEW_VIEWERS = ['e2fc4937-cd8d-4cb1-8291-05fa8a66ce97'] // Javi (admin)
export function canPreviewAccent(userId) {
  return ACCENT_PREVIEW_VIEWERS.includes(userId)
}
