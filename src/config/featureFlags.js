/**
 * Feature flags — leen variables de entorno en build time (Vite).
 *
 * Para activar/desactivar sin tocar código, edita la env var en Vercel
 * y re-despliega. Default OFF (invisible en producción).
 */

export const FRIENDLY_TOURNAMENT_ENABLED =
  import.meta.env.VITE_FRIENDLY_TOURNAMENT_ENABLED === 'true'
