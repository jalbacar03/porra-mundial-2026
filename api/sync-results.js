/**
 * Vercel Serverless Function — Sync match results from API-Football
 *
 * GET /api/sync-results → Fetches live/finished matches and updates Supabase
 * Also resolves: bracket picks, pre-tournament bets (goleador, etc.)
 *
 * Called by Vercel Cron daily (Hobby plan limit), or manually from Admin.
 * API-Football free tier: 100 requests/day
 */

import webpush from 'web-push'

const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const VAPID_PUBLIC_KEY = process.env.VITE_VAPID_PUBLIC_KEY
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:noreply@porra-mundial.app'

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
}

const BOT365_ID = 'b0365b03-65b0-365b-0365-b0365b036500'

// 2026 World Cup league ID in API-Football
const WORLD_CUP_ID = 1
const WORLD_CUP_SEASON = 2026

// UEFA member nations (used to resolve "champion_european" bet without an API call).
// Includes all 55 UEFA federations — only those that could plausibly reach the WC
// matter, but we keep the full list for forward-compat.
const UEFA_NATIONS = new Set([
  'Albania','Andorra','Armenia','Austria','Azerbaijan','Belarus','Belgium','Bélgica',
  'Bosnia and Herzegovina','Bosnia','Bulgaria','Croatia','Croacia','Cyprus','Chipre',
  'Czech Republic','Czechia','Chequia','Denmark','Dinamarca','England','Inglaterra',
  'Estonia','Faroe Islands','Finland','Finlandia','France','Francia','Georgia',
  'Germany','Alemania','Gibraltar','Greece','Grecia','Hungary','Hungría','Iceland',
  'Islandia','Ireland','Irlanda','Israel','Italy','Italia','Kazakhstan','Kosovo',
  'Latvia','Liechtenstein','Lithuania','Luxembourg','Luxemburgo','Malta','Moldova',
  'Montenegro','Netherlands','Holanda','Países Bajos','North Macedonia','Macedonia',
  'Northern Ireland','Norway','Noruega','Poland','Polonia','Portugal','Romania',
  'Rumanía','Russia','Rusia','San Marino','Scotland','Escocia','Serbia','Slovakia',
  'Eslovaquia','Slovenia','Eslovenia','Spain','España','Sweden','Suecia',
  'Switzerland','Suiza','Turkey','Türkiye','Turquía','Ukraine','Ucrania','Wales',
  'Gales'
])

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(200).end()

  // Auth: only enforced if CRON_SECRET env var is set (opt-in hardening).
  //   - Vercel cron requests carry Authorization: Bearer <CRON_SECRET>
  //   - Admin manual button carries Authorization: Bearer <SUPABASE_JWT>
  //     and we verify via Supabase that the user has is_admin = true.
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = req.headers.authorization || ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    if (!token) return res.status(401).json({ error: 'Unauthorized' })

    let allowed = (token === cronSecret)
    if (!allowed) {
      // Try as a Supabase user JWT — admin only
      try {
        const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
          headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${token}` }
        })
        if (userRes.ok) {
          const user = await userRes.json()
          if (user?.id) {
            const profRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=is_admin`, {
              headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` }
            })
            const prof = await profRes.json().catch(() => [])
            if (Array.isArray(prof) && prof[0]?.is_admin) allowed = true
          }
        }
      } catch {}
    }
    if (!allowed) return res.status(401).json({ error: 'Unauthorized' })
  }

  if (!API_FOOTBALL_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Missing env vars' })
  }

  try {
    const log = []

    // 1. Fetch fixtures from API-Football
    log.push('📡 Fetching matches from API-Football...')
    const matchesResponse = await apiFetch(`/fixtures?league=${WORLD_CUP_ID}&season=${WORLD_CUP_SEASON}`)
    const apiMatches = matchesResponse.response || []

    // 1b. Extra fixtures by ID — for matches outside the World Cup league
    // (e.g. pre-tournament friendlies used to test the live flow end-to-end).
    // Any DB row with api_football_fixture_id NOT NULL and status != 'finished'
    // gets its fixture pulled individually so sync covers it too.
    const ourExtraMatches = await supaFetch(
      `/rest/v1/matches?select=api_football_fixture_id&api_football_fixture_id=not.is.null&status=neq.finished`
    )
    const extraIds = (ourExtraMatches || [])
      .map(m => m.api_football_fixture_id)
      .filter(Boolean)
    for (const fid of extraIds) {
      try {
        const res = await apiFetch(`/fixtures?id=${fid}`)
        const extra = res.response?.[0]
        if (extra) {
          apiMatches.push(extra)
          log.push(`   ➕ Extra fixture ${fid}: ${extra.teams.home.name} vs ${extra.teams.away.name}`)
        }
      } catch (e) {
        log.push(`   ⚠️ Failed extra fixture ${fid}: ${e.message}`)
      }
    }

    const finished = apiMatches.filter(m =>
      m.fixture.status.short === 'FT' ||
      m.fixture.status.short === 'AET' ||
      m.fixture.status.short === 'PEN'
    )
    const live = apiMatches.filter(m =>
      ['LIVE', '1H', '2H', 'HT', 'ET', 'BT', 'P'].includes(m.fixture.status.short)
    )
    log.push(`   Found ${finished.length} finished, ${live.length} live matches`)

    // 2. Get our matches from Supabase
    const ourMatches = await supaFetch('/rest/v1/matches?select=*&order=id')
    const ourTeams = await supaFetch('/rest/v1/teams?select=id,name,api_football_id')

    // Build team lookup: api_football_id → our_team_id
    const teamByApiId = {}
    ourTeams.forEach(t => {
      if (t.api_football_id) teamByApiId[t.api_football_id] = t.id
    })

    // 3. Update finished match scores
    // IMPORTANT: Update any match that is NOT yet finished (includes live → finished transition)
    let updatedCount = 0
    const newlyFinished = [] // matches that transitioned to finished IN THIS RUN — for push notifications
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
        m.status !== 'finished' // Update any non-finished match (scheduled, live)
      )

      if (ourMatch) {
        const updateData = {
          home_score: homeScore,
          away_score: awayScore,
          status: 'finished'
        }

        // For knockout matches, determine winner_team_id
        if (ourMatch.stage !== 'group') {
          if (apiMatch.teams.home.winner) {
            updateData.winner_team_id = homeTeamId
          } else if (apiMatch.teams.away.winner) {
            updateData.winner_team_id = awayTeamId
          }
        }

        await supaFetch(`/rest/v1/matches?id=eq.${ourMatch.id}`, {
          method: 'PATCH',
          body: JSON.stringify(updateData)
        })
        updatedCount++
        newlyFinished.push({
          id: ourMatch.id,
          home_score: homeScore,
          away_score: awayScore,
          home_team_id: homeTeamId,
          away_team_id: awayTeamId
        })
        log.push(`   ✅ Match ${ourMatch.id}: ${homeScore}-${awayScore}${updateData.winner_team_id ? ` (winner: ${updateData.winner_team_id})` : ''}`)
      }
    }
    log.push(`📊 Updated ${updatedCount} match scores`)

    // 3b. Web Push: notify users who predicted matches that just finished
    let pushed = 0
    if (newlyFinished.length > 0) {
      pushed = await sendMatchFinishedPushes(newlyFinished, ourTeams, log)
      log.push(`📲 Sent ${pushed} push notifications`)
    }

    // 3a. Update live match scores (intermediate, status='live')
    let liveUpdated = 0
    for (const apiMatch of live) {
      const homeApiId = apiMatch.teams.home.id
      const awayApiId = apiMatch.teams.away.id
      const homeScore = apiMatch.goals.home ?? 0
      const awayScore = apiMatch.goals.away ?? 0

      const homeTeamId = teamByApiId[homeApiId]
      const awayTeamId = teamByApiId[awayApiId]
      if (!homeTeamId || !awayTeamId) continue

      const ourMatch = ourMatches.find(m =>
        m.home_team_id === homeTeamId && m.away_team_id === awayTeamId
      )

      if (ourMatch && ourMatch.status !== 'finished') {
        await supaFetch(`/rest/v1/matches?id=eq.${ourMatch.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            home_score: homeScore,
            away_score: awayScore,
            status: 'live'
          })
        })
        liveUpdated++
        log.push(`   🔴 Live ${ourMatch.id}: ${homeScore}-${awayScore} (${apiMatch.fixture.status.short} ${apiMatch.fixture.status.elapsed || ''}')`)
      }
    }
    log.push(`🔴 Updated ${liveUpdated} live match scores`)

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

    // 8. Score bracket picks for finished knockout matches
    log.push('🏆 Scoring bracket picks...')
    const bracketScored = await scoreBracketPicks(log)
    log.push(`   Scored ${bracketScored} bracket picks`)

    // 9. Summary
    const summary = {
      timestamp: new Date().toISOString(),
      matchesUpdated: updatedCount,
      pushNotificationsSent: pushed,
      totalFinished: finished.length,
      betsResolved: resolvedBets,
      knockoutTeamsSynced: knockoutSynced,
      bracketScored,
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

      // === GUANTE DE ORO (mejor portero) — manual ===
      case 'best_goalkeeper': {
        // FIFA/Adidas award. API-Football doesn't expose "Golden Glove" directly,
        // and clean-sheets-only is a poor proxy at player level. Admin resolves
        // manually post-final via the Admin → Pre-torneo tab.
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
        // Optimization: first check if any player in top scorers has 3+ goals in a single match
        // by checking matches where a team scored 3+ (hat-trick only possible if team scores 3+)
        const hatTrickCandidates = apiMatches.filter(m =>
          (m.fixture.status.short === 'FT' || m.fixture.status.short === 'AET') &&
          (m.goals?.home >= 3 || m.goals?.away >= 3)
        )
        // Only fetch events for candidate matches (saves API calls)
        for (const apiMatch of hatTrickCandidates) {
          const eventsRes = await apiFetch(`/fixtures/events?fixture=${apiMatch.fixture.id}`)
          const goals = (eventsRes.response || []).filter(e => e.type === 'Goal' && e.detail !== 'Missed Penalty')
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

      // === GOLEADA POR 5+ GOLES DE DIFERENCIA ===
      case 'any_5_goal_thrashing': {
        // Resolve 'yes' as soon as any finished match has |home-away| >= 5
        const thrashing = apiMatches.find(m => {
          const h = m.goals?.home ?? 0
          const a = m.goals?.away ?? 0
          const finishedStatus = ['FT', 'AET', 'PEN'].includes(m.fixture.status.short)
          return finishedStatus && Math.abs(h - a) >= 5
        })
        if (thrashing) {
          correctAnswer = 'yes'
          canResolve = true
        }
        // Resolve 'no' only when tournament is fully over
        const finalMatch = ourMatches.find(m => m.stage === 'final')
        if (finalMatch?.home_score !== null && !correctAnswer) {
          correctAnswer = 'no'
          canResolve = true
        }
        break
      }

      // === FINAL DECIDIDA EN PENALTIS ===
      case 'final_penalties': {
        // The final match in our DB
        const finalMatch = ourMatches.find(m => m.stage === 'final')
        if (!finalMatch || finalMatch.home_score === null) break
        // Find the corresponding API fixture for the final
        const finalApiFixture = apiMatches.find(m => {
          const homeApi = m.teams?.home?.id
          const awayApi = m.teams?.away?.id
          return teamByApiId[homeApi] === finalMatch.home_team_id &&
                 teamByApiId[awayApi] === finalMatch.away_team_id &&
                 (m.league?.round || '').toLowerCase().includes('final')
        })
        if (finalApiFixture) {
          // 'PEN' = decided on penalty shootout
          correctAnswer = finalApiFixture.fixture.status.short === 'PEN' ? 'yes' : 'no'
          canResolve = true
        }
        break
      }

      // === CAMPEÓN ES EUROPEO ===
      case 'champion_european': {
        const finalMatch = ourMatches.find(m => m.stage === 'final')
        if (!finalMatch || !finalMatch.winner_team_id) break
        const championTeamId = finalMatch.winner_team_id
        const championTeam = ourTeams.find(t => t.id === championTeamId)
        if (championTeam) {
          // Check by team name against UEFA member list (data-driven, no API call needed)
          correctAnswer = UEFA_NATIONS.has((championTeam.name || '').trim()) ? 'yes' : 'no'
          canResolve = true
        }
        break
      }

      // === AMBAS ROJAS EN UN MISMO PARTIDO ===
      case 'both_red_cards_match': {
        // Cheap pre-filter: skip matches with too few cards already shown. We need to
        // fetch events to detect reds per team. Only check finished matches.
        const candidates = apiMatches.filter(m =>
          ['FT', 'AET', 'PEN'].includes(m.fixture.status.short)
        )
        for (const apiMatch of candidates) {
          const eventsRes = await apiFetch(`/fixtures/events?fixture=${apiMatch.fixture.id}`)
          const reds = (eventsRes.response || []).filter(e =>
            e.type === 'Card' && (e.detail === 'Red Card' || e.detail === 'Second Yellow card')
          )
          const redTeams = new Set(reds.map(r => r.team?.id).filter(Boolean))
          if (redTeams.size >= 2) {
            correctAnswer = 'yes'
            canResolve = true
            break
          }
        }
        const finalMatch = ourMatches.find(m => m.stage === 'final')
        if (finalMatch?.home_score !== null && !correctAnswer) {
          correctAnswer = 'no'
          canResolve = true
        }
        break
      }

      // === MVP — manual (admin resolves post-final) ===
      case 'mvp': {
        // FIFA announces MVP at the final ceremony; API-Football doesn't expose this
        // directly. Resolution is done manually by admin via Admin → Pre-torneo tab.
        // Sync skips it on purpose.
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
 * Score bracket picks — award points for correct winner predictions in knockout rounds.
 * Points: R32=0, R16=1, QF=2, SF=4, Final=5, Champion=8
 */
async function scoreBracketPicks(log) {
  // Point values per round
  const ROUND_POINTS = { r32: 0, r16: 1, qf: 2, sf: 4, final: 5 }
  // Champion bonus: 8 pts for correctly predicting the tournament winner (final winner)
  const CHAMPION_BONUS = 8

  // Get all finished knockout matches with a winner
  const knockoutMatches = await supaFetch(
    '/rest/v1/matches?select=id,match_number,stage,winner_team_id,status' +
    '&status=eq.finished&winner_team_id=not.is.null&stage=neq.group'
  )

  if (!knockoutMatches || knockoutMatches.length === 0) return 0

  // Get all bracket picks that haven't been scored yet
  const unscoredPicks = await supaFetch(
    '/rest/v1/bracket_picks?select=id,user_id,match_number,round,predicted_winner_id' +
    '&points_awarded=is.null'
  )

  if (!unscoredPicks || unscoredPicks.length === 0) return 0

  // Build lookup: match_number → winner_team_id
  const winnerByMatchNumber = {}
  knockoutMatches.forEach(m => {
    if (m.match_number && m.winner_team_id) {
      winnerByMatchNumber[m.match_number] = m.winner_team_id
    }
  })

  // Determine the final match winner for champion bonus
  // Final is match_number 104
  const finalWinner = winnerByMatchNumber[104] || null

  let scored = 0
  for (const pick of unscoredPicks) {
    const actualWinner = winnerByMatchNumber[pick.match_number]
    if (!actualWinner) continue // Match not finished yet

    const roundKey = pick.round // 'r32', 'r16', 'qf', 'sf', 'final'
    const basePoints = ROUND_POINTS[roundKey] || 0
    const isCorrect = pick.predicted_winner_id === actualWinner

    let pointsAwarded = isCorrect ? basePoints : 0

    // Champion bonus: if this is the final and the user predicted the winner
    if (roundKey === 'final' && isCorrect && finalWinner) {
      pointsAwarded += CHAMPION_BONUS
    }

    await supaFetch(`/rest/v1/bracket_picks?id=eq.${pick.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ points_awarded: pointsAwarded })
    })
    scored++

    if (isCorrect && pointsAwarded > 0) {
      log.push(`   ✅ Bracket: user ${pick.user_id.slice(0,8)}... match ${pick.match_number} → +${pointsAwarded} pts`)
    }
  }

  return scored
}

// ── Helpers ──

async function apiFetch(endpoint) {
  const res = await fetch(`https://v3.football.api-sports.io${endpoint}`, {
    headers: { 'x-apisports-key': API_FOOTBALL_KEY }
  })
  if (!res.ok) {
    console.error(`API-Football error: ${res.status} ${res.statusText} for ${endpoint}`)
    return { response: [] }
  }
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

  if (!res.ok) {
    const errText = await res.text().catch(() => 'unknown')
    console.error(`Supabase error: ${res.status} for ${path}: ${errText}`)
    if (options.method === 'PATCH') return null
    return []
  }

  if (options.method === 'PATCH') return null
  return res.json()
}

/**
 * Send Web Push notifications to users who predicted any of the just-finished
 * matches. Idempotent at the cron level: a match only enters newlyFinished the
 * first run that detects its status transition (subsequent runs filter it out
 * because status='finished' already).
 *
 * On 404/410 from a push endpoint, the subscription is dead and is purged.
 */
async function sendMatchFinishedPushes(newlyFinished, ourTeams, log) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    log.push('   ⚠️ VAPID keys not set, skipping push')
    return 0
  }

  const teamName = id => ourTeams.find(t => t.id === id)?.name || ''
  let totalSent = 0

  for (const m of newlyFinished) {
    // Find users who predicted this match (excluding bot)
    const preds = await supaFetch(
      `/rest/v1/predictions?match_id=eq.${m.id}&user_id=neq.${BOT365_ID}&select=user_id`
    )
    const userIds = [...new Set((preds || []).map(p => p.user_id))]
    if (userIds.length === 0) continue

    // Get push subscriptions for those users
    const idsList = userIds.map(id => `"${id}"`).join(',')
    const subs = await supaFetch(
      `/rest/v1/push_subscriptions?user_id=in.(${idsList})&select=id,endpoint,p256dh,auth`
    )
    if (!subs || subs.length === 0) continue

    const home = teamName(m.home_team_id)
    const away = teamName(m.away_team_id)
    const payload = JSON.stringify({
      title: `Final: ${home} ${m.home_score}-${m.away_score} ${away}`,
      body: 'Abre la app para ver tus puntos.',
      url: '/'
    })

    // Fan-out: send to every subscription (parallel) and clean up dead ones
    await Promise.all(subs.map(async sub => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        )
        totalSent++
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          // Subscription gone — remove from DB
          await supaFetch(`/rest/v1/push_subscriptions?id=eq.${sub.id}`, { method: 'DELETE' })
          log.push(`   🧹 Pruned dead subscription ${sub.id}`)
        } else {
          log.push(`   ⚠️ Push error for ${sub.id}: ${err.statusCode || err.message}`)
        }
      }
    }))
  }

  return totalSent
}
