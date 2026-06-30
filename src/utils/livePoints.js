// Puntos del CUADRO REAL de una predicción para un partido (provisional en vivo).
// Refleja exactamente la regla de puntuación:
//   - Grupos / amistosos: 3 si resultado exacto, 1 si solo el signo (1X2), 0 si no.
//   - Eliminatorias: +2 por el resultado a 90' + 1 por "quién avanza" (el equipo que
//     va por delante coincide con tu pase). En EMPATE no hay +1 (no hay nadie que
//     pase todavía) — el "+1 por signo" de grupos NO aplica en eliminatorias.
// No incluye CC (cuadro ciego): eso es por usuario, no por predicción de partido,
// y se calcula aparte (RPC live_provisional_points / scoreBracketPicks).
const NON_KO = ['group', 'friendly', 'test']

export function matchPredictionPoints(pred, match) {
  if (!pred || !match) return 0
  const ph = pred.predicted_home, pa = pred.predicted_away
  if (ph == null || pa == null) return 0
  const h = match.home_score ?? 0
  const a = match.away_score ?? 0
  const isKnockout = match.stage && !NON_KO.includes(match.stage)

  if (!isKnockout) {
    if (ph === h && pa === a) return 3
    return Math.sign(ph - pa) === Math.sign(h - a) ? 1 : 0
  }

  // Eliminatorias
  let pts = 0
  if (ph === h && pa === a) pts += 2
  if (h !== a) {
    const leader = h > a ? match.home_team_id : match.away_team_id
    const predAdv = ph > pa ? match.home_team_id
                  : ph < pa ? match.away_team_id
                  : (pred.predicted_advancer_id ?? null)
    if (predAdv != null && leader != null && predAdv === leader) pts += 1
  }
  return pts
}
