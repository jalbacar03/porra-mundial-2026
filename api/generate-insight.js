/**
 * Vercel Serverless Function — Generate daily insight with Gemini
 *
 * GET /api/generate-insight → Returns today's cached insight, or generates new
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

const BOT365_ID = 'b0365b03-65b0-365b-0365-b0365b036500' // kept for data filtering only

// Nombre real formateado (espejo de src/utils/nickname.js → formatRealName).
// Replicado aquí porque las funciones serverless no comparten el bundle de src.
const NAME_OVERRIDES = {
  'José Antonio Menéndez': 'José Menéndez',
  'Gonzalo de Parellada Menéndez': 'Gonzalo de Parellada',
  'Jose Maria Guitart': 'Jose María Guitart',
  'Álvaro García Magro': 'Álvaro García M.',
}
function formatRealNameServer(fullName) {
  if (!fullName) return ''
  if (NAME_OVERRIDES[fullName]) return NAME_OVERRIDES[fullName]
  const PREPS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'da', 'do', 'di'])
  const isInitial = (w) => /^[a-záéíóúñ]\.?$/i.test(w)
  const tc = (w) => w ? w.split('-').map(s => s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s).join('-') : w
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return ''
  const real = parts.filter(p => !PREPS.has(p.toLowerCase()) && !isInitial(p))
  if (!real.length) return tc(parts[0])
  if (real.length === 1) return tc(real[0])
  return `${tc(real[0])} ${tc(real[1])}`
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST')
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (!GEMINI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Missing env vars', details: {
      gemini: !!GEMINI_API_KEY, supaUrl: !!SUPABASE_URL, supaKey: !!SUPABASE_SERVICE_KEY
    }})
  }

  // Auth gate: require a valid Supabase user JWT. The endpoint generates a
  // Gemini completion when there's no cached insight for the day, so leaving
  // it open let anonymous callers burn Gemini quota. Any logged-in user is
  // fine (not admin-only) — the Dashboard shows the insight to everyone.
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const uRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${token}` }
    })
    if (!uRes.ok) return res.status(401).json({ error: 'Unauthorized' })
    const user = await uRes.json()
    if (!user?.id) return res.status(401).json({ error: 'Unauthorized' })
  } catch {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const today = new Date().toISOString().split('T')[0]

  try {
    // Check cache first
    const cached = await supaFetch(`daily_insights?date=eq.${today}&select=*&limit=1`)
    if (cached && cached.length > 0) {
      return res.status(200).json({
        insight: cached[0].content,
        insightLong: cached[0].content_long || null,
        date: cached[0].date,
        cached: true
      })
    }

    // Generate new — Gemini returns { short, long } as JSON
    const data = await gatherData()
    const { short, long } = await generateWithGemini(data)

    // Save both versions to cache
    const saveRes = await fetch(`${SUPABASE_URL}/rest/v1/daily_insights`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ date: today, content: short, content_long: long })
    })

    if (!saveRes.ok) {
      console.warn('Cache save failed:', await saveRes.text())
    }

    return res.status(200).json({
      insight: short,
      insightLong: long,
      date: today,
      cached: false
    })
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
  // Solo partidos del MUNDIAL (excluye friendly/test). Sin esto, al terminar
  // los amistosos de La Liguilla la crónica creía que el Mundial ya empezó y
  // sacaba un "líder" con 0 puntos (mateosanllehi, primero de la lista).
  const matches = await supaFetch(
    'matches?status=eq.finished&stage=not.in.(friendly,test)&select=id,home_score,away_score,match_date,group_name,home_team:teams!matches_home_team_id_fkey(name),away_team:teams!matches_away_team_id_fkey(name)&order=match_date.desc&limit=10'
  ) || []

  // Filter out Bot365 + nombre REAL (consistente con el resto de la app).
  const nameById = {}
  profiles.forEach(p => { nameById[p.id] = formatRealNameServer(p.full_name) || p.full_name })
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

  // Days remaining until predictions deadline (10 jun 2026, 17:00 UTC)
  const DEADLINE = new Date('2026-06-10T17:00:00Z')
  const daysToDeadline = Math.max(0, Math.ceil((DEADLINE - new Date()) / 86400000))

  return {
    leaderboard: filteredLeaderboard.slice(0, 15),
    recentMatches: matches,
    todayMovements: movements,
    // Solo participantes admitidos en la porra (has_paid), no todo perfil registrado.
    totalParticipants: profiles.filter(p => p.has_paid && p.id !== BOT365_ID).length,
    newsHeadlines: newsHeadlines.slice(0, 8),
    hasMatchesPlayed: matches.length > 0,
    daysToDeadline
  }
}

async function generateWithGemini(data) {
  const today = new Date().toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  // Shared context block — same data for both prompts
  let context
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
    context = `CONTEXTO (${today}):
- ${data.totalParticipants} participantes.

CLASIFICACIÓN ACTUAL (top 5):
${top5}

MOVIMIENTOS DE HOY (puntos sumados + cambio de posición):
${movementsText}

RESULTADOS RECIENTES:
${recentResults}

DÍAS HASTA EL CIERRE DE PREDICCIONES: ${data.daysToDeadline}`
  } else {
    const newsContext = data.newsHeadlines.length > 0
      ? `\nÚLTIMAS NOTICIAS DEL FÚTBOL:\n${data.newsHeadlines.map((h, i) => `${i + 1}. ${h}`).join('\n')}`
      : ''
    context = `CONTEXTO:
- Hoy: ${today}
- ${data.totalParticipants} participantes inscritos
- EL MUNDIAL TODAVÍA NO HA EMPEZADO. El primer partido es el 11 de junio de 2026. NO se ha jugado NINGÚN partido del Mundial todavía.
- Plazo de predicciones: cierra el 10 de junio (faltan ${data.daysToDeadline} días)
${newsContext}

DÍAS HASTA EL CIERRE DE PREDICCIONES: ${data.daysToDeadline}`
  }

  const noMatchesRule = !data.hasMatchesPlayed
    ? `\n- CRÍTICO: el Mundial NO ha empezado. NO menciones resultados, debuts, victorias ni derrotas de ningún partido del Mundial (no existen aún). NO inventes que una selección ha ganado o perdido. Los titulares de noticias son contexto previo (amistosos, fichajes, lesiones, expectativas) — NO los presentes como resultados del Mundial. Habla solo de expectativas, favoritos y el cierre de predicciones.`
    : ''

  const styleRules = `REGLAS:
- Tono profesional pero cercano. Cero hype. Datos > adjetivos. Nombres > genéricos.
- PROHIBIDO: exclamaciones múltiples, "¡atención!", "ojo", "tensión", "presagio", "imparable", "sin duda", emojis decorativos, signos "¡".
- Permitido máximo 1 emoji solo si aporta dato (🏆 líder, ⚽ gol).
- Usa exactamente ${data.daysToDeadline} días para el cierre. No inventes.${noMatchesRule}`

  const shortPrompt = `Redacta la SHORT del día — el extracto que un usuario lee de un vistazo en el dashboard.

${styleRules}

LONGITUD: entre 45 y 55 palabras. Cuenta antes de devolver. Si bajas de 45 añade un dato más. No pases de 55.

ESTRUCTURA:
- Titular (6-8 palabras).
- 2-3 frases concretas con nombres, números o deltas.

${context}

Devuelve solo el texto plano. Sin markdown, sin comillas externas, sin meta-comentarios.`

  const longPrompt = `Redacta la LONG del día — crónica completa estilo The Economist en español. La leerá quien pulse "leer más" desde el dashboard.

${styleRules}

LONGITUD: entre 280 y 360 palabras. Cuenta antes de devolver. Si bajas de 280 expande análisis. No pases de 360.

ESTRUCTURA:
- Titular analítico (8-12 palabras), distinto al de la versión corta.
- 4-5 párrafos breves separados por línea en blanco.
- Estructura: contexto de la noticia o jornada → análisis del impacto sobre las predicciones (campeón, revelación, goleador, líder de la porra) → comparativa o patrón histórico relevante → implicación para los participantes.
- Frases comparativas explícitas ("a diferencia de…", "frente a…"), datos numéricos o porcentajes cuando proceda, ironía mesurada permitida.
- Tono editorial: periodista de fondo, no comentarista de partido. Como The Economist o un buen columnista de El País.
- Cierra mencionando que ${data.daysToDeadline === 0 ? 'hoy es el último día' : data.daysToDeadline === 1 ? 'queda 1 día' : `quedan ${data.daysToDeadline} días`} para el cierre del plazo. Respeta exactamente esa forma (singular/plural).

${context}

Devuelve solo el texto plano. Sin markdown, sin comillas externas, sin meta-comentarios.`

  // Two parallel calls — one focused on each version. Simpler & more reliable
  // than asking Gemini to produce both inside a JSON schema (it kept truncating).
  const [shortText, longText] = await Promise.all([
    callGemini(shortPrompt, 250),
    callGemini(longPrompt, 1200)
  ])

  return {
    short: shortText.trim() || 'Sin crónica disponible hoy.',
    long: longText.trim() || shortText.trim()
  }
}

async function callGemini(prompt, maxTokens) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.55, maxOutputTokens: maxTokens }
      })
    }
  )
  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Gemini error ${response.status}: ${errText}`)
  }
  const result = await response.json()
  return result.candidates?.[0]?.content?.parts?.[0]?.text || ''
}
