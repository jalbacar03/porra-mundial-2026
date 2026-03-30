/**
 * Seed players from API-Football into Supabase
 *
 * Usage:
 *   SUPABASE_URL=xxx SUPABASE_KEY=xxx API_FOOTBALL_KEY=xxx node scripts/seed-players.js
 *
 * Options:
 *   --only-missing   Only seed teams that have 0 players in DB (saves API calls)
 *   --dry-run        Show what would be done without making changes
 */

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_KEY
const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY

const ONLY_MISSING = process.argv.includes('--only-missing')
const DRY_RUN = process.argv.includes('--dry-run')

if (!SUPABASE_URL || !SUPABASE_KEY || !API_FOOTBALL_KEY) {
  console.error('Missing env vars.')
  process.exit(1)
}

// Map: Supabase team name (Spanish) → API-Football national team ID
// Found via https://v3.football.api-sports.io/teams?search=XXX
// IDs must match the api_football_id column in the teams table
const TEAM_API_IDS = {
  // --- Already seeded (IDs match teams.api_football_id) ---
  'Alemania': 25,
  'Arabia Saudí': 23,
  'Argentina': 26,
  'Australia': 2388,
  'Bélgica': 1,
  'Brasil': 6,
  'Canadá': 2390,
  'Colombia': 2391,
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
  'Senegal': 2385,
  'Suiza': 15,
  'Uruguay': 7,

  // --- Previously missing teams (IDs corrected 2026-03-30) ---
  'Argelia': 1532,
  'Austria': 775,
  'Cabo Verde': 1533,
  'Costa de Marfil': 1501,
  'Curaçao': 5530,
  'Egipto': 32,
  'Escocia': 1108,
  'Ghana': 1504,
  'Haití': 2386,
  'Jordania': 1548,
  'Noruega': 1090,
  'Qatar': 1569,
  'Sudáfrica': 1531,
  'Túnez': 28,
  'Uzbekistán': 1568
  // NOTE: Placeholder teams (Ganador Playoff UEFA A/B/C/D, Ganador Repesca
  // Intercontinental 1/2) are intentionally excluded — no real squads yet.
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
  console.log('🏟️  Seed Players — Porra Mundial 2026')
  if (ONLY_MISSING) console.log('   Mode: --only-missing (skip teams that already have players)')
  if (DRY_RUN) console.log('   Mode: --dry-run (no changes will be made)')
  console.log('')

  // 1. Get teams from Supabase
  console.log('📋 Fetching teams from Supabase...')
  const teamsRes = await fetch(`${SUPABASE_URL}/rest/v1/teams?select=id,name,api_football_id`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  })
  const teams = await teamsRes.json()
  const teamNameToId = {}
  teams.forEach(t => { teamNameToId[t.name] = t.id })
  console.log(`   Found ${teams.length} teams\n`)

  // 1b. Get player counts per team (for --only-missing mode)
  let teamPlayerCounts = {}
  if (ONLY_MISSING) {
    console.log('📊 Fetching player counts per team...')
    const countsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/players?select=team_id`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      }
    )
    const allPlayers = await countsRes.json()
    allPlayers.forEach(p => {
      teamPlayerCounts[p.team_id] = (teamPlayerCounts[p.team_id] || 0) + 1
    })
    console.log('')
  }

  // 1c. Update api_football_id for teams that don't have it set yet
  console.log('🔗 Updating api_football_id for new teams...')
  let updatedTeams = 0
  for (const [teamName, apiId] of Object.entries(TEAM_API_IDS)) {
    const supabaseId = teamNameToId[teamName]
    if (!supabaseId) continue
    const existing = teams.find(t => t.name === teamName)
    if (existing && !existing.api_football_id) {
      if (DRY_RUN) {
        console.log(`   [DRY RUN] Would set api_football_id=${apiId} for ${teamName}`)
        updatedTeams++
        continue
      }
      const patchRes = await fetch(
        `${SUPABASE_URL}/rest/v1/teams?id=eq.${supabaseId}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({ api_football_id: apiId })
        }
      )
      if (patchRes.ok) {
        console.log(`   ✅ Set api_football_id=${apiId} for ${teamName}`)
        updatedTeams++
      } else {
        console.log(`   ⚠️  Failed to update ${teamName}: ${await patchRes.text()}`)
      }
    }
  }
  if (updatedTeams === 0) console.log('   All teams already have api_football_id set')
  console.log('')

  // 2. Clear existing players to avoid duplicates (skip in --only-missing mode)
  if (!ONLY_MISSING) {
    console.log('🗑️  Clearing existing players...')
    if (!DRY_RUN) {
      await fetch(`${SUPABASE_URL}/rest/v1/players?id=not.is.null`, {
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Prefer': 'return=minimal'
        }
      })
    }
    console.log('   Done\n')
  }

  // 3. Fetch squads
  let totalInserted = 0
  let skipped = 0
  const teamNames = Object.keys(TEAM_API_IDS)

  for (let i = 0; i < teamNames.length; i++) {
    const teamName = teamNames[i]
    const apiTeamId = TEAM_API_IDS[teamName]
    const supabaseTeamId = teamNameToId[teamName]

    if (!supabaseTeamId) {
      console.log(`⚠️  "${teamName}": not found in Supabase, skipping`)
      continue
    }

    // In --only-missing mode, skip teams that already have players
    if (ONLY_MISSING && (teamPlayerCounts[supabaseTeamId] || 0) > 0) {
      skipped++
      continue
    }

    console.log(`[${i + 1}/${teamNames.length}] 🔄 ${teamName} (API ID: ${apiTeamId})...`)

    if (DRY_RUN) {
      console.log(`   [DRY RUN] Would fetch squad and insert players`)
      continue
    }

    try {
      const squadData = await apiFootballFetch(`/players/squads?team=${apiTeamId}`)

      if (!squadData.length || !squadData[0].players) {
        console.log(`   ⚠️  No squad data — verify API-Football ID ${apiTeamId} for ${teamName}`)
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

      // Rate limit (API-Football free tier: 100 req/day)
      await new Promise(r => setTimeout(r, 1500))
    } catch (err) {
      console.log(`   ❌ ${err.message}`)
    }
  }

  if (ONLY_MISSING && skipped > 0) {
    console.log(`\n⏭️  Skipped ${skipped} teams that already had players`)
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
