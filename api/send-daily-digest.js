/**
 * Vercel Serverless Function — Daily email digest
 *
 * GET /api/send-daily-digest → Genera y envía digest diario a todos los
 * participantes (excluyendo Bot365). Contenido:
 *   - Saludo personalizado
 *   - Hero con posición + delta posiciones + puntos + exactos
 *   - Tu jornada: predicciones vs realidad por partido
 *   - Movimientos del día: top 3 que subieron/bajaron
 *   - Resultados del día anterior
 *   - Consensus: cómo predijo el grupo cada partido (barras)
 *   - Top 10 leaderboard
 *   - Crónica corta del día (Gemini)
 *   - CTA a la app
 *
 * Cron diario a las 06:00 UTC (08:00 hora España).
 * Auth: CRON_SECRET (opt-in, igual que sync-results).
 * Query: ?force=true → bypass del skip pre-Mundial (testing manual).
 */

import { buildEmailHTML, buildSubject } from './_digest-template.js'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Porra Mundial 2026 <noreply@porramundial2026.app>'
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const APP_URL = process.env.APP_URL || 'https://porramundial2026.app'

const BOT365_ID = 'b0365b03-65b0-365b-0365-b0365b036500'
const MUNDIAL_START = new Date('2026-06-11T00:00:00Z')

