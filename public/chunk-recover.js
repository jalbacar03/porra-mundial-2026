// Servido por Vercel cuando un cliente pide un chunk /assets/*.js que YA NO EXISTE
// (navegador con un bundle viejo en caché tras un deploy → "importing a module
// script failed"). En vez de 404 se ejecuta esto y RECARGA INMEDIATAMENTE para
// traer el bundle nuevo. El usuario no tiene que hacer nada ni reinstalar la app.
//
// IMPORTANTE: la recarga es síncrona (al evaluar el módulo), ANTES de que React
// llegue a usar este módulo como componente (no tiene export default → daría
// "Element type is invalid"). La limpieza de SW/cachés es best-effort en segundo
// plano (no bloquea la recarga).
(function () {
  var KEY = 'chunk-recover-ts'
  try {
    var last = Number(sessionStorage.getItem(KEY) || 0)
    // Anti-bucle: si ya recargamos hace <20s y sigue fallando, no recargues otra vez.
    if (Date.now() - last < 20000) return
    sessionStorage.setItem(KEY, String(Date.now()))
  } catch (e) {}

  // Limpieza en segundo plano (fire-and-forget, sin await → no retrasa la recarga).
  try {
    if ('serviceWorker' in navigator && navigator.serviceWorker.getRegistrations) {
      navigator.serviceWorker.getRegistrations().then(function (rs) {
        rs.forEach(function (r) { r.unregister() })
      }).catch(function () {})
    }
    if (self.caches && caches.keys) {
      caches.keys().then(function (ks) {
        ks.forEach(function (k) { caches.delete(k) })
      }).catch(function () {})
    }
  } catch (e) {}

  // Recarga con cache-busting para forzar un index.html fresco aunque haya caché.
  try {
    location.replace(location.pathname + '?_r=' + Date.now())
  } catch (e) {
    location.reload()
  }
})()
