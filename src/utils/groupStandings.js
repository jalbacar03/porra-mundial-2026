/**
 * Calculate group standings from predicted match results.
 * Returns standings for all 12 groups + the 32 teams that qualify.
 */

/**
 * Compute head-to-head stats among a subset of teams in a group.
 * Only counts matches where BOTH home and away are in the given team set.
 * Used to apply FIFA 2026 tiebreaker order: H2H pts → H2H gd → H2H gf → overall gd → overall gf.
 */
function computeH2HStats(teams, groupMatches, predictions) {
  const teamIds = new Set(teams.map(t => t.team.id))
  const stats = {}
  teams.forEach(t => { stats[t.team.id] = { pts: 0, gd: 0, gf: 0 } })

  groupMatches.forEach(m => {
    const pred = predictions[m.id]
    if (!pred || pred.home_score == null || pred.away_score == null) return
    const homeId = m.home_team?.id || m.home_team_id
    const awayId = m.away_team?.id || m.away_team_id
    if (!teamIds.has(homeId) || !teamIds.has(awayId)) return

    const hs = parseInt(pred.home_score)
    const as = parseInt(pred.away_score)
    if (isNaN(hs) || isNaN(as)) return

    stats[homeId].gf += hs
    stats[homeId].gd += hs - as
    stats[awayId].gf += as
    stats[awayId].gd += as - hs

    if (hs > as) { stats[homeId].pts += 3 }
    else if (as > hs) { stats[awayId].pts += 3 }
    else { stats[homeId].pts += 1; stats[awayId].pts += 1 }
  })

  return stats
}

/**
 * Given matches and predictions, calculate the table for each group.
 * @param {Array} matches - All group stage matches with home_team/away_team objects
 * @param {Object} predictions - { matchId: { home_score, away_score } }
 * @returns {Object} { groupStandings: { A: [...], B: [...] }, qualified32: [teamId, ...] }
 */
export function calculateGroupStandings(matches, predictions) {
  // Build team stats per group
  const groups = {} // { 'A': { teamId: { team, pts, gf, ga, gd, w, d, l, played } } }

  // Initialize all teams from matches
  matches.forEach(m => {
    if (m.stage !== 'group') return
    const g = m.group_name
    if (!groups[g]) groups[g] = {}

    const initTeam = (team) => {
      if (!groups[g][team.id]) {
        groups[g][team.id] = {
          team,
          pts: 0, gf: 0, ga: 0, gd: 0,
          w: 0, d: 0, l: 0, played: 0
        }
      }
    }
    if (m.home_team) initTeam(m.home_team)
    if (m.away_team) initTeam(m.away_team)
  })

  // Apply predictions
  matches.forEach(m => {
    if (m.stage !== 'group') return
    const pred = predictions[m.id]
    if (!pred || pred.home_score == null || pred.away_score == null) return

    const g = m.group_name
    const homeId = m.home_team?.id || m.home_team_id
    const awayId = m.away_team?.id || m.away_team_id
    if (!groups[g]?.[homeId] || !groups[g]?.[awayId]) return

    const hs = parseInt(pred.home_score)
    const as = parseInt(pred.away_score)
    if (isNaN(hs) || isNaN(as)) return

    const home = groups[g][homeId]
    const away = groups[g][awayId]

    home.played++
    away.played++
    home.gf += hs
    home.ga += as
    away.gf += as
    away.ga += hs
    home.gd = home.gf - home.ga
    away.gd = away.gf - away.ga

    if (hs > as) {
      home.pts += 3
      home.w++
      away.l++
    } else if (hs < as) {
      away.pts += 3
      away.w++
      home.l++
    } else {
      home.pts += 1
      away.pts += 1
      home.d++
      away.d++
    }
  })

  // Sort each group per FIFA 2026 tiebreaker order:
  // 1. pts DESC
  // 2. H2H pts (among tied teams only)
  // 3. H2H gd
  // 4. H2H gf
  // 5. Overall gd
  // 6. Overall gf
  // 7. Alphabetical (proxy for fair play / FIFA ranking — both untrackable here)
  const sortedGroups = {}
  Object.keys(groups).sort().forEach(g => {
    const teams = Object.values(groups[g])
    const groupMatches = matches.filter(m => m.stage === 'group' && m.group_name === g)

    // Bucket by pts, then sort within each bucket using H2H
    const ptsBuckets = {}
    teams.forEach(t => {
      if (!ptsBuckets[t.pts]) ptsBuckets[t.pts] = []
      ptsBuckets[t.pts].push(t)
    })

    const sorted = []
    Object.keys(ptsBuckets).sort((a, b) => b - a).forEach(pts => {
      const bucket = ptsBuckets[pts]
      if (bucket.length === 1) {
        sorted.push(bucket[0])
        return
      }
      // Compute H2H sub-table for just these tied teams
      const h2h = computeH2HStats(bucket, groupMatches, predictions)
      bucket.sort((a, b) => {
        const ha = h2h[a.team.id]
        const hb = h2h[b.team.id]
        if (hb.pts !== ha.pts) return hb.pts - ha.pts
        if (hb.gd !== ha.gd) return hb.gd - ha.gd
        if (hb.gf !== ha.gf) return hb.gf - ha.gf
        if (b.gd !== a.gd) return b.gd - a.gd
        if (b.gf !== a.gf) return b.gf - a.gf
        return a.team.name.localeCompare(b.team.name)
      })
      sorted.push(...bucket)
    })

    sortedGroups[g] = sorted
  })

  // Track which groups have ALL their matches predicted (used by callers
  // like the bracket to decide whether a group's standings should feed
  // R32 — partial standings shouldn't pretend to know top-2 / 3rd-place).
  const requiredPerGroup = {}
  const completedPerGroup = {}
  matches.forEach(m => {
    if (m.stage !== 'group') return
    requiredPerGroup[m.group_name] = (requiredPerGroup[m.group_name] || 0) + 1
    const pred = predictions[m.id]
    if (pred && pred.home_score != null && pred.home_score !== '' &&
        pred.away_score != null && pred.away_score !== '') {
      completedPerGroup[m.group_name] = (completedPerGroup[m.group_name] || 0) + 1
    }
  })
  const completedGroups = new Set(
    Object.keys(requiredPerGroup).filter(g => completedPerGroup[g] === requiredPerGroup[g])
  )

  // Determine qualified teams (top-2 + best third). Only from fully-predicted
  // groups — otherwise an empty group would sort alphabetically at 0 pts and
  // hand the bracket a phantom ranking.
  const top2 = []
  const thirdPlace = []

  Object.keys(sortedGroups).sort().forEach(g => {
    if (!completedGroups.has(g)) return
    const table = sortedGroups[g]
    if (table[0]) top2.push(table[0])
    if (table[1]) top2.push(table[1])
    if (table[2]) thirdPlace.push({ ...table[2], group: g })
  })

  // Best 8 third-place teams: pts → gd → gf only (no H2H — different groups, never played each other)
  thirdPlace.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts
    if (b.gd !== a.gd) return b.gd - a.gd
    if (b.gf !== a.gf) return b.gf - a.gf
    return 0
  })
  const best8Third = thirdPlace.slice(0, 8)

  const qualified32 = [
    ...top2.map(t => t.team.id),
    ...best8Third.map(t => t.team.id)
  ]

  return {
    groupStandings: sortedGroups,
    completedGroups,
    qualified32,
    thirdPlaceRanking: thirdPlace
  }
}
