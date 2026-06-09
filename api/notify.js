/**
 * GET /api/notify  — Cron de notificaciones push "pocas pero acertadas".
 * Corre cada 30 min. Idempotente vía tabla notification_log.
 *
 * Envía:
 *  1) Recordatorios de cierre de predicciones del Mundial: 24h y 2h antes.
 *  2) Resumen final de La Liguilla: cuando terminan los 12 amistosos.
 *  3) Resumen diario del Mundial: 1 push/día tras la jornada (00:00-00:30 ES),
 *     personalizado (puntos de hoy + posición).
 *
 * Auth: CRON_SECRET (Vercel lo inyecta como Bearer) o JWT de admin.
 * ?force=1 ignora la ventana horaria del resumen diario (test).
 * ?dry=1 calcula y loguea sin enviar.
 */
import webpush from 'web-push'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const VAPID_PUBLIC_KEY = process.env.VITE_VAPID_PUBLIC_KEY
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:noreply@porra-mundial-2026.app'

const BOT365_ID = 'b0365b03-65b0-365b-0365-b0365b036500'
const PREDICTIONS_DEADLINE = new Date('2026-06-10T21:59:00Z') // 23:59 hora España
const MUNDIAL_START = new Date('2026-06-11T00:00:00Z')

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

// ¿Ya se envió esta notificación única? (dedupe)
async function alreadySent(key) {
  const rows = await supaFetch(`/rest/v1/notification_log?key=eq.${encodeURIComponent(key)}&select=key`)
  return Array.isArray(rows) && rows.length > 0
}
async function markSent(key, meta) {
  await supaFetch('/rest/v1/notification_log', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates' },
    body: JSON.stringify({ key, meta: meta || null }),
  })
}

// Envía un payload a una lista de userIds (busca sus suscripciones).
async function pushToUsers(userIds, payload, dry, log) {
  if (!userIds.length) return 0
  const ids = userIds.map(id => `"${id}"`).join(',')
  const subs = await supaFetch(`/rest/v1/push_subscriptions?user_id=in.(${ids})&select=id,endpoint,p256dh,auth`) || []
  if (dry) { log.push(`   [dry] ${subs.length} subs para ${userIds.length} users`); return 0 }
  let sent = 0
  await Promise.all(subs.map(async sub => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        typeof payload === 'function' ? payload(sub) : payload
      )
      sent++
    } catch (e) {
      if (e?.statusCode === 410 || e?.statusCode === 404) {
        await supaFetch(`/rest/v1/push_subscriptions?id=eq.${sub.id}`, { method: 'DELETE' })
      }
    }
  }))
  return sent
}

