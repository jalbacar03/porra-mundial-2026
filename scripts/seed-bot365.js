/**
 * Seed Bot365 predictions — based on betting favorites
 *
 * Bot365 is a fictional participant that predicts the most likely
 * results according to bookmaker odds. It serves as a benchmark
 * for how hard it is to beat the bookies.
 *
 * Usage:
 *   SUPABASE_URL=xxx SUPABASE_KEY=xxx node scripts/seed-bot365.js
 */

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing env vars.')
  process.exit(1)
}

const BOT365_ID = 'b0365b03-65b0-365b-0365-b0365b036500'

async function supaFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.method === 'POST' ? { 'Prefer': 'return=minimal,resolution=ignore-duplicates' } : {}),
      ...options.headers
    }
  })
  if (!res.ok && options.method !== 'DELETE') {
    console.error(`Error ${res.status}: ${await res.text()}`)
    return null
  }
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

// Typical bookmaker predictions for World Cup group stage
// Based on historical odds patterns for similar matchups
// Format: { teamStrength } — higher = stronger team
const TEAM_STRENGTH = {
  // Tier 1 — Tournament favorites
  'Brasil': 95, 'Francia': 94, 'Argentina': 93, 'Inglaterra': 92,
  'España': 91, 'Alemania': 90,
  // Tier 2 — Strong contenders
  'Portugal': 87, 'Países Bajos': 86, 'Bélgica': 85, 'Italia': 84,
  'Croacia': 83, 'Uruguay': 82,
  // Tier 3 — Solid teams
  'Colombia': 78, 'México': 77, 'Estados Unidos': 76, 'Suiza': 75,
  'Japón': 74, 'Corea del Sur': 73, 'Senegal': 72, 'Marruecos': 71,
  // Tier 4 — Mid-range
  'Ecuador': 67, 'Australia': 66, 'Irán': 65, 'Canadá': 64,
  'Panamá': 62, 'Arabia Saudí': 61, 'Paraguay': 60,
  // Tier 5 — Underdogs
  'Nueva Zelanda': 55,
  // Placeholders
  'Ganador Playoff UEFA A': 65, 'Ganador Playoff UEFA B': 65,
  'Ganador Playoff UEFA C': 65, 'Ganador Playoff UEFA D': 65,
  'Ganador Repesca Intercontinental 1': 58, 'Ganador Repesca Intercontinental 2': 58
}

// Default strength for unknown teams
const DEFAULT_STRENGTH = 60

function predictMatch(homeTeam, awayTeam) {
  const homeStr = TEAM_STRENGTH[homeTeam] || DEFAULT_STRENGTH
  const awayStr = TEAM_STRENGTH[awayTeam] || DEFAULT_STRENGTH

  // Home advantage bump (+3)
  const diff = (homeStr + 3) - awayStr

  // Generate predicted score based on strength difference
  if (diff > 20) {
    // Strong favorite at home: 2-0 or 3-0
    return diff > 28 ? { home: 3, away: 0 } : { home: 2, away: 0 }
  } else if (diff > 10) {
    // Moderate favorite: 2-1 or 1-0
    return diff > 15 ? { home: 2, away: 1 } : { home: 1, away: 0 }
  } else if (diff > 3) {
    // Slight favorite: 1-0
    return { home: 1, away: 0 }
  } else if (diff > -3) {
    // Very close: 1-1
    return { home: 1, away: 1 }
  } else if (diff > -10) {
    // Away slight favorite: 0-1
    return { home: 0, away: 1 }
  } else if (diff > -20) {
    // Away moderate favorite: 1-2 or 0-1
    return diff < -15 ? { home: 1, away: 2 } : { home: 0, away: 1 }
  } else {
    // Away strong favorite: 0-2 or 0-3
    return diff < -28 ? { home: 0, away: 3 } : { home: 0, away: 2 }
  }
}

