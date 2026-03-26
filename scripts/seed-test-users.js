/**
 * Seed 10 test participants with random predictions
 *
 * Creates fake profiles, match predictions, and pre-tournament bet entries
 * to populate Stats, Leaderboard, and other views for testing.
 *
 * Usage:
 *   SUPABASE_URL=xxx SUPABASE_KEY=xxx node scripts/seed-test-users.js
 *
 * To clean up later:
 *   SUPABASE_URL=xxx SUPABASE_KEY=xxx node scripts/seed-test-users.js --clean
 */

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing env vars. Usage: SUPABASE_URL=xxx SUPABASE_KEY=xxx node scripts/seed-test-users.js')
  process.exit(1)
}

// 10 test user UUIDs (deterministic so we can clean up)
const TEST_USERS = [
  { id: 'aaaaaaaa-1111-4000-a000-000000000001', full_name: 'Carlos García', nickname: 'Carlitos' },
  { id: 'aaaaaaaa-1111-4000-a000-000000000002', full_name: 'María López', nickname: 'Mari' },
  { id: 'aaaaaaaa-1111-4000-a000-000000000003', full_name: 'Pedro Sánchez', nickname: 'Pedrito' },
  { id: 'aaaaaaaa-1111-4000-a000-000000000004', full_name: 'Ana Martínez', nickname: 'Ani' },
  { id: 'aaaaaaaa-1111-4000-a000-000000000005', full_name: 'Luis Fernández', nickname: 'Luisito' },
  { id: 'aaaaaaaa-1111-4000-a000-000000000006', full_name: 'Elena Ruiz', nickname: 'Ele' },
  { id: 'aaaaaaaa-1111-4000-a000-000000000007', full_name: 'Diego Torres', nickname: 'Dieguito' },
  { id: 'aaaaaaaa-1111-4000-a000-000000000008', full_name: 'Laura Navarro', nickname: 'Lau' },
  { id: 'aaaaaaaa-1111-4000-a000-000000000009', full_name: 'Pablo Jiménez', nickname: 'Pablito' },
  { id: 'aaaaaaaa-1111-4000-a000-000000000010', full_name: 'Sofía Moreno', nickname: 'Sofi' }
]

async function supaFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  })
  if (!res.ok && options.method !== 'DELETE') {
    const text = await res.text()
    console.error(`Error ${res.status} on ${path}: ${text}`)
    return null
  }
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

async function supaInsert(table, data) {
  return fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal,resolution=merge-duplicates'
    },
    body: JSON.stringify(data)
  })
}

async function supaDelete(table, filter) {
  return fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: 'DELETE',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': 'return=minimal'
    }
  })
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randScore() {
  // Weighted: 0-2 most common, 3-4 rare
  const weights = [30, 35, 20, 10, 5]
  const r = Math.random() * 100
  let cumulative = 0
  for (let i = 0; i < weights.length; i++) {
    cumulative += weights[i]
    if (r < cumulative) return i
  }
  return 1
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

async function createAuthUser(user) {
  // Create user in Supabase Auth via Admin API
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      id: user.id,
      email: `${user.nickname.toLowerCase()}@test-porra.com`,
      password: 'testpassword123',
      email_confirm: true,
      user_metadata: { full_name: user.full_name }
    })
  })
  if (!res.ok) {
    const text = await res.text()
    // Ignore if user already exists
    if (text.includes('already') || text.includes('duplicate')) return true
    console.error(`  Error creating auth user ${user.nickname}: ${text}`)
    return false
  }
  return true
}

async function deleteAuthUser(userId) {
  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  })
}

async function clean() {
  console.log('🧹 Cleaning up test users...\n')
  const ids = TEST_USERS.map(u => u.id)
  const idFilter = `user_id=in.(${ids.join(',')})`

  await supaDelete('predictions', idFilter)
  console.log('  Deleted predictions')

  await supaDelete('pre_tournament_entries', idFilter)
  console.log('  Deleted pre-tournament entries')

  await supaDelete('bracket_picks', idFilter)
  console.log('  Deleted bracket picks')

  // Delete profiles
  await supaDelete('profiles', `id=in.(${ids.join(',')})`)
  console.log('  Deleted profiles')

  // Delete auth users
  for (const user of TEST_USERS) {
    await deleteAuthUser(user.id)
  }
  console.log('  Deleted auth users')

  console.log('\n✅ Cleanup complete!')
}

