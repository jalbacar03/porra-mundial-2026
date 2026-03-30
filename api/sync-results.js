/**
 * Vercel Serverless Function — Sync match results from API-Football
 *
 * GET /api/sync-results → Fetches live/finished matches and updates Supabase
 * Also resolves: bracket picks, pre-tournament bets (goleador, etc.)
 *
 * Called by Vercel Cron every 2 hours during the World Cup, or manually from Admin.
 * API-Football free tier: 100 requests/day
 */

const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

const BOT365_ID = 'b0365b03-65b0-365b-0365-b0365b036500'

// 2026 World Cup league ID in API-Football
const WORLD_CUP_ID = 1
const WORLD_CUP_SEASON = 2026

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (!API_FOOTBALL_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Missing env vars' })
  }

  try {
    const log = []

    // 1. Fetch finished matches from API-Football
    log.push('📡 Fetching matches from API-Football...')
    const matchesResponse = await apiFetch(`/fixtures?league=${WORLD_CUP_ID}&season=${WORLD_CUP_SEASON}`)
    const apiMatches = matchesResponse.response || []

    const finished = apiMatches.filter(m =>
      m.fixture.status.short === 'FT' ||
      m.fixture.status.short === 'AET' ||
      m.fixture.status.short === 'PEN'
    )
    log.push(`   Found ${finished.length} finished matches`)

    // 2. Get our matches from Supabase
    const ourMatches = await supaFetch('/rest/v1/matches?select=*&order=id')
    const ourTeams = await supaFetch('/rest/v1/teams?select=id,name,api_football_id')

    // Build team lookup: api_football_id → our_team_id
    const teamByApiId = {}
    ourTeams.forEach(t => {
      if (t.api_football_id) teamByApiId[t.api_football_id] = t.id
    })

    // 3. Update match scores
    let updatedCount = 0
    for (const apiMatch of finished) {
      const homeApiId = apiMatch.teams.home.id
      const awayApiId = apiMatch.teams.away.id
      const homeScore = apiMatch.goals.home
      const awayScore = apiMatch.goals.away

      // Find matching match in our DB
      const homeTeamId = teamByApiId[homeApiId]
      const awayTeamId = teamByApiId[awayApiId]

      if (!homeTeamId || !awayTeamId) continue

      const ourMatch = ourMatches.find(m =>
        m.home_team_id === homeTeamId && m.away_team_id === awayTeamId &&
        m.home_score === null // Only update if not already set
      )

      if (ourMatch) {
        await supaFetch(`/rest/v1/matches?id=eq.${ourMatch.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            home_score: homeScore,
            away_score: awayScore,
            status: 'finished'
          })
        })
        updatedCount++
        log.push(`   ✅ Match ${ourMatch.id}: ${homeScore}-${awayScore}`)
      }
    }
    log.push(`📊 Updated ${updatedCount} match scores`)

    // 3b. Sync playoff/repechaje teams — update placeholder teams with real ones
    log.push('🔄 Checking playoff teams...')
    const playoffUpdated = await syncPlayoffTeams(apiMatches, ourTeams, log)
    log.push(`   Updated ${playoffUpdated} playoff teams`)

    // 4. Fetch top scorers
    log.push('⚽ Fetching top scorers...')
    const scorersRes = await apiFetch(`/players/topscorers?league=${WORLD_CUP_ID}&season=${WORLD_CUP_SEASON}`)
    const topScorers = scorersRes.response || []

    // 5. Fetch top assists
    log.push('🅰️ Fetching top assists...')
    const assistsRes = await apiFetch(`/players/topassists?league=${WORLD_CUP_ID}&season=${WORLD_CUP_SEASON}`)
    const topAssists = assistsRes.response || []

    // 6. Resolve pre-tournament bets that can be auto-resolved
    log.push('🎯 Resolving pre-tournament bets...')
    const resolvedBets = await resolvePreTournamentBets(
      apiMatches, topScorers, topAssists, ourMatches, ourTeams, teamByApiId, log
    )
    log.push(`   Resolved ${resolvedBets} bets`)

    // 7. Sync knockout match teams from API-Football
    log.push('🏆 Syncing knockout match teams...')
    const knockoutSynced = await syncKnockoutTeams(apiMatches, ourMatches, ourTeams, teamByApiId, log)
    log.push(`   Updated ${knockoutSynced} knockout match teams`)

    // 8. Auto-resolve órdagos for finished matches
    log.push('🎲 Checking órdagos...')
    const ordagosResolved = await resolveFinishedOrdagos(log)
    log.push(`   Resolved ${ordagosResolved} órdagos`)

    // 9. Summary
    const summary = {
      timestamp: new Date().toISOString(),
      matchesUpdated: updatedCount,
      totalFinished: finished.length,
      betsResolved: resolvedBets,
      knockoutTeamsSynced: knockoutSynced,
      ordagosResolved,
      log
    }

    return res.status(200).json(summary)
  } catch (err) {
    console.error('Sync error:', err)
    return res.status(500).json({ error: err.message })
  }
}

/**
 * Sync playoff/repechaje teams: match placeholder teams with real qualified teams
 * Looks at API-Football's team list for the World Cup and updates our placeholder teams
 */
async function syncPlayoffTeams(apiMatches, ourTeams, log) {
  let updated = 0

  // Placeholder team patterns to match
  const placeholders = ourTeams.filter(t =>
    t.name.startsWith('Ganador Playoff') ||
    t.name.startsWith('Ganador Repesca')
  )

  if (placeholders.length === 0) return 0

  // Fetch the full team list from API-Football for the World Cup
  const teamsRes = await apiFetch(`/teams?league=${WORLD_CUP_ID}&season=${WORLD_CUP_SEASON}`)
  const apiTeams = teamsRes.response || []

  if (apiTeams.length === 0) return 0

  // Get all API-Football IDs we already have mapped
  const mappedApiIds = new Set(ourTeams.filter(t => t.api_football_id).map(t => t.api_football_id))

  // Find API teams that are NOT yet mapped — these are likely the playoff winners
  const unmappedApiTeams = apiTeams.filter(t => !mappedApiIds.has(t.team.id))

  if (unmappedApiTeams.length === 0) {
    log.push('   No new teams found from API-Football')
    return 0
  }

  // For each placeholder, check if there's a group match in the API that contains
  // the placeholder's group but with a team we don't know yet
  for (const placeholder of placeholders) {
    // Find which group this placeholder is in
    const placeholderGroup = ourTeams.find(t => t.id === placeholder.id)
    if (!placeholderGroup) continue

    // Look for API matches where one team is unmapped and plays in this placeholder's group
    // Group matches have round like "Group A", "Group B", etc.
    const groupName = placeholder.group_name // might not exist in teams table directly

    // Alternative approach: check if any unmapped team appears in API group matches
    // alongside teams we DO know from the same group
    for (const unmapped of unmappedApiTeams) {
      // Check if this unmapped team plays against known teams from placeholder's group
      const teamGroupMatches = apiMatches.filter(m =>
        (m.teams.home.id === unmapped.team.id || m.teams.away.id === unmapped.team.id) &&
        m.league.round?.startsWith('Group')
      )

      if (teamGroupMatches.length === 0) continue

      // Get the group letter from the round (e.g., "Group A - 1" → "A")
      const roundStr = teamGroupMatches[0].league.round
      const groupMatch = roundStr.match(/Group\s+([A-L])/)
      if (!groupMatch) continue
      const groupLetter = groupMatch[1]

      // Check if our placeholder is in this group
      // We need to find matches that contain this placeholder team ID
      const ourGroupMatches = require ? null : null // can't require in serverless easily

      // Simpler: just match by checking if placeholder has matches in this group
      // Query matches for this placeholder's group
      const matchesInGroup = await supaFetch(
        `/rest/v1/matches?stage=eq.group&group_name=eq.${groupLetter}&or=(home_team_id.eq.${placeholder.id},away_team_id.eq.${placeholder.id})&limit=1`
      )

      if (matchesInGroup && matchesInGroup.length > 0) {
        // This unmapped team belongs to this placeholder's group — update the placeholder
        const apiTeam = unmapped.team
        log.push(`   🎉 Playoff resolved: "${placeholder.name}" → ${apiTeam.name} (API ID: ${apiTeam.id})`)

        await supaFetch(`/rest/v1/teams?id=eq.${placeholder.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: apiTeam.name,
            code: apiTeam.code || apiTeam.name.substring(0, 3).toUpperCase(),
            api_football_id: apiTeam.id,
            flag_url: apiTeam.logo || null
          })
        })
        updated++
        break // Move to next placeholder
      }
    }
  }

  return updated
}

