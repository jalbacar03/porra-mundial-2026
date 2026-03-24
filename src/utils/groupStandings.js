/**
 * Calculate group standings from predicted match results.
 * Returns standings for all 12 groups + the 32 teams that qualify.
 */

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

  // Sort each group: pts DESC, gd DESC, gf DESC
  const sortedGroups = {}
  Object.keys(groups).sort().forEach(g => {
    const teams = Object.values(groups[g])
    teams.sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts
      if (b.gd !== a.gd) return b.gd - a.gd
      if (b.gf !== a.gf) return b.gf - a.gf
      return a.team.name.localeCompare(b.team.name)
    })
    sortedGroups[g] = teams
  })

  // Determine qualified teams
  // Top 2 from each group (24 teams)
  const top2 = []
  const thirdPlace = []

  Object.keys(sortedGroups).sort().forEach(g => {
    const table = sortedGroups[g]
    if (table[0]) top2.push(table[0])
    if (table[1]) top2.push(table[1])
    if (table[2]) thirdPlace.push({ ...table[2], group: g })
  })

  // Best 8 third-place teams (sorted by pts, gd, gf)
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
    qualified32,
    thirdPlaceRanking: thirdPlace
  }
}
