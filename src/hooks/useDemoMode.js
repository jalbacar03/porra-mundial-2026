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
