/**
 * Email digest template — shared between /api/send-daily-digest and
 * /api/preview-digest. Pure functions, no side effects.
 *
 * Tema claro (fondo blanco) para máxima legibilidad en cualquier cliente
 * de email. Orden: HEADLINE → CLASIFICACIÓN (lo más importante) →
 * tu posición → tu jornada → movimientos → resultados → consensus → crónica.
 */

export function escapeHtml(s) {
  if (s == null) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// Paleta tema claro
const PAL = {
  bg:         '#ffffff',
  bgSoft:     '#f7f8fa',
  card:       '#ffffff',
  border:     '#e5e7eb',
  borderSoft: '#eef0f3',
  text:       '#1a1d26',
  textMuted:  '#5b6271',
  textDim:    '#8a92a5',
  green:      '#00904f',
  greenSoft:  '#e8f6ee',
  red:        '#e74c3c',
  redSoft:    '#fdecea',
  gold:       '#d4a014',
  goldSoft:   '#fff5d6',
  blue:       '#2563eb',
  blueSoft:   '#e8efff',
  gold1:      '#d4a014',
  silver:     '#9ca3af',
  bronze:     '#a16931',
}

export function buildSubject({ mode = 'mundial', rankLabel, delta, posDelta, hasMatches, hasPredictions }) {
  const tag = mode === 'friendly' ? 'La Liguilla' : 'Porra Mundial 26'
  if (!hasMatches) return `${tag} — Crónica del día`
  if (delta > 0 && posDelta > 0) return `${tag} · +${delta} pts · ▲${posDelta} posiciones · Estás ${rankLabel}º`
  if (delta > 0) return `${tag} · +${delta} pts · Estás ${rankLabel}º`
  if (hasPredictions) return `${tag} · Estás ${rankLabel}º · Resumen del día`
  return `${tag} · Estás ${rankLabel}º`
}

/**
 * Generador de headline contextual. Resume el día en una frase.
 * Ej: "Pedro lidera La Liguilla con 6 pts · ningún exacto en los amistosos"
 *     "Ignacio sigue 1º con 24 pts · 3 acertaron España-Croacia"
 */
function buildHeadline({ mode, top10, yMatches, totalPredsByMatch }) {
  const tag = mode === 'friendly' ? 'La Liguilla' : 'el Mundial'
  if (!top10 || top10.length === 0) return `Resumen del día en ${tag}`
  const leader = top10[0]
  const pts = leader.total_points || 0
  // Si nadie tiene puntos todavía: headline más genérica
  if (pts === 0) {
    if (yMatches?.length) return `Empate técnico en cabeza · ${yMatches.length} partido${yMatches.length !== 1 ? 's' : ''} ayer`
    return `${tag} aún sin movimientos`
  }
  const exactCount = yMatches?.reduce((n, m) => n + (m.consensus?.exactCorrect || 0), 0)
  if (exactCount > 0) {
    return `${escapeHtml(leader.full_name)} lidera con ${pts} pts · ${exactCount} acertaron exacto`
  }
  return `${escapeHtml(leader.full_name)} lidera con ${pts} pts`
}

export function buildEmailHTML(d) {
  const {
    mode = 'mundial',
    userName, rankLabel, totalParticipants, points, exactHits,
    delta, posDelta, yourMatches, movements, yMatches,
    top10, rankInfo, insightText, appUrl,
  } = d

  const dateStr = new Date().toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
  const title = mode === 'friendly' ? 'La Liguilla — Resumen diario' : 'Porra Mundial 26 — Resumen diario'
  const accent = mode === 'friendly' ? PAL.blue : PAL.green
  const headline = buildHeadline({ mode, top10, yMatches })

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:${PAL.bgSoft};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${PAL.text}">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px;background:${PAL.bg}">

    ${renderHeader(dateStr, mode, accent)}
    ${renderHeadline(headline, accent)}
    ${renderTop10(top10, rankInfo, accent)}
    ${renderHero({ rankLabel, totalParticipants, points, exactHits, delta, posDelta, accent, userName })}
    ${yourMatches?.length > 0 ? renderYourMatches(yourMatches) : ''}
    ${yMatches?.length > 0 ? renderResults(yMatches) : ''}
    ${(movements?.up?.length || movements?.down?.length) ? renderMovements(movements) : ''}
    ${yMatches?.length > 0 ? renderConsensus(yMatches) : ''}
    ${insightText ? renderInsight(insightText, accent) : ''}
    ${renderCTA(appUrl, accent)}
    ${renderFooter()}

  </div>
</body>
</html>`
}

function renderHeader(dateStr, mode, accent) {
  const tag = mode === 'friendly'
    ? `🏆 La Liguilla · <span style="color:${accent}">Pre-Mundial</span>`
    : `Porra Mundial <span style="color:${accent}">26</span>`
  return `
    <div style="text-align:center;padding-bottom:18px;border-bottom:1px solid ${PAL.borderSoft};margin-bottom:18px">
      <div style="font-size:12px;color:${PAL.textMuted};text-transform:uppercase;letter-spacing:1.4px;font-weight:800;margin-bottom:4px">
        ${tag}
      </div>
      <div style="font-size:12px;color:${PAL.textDim}">${escapeHtml(dateStr)}</div>
    </div>`
}

function renderHeadline(text, accent) {
  return `
    <div style="margin:0 0 20px;padding:14px 16px;background:${accent}10;border-left:3px solid ${accent};border-radius:6px">
      <div style="font-size:9px;color:${accent};text-transform:uppercase;letter-spacing:1.4px;font-weight:800;margin-bottom:4px">
        Titular
      </div>
      <div style="font-size:16px;font-weight:700;color:${PAL.text};line-height:1.35">
        ${text}
      </div>
    </div>`
}

function renderTop10(top10, rankInfo, accent) {
  const rows = (top10 || []).map((u, i) => {
    const ri = rankInfo?.[u.user_id] || { label: `${i + 1}` }
    const medalColor = i === 0 ? PAL.gold1 : i === 1 ? PAL.silver : i === 2 ? PAL.bronze : PAL.textMuted
    return `
      <tr>
        <td style="padding:8px 4px;width:32px;font-size:13px;font-weight:800;color:${medalColor};text-align:center;border-bottom:1px solid ${PAL.borderSoft}">
          ${ri.label}
        </td>
        <td style="padding:8px 4px;font-size:14px;color:${PAL.text};font-weight:${i === 0 ? '700' : '500'};border-bottom:1px solid ${PAL.borderSoft}">
          ${escapeHtml(u.full_name)}
        </td>
        <td style="padding:8px 4px;font-size:15px;font-weight:800;color:${PAL.text};text-align:right;border-bottom:1px solid ${PAL.borderSoft};font-variant-numeric:tabular-nums">
          ${u.total_points || 0}
        </td>
      </tr>`
  }).join('')

  return `
    <div style="background:${PAL.card};border:1px solid ${PAL.border};border-radius:12px;padding:16px;margin:0 0 16px">
      <div style="font-size:11px;color:${PAL.textMuted};text-transform:uppercase;letter-spacing:1.4px;font-weight:800;margin-bottom:8px">
        Clasificación · Top 10
      </div>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse">${rows}</table>
    </div>`
}

function renderHero({ rankLabel, totalParticipants, points, exactHits, delta, posDelta, accent, userName }) {
  const firstName = userName?.includes(' ') ? userName.split(' ')[0] : userName
  const posDeltaBadge = posDelta && posDelta !== 0
    ? `<span style="display:inline-block;padding:3px 9px;border-radius:12px;background:${posDelta > 0 ? PAL.greenSoft : PAL.redSoft};color:${posDelta > 0 ? PAL.green : PAL.red};font-size:11px;font-weight:800;vertical-align:middle;margin-left:8px">
         ${posDelta > 0 ? `▲ ${posDelta}` : `▼ ${Math.abs(posDelta)}`}
       </span>`
    : ''
  return `
    <div style="background:${PAL.card};border:1px solid ${PAL.border};border-radius:12px;padding:16px;margin:0 0 16px">
      <div style="font-size:11px;color:${PAL.textMuted};text-transform:uppercase;letter-spacing:1.4px;font-weight:800;margin-bottom:8px">
        Tu posición${userName ? ` · ${escapeHtml(firstName)}` : ''}
      </div>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse">
        <tr>
          <td style="vertical-align:middle;white-space:nowrap">
            <span style="font-size:36px;font-weight:800;color:${PAL.text};line-height:1;vertical-align:middle">${rankLabel}</span><span style="font-size:16px;color:${PAL.textDim};font-weight:500;vertical-align:middle">/${totalParticipants}</span>
            ${posDeltaBadge}
          </td>
        </tr>
      </table>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px;width:100%;border-collapse:collapse">
        <tr>
          <td width="33%" style="vertical-align:top">
            <div style="font-size:22px;font-weight:800;color:${PAL.text};line-height:1">${points}</div>
            <div style="font-size:9px;color:${PAL.textDim};text-transform:uppercase;letter-spacing:1.2px;font-weight:700;margin-top:4px">Puntos</div>
          </td>
          <td width="33%" style="vertical-align:top">
            <div style="font-size:22px;font-weight:800;color:${PAL.gold};line-height:1">${exactHits}</div>
            <div style="font-size:9px;color:${PAL.textDim};text-transform:uppercase;letter-spacing:1.2px;font-weight:700;margin-top:4px">Exactos</div>
          </td>
          <td width="34%" style="vertical-align:top">
            ${delta > 0 ? `
              <div style="font-size:22px;font-weight:800;color:${PAL.green};line-height:1">+${delta}</div>
              <div style="font-size:9px;color:${PAL.textDim};text-transform:uppercase;letter-spacing:1.2px;font-weight:700;margin-top:4px">Vs. ayer</div>
            ` : ''}
          </td>
        </tr>
      </table>
    </div>`
}

function renderYourMatches(yourMatches) {
  const STATUS = {
    exact:  { icon: '✓', label: 'Exacto',     color: PAL.green },
    sign:   { icon: '↕', label: 'Signo',      color: PAL.gold  },
    miss:   { icon: '✗', label: 'Fallaste',   color: PAL.red   },
    nopred: { icon: '—', label: 'Sin predicción', color: PAL.textDim },
  }
  const rows = yourMatches.map(m => {
    const s = STATUS[m.status] || STATUS.miss
    const predStr = m.status === 'nopred' ? 'No predijiste' : `Tu predicción: ${m.predHome}-${m.predAway}`
    return `
      <tr><td style="padding:10px 0;border-bottom:1px solid ${PAL.borderSoft}">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse">
          <tr>
            <td width="40%" style="font-size:14px;color:${PAL.text};text-align:left;font-weight:600">${escapeHtml(m.home)}</td>
            <td width="20%" style="font-size:16px;font-weight:800;color:${PAL.text};text-align:center;white-space:nowrap">${m.homeScore}-${m.awayScore}</td>
            <td width="40%" style="font-size:14px;color:${PAL.text};text-align:right;font-weight:600">${escapeHtml(m.away)}</td>
          </tr>
          <tr>
            <td colspan="3" style="padding-top:4px">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse">
                <tr>
                  <td style="font-size:11px;color:${PAL.textMuted};text-align:left">${predStr}</td>
                  <td style="font-size:11px;font-weight:800;color:${s.color};text-align:right;white-space:nowrap">${s.icon} ${s.label}${m.pts ? ` · +${m.pts} pts` : ''}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td></tr>`
  }).join('')

  const summary = yourMatches.reduce((a, m) => ({
    ex: a.ex + (m.status === 'exact' ? 1 : 0),
    si: a.si + (m.status === 'sign' ? 1 : 0),
    mi: a.mi + (m.status === 'miss' ? 1 : 0),
    np: a.np + (m.status === 'nopred' ? 1 : 0),
    pts: a.pts + (m.pts || 0),
  }), { ex: 0, si: 0, mi: 0, np: 0, pts: 0 })

  return `
    <div style="background:${PAL.card};border:1px solid ${PAL.border};border-radius:12px;padding:16px;margin:0 0 16px">
      <div style="font-size:11px;color:${PAL.textMuted};text-transform:uppercase;letter-spacing:1.4px;font-weight:800;margin-bottom:6px">
        Tu jornada
      </div>
      <table style="width:100%;border-collapse:collapse">${rows}</table>
      <div style="margin-top:10px;padding-top:10px;border-top:1px solid ${PAL.borderSoft};font-size:12px;color:${PAL.textMuted};text-align:center">
        ${yourMatches.length} partido${yourMatches.length !== 1 ? 's' : ''} ·
        <strong style="color:${PAL.green}">${summary.ex} exacto${summary.ex !== 1 ? 's' : ''}</strong> ·
        <strong style="color:${PAL.gold}">${summary.si} signo${summary.si !== 1 ? 's' : ''}</strong> ·
        <strong style="color:${PAL.red}">${summary.mi} fallo${summary.mi !== 1 ? 's' : ''}</strong>
        ${summary.np ? ` · <span style="color:${PAL.textDim}">${summary.np} sin predecir</span>` : ''}
        · <strong style="color:${PAL.text}">+${summary.pts} pts</strong>
      </div>
    </div>`
}

function renderResults(yMatches) {
  const rows = yMatches.map(m => `
    <tr>
      <td style="padding:8px 0;font-size:14px;color:${PAL.text};font-weight:500">
        ${m.home_team?.flag_url ? `<img src="${m.home_team.flag_url}" alt="" width="20" height="14" style="vertical-align:middle;margin-right:6px;border-radius:2px">` : ''}
        ${escapeHtml(m.home_team?.name || '?')}
      </td>
      <td style="padding:8px 12px;font-size:15px;font-weight:800;color:${PAL.text};text-align:center;white-space:nowrap">
        ${m.home_score ?? '?'} - ${m.away_score ?? '?'}
      </td>
      <td style="padding:8px 0;font-size:14px;color:${PAL.text};text-align:right;font-weight:500">
        ${escapeHtml(m.away_team?.name || '?')}
        ${m.away_team?.flag_url ? `<img src="${m.away_team.flag_url}" alt="" width="20" height="14" style="vertical-align:middle;margin-left:6px;border-radius:2px">` : ''}
      </td>
    </tr>`).join('')

  return `
    <div style="background:${PAL.card};border:1px solid ${PAL.border};border-radius:12px;padding:16px;margin:0 0 16px">
      <div style="font-size:11px;color:${PAL.textMuted};text-transform:uppercase;letter-spacing:1.4px;font-weight:800;margin-bottom:8px">
        Resultados del día
      </div>
      <table style="width:100%;border-collapse:collapse">${rows}</table>
    </div>`
}

function renderMovements(movements) {
  const renderList = (items, up) => items.map((m, i) => `
    <tr>
      <td width="18" style="padding:5px 2px;font-size:11px;text-align:center;vertical-align:middle">${i === 0 ? (up ? '🔥' : '📉') : ''}</td>
      <td width="30" style="padding:5px 2px;font-size:12px;color:${up ? PAL.green : PAL.red};font-weight:800;text-align:left;white-space:nowrap;vertical-align:middle">
        ${up ? '▲' : '▼'} ${Math.abs(m.posDelta)}
      </td>
      <td style="padding:5px 6px;font-size:12px;color:${PAL.text};font-weight:500;vertical-align:middle">
        ${escapeHtml(m.name)}
      </td>
      <td width="64" style="padding:5px 0;font-size:11px;color:${PAL.textDim};text-align:right;white-space:nowrap;vertical-align:middle">
        ${m.fromRank}º→${m.toRank}º
      </td>
    </tr>
  `).join('')

  return `
    <div style="background:${PAL.card};border:1px solid ${PAL.border};border-radius:12px;padding:16px;margin:0 0 16px">
      <div style="font-size:11px;color:${PAL.textMuted};text-transform:uppercase;letter-spacing:1.4px;font-weight:800;margin-bottom:8px">
        Movimientos del día
      </div>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse"><tr>
        <td style="vertical-align:top;width:50%;padding-right:8px">
          <div style="font-size:10px;color:${PAL.green};font-weight:800;margin-bottom:3px;text-transform:uppercase;letter-spacing:1px">Subieron</div>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse">${renderList(movements.up || [], true)}</table>
        </td>
        <td style="vertical-align:top;width:50%;padding-left:8px;border-left:1px solid ${PAL.borderSoft}">
          <div style="font-size:10px;color:${PAL.red};font-weight:800;margin-bottom:3px;text-transform:uppercase;letter-spacing:1px">Bajaron</div>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse">${renderList(movements.down || [], false)}</table>
        </td>
      </tr></table>
    </div>`
}

function renderConsensus(yMatches) {
  const rows = yMatches.map(m => {
    const c = m.consensus || { totalPreds: 0, signPct: 0, exactPct: 0 }
    const teaserBig = c.signPct >= 60
    const teaserSmall = c.signPct <= 20
    let teaser = ''
    if (teaserBig) teaser = ` <span style="color:${PAL.green};font-size:10px;font-weight:600">· la mayoría lo vio</span>`
    else if (teaserSmall) teaser = ` <span style="color:${PAL.red};font-size:10px;font-weight:600">· sorpresón</span>`
    return `
      <tr><td style="padding:10px 0;border-bottom:1px solid ${PAL.borderSoft}">
        <div style="font-size:13px;color:${PAL.text};font-weight:600;margin-bottom:4px">
          ${escapeHtml(m.home_team?.name || '?')} ${m.home_score}-${m.away_score} ${escapeHtml(m.away_team?.name || '?')}
        </div>
        <div style="font-size:11px;color:${PAL.textMuted};margin-bottom:5px">
          ${c.signPct}% signo · ${c.exactPct}% exacto${teaser}
        </div>
        <div style="height:6px;background:${PAL.borderSoft};border-radius:3px;overflow:hidden;position:relative">
          <div style="width:${c.signPct}%;height:100%;background:${PAL.gold}"></div>
          <div style="position:absolute;left:0;top:0;width:${c.exactPct}%;height:100%;background:${PAL.green}"></div>
        </div>
        <div style="font-size:10px;color:${PAL.textDim};margin-top:4px">${c.totalPreds} predicciones</div>
      </td></tr>`
  }).join('')

  return `
    <div style="background:${PAL.card};border:1px solid ${PAL.border};border-radius:12px;padding:16px;margin:0 0 16px">
      <div style="font-size:11px;color:${PAL.textMuted};text-transform:uppercase;letter-spacing:1.4px;font-weight:800;margin-bottom:8px">
        Cómo predijo el grupo
      </div>
      <table style="width:100%;border-collapse:collapse">${rows}</table>
    </div>`
}

function renderInsight(insightText, accent) {
  return `
    <div style="background:${PAL.goldSoft};border:1px solid #f0d97b;border-radius:12px;padding:16px;margin:0 0 16px">
      <div style="font-size:11px;color:${PAL.gold};text-transform:uppercase;letter-spacing:1.4px;font-weight:800;margin-bottom:8px">
        Crónica del día
      </div>
      <div style="font-size:14px;line-height:1.55;color:${PAL.text}">
        ${escapeHtml(insightText)}
      </div>
    </div>`
}

function renderCTA(appUrl, accent) {
  return `
    <div style="text-align:center;margin:22px 0 10px">
      <a href="${appUrl}" style="display:inline-block;background:${accent};color:#fff;text-decoration:none;font-weight:800;padding:13px 28px;border-radius:8px;font-size:14px;letter-spacing:0.3px">
        Ver clasificación completa →
      </a>
    </div>`
}

function renderFooter() {
  return `
    <div style="text-align:center;font-size:11px;color:${PAL.textDim};line-height:1.6;margin-top:24px;padding-top:18px;border-top:1px solid ${PAL.borderSoft}">
      Si no quieres recibir el resumen diario, responde con "STOP".
    </div>`
}
