import { useRef, useCallback } from 'react'

/**
 * Prevents double-click on async actions.
 * Usage:
 *   const [guard, isLocked] = useRateLimit()
 *   const handleSave = guard(async () => { ... })
 */
export function useRateLimit(cooldownMs = 1000) {
  const lockedRef = useRef(false)

  const guard = useCallback((fn) => {
    return async (...args) => {
      if (lockedRef.current) return
      lockedRef.current = true
      try {
        await fn(...args)
      } finally {
        setTimeout(() => { lockedRef.current = false }, cooldownMs)
      }
    }
  }, [cooldownMs])

  return guard
}
