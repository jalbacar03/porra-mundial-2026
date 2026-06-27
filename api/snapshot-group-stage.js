/**
 * GET/POST /api/snapshot-group-stage
 * Congela la clasificación FINAL de la fase de grupos (premio al líder de grupos).
 * Total = leaderboard.total_points en ese momento (partidos de grupos + especiales
 * ya resueltas; el cuadro/CC está a 0 todavía). La clasificación está congelada
 * entre el fin de grupos (~06:00 Madrid dom) y el primer dieciseisavo (~23:00),
 * así que cualquier captura en esa ventana es correcta.
 *
 * Disparo: Vercel Cron una sola vez (dom 28 jun 13:00 UTC = 15:00 Madrid), dentro
 * de la ventana congelada. Idempotente: si ya hay foto, no hace nada.
 * Guarda: solo captura si los 72 partidos de grupos están 'finished' (salvo ?force=1).
 * Manual: el admin puede forzarlo con JWT/CRON_SECRET.
 */
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const CRON_SECRET = process.env.CRON_SECRET
const ADMIN_ID = 'e2fc4937-cd8d-4cb1-8291-05fa8a66ce97'
const BOT365_ID = 'b0365b03-65b0-365b-0365-b0365b036500'

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

  // Idempotente: si ya existe la foto, no la pisamos.
  const existing = await supaFetch('/rest/v1/group_stage_final?select=user_id&limit=1')
  if (existing && existing.length > 0) {
    return res.json({ ok: true, already: true, message: 'La foto de grupos ya estaba capturada' })
  }

  // Guarda: los 72 partidos de grupos deben estar terminados de verdad.
  const groupMatches = await supaFetch('/rest/v1/matches?select=status&stage=eq.group')
  const total = (groupMatches || []).length
  const finished = (groupMatches || []).filter(m => m.status === 'finished').length
  if (!force && (total === 0 || finished !== total)) {
    return res.json({ ok: false, skipped: `fase de grupos no completa (${finished}/${total} terminados)` })
  }

  // Clasificación + perfiles para filtrar a participantes reales (igual que la app).
  const [rows, profiles] = await Promise.all([
    supaFetch('/rest/v1/leaderboard?select=user_id,full_name,total_points,exact_hits,pre_tournament_points'),
    supaFetch('/rest/v1/profiles?select=id,has_paid,admission_dismissed'),
  ])
  if (!rows || !profiles) return res.status(500).json({ error: 'No se pudo leer la clasificación' })

  const paid = new Set(
    profiles.filter(p => p.has_paid && !p.admission_dismissed && p.id !== BOT365_ID).map(p => p.id)
  )

  // Mismo desempate oficial que la clasificación: puntos desc, luego exactos desc.
  const ranked = rows
    .filter(r => paid.has(r.user_id))
    .sort((a, b) =>
      (b.total_points || 0) - (a.total_points || 0) ||
      (b.exact_hits || 0) - (a.exact_hits || 0)
    )
    .map((r, i) => ({
      user_id: r.user_id,
      full_name: r.full_name,
      total_points: r.total_points || 0,
      exact_hits: r.exact_hits || 0,
      pre_tournament_points: r.pre_tournament_points || 0,
      position: i + 1,
    }))

  if (ranked.length === 0) return res.json({ ok: false, skipped: 'sin participantes' })

  const inserted = await supaFetch('/rest/v1/group_stage_final', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(ranked),
  })

  const winner = ranked[0]
  return res.json({
    ok: true,
    captured: Array.isArray(inserted) ? inserted.length : ranked.length,
    winner: { name: winner.full_name, points: winner.total_points, exact_hits: winner.exact_hits },
    top3: ranked.slice(0, 3).map(r => ({ pos: r.position, name: r.full_name, points: r.total_points })),
  })
}
