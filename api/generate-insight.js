/**
 * Vercel Serverless Function — Generate daily insight with Gemini
 *
 * GET /api/generate-insight → Returns today's cached insight, or generates new
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

const BOT365_ID = 'b0365b03-65b0-365b-0365-b0365b036500' // kept for data filtering only

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
  const profiles = await supaFetch('profiles?select=id,full_name,nickname,has_paid') || []
  const matches = await supaFetch(
    'matches?status=eq.finished&select=id,home_score,away_score,match_date,group_name,home_team:teams!matches_home_team_id_fkey(name),away_team:teams!matches_away_team_id_fkey(name)&order=match_date.desc&limit=10'
  ) || []

  // Filter out Bot365 + use nicknames where available
  const nameById = {}
  profiles.forEach(p => { nameById[p.id] = p.nickname || p.full_name })
  const filteredLeaderboard = leaderboard
    .filter(r => r.user_id !== BOT365_ID)
    .map(r => ({ ...r, full_name: nameById[r.user_id] || r.full_name }))

  // === Today's leaderboard movements ===
  // For each user, sum points earned from matches finished TODAY → that's
  // their gain → yesterday's points = total - gain → yesterday's rank.
  // Compare to today's rank to get the position delta.
  const todayISO = new Date().toISOString().slice(0, 10)
  const todayMatchIds = matches
    .filter(m => m.match_date && m.match_date.startsWith(todayISO))
    .map(m => m.id)

  let movements = []
  if (todayMatchIds.length > 0) {
    const todayPreds = await supaFetch(
      `predictions?match_id=in.(${todayMatchIds.join(',')})&select=user_id,points_earned`
    ) || []
    const gains = {}
    todayPreds.forEach(p => {
      if (p.user_id === BOT365_ID) return
      gains[p.user_id] = (gains[p.user_id] || 0) + (p.points_earned || 0)
    })

    // Today's rank = current order. Yesterday's rank = order by (total - gain).
    const todayRank = {}
    filteredLeaderboard.forEach((r, i) => { todayRank[r.user_id] = i + 1 })

    const yesterdayOrdered = [...filteredLeaderboard]
      .map(r => ({ ...r, ypts: r.total_points - (gains[r.user_id] || 0) }))
      .sort((a, b) => b.ypts - a.ypts || (b.exact_hits || 0) - (a.exact_hits || 0))
    const yesterdayRank = {}
    yesterdayOrdered.forEach((r, i) => { yesterdayRank[r.user_id] = i + 1 })

    movements = filteredLeaderboard
      .map(r => ({
        name: nameById[r.user_id] || r.full_name,
        gain: gains[r.user_id] || 0,
        delta: (yesterdayRank[r.user_id] || 0) - (todayRank[r.user_id] || 0)
      }))
      .filter(m => m.gain > 0 || m.delta !== 0)
      .sort((a, b) => b.gain - a.gain)
      .slice(0, 6)
  }

  // Fetch latest news headlines for pre-tournament context
  let newsHeadlines = []
  try {
    const newsFeeds = [
      'https://e00-marca.uecdn.es/rss/futbol/mundial.xml',
      'https://feeds.bbci.co.uk/sport/football/rss.xml'
    ]
    for (const feedUrl of newsFeeds) {
      const feedRes = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}`)
      if (feedRes.ok) {
        const feedData = await feedRes.json()
        if (feedData.items) {
          newsHeadlines.push(...feedData.items.slice(0, 5).map(i => i.title))
        }
      }
    }
  } catch (e) {
    // News fetch failed — continue without
  }

  return {
    leaderboard: filteredLeaderboard.slice(0, 15),
    recentMatches: matches,
    todayMovements: movements,
    totalParticipants: profiles.filter(p => p.id !== BOT365_ID).length,
    newsHeadlines: newsHeadlines.slice(0, 8),
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

    const recentResults = data.recentMatches.slice(0, 5).map(m =>
      `${m.home_team?.name} ${m.home_score}-${m.away_score} ${m.away_team?.name}`
    ).join(', ')

    const movementsText = data.todayMovements?.length
      ? data.todayMovements.map(m => {
          const arrow = m.delta > 0 ? `▲${m.delta}` : m.delta < 0 ? `▼${Math.abs(m.delta)}` : '·'
          return `- ${m.name}: +${m.gain} pts (${arrow})`
        }).join('\n')
      : '- (sin partidos resueltos hoy)'

    prompt = `Eres un teletipo de prensa deportiva. Redactas la crónica diaria de una porra amistosa del Mundial 2026.

REGLAS NO NEGOCIABLES:
- MÁXIMO 100 PALABRAS TOTALES. Cuenta dos veces antes de devolver. Si pasas, recorta.
- Tono: factual, neutro, periodístico. Como una nota de agencia. No conversacional, no opinativo, no emotivo.
- PROHIBIDO usar: "¡", "?!", "atención", "ojo", "tensión", "presagio", "imparable", "candidato", "sin duda", "no te pierdas", "se mueve", "se calienta", emojis decorativos.
- Permitido: máximo 1 emoji (solo si aporta dato: 🏆 líder, ⚽ gol). Mejor sin emoji.
- Datos concretos > adjetivos. Nombres > genéricos.

CONTEXTO (${today}):
- ${data.totalParticipants} participantes.

CLASIFICACIÓN ACTUAL (top 5):
${top5}

MOVIMIENTOS DE HOY (puntos sumados + cambio de posición):
${movementsText}

RESULTADOS RECIENTES:
${recentResults}

ESTRUCTURA EXACTA:
- Titular (5-8 palabras, sin signos de exclamación).
- 1 párrafo: cambios en la clasificación con nombres concretos y deltas (▲n / ▼n).
- 1 línea: dato concreto del día (resultado, racha, hito).
- 1 línea de cierre: lo que viene mañana o efecto sobre el liderato.

Devuelve solo el texto. Sin markdown, sin comillas, sin meta-comentarios.`
  } else {
    const newsContext = data.newsHeadlines.length > 0
      ? `\nÚLTIMAS NOTICIAS DEL MUNDO DEL FÚTBOL:\n${data.newsHeadlines.map((h, i) => `${i + 1}. ${h}`).join('\n')}`
      : ''

    prompt = `Eres un teletipo de prensa deportiva. Redactas la crónica diaria de una porra amistosa del Mundial 2026.

REGLAS NO NEGOCIABLES:
- MÁXIMO 100 PALABRAS TOTALES. Cuenta dos veces antes de devolver. Si pasas, recorta.
- Tono: factual, neutro, periodístico. No conversacional, no opinativo, no emotivo.
- PROHIBIDO usar: "¡", "¿", "?!", "atención", "ojo", "tensión se palpa", "pitido inicial", "presagio", "vuelta de la esquina", "apuesta segura", "cuenta atrás", "imparable", "candidatos", "sin duda", "no te pierdas", "espectáculo", emojis decorativos.
- Permitido: máximo 1 emoji (solo si aporta dato: 🏆 líder, ⚽ gol). Mejor sin emoji.

CONTEXTO (${today}):
- ${data.totalParticipants} participantes inscritos.
- Mundial empieza 11 de junio 2026.
- Plazo predicciones grupos + especiales: cierra 9 junio (48h antes).
${newsContext}

ESTRUCTURA EXACTA:
- Titular (5-8 palabras, sin signos de exclamación).
- 1 párrafo: noticia relevante y su efecto concreto sobre alguna predicción especial. Nombres concretos.
- 1 línea final: días que faltan para el cierre de predicciones.

Devuelve solo el texto. Sin markdown, sin comillas, sin meta-comentarios.`
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.45, maxOutputTokens: 300 }
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
