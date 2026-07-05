import { useState, useEffect } from 'react'

// Primer partido: 11 de junio 2026, 19:00 hora España (CEST = UTC+2)
export const WORLD_CUP_START = new Date('2026-06-11T17:00:00Z')

// Deadline predicciones: 10 de junio 2026, 23:59h hora España (CEST = UTC+2).
// Fixed wall-clock cutoff (not "48h before") so it matches the rules copy
// and the RLS policies in the DB exactly. Keep these three in sync.
export const PREDICTIONS_DEADLINE = new Date('2026-06-10T21:59:59Z')

// Fase eliminatoria — "cambio de chip" a dieciseisavos (cuadro real).
// Los grupos terminan el dom 28 jun ~06:00 Madrid (último partido a las 04:00).
// OPEN: a partir de aquí la app cambia el chip (pestaña "Durante el Mundial" por
//   defecto + banner en Inicio). Se da margen para que el sync rellene los
//   equipos reales de R32 antes de que la gente empiece a predecir.
// DEADLINE: REAPERTURA de los 15 dieciseisavos que faltan (el 73 ya se jugó y
//   sigue cerrado vía isBettingOpen porque status='finished'). Hasta lun 29 jun
//   18:00 Madrid = 16:00 UTC (1 h antes de Brasil-Japón, primer partido restante 19:00).
export const KNOCKOUT_PREDICTIONS_OPEN = new Date('2026-06-28T05:00:00Z')      // dom 28, 07:00 Madrid
export const KNOCKOUT_PREDICTIONS_DEADLINE = new Date('2026-06-29T16:00:00Z')  // lun 29, 18:00 Madrid (reapertura)

// Override manual del CIERRE ÚNICO de una ronda KO (ampliaciones de plazo).
// Clave = matches.stage. Si existe, MANDA sobre el cálculo "primer partido − 1 min".
// Se usa cuando se amplía el plazo de una ronda cuyo primer partido ya se jugó
// (p.ej. octavos: 2 cruces jugados el sáb, se reabre el resto hasta el dom 21:00).
export const KNOCKOUT_ROUND_DEADLINE_OVERRIDES = {
  'Round of 16': new Date('2026-07-05T19:40:00Z'),  // dom 5 jul, 21:40 Madrid (ampliación octavos)
}

export function useCountdown(targetDate) {
  const [timeLeft, setTimeLeft] = useState(getTimeLeft(targetDate))

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(getTimeLeft(targetDate))
    }, 1000)
    return () => clearInterval(timer)
  }, [targetDate])

  return timeLeft
}

function getTimeLeft(targetDate) {
  const now = new Date()
  const diff = targetDate.getTime() - now.getTime()

  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true }
  }

  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
    expired: false
  }
}