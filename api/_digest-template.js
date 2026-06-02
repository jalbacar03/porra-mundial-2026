/**
 * Email digest template — shared between /api/send-daily-digest and
 * /api/preview-digest. Pure functions, no side effects.
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

export function buildSubject({ rankLabel, delta, posDelta, hasMatches, hasPredictions }) {
  if (!hasMatches) return `📰 Porra Mundial 26 — Crónica del día`
  if (delta > 0 && posDelta > 0) {
    return `+${delta} pts · ▲${posDelta} posiciones · Estás ${rankLabel}º`
  }
  if (delta > 0) return `+${delta} pts · Estás ${rankLabel}º — Porra Mundial 26`
  if (hasPredictions) return `Estás ${rankLabel}º · Resumen del día`
  return `Estás ${rankLabel}º — Porra Mundial 26`
}

/**
 * @param {object} d - data
 * @param d.userName - "Pedro Albacar"
 * @param d.rankLabel - "8" or "T8"
 * @param d.totalParticipants - 100
 * @param d.points - 24
 * @param d.exactHits - 5
 * @param d.delta - puntos ganados ayer
 * @param d.posDelta - +3 (subió 3 posiciones), -1 (bajó 1)
 * @param d.yourMatches - [{ home, away, homeScore, awayScore, predHome, predAway, pts, status: 'exact'|'sign'|'miss'|'nopred' }]
 * @param d.movements - { up: [{name, posDelta, fromRank, toRank}, ...], down: [...] }
 * @param d.yMatches - [{ home_team, away_team, home_score, away_score, consensus: { totalPreds, signCorrect, exactCorrect, signPct, exactPct } }]
 * @param d.top10 - [{ user_id, full_name, total_points, exact_hits }]
 * @param d.rankInfo - { user_id: { rank, label } }
 * @param d.insightText - "..."
 * @param d.appUrl - "https://porramundial2026.app"
 */
