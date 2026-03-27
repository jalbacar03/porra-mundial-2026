import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../supabase'
import { generateMockLeaderboard } from '../hooks/useDemoMode'
const BOT365_ID = 'b0365b03-65b0-365b-0365-b0365b036500'

export default function Leaderboard({ demoMode }) {
  const [rankings, setRankings] = useState([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState(null)
  const [activeTab, setActiveTab] = useState('general') // 'general' | 'last3'
  const [last3Rankings, setLast3Rankings] = useState([])

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) setUserId(user.id)

    const { data, error } = await supabase
      .from('leaderboard')
      .select('*')

    if (!error && data) setRankings(data)

    // Last 3 days: get matches finished in last 3 days and compute rankings from those
    await fetchLast3Days(user?.id)
    setLoading(false)
  }

  async function fetchLast3Days(currentUserId) {
    const threeDaysAgo = new Date()
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

    // Get matches finished recently (using updated_at or we check status + date)
    const { data: recentMatches } = await supabase
      .from('matches')
      .select('id')
      .eq('status', 'finished')
      .gte('match_date', threeDaysAgo.toISOString())

    if (!recentMatches || recentMatches.length === 0) {
      setLast3Rankings([])
      return
    }

    const matchIds = recentMatches.map(m => m.id)

    // Get predictions for those matches
    const { data: preds } = await supabase
      .from('predictions')
      .select('user_id, points_earned, match_id')
      .in('match_id', matchIds)

    if (!preds || preds.length === 0) {
      setLast3Rankings([])
      return
    }

    // Get all profiles for names
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, nickname')

    const profileMap = {}
    profiles?.forEach(p => { profileMap[p.id] = p.nickname || p.full_name })

    // Aggregate by user
    const userStats = {}
    preds.forEach(p => {
      if (!userStats[p.user_id]) {
        userStats[p.user_id] = { user_id: p.user_id, total_points: 0, exact_hits: 0, sign_hits: 0 }
      }
      userStats[p.user_id].total_points += (p.points_earned || 0)
      if (p.points_earned === 3) userStats[p.user_id].exact_hits++
      if (p.points_earned === 1) userStats[p.user_id].sign_hits++
    })

    const sorted = Object.values(userStats)
      .map(u => ({ ...u, full_name: profileMap[u.user_id] || '?' }))
      .sort((a, b) => b.total_points - a.total_points || b.exact_hits - a.exact_hits)

    setLast3Rankings(sorted)
  }

  if (loading) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
        Cargando clasificación...
      </div>
    )
  }

  const medals = [
    'linear-gradient(135deg, #ffd700, #b8860b)',
    'linear-gradient(135deg, #c0c0c0, #808080)',
    'linear-gradient(135deg, #cd7f32, #8b4513)'
  ]
  // Mock data for demo mode
  const mockRankings = useMemo(() => {
    if (!demoMode || !userId) return []
    return generateMockLeaderboard(userId)
  }, [demoMode, userId])

  const allRankings = demoMode ? mockRankings : (activeTab === 'general' ? rankings : last3Rankings)
  // Separate Bot365 from real participants
  const bot365Entry = allRankings.find(u => u.user_id === BOT365_ID)
  const currentRankings = allRankings.filter(u => u.user_id !== BOT365_ID)
  const isEmpty = currentRankings.length === 0

  // Compute tied ranks (only among real participants)
  function getTiedRank(index) {
    if (index === 0) return { rank: 1, tied: false }
    const pts = currentRankings[index].total_points
    const exactHits = currentRankings[index].exact_hits || 0
    let firstWithSame = index
    while (firstWithSame > 0 &&
      currentRankings[firstWithSame - 1].total_points === pts &&
      (currentRankings[firstWithSame - 1].exact_hits || 0) === exactHits) {
      firstWithSame--
    }
    const rank = firstWithSame + 1
    const tied = firstWithSame < index ||
      (index + 1 < currentRankings.length &&
        currentRankings[index + 1].total_points === pts &&
        (currentRankings[index + 1].exact_hits || 0) === exactHits)
    return { rank, tied }
  }

  // Find where Bot365 line should be inserted (after the last person with more points)
  const bot365InsertAfter = bot365Entry
    ? currentRankings.filter(u => u.total_points > bot365Entry.total_points).length
    : -1

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '16px', minHeight: '100svh' }}>

      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{
          fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)',
          margin: '0 0 4px', letterSpacing: '0.3px'
        }}>
          Clasificación
        </h2>
        <p style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
          {rankings.filter(u => u.user_id !== BOT365_ID).length} participantes
        </p>
      </div>

      {/* Tab switcher */}
      <div style={{
        display: 'flex', gap: '4px', marginBottom: '16px',
        padding: '3px', background: 'var(--bg-input)', borderRadius: '6px'
      }}>
        <button
          onClick={() => setActiveTab('general')}
          style={{
            flex: 1, padding: '8px 12px', borderRadius: '4px', border: 'none',
            background: activeTab === 'general' ? 'var(--bg-secondary)' : 'transparent',
            color: activeTab === 'general' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontSize: '12px', fontWeight: activeTab === 'general' ? '600' : '400', cursor: 'pointer'
          }}
        >
          🏆 General
        </button>
        <button
          onClick={() => setActiveTab('last3')}
          style={{
            flex: 1, padding: '8px 12px', borderRadius: '4px', border: 'none',
            background: activeTab === 'last3' ? 'var(--bg-secondary)' : 'transparent',
            color: activeTab === 'last3' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontSize: '12px', fontWeight: activeTab === 'last3' ? '600' : '400', cursor: 'pointer'
          }}
        >
          🔥 Últimos 3 días
        </button>
      </div>

      {/* Disclaimer for last 3 days tab */}
      {activeTab === 'last3' && (
        <div style={{
          padding: '8px 12px',
          marginBottom: '10px',
          background: 'rgba(255,204,0,0.06)',
          border: '0.5px solid rgba(255,204,0,0.15)',
          borderRadius: '6px',
          fontSize: '11px',
          color: 'var(--gold)',
          textAlign: 'center',
          lineHeight: '1.4'
        }}>
          Solo a efectos informativos — no cuenta para la puntuación final
        </div>
      )}

      {isEmpty ? (
        <div style={{
          padding: '40px 20px', textAlign: 'center', color: 'var(--text-dim)',
          fontSize: '13px', background: 'var(--bg-secondary)', borderRadius: '8px',
          border: '0.5px solid var(--border)'
        }}>
          {activeTab === 'general'
            ? 'Aún no hay datos de clasificación'
            : 'No hay partidos finalizados en los últimos 3 días'
          }
        </div>
      ) : (
        <>
          {/* ===== TABLE ===== */}
          {/* Table header */}
          <div style={{
            display: 'flex', padding: '8px 12px', fontSize: '10px',
            color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.6px',
            borderBottom: '0.5px solid var(--border)'
          }}>
            <span style={{ width: '36px' }}>#</span>
            <span style={{ flex: 1, minWidth: 0 }}>Nombre</span>
            <span style={{ width: '55px', textAlign: 'center' }}>Puntos</span>
          </div>

          {/* Table rows with Bot365 reference line */}
          {currentRankings.map((user, index) => {
            const isMe = user.user_id === userId
            const { rank, tied } = getTiedRank(index)
            const rankLabel = tied ? `T${rank}` : `${rank}`
            const showBot365Line = bot365Entry && index === bot365InsertAfter

            return (
              <div key={user.user_id}>
                {/* Bot365 reference line — inserted at the right position */}
                {showBot365Line && (
                  <div style={{
                    display: 'flex', alignItems: 'center', padding: '4px 12px',
                    borderTop: '1px dashed var(--border)',
                    borderBottom: '1px dashed var(--border)',
                    margin: '1px 0'
                  }}>
                    <span style={{
                      flex: 1, fontSize: '10px', fontWeight: '500', color: 'var(--text-dim)',
                      textTransform: 'uppercase', letterSpacing: '0.6px'
                    }}>
                      — casas de apuestas —
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-dim)' }}>
                      {bot365Entry.total_points}
                    </span>
                  </div>
                )}

                {/* Regular participant row */}
                <div style={{
                  display: 'flex', alignItems: 'center', padding: '10px 12px',
                  borderBottom: '0.5px solid var(--border-light)',
                  background: isMe ? 'rgba(255, 204, 0, 0.04)' : 'transparent',
                  borderLeft: isMe ? '2px solid var(--gold)' : '2px solid transparent'
                }}>
                  <div style={{ width: '36px' }}>
                    {rank <= 3 ? (
                      <div style={{
                        width: '24px', height: '24px', borderRadius: '50%',
                        background: medals[rank - 1],
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: tied ? '9px' : '11px', fontWeight: '700', color: '#1a1d26'
                      }}>
                        {rankLabel}
                      </div>
                    ) : (
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500' }}>
                        {rankLabel}
                      </span>
                    )}
                  </div>

                  <span style={{
                    flex: 1, fontSize: '13px',
                    fontWeight: isMe ? '600' : '400',
                    color: isMe ? 'var(--gold)' : 'var(--text-primary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0
                  }}>
                    {user.full_name}{isMe ? ' (Tú)' : ''}
                  </span>

                  <span style={{
                    width: '55px', textAlign: 'center', fontSize: '14px', fontWeight: '600',
                    color: rank === 1 ? 'var(--gold)' : 'var(--text-primary)'
                  }}>
                    {user.total_points}
                  </span>
                </div>
              </div>
            )
          })}

          {/* Bot365 line at the bottom if everyone is above it */}
          {bot365Entry && bot365InsertAfter >= currentRankings.length && (
            <div style={{
              display: 'flex', alignItems: 'center', padding: '4px 12px',
              borderTop: '1px dashed var(--border)',
              margin: '1px 0'
            }}>
              <span style={{
                flex: 1, fontSize: '10px', fontWeight: '500', color: 'var(--text-dim)',
                textTransform: 'uppercase', letterSpacing: '0.6px'
              }}>
                — casas de apuestas —
              </span>
              <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-dim)' }}>
                {bot365Entry.total_points}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  )
}
