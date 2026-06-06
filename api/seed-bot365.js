/**
 * GET /api/seed-bot365 — Rellena las predicciones de partidos de Bot365
 * (la "referencia · casas de apuestas") con el FAVORITO según las cuotas
 * 1X2 de API-Football.
 *
 * - Mapea cada partido de grupo (por api_football_id de los equipos) con su
 *   fixture en API-Football, lee las cuotas Match Winner y deduce el favorito.
 * - Marcador según la distancia de cuota (paliza / ajustado / empate).
 * - Solo escribe cuando hay cuotas; informa de la cobertura.
 *
 * Auth: CRON_SECRET o JWT de admin.
 * ?dry=1 → calcula y devuelve el plan sin escribir.
 * ?only_missing=1 → solo los partidos que Bot365 aún no tiene.
 */
const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const BOT365_ID = 'b0365b03-65b0-365b-0365-b0365b036500'
const WORLD_CUP_ID = 1
const WORLD_CUP_SEASON = 2026

async function apiFetch(endpoint) {
  const res = await fetch(`https://v3.football.api-sports.io${endpoint}`, {
    headers: { 'x-apisports-key': API_FOOTBALL_KEY },
  })
  if (!res.ok) return { response: [] }
  return res.json()
}
async function supaFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(options.headers || {}),
    },
  })
  if (!res.ok) return null
  return res.json().catch(() => null)
}

// Marcador a partir de las cuotas 1X2 (decimales).
function scoreFromOdds(home, draw, away) {
  const favSide = home <= away ? 'home' : 'away'
  const favOdd = Math.min(home, away)
  const othOdd = Math.max(home, away)
  const ratio = othOdd / favOdd // >1, cuanto mayor más favorito
  let fg, og // fav goals, other goals
  if (draw < favOdd * 1.15 && ratio < 1.4) { fg = 1; og = 1 }       // muy parejo → empate
  else if (ratio >= 2.4) { fg = 2; og = 0 }                          // paliza
  else if (ratio >= 1.5) { fg = 2; og = 1 }                          // claro
  else { fg = 1; og = 0 }                                            // ajustado
  return favSide === 'home' ? { h: fg, a: og } : { h: og, a: fg }
}

function parse1x2(oddsResp) {
  const bm = oddsResp?.response?.[0]?.bookmakers
  if (!bm?.length) return null
  for (const book of bm) {
    const mw = book.bets?.find(b => b.name === 'Match Winner' || b.id === 1)
    if (!mw) continue
    const get = (v) => parseFloat(mw.values.find(x => x.value === v)?.odd)
    const home = get('Home'), draw = get('Draw'), away = get('Away')
    if (home && draw && away) return { home, draw, away }
  }
  return null
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (!API_FOOTBALL_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'env missing' })
  }

  // Auth (CRON_SECRET o admin JWT)
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
  const onlyMissing = req.query?.only_missing === '1'
  const log = []

  // Datos base
  const teams = await supaFetch('/rest/v1/teams?select=id,name,api_football_id') || []
  const ourByApiId = {}
  teams.forEach(t => { if (t.api_football_id) ourByApiId[t.api_football_id] = t.id })

  const groupMatches = await supaFetch('/rest/v1/matches?stage=eq.group&select=id,home_team_id,away_team_id') || []
  const existing = await supaFetch(`/rest/v1/predictions?user_id=eq.${BOT365_ID}&select=match_id,predicted_home&predicted_home=not.is.null`) || []
  const hasPred = new Set(existing.map(e => e.match_id))

  // Fixtures del Mundial → mapa (homeApiId-awayApiId) → fixtureId
  const fx = await apiFetch(`/fixtures?league=${WORLD_CUP_ID}&season=${WORLD_CUP_SEASON}`)
  const fixtureByTeams = {}
  ;(fx.response || []).forEach(f => {
    const h = f.teams?.home?.id, a = f.teams?.away?.id
    if (h && a) fixtureByTeams[`${h}-${a}`] = f.fixture.id
  })
  log.push(`Fixtures API: ${fx.response?.length || 0} · equipos mapeados: ${Object.keys(ourByApiId).length}`)

  let filled = 0, noFixture = 0, noOdds = 0, skipped = 0
  const plan = []

  for (const m of groupMatches) {
    if (onlyMissing && hasPred.has(m.id)) { skipped++; continue }
    // api ids de nuestros equipos
    const homeApi = teams.find(t => t.id === m.home_team_id)?.api_football_id
    const awayApi = teams.find(t => t.id === m.away_team_id)?.api_football_id
    const fixtureId = (homeApi && awayApi) ? fixtureByTeams[`${homeApi}-${awayApi}`] : null
    if (!fixtureId) { noFixture++; continue }

    const oddsResp = await apiFetch(`/odds?fixture=${fixtureId}`)
    const odds = parse1x2(oddsResp)
    if (!odds) { noOdds++; continue }

    const { h, a } = scoreFromOdds(odds.home, odds.draw, odds.away)
    plan.push({ match_id: m.id, h, a, odds })

    if (!dry) {
      // upsert: PATCH; si no existe, POST
      const patched = await supaFetch(
        `/rest/v1/predictions?user_id=eq.${BOT365_ID}&match_id=eq.${m.id}`,
        { method: 'PATCH', body: JSON.stringify({ predicted_home: h, predicted_away: a }) }
      )
      if (!patched || patched.length === 0) {
        await supaFetch('/rest/v1/predictions', {
          method: 'POST',
          body: JSON.stringify({ user_id: BOT365_ID, match_id: m.id, predicted_home: h, predicted_away: a }),
        })
      }
    }
    filled++
  }

  return res.status(200).json({
    dry,
    summary: { groupMatches: groupMatches.length, filled, noFixture, noOdds, skipped },
    plan: dry ? plan : undefined,
    log,
  })
}
