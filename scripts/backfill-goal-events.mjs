/**
 * Backfill de eventos de gol (minuto + descuento) para la Porra Mundial 2026.
 *
 * SOLO LECTURA sobre lo existente:
 *   - Lee `matches` y `teams` de Supabase con la ANON key (ambas son públicas).
 *   - Llama a API-Football: /fixtures (1 call) + /fixtures/events (1 call por partido).
 *   - NO escribe en Supabase. Vuelca las filas en un JSON en scratchpad; la
 *     inserción en `goal_events` la hace el asistente vía MCP (service_role).
 *
 * Uso:
 *   API_FOOTBALL_KEY=xxxx node scripts/backfill-goal-events.mjs [--out <ruta.json>]
 *
 * La key de pago NO se guarda en el repo. Se pasa por variable de entorno.
 */

import fs from 'node:fs'

// --- Config ---
const WORLD_CUP_ID = 1
const WORLD_CUP_SEASON = 2026
const API_BASE = 'https://v3.football.api-sports.io'

const API_KEY = process.env.API_FOOTBALL_KEY
if (!API_KEY) {
  console.error('❌ Falta API_FOOTBALL_KEY en el entorno. Uso: API_FOOTBALL_KEY=xxxx node scripts/backfill-goal-events.mjs')
  process.exit(1)
}

// Lee VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY de .env.local (o del entorno).
function readEnvLocal() {
  const out = {}
  try {
    const txt = fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    for (const line of txt.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
    }
  } catch { /* usa process.env */ }
  return out
}
const envLocal = readEnvLocal()
const SUPABASE_URL = process.env.SUPABASE_URL || envLocal.VITE_SUPABASE_URL
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY || envLocal.VITE_SUPABASE_ANON_KEY
if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.error('❌ Falta SUPABASE_URL / ANON KEY (esperados en .env.local como VITE_*).')
  process.exit(1)
}

const outArg = process.argv.indexOf('--out')
const OUT_PATH = outArg !== -1 ? process.argv[outArg + 1] : '/tmp/goal_events_backfill.json'

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function apiFetch(endpoint) {
  const res = await fetch(`${API_BASE}${endpoint}`, { headers: { 'x-apisports-key': API_KEY } })
  if (!res.ok) throw new Error(`API-Football ${res.status} ${res.statusText} @ ${endpoint}`)
  const json = await res.json()
  if (json.errors && Object.keys(json.errors).length) {
    throw new Error(`API-Football errors @ ${endpoint}: ${JSON.stringify(json.errors)}`)
  }
  return json
}