// Nombre real formateado (espejo de src/utils/nickname.js → formatRealName).
const NAME_OVERRIDES = {
  'José Antonio Menéndez': 'José Menéndez',
  'Gonzalo de Parellada Menéndez': 'Gonzalo de Parellada',
  'Jose Maria Guitart': 'Jose María Guitart',
  'Álvaro García Magro': 'Álvaro García M.',
}
function formatRealNameServer(fullName) {
  if (!fullName) return ''
  if (NAME_OVERRIDES[fullName]) return NAME_OVERRIDES[fullName]
  const PREPS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'da', 'do', 'di'])
  const isInitial = (w) => /^[a-záéíóúñ]\.?$/i.test(w)
  const tc = (w) => w ? w.split('-').map(s => s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s).join('-') : w
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return ''
  const real = parts.filter(p => !PREPS.has(p.toLowerCase()) && !isInitial(p))
  if (!real.length) return tc(parts[0])
  if (real.length === 1) return tc(real[0])
  return `${tc(real[0])} ${tc(real[1])}`
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
  if (!res.ok) {
    console.error(`Supabase ${path}: ${res.status} ${await res.text().catch(() => '')}`)
    return []
  }
  return res.json().catch(() => [])
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (!RESEND_API_KEY) {
    return res.status(500).json({ error: 'RESEND_API_KEY not set' })
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Supabase env vars missing' })
  }

  // Auth — same opt-in pattern as sync-results
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = req.headers.authorization || ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    if (!token) return res.status(401).json({ error: 'Unauthorized' })

    let allowed = token === cronSecret
    if (!allowed) {
      try {
        const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
          headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${token}` },
        })
        if (userRes.ok) {
          const user = await userRes.json()
          if (user?.id) {
            const prof = await supaFetch(`/rest/v1/profiles?id=eq.${user.id}&select=is_admin`)
            if (Array.isArray(prof) && prof[0]?.is_admin) allowed = true
          }
        }
      } catch {}
    }
    if (!allowed) return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const log = []
    const now = new Date()
    const force = req.query?.force === 'true' || req.url?.includes('force=true')

    // ─── MODO ─────────────────────────────────────────────────────────────
    // Antes del 11 jun (MUNDIAL_START) → modo 'friendly': digest de La Liguilla
    //   - Audience: solo profiles con friendly_joined=true
    //   - Leaderboard: vista leaderboard_friendly
    //   - Partidos ayer: stage='friendly'
    // A partir del 11 jun → modo 'mundial': digest del Mundial real
    //   - Audience: profiles con has_paid=true
    //   - Leaderboard: vista leaderboard
    //   - Partidos ayer: stage='group' (no friendly)
    // ?mode=friendly o ?mode=mundial fuerza el modo (testing).
    const explicitMode = req.query?.mode || (req.url?.match(/[?&]mode=(\w+)/)?.[1])
    const mode = explicitMode || (now < MUNDIAL_START ? 'friendly' : 'mundial')
    log.push(`📨 Modo: ${mode}`)

    const stageFilter = mode === 'friendly' ? "eq.friendly" : "eq.group"
    const lbView = mode === 'friendly' ? 'leaderboard_friendly' : 'leaderboard'

    // Yesterday's window in Madrid time (UTC+2 in summer). Compute as UTC range.
    const yesterdayStart = new Date(now)
    yesterdayStart.setUTCHours(0, 0, 0, 0)
    yesterdayStart.setUTCDate(yesterdayStart.getUTCDate() - 1)
    const yesterdayEnd = new Date(yesterdayStart)
    yesterdayEnd.setUTCDate(yesterdayEnd.getUTCDate() + 1)

    // 1. Fetch data in parallel
    log.push('📡 Fetching data…')
    const [lb, profiles, yMatches, insight] = await Promise.all([
      supaFetch(`/rest/v1/${lbView}?select=*`),
      supaFetch('/rest/v1/profiles?select=id,full_name,nickname,has_paid,payment_confirmed,friendly_joined'),
      supaFetch(
        `/rest/v1/matches?select=id,home_score,away_score,match_date,stage,home_team:teams!matches_home_team_id_fkey(name,flag_url),away_team:teams!matches_away_team_id_fkey(name,flag_url)` +
          `&status=eq.finished` +
          `&stage=${stageFilter}` +
          `&match_date=gte.${yesterdayStart.toISOString()}` +
          `&match_date=lt.${yesterdayEnd.toISOString()}` +
          `&order=match_date.asc`
      ),
      supaFetch(
        `/rest/v1/daily_insights?select=content&date=eq.${now.toISOString().slice(0, 10)}&limit=1`
      ),
    ])

    // Fetch user emails from auth.users via admin API
    const usersRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=500`, {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    })
    const authUsers = usersRes.ok ? (await usersRes.json())?.users || [] : []
    const emailById = {}
    authUsers.forEach(u => { if (u.id && u.email) emailById[u.id] = u.email })

    log.push(`   Leaderboard ${lb.length} · Profiles ${profiles.length} · Yesterday matches ${yMatches.length}`)

    // 2. Decide whether to send anything.
    // En modo friendly sin partidos ayer: skip (los días dentro de La Liguilla
    // sin amistosos no tienen sentido enviar). En modo mundial sin partidos
    // ayer: enviar igual (crónica + leaderboard).
    if (mode === 'friendly' && yMatches.length === 0 && !force) {
      log.push('⏭️ La Liguilla sin partidos ayer — skip (usa ?force=true para forzar)')
      return res.status(200).json({ sent: 0, reason: 'friendly no matches yesterday', log })
    }
    if (force) log.push('⚠️ Force mode')

    // 3. Audience según el modo.
    //   friendly → solo los que se apuntaron a La Liguilla.
    //   mundial  → todos los pagados (has_paid).
    const audienceIds = new Set(
      profiles
        .filter(p => p.id !== BOT365_ID)
        .filter(p => mode === 'friendly' ? p.friendly_joined : p.has_paid)
        .map(p => p.id)
    )
    const nameById = Object.fromEntries(
      profiles.map(p => [p.id, formatRealNameServer(p.full_name) || p.nickname || 'Participante'])
    )

    const ranked = lb
      .filter(r => r.user_id !== BOT365_ID && audienceIds.has(r.user_id))
      .map(r => ({
        ...r,
        full_name: nameById[r.user_id] || r.full_name || 'Participante',
        email: emailById[r.user_id],
      }))
      .sort(
        (a, b) =>
          (b.total_points || 0) - (a.total_points || 0) ||
          (b.exact_hits || 0) - (a.exact_hits || 0)
      )

    log.push(`   Audience: ${audienceIds.size} (${mode}) · ranked: ${ranked.length}`)

    // 4. Compute delta vs yesterday (points earned in yesterday's matches)
    // + per-user breakdown of yesterday's predictions (for "Tu jornada")
    // + per-match consensus stats (for "Cómo predijo el grupo")
    const yMatchIds = yMatches.map(m => m.id)
    const deltaByUser = {}
    const yPredsByUserMatch = {} // { userId: { matchId: { predHome, predAway, pts } } }
    const consensusByMatch = {}  // { matchId: { totalPreds, signCorrect, exactCorrect, signPct, exactPct } }

    if (yMatchIds.length > 0) {
      const yPreds = await supaFetch(
        `/rest/v1/predictions?select=user_id,match_id,predicted_home,predicted_away,points_earned&match_id=in.(${yMatchIds.join(',')})`
      )
      // delta per user
      yPreds.forEach(p => {
        deltaByUser[p.user_id] = (deltaByUser[p.user_id] || 0) + (p.points_earned || 0)
        if (!yPredsByUserMatch[p.user_id]) yPredsByUserMatch[p.user_id] = {}
        yPredsByUserMatch[p.user_id][p.match_id] = {
          predHome: p.predicted_home,
          predAway: p.predicted_away,
          pts: p.points_earned || 0,
        }
      })
      // consensus per match
      for (const m of yMatches) {
        const matchPreds = yPreds.filter(p => p.match_id === m.id && p.user_id !== BOT365_ID)
        let exact = 0, sign = 0
        for (const p of matchPreds) {
          if (p.predicted_home == null || p.predicted_away == null) continue
          if (p.predicted_home === m.home_score && p.predicted_away === m.away_score) {
            exact++
          } else {
            const ps = Math.sign(p.predicted_home - p.predicted_away)
            const rs = Math.sign(m.home_score - m.away_score)
            if (ps === rs) sign++
          }
        }
        const total = matchPreds.length
        const signTotal = exact + sign  // signo correcto (incluye exactos)
        consensusByMatch[m.id] = {
          totalPreds: total,
          signCorrect: signTotal,
          exactCorrect: exact,
          signPct: total > 0 ? Math.round((signTotal / total) * 100) : 0,
          exactPct: total > 0 ? Math.round((exact / total) * 100) : 0,
        }
      }
    }

    // Decorate yMatches with consensus for the template
    const yMatchesWithConsensus = yMatches.map(m => ({
      ...m, consensus: consensusByMatch[m.id],
    }))

    // 4b. Compute rank deltas (movements: who went up/down most)
    // ranked = current. "Yesterday's ranking" = subtract delta from each user's total.
    const yesterdayRanked = ranked.map(r => ({
      ...r,
      total_points: (r.total_points || 0) - (deltaByUser[r.user_id] || 0),
    })).sort(
      (a, b) =>
        (b.total_points || 0) - (a.total_points || 0) ||
        (b.exact_hits || 0) - (a.exact_hits || 0)
    )
    const yesterdayRankByUser = {}
    yesterdayRanked.forEach((r, i) => { yesterdayRankByUser[r.user_id] = i + 1 })
    const todayRankByUser = {}
    ranked.forEach((r, i) => { todayRankByUser[r.user_id] = i + 1 })

    const posDeltaByUser = {}
    for (const r of ranked) {
      posDeltaByUser[r.user_id] = (yesterdayRankByUser[r.user_id] || 0) - (todayRankByUser[r.user_id] || 0)
    }

    const movementsAll = ranked
      .map(r => ({
        name: r.full_name,
        posDelta: posDeltaByUser[r.user_id] || 0,
        fromRank: yesterdayRankByUser[r.user_id],
        toRank: todayRankByUser[r.user_id],
      }))
      .filter(m => m.posDelta !== 0)

    const movements = {
      up:   movementsAll.filter(m => m.posDelta > 0).sort((a, b) => b.posDelta - a.posDelta).slice(0, 3),
      down: movementsAll.filter(m => m.posDelta < 0).sort((a, b) => a.posDelta - b.posDelta).slice(0, 3),
    }

    // 5. Compute tied ranks (T1, T1 for ties)
    const rankInfo = {}
    ranked.forEach((r, idx) => {
      const pts = r.total_points || 0
      const exact = r.exact_hits || 0
      let firstSame = idx
      while (
        firstSame > 0 &&
        (ranked[firstSame - 1].total_points || 0) === pts &&
        (ranked[firstSame - 1].exact_hits || 0) === exact
      ) {
        firstSame--
      }
      const rank = firstSame + 1
      const tied =
        firstSame < idx ||
        (idx + 1 < ranked.length &&
          (ranked[idx + 1].total_points || 0) === pts &&
          (ranked[idx + 1].exact_hits || 0) === exact)
      rankInfo[r.user_id] = { rank, label: tied ? `T${rank}` : `${rank}` }
    })

    const top10 = ranked.slice(0, 10)
    const insightText = insight?.[0]?.content || null

    // 6. Build personalized emails for each user with email
    log.push('✉️  Building emails…')
    const emails = []
    for (const user of ranked) {
      if (!user.email) continue
      const ri = rankInfo[user.user_id]
      const delta = deltaByUser[user.user_id] || 0
      const posDelta = posDeltaByUser[user.user_id] || 0

      // Build per-user "Tu jornada": match-by-match con tu predicción + status
      const yourMatches = yMatches.map(m => {
        const p = yPredsByUserMatch[user.user_id]?.[m.id]
        if (!p) {
          return {
            home: m.home_team?.name || '?', away: m.away_team?.name || '?',
            homeScore: m.home_score, awayScore: m.away_score,
            predHome: null, predAway: null, pts: 0, status: 'nopred',
          }
        }
        let status = 'miss'
        if (p.predHome === m.home_score && p.predAway === m.away_score) status = 'exact'
        else if (Math.sign(p.predHome - p.predAway) === Math.sign(m.home_score - m.away_score)) status = 'sign'
        return {
          home: m.home_team?.name || '?', away: m.away_team?.name || '?',
          homeScore: m.home_score, awayScore: m.away_score,
          predHome: p.predHome, predAway: p.predAway, pts: p.pts, status,
        }
      })

      const html = buildEmailHTML({
        mode,
        userName: user.full_name,
        rankLabel: ri.label,
        totalParticipants: ranked.length,
        points: user.total_points || 0,
        exactHits: user.exact_hits || 0,
        delta,
        posDelta,
        yourMatches,
        movements,
        yMatches: yMatchesWithConsensus,
        top10,
        rankInfo,
        insightText,
        appUrl: APP_URL,
      })
      emails.push({
        from: RESEND_FROM_EMAIL,
        to: [user.email],
        subject: buildSubject({
          mode,
          rankLabel: ri.label, delta, posDelta,
          hasMatches: yMatches.length > 0,
          hasPredictions: yourMatches.some(m => m.status !== 'nopred'),
        }),
        html,
      })
    }

    // ?test=email@x → enviar SOLO a esa dirección (debug sin spamear a todos).
    // Si la dirección coincide con un participante, manda su email real; si no,
    // reusa el del primer participante pero al destinatario de test.
    const testEmail = req.query?.test || (req.url?.match(/[?&]test=([^&]+)/)?.[1] && decodeURIComponent(req.url.match(/[?&]test=([^&]+)/)[1]))
    let outEmails = emails
    if (testEmail) {
      const mine = emails.find(e => e.to[0] === testEmail)
      const base = mine || emails[0]
      outEmails = base ? [{ ...base, to: [testEmail] }] : []
      log.push(`🧪 Test mode → solo a ${testEmail} (${mine ? 'su email' : 'contenido del 1º'})`)
    }

    if (outEmails.length === 0) {
      log.push('⚠️ No emails to send (no users with email)')
      return res.status(200).json({ sent: 0, reason: 'no recipients', log })
    }

    const emails_ = outEmails
    log.push(`   ${emails_.length} emails ready`)

    // 7. Send via Resend batch API (max 100 per batch). For 100 users = 1 call.
    log.push('📨 Sending via Resend…')
    let sent = 0
    let failed = 0
    for (let i = 0; i < emails_.length; i += 100) {
      const batch = emails_.slice(i, i + 100)
      const r = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(batch),
      })
      if (r.ok) {
        sent += batch.length
        log.push(`   ✅ Batch ${i / 100 + 1}: ${batch.length} sent`)
      } else {
        failed += batch.length
        const errText = await r.text().catch(() => '')
        log.push(`   ❌ Batch ${i / 100 + 1} failed: ${r.status} ${errText.slice(0, 200)}`)
      }
    }

    return res.status(200).json({
      sent,
      failed,
      totalRecipients: emails_.length,
      yesterdayMatches: yMatches.length,
      log,
    })
  } catch (err) {
    console.error('Digest error:', err)
    return res.status(500).json({ error: String(err) })
  }
}
