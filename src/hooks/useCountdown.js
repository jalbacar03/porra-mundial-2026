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
// DEADLINE: cierre ÚNICO de los 16 dieciseisavos, 30 min antes del primero
//   (primer R32: dom 28 jun 21:00 Madrid → cierre 20:30 Madrid = 18:30 UTC).
export const KNOCKOUT_PREDICTIONS_OPEN = new Date('2026-06-28T05:00:00Z')      // dom 28, 07:00 Madrid
export const KNOCKOUT_PREDICTIONS_DEADLINE = new Date('2026-06-28T18:30:00Z')  // dom 28, 20:30 Madrid

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