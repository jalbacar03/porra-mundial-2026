/**
 * Seed players from API-Football into Supabase
 *
 * Usage:
 *   SUPABASE_URL=xxx SUPABASE_KEY=xxx API_FOOTBALL_KEY=xxx node scripts/seed-players.js
 */

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_KEY
const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY

if (!SUPABASE_URL || !SUPABASE_KEY || !API_FOOTBALL_KEY) {
  console.error('Missing env vars.')
  process.exit(1)
}

// Map: Supabase team name (Spanish) → API-Football national team ID
// Found via https://v3.football.api-sports.io/teams?search=XXX
const TEAM_API_IDS = {
  'Alemania': 25,
  'Arabia Saudí': 23,
  'Argentina': 26,
  'Australia': 20,
  'Bélgica': 1,
  'Brasil': 6,
  'Canadá': 5529,
  'Colombia': 1564,
  'Corea del Sur': 17,
  'Croacia': 3,
  'Ecuador': 2382,
  'España': 9,
  'Estados Unidos': 2384,
  'Francia': 2,
  'Inglaterra': 10,
  'Irán': 22,
  'Japón': 12,
  'Marruecos': 31,
  'México': 16,
  'Nueva Zelanda': 4673,
  'Países Bajos': 1118,
  'Panamá': 11,
  'Paraguay': 2380,
  'Portugal': 27,
  'Senegal': 13,
  'Suiza': 15,
  'Uruguay': 7
}

function mapPosition(pos) {
  if (!pos) return null
  const p = pos.toLowerCase()
  if (p.includes('goalkeeper')) return 'Goalkeeper'
  if (p.includes('defender')) return 'Defender'
  if (p.includes('midfielder')) return 'Midfielder'
  if (p.includes('attacker') || p.includes('forward')) return 'Attacker'
  return pos
}

async function apiFootballFetch(endpoint) {
  const res = await fetch(`https://v3.football.api-sports.io${endpoint}`, {
    headers: { 'x-apisports-key': API_FOOTBALL_KEY }
  })
  if (!res.ok) throw new Error(`API error ${res.status}`)
  const data = await res.json()
  return data.response || []
}

async function main() {
  console.log('🏟️  Seed Players — Porra Mundial 2026\n')

  // 1. Get teams from Supabase
  console.log('📋 Fetching teams from Supabase...')
  const teamsRes = await fetch(`${SUPABASE_URL}/rest/v1/teams?select=id,name`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  })
  const teams = await teamsRes.json()
  const teamNameToId = {}
  teams.forEach(t => { teamNameToId[t.name] = t.id })
  console.log(`   Found ${teams.length} teams\n`)

  // 2. Clear existing players to avoid duplicates
  console.log('🗑️  Clearing existing players...')
  await fetch(`${SUPABASE_URL}/rest/v1/players?id=not.is.null`, {
    method: 'DELETE',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': 'return=minimal'
    }
  })
  console.log('   Done\n')

  // 3. Fetch squads
  let totalInserted = 0
  const teamNames = Object.keys(TEAM_API_IDS)

  for (let i = 0; i < teamNames.length; i++) {
    const teamName = teamNames[i]
    const apiTeamId = TEAM_API_IDS[teamName]
    const supabaseTeamId = teamNameToId[teamName]

    if (!supabaseTeamId) {
      console.log(`⚠️  "${teamName}": not found in Supabase, skipping`)
      continue
    }

    console.log(`[${i + 1}/${teamNames.length}] 🔄 ${teamName} (API ID: ${apiTeamId})...`)

    try {
      const squadData = await apiFootballFetch(`/players/squads?team=${apiTeamId}`)

      if (!squadData.length || !squadData[0].players) {
        console.log(`   ⚠️  No squad data`)
        continue
      }

      const players = squadData[0].players.map(p => ({
        name: p.name,
        team_id: supabaseTeamId,
        position: mapPosition(p.position),
        api_football_id: p.id
      }))

      const res = await fetch(`${SUPABASE_URL}/rest/v1/players`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(players)
      })

      if (!res.ok) {
        console.log(`   ❌ Error: ${await res.text()}`)
      } else {
        console.log(`   ✅ ${players.length} players`)
        totalInserted += players.length
      }

      // Rate limit
      await new Promise(r => setTimeout(r, 1500))
    } catch (err) {
      console.log(`   ❌ ${err.message}`)
    }
  }

  console.log(`\n🎉 Done! Inserted ${totalInserted} players.`)

  // Final count
  const countRes = await fetch(`${SUPABASE_URL}/rest/v1/players?select=id`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  })
  const all = await countRes.json()
  console.log(`📊 Total in DB: ${all.length}`)
}

main().catch(err => { console.error(err); process.exit(1) })
