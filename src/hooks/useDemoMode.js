import { useState, useEffect } from 'react'

const DEMO_KEY = 'porra_demo_mode'

export function useDemoMode(isAdmin) {
  const [demoMode, setDemoMode] = useState(() => {
    if (!isAdmin) return false
    return localStorage.getItem(DEMO_KEY) === 'true'
  })

  useEffect(() => {
    if (isAdmin) {
      localStorage.setItem(DEMO_KEY, demoMode ? 'true' : 'false')
    }
  }, [demoMode, isAdmin])

  const toggle = () => setDemoMode(prev => !prev)

  return { demoMode: isAdmin ? demoMode : false, toggle }
}

// Mock data for demo mode
const MOCK_NAMES = [
  'Pablo M.', 'Laura G.', 'Carlos R.', 'Marta S.', 'Javi A.',
  'Ana P.', 'Diego L.', 'Lucia F.', 'Marcos T.', 'Elena B.',
  'Raul V.', 'Sara N.', 'Andres H.', 'Paula D.', 'Hugo C.'
]

export function generateMockLeaderboard(myUserId) {
  const users = MOCK_NAMES.map((name, i) => {
    const pts = Math.max(0, 45 - i * 3 + Math.floor(Math.random() * 5))
    const exact = Math.floor(pts / 3.5)
    const sign = Math.floor((pts - exact * 3) / 1)
    return {
      user_id: i === 4 ? myUserId : `mock-${i}`, // Position 5 = "you"
      full_name: i === 4 ? 'Tu' : name,
      total_points: pts,
      exact_hits: exact,
      sign_hits: sign,
      pre_tournament_points: Math.floor(Math.random() * 8)
    }
  })
  users.sort((a, b) => b.total_points - a.total_points)
  return users
}

export function generateMockMatchResults(matches) {
  if (!matches || matches.length === 0) return matches
  // Simulate first 6 matches as finished
  return matches.map((m, i) => {
    if (i < 6) {
      return {
        ...m,
        status: 'finished',
        home_score: Math.floor(Math.random() * 4),
        away_score: Math.floor(Math.random() * 3)
      }
    }
    return m
  })
}

// Deterministic seed-based random to keep demo data stable across renders
function seededRandom(seed) {
  let x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

// Generate mock predictions for group matches (all filled in)
export function generateMockPredictions(matches) {
  const preds = {}
  matches.forEach((m, i) => {
    const seed = m.id || i
    preds[m.id] = {
      home_score: Math.floor(seededRandom(seed * 7) * 4),
      away_score: Math.floor(seededRandom(seed * 13) * 3)
    }
  })
  return preds
}

// Generate mock match statuses: some finished with results, one live, rest upcoming
export function generateDemoMatchStatuses(matches) {
  if (!matches || matches.length === 0) return matches

  // Sort by match_date to apply statuses in chronological order
  const sorted = [...matches].sort((a, b) =>
    new Date(a.match_date) - new Date(b.match_date)
  )

  // First 8 matches finished, 1 live, rest scheduled
  return sorted.map((m, i) => {
    const seed = m.id || i
    if (i < 8) {
      const hs = Math.floor(seededRandom(seed * 7) * 4)
      const as = Math.floor(seededRandom(seed * 13) * 3)
      return {
        ...m,
        status: 'finished',
        home_score: hs,
        away_score: as
      }
    }
    if (i === 8) {
      return {
        ...m,
        status: 'live',
        home_score: Math.floor(seededRandom(seed * 3) * 3),
        away_score: Math.floor(seededRandom(seed * 5) * 2)
      }
    }
    return { ...m, status: 'scheduled', home_score: null, away_score: null }
  })
}

// Mock pre-tournament bet entries (all completed)
const MOCK_BET_VALUES = {
  players: {
    top_scorer: { player_name: 'Kylian Mbappé', team: 'Francia' },
    top_assists: { player_name: 'Kevin De Bruyne', team: 'Bélgica' },
    best_goalkeeper: { player_name: 'Thibaut Courtois', team: 'Bélgica' },
    three_plus_goals: { player_name: 'Harry Kane', team: 'Inglaterra' },
    five_plus_goals: { player_name: 'Kylian Mbappé', team: 'Francia' }
  },
  teams: {
    revelation: { team_name: 'Marruecos' },
    disappointment: { team_name: 'Alemania' },
    most_goals_group: { team_name: 'España' },
    fewest_goals_group: { team_name: 'Arabia Saudí' }
  },
  yesno: {
    hat_trick: { answer: true },
    five_goal_game: { answer: false }
  }
}

export function generateMockBetEntries(bets) {
  const entries = {}
  bets.forEach(bet => {
    // Try to find a mock value by slug or category
    const catValues = MOCK_BET_VALUES[bet.category]
    const mockValue = catValues?.[bet.slug]

    if (mockValue) {
      entries[bet.id] = {
        bet_id: bet.id,
        value: mockValue,
        is_resolved: false,
        points_awarded: 0
      }
    } else {
      // Generic fallback: mark as answered with a generic value
      entries[bet.id] = {
        bet_id: bet.id,
        value: bet.category === 'yesno' ? { answer: true } : { text: 'Seleccionado' },
        is_resolved: false,
        points_awarded: 0
      }
    }
  })
  return entries
}
