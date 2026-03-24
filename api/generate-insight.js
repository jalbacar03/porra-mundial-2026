/**
 * Vercel Serverless Function — Generate daily insight with Gemini
 *
 * GET /api/generate-insight
 *   → Returns today's cached insight, or generates a new one if none exists
 *
 * POST /api/generate-insight  (with admin auth header)
 *   → Force-regenerates today's insight
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

const BOT365_ID = 'b0365b03-65b0-365b-0365-b0365b036500'

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()

  if (!GEMINI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Missing env vars' })
  }

  const today = new Date().toISOString().split('T')[0]

  // GET: return cached insight if exists
  if (req.method === 'GET') {
    const cached = await supaFetch(`daily_insights?date=eq.${today}&select=*&limit=1`)
    if (cached && cached.length > 0) {
      return res.status(200).json({ insight: cached[0].content, date: cached[0].date, cached: true })
    }
  }

  // Generate new insight
  try {
    const data = await gatherData()
    const insight = await generateWithGemini(data)

    // Upsert into daily_insights
    await fetch(`${SUPABASE_URL}/rest/v1/daily_insights`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({ date: today, content: insight })
    })

    return res.status(200).json({ insight, date: today, cached: false })
  } catch (err) {
    console.error('Error generating insight:', err)
    return res.status(500).json({ error: 'Error generando insight' })
  }
}

async function supaFetch(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
    }
  })
  if (!res.ok) return null
  return res.json()
}

async function gatherData() {
  // Fetch leaderboard
  const leaderboard = await supaFetch('leaderboard?select=*&order=total_points.desc&limit=20')

  // Fetch profiles for paid count
  const profiles = await supaFetch('profiles?select=id,full_name,has_paid')

  // Fetch recent finished matches with teams
  const matches = await supaFetch(
    'matches?status=eq.finished&select=id,home_score,away_score,match_date,group_name,home_team:teams!matches_home_team_id_fkey(name),away_team:teams!matches_away_team_id_fkey(name)&order=match_date.desc&limit=10'
  )

  // Fetch predictions count
  const predictions = await supaFetch('predictions?select=id&limit=1')

  // Fetch pre-tournament entries count
  const preEntries = await supaFetch('pre_tournament_entries?select=id&limit=1')

  // Bot365 stats
  const bot365 = leaderboard?.find(r => r.user_id === BOT365_ID)

  // Total participants
  const totalParticipants = profiles?.length || 0
  const paidParticipants = profiles?.filter(p => p.has_paid)?.length || 0

  return {
    leaderboard: leaderboard?.slice(0, 15) || [],
    recentMatches: matches || [],
    bot365,
    totalParticipants,
    paidParticipants,
    pot: paidParticipants * 25 * 0.8,
    hasMatchesPlayed: matches && matches.length > 0
  }
}

async function generateWithGemini(data) {
  const today = new Date().toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  let prompt

  if (data.hasMatchesPlayed) {
    // During tournament — full analysis
    const top5 = data.leaderboard.slice(0, 5).map((r, i) =>
      `${i + 1}. ${r.full_name}: ${r.total_points} pts (${r.exact_hits} exactos, ${r.sign_hits} signos)`
    ).join('\n')

    const bot365Line = data.bot365
      ? `Bot365 🤖 tiene ${data.bot365.total_points} pts (posición ${data.leaderboard.findIndex(r => r.user_id === BOT365_ID) + 1})`
      : 'Bot365 aún no tiene puntos'

    const recentResults = data.recentMatches.slice(0, 5).map(m =>
      `${m.home_team?.name} ${m.home_score}-${m.away_score} ${m.away_team?.name}`
    ).join(', ')

    prompt = `Eres el comentarista de una porra de fútbol del Mundial 2026 entre amigos. Tu estilo es divertido, cercano y con toques de humor deportivo. Hoy es ${today}.

DATOS DE LA PORRA:
- ${data.totalParticipants} participantes (${data.paidParticipants} pagados)
- Bote en premios: ${data.pot}€
- ${bot365Line}

TOP 5 CLASIFICACIÓN:
${top5}

ÚLTIMOS RESULTADOS:
${recentResults}

Genera una crónica diaria de la porra en español (máximo 200 palabras) que incluya:
1. Un titular llamativo con emoji
2. Resumen de la jornada (quién subió, quién bajó, sorpresas)
3. Comparación con Bot365 (¿la gente le está ganando o no?)
4. Un dato curioso o predicción picante
5. Cierra con una frase motivadora o graciosa

Formato: texto plano con emojis, sin markdown ni HTML. Párrafos cortos.`

  } else {
    // Pre-tournament — hype mode
    const top5 = data.leaderboard.slice(0, 5).map((r, i) =>
      `${i + 1}. ${r.full_name}`
    ).join(', ')

    prompt = `Eres el comentarista de una porra de fútbol del Mundial 2026 entre amigos. Tu estilo es divertido, cercano y con toques de humor deportivo. Hoy es ${today}.

DATOS DE LA PORRA:
- ${data.totalParticipants} participantes registrados (${data.paidParticipants} pagados)
- Bote actual en premios: ${data.pot}€
- El Mundial empieza el 11 de junio de 2026
- Hay 20 apuestas pre-torneo abiertas (campeón, goleador, etc.)
- Bot365 🤖 compite como referencia (apuestas basadas en cuotas de casas de apuestas)

Genera una crónica pre-torneo en español (máximo 150 palabras) que incluya:
1. Un titular llamativo con emoji
2. Estado de la porra (cuántos van, cuántos faltan por pagar, bote)
3. Hype sobre las apuestas pre-torneo que quedan por rellenar
4. Mención a Bot365 como rival a batir
5. Cierra con una frase motivadora tipo cuenta atrás

Formato: texto plano con emojis, sin markdown ni HTML. Párrafos cortos.`
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.9,
          maxOutputTokens: 500
        }
      })
    }
  )

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status} ${await response.text()}`)
  }

  const result = await response.json()
  return result.candidates?.[0]?.content?.parts?.[0]?.text || 'Sin insight disponible hoy.'
}
