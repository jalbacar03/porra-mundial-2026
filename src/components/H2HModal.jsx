import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { FootballSpinner } from './Skeleton'
import { formatRealName } from '../utils/nickname'

/**
 * Head-to-head comparison modal between current user and a rival.
 *
 * Muestra:
 *  - Totales que CUADRAN con el leaderboard: cada uno suma SUS puntos de
 *    partidos (todos los jugados) + SUS puntos de especiales. No se limita a
 *    los partidos compartidos (eso era lo que descuadraba).
 *  - Detalle por partido jugado: resultado real + la predicción de cada uno
 *    con sus puntos, para ver fácilmente qué puso cada cual.
 */
export default function H2HModal({ userId, rivalId, rivalName, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [myName, setMyName] = useState('Tú')

  useEffect(() => {
    if (!userId || !rivalId) return
    fetchH2H()
  }, [userId, rivalId])

  async function fetchH2H() {
    try {
      const [myPreds, rivalPreds, profileRes, matchesRes, myBets, rivalBets] = await Promise.all([
        supabase.from('predictions').select('match_id, predicted_home, predicted_away, points_earned').eq('user_id', userId),
        supabase.from('predictions').select('match_id, predicted_home, predicted_away, points_earned').eq('user_id', rivalId),
        supabase.from('profiles').select('full_name').eq('id', userId).single(),
        supabase.from('matches')
          .select('id, home_score, away_score, status, match_date, stage, home_team:teams!matches_home_team_id_fkey(name, flag_url), away_team:teams!matches_away_team_id_fkey(name, flag_url)')
          .neq('stage', 'friendly').neq('stage', 'test'),
        supabase.from('pre_tournament_entries').select('points_awarded').eq('user_id', userId).eq('is_resolved', true),
        supabase.from('pre_tournament_entries').select('points_awarded').eq('user_id', rivalId).eq('is_resolved', true),
      ])

      if (profileRes.data) {
        setMyName(formatRealName(profileRes.data.full_name) || 'Tú')
      }

      const myMap = {}
      ;(myPreds.data || []).forEach(p => { myMap[p.match_id] = p })
      const rivalMap = {}
      ;(rivalPreds.data || []).forEach(p => { rivalMap[p.match_id] = p })

      // Totales de partidos: cada uno suma TODOS sus puntos (cuadra con leaderboard)
      const myMatchPts = (myPreds.data || []).reduce((s, p) => s + (p.points_earned || 0), 0)
      const rivalMatchPts = (rivalPreds.data || []).reduce((s, p) => s + (p.points_earned || 0), 0)

      // Especiales
      const myBetPts = (myBets.data || []).reduce((s, e) => s + (e.points_awarded || 0), 0)
      const rivalBetPts = (rivalBets.data || []).reduce((s, e) => s + (e.points_awarded || 0), 0)

      // Detalle por partido JUGADO (finished) — orden cronológico
      const played = (matchesRes.data || [])
        .filter(m => m.status === 'finished' && m.home_score != null)
        .sort((a, b) => new Date(a.match_date) - new Date(b.match_date))

      let myWins = 0, rivalWins = 0, draws = 0
      const rows = played.map(m => {
        const me = myMap[m.id]
        const them = rivalMap[m.id]
        const myPts = me ? (me.points_earned || 0) : 0
        const rivalPts = them ? (them.points_earned || 0) : 0
        if (me || them) {
          if (myPts > rivalPts) myWins++
          else if (rivalPts > myPts) rivalWins++
          else draws++
        }
        return {
          id: m.id,
          home: m.home_team?.name || '?',
          away: m.away_team?.name || '?',
          homeFlag: m.home_team?.flag_url,
          awayFlag: m.away_team?.flag_url,
          real: `${m.home_score}-${m.away_score}`,
          myPred: me && me.predicted_home != null ? `${me.predicted_home}-${me.predicted_away}` : null,
          rivalPred: them && them.predicted_home != null ? `${them.predicted_home}-${them.predicted_away}` : null,
          myPts, rivalPts,
        }
      })

      setData({
        myWins, rivalWins, draws,
        myMatchPts, rivalMatchPts, myBetPts, rivalBetPts,
        myTotal: myMatchPts + myBetPts, rivalTotal: rivalMatchPts + rivalBetPts,
        rows,
      })
    } catch (e) {
      console.error('H2H fetch error', e)
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  const ptsColor = (a, b) => a > b ? 'var(--gold)' : a < b ? 'var(--text-dim)' : 'var(--text-primary)'

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px', animation: 'fadeIn 0.2s ease',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-secondary)',
          borderRadius: '14px',
          padding: '22px',
          maxWidth: '420px',
          width: '100%',
          maxHeight: '85vh',
          overflowY: 'auto',
          border: '1px solid var(--border)',
          animation: 'slideUp 0.2s ease',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '18px' }}>
          <span style={{ fontSize: '26px' }}>⚔️</span>
          <h3 style={{ margin: '6px 0 2px', fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>
            Head to Head
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
            {myName} vs {rivalName}
          </p>
        </div>

        {loading ? (
          <FootballSpinner text="Cargando comparación…" />
        ) : !data ? (
          <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '13px' }}>
            No se pudo cargar la comparación.
          </div>
        ) : (
          <>
            {/* Totales (cuadran con la clasificación) */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 16px', borderRadius: '10px', background: 'var(--bg-card)', marginBottom: '14px',
            }}>
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ fontSize: '26px', fontWeight: '800', color: ptsColor(data.myTotal, data.rivalTotal) }}>{data.myTotal}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{myName}</div>
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-dim)', padding: '0 10px' }}>pts</span>
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ fontSize: '26px', fontWeight: '800', color: ptsColor(data.rivalTotal, data.myTotal) }}>{data.rivalTotal}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rivalName}</div>
              </div>
            </div>

            {/* Desglose */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '6px',
              fontSize: '13px', textAlign: 'center', marginBottom: '16px',
            }}>
              <StatRow label="Partidos" myVal={data.myMatchPts} rivalVal={data.rivalMatchPts} />
              <StatRow label="Especiales" myVal={data.myBetPts} rivalVal={data.rivalBetPts} />
            </div>

            {/* Detalle por partido jugado */}
            {data.rows.length > 0 && (
              <div>
                <div style={{
                  fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase',
                  letterSpacing: '0.8px', fontWeight: '700', marginBottom: '8px',
                }}>
                  Partido a partido ({data.myWins}–{data.draws}–{data.rivalWins})
                </div>
                {data.rows.map(r => (
                  <div key={r.id} style={{
                    padding: '9px 0', borderBottom: '0.5px solid var(--border-light)',
                  }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                      fontSize: '12px', color: 'var(--text-primary)', marginBottom: '5px', fontWeight: '600',
                    }}>
                      {r.homeFlag && <img src={r.homeFlag} alt="" style={{ width: '16px', height: '11px', borderRadius: '2px' }} />}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '95px', textAlign: 'right' }}>{r.home}</span>
                      <span style={{ fontWeight: '800', color: 'var(--text-primary)' }}>{r.real}</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '95px', textAlign: 'left' }}>{r.away}</span>
                      {r.awayFlag && <img src={r.awayFlag} alt="" style={{ width: '16px', height: '11px', borderRadius: '2px' }} />}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                      <PredCell name={myName} pred={r.myPred} pts={r.myPts} win={r.myPts > r.rivalPts} align="flex-start" />
                      <PredCell name={rivalName} pred={r.rivalPred} pts={r.rivalPts} win={r.rivalPts > r.myPts} align="flex-end" />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {data.rows.length === 0 && (
              <div style={{ textAlign: 'center', padding: '8px', color: 'var(--text-muted)', fontSize: '12px' }}>
                Aún no hay partidos jugados para comparar.
              </div>
            )}
          </>
        )}

        <button
          onClick={onClose}
          style={{
            width: '100%', padding: '11px', marginTop: '18px',
            background: 'var(--bg-card)', color: 'var(--text-muted)',
            border: '1px solid var(--border)', borderRadius: '8px',
            fontSize: '13px', fontWeight: '600', cursor: 'pointer',
          }}
        >
          Cerrar
        </button>
      </div>
    </div>
  )
}

