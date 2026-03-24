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

    // 7. Summary
    const summary = {
      timestamp: new Date().toISOString(),
      matchesUpdated: updatedCount,
      totalFinished: finished.length,
      betsResolved: resolvedBets,
      log
    }

    return res.status(200).json(summary)
  } catch (err) {
    console.error('Sync error:', err)
    return res.status(500).json({ error: err.message })
  }
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

      // === JUGADOR 5+ GOLES ===
      case 'player_5_goals': {
        if (topScorers.length > 0) {
          const players5Plus = topScorers.filter(p => p.statistics[0]?.goals?.total >= 5)
          correctAnswer = players5Plus.map(p => p.player.name)
          canResolve = groupStageComplete
        }
        break
      }

      // === PRIMER GOLEADOR DEL TORNEO ===
      case 'first_scorer': {
        // First goal of the first match
        if (finishedGroups.length > 0) {
          const firstMatch = finishedGroups.sort((a, b) =>
            new Date(a.match_date) - new Date(b.match_date)
          )[0]
          // We'd need match events from API-Football for this
          const eventsRes = await apiFetch(`/fixtures/events?fixture=${findApiFixtureId(apiMatches, firstMatch, teamByApiId)}`)
          const goals = (eventsRes.response || []).filter(e => e.type === 'Goal').sort((a, b) => a.time.elapsed - b.time.elapsed)
          if (goals.length > 0) {
            correctAnswer = goals[0].player.name
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
          return Math.abs(h - a) >= 5 && (m.fixture.status.short === 'FT')
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
