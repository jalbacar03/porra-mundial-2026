/**
 * POST /api/broadcast-announcement
 * Envía una push a TODOS los suscriptores.
 * Auth: CRON_SECRET o JWT de admin.
 * Body: { title, body, url }
 * Uso puntual — borrar tras el Mundial si no se necesita más.
 */
import webpush from 'web-push'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const VAPID_PUBLIC_KEY = process.env.VITE_VAPID_PUBLIC_KEY
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:noreply@porra-mundial-2026.app'
const CRON_SECRET = process.env.CRON_SECRET
const ADMIN_ID = 'e2fc4937-cd8d-4cb1-8291-05fa8a66ce97'

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

async function isAdmin(authHeader) {
  if (!authHeader) return false
  const token = authHeader.replace('Bearer ', '')
  if (CRON_SECRET && token === CRON_SECRET) return true
  // Verify JWT against Supabase
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${token}`,
    },
  })
  if (!res.ok) return false
  const user = await res.json()
  return user?.id === ADMIN_ID
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const authorized = await isAdmin(req.headers.authorization)
  if (!authorized) return res.status(401).json({ error: 'Unauthorized' })

  const { title, body, url = '/announcements' } = req.body || {}
  if (!title || !body) return res.status(400).json({ error: 'title and body required' })

  const subs = await supaFetch('/rest/v1/push_subscriptions?select=id,endpoint,p256dh,auth')
  if (!subs || subs.length === 0) return res.json({ sent: 0, pruned: 0 })

  const payload = JSON.stringify({ title, body, url })
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
