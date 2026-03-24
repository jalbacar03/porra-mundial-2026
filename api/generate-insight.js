/**
 * Vercel Serverless Function — Generate daily insight with Gemini
 *
 * GET /api/generate-insight → Returns today's cached insight, or generates new
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

const BOT365_ID = 'b0365b03-65b0-365b-0365-b0365b036500'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST')
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (!GEMINI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Missing env vars', details: {
      gemini: !!GEMINI_API_KEY, supaUrl: !!SUPABASE_URL, supaKey: !!SUPABASE_SERVICE_KEY
    }})
  }

  const today = new Date().toISOString().split('T')[0]

  try {
    // Check cache first
    const cached = await supaFetch(`daily_insights?date=eq.${today}&select=*&limit=1`)
    if (cached && cached.length > 0) {
      return res.status(200).json({ insight: cached[0].content, date: cached[0].date, cached: true })
    }

    // Generate new
    const data = await gatherData()
    const insight = await generateWithGemini(data)

    // Save to cache (INSERT, ignore if duplicate)
    const saveRes = await fetch(`${SUPABASE_URL}/rest/v1/daily_insights`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ date: today, content: insight })
    })

    if (!saveRes.ok) {
      // Cache save failed but insight was generated — still return it
      console.warn('Cache save failed:', await saveRes.text())
    }

    return res.status(200).json({ insight, date: today, cached: false })
  } catch (err) {
    console.error('Error:', err.message || err)
    return res.status(500).json({ error: 'Error generando insight', details: err.message })
  }
}

async function supaFetch(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
    }
  })
  if (!r.ok) return null
  return r.json()
}

async function gatherData() {
  const leaderboard = await supaFetch('leaderboard?select=*&order=total_points.desc&limit=20') || []
  const profiles = await supaFetch('profiles?select=id,full_name,has_paid') || []
  const matches = await supaFetch(
    'matches?status=eq.finished&select=id,home_score,away_score,match_date,group_name,home_team:teams!matches_home_team_id_fkey(name),away_team:teams!matches_away_team_id_fkey(name)&order=match_date.desc&limit=10'
  ) || []

  const bot365 = leaderboard.find(r => r.user_id === BOT365_ID)
  const paidParticipants = profiles.filter(p => p.has_paid).length

  return {
    leaderboard: leaderboard.slice(0, 15),
    recentMatches: matches,
    bot365,
    totalParticipants: profiles.length,
    paidParticipants,
    pot: paidParticipants * 25 * 0.8,
    hasMatchesPlayed: matches.length > 0
  }
}

async function generateWithGemini(data) {
  const today = new Date().toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  let prompt

  if (data.hasMatchesPlayed) {
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
    prompt = `Eres el comentarista de una porra de fútbol del Mundial 2026 entre amigos. Tu estilo es divertido, cercano y con toques de humor deportivo. Hoy es ${today}.

DATOS DE LA PORRA:
- ${data.totalParticipants} participantes registrados (${data.paidParticipants} pagados)
- Bote actual en premios: ${data.pot}€
- El Mundial empieza el 11 de junio de 2026
- Hay 20 apuestas pre-torneo abiertas (campeón, goleador, selección revelación, etc.)
- Bot365 🤖 ya ha completado todas sus apuestas — es la referencia a batir

Genera una crónica pre-torneo en español (máximo 150 palabras) que incluya:
1. Un titular llamativo con emoji
2. Estado de la porra (cuántos van, cuántos faltan por pagar, bote)
3. Hype sobre las apuestas pre-torneo que quedan por rellenar
4. Mención a Bot365 como rival a batir
5. Cierra con una frase motivadora tipo cuenta atrás

Formato: texto plano con emojis, sin markdown ni HTML. Párrafos cortos.`
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.9, maxOutputTokens: 500 }
      })
    }
  )

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Gemini error ${response.status}: ${errText}`)
  }

  const result = await response.json()
  return result.candidates?.[0]?.content?.parts?.[0]?.text || 'Sin insight disponible hoy.'
}