async function main() {
  console.log('🤖 Bot365 — Seeding predictions\n')

  // 1. Verify Bot365 profile exists
  const profile = await supaFetch(`profiles?id=eq.${BOT365_ID}&select=id,full_name`)
  if (!profile || profile.length === 0) {
    console.error('❌ Bot365 profile not found! Create it first.')
    process.exit(1)
  }
  console.log(`✅ Found profile: ${profile[0].full_name}\n`)

  // 2. Get all group matches with team names
  const matches = await supaFetch(
    'matches?stage=eq.group&select=id,match_date,group_name,home_team:teams!matches_home_team_id_fkey(name),away_team:teams!matches_away_team_id_fkey(name)&order=match_date'
  )
  console.log(`📋 Found ${matches.length} group matches\n`)

  // 3. Clear existing Bot365 predictions
  await fetch(`${SUPABASE_URL}/rest/v1/predictions?user_id=eq.${BOT365_ID}`, {
    method: 'DELETE',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': 'return=minimal'
    }
  })
  console.log('🗑️  Cleared existing predictions\n')

  // 4. Generate and insert predictions
  const predictions = []
  for (const match of matches) {
    const homeName = match.home_team?.name || 'Unknown'
    const awayName = match.away_team?.name || 'Unknown'
    const result = predictMatch(homeName, awayName)

    predictions.push({
      user_id: BOT365_ID,
      match_id: match.id,
      predicted_home: result.home,
      predicted_away: result.away
    })

    console.log(`  ${homeName} vs ${awayName} → ${result.home}-${result.away}`)
  }

  // Bulk insert
  const res = await fetch(`${SUPABASE_URL}/rest/v1/predictions`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(predictions)
  })

  if (!res.ok) {
    console.error(`\n❌ Error inserting: ${await res.text()}`)
  } else {
    console.log(`\n🎉 Inserted ${predictions.length} predictions for Bot365!`)
  }

  // 5. Also seed pre-tournament bets
  console.log('\n📊 Seeding pre-tournament bets...\n')

  const bets = await supaFetch('pre_tournament_bets?is_active=eq.true&select=id,slug,input_type,config&order=sort_order')
  const teams = await supaFetch('teams?select=id,name')
  const teamByName = {}
  teams.forEach(t => { teamByName[t.name] = t.id })

  // Bot365's pre-tournament picks (bookmaker favorites)
  const preTournamentPicks = {
    'my_champion': { team_id: teamByName['Brasil'] },
    'finalists': { teams: [teamByName['Brasil'], teamByName['Francia']] },
    'semi_finalists': { teams: [teamByName['Brasil'], teamByName['Francia'], teamByName['Argentina'], teamByName['Inglaterra']] },
    'quarter_finalists': { teams: [
      teamByName['Brasil'], teamByName['Francia'], teamByName['Argentina'], teamByName['Inglaterra'],
      teamByName['España'], teamByName['Alemania'], teamByName['Portugal'], teamByName['Países Bajos']
    ]},
    'round_of_16': { teams: [
      teamByName['Brasil'], teamByName['Francia'], teamByName['Argentina'], teamByName['Inglaterra'],
      teamByName['España'], teamByName['Alemania'], teamByName['Portugal'], teamByName['Países Bajos'],
      teamByName['Bélgica'], teamByName['Italia'], teamByName['Croacia'], teamByName['Uruguay'],
      teamByName['Colombia'], teamByName['México'], teamByName['Estados Unidos'], teamByName['Suiza']
    ]},
    'revelation': { team_id: teamByName['Marruecos'] },
    'disappointment': { team_id: teamByName['Bélgica'] },
    'top_scorer': { player_name: 'K. Mbappé' },
    'top_assists': { player_name: 'K. De Bruyne' },
    'player_3_goals': { player_name: 'K. Mbappé' },
    'player_5_goals': { player_name: 'K. Mbappé' },
    'first_scorer': { player_name: 'C. Pulisic' },
    'best_goalkeeper': { player_name: 'T. Courtois' },
    'most_goals_group': { group: 'D' },
    'least_goals_group': { group: 'L' },
    'least_conceded_team': { team_id: teamByName['Francia'] },
    'most_cards_team': { team_id: teamByName['Argentina'] },
    'total_red_cards': { range: '4-7' },
    'any_hat_trick': { answer: 'yes' },
    'any_5_goal_thrashing': { answer: 'yes' }
  }

  // Clear existing Bot365 pre-tournament entries
  await fetch(`${SUPABASE_URL}/rest/v1/pre_tournament_entries?user_id=eq.${BOT365_ID}`, {
    method: 'DELETE',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': 'return=minimal'
    }
  })

  let betCount = 0
  for (const bet of bets) {
    const pick = preTournamentPicks[bet.slug]
    if (!pick) {
      console.log(`  ⚠️  No pick for ${bet.slug}`)
      continue
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/pre_tournament_entries`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        user_id: BOT365_ID,
        bet_id: bet.id,
        value: pick
      })
    })

    if (res.ok) {
      console.log(`  ✅ ${bet.slug}`)
      betCount++
    } else {
      console.log(`  ❌ ${bet.slug}: ${await res.text()}`)
    }
  }

  console.log(`\n🎉 Bot365 complete! ${predictions.length} match predictions + ${betCount} pre-tournament bets`)
}

main().catch(err => { console.error(err); process.exit(1) })