function PredCell({ name, pred, pts, win, align }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: align, gap: '1px', flex: 1, minWidth: 0 }}>
      <span style={{ fontSize: '9px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{name}</span>
      <span style={{
        fontSize: '12px', fontWeight: '700',
        color: pred ? (win ? 'var(--gold)' : 'var(--text-primary)') : 'var(--text-dim)',
      }}>
        {pred || '—'} {pred ? <span style={{ fontSize: '10px', fontWeight: '600', color: pts === 3 ? 'var(--green)' : pts === 1 ? 'var(--gold)' : 'var(--text-dim)' }}>+{pts}</span> : null}
      </span>
    </div>
  )
}

function StatRow({ label, myVal, rivalVal, bold }) {
  const myWins = myVal > rivalVal
  const rivalWins = rivalVal > myVal
  return (
    <>
      <span style={{
        fontWeight: bold ? '700' : myWins ? '600' : '400',
        color: myWins ? 'var(--gold)' : 'var(--text-primary)',
      }}>
        {myVal}
      </span>
      <span style={{
        color: 'var(--text-dim)', fontSize: '11px',
        fontWeight: bold ? '600' : '400', alignSelf: 'center',
      }}>
        {label}
      </span>
      <span style={{
        fontWeight: bold ? '700' : rivalWins ? '600' : '400',
        color: rivalWins ? 'var(--green)' : 'var(--text-primary)',
      }}>
        {rivalVal}
      </span>
    </>
  )
}
