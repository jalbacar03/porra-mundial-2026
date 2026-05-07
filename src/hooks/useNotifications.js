import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

/**
 * Hook for managing browser push notification permissions + Web Push subscription.
 * Returns { permission, requestPermission, sendLocal, subscribePush }
 *
 * - sendLocal: foreground-only (the tab must be open)
 * - subscribePush: registers a Web Push subscription so the server can wake the
 *   browser even when the tab is closed (iOS requires the PWA installed + 16.4+)
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

  /**
   * Register the browser for push notifications. Idempotent — safe to call
   * multiple times. Returns the saved subscription record or null on failure.
   */
  async function subscribePush(userId) {
    if (!userId) return null
    if (!VAPID_PUBLIC_KEY) { console.warn('VITE_VAPID_PUBLIC_KEY not set'); return null }
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push API not supported in this browser'); return null
    }
    if (Notification.permission !== 'granted') return null

    try {
      const reg = await navigator.serviceWorker.ready
      // Reuse an existing subscription if present, else create one
      let sub = await reg.pushManager.getSubscription()
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        })
      }

      // Persist to DB (upsert by endpoint to dedupe across re-installs)
      const { endpoint, keys } = sub.toJSON()
      const { data, error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: userId,
          endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          user_agent: navigator.userAgent,
          last_used_at: new Date().toISOString()
        }, { onConflict: 'endpoint' })
        .select()
        .single()

      if (error) { console.warn('Push subscription save failed', error); return null }
      return data
    } catch (err) {
      console.warn('subscribePush error:', err)
      return null
    }
  }

  return { permission, requestPermission, sendLocal, subscribePush }
}

// Helper: convert URL-safe base64 (the VAPID format) to a Uint8Array
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i)
  return out
}
