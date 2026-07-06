import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabase'
import { FootballSpinner } from './Skeleton'
import { formatRealName } from '../utils/nickname'

/**
 * Modal "perfil de participante": TODAS las predicciones de un usuario en solo
 * lectura (grupos + eliminatorias + especiales), estilo "Mis predicciones".
 *
 * Gating de imparcialidad: solo muestra rondas ya CERRADAS (grupos, especiales
 * y las rondas KO cuyo primer partido ya empezó). Nunca enseña una ronda con el
 * plazo abierto — evita que se copien picks en vivo.
 */
const KO_ORDER = ['Round of 32', 'Round of 16', 'Quarter-finals', 'Semi-finals', 'Third place', 'Final']
const KO_LABEL = {
  'Round of 32': 'Dieciseisavos', 'Round of 16': 'Octavos', 'Quarter-finals': 'Cuartos',
  'Semi-finals': 'Semifinales', 'Third place': '3er puesto', 'Final': 'Final',
}
const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']

export default function ParticipantProfileModal({ participantId, participantName, onClose }) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [tab, setTab] = useState('grupos')
  const [group, setGroup] = useState('A')

  useEffect(() => {
    if (!participantId) return
    ;(async () => {
      try {
        const [predsRes, matchesRes, betsRes, entriesRes, teamsRes, lbRes] = await Promise.all([
          supabase.from('predictions').select('match_id, predicted_home, predicted_away, predicted_advancer_id, points_earned').eq('user_id', participantId),
          supabase.from('matches').select('id, stage, group_name, status, match_date, match_number, home_score, away_score, home_team:teams!matches_home_team_id_fkey(name, flag_url), away_team:teams!matches_away_team_id_fkey(name, flag_url)').neq('stage', 'friendly').neq('stage', 'test').order('match_number'),
          supabase.from('pre_tournament_bets').select('id, name, question, input_type, sort_order').eq('is_active', true).order('sort_order'),
          supabase.from('pre_tournament_entries').select('bet_id, value, points_awarded, is_resolved').eq('user_id', participantId),
          supabase.from('teams').select('id, name'),
          supabase.from('leaderboard').select('total_points, exact_hits').eq('user_id', participantId).maybeSingle(),
        ])
        const predMap = {}
        ;(predsRes.data || []).forEach(p => { predMap[p.match_id] = p })
        const teamName = {}
        ;(teamsRes.data || []).forEach(t => { teamName[t.id] = t.name })
        setData({
          preds: predMap,
          matches: matchesRes.data || [],
          bets: betsRes.data || [],
          entries: entriesRes.data || [],
          teamName,
          lb: lbRes.data || null,
        })
      } catch (e) {
        console.error('perfil fetch', e); setData(null)
      } finally { setLoading(false) }
    })()
  }, [participantId])

  const now = Date.now()

  // Rondas KO visibles: primer partido ya empezado (plazo cerrado).
  const koRounds = useMemo(() => {
    if (!data) return []
    const out = []
    for (const stage of KO_ORDER) {
      const ms = data.matches.filter(m => m.stage === stage && m.match_date)
      if (!ms.length) continue
      const first = Math.min(...ms.map(m => new Date(m.match_date).getTime()))
      if (now >= first) out.push({ stage, label: KO_LABEL[stage] || stage, matches: ms.sort((a, b) => a.match_number - b.match_number) })
    }
    return out
  }, [data, now])

  const groupMatches = useMemo(() => {
    if (!data) return []
    return data.matches.filter(m => m.stage === 'group' && m.group_name === group).sort((a, b) => a.match_number - b.match_number)
  }, [data, group])

  const cell = (p) => p && p.predicted_home != null ? `${p.predicted_home}-${p.predicted_away}` : null
  const koCell = (p) => {
    if (!p || p.predicted_home == null) return null
    let s = `${p.predicted_home}-${p.predicted_away}`
    if (p.predicted_home === p.predicted_away) s += ` · pasa ${data.teamName[p.predicted_advancer_id] || '?'}`
    return s
  }
  const ptsColor = (pts) => pts >= 2 ? '#60a5fa' : pts === 1 ? 'var(--gold)' : 'var(--text-dim)'

  const name = formatRealName(participantName) || participantName || 'Participante'

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', animation: 'fadeIn 0.2s ease',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-secondary)', borderRadius: '14px', width: '100%', maxWidth: '460px',
        maxHeight: '88vh', display: 'flex', flexDirection: 'column', border: '1px solid var(--border)',
        animation: 'slideUp 0.2s ease', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '18px 18px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '9px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700 }}>Predicciones de</div>
              <div style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
            </div>
            {data?.lb && (
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{data.lb.total_points}</div>
                <div style={{ fontSize: '9px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.8px', marginTop: '2px' }}>puntos</div>
              </div>
            )}
          </div>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '4px', marginTop: '14px', background: 'var(--bg-input)', borderRadius: '8px', padding: '3px' }}>
            {[['grupos', 'Grupos'], ['elim', 'Eliminatorias'], ['esp', 'Especiales']].map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} style={{
                flex: 1, padding: '7px 4px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                background: tab === k ? 'var(--bg-secondary)' : 'transparent',
                color: tab === k ? 'var(--text-primary)' : 'var(--text-muted)',
                fontSize: '11px', fontWeight: tab === k ? 700 : 500,
              }}>{l}</button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', padding: '14px 18px 20px' }}>
          {loading ? <FootballSpinner text="Cargando predicciones…" /> : !data ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '13px' }}>No se pudieron cargar.</div>
          ) : tab === 'grupos' ? (
            <>
              <div className="group-tabs" style={{ marginBottom: '12px', gap: '6px', display: 'flex', flexWrap: 'wrap' }}>
                {GROUPS.map(g => (
                  <button key={g} onClick={() => setGroup(g)} style={{
                    padding: '5px 11px', borderRadius: '20px', border: 'none', cursor: 'pointer',
                    background: group === g ? 'var(--green)' : 'var(--bg-input)',
                    color: group === g ? '#fff' : 'var(--text-muted)', fontSize: '12px', fontWeight: 700,
                  }}>{g}</button>
                ))}
              </div>
              {groupMatches.map(m => {
                const p = data.preds[m.id]; const fin = m.status === 'finished'
                return (
                  <div key={m.id} style={{ padding: '9px 0', borderBottom: '0.5px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ flex: 1, fontSize: '12px', color: 'var(--text-primary)', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.home_team?.name}</span>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '64px', gap: '3px' }}>
                      {fin && <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-dim)' }}>{m.home_score}-{m.away_score}</span>}
                      <span style={{ fontSize: '13px', fontWeight: 800, padding: '1px 8px', borderRadius: '4px', background: 'var(--bg-input)', color: fin ? ptsColor(p?.points_earned || 0) : 'var(--text-primary)' }}>{cell(p) || '—'}</span>
                      {fin && p && <span style={{ fontSize: '8.5px', fontWeight: 700, color: ptsColor(p.points_earned || 0), textTransform: 'uppercase' }}>{p.points_earned === 3 ? '+3' : p.points_earned === 1 ? '+1' : '0'}</span>}
                    </div>
                    <span style={{ flex: 1, fontSize: '12px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.away_team?.name}</span>
                  </div>
                )
              })}
            </>
          ) : tab === 'elim' ? (
            koRounds.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '13px' }}>Aún no hay ninguna ronda eliminatoria cerrada.</div>
            ) : koRounds.map(rd => (
              <div key={rd.stage} style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700, marginBottom: '6px' }}>{rd.label}</div>
                {rd.matches.map(m => {
                  const p = data.preds[m.id]; const fin = m.status === 'finished'
                  return (
                    <div key={m.id} style={{ padding: '8px 0', borderBottom: '0.5px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ flex: 1, fontSize: '12px', color: 'var(--text-primary)', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.home_team?.name}</span>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '110px', gap: '3px' }}>
                        {fin && <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-dim)' }}>{m.home_score}-{m.away_score}</span>}
                        <span style={{ fontSize: '12px', fontWeight: 800, padding: '1px 8px', borderRadius: '4px', background: 'var(--bg-input)', color: fin ? ptsColor(p?.points_earned || 0) : 'var(--text-primary)', textAlign: 'center' }}>{koCell(p) || '—'}</span>
                        {fin && p && <span style={{ fontSize: '8.5px', fontWeight: 700, color: ptsColor(p.points_earned || 0), textTransform: 'uppercase' }}>{p.points_earned ? `+${p.points_earned}` : '0'}</span>}
                      </div>
                      <span style={{ flex: 1, fontSize: '12px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.away_team?.name}</span>
                    </div>
                  )
                })}
              </div>
            ))
          ) : (
            data.entries.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '13px' }}>Sin predicciones especiales.</div>
            ) : data.bets.map(bet => {
              const e = data.entries.find(x => x.bet_id === bet.id)
              if (!e) return null
              const v = (e.value && typeof e.value === 'object') ? e.value : {}
              const val = v.team_id != null ? (data.teamName[v.team_id] || '?')
                : v.player_name ? v.player_name
                : v.answer != null ? ({ yes: 'Sí', no: 'No' }[String(v.answer).toLowerCase()] || String(v.answer))
                : '—'
              return (
                <div key={bet.id} style={{ padding: '10px 0', borderBottom: '0.5px solid var(--border-light)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>{bet.name || bet.question}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{val}</span>
                    {e.is_resolved && (
                      <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: (e.points_awarded || 0) > 0 ? 'rgba(37,99,235,0.18)' : 'var(--bg-input)', color: (e.points_awarded || 0) > 0 ? '#60a5fa' : 'var(--text-dim)' }}>{e.points_awarded || 0} pts</span>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        <button onClick={onClose} style={{
          padding: '12px', background: 'var(--bg-card)', color: 'var(--text-muted)', border: 'none',
          borderTop: '1px solid var(--border)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', flexShrink: 0,
        }}>Cerrar</button>
      </div>
    </div>
  )
}
