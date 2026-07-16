import { useEffect } from 'react'
import { ACCENT_PALETTES, DEFAULT_ACCENT, canPreviewAccent } from '../config/featureFlags'

const STORAGE_KEY = 'accent-preview'

/**
 * PRUEBA DE COLOR (temporal) — permite ver la app con una paleta alternativa
 * SIN afectar a nadie más. Solo para los usuarios de ACCENT_PREVIEW_VIEWERS.
 *
 * Uso:  ?accent=indigo | ?accent=violet | ?accent=blue   (se recuerda al navegar)
 *       ?accent=off    → vuelve al color por defecto y olvida la preferencia
 *
 * Funciona porque TODO el acento de la app cuelga de las variables --accent* de
 * index.css: basta con sobreescribirlas en :root para repintar la app entera.
 *
 * Si la paleta convence: mover sus valores a --accent* en index.css (pasa a ser
 * el color de todos) y borrar este hook + el bloque de flags. Si no: borrar y ya.
 */
export function useAccentPreview(userId) {
  useEffect(() => {
    const root = document.documentElement
    const clear = () => Object.keys(ACCENT_PALETTES[DEFAULT_ACCENT])
      .forEach(k => root.style.removeProperty(k))

    if (!canPreviewAccent(userId)) return clear()

    const param = new URLSearchParams(window.location.search).get('accent')
    if (param === 'off') {
      localStorage.removeItem(STORAGE_KEY)
      return clear()
    }
    if (param && ACCENT_PALETTES[param]) localStorage.setItem(STORAGE_KEY, param)

    const name = localStorage.getItem(STORAGE_KEY)
    const palette = ACCENT_PALETTES[name]
    if (!palette || name === DEFAULT_ACCENT) return clear()

    Object.entries(palette).forEach(([k, v]) => root.style.setProperty(k, v))
    return clear
  }, [userId])
}
