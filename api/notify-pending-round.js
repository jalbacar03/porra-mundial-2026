/**
 * GET/POST /api/notify-pending-round
 * Recordatorio DIRIGIDO: avisa por push SOLO a los participantes a los que les
 * falta predecir algún cruce NO jugado de la ronda KO abierta. No spamea a quien
 * ya la tiene completa.
 *
 * Dedupe: una vez por ronda y día (`pending-<stage>-<YYYY-MM-DD>`), así el cron
 * puede recordar a los rezagados una vez al día sin repetir. ?force=1 lo reenvía.
 *
 * Disparo: Vercel Cron cada 30 min · o manual admin (JWT admin / CRON_SECRET).
 */
import webpush from 'web-push'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const VAPID_PUBLIC_KEY = process.env.VITE_VAPID_PUBLIC_KEY
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:noreply@porra-mundial-2026.app'
const CRON_SECRET = process.env.CRON_SECRET
const ADMIN_ID = 'e2fc4937-cd8d-4cb1-8291-05fa8a66ce97'

const KO_ROUNDS = [
  { stage: 'Round of 16', label: 'octavos', display: 'Octavos' },
  { stage: 'Quarter-finals', label: 'cuartos', display: 'Cuartos' },
  { stage: 'Semi-finals', label: 'semifinales', display: 'Semifinales' },
  { stage: 'Final', label: 'la final', display: 'La final' },
]

// Override manual del cierre único de una ronda (ampliaciones). Debe coincidir
// con KNOCKOUT_ROUND_DEADLINE_OVERRIDES en src/hooks/useCountdown.js.
const ROUND_DEADLINE_OVERRIDES = {
  'Round of 16': new Date('2026-07-05T19:40:00Z'), // dom 5 jul, 21:40 Madrid
  'Semi-finals': new Date('2026-07-14T18:30:00Z'), // mar 14 jul, 20:30 Madrid
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

  const matches = await supaFetch(
    '/rest/v1/matches?select=id,stage,status,match_date,home_team_id,away_team_id&stage=neq.group'
  )
  if (!matches) return res.status(500).json({ error: 'No se pudieron leer los partidos' })

  // Ronda abierta: fully known + con cruces sin jugar + antes del cierre
  // (override de ampliación o primer partido − 1 min).
  const nowMs = Date.now()
  let round = null
  for (const kr of KO_ROUNDS) {
    const all = matches.filter(m => m.stage === kr.stage)
    if (!all.length) continue
    if (all.some(m => !m.home_team_id || !m.away_team_id)) continue // ronda completa
    const unplayed = all.filter(m => m.status !== 'finished')
    if (!unplayed.length) continue // nada pendiente en esta ronda
    const dated = all.filter(m => m.match_date)
    if (!dated.length) continue
    const earliest = Math.min(...dated.map(m => new Date(m.match_date).getTime()))
    const deadline = ROUND_DEADLINE_OVERRIDES[kr.stage] || new Date(earliest - 60 * 1000)
    if (nowMs >= deadline.getTime()) continue
    round = { ...kr, deadline }
    break
  }
  if (!round) return res.json({ sent: 0, skipped: 'ninguna ronda KO con cierre abierto' })

  // Dedupe por ronda y día
  const day = new Date().toISOString().slice(0, 10)
  const dedupeKey = `pending-${round.stage}-${day}`
  if (!force) {
    const already = await supaFetch(`/rest/v1/sent_round_notifications?round_key=eq.${encodeURIComponent(dedupeKey)}&select=round_key`)
    if (already && already.length > 0) return res.json({ sent: 0, skipped: `ya recordado hoy (${round.label})` })
  }

  // Suscripciones SOLO de quien le falta algún cruce no jugado de esta ronda
  const subs = await supaFetch('/rest/v1/rpc/pending_round_subscriptions', {
    method: 'POST',
    body: JSON.stringify({ p_stage: round.stage }),
  })
  if (!subs || subs.length === 0) {
    await supaFetch('/rest/v1/sent_round_notifications', {
      method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ round_key: dedupeKey, recipients: 0 }),
    })
    return res.json({ sent: 0, total: 0, note: 'nadie pendiente con push' })
  }

  const cierre = round.deadline.toLocaleString('es-ES', {
    weekday: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid',
  })
  const payload = JSON.stringify({
    title: `⏰ Te faltan ${round.label === 'la final' ? 'la final' : round.label}`,
    body: `Aún no has completado ${round.label === 'la final' ? 'la final' : 'tus ' + round.label}. Cierra el ${cierre}.`,
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

  await supaFetch('/rest/v1/sent_round_notifications', {
    method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ round_key: dedupeKey, recipients: sent }),
  })

  return res.json({ sent, pruned, total: subs.length, round: round.label })
}
