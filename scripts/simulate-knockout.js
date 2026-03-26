/**
 * Create and simulate knockout matches (R32 → R16 → QF → SF → Final)
 *
 * Uses actual group results to determine qualified teams,
 * then creates knockout matches and simulates results up to (but not including) the final.
 *
 * Usage:
 *   SUPABASE_URL=xxx SUPABASE_KEY=xxx node scripts/simulate-knockout.js
 *   --reset   Delete all knockout matches
 *   --all     Include the final (default: stop before final)
 */

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing env vars.')
  process.exit(1)
}

async function supaFetch(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
  })
  if (!res.ok) return null
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

async function supaInsert(table, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json', 'Prefer': 'return=representation'
    },
    body: JSON.stringify(data)
  })
  if (!res.ok) { console.error(`Insert error: ${await res.text()}`); return null }
  return res.json()
}

async function supaDelete(table, filter) {
  return fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: 'DELETE',
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Prefer': 'return=minimal' }
  })
}

function randScore() {
  const w = [20, 30, 25, 15, 7, 3]
  const r = Math.random() * 100
  let c = 0
  for (let i = 0; i < w.length; i++) { c += w[i]; if (r < c) return i }
  return 1
}

// Calculate group standings from actual match results
function calculateStandings(matches, teams) {
  const groups = {}
  const teamMap = {}
  teams.forEach(t => { teamMap[t.id] = t })

  matches.forEach(m => {
    if (m.stage !== 'group' || m.status !== 'finished') return
    const g = m.group_name
    if (!groups[g]) groups[g] = {}

    ;[m.home_team_id, m.away_team_id].forEach(tid => {
      if (!groups[g][tid]) groups[g][tid] = { id: tid, name: teamMap[tid]?.name || '?', pts: 0, gf: 0, ga: 0, gd: 0, w: 0, d: 0, l: 0, played: 0 }
    })

    const h = groups[g][m.home_team_id]
    const a = groups[g][m.away_team_id]
    h.gf += m.home_score; h.ga += m.away_score; h.played++
    a.gf += m.away_score; a.ga += m.home_score; a.played++

    if (m.home_score > m.away_score) { h.pts += 3; h.w++; a.l++ }
    else if (m.home_score === m.away_score) { h.pts += 1; a.pts += 1; h.d++; a.d++ }
    else { a.pts += 3; a.w++; h.l++ }

    h.gd = h.gf - h.ga
    a.gd = a.gf - a.ga
  })

  // Sort each group
  const sorted = {}
  Object.keys(groups).sort().forEach(g => {
    sorted[g] = Object.values(groups[g]).sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf)
  })
  return sorted
}

async function reset() {
  console.log('🔄 Removing knockout matches...')
  await supaDelete('matches', 'stage=neq.group')
  console.log('✅ Done')
}

