/**
 * GET/POST /api/notify-knockout-open
 * Push de "cambio de chip": avisa a TODOS de que el cuadro real (dieciseisavos)
 * está abierto y hay que rellenar las predicciones antes del cierre.
 *
 * Disparo:
 *  - Vercel Cron (una sola vez): "30 5 28 6 *" → dom 28 jun 05:30 UTC = 07:30 Madrid,
 *    ya con los equipos de R32 sincronizados tras cerrarse los grupos (~06:00 Madrid).
 *  - Manual: el admin puede forzarlo con POST (JWT admin o CRON_SECRET) y ?force=1.
 *
 * Guarda: solo envía dentro de la ventana [apertura, cierre] del cuadro real,
 * salvo force=1. Así un disparo accidental fuera de fecha no spamea a nadie.
 */
import webpush from 'web-push'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const VAPID_PUBLIC_KEY = process.env.VITE_VAPID_PUBLIC_KEY
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:noreply@porra-mundial-2026.app'
const CRON_SECRET = process.env.CRON_SECRET
const ADMIN_ID = 'e2fc4937-cd8d-4cb1-8291-05fa8a66ce97'

// Mantener en sync con src/hooks/useCountdown.js
const KNOCKOUT_OPEN = new Date('2026-06-28T05:00:00Z')
const KNOCKOUT_DEADLINE = new Date('2026-06-28T18:30:00Z')

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
  // Vercel Cron
  if (req.headers['x-vercel-cron']) return true
  const auth = req.headers.authorization
  if (!auth) return false
  const token = auth.replace('Bearer ', '')
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

  const force = req.query?.force === '1'
  const now = new Date()
  if (!force && (now < KNOCKOUT_OPEN || now > KNOCKOUT_DEADLINE)) {
    return res.json({ sent: 0, skipped: 'fuera de la ventana del cuadro real' })
  }

  const subs = await supaFetch('/rest/v1/push_subscriptions?select=id,endpoint,p256dh,auth')
  if (!subs || subs.length === 0) return res.json({ sent: 0, pruned: 0, total: 0 })

  const payload = JSON.stringify({
    title: '🏆 Cuadro real abierto',
    body: 'Ya se conocen los dieciseisavos. Rellena tus predicciones antes del domingo 20:30.',
    url: '/predictions',
  })

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
