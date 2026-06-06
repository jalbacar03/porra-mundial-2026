/**
 * POST /api/notify-access  { name }
 * Notifica al admin (Javi) por Web Push cuando un usuario solicita acceso.
 * Requiere un JWT de Supabase válido (cualquier usuario logueado) para evitar
 * abuso anónimo. Solo envía a las suscripciones de Javi.
 */
import webpush from 'web-push'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const VAPID_PUBLIC_KEY = process.env.VITE_VAPID_PUBLIC_KEY
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:noreply@porra-mundial-2026.app'

const OWNER_ID = 'e2fc4937-cd8d-4cb1-8291-05fa8a66ce97' // Javi

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
  return res.json().catch(() => null)
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return res.status(500).json({ error: 'env missing' })
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return res.status(200).json({ sent: 0, reason: 'no vapid' })

  // Requiere JWT válido (cualquier usuario logueado).
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const u = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${token}` },
    })
    if (!u.ok) return res.status(401).json({ error: 'Unauthorized' })
  } catch {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  let name = 'Alguien'
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {})
    if (body.name) name = String(body.name).slice(0, 80)
  } catch {}

  const subs = await supaFetch(`/rest/v1/push_subscriptions?user_id=eq.${OWNER_ID}&select=id,endpoint,p256dh,auth`)
  if (!subs || subs.length === 0) return res.status(200).json({ sent: 0, reason: 'owner sin suscripciones' })

  const payload = JSON.stringify({
    title: '🔐 Nueva solicitud de acceso',
    body: `${name} quiere entrar a la porra. Revísalo en Admin.`,
    url: '/admin',
  })

  let sent = 0
  await Promise.all(subs.map(async sub => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      )
      sent++
    } catch (e) {
      // Suscripción muerta → limpiar
      if (e?.statusCode === 410 || e?.statusCode === 404) {
        await supaFetch(`/rest/v1/push_subscriptions?id=eq.${sub.id}`, { method: 'DELETE' })
      }
    }
  }))

  return res.status(200).json({ sent })
}
