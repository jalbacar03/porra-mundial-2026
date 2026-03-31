import { describe, it, expect } from 'vitest'
import { calculateGroupStandings } from '../utils/groupStandings'

const makeTeam = (id, name) => ({ id, name, code: name.slice(0, 3).toUpperCase() })

const makeMatch = (id, group, homeTeam, awayTeam) => ({
  id,
  stage: 'group',
  group_name: group,
  home_team: homeTeam,
  away_team: awayTeam,
  home_team_id: homeTeam.id,
  away_team_id: awayTeam.id,
})

describe('calculateGroupStandings', () => {
  const spain = makeTeam(1, 'España')
  const germany = makeTeam(2, 'Alemania')
  const japan = makeTeam(3, 'Japón')
  const costa = makeTeam(4, 'Costa Rica')

  const matches = [
    makeMatch(101, 'A', spain, germany),
    makeMatch(102, 'A', japan, costa),
    makeMatch(103, 'A', spain, japan),
    makeMatch(104, 'A', germany, costa),
    makeMatch(105, 'A', spain, costa),
    makeMatch(106, 'A', germany, japan),
  ]

  it('returns empty standings with no predictions', () => {
    const { groupStandings } = calculateGroupStandings(matches, {})
    expect(groupStandings.A).toHaveLength(4)
    groupStandings.A.forEach(t => {
      expect(t.played).toBe(0)
      expect(t.pts).toBe(0)
    })
  })

  it('calculates win correctly (3 pts)', () => {
    const preds = {
      101: { home_score: 2, away_score: 0 }, // Spain beats Germany
    }
    const { groupStandings } = calculateGroupStandings(matches, preds)
    const table = groupStandings.A
    const spainRow = table.find(t => t.team.id === 1)
    const germanyRow = table.find(t => t.team.id === 2)

    expect(spainRow.pts).toBe(3)
    expect(spainRow.w).toBe(1)
    expect(spainRow.gf).toBe(2)
    expect(spainRow.ga).toBe(0)
    expect(germanyRow.pts).toBe(0)
    expect(germanyRow.l).toBe(1)
  })

  it('calculates draw correctly (1 pt each)', () => {
    const preds = {
      101: { home_score: 1, away_score: 1 },
    }
    const { groupStandings } = calculateGroupStandings(matches, preds)
    const spainRow = groupStandings.A.find(t => t.team.id === 1)
    const germanyRow = groupStandings.A.find(t => t.team.id === 2)

    expect(spainRow.pts).toBe(1)
    expect(spainRow.d).toBe(1)
    expect(germanyRow.pts).toBe(1)
    expect(germanyRow.d).toBe(1)
  })

  it('sorts by pts, then gd, then gf', () => {
    const preds = {
      101: { home_score: 3, away_score: 0 }, // Spain 3-0 Germany
      102: { home_score: 2, away_score: 0 }, // Japan 2-0 Costa Rica
      103: { home_score: 1, away_score: 0 }, // Spain 1-0 Japan
      104: { home_score: 1, away_score: 0 }, // Germany 1-0 Costa Rica
      105: { home_score: 2, away_score: 0 }, // Spain 2-0 Costa Rica
      106: { home_score: 0, away_score: 1 }, // Germany 0-1 Japan
    }
    const { groupStandings } = calculateGroupStandings(matches, preds)
    const order = groupStandings.A.map(t => t.team.name)

    expect(order[0]).toBe('España') // 9 pts
    expect(order[1]).toBe('Japón')  // 6 pts
  })

  it('qualifies top 2 from each group', () => {
    const preds = {
      101: { home_score: 3, away_score: 0 },
      102: { home_score: 2, away_score: 0 },
      103: { home_score: 1, away_score: 0 },
      104: { home_score: 1, away_score: 0 },
      105: { home_score: 2, away_score: 0 },
      106: { home_score: 0, away_score: 1 },
    }
    const { qualified32 } = calculateGroupStandings(matches, preds)

    // Top 2: Spain (9pts) and Japan (6pts) qualify
    expect(qualified32).toContain(1) // Spain
    expect(qualified32).toContain(3) // Japan
  })

  it('ignores non-group matches', () => {
    const mixedMatches = [
      ...matches,
      { id: 999, stage: 'knockout', group_name: null, home_team: spain, away_team: germany },
    ]
    const { groupStandings } = calculateGroupStandings(mixedMatches, {})
    expect(groupStandings.A).toHaveLength(4)
  })
})
