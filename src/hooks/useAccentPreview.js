import { useEffect } from 'react'
import { ACCENT_PALETTES, DEFAULT_ACCENT, canPreviewAccent } from '../config/featureFlags'

const STORAGE_KEY = 'accent-preview'

/**
 * PRUEBA DE COLOR (temporal) — permite ver la app con una paleta alternativa SIN
 * afectar a nadie más. Solo para los usuarios de ACCENT_PREVIEW_VIEWERS.
 *
 * Se elige desde Admin → 🎨 Aspecto (también vale ?accent=indigo|violet|blue|off).
 *
 * Funciona porque TODO el acento de la app cuelga de las variables --accent* de
 * index.css: basta sobreescribirlas en :root para repintar la app entera.
 *
 * Si la paleta convence: mover sus valores a --accent* en index.css (pasa a ser
 * el color de todos) y borrar este hook + el bloque de flags. Si no: borrar y ya.
 */

// Nombre de paleta guardado (DEFAULT_ACCENT = lo que ve todo el mundo).
export function getAccentPreview() {
  try {
    const name = localStorage.getItem(STORAGE_KEY)
    return ACCENT_PALETTES[name] ? name : DEFAULT_ACCENT
  } catch {
    return DEFAULT_ACCENT
  }
}

// Pinta (o limpia) el override en :root. Sin tocar localStorage.
function applyAccent(name) {
  const root = document.documentElement
  const palette = ACCENT_PALETTES[name]
  if (!palette || name === DEFAULT_ACCENT) {
    Object.keys(ACCENT_PALETTES[DEFAULT_ACCENT]).forEach(k => root.style.removeProperty(k))
    return
  }
  Object.entries(palette).forEach(([k, v]) => root.style.setProperty(k, v))
}

// Cambia la paleta y la recuerda. Efecto inmediato, sin recargar.
export function setAccentPreview(name) {
  try {
    if (!ACCENT_PALETTES[name] || name === DEFAULT_ACCENT) localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, name)
  } catch { /* modo privado: se aplica igual, sin recordar */ }
  applyAccent(name)
}

export function useAccentPreview(userId) {
  useEffect(() => {
    if (!canPreviewAccent(userId)) return applyAccent(DEFAULT_ACCENT)

    // ?accent=… sigue funcionando (útil para probar desde un enlace).
    const param = new URLSearchParams(window.location.search).get('accent')
    if (param === 'off') return setAccentPreview(DEFAULT_ACCENT)
    if (param && ACCENT_PALETTES[param]) return setAccentPreview(param)

    applyAccent(getAccentPreview())
  }, [userId])
}
