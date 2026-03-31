import { useState, useEffect } from 'react'

/**
 * Hook for managing browser push notification permissions.
 * Returns { permission, requestPermission, sendLocal }
 */
export function useNotifications() {
  const [permission, setPermission] = useState('default')

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission)
    }
  }, [])

  async function requestPermission() {
    if (!('Notification' in window)) return 'denied'
    const result = await Notification.requestPermission()
    setPermission(result)
    return result
  }

  /**
   * Send a local notification (no server needed).
   * Useful for in-app events like "new points earned".
   */
  function sendLocal(title, options = {}) {
    if (permission !== 'granted') return
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker.ready.then(reg => {
      reg.showNotification(title, {
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        ...options,
      })
    })
  }

  return { permission, requestPermission, sendLocal }
}
