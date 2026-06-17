const CACHE_NAME = 'porra-mundial-v4'

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      )
    )
  )
  self.clients.claim()
})

// Push notifications
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {}
  const title = data.title || 'Porra Mundial 26'
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url || '/' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      const focused = clients.find((c) => c.url.includes(url) && 'focus' in c)
      if (focused) return focused.focus()
      return self.clients.openWindow(url)
    })
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)
  const isAsset = url.pathname.startsWith('/assets/')
  const isNav = req.mode === 'navigate'

  // HTML (navegación) y JS/CSS con hash (/assets/): NUNCA servir de caché viejo.
  // Así un bundle obsoleto no deja la app referenciando chunks que ya no existen
  // ("importing a module script failed"). Solo se usa la caché si estás OFFLINE.
  if (isNav || isAsset) {
    event.respondWith(
      fetch(req).catch(() => caches.match(req).then((c) => c || caches.match('/index.html')))
    )
    return
  }

  // Resto (imágenes, iconos, fuentes): network-first con caché de respaldo.
  event.respondWith(
    fetch(req)
      .then((response) => {
        if (response.status === 200) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone))
        }
        return response
      })
      .catch(() => caches.match(req))
  )
})
