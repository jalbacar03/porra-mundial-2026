/**
 * Export ALL participants' predictions to JSON + CSV — pre-tournament snapshot.
 *
 * Why: once the deadline passes you want a frozen, off-database copy of what
 * everyone predicted, in case of a dispute, accidental data loss, or a bad
 * migration. Run it right after the deadline (9 jun) and keep the files safe.
 *
 * Reads with the SERVICE key (bypasses RLS) so it sees every user's rows.
 * Never commit the service key — pass it inline:
 *
 *   SUPABASE_URL=https://jmiiskacwgynxaroeele.supabase.co \
 *   SUPABASE_SERVICE_KEY=eyJ... \
 *   node scripts/export-predictions.js
 *
 * Options:
 *   --include-bot365   Also export the Bot365 reference line (default: skip)
 *
 * Output (gitignored):
 *   exports/predicciones-<YYYY-MM-DD-HHmm>.json   full nested snapshot
 *   exports/predicciones-<YYYY-MM-DD-HHmm>.csv    one row per prediction
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const INCLUDE_BOT365 = process.argv.includes('--include-bot365')
const BOT365_ID = 'b0365b03-65b0-365b-0365-b0365b036500'

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing env vars. Need SUPABASE_URL and SUPABASE_SERVICE_KEY.')
  console.error('See the header of this file for usage.')
  process.exit(1)
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '..', 'exports')

async function sb(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  })
  if (!res.ok) {
    throw new Error(`Supabase ${path} → ${res.status} ${await res.text()}`)
  }
  return res.json()
}

function csvCell(v) {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

async function main() {
  console.log('Fetching data…')

  const [profiles, matches, teams, bets, predictions, bracketPicks, preEntries] =
    await Promise.all([
      sb('profiles?select=id,full_name,nickname,has_paid,is_admin'),
      sb('matches?select=id,stage,group_name,match_date,home_team_id,away_team_id,home_score,away_score&order=match_date'),
      sb('teams?select=id,name'),
      sb('pre_tournament_bets?select=id,slug,name'),
      sb('predictions?select=user_id,match_id,predicted_home,predicted_away,points_earned'),
      sb('bracket_picks?select=user_id,match_number,round,predicted_winner_id'),
      sb('pre_tournament_entries?select=user_id,bet_id,value,points_awarded,is_resolved'),
    ])

  const teamName = Object.fromEntries(teams.map(t => [t.id, t.name]))
  const matchById = Object.fromEntries(matches.map(m => [m.id, m]))
  const betById = Object.fromEntries(bets.map(b => [b.id, b]))

  const users = profiles
    .filter(p => INCLUDE_BOT365 || p.id !== BOT365_ID)
    .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''))

  const matchLabel = (m) =>
    m ? `${teamName[m.home_team_id] || '?'} vs ${teamName[m.away_team_id] || '?'}` : '?'

  // ---- Nested JSON snapshot ----
  const snapshot = {
    generated_at: new Date().toISOString(),
    counts: {
      users: users.length,
      predictions: predictions.length,
      bracket_picks: bracketPicks.length,
      pre_tournament_entries: preEntries.length,
    },
    users: users.map(u => ({
      id: u.id,
      full_name: u.full_name,
      nickname: u.nickname,
      has_paid: u.has_paid,
      is_admin: u.is_admin,
      match_predictions: predictions
        .filter(p => p.user_id === u.id)
        .map(p => ({
          match_id: p.match_id,
          match: matchLabel(matchById[p.match_id]),
          group: matchById[p.match_id]?.group_name || null,
          stage: matchById[p.match_id]?.stage || null,
          predicted: `${p.predicted_home}-${p.predicted_away}`,
          points_earned: p.points_earned,
        })),
      bracket_picks: bracketPicks
        .filter(b => b.user_id === u.id)
        .map(b => ({
          match_number: b.match_number,
          round: b.round,
          predicted_winner: teamName[b.predicted_winner_id] || b.predicted_winner_id,
        })),
      pre_tournament: preEntries
        .filter(e => e.user_id === u.id)
        .map(e => ({
          bet: betById[e.bet_id]?.name || e.bet_id,
          slug: betById[e.bet_id]?.slug || null,
          value: e.value,
          points_awarded: e.points_awarded,
          is_resolved: e.is_resolved,
        })),
    })),
  }

  // ---- Flat CSV (one row per prediction of any kind) ----
  const rows = [['participante', 'nickname', 'tipo', 'detalle', 'prediccion', 'puntos']]
  for (const u of users) {
    const name = u.full_name || ''
    const nick = u.nickname || ''
    for (const p of predictions.filter(p => p.user_id === u.id)) {
      const m = matchById[p.match_id]
      rows.push([name, nick, 'partido', `${matchLabel(m)}${m?.group_name ? ` (Grupo ${m.group_name})` : ''}`, `${p.predicted_home}-${p.predicted_away}`, p.points_earned ?? 0])
    }
    for (const b of bracketPicks.filter(b => b.user_id === u.id)) {
      rows.push([name, nick, 'bracket', `${b.round} #${b.match_number}`, teamName[b.predicted_winner_id] || b.predicted_winner_id, ''])
    }
    for (const e of preEntries.filter(e => e.user_id === u.id)) {
      // value is jsonb: {team_id}, {player_name}, {answer:'yes'}, {text}, etc.
      // Flatten to a human-readable string for the CSV column.
      const v = e.value
      const readable = v == null ? ''
        : (v.player_name ?? v.team_name ?? v.answer ?? v.text ?? v.group ?? JSON.stringify(v))
      rows.push([name, nick, 'pre-torneo', betById[e.bet_id]?.name || e.bet_id, readable, e.points_awarded ?? 0])
    }
  }

  mkdirSync(OUT_DIR, { recursive: true })
  const stamp = new Date().toISOString().slice(0, 16).replace('T', '-').replace(':', '')
  const jsonPath = join(OUT_DIR, `predicciones-${stamp}.json`)
  const csvPath = join(OUT_DIR, `predicciones-${stamp}.csv`)

  writeFileSync(jsonPath, JSON.stringify(snapshot, null, 2), 'utf8')
  writeFileSync(csvPath, rows.map(r => r.map(csvCell).join(',')).join('\n'), 'utf8')

  console.log(`\n✓ Exported ${users.length} users`)
  console.log(`  ${snapshot.counts.predictions} match predictions`)
  console.log(`  ${snapshot.counts.bracket_picks} bracket picks`)
  console.log(`  ${snapshot.counts.pre_tournament_entries} pre-tournament entries`)
  console.log(`\nFiles:`)
  console.log(`  ${jsonPath}`)
  console.log(`  ${csvPath}`)
}

main().catch(err => {
  console.error('Export failed:', err.message)
  process.exit(1)
})
