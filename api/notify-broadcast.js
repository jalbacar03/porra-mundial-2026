/**
 * GET/POST /api/notify-broadcast
 * Push puntual de un comunicado oficial a TODOS los suscriptores.
 * Auth: Vercel Cron / CRON_SECRET / JWT admin (o ?key=CRON_SECRET).
 * Mensaje fijo (editar aquí para cada comunicado). Devuelve enviados/podados.
 */
import webpush from 'web-push'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const VAPID_PUBLIC_KEY = process.env.VITE_VAPID_PUBLIC_KEY
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:noreply@porra-mundial-2026.app'
const CRON_SECRET = process.env.CRON_SECRET
const ADMIN_ID = 'e2fc4937-cd8d-4cb1-8291-05fa8a66ce97'

// Comunicado a enviar (push corto; el texto completo vive en Avisos).
const PUSH = {
  title: 'Cambio en la puntuación',
  body: 'Cambia cómo puntúan las eliminatorias. Si pusiste empates, entra a elegir quién avanza antes de las 20:55.',
  url: '/predictions',
}

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
}

async function supaFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  if (!res.ok) return null
  const text = await res.text()
  return text ? JSON.parse(text) : []
}

async function isAuthorized(req) {
  if (req.headers['x-vercel-cron']) return true
  const auth = req.headers.authorization
  const token = auth ? auth.replace('Bearer ', '') : (req.query?.key || null)
  if (!token) return false
  if (CRON_SECRET && token === CRON_SECRET) return true
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return false
  const user = await res.json()
  return user?.id === ADMIN_ID
}

export default async function handler(req, res) {
  if (!(await isAuthorized(req))) return res.status(401).json({ error: 'Unauthorized' })

  const subs = await supaFetch('/rest/v1/push_subscriptions?select=id,endpoint,p256dh,auth')
  if (!subs || subs.length === 0) return res.json({ sent: 0, pruned: 0, total: 0 })

  const payload = JSON.stringify(PUSH)
  let sent = 0, pruned = 0
  await Promise.all(subs.map(async sub => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      )
      sent++
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await supaFetch(`/rest/v1/push_subscriptions?id=eq.${sub.id}`, { method: 'DELETE' })
        pruned++
      }
    }
  }))

  return res.json({ sent, pruned, total: subs.length })
}
