/**
 * Feature flags — leen variables de entorno en build time (Vite).
 *
 * Para activar/desactivar sin tocar código, edita la env var en Vercel
 * y re-despliega. Default OFF (invisible en producción).
 */

export const FRIENDLY_TOURNAMENT_ENABLED =
  import.meta.env.VITE_FRIENDLY_TOURNAMENT_ENABLED === 'true'

// Gate de prueba — mientras esté en true, solo los admins ven el Pre-Mundial
// aunque FRIENDLY_TOURNAMENT_ENABLED esté activado. Cambiar a false (commit +
// push) cuando se quiera abrir a todos los participantes.
export const FRIENDLY_TOURNAMENT_ADMIN_ONLY = true

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
