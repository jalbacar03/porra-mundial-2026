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
export const PARTICIPANT_PROFILE_FOR_ALL = false
const PARTICIPANT_PROFILE_VIEWERS = ['e2fc4937-cd8d-4cb1-8291-05fa8a66ce97'] // Javi (admin)
export function canSeeParticipantProfile(userId) {
  return PARTICIPANT_PROFILE_FOR_ALL || PARTICIPANT_PROFILE_VIEWERS.includes(userId)
}