async function supaGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` }
  })
  if (!res.ok) throw new Error(`Supabase ${res.status} @ ${path}: ${await res.text()}`)
  return res.json()
}

function classifyGoal(ev) {
  const detail = ev.detail || ''
  const isPenalty = /penalty/i.test(detail) && !/missed/i.test(detail)
  const isOwn = /own goal/i.test(detail)
  return { detail, isPenalty, isOwn }
}

async function main() {
  console.log('📡 Leyendo matches y teams de Supabase (anon, solo lectura)...')
  const matches = await supaGet('matches?select=id,home_team_id,away_team_id,stage,status,match_date,home_score,away_score&order=id')
  const teams = await supaGet('teams?select=id,name,api_football_id')

  const ourTeamByApiId = {}     // api_football_id -> our team id
  const apiIdByOurTeam = {}     // our team id -> api_football_id
  for (const t of teams) {
    if (t.api_football_id != null) {
      ourTeamByApiId[t.api_football_id] = t.id
      apiIdByOurTeam[t.id] = t.api_football_id
    }
  }

  // Partidos reales terminados (excluye amistosos/test/no jugados).
  const targetMatches = matches.filter(m =>
    m.status === 'finished' &&
    !['friendly', 'test'].includes(m.stage) &&
    m.home_team_id != null && m.away_team_id != null
  )
  console.log(`   ${targetMatches.length} partidos reales terminados a procesar.`)

  console.log('📡 Bajando lista de fixtures de la liga (1 call)...')
  const fixturesRes = await apiFetch(`/fixtures?league=${WORLD_CUP_ID}&season=${WORLD_CUP_SEASON}`)
  const fixtures = fixturesRes.response || []
  console.log(`   ${fixtures.length} fixtures en la API.`)

  // Índice: par de nuestros team ids (ordenado) -> lista de {fixtureId, homeOurId, awayOurId, date}
  const fixtureIndex = new Map()
  for (const f of fixtures) {
    const homeOur = ourTeamByApiId[f.teams?.home?.id]
    const awayOur = ourTeamByApiId[f.teams?.away?.id]
    if (!homeOur || !awayOur) continue
    const key = [homeOur, awayOur].sort((a, b) => a - b).join('-')
    if (!fixtureIndex.has(key)) fixtureIndex.set(key, [])
    fixtureIndex.get(key).push({
      fixtureId: f.fixture.id,
      homeOurId: homeOur,
      awayOurId: awayOur,
      date: f.fixture.date ? new Date(f.fixture.date).getTime() : null
    })
  }

  // Resuelve fixture id por partido (par de equipos + fecha más cercana).
  function resolveFixture(m) {
    const key = [m.home_team_id, m.away_team_id].sort((a, b) => a - b).join('-')
    const cands = fixtureIndex.get(key)
    if (!cands || !cands.length) return null
    let best = cands[0]
    if (cands.length > 1 && m.match_date) {
      const t = new Date(m.match_date).getTime()
      best = cands.reduce((a, b) =>
        Math.abs((b.date ?? 0) - t) < Math.abs((a.date ?? 0) - t) ? b : a)
    }
    // ¿la API lista el cruce con orientación invertida respecto a la nuestra?
    const swapped = best.homeOurId === m.away_team_id && best.awayOurId === m.home_team_id
    return { fixtureId: best.fixtureId, swapped }
  }

  const rows = []
  const unresolved = []
  const summary = []

  for (const m of targetMatches) {
    const r = resolveFixture(m)
    if (!r) { unresolved.push(m.id); continue }

    let events
    try {
      const evRes = await apiFetch(`/fixtures/events?fixture=${r.fixtureId}`)
      events = evRes.response || []
    } catch (e) {
      console.warn(`   ⚠️ match ${m.id} fixture ${r.fixtureId}: ${e.message}`)
      unresolved.push(m.id)
      await sleep(200)
      continue
    }

    // Excluye la tanda de penaltis (comments='Penalty Shootout') y los penaltis fallados.
    const goals = events.filter(e => e.type === 'Goal'
      && !/missed penalty/i.test(e.detail || '')
      && (e.comments || '') !== 'Penalty Shootout')
    let cH = 0, cA = 0
    for (const ev of goals) {
      // API-Football acredita `event.team` al equipo BENEFICIARIO del gol (incluidos
      // los autogoles). Por tanto ese equipo es al que SUMA el gol directamente.
      const countsForOur = ourTeamByApiId[ev.team?.id] ?? null
      const { detail, isPenalty, isOwn } = classifyGoal(ev)
      // Equipo del jugador que ejecuta: en autogol es el rival del acreditado.
      const scorerOur = (isOwn && countsForOur != null)
        ? (countsForOur === m.home_team_id ? m.away_team_id : m.home_team_id)
        : countsForOur
      const side = countsForOur === m.home_team_id ? 'home'
                 : countsForOur === m.away_team_id ? 'away' : null
      if (side === 'home') cH++; else if (side === 'away') cA++
      rows.push({
        match_id: m.id,
        api_fixture_id: r.fixtureId,
        scorer_team_id: scorerOur,
        counts_for_team_id: countsForOur,
        side,
        player_name: ev.player?.name ?? null,
        assist_name: ev.assist?.name ?? null,
        minute: ev.time?.elapsed ?? null,
        minute_extra: ev.time?.extra ?? null,
        detail,
        is_penalty: isPenalty,
        is_own_goal: isOwn
      })
    }
    // Sanity: goles reconstruidos vs marcador guardado.
    const ok = cH === (m.home_score ?? -1) && cA === (m.away_score ?? -1)
    summary.push({ match_id: m.id, fixtureId: r.fixtureId, swapped: r.swapped, goals: goals.length, reconstructed: `${cH}-${cA}`, stored: `${m.home_score}-${m.away_score}`, match: ok })
    await sleep(150) // suave con la API
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify({ rows, summary, unresolved }, null, 2))
  const mismatches = summary.filter(s => !s.match)
  console.log(`\n✅ ${rows.length} goles extraídos de ${summary.length} partidos.`)
  console.log(`   Escrito en ${OUT_PATH}`)
  if (unresolved.length) console.log(`   ⚠️ Sin fixture resuelto: matches [${unresolved.join(', ')}]`)
  if (mismatches.length) {
    console.log(`   ⚠️ ${mismatches.length} partidos con marcador reconstruido != guardado (revisar autogoles/penaltis):`)
    for (const s of mismatches) console.log(`       match ${s.match_id}: recon ${s.reconstructed} vs guardado ${s.stored}`)
  } else {
    console.log('   ✔ Todos los marcadores reconstruidos coinciden con los guardados.')
  }
}

main().catch(e => { console.error('❌', e); process.exit(1) })