async function simulate() {
  const includeAll = process.argv.includes('--all')

  console.log('🏆 Creating and simulating knockout matches...\n')

  // Get all data
  const matches = await supaFetch('matches?select=*&order=match_date')
  const teams = await supaFetch('teams?select=id,name')

  if (!matches || !teams) { console.error('Failed to fetch data'); return }

  // Calculate group standings
  const standings = calculateStandings(matches, teams)
  console.log('📊 Group standings calculated\n')

  // Get qualified teams
  const qualified = {} // matchNumber → { home: teamId, away: teamId }

  // Helper to get team by position in group
  const getTeam = (group, pos) => standings[group]?.[pos]?.id

  // All 3rd place teams sorted
  const thirds = Object.keys(standings).map(g => ({
    ...standings[g][2],
    group: g
  })).sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf)

  const best8thirds = thirds.slice(0, 8)
  console.log('Best 8 thirds:', best8thirds.map(t => `${t.name} (${t.group})`).join(', '))

  // Assign thirds to R32 slots using greedy matching
  // Simplified version of thirdPlaceAssignment.js
  const thirdSlots = [
    { match: 74, groups: ['A','B','C','D','F'] },
    { match: 77, groups: ['C','D','F','G','H'] },
    { match: 79, groups: ['C','E','F','H','I'] },
    { match: 80, groups: ['E','H','I','J','K'] },
    { match: 81, groups: ['B','E','F','I','J'] },
    { match: 82, groups: ['A','E','H','I','J'] },
    { match: 85, groups: ['E','F','G','I','J'] },
    { match: 87, groups: ['D','E','I','J','L'] }
  ]

  const usedThirds = new Set()
  const thirdAssignment = {}

  for (const slot of thirdSlots) {
    const candidate = best8thirds.find(t => slot.groups.includes(t.group) && !usedThirds.has(t.group))
    if (candidate) {
      thirdAssignment[slot.match] = candidate.id
      usedThirds.add(candidate.group)
    }
  }
  // Fill remaining with unassigned thirds
  for (const slot of thirdSlots) {
    if (!thirdAssignment[slot.match]) {
      const remaining = best8thirds.find(t => !usedThirds.has(t.group))
      if (remaining) {
        thirdAssignment[slot.match] = remaining.id
        usedThirds.add(remaining.group)
      }
    }
  }

  // R32 matchups (match numbers 73-88)
  const r32 = [
    { mn: 73, home: getTeam('A', 1), away: getTeam('B', 1) },
    { mn: 74, home: getTeam('E', 0), away: thirdAssignment[74] },
    { mn: 75, home: getTeam('F', 0), away: getTeam('C', 1) },
    { mn: 76, home: getTeam('C', 0), away: getTeam('F', 1) },
    { mn: 77, home: getTeam('I', 0), away: thirdAssignment[77] },
    { mn: 78, home: getTeam('E', 1), away: getTeam('I', 1) },
    { mn: 79, home: getTeam('A', 0), away: thirdAssignment[79] },
    { mn: 80, home: getTeam('L', 0), away: thirdAssignment[80] },
    { mn: 81, home: getTeam('D', 0), away: thirdAssignment[81] },
    { mn: 82, home: getTeam('G', 0), away: thirdAssignment[82] },
    { mn: 83, home: getTeam('K', 1), away: getTeam('L', 1) },
    { mn: 84, home: getTeam('H', 0), away: getTeam('J', 1) },
    { mn: 85, home: getTeam('B', 0), away: thirdAssignment[85] },
    { mn: 86, home: getTeam('J', 0), away: getTeam('H', 1) },
    { mn: 87, home: getTeam('K', 0), away: thirdAssignment[87] },
    { mn: 88, home: getTeam('D', 1), away: getTeam('G', 1) }
  ]

  // R16 bracket (winners of R32)
  const r16Bracket = [
    { mn: 89, homeFrom: 74, awayFrom: 77 },
    { mn: 90, homeFrom: 73, awayFrom: 75 },
    { mn: 91, homeFrom: 76, awayFrom: 78 },
    { mn: 92, homeFrom: 79, awayFrom: 80 },
    { mn: 93, homeFrom: 83, awayFrom: 84 },
    { mn: 94, homeFrom: 81, awayFrom: 82 },
    { mn: 95, homeFrom: 86, awayFrom: 88 },
    { mn: 96, homeFrom: 85, awayFrom: 87 }
  ]

  const qfBracket = [
    { mn: 97, homeFrom: 89, awayFrom: 90 },
    { mn: 98, homeFrom: 93, awayFrom: 94 },
    { mn: 99, homeFrom: 91, awayFrom: 92 },
    { mn: 100, homeFrom: 95, awayFrom: 96 }
  ]

  const sfBracket = [
    { mn: 101, homeFrom: 97, awayFrom: 98 },
    { mn: 102, homeFrom: 99, awayFrom: 100 }
  ]

  const finalBracket = [
    { mn: 104, homeFrom: 101, awayFrom: 102 }
  ]

  const teamMap = {}
  teams.forEach(t => { teamMap[t.id] = t.name })

  // Simulate a knockout match (no draws allowed — if draw, away team wins on penalties)
  function simKnockout() {
    let h = randScore(), a = randScore()
    if (h === a) a = h + 1 // no draws in knockout
    return { home: h, away: a }
  }

  const results = {} // matchNumber → { homeId, awayId, homeScore, awayScore, winnerId }
  const baseDate = new Date('2026-06-30T17:00:00Z')

  // Process R32
  console.log('\n--- Dieciseisavos (R32) ---')
  for (const m of r32) {
    const score = simKnockout()
    const winner = score.home > score.away ? m.home : m.away
    results[m.mn] = { homeId: m.home, awayId: m.away, ...score, winnerId: winner }
    console.log(`  M${m.mn}: ${teamMap[m.home]} ${score.home}-${score.away} ${teamMap[m.away]} → ${teamMap[winner]}`)
  }

  // Process R16
  console.log('\n--- Octavos (R16) ---')
  for (const m of r16Bracket) {
    const home = results[m.homeFrom].winnerId
    const away = results[m.awayFrom].winnerId
    const score = simKnockout()
    const winner = score.home > score.away ? home : away
    results[m.mn] = { homeId: home, awayId: away, ...score, winnerId: winner }
    console.log(`  M${m.mn}: ${teamMap[home]} ${score.home}-${score.away} ${teamMap[away]} → ${teamMap[winner]}`)
  }

  // Process QF
  console.log('\n--- Cuartos ---')
  for (const m of qfBracket) {
    const home = results[m.homeFrom].winnerId
    const away = results[m.awayFrom].winnerId
    const score = simKnockout()
    const winner = score.home > score.away ? home : away
    results[m.mn] = { homeId: home, awayId: away, ...score, winnerId: winner }
    console.log(`  M${m.mn}: ${teamMap[home]} ${score.home}-${score.away} ${teamMap[away]} → ${teamMap[winner]}`)
  }

  // Process SF
  console.log('\n--- Semifinales ---')
  for (const m of sfBracket) {
    const home = results[m.homeFrom].winnerId
    const away = results[m.awayFrom].winnerId
    const score = simKnockout()
    const winner = score.home > score.away ? home : away
    results[m.mn] = { homeId: home, awayId: away, ...score, winnerId: winner }
    console.log(`  M${m.mn}: ${teamMap[home]} ${score.home}-${score.away} ${teamMap[away]} → ${teamMap[winner]}`)
  }

  // Final
  if (includeAll) {
    console.log('\n--- FINAL ---')
    for (const m of finalBracket) {
      const home = results[m.homeFrom].winnerId
      const away = results[m.awayFrom].winnerId
      const score = simKnockout()
      const winner = score.home > score.away ? home : away
      results[m.mn] = { homeId: home, awayId: away, ...score, winnerId: winner }
      console.log(`  M${m.mn}: ${teamMap[home]} ${score.home}-${score.away} ${teamMap[away]} → 🏆 ${teamMap[winner]}`)
    }
  } else {
    // Create final match but don't simulate
    const m = finalBracket[0]
    const home = results[m.homeFrom].winnerId
    const away = results[m.awayFrom].winnerId
    results[m.mn] = { homeId: home, awayId: away, home: null, away: null, winnerId: null }
    console.log(`\n--- FINAL (pendiente) ---`)
    console.log(`  M${m.mn}: ${teamMap[home]} vs ${teamMap[away]}`)
  }

  // Insert all knockout matches into DB
  console.log('\n📝 Inserting matches into database...')

  // First delete existing knockout matches
  await supaDelete('matches', 'stage=neq.group')

  const stageMap = {
    73: 'r32', 74: 'r32', 75: 'r32', 76: 'r32', 77: 'r32', 78: 'r32', 79: 'r32', 80: 'r32',
    81: 'r32', 82: 'r32', 83: 'r32', 84: 'r32', 85: 'r32', 86: 'r32', 87: 'r32', 88: 'r32',
    89: 'r16', 90: 'r16', 91: 'r16', 92: 'r16', 93: 'r16', 94: 'r16', 95: 'r16', 96: 'r16',
    97: 'quarter_final', 98: 'quarter_final', 99: 'quarter_final', 100: 'quarter_final',
    101: 'semi_final', 102: 'semi_final',
    104: 'final'
  }

  let dayOffset = 0
  const matchRows = Object.entries(results).map(([mn, r]) => {
    const matchNum = parseInt(mn)
    const stage = stageMap[matchNum]
    const isFinished = r.home !== null
    dayOffset++
    return {
      id: matchNum,
      home_team_id: r.homeId,
      away_team_id: r.awayId,
      home_score: isFinished ? r.home : null,
      away_score: isFinished ? r.away : null,
      stage,
      status: isFinished ? 'finished' : 'scheduled',
      match_date: new Date(baseDate.getTime() + dayOffset * 86400000 * 0.5).toISOString(),
      group_name: null
    }
  })

  const inserted = await supaInsert('matches', matchRows)
  if (inserted) {
    console.log(`✅ Inserted ${inserted.length} knockout matches`)
  }

  console.log('\n🎉 Knockout simulation complete!')
}

const isReset = process.argv.includes('--reset')
;(isReset ? reset() : simulate()).catch(err => { console.error(err); process.exit(1) })
