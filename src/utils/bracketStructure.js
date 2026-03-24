/**
 * FIFA World Cup 2026 — Complete bracket structure.
 * 48 teams, 12 groups, Round of 32 → R16 → QF → SF → Final
 */

import { assignThirdPlaceTeams } from './thirdPlaceAssignment'

// ── Round of 32 (matches 73-88) ──
// Sources: { type: '1st'|'2nd', group } or { type: '3rd', groups: [...] }
export const R32_MATCHES = [
  { matchNumber: 73, homeSource: { type: '2nd', group: 'A' }, awaySource: { type: '2nd', group: 'B' } },
  { matchNumber: 74, homeSource: { type: '1st', group: 'E' }, awaySource: { type: '3rd', groups: ['A','B','C','D','F'] } },
  { matchNumber: 75, homeSource: { type: '1st', group: 'F' }, awaySource: { type: '2nd', group: 'C' } },
  { matchNumber: 76, homeSource: { type: '1st', group: 'C' }, awaySource: { type: '2nd', group: 'F' } },
  { matchNumber: 77, homeSource: { type: '1st', group: 'I' }, awaySource: { type: '3rd', groups: ['C','D','F','G','H'] } },
  { matchNumber: 78, homeSource: { type: '2nd', group: 'E' }, awaySource: { type: '2nd', group: 'I' } },
  { matchNumber: 79, homeSource: { type: '1st', group: 'A' }, awaySource: { type: '3rd', groups: ['C','E','F','H','I'] } },
  { matchNumber: 80, homeSource: { type: '1st', group: 'L' }, awaySource: { type: '3rd', groups: ['E','H','I','J','K'] } },
  { matchNumber: 81, homeSource: { type: '1st', group: 'D' }, awaySource: { type: '3rd', groups: ['B','E','F','I','J'] } },
  { matchNumber: 82, homeSource: { type: '1st', group: 'G' }, awaySource: { type: '3rd', groups: ['A','E','H','I','J'] } },
  { matchNumber: 83, homeSource: { type: '2nd', group: 'K' }, awaySource: { type: '2nd', group: 'L' } },
  { matchNumber: 84, homeSource: { type: '1st', group: 'H' }, awaySource: { type: '2nd', group: 'J' } },
  { matchNumber: 85, homeSource: { type: '1st', group: 'B' }, awaySource: { type: '3rd', groups: ['E','F','G','I','J'] } },
  { matchNumber: 86, homeSource: { type: '1st', group: 'J' }, awaySource: { type: '2nd', group: 'H' } },
  { matchNumber: 87, homeSource: { type: '1st', group: 'K' }, awaySource: { type: '3rd', groups: ['D','E','I','J','L'] } },
  { matchNumber: 88, homeSource: { type: '2nd', group: 'D' }, awaySource: { type: '2nd', group: 'G' } }
]

// ── Round of 16 (matches 89-96): winners of R32 ──
export const R16_MATCHES = [
  { matchNumber: 89, homeMatch: 74, awayMatch: 77 },
  { matchNumber: 90, homeMatch: 73, awayMatch: 75 },
  { matchNumber: 91, homeMatch: 76, awayMatch: 78 },
  { matchNumber: 92, homeMatch: 79, awayMatch: 80 },
  { matchNumber: 93, homeMatch: 83, awayMatch: 84 },
  { matchNumber: 94, homeMatch: 81, awayMatch: 82 },
  { matchNumber: 95, homeMatch: 86, awayMatch: 88 },
  { matchNumber: 96, homeMatch: 85, awayMatch: 87 }
]

// ── Quarterfinals (matches 97-100) ──
export const QF_MATCHES = [
  { matchNumber: 97, homeMatch: 89, awayMatch: 90 },
  { matchNumber: 98, homeMatch: 93, awayMatch: 94 },
  { matchNumber: 99, homeMatch: 91, awayMatch: 92 },
  { matchNumber: 100, homeMatch: 95, awayMatch: 96 }
]

