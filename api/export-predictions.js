/**
 * GET /api/export-predictions?tipo=pre|elim
 * Genera un Excel (.xlsx) con las predicciones de TODOS los participantes, como
 * backup/transparencia. Se construye al vuelo desde la BD (siempre actualizado).
 *
 *  - tipo=pre  → hojas: Grupos · Cuadro ciego · Especiales (predicciones de antes del Mundial)
 *  - tipo=elim → una hoja por ronda eliminatoria YA CERRADA (Dieciseisavos, Octavos, …)
 *                filas = participantes, columnas = partidos, celda = resultado
 *                (con quién pasa entre paréntesis si pusieron empate; NP si no rellenaron).
 *
 * Solo se incluyen rondas cuyo primer partido ya ha empezado (nunca expone una
 * ronda cuyo plazo sigue abierto). Requiere sesión (cualquier participante).
 */
import * as XLSX from 'xlsx'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const BOT365 = 'b0365b03-65b0-365b-0365-b0365b036500'

const STAGE_LABEL = {
  'Round of 32': 'Dieciseisavos', 'Round of 16': 'Octavos',
  'Quarter-finals': 'Cuartos', 'Semi-finals': 'Semifinales',
  'Third place': '3er puesto', 'Final': 'Final',
}
const STAGE_ORDER = ['Round of 32', 'Round of 16', 'Quarter-finals', 'Semi-finals', 'Final']  // sin 3er puesto (no cuenta en la porra)

// Pagina con Range para sortear el tope de filas de PostgREST (~1000). Devuelve
// TODAS las filas (importante: hay ~8600 predicciones de grupo).
async function supaFetch(path) {
  const size = 1000
  let from = 0
  const rows = []
  while (true) {
    const res = await fetch(`${SUPABASE_URL}${path}`, {
      headers: {
        apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
        'Range-Unit': 'items', Range: `${from}-${from + size - 1}`,
      },
    })
    if (!res.ok && res.status !== 206) return rows.length ? rows : null
    const t = await res.text()
    const chunk = t ? JSON.parse(t) : []
    rows.push(...chunk)
    if (chunk.length < size) break
    from += size
  }
  return rows
}

// Valida el JWT del usuario: cualquier participante autenticado puede descargar.
async function authUser(req) {
  const auth = req.headers.authorization
  if (!auth) return null
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_KEY, Authorization: auth },
  })
  if (!res.ok) return null
  const u = await res.json()
  return u?.id || null
}

function cellScore(p) {
  if (!p || p.predicted_home == null || p.predicted_away == null) return 'NP'
  return `${p.predicted_home}-${p.predicted_away}`
}

