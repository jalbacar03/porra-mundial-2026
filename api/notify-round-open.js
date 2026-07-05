/**
 * GET/POST /api/notify-round-open
 * Push "ronda eliminatoria abierta": cuando los cruces de la siguiente ronda KO
 * (octavos → final) ya tienen equipos y el plazo está abierto, avisa a TODOS de
 * que rellenen sus predicciones antes del cierre (1 min antes del 1er partido).
 *
 * Genérico: sirve para octavos, cuartos, semifinales y final sin recodificar.
 * Dedupe: envía UNA sola vez por ronda (tabla sent_round_notifications), así el
 * cron puede llamarlo cada pocos minutos sin spamear.
 *
 * Disparo:
 *  - Vercel Cron cada 15 min → detecta la ronda abierta y envía una vez.
 *  - Manual admin: POST con JWT admin o CRON_SECRET. ?force=1 reenvía aunque ya
 *    esté marcada como enviada (para reenviar un aviso a propósito).
 */
import webpush from 'web-push'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const VAPID_PUBLIC_KEY = process.env.VITE_VAPID_PUBLIC_KEY
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:noreply@porra-mundial-2026.app'
const CRON_SECRET = process.env.CRON_SECRET
const ADMIN_ID = 'e2fc4937-cd8d-4cb1-8291-05fa8a66ce97'

// Rondas KO en orden, con su etiqueta en español para el copy del push.
const KO_ROUNDS = [
  { stage: 'Round of 16', label: 'octavos', display: 'Octavos' },
  { stage: 'Quarter-finals', label: 'cuartos', display: 'Cuartos' },
  { stage: 'Semi-finals', label: 'semifinales', display: 'Semifinales' },
  { stage: 'Final', label: 'la final', display: 'La final' },
]

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

  // Detectar la ronda KO abierta: primera (en orden) cuyos cruces ya tienen
  // equipos y estamos antes del cierre (1er partido − 1 min). Mismo criterio que
  // el widget de Inicio y BracketResults.
  const matches = await supaFetch(
    '/rest/v1/matches?select=id,stage,status,match_date,home_team_id,away_team_id&stage=neq.group'
  )
  if (!matches) return res.status(500).json({ error: 'No se pudieron leer los partidos' })

  const nowMs = Date.now()
  let round = null
  for (const kr of KO_ROUNDS) {
    const all = matches.filter(m => m.stage === kr.stage)
    if (!all.length) continue
    // La ronda solo se considera ABIERTA cuando TODOS sus cruces ya se conocen
    // (p.ej. cuartos espera a que acaben los 8 octavos). Evita avisos prematuros
    // del tipo "cuartos abierto" con un solo cruce definido.
    if (all.some(m => !m.home_team_id || !m.away_team_id)) continue
    const dated = all.filter(m => m.match_date)
    if (!dated.length) continue
    const earliest = Math.min(...dated.map(m => new Date(m.match_date).getTime()))
    const deadline = earliest - 60 * 1000
    if (nowMs >= deadline) continue
    round = { ...kr, deadline: new Date(deadline) }
    break
  }
  if (!round) return res.json({ sent: 0, skipped: 'ninguna ronda KO abierta ahora' })

  // Dedupe: ¿ya se avisó de esta ronda?
  const roundKey = `round-open-${round.stage}`
  if (!force) {
    const already = await supaFetch(`/rest/v1/sent_round_notifications?round_key=eq.${encodeURIComponent(roundKey)}&select=round_key`)
    if (already && already.length > 0) return res.json({ sent: 0, skipped: `ya enviado (${round.label})` })
  }

  const subs = await supaFetch('/rest/v1/push_subscriptions?select=id,endpoint,p256dh,auth')
  if (!subs || subs.length === 0) {
    // Marcar como enviado igualmente para no reintentar en bucle sin suscriptores.
    await supaFetch('/rest/v1/sent_round_notifications', {
      method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ round_key: roundKey, recipients: 0 }),
    })
    return res.json({ sent: 0, pruned: 0, total: 0 })
  }

  const payload = JSON.stringify({
    title: `🏆 ${round.display}: cuadro abierto`,
    body: `Ya se conocen los cruces. Rellena ${round.label === 'la final' ? 'la final' : 'tus ' + round.label} — cada cruce cierra cuando empieza ese partido.`,
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

  // Marcar la ronda como avisada (idempotente).
  await supaFetch('/rest/v1/sent_round_notifications', {
    method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ round_key: roundKey, recipients: sent }),
  })

  return res.json({ sent, pruned, total: subs.length, round: round.label })
}
