/**
 * Feature flags — leen variables de entorno en build time (Vite).
 *
 * Para activar/desactivar sin tocar código, edita la env var en Vercel
 * y re-despliega. Default OFF (invisible en producción).
 */

// Pre-Mundial activo. Solo admins lo ven mientras ADMIN_ONLY = true.
// Para apagar todo: false. Para abrir a todos los participantes:
// FRIENDLY_TOURNAMENT_ADMIN_ONLY = false.
export const FRIENDLY_TOURNAMENT_ENABLED = true

// Gate de prueba — mientras esté en true, solo los admins ven el Pre-Mundial.
// Cambiar a false (commit + push) cuando se quiera abrir a todos.
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
