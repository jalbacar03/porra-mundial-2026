import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

/**
 * Head-to-head comparison modal between current user and a rival.
 * Shows shared match predictions and who scored more on each.
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
    // Fetch both users' predictions + the matches
    const [myPreds, rivalPreds, profileRes] = await Promise.all([
      supabase.from('predictions').select('match_id, predicted_home, predicted_away, points_earned').eq('user_id', userId),
      supabase.from('predictions').select('match_id, predicted_home, predicted_away, points_earned').eq('user_id', rivalId),
      supabase.from('profiles').select('nickname, full_name').eq('id', userId).single(),
    ])

    if (profileRes.data) {
      setMyName(profileRes.data.nickname || profileRes.data.full_name || 'Tú')
    }

    const myMap = {}
    ;(myPreds.data || []).forEach(p => { myMap[p.match_id] = p })
    const rivalMap = {}
    ;(rivalPreds.data || []).forEach(p => { rivalMap[p.match_id] = p })

    // Count wins
    let myWins = 0, rivalWins = 0, draws = 0, total = 0
    let myTotalPts = 0, rivalTotalPts = 0

    const allMatchIds = new Set([...Object.keys(myMap), ...Object.keys(rivalMap)])
    allMatchIds.forEach(mid => {
      const me = myMap[mid]
      const them = rivalMap[mid]
      if (!me || !them) return
      if (me.points_earned == null || them.points_earned == null) return

      total++
      myTotalPts += me.points_earned || 0
      rivalTotalPts += them.points_earned || 0

      if (me.points_earned > them.points_earned) myWins++
      else if (them.points_earned > me.points_earned) rivalWins++
      else draws++
    })

    // Pre-tournament comparison
    const [myBets, rivalBets] = await Promise.all([
      supabase.from('pre_tournament_entries').select('points_awarded').eq('user_id', userId).eq('is_resolved', true),
      supabase.from('pre_tournament_entries').select('points_awarded').eq('user_id', rivalId).eq('is_resolved', true),
    ])

    const myBetPts = (myBets.data || []).reduce((s, e) => s + (e.points_awarded || 0), 0)
    const rivalBetPts = (rivalBets.data || []).reduce((s, e) => s + (e.points_awarded || 0), 0)

    setData({ myWins, rivalWins, draws, total, myTotalPts, rivalTotalPts, myBetPts, rivalBetPts })
    setLoading(false)
  }

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
          padding: '24px',
          maxWidth: '380px',
          width: '100%',
          border: '1px solid var(--border)',
          animation: 'slideUp 0.2s ease',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <span style={{ fontSize: '28px' }}>⚔️</span>
          <h3 style={{
            margin: '8px 0 4px', fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)',
          }}>
            Head to Head
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
            {myName} vs {rivalName}
          </p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '13px' }}>
            Cargando comparación...
          </div>
        ) : !data || data.total === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '13px' }}>
            Aún no hay partidos resueltos para comparar.
          </div>
        ) : (
          <>
            {/* Score bar */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '20px', fontWeight: '700', color: 'var(--gold)' }}>{data.myWins}</span>
                <span style={{ fontSize: '13px', color: 'var(--text-dim)', alignSelf: 'center' }}>{data.draws} empates</span>
                <span style={{ fontSize: '20px', fontWeight: '700', color: 'var(--green)' }}>{data.rivalWins}</span>
              </div>
              <div style={{
                display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden',
                background: 'var(--bg-card)',
              }}>
                {data.myWins > 0 && (
                  <div style={{
                    width: `${(data.myWins / data.total) * 100}%`,
                    background: 'var(--gold)',
                    transition: 'width 0.3s ease',
                  }} />
                )}
                {data.draws > 0 && (
                  <div style={{
                    width: `${(data.draws / data.total) * 100}%`,
                    background: 'var(--border)',
                  }} />
                )}
                {data.rivalWins > 0 && (
                  <div style={{
                    width: `${(data.rivalWins / data.total) * 100}%`,
                    background: 'var(--green)',
                    transition: 'width 0.3s ease',
                  }} />
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>{myName}</span>
                <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>{rivalName}</span>
              </div>
            </div>

            {/* Stats comparison */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '8px',
              fontSize: '13px', textAlign: 'center',
            }}>
              <StatRow label="Pts partidos" myVal={data.myTotalPts} rivalVal={data.rivalTotalPts} />
              <StatRow label="Pts pred." myVal={data.myBetPts} rivalVal={data.rivalBetPts} />
              <StatRow label="Total" myVal={data.myTotalPts + data.myBetPts} rivalVal={data.rivalTotalPts + data.rivalBetPts} bold />
            </div>
          </>
        )}

        <button
          onClick={onClose}
          style={{
            width: '100%', padding: '11px', marginTop: '20px',
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
        fontWeight: bold ? '600' : '400',
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
