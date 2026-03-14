import { useState, useEffect } from 'react'

// Primer partido: 11 de junio 2026, 19:00 hora España (CEST = UTC+2)
export const WORLD_CUP_START = new Date('2026-06-11T17:00:00Z')

// Deadline predicciones: 48h antes del primer partido
export const PREDICTIONS_DEADLINE = new Date(WORLD_CUP_START.getTime() - 48 * 60 * 60 * 1000)

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