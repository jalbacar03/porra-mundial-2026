// Servido por Vercel cuando un cliente pide un chunk /assets/*.js que YA NO EXISTE
// (navegador con un bundle viejo en caché tras un deploy → "importing a module
// script failed"). En vez de 404, se ejecuta esto: limpia Service Worker + cachés
// y recarga UNA vez para traer el bundle nuevo. El usuario no tiene que hacer nada
// ni reinstalar la app.
(async () => {
  try {
    const KEY = 'chunk-recover-ts'
    const last = Number(sessionStorage.getItem(KEY) || 0)
    // Guard anti-bucle: no recuperar más de una vez cada 20s.
    if (Date.now() - last < 20000) return
    sessionStorage.setItem(KEY, String(Date.now()))
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map((r) => r.unregister()))
    }
    if (self.caches) {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    }
  } catch (e) {
    // ignore
  }
  location.reload()
})()
