/**
 * Seed players from API-Football into Supabase
 *
 * Usage:
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_KEY=your-service-role-key \
 *   API_FOOTBALL_KEY=your-api-football-key \
 *   node scripts/seed-players.js
 *
 * API-Football free tier: 100 requests/day
 * This script needs ~50 requests (1 per team), so it fits in a single day.
 *
 * Get your API key at: https://www.api-football.com/ (free plan)
 */

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_KEY  // Use service_role key for admin access
const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY

if (!SUPABASE_URL || !SUPABASE_KEY || !API_FOOTBALL_KEY) {
  console.error('Missing env vars. Usage:')
  console.error('SUPABASE_URL=xxx SUPABASE_KEY=xxx API_FOOTBALL_KEY=xxx node scripts/seed-players.js')
  process.exit(1)
}

// API-Football team IDs for 2026 World Cup teams
// These are the API-Football team IDs — may need updating when final squads are confirmed
const WORLD_CUP_TEAMS = {
  // Group A
  'Morocco': 31, 'USA': 2384, 'Peru': 2383,
  // Group B
  'Portugal': 27, 'Ecuador': 2382, 'Paraguay': 2381,
  // Group C
  'Germany': 25, 'Japan': 2389, 'New Zealand': 2393,
  // Group D
  'Brazil': 6, 'Colombia': 2391, 'South Korea': 2390,
  // Group E
  'Argentina': 26, 'Mexico': 2386, 'Australia': 2388,
  // Group F
  'Spain': 9, 'Denmark': 21, 'Serbia': 14,
  // Group G
  'England': 10, 'Senegal': 2385, 'Poland': 24,
  // Group H
  'France': 2, 'Iran': 2387, 'Costa Rica': 2380,
  // Group I
  'Netherlands': 1118, 'Canada': 2379, 'Cameroon': 2392,
  // Group J
  'Belgium': 1, 'Uruguay': 2378, 'Saudi Arabia': 2377,
  // Group K
  'Croatia': 3, 'Nigeria': 2394, 'Panama': 2395,
  // Group L
  'Italy': 768, 'Chile': 2396, 'Switzerland': 15
}

// Map API-Football position to our format
function mapPosition(pos) {
  if (!pos) return null
  const p = pos.toLowerCase()
  if (p.includes('goalkeeper')) return 'Goalkeeper'
  if (p.includes('defender')) return 'Defender'
  if (p.includes('midfielder')) return 'Midfielder'
  if (p.includes('attacker') || p.includes('forward')) return 'Attacker'
  return pos
}

async function supabaseFetch(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': options.method === 'POST' ? 'return=minimal' : undefined,
      ...options.headers
    }
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Supabase error ${res.status}: ${text}`)
  }
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

async function apiFootballFetch(endpoint) {
  const res = await fetch(`https://v3.football.api-sports.io${endpoint}`, {
    headers: {
      'x-apisports-key': API_FOOTBALL_KEY
    }
  })
  if (!res.ok) {
    throw new Error(`API-Football error ${res.status}: ${await res.text()}`)
  }
  const data = await res.json()
  return data.response || []
}

async function main() {
  console.log('🏟️  Seed Players — Porra Mundial 2026\n')

  // 1. Fetch existing teams from Supabase to map names → IDs
  console.log('📋 Fetching teams from Supabase...')
  const teams = await supabaseFetch('teams?select=id,name')
  const teamNameToId = {}
  teams.forEach(t => { teamNameToId[t.name] = t.id })
  console.log(`   Found ${teams.length} teams\n`)

  // 2. Check how many players already exist
  const existingPlayers = await supabaseFetch('players?select=id&limit=1', {
    headers: { 'Prefer': 'count=exact', 'Range-Unit': 'items', 'Range': '0-0' }
  })
  console.log('   Existing players will be skipped if name+team match\n')

  // 3. Fetch squads from API-Football
  let totalInserted = 0
  let totalSkipped = 0
  const teamNames = Object.keys(WORLD_CUP_TEAMS)

  for (let i = 0; i < teamNames.length; i++) {
    const teamName = teamNames[i]
    const apiTeamId = WORLD_CUP_TEAMS[teamName]
    const supabaseTeamId = teamNameToId[teamName]

    if (!supabaseTeamId) {
      console.log(`⚠️  ${teamName}: not found in Supabase teams table, skipping`)
      totalSkipped++
      continue
    }

    console.log(`[${i + 1}/${teamNames.length}] 🔄 Fetching squad for ${teamName} (API ID: ${apiTeamId})...`)

    try {
      const squadData = await apiFootballFetch(`/players/squads?team=${apiTeamId}`)

      if (!squadData.length || !squadData[0].players) {
        console.log(`   ⚠️  No squad data found for ${teamName}`)
        continue
      }

      const players = squadData[0].players
      const playersToInsert = players.map(p => ({
        name: p.name,
        team_id: supabaseTeamId,
        position: mapPosition(p.position),
        api_football_id: p.id
      }))

      // Bulk insert
      const res = await fetch(`${SUPABASE_URL}/rest/v1/players`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal,resolution=ignore-duplicates'
        },
        body: JSON.stringify(playersToInsert)
      })

      if (!res.ok) {
        const errText = await res.text()
        console.log(`   ❌ Error inserting: ${errText}`)
      } else {
        console.log(`   ✅ Inserted ${players.length} players`)
        totalInserted += players.length
      }

      // Rate limiting: wait 1.5s between requests to stay within free tier
      if (i < teamNames.length - 1) {
        await new Promise(r => setTimeout(r, 1500))
      }
    } catch (err) {
      console.log(`   ❌ Error: ${err.message}`)
    }
  }

  console.log(`\n🎉 Done! Inserted ${totalInserted} players total.`)
  if (totalSkipped > 0) {
    console.log(`⚠️  ${totalSkipped} teams not found in Supabase (check team names match)`)
  }

  // 4. Final count
  try {
    const allPlayers = await supabaseFetch('players?select=id')
    console.log(`📊 Total players in DB: ${allPlayers.length}`)
  } catch (e) {
    // ignore
  }
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
