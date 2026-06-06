/**
 * POST /api/admin-bot365 — Guarda predicciones de partidos de Bot365.
 * Solo admin. Escribe vía service role (el cliente no puede por RLS).
 *
 * Body: { preds: [{ match_id, home, away }] }
 *   home/away enteros 0..20. null/'' → ignora esa fila.
 */
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const BOT365_ID = 'b0365b03-65b0-365b-0365-b0365b036500'

async function supaFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(options.headers || {}),
    },
  })
  if (!res.ok) return null
  return res.json().catch(() => null)
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return res.status(500).json({ error: 'env missing' })

  // Auth: SOLO admin (JWT). Verificamos is_admin server-side.
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const u = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${token}` },
    })
    if (!u.ok) return res.status(401).json({ error: 'Unauthorized' })
    const user = await u.json()
    const prof = await supaFetch(`/rest/v1/profiles?id=eq.${user.id}&select=is_admin`)
    if (!prof?.[0]?.is_admin) return res.status(403).json({ error: 'Solo admin' })
  } catch {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  let body
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {}) } catch { body = {} }
  const preds = Array.isArray(body.preds) ? body.preds : []
  if (preds.length === 0) return res.status(400).json({ error: 'Sin predicciones' })

  let saved = 0, skipped = 0
  for (const p of preds) {
    const h = Number(p.home), a = Number(p.away)
    if (!Number.isInteger(h) || !Number.isInteger(a) || h < 0 || a < 0 || h > 20 || a > 20) { skipped++; continue }
    const patched = await supaFetch(
      `/rest/v1/predictions?user_id=eq.${BOT365_ID}&match_id=eq.${p.match_id}`,
      { method: 'PATCH', body: JSON.stringify({ predicted_home: h, predicted_away: a }) }
    )
    if (!patched || patched.length === 0) {
      await supaFetch('/rest/v1/predictions', {
        method: 'POST',
        body: JSON.stringify({ user_id: BOT365_ID, match_id: p.match_id, predicted_home: h, predicted_away: a }),
      })
    }
    saved++
  }

  return res.status(200).json({ saved, skipped })
}