// Igual pero payload personalizado por usuario: subsByUser → payload(userId).
async function pushPersonalized(userIds, payloadFor, dry, log) {
  if (!userIds.length) return 0
  const ids = userIds.map(id => `"${id}"`).join(',')
  const subs = await supaFetch(`/rest/v1/push_subscriptions?user_id=in.(${ids})&select=id,user_id,endpoint,p256dh,auth`) || []
  if (dry) { log.push(`   [dry] ${subs.length} subs personalizadas`); return 0 }
  let sent = 0
  await Promise.all(subs.map(async sub => {
    const payload = payloadFor(sub.user_id)
    if (!payload) return
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      )
      sent++
    } catch (e) {
      if (e?.statusCode === 410 || e?.statusCode === 404) {
        await supaFetch(`/rest/v1/push_subscriptions?id=eq.${sub.id}`, { method: 'DELETE' })
      }
    }
  }))
  return sent
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return res.status(500).json({ error: 'env missing' })

  // Auth: CRON_SECRET (cron) o JWT admin.
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
    let ok = token === cronSecret
    if (!ok && token) {
      try {
        const u = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${token}` } })
        if (u.ok) {
          const user = await u.json()
          const prof = await supaFetch(`/rest/v1/profiles?id=eq.${user.id}&select=is_admin`)
          if (prof?.[0]?.is_admin) ok = true
        }
      } catch {}
    }
    if (!ok) return res.status(401).json({ error: 'Unauthorized' })
  }

  const dry = req.query?.dry === '1'
  const force = req.query?.force === '1'
  const now = new Date()
  const log = []
  const result = {}

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return res.status(200).json({ skipped: 'no vapid keys' })
  }

  // ── 1) Recordatorios de cierre (24h y 2h antes) ─────────────────────────
  const paidProfiles = await supaFetch('/rest/v1/profiles?has_paid=eq.true&select=id') || []
  const paidIds = paidProfiles.map(p => p.id).filter(id => id !== BOT365_ID)

  const reminders = [
    { key: 'deadline_24h', ms: 24 * 3600 * 1000, label: 'Quedan 24 horas para cerrar tus predicciones del Mundial.' },
    { key: 'deadline_2h',  ms: 2 * 3600 * 1000,  label: 'Últimas 2 horas para cerrar tus predicciones del Mundial.' },
  ]
  for (const r of reminders) {
    const windowStart = new Date(PREDICTIONS_DEADLINE.getTime() - r.ms)
    if (now >= windowStart && now < PREDICTIONS_DEADLINE && !(await alreadySent(r.key))) {
      const sent = await pushToUsers(paidIds, JSON.stringify({
        title: '⏰ Cierre de predicciones', body: r.label, url: '/predictions',
      }), dry, log)
      if (!dry) await markSent(r.key, { sent })
      result[r.key] = sent
      log.push(`   ⏰ ${r.key}: ${sent}`)
    }
  }

  // ── 2) Resumen final de La Liguilla ─────────────────────────────────────
  const friendlyMatches = await supaFetch('/rest/v1/matches?stage=eq.friendly&select=status') || []
  const allFriendlyDone = friendlyMatches.length > 0 && friendlyMatches.every(m => m.status === 'finished')
  if (allFriendlyDone && !(await alreadySent('liguilla_final'))) {
    const joined = await supaFetch('/rest/v1/profiles?friendly_joined=eq.true&select=id') || []
    const ids = joined.map(p => p.id).filter(id => id !== BOT365_ID)
    const sent = await pushToUsers(ids, JSON.stringify({
      title: '🏆 La Liguilla ha terminado', body: 'Mira la clasificación final en la app.', url: '/leaderboard?only=friendly',
    }), dry, log)
    if (!dry) await markSent('liguilla_final', { sent })
    result.liguilla_final = sent
    log.push(`   🏆 liguilla_final: ${sent}`)
  }

  // ── 3) Resumen diario del Mundial ───────────────────────────────────────
  // Ventana: 22:00-22:30 UTC (00:00-00:30 hora España) → 1 vez/día.
  const inDailyWindow = force || (now.getUTCHours() === 22 && now.getUTCMinutes() < 30)
  if (now >= MUNDIAL_START && inDailyWindow) {
    const dateKey = `daily_${now.toISOString().slice(0, 10)}`
    if (!(await alreadySent(dateKey))) {
      // Partidos del Mundial terminados HOY
      const todayISO = now.toISOString().slice(0, 10)
      const todayMatches = await supaFetch(
        `/rest/v1/matches?status=eq.finished&stage=not.in.(friendly,test)&match_date=gte.${todayISO}T00:00:00Z&match_date=lt.${todayISO}T23:59:59Z&select=id`
      ) || []
      if (todayMatches.length > 0) {
        const matchIds = todayMatches.map(m => m.id)
        const preds = await supaFetch(
          `/rest/v1/predictions?match_id=in.(${matchIds.join(',')})&select=user_id,points_earned`
        ) || []
        const gain = {}
        preds.forEach(p => { if (p.user_id !== BOT365_ID) gain[p.user_id] = (gain[p.user_id] || 0) + (p.points_earned || 0) })

        // Ranking actual del Mundial para la posición
        const lb = await supaFetch('/rest/v1/leaderboard?select=user_id,total_points,exact_hits') || []
        const ranked = lb.filter(r => r.user_id !== BOT365_ID && paidIds.includes(r.user_id))
          .sort((a, b) => (b.total_points || 0) - (a.total_points || 0) || (b.exact_hits || 0) - (a.exact_hits || 0))
        const rankByUser = {}
        ranked.forEach((r, i) => { rankByUser[r.user_id] = i + 1 })
        const total = ranked.length

        const sent = await pushPersonalized(paidIds, (uid) => {
          const g = gain[uid] || 0
          const pos = rankByUser[uid]
          if (!pos) return null
          return JSON.stringify({
            title: '📊 Jornada cerrada',
            body: `Hoy ${g >= 0 ? '+' : ''}${g} pts · vas ${pos}º de ${total}.`,
            url: '/leaderboard',
          })
        }, dry, log)
        if (!dry) await markSent(dateKey, { sent })
        result.daily = sent
        log.push(`   📊 ${dateKey}: ${sent}`)
      } else {
        log.push('   📊 sin partidos del Mundial hoy — sin resumen')
      }
    }
  }

  return res.status(200).json({ ok: true, dry, result, log })
}
