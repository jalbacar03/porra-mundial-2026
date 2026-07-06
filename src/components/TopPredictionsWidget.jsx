import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const BOT365_ID = 'b0365b03-65b0-365b-0365-b0365b036500'
const MEDAL = ['#ffcc00', '#c8ccd4', '#cd8246', '#9a8456', '#9a8456']

/**
 * Widget de Inicio: qué ha puesto el TOP 5 para los próximos partidos.
 * Solo muestra partidos de rondas YA CERRADAS (el primer partido de la ronda ya
 * empezó) — así nunca revela picks de una ronda con el plazo abierto.
 */
export default function TopPredictionsWidget() {
  const [data, setData] = useState(null)

  useEffect(() => {
    (async () => {
      try {
        const [lbRes, profRes, matchesRes, teamsRes] = await Promise.all([
          supabase.from('leaderboard').select('user_id, full_name, total_points, exact_hits'),
          supabase.from('profiles').select('id').eq('has_paid', true),
          supabase.from('matches').select('id, stage, status, match_date, match_number, home_team_id, away_team_id, home_team:teams!matches_home_team_id_fkey(name), away_team:teams!matches_away_team_id_fkey(name)').neq('stage', 'group').neq('stage', 'friendly').neq('stage', 'test'),
          supabase.from('teams').select('id, name'),
        ])
        const paid = new Set((profRes.data || []).map(p => p.id))
        const top5 = (lbRes.data || [])
          .filter(r => paid.has(r.user_id) && r.user_id !== BOT365_ID)
          .sort((a, b) => (b.total_points - a.total_points) || ((b.exact_hits || 0) - (a.exact_hits || 0)))
          .slice(0, 5)
        const teamName = {}
        ;(teamsRes.data || []).forEach(t => { teamName[t.id] = t.name })

        // Rondas cerradas: el primer partido de la ronda ya empezó.
        const now = Date.now()
        const stageFirst = {}
        ;(matchesRes.data || []).forEach(m => {
          if (!m.match_date) return
          const ms = new Date(m.match_date).getTime()
          if (stageFirst[m.stage] == null || ms < stageFirst[m.stage]) stageFirst[m.stage] = ms
        })
        const upcoming = (matchesRes.data || [])
          .filter(m => m.status === 'scheduled' && m.match_date && new Date(m.match_date).getTime() > now)
          .filter(m => stageFirst[m.stage] != null && stageFirst[m.stage] <= now)
          .sort((a, b) => new Date(a.match_date) - new Date(b.match_date))
          .slice(0, 2)

        if (!top5.length || !upcoming.length) { setData({ hide: true }); return }

        const predRes = await supabase.from('predictions')
          .select('user_id, match_id, predicted_home, predicted_away, predicted_advancer_id')
          .in('user_id', top5.map(t => t.user_id))
          .in('match_id', upcoming.map(m => m.id))
        const predMap = {}
        ;(predRes.data || []).forEach(p => { predMap[`${p.user_id}|${p.match_id}`] = p })

        setData({ top5, upcoming, predMap, teamName })
      } catch (e) {
        console.error('top preds widget', e); setData({ hide: true })
      }
    })()
  }, [])

  if (!data || data.hide) return null
  const { top5, upcoming, predMap, teamName } = data

  const cell = (uid, m) => {
    const p = predMap[`${uid}|${m.id}`]
    if (!p || p.predicted_home == null) return '—'
    let s = `${p.predicted_home}-${p.predicted_away}`
    if (p.predicted_home === p.predicted_away && p.predicted_advancer_id) {
      const t = teamName[p.predicted_advancer_id] || ''
      s += ` ${t.slice(0, 3).toUpperCase()}`
    }
    return s
  }
  const abbr = (m) => `${(m.home_team?.name || '').slice(0, 3).toUpperCase()}–${(m.away_team?.name || '').slice(0, 3).toUpperCase()}`
  const hora = (m) => new Date(m.match_date).toLocaleString('es-ES', { weekday: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' })

  return (
    <div style={{
      background: 'var(--bg-secondary)', borderRadius: '12px', padding: '14px 16px',
      marginBottom: '12px', border: '1px solid var(--border)',
    }}>
      <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '2px' }}>
        🎯 El top 5, al descubierto
      </div>
      <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginBottom: '12px' }}>
        Lo que ha puesto el podio para los próximos partidos.
      </div>
      {/* Cabecera de columnas */}
      <div style={{ display: 'grid', gridTemplateColumns: `1fr ${upcoming.map(() => '58px').join(' ')}`, gap: '6px', alignItems: 'end', marginBottom: '8px' }}>
        <span />
        {upcoming.map(m => (
          <div key={m.id} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '10px', fontWeight: 800, color: '#60a5fa' }}>{abbr(m)}</div>
            <div style={{ fontSize: '8px', color: 'var(--text-dim)', textTransform: 'capitalize' }}>{hora(m)}</div>
          </div>
        ))}
      </div>
      {top5.map((u, i) => (
        <div key={u.user_id} style={{
          display: 'grid', gridTemplateColumns: `1fr ${upcoming.map(() => '58px').join(' ')}`, gap: '6px',
          alignItems: 'center', padding: '6px 0', borderTop: i === 0 ? 'none' : '0.5px solid var(--border-light)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: MEDAL[i], width: '16px', flexShrink: 0 }}>{i + 1}º</span>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.full_name}</span>
          </div>
          {upcoming.map(m => (
            <span key={m.id} style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{cell(u.user_id, m)}</span>
          ))}
        </div>
      ))}
    </div>
  )
}