/**
 * Resolve pre-tournament bets based on tournament data
 */
async function resolvePreTournamentBets(apiMatches, topScorers, topAssists, ourMatches, ourTeams, teamByApiId, log) {
  let resolved = 0

  // Get all bets and entries
  const bets = await supaFetch('/rest/v1/pre_tournament_bets?select=*')
  const entries = await supaFetch('/rest/v1/pre_tournament_entries?select=*&is_resolved=eq.false')

  // Get all finished group matches
  const finishedGroups = ourMatches.filter(m => m.stage === 'group' && m.home_score !== null)
  const totalGroupMatches = ourMatches.filter(m => m.stage === 'group').length
  const groupStageComplete = finishedGroups.length === totalGroupMatches && totalGroupMatches > 0

  // Get knockout results
  const finishedKnockout = ourMatches.filter(m => m.stage !== 'group' && m.home_score !== null)

  for (const bet of bets) {
    if (!bet.is_active) continue

    const betEntries = entries.filter(e => e.bet_id === bet.id && !e.is_resolved)
    if (!betEntries.length) continue

    let correctAnswer = null
    let canResolve = false

    switch (bet.slug) {
      // === GOLEADOR ===
      case 'top_scorer': {
        // Only resolve when tournament is over
        const finalMatch = ourMatches.find(m => m.stage === 'final')
        if (finalMatch?.home_score !== null && topScorers.length > 0) {
          correctAnswer = topScorers[0]?.player?.name
          canResolve = true
        }
        break
      }

      // === ASISTENCIAS ===
      case 'top_assists': {
        const finalMatch = ourMatches.find(m => m.stage === 'final')
        if (finalMatch?.home_score !== null && topAssists.length > 0) {
          correctAnswer = topAssists[0]?.player?.name
          canResolve = true
        }
        break
      }

      // === JUGADOR 3+ GOLES ===
      case 'player_3_goals': {
        if (topScorers.length > 0) {
          const players3Plus = topScorers.filter(p => p.statistics[0]?.goals?.total >= 3)
          // Can resolve once tournament is over, or player already has 3+
          correctAnswer = players3Plus.map(p => p.player.name)
          canResolve = groupStageComplete // At least check after groups
        }
        break
      }

      // === PORTERO MENOS GOLEADO ===
      case 'best_goalkeeper': {
        const finalMatch = ourMatches.find(m => m.stage === 'final')
        if (finalMatch?.home_score !== null) {
          // Fetch top goalkeepers stats from API-Football
          // The team with fewest goals conceded in the whole tournament
          const goalsConceded = {}
          ourMatches.filter(m => m.home_score !== null).forEach(m => {
            goalsConceded[m.home_team_id] = (goalsConceded[m.home_team_id] || 0) + (m.away_score || 0)
            goalsConceded[m.away_team_id] = (goalsConceded[m.away_team_id] || 0) + (m.home_score || 0)
          })
          // Find team with fewest goals conceded that went furthest
          const bestTeamId = Object.entries(goalsConceded).sort((a, b) => a[1] - b[1])[0]
          if (bestTeamId) {
            correctAnswer = parseInt(bestTeamId[0])
            canResolve = true
          }
        }
        break
      }

      // === MÁS GOLEADORA EN GRUPOS ===
      case 'most_goals_team': {
        if (groupStageComplete) {
          const goalsByTeam = calcGoalsByTeam(finishedGroups, 'scored')
          const topTeam = Object.entries(goalsByTeam).sort((a, b) => b[1] - a[1])[0]
          if (topTeam) {
            correctAnswer = parseInt(topTeam[0]) // team_id
            canResolve = true
          }
        }
        break
      }

      // === MENOS GOLEADA EN GRUPOS ===
      case 'least_conceded_groups_team': {
        if (groupStageComplete) {
          const goalsByTeam = calcGoalsByTeam(finishedGroups, 'conceded')
          const bestTeam = Object.entries(goalsByTeam).sort((a, b) => a[1] - b[1])[0]
          if (bestTeam) {
            correctAnswer = parseInt(bestTeam[0]) // team_id
            canResolve = true
          }
        }
        break
      }

      // === REVELACIÓN (llega a cuartos) ===
      case 'revelation': {
        // Check if any QF matches are set
        const qfMatches = ourMatches.filter(m => m.stage === 'quarter_final')
        if (qfMatches.length > 0) {
          const qfTeamIds = new Set()
          qfMatches.forEach(m => {
            qfTeamIds.add(m.home_team_id)
            qfTeamIds.add(m.away_team_id)
          })
          correctAnswer = [...qfTeamIds] // array of team IDs that reached QF
          canResolve = true
        }
        break
      }

      // === DECEPCIÓN (cae en grupos) ===
      case 'disappointment': {
        if (groupStageComplete) {
          // Teams eliminated in groups = all teams NOT in knockout
          const knockoutTeamIds = new Set()
          ourMatches.filter(m => m.stage !== 'group').forEach(m => {
            knockoutTeamIds.add(m.home_team_id)
            knockoutTeamIds.add(m.away_team_id)
          })
          const allTeamIds = new Set(ourTeams.map(t => t.id))
          const eliminatedInGroups = [...allTeamIds].filter(id => !knockoutTeamIds.has(id))
          correctAnswer = eliminatedInGroups
          canResolve = true
        }
        break
      }

      // === HAT-TRICK ===
      case 'any_hat_trick': {
        // Check all finished matches for hat-tricks
        for (const apiMatch of apiMatches.filter(m => m.fixture.status.short === 'FT')) {
          const eventsRes = await apiFetch(`/fixtures/events?fixture=${apiMatch.fixture.id}`)
          const goals = (eventsRes.response || []).filter(e => e.type === 'Goal')
          const goalsByPlayer = {}
          goals.forEach(g => {
            goalsByPlayer[g.player.id] = (goalsByPlayer[g.player.id] || 0) + 1
          })
          if (Object.values(goalsByPlayer).some(count => count >= 3)) {
            correctAnswer = 'yes'
            canResolve = true
            break
          }
        }
        // Only resolve 'no' when tournament is fully over
        const finalMatch = ourMatches.find(m => m.stage === 'final')
        if (finalMatch?.home_score !== null && !correctAnswer) {
          correctAnswer = 'no'
          canResolve = true
        }
        break
      }

      // === GOLEADA 5+ ===
      case 'any_5_goal_thrashing': {
        const thrashing = apiMatches.find(m => {
          const h = m.goals?.home || 0
          const a = m.goals?.away || 0
          return (h + a) >= 5 && (m.fixture.status.short === 'FT')
        })
        if (thrashing) {
          correctAnswer = 'yes'
          canResolve = true
        }
        const finalMatch = ourMatches.find(m => m.stage === 'final')
        if (finalMatch?.home_score !== null && !correctAnswer) {
          correctAnswer = 'no'
          canResolve = true
        }
        break
      }
    }

    // Resolve entries
    if (canResolve && correctAnswer !== null) {
      for (const entry of betEntries) {
        let points = 0
        const answer = entry.answer

        if (Array.isArray(correctAnswer)) {
          // For bets where correct is a set of team IDs (revelation, disappointment, players)
          if (typeof answer === 'string') {
            points = correctAnswer.includes(answer) ? bet.max_points : 0
          } else if (typeof answer === 'number') {
            points = correctAnswer.includes(answer) ? bet.max_points : 0
          }
        } else if (typeof correctAnswer === 'string') {
          // Exact string match (player names, yes/no)
          const normalizedAnswer = (answer || '').toString().toLowerCase().trim()
          const normalizedCorrect = correctAnswer.toLowerCase().trim()
          points = normalizedAnswer === normalizedCorrect ? bet.max_points : 0
        } else if (typeof correctAnswer === 'number') {
          // Team ID match
          points = parseInt(answer) === correctAnswer ? bet.max_points : 0
        }

        await supaFetch(`/rest/v1/pre_tournament_entries?id=eq.${entry.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            is_resolved: true,
            points_awarded: points
          })
        })
        resolved++
      }
      log.push(`   ✅ Resolved: ${bet.slug} (${betEntries.length} entries)`)
    }
  }

  return resolved
}

/**
 * Calculate goals scored/conceded by team in finished group matches
 */
function calcGoalsByTeam(finishedMatches, type) {
  const goals = {}
  finishedMatches.forEach(m => {
    if (type === 'scored') {
      goals[m.home_team_id] = (goals[m.home_team_id] || 0) + m.home_score
      goals[m.away_team_id] = (goals[m.away_team_id] || 0) + m.away_score
    } else {
      goals[m.home_team_id] = (goals[m.home_team_id] || 0) + m.away_score
      goals[m.away_team_id] = (goals[m.away_team_id] || 0) + m.home_score
    }
  })
  return goals
}

function findApiFixtureId(apiMatches, ourMatch, teamByApiId) {
  // Find API fixture matching our match
  const reverseTeamMap = {}
  Object.entries(teamByApiId).forEach(([apiId, ourId]) => {
    reverseTeamMap[ourId] = parseInt(apiId)
  })

  const homeApiId = reverseTeamMap[ourMatch.home_team_id]
  const awayApiId = reverseTeamMap[ourMatch.away_team_id]

  const found = apiMatches.find(m =>
    m.teams.home.id === homeApiId && m.teams.away.id === awayApiId
  )
  return found?.fixture?.id
}

/**
 * Sync knockout match teams from API-Football.
 * When API-Football shows knockout fixtures with known teams, populate our knockout matches.
 * Matches our DB knockout matches by FIFA match number mapping (R32=73-88, R16=89-96, etc.)
 */
async function syncKnockoutTeams(apiMatches, ourMatches, ourTeams, teamByApiId, log) {
  let updated = 0

  // Map API-Football round names to our stage names and match number ranges
  const roundMapping = {
    'Round of 32': { stage: 'Round of 32', startMatch: 73, endMatch: 88 },
    'Round of 16': { stage: 'Round of 16', startMatch: 89, endMatch: 96 },
    'Quarter-finals': { stage: 'Quarter-finals', startMatch: 97, endMatch: 100 },
    'Semi-finals': { stage: 'Semi-finals', startMatch: 101, endMatch: 102 },
    'Final': { stage: 'Final', startMatch: 104, endMatch: 104 }
  }

  // Get knockout fixtures from API-Football (with known teams)
  const knockoutFixtures = apiMatches.filter(m => {
    const round = m.league?.round || ''
    return !round.startsWith('Group') && m.teams?.home?.id && m.teams?.away?.id
  })

  if (knockoutFixtures.length === 0) return 0

  // Group API fixtures by round, sorted by date
  const fixturesByRound = {}
  for (const fix of knockoutFixtures) {
    const round = fix.league.round
    // Normalize round name: "Round of 32 - 1" → "Round of 32"
    const baseName = round.replace(/\s*-\s*\d+$/, '')
    if (!fixturesByRound[baseName]) fixturesByRound[baseName] = []
    fixturesByRound[baseName].push(fix)
  }

  // Sort each round's fixtures by date
  for (const round of Object.keys(fixturesByRound)) {
    fixturesByRound[round].sort((a, b) =>
      new Date(a.fixture.date) - new Date(b.fixture.date)
    )
  }

  // For each round, match API fixtures to our DB matches by date order
  for (const [roundName, mapping] of Object.entries(roundMapping)) {
    const apiFixtures = fixturesByRound[roundName]
    if (!apiFixtures || apiFixtures.length === 0) continue

    // Get our matches for this stage that still need teams
    const ourKnockoutMatches = ourMatches.filter(m =>
      m.stage === mapping.stage &&
      m.id >= mapping.startMatch && m.id <= mapping.endMatch &&
      (!m.home_team_id || !m.away_team_id)
    ).sort((a, b) => new Date(a.match_date) - new Date(b.match_date))

    // Match by date proximity
    for (const ourMatch of ourKnockoutMatches) {
      const ourDate = new Date(ourMatch.match_date).getTime()
      // Find closest API fixture by date
      let bestFix = null
      let bestDiff = Infinity
      for (const fix of apiFixtures) {
        const diff = Math.abs(new Date(fix.fixture.date).getTime() - ourDate)
        if (diff < bestDiff) {
          bestDiff = diff
          bestFix = fix
        }
      }

      // Only match if within 24 hours
      if (bestFix && bestDiff < 24 * 60 * 60 * 1000) {
        const homeTeamId = teamByApiId[bestFix.teams.home.id]
        const awayTeamId = teamByApiId[bestFix.teams.away.id]

        if (homeTeamId && awayTeamId) {
          await supaFetch(`/rest/v1/matches?id=eq.${ourMatch.id}`, {
            method: 'PATCH',
            body: JSON.stringify({
              home_team_id: homeTeamId,
              away_team_id: awayTeamId,
              match_date: bestFix.fixture.date // also update exact time from API
            })
          })
          updated++
          log.push(`   🏆 ${mapping.stage} match ${ourMatch.id}: teams set`)
          // Remove used fixture to prevent double-matching
          const fixIdx = apiFixtures.indexOf(bestFix)
          if (fixIdx > -1) apiFixtures.splice(fixIdx, 1)
        }
      }
    }
  }

  return updated
}

/**
 * Auto-resolve órdagos whose linked match is finished.
 * Calls the resolve_ordago PostgreSQL function via RPC.
 */
async function resolveFinishedOrdagos(log) {
  let resolved = 0

  // Get all unresolved órdagos with their match info
  const ordagos = await supaFetch(
    '/rest/v1/ordagos?status=neq.resolved&match_id=not.is.null&select=id,number,match_id,status'
  )

  if (!ordagos || ordagos.length === 0) return 0

  for (const ordago of ordagos) {
    // Check if the linked match is finished
    const matches = await supaFetch(`/rest/v1/matches?id=eq.${ordago.match_id}&select=id,status,home_score,away_score`)
    const match = matches?.[0]

    if (match && match.status === 'finished' && match.home_score !== null && match.away_score !== null) {
      // Call the resolve_ordago function
      const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/resolve_ordago`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ p_ordago_id: ordago.id })
      })

      if (rpcRes.ok) {
        resolved++
        log.push(`   🎲 Órdago #${ordago.number} resolved!`)
      } else {
        const err = await rpcRes.text()
        log.push(`   ⚠️ Órdago #${ordago.number} error: ${err}`)
      }
    }
  }

  return resolved
}

// ── Helpers ──

async function apiFetch(endpoint) {
  const res = await fetch(`https://v3.football.api-sports.io${endpoint}`, {
    headers: { 'x-apisports-key': API_FOOTBALL_KEY }
  })
  return res.json()
}

async function supaFetch(path, options = {}) {
  const url = `${SUPABASE_URL}${path}`
  const headers = {
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': options.method === 'PATCH' ? 'return=minimal' : 'return=representation'
  }

  const res = await fetch(url, { ...options, headers })

  if (options.method === 'PATCH') return null
  return res.json()
}
