/**
 * Simulate match results for testing
 *
 * Sets the first N group matches as "finished" with random scores.
 * This triggers the calculate_match_points trigger, updating the leaderboard.
 *
 * Usage:
 *   SUPABASE_URL=xxx SUPABASE_KEY=xxx node scripts/simulate-matches.js [count]
 *   Default: 12 matches (first day of groups, 2 per group A-F)
 *
 *   --reset  Revert all simulated matches to pending (NULL scores)
 */

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing env vars.')
  process.exit(1)
}

async function supaFetch(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  })
  if (!res.ok) return null
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

async function updateMatch(matchId, homeScore, awayScore, status) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/matches?id=eq.${matchId}`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({
      home_score: homeScore,
      away_score: awayScore,
      status
    })
  })
  return res.ok
}

function randScore() {
  const weights = [25, 30, 25, 12, 5, 3]
  const r = Math.random() * 100
  let c = 0
  for (let i = 0; i < weights.length; i++) {
    c += weights[i]
    if (r < c) return i
  }
  return 1
}

async function reset() {
  console.log('🔄 Resetting all matches to pending...\n')

  const matches = await supaFetch(
    'matches?stage=eq.group&status=eq.finished&select=id,home_team:teams!matches_home_team_id_fkey(name),away_team:teams!matches_away_team_id_fkey(name)&order=match_date'
  )

  if (!matches || matches.length === 0) {
    console.log('No finished matches to reset.')
    return
  }

  for (const m of matches) {
    const ok = await updateMatch(m.id, null, null, 'scheduled')
    console.log(`  ${ok ? '✅' : '❌'} ${m.home_team?.name} vs ${m.away_team?.name} → reset`)
  }

  console.log(`\n✅ Reset ${matches.length} matches to scheduled`)
}

async function simulate() {
  const count = parseInt(process.argv.find(a => /^\d+$/.test(a)) || '12')

  console.log(`⚽ Simulating ${count} match results...\n`)

  // Get first N scheduled group matches
  const matches = await supaFetch(
    `matches?stage=eq.group&status=eq.scheduled&select=id,match_date,group_name,home_team:teams!matches_home_team_id_fkey(name),away_team:teams!matches_away_team_id_fkey(name)&order=match_date&limit=${count}`
  )

  if (!matches || matches.length === 0) {
    console.log('No scheduled matches found to simulate.')
    return
  }

  for (const m of matches) {
    const hs = randScore()
    const as = randScore()
    const ok = await updateMatch(m.id, hs, as, 'finished')
    console.log(`  ${ok ? '✅' : '❌'} ${m.home_team?.name} ${hs}-${as} ${m.away_team?.name} (Group ${m.group_name})`)
  }

  console.log(`\n🎉 Simulated ${matches.length} matches! Points should now be calculated.`)
}

const isReset = process.argv.includes('--reset')
;(isReset ? reset() : simulate()).catch(err => { console.error(err); process.exit(1) })