async function seed() {
  console.log('🌱 Seeding 10 test participants...\n')

  // 1. Create auth users first (profiles FK requires auth.users)
  console.log('👤 Creating auth users...')
  for (const user of TEST_USERS) {
    const ok = await createAuthUser(user)
    if (ok) console.log(`  ✅ ${user.nickname}`)
  }
  console.log('')

  // 2. Update profiles (auto-created by Supabase trigger on auth user creation)
  console.log('📝 Updating profiles...')
  for (const u of TEST_USERS) {
    await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${u.id}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        full_name: u.full_name,
        nickname: u.nickname,
        has_paid: true,
        is_admin: false
      })
    })
  }
  console.log(`  ✅ Updated ${TEST_USERS.length} profiles\n`)

  // 2. Get all group matches
  const matches = await supaFetch(
    'matches?stage=eq.group&select=id,match_date,group_name,home_team:teams!matches_home_team_id_fkey(name),away_team:teams!matches_away_team_id_fkey(name)&order=match_date'
  )
  if (!matches || matches.length === 0) {
    console.error('No matches found!')
    return
  }
  console.log(`📋 Found ${matches.length} group matches\n`)

  // 3. Generate predictions for each user
  console.log('⚽ Generating match predictions...')
  const allPredictions = []

  for (const user of TEST_USERS) {
    for (const match of matches) {
      allPredictions.push({
        user_id: user.id,
        match_id: match.id,
        predicted_home: randScore(),
        predicted_away: randScore()
      })
    }
  }

  // Insert in batches of 500
  for (let i = 0; i < allPredictions.length; i += 500) {
    const batch = allPredictions.slice(i, i + 500)
    const res = await supaInsert('predictions', batch)
    if (!res.ok) {
      console.error(`  Error batch ${i}: ${await res.text()}`)
    }
  }
  console.log(`  ✅ Inserted ${allPredictions.length} predictions\n`)

  // 4. Generate pre-tournament bet entries
  console.log('🎯 Generating pre-tournament bets...')
  const bets = await supaFetch('pre_tournament_bets?is_active=eq.true&select=id,slug,input_type,config,category&order=sort_order')
  const teams = await supaFetch('teams?select=id,name')

  if (!bets || !teams) {
    console.log('  ⚠️ No bets or teams found, skipping')
    return
  }

  const teamIds = teams.map(t => t.id)
  const teamNames = teams.map(t => t.name)

  // Popular player names for player bets
  const PLAYERS = [
    'K. Mbappé', 'L. Messi', 'Neymar Jr', 'E. Haaland', 'Vini Jr',
    'K. De Bruyne', 'J. Bellingham', 'L. Yamal', 'C. Pulisic', 'R. Lewandowski',
    'H. Kane', 'B. Saka', 'P. Foden', 'A. Griezmann', 'R. Dias',
    'Pedri', 'Rodri', 'D. Álvarez', 'A. Morata', 'S. Mané'
  ]

  const GOALKEEPERS = [
    'T. Courtois', 'E. Martínez', 'M. ter Stegen', 'Alisson',
    'G. Donnarumma', 'J. Pickford', 'U. Simón', 'M. Maignan'
  ]

  const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']

  let entryCount = 0

  for (const user of TEST_USERS) {
    for (const bet of bets) {
      let value = null
      let answer = null

      switch (bet.slug) {
        case 'my_champion':
        case 'revelation':
        case 'disappointment':
        case 'least_conceded_team':
        case 'most_cards_team':
          value = { team_id: pickRandom(teamIds) }
          answer = pickRandom(teamNames)
          break
        case 'finalists':
          const f = [pickRandom(teamIds), pickRandom(teamIds)]
          value = { teams: f }
          answer = f.map(id => teams.find(t => t.id === id)?.name).join(', ')
          break
        case 'semi_finalists':
          const s = Array.from({ length: 4 }, () => pickRandom(teamIds))
          value = { teams: s }
          answer = s.map(id => teams.find(t => t.id === id)?.name).join(', ')
          break
        case 'quarter_finalists':
          const q = Array.from({ length: 8 }, () => pickRandom(teamIds))
          value = { teams: q }
          answer = q.map(id => teams.find(t => t.id === id)?.name).join(', ')
          break
        case 'round_of_16':
          const r16 = Array.from({ length: 16 }, () => pickRandom(teamIds))
          value = { teams: r16 }
          answer = r16.map(id => teams.find(t => t.id === id)?.name).join(', ')
          break
        case 'round_of_32':
          const r32 = Array.from({ length: 32 }, () => pickRandom(teamIds))
          value = { teams: r32 }
          answer = r32.map(id => teams.find(t => t.id === id)?.name).join(', ')
          break
        case 'top_scorer':
        case 'top_assists':
        case 'player_3_goals':
        case 'player_5_goals':
        case 'first_scorer':
          value = { player_name: pickRandom(PLAYERS) }
          answer = value.player_name
          break
        case 'best_goalkeeper':
          value = { player_name: pickRandom(GOALKEEPERS) }
          answer = value.player_name
          break
        case 'most_goals_group':
        case 'least_goals_group':
          value = { group: pickRandom(GROUPS) }
          answer = `Grupo ${value.group}`
          break
        case 'total_red_cards':
          const ranges = ['0-3', '4-7', '8-11', '12+']
          value = { range: pickRandom(ranges) }
          answer = value.range
          break
        case 'any_hat_trick':
        case 'any_5_goal_thrashing':
          const yn = pickRandom(['yes', 'no'])
          value = { answer: yn }
          answer = yn === 'yes' ? 'Sí' : 'No'
          break
        default:
          // Generic fallback
          value = { answer: 'test' }
          answer = 'test'
      }

      if (value) {
        const res = await supaInsert('pre_tournament_entries', {
          user_id: user.id,
          bet_id: bet.id,
          value,
          answer
        })
        if (res.ok) entryCount++
      }
    }
    console.log(`  ✅ ${user.nickname}`)
  }

  console.log(`\n🎉 Done! Created ${TEST_USERS.length} users, ${allPredictions.length} predictions, ${entryCount} bet entries`)
}

// Main
const isClean = process.argv.includes('--clean')
;(isClean ? clean() : seed()).catch(err => { console.error(err); process.exit(1) })