export function buildEmailHTML(d) {
  const {
    userName, rankLabel, totalParticipants, points, exactHits,
    delta, posDelta, yourMatches, movements, yMatches,
    top10, rankInfo, insightText, appUrl,
  } = d

  const dateStr = new Date().toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Porra Mundial 26 — Resumen diario</title>
</head>
<body style="margin:0;padding:0;background:#0f1218;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#fff">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px">

    ${renderHeader(dateStr)}
    ${renderGreeting(userName)}
    ${renderHero({ rankLabel, totalParticipants, points, exactHits, delta, posDelta })}
    ${yourMatches?.length > 0 ? renderYourMatches(yourMatches) : ''}
    ${(movements?.up?.length || movements?.down?.length) ? renderMovements(movements) : ''}
    ${yMatches?.length > 0 ? renderResults(yMatches) : ''}
    ${yMatches?.length > 0 ? renderConsensus(yMatches) : ''}
    ${renderTop10(top10, rankInfo)}
    ${insightText ? renderInsight(insightText) : ''}
    ${renderCTA(appUrl)}
    ${renderFooter()}

  </div>
</body>
</html>`
}

function renderHeader(dateStr) {
  return `
    <div style="text-align:center;margin-bottom:24px">
      <div style="font-size:13px;color:#9b9eaa;text-transform:uppercase;letter-spacing:1.4px;font-weight:700;margin-bottom:4px">
        Porra Mundial <span style="color:#ffcc00">26</span>
      </div>
      <div style="font-size:13px;color:#6b6e78">${escapeHtml(dateStr)}</div>
    </div>`
}

function renderGreeting(userName) {
  const firstName = userName.split(' ')[0]
  return `
    <div style="font-size:18px;font-weight:700;margin-bottom:6px;color:#fff">
      Buenos días, ${escapeHtml(firstName)} 👋
    </div>`
}

function renderHero({ rankLabel, totalParticipants, points, exactHits, delta, posDelta }) {
  const posDeltaBadge = posDelta && posDelta !== 0
    ? `<span style="display:inline-block;margin-left:10px;padding:4px 10px;border-radius:20px;background:rgba(0,0,0,0.25);color:${posDelta > 0 ? '#4ade80' : '#ff6b6b'};font-size:12px;font-weight:700">
         ${posDelta > 0 ? `▲ ${posDelta}` : `▼ ${Math.abs(posDelta)}`}
       </span>`
    : ''
  return `
    <div style="background:linear-gradient(135deg,#00392a,#00643d);border-radius:14px;padding:20px;margin:16px 0">
      <div style="font-size:10px;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:1.4px;font-weight:700;margin-bottom:6px">
        Tu posición
      </div>
      <div style="font-size:42px;font-weight:800;color:#fff;line-height:1">
        ${rankLabel}<span style="font-size:18px;color:rgba(255,255,255,0.5);font-weight:500">/${totalParticipants}</span>
        ${posDeltaBadge}
      </div>
      <table style="margin-top:14px;width:100%"><tr>
        <td style="vertical-align:top;padding-right:16px">
          <div style="font-size:24px;font-weight:800;color:#fff;line-height:1">${points}</div>
          <div style="font-size:9px;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:1.2px;font-weight:700;margin-top:4px">Puntos</div>
        </td>
        <td style="vertical-align:top;padding-right:16px">
          <div style="font-size:24px;font-weight:800;color:#ffcc00;line-height:1">${exactHits}</div>
          <div style="font-size:9px;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:1.2px;font-weight:700;margin-top:4px">Exactos</div>
        </td>
        ${delta > 0 ? `
        <td style="vertical-align:top">
          <div style="font-size:24px;font-weight:800;color:#4ade80;line-height:1">+${delta}</div>
          <div style="font-size:9px;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:1.2px;font-weight:700;margin-top:4px">Vs. ayer</div>
        </td>` : ''}
      </tr></table>
    </div>`
}

function renderYourMatches(yourMatches) {
  const STATUS_LABEL = {
    exact: { icon: '✓', label: 'Acertaste exacto', color: '#4ade80' },
    sign:  { icon: '↕', label: 'Signo correcto',   color: '#ffcc00' },
    miss:  { icon: '✗', label: 'Fallaste',         color: '#ff6b6b' },
    nopred:{ icon: '—', label: 'Sin predicción',   color: '#6b6e78' },
  }
  const rows = yourMatches.map(m => {
    const s = STATUS_LABEL[m.status] || STATUS_LABEL.miss
    const predStr = m.status === 'nopred' ? 'No predijiste' : `Tu predicción: ${m.predHome}-${m.predAway}`
    return `
      <tr><td style="padding:10px 0;border-bottom:0.5px solid rgba(255,255,255,0.06)">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:14px;color:#fff">${escapeHtml(m.home)}</span>
          <span style="font-size:16px;font-weight:800;color:#ffcc00">${m.homeScore}-${m.awayScore}</span>
          <span style="font-size:14px;color:#fff">${escapeHtml(m.away)}</span>
        </div>
        <div style="margin-top:4px;display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:11px;color:#9b9eaa">${predStr}</span>
          <span style="font-size:11px;font-weight:700;color:${s.color}">${s.icon} ${s.label}${m.pts ? ` · +${m.pts} pts` : ''}</span>
        </div>
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
    <div style="background:#1a1d26;border-radius:12px;padding:18px;margin:16px 0;border:1px solid rgba(255,255,255,0.05)">
      <div style="font-size:11px;color:#9b9eaa;text-transform:uppercase;letter-spacing:1.4px;font-weight:700;margin-bottom:10px">
        Tu jornada ⚽
      </div>
      <table style="width:100%;border-collapse:collapse">${rows}</table>
      <div style="margin-top:12px;padding-top:10px;border-top:0.5px solid rgba(255,255,255,0.06);font-size:12px;color:#d4d6dd;text-align:center">
        ${yourMatches.length} partido${yourMatches.length !== 1 ? 's' : ''} ·
        <strong style="color:#4ade80">${summary.ex} exacto${summary.ex !== 1 ? 's' : ''}</strong> ·
        <strong style="color:#ffcc00">${summary.si} signo${summary.si !== 1 ? 's' : ''}</strong> ·
        <strong style="color:#ff6b6b">${summary.mi} fallo${summary.mi !== 1 ? 's' : ''}</strong>
        ${summary.np ? ` · <span style="color:#6b6e78">${summary.np} sin predecir</span>` : ''}
        · <strong style="color:#fff">+${summary.pts} pts</strong>
      </div>
    </div>`
}

function renderMovements(movements) {
  const renderList = (items, up) => items.map((m, i) => `
    <tr><td style="padding:6px 0;font-size:13px;color:${up ? '#4ade80' : '#ff6b6b'}">
      ${i === 0 ? (up ? '🔥 ' : '📉 ') : ''}${up ? '▲' : '▼'} ${Math.abs(m.posDelta)}
      <span style="color:#fff;margin-left:8px;font-weight:500">${escapeHtml(m.name)}</span>
      <span style="color:#6b6e78;font-size:11px;margin-left:6px">${m.fromRank}º→${m.toRank}º</span>
    </td></tr>
  `).join('')

  return `
    <div style="background:#1a1d26;border-radius:12px;padding:18px;margin:16px 0;border:1px solid rgba(255,255,255,0.05)">
      <div style="font-size:11px;color:#9b9eaa;text-transform:uppercase;letter-spacing:1.4px;font-weight:700;margin-bottom:10px">
        Movimientos del día
      </div>
      <table style="width:100%;border-collapse:collapse"><tr>
        <td style="vertical-align:top;width:50%;padding-right:8px">
          <div style="font-size:10px;color:#4ade80;font-weight:700;margin-bottom:4px;text-transform:uppercase;letter-spacing:1px">Subieron</div>
          <table style="width:100%">${renderList(movements.up || [], true)}</table>
        </td>
        <td style="vertical-align:top;width:50%;padding-left:8px;border-left:0.5px solid rgba(255,255,255,0.06)">
          <div style="font-size:10px;color:#ff6b6b;font-weight:700;margin-bottom:4px;text-transform:uppercase;letter-spacing:1px">Bajaron</div>
          <table style="width:100%">${renderList(movements.down || [], false)}</table>
        </td>
      </tr></table>
    </div>`
}

function renderResults(yMatches) {
  const rows = yMatches.map(m => `
    <tr>
      <td style="padding:8px 0;font-size:14px;color:#fff">
        ${m.home_team?.flag_url ? `<img src="${m.home_team.flag_url}" alt="" width="20" height="14" style="vertical-align:middle;margin-right:6px;border-radius:2px">` : ''}
        ${escapeHtml(m.home_team?.name || '?')}
      </td>
      <td style="padding:8px 12px;font-size:16px;font-weight:800;color:#ffcc00;text-align:center;white-space:nowrap">
        ${m.home_score ?? '?'} - ${m.away_score ?? '?'}
      </td>
      <td style="padding:8px 0;font-size:14px;color:#fff;text-align:right">
        ${escapeHtml(m.away_team?.name || '?')}
        ${m.away_team?.flag_url ? `<img src="${m.away_team.flag_url}" alt="" width="20" height="14" style="vertical-align:middle;margin-left:6px;border-radius:2px">` : ''}
      </td>
    </tr>`).join('')

  return `
    <div style="background:#1a1d26;border-radius:12px;padding:18px;margin:16px 0;border:1px solid rgba(255,255,255,0.05)">
      <div style="font-size:11px;color:#9b9eaa;text-transform:uppercase;letter-spacing:1.4px;font-weight:700;margin-bottom:10px">
        Resultados del día
      </div>
      <table style="width:100%;border-collapse:collapse">${rows}</table>
    </div>`
}

function renderConsensus(yMatches) {
  const rows = yMatches.map(m => {
    const c = m.consensus || { totalPreds: 0, signPct: 0, exactPct: 0 }
    const teaserBig = c.signPct >= 60
    const teaserSmall = c.signPct <= 20
    let teaser = ''
    if (teaserBig) teaser = ' <span style="color:#4ade80;font-size:10px">· la mayoría lo vio</span>'
    else if (teaserSmall) teaser = ' <span style="color:#ff6b6b;font-size:10px">· sorpresón ⚠️</span>'
    return `
      <tr><td style="padding:10px 0;border-bottom:0.5px solid rgba(255,255,255,0.06)">
        <div style="font-size:13px;color:#fff;font-weight:500;margin-bottom:4px">
          ${escapeHtml(m.home_team?.name || '?')} ${m.home_score}-${m.away_score} ${escapeHtml(m.away_team?.name || '?')}
        </div>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
          <span style="font-size:11px;color:#9b9eaa">${c.signPct}% signo · ${c.exactPct}% exacto</span>
          ${teaser}
        </div>
        <div style="height:6px;background:rgba(255,255,255,0.05);border-radius:3px;overflow:hidden;position:relative">
          <div style="width:${c.signPct}%;height:100%;background:#ffcc00"></div>
          <div style="position:absolute;left:0;top:0;width:${c.exactPct}%;height:100%;background:#4ade80"></div>
        </div>
        <div style="font-size:10px;color:#6b6e78;margin-top:4px">${c.totalPreds} predicciones</div>
      </td></tr>`
  }).join('')

  return `
    <div style="background:#1a1d26;border-radius:12px;padding:18px;margin:16px 0;border:1px solid rgba(255,255,255,0.05)">
      <div style="font-size:11px;color:#9b9eaa;text-transform:uppercase;letter-spacing:1.4px;font-weight:700;margin-bottom:10px">
        Cómo predijo el grupo
      </div>
      <table style="width:100%;border-collapse:collapse">${rows}</table>
    </div>`
}

function renderTop10(top10, rankInfo) {
  const rows = top10.map((u, i) => {
    const ri = rankInfo[u.user_id] || { label: `${i + 1}` }
    const medalColor = i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : '#9b9eaa'
    return `
      <tr>
        <td style="padding:8px 4px;width:30px;font-size:13px;font-weight:700;color:${medalColor};text-align:center">
          ${ri.label}
        </td>
        <td style="padding:8px 4px;font-size:14px;color:#fff;font-weight:${i === 0 ? '700' : '500'}">
          ${escapeHtml(u.full_name)}
        </td>
        <td style="padding:8px 4px;font-size:14px;font-weight:800;color:#fff;text-align:right">
          ${u.total_points || 0}
        </td>
      </tr>`
  }).join('')

  return `
    <div style="background:#1a1d26;border-radius:12px;padding:18px;margin:16px 0;border:1px solid rgba(255,255,255,0.05)">
      <div style="font-size:11px;color:#9b9eaa;text-transform:uppercase;letter-spacing:1.4px;font-weight:700;margin-bottom:10px">
        Top 10
      </div>
      <table style="width:100%;border-collapse:collapse">${rows}</table>
    </div>`
}

function renderInsight(insightText) {
  return `
    <div style="background:#1a1d26;border-radius:12px;padding:18px;margin:16px 0;border:1px solid rgba(255,204,0,0.18)">
      <div style="font-size:11px;color:#ffcc00;text-transform:uppercase;letter-spacing:1.4px;font-weight:700;margin-bottom:10px">
        📰 Crónica del día
      </div>
      <div style="font-size:14px;line-height:1.55;color:#d4d6dd">
        ${escapeHtml(insightText)}
      </div>
    </div>`
}

function renderCTA(appUrl) {
  return `
    <div style="text-align:center;margin:28px 0">
      <a href="${appUrl}" style="display:inline-block;background:#00904f;color:#fff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:10px;font-size:15px">
        Ver clasificación completa →
      </a>
    </div>`
}

function renderFooter() {
  return `
    <div style="text-align:center;font-size:11px;color:#6b6e78;line-height:1.6;margin-top:32px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.05)">
      Recibes este email porque participas en la Porra Mundial 26.<br>
      Si no quieres recibir el resumen diario, responde a este email con "STOP".
    </div>`
}