// ── Semifinals (matches 101-102) ──
export const SF_MATCHES = [
  { matchNumber: 101, homeMatch: 97, awayMatch: 98 },
  { matchNumber: 102, homeMatch: 99, awayMatch: 100 }
]

// ── Final (match 104) ──
export const FINAL_MATCH = [
  { matchNumber: 104, homeMatch: 101, awayMatch: 102 }
]

// All rounds in order
export const ROUNDS = [
  { key: 'r32', label: 'Dieciseisavos', matches: R32_MATCHES, pointsPerWin: 0 },
  { key: 'r16', label: 'Octavos', matches: R16_MATCHES, pointsPerWin: 1 },
  { key: 'qf', label: 'Cuartos', matches: QF_MATCHES, pointsPerWin: 2 },
  { key: 'sf', label: 'Semis', matches: SF_MATCHES, pointsPerWin: 4 },
  { key: 'final', label: 'Final', matches: FINAL_MATCH, pointsPerWin: 5 }
]

/**
 * Resolve R32 matchups from group standings.
 * @param {Object} groupStandings - { A: [{team, pts, gd, gf,...}], B: [...], ... }
 * @param {Array} thirdPlaceRanking - sorted 3rd-place teams with { team, group, pts, gd, gf }
 * @returns {Object} { matchNumber: { home: team, away: team } }
 */
export function resolveR32Matchups(groupStandings, thirdPlaceRanking) {
  const matchups = {}

  // Get best 8 third-place teams and assign them to slots
  const qualifying8 = thirdPlaceRanking.slice(0, 8)
  const thirdAssignments = assignThirdPlaceTeams(qualifying8)

  for (const match of R32_MATCHES) {
    const home = resolveSource(match.homeSource, groupStandings, thirdAssignments, match.matchNumber)
    const away = resolveSource(match.awaySource, groupStandings, thirdAssignments, match.matchNumber)

    matchups[match.matchNumber] = { home, away }
  }

  return matchups
}

function resolveSource(source, groupStandings, thirdAssignments, matchNumber) {
  if (source.type === '1st') {
    const table = groupStandings[source.group]
    return table?.[0]?.team || null
  }
  if (source.type === '2nd') {
    const table = groupStandings[source.group]
    return table?.[1]?.team || null
  }
  if (source.type === '3rd') {
    // Look up the assignment for this match
    const assignment = thirdAssignments[matchNumber]
    return assignment?.team || null
  }
  return null
}

/**
 * Given bracket picks for previous rounds, resolve teams for a later round.
 * @param {Object} picks - { matchNumber: { predicted_winner_id, home_team_id, away_team_id } }
 * @param {Array} roundMatches - matches array (R16/QF/SF/FINAL format with homeMatch/awayMatch)
 * @param {Object} teamsById - { teamId: { id, name, flag_url, ... } }
 * @returns {Object} { matchNumber: { home: team|null, away: team|null } }
 */
export function resolveRoundMatchups(picks, roundMatches, teamsById) {
  const matchups = {}

  for (const match of roundMatches) {
    const homePick = picks[match.homeMatch]
    const awayPick = picks[match.awayMatch]

    const homeTeamId = homePick?.predicted_winner_id
    const awayTeamId = awayPick?.predicted_winner_id

    matchups[match.matchNumber] = {
      home: homeTeamId ? teamsById[homeTeamId] || null : null,
      away: awayTeamId ? teamsById[awayTeamId] || null : null
    }
  }

  return matchups
}

/**
 * Get a label describing the source of a team in R32.
 * e.g., "1º Grupo A" or "3º (C/E/F/H/I)"
 */
export function getSourceLabel(source) {
  if (source.type === '1st') return `1º Grupo ${source.group}`
  if (source.type === '2nd') return `2º Grupo ${source.group}`
  if (source.type === '3rd') return `Mejor 3º (${source.groups.join('/')})`
  return ''
}