export default async function handler(req, res) {
  if (!(await authUser(req))) return res.status(401).json({ error: 'Unauthorized' })
  const tipo = req.query?.tipo === 'pre' ? 'pre' : 'elim'

  const [teamsRaw, partsRaw] = await Promise.all([
    supaFetch('/rest/v1/teams?select=id,name'),
    supaFetch(`/rest/v1/profiles?select=id,full_name&has_paid=eq.true&id=neq.${BOT365}&order=full_name`),
  ])
  if (!teamsRaw || !partsRaw) return res.status(500).json({ error: 'No se pudieron leer los datos' })
  const teamName = Object.fromEntries(teamsRaw.map(t => [t.id, t.name]))
  const parts = partsRaw // {id, full_name}

  const wb = XLSX.utils.book_new()

  const addSheet = (name, header, rows) => {
    const aoa = [header, ...rows]
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws['!cols'] = header.map((h, i) => ({ wch: i === 0 ? 26 : Math.max(10, Math.min(22, String(h).length + 2)) })) // ancho aprox
    ws['!freeze'] = { xSplit: 1, ySplit: 1 }
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31))
  }

  if (tipo === 'pre') {
    const [gm, gp, bp, bets, ents] = await Promise.all([
      supaFetch('/rest/v1/matches?select=id,match_number,group_name,home_team_id,away_team_id&stage=eq.group&order=match_number'),
      supaFetch('/rest/v1/predictions?select=user_id,match_id,predicted_home,predicted_away&match_id=lt.73'),
      supaFetch('/rest/v1/bracket_picks?select=user_id,round,match_number,predicted_winner_id'),
      supaFetch('/rest/v1/pre_tournament_bets?select=id,slug,name,input_type,sort_order&is_active=eq.true&order=sort_order'),
      supaFetch('/rest/v1/pre_tournament_entries?select=user_id,bet_id,value'),
    ])
    // --- Grupos ---
    const gmIds = new Set((gm || []).map(m => m.id))
    const gpMap = {}
    ;(gp || []).forEach(p => { if (gmIds.has(p.match_id)) gpMap[`${p.user_id}|${p.match_id}`] = cellScore(p) })
    const gHeader = ['Participante', ...(gm || []).map(m => `G${m.group_name} · ${teamName[m.home_team_id]}-${teamName[m.away_team_id]}`)]
    const gRows = parts.map(u => ['' + u.full_name, ...(gm || []).map(m => gpMap[`${u.id}|${m.id}`] || 'NP')])
    addSheet('Grupos', gHeader, gRows)

    // --- Cuadro ciego ---
    const rOrder = { r32: 0, r16: 1, qf: 2, sf: 3, final: 4 }
    const rLabel = { r32: '16avos', r16: 'Octavos', qf: 'Cuartos', sf: 'Semis', final: 'Final' }
    const slots = [...new Map((bp || []).map(x => [`${x.round}|${x.match_number}`, x])).values()]
      .sort((a, b) => (rOrder[a.round] ?? 9) - (rOrder[b.round] ?? 9) || a.match_number - b.match_number)
    const bpMap = {}
    ;(bp || []).forEach(x => { bpMap[`${x.user_id}|${x.round}|${x.match_number}`] = x.predicted_winner_id ? (teamName[x.predicted_winner_id] || '') : '' })
    const cHeader = ['Participante', ...slots.map(s => `${rLabel[s.round] || s.round} #${s.match_number}`)]
    const cRows = parts.map(u => ['' + u.full_name, ...slots.map(s => bpMap[`${u.id}|${s.round}|${s.match_number}`] || '')])
    addSheet('Cuadro ciego', cHeader, cRows)

    // --- Especiales ---
    const readable = (value) => {
      const v = (value && typeof value === 'object') ? value : {}
      if (v.team_id != null) return teamName[v.team_id] || String(v.team_id)
      if (v.player_name) return v.player_name
      if (v.answer != null) return ({ yes: 'Sí', no: 'No' })[String(v.answer).toLowerCase()] || String(v.answer)
      return ''
    }
    const eMap = {}
    ;(ents || []).forEach(e => { eMap[`${e.user_id}|${e.bet_id}`] = readable(e.value) })
    const eHeader = ['Participante', ...(bets || []).map(b => b.name)]
    const eRows = parts.map(u => ['' + u.full_name, ...(bets || []).map(b => eMap[`${u.id}|${b.id}`] || '')])
    addSheet('Especiales', eHeader, eRows)
  } else {
    const [km, kp] = await Promise.all([
      supaFetch('/rest/v1/matches?select=id,match_number,stage,status,match_date,home_team_id,away_team_id&match_number=gte.73&order=match_number'),
      supaFetch('/rest/v1/predictions?select=user_id,match_id,predicted_home,predicted_away,predicted_advancer_id&match_id=gte.73'),
    ])
    const now = Date.now()
    const predMap = {}
    ;(kp || []).forEach(p => { predMap[`${p.user_id}|${p.match_id}`] = p })
    const cellKO = (u, m) => {
      const p = predMap[`${u.id}|${m.id}`]
      if (!p || p.predicted_home == null || p.predicted_away == null) return 'NP'
      let s = `${p.predicted_home}-${p.predicted_away}`
      if (p.predicted_home === p.predicted_away) s += ` (${teamName[p.predicted_advancer_id] || '?'})`
      return s
    }
    let added = 0
    for (const stage of STAGE_ORDER) {
      const ms = (km || []).filter(m => m.stage === stage && m.match_date)
        .sort((a, b) => a.match_number - b.match_number)
      if (!ms.length) continue
      // Solo rondas cuyo primer partido ya empezó (plazo cerrado con seguridad).
      const firstKickoff = Math.min(...ms.map(m => new Date(m.match_date).getTime()))
      if (now < firstKickoff) continue
      const header = ['Participante', ...ms.map(m => `${teamName[m.home_team_id]}-${teamName[m.away_team_id]}`)]
      const rows = parts.map(u => ['' + u.full_name, ...ms.map(m => cellKO(u, m))])
      addSheet(STAGE_LABEL[stage] || stage, header, rows)
      added++
    }
    if (!added) {
      const ws = XLSX.utils.aoa_to_sheet([['Aún no hay ninguna ronda eliminatoria cerrada.']])
      XLSX.utils.book_append_sheet(wb, ws, 'Info')
    }
  }

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const fname = tipo === 'pre' ? 'porra_predicciones_pre_mundial.xlsx' : 'porra_predicciones_eliminatorias.xlsx'
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="${fname}"`)
  res.setHeader('Cache-Control', 'no-store')
  return res.send(buf)
}
