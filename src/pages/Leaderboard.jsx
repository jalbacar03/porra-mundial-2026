import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../supabase'
import { generateMockLeaderboard } from '../hooks/useDemoMode'
import { SkeletonLeaderboard } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'
import H2HModal from '../components/H2HModal'
const BOT365_ID = 'b0365b03-65b0-365b-0365-b0365b036500'

export default function Leaderboard({ demoMode }) {
  const [rankings, setRankings] = useState([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState(null)
  const [profileNames, setProfileNames] = useState({})
  const [positionChanges, setPositionChanges] = useState({}) // user_id → delta (positive = moved up)
  const [h2hRival, setH2hRival] = useState(null) // { id, name } or null

  // Mock data for demo mode (hook must be before any return)
  const mockRankings = useMemo(() => {
    if (!demoMode || !userId) return []
    return generateMockLeaderboard(userId)
  }, [demoMode, userId])

  const [paidUsers, setPaidUsers] = useState(new Set())

  useEffect(() => {
    fetchData()
    // Fetch nicknames + payment status
    supabase.from('profiles').select('id, full_name, nickname, has_paid').then(({ data }) => {
      if (data) {
        const map = {}
        const paid = new Set()
        data.forEach(p => {
          map[p.id] = p.nickname || p.full_name || 'Participante'
          if (p.has_paid) paid.add(p.id)
        })
        setProfileNames(map)
        setPaidUsers(paid)
      }
    })
  }, [])

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) setUserId(user.id)

    const { data, error } = await supabase
      .from('leaderboard')
      .select('*')

    if (!error && data) {
      setRankings(data)
      await computePositionChanges(data)
    }

    setLoading(false)
  }

  async function computePositionChanges(currentRankings) {
    // Get points earned in last 48h from all sources
    const twoDaysAgo = new Date()
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
    const cutoff = twoDaysAgo.toISOString()

    const [matchesRes, preTournamentRes, ordagosRes] = await Promise.all([
      supabase.from('matches').select('id').eq('status', 'finished').gte('match_date', cutoff),
      supabase.from('pre_tournament_entries').select('user_id, points_awarded').eq('is_resolved', true).gte('updated_at', cutoff),
      supabase.from('ordago_entries').select('user_id, points_awarded').not('points_awarded', 'is', null).gte('updated_at', cutoff)
    ])

    const recentMatchIds = (matchesRes?.data || []).map(m => m.id)

    let preds = []
    if (recentMatchIds.length > 0) {
      const { data } = await supabase
        .from('predictions')
        .select('user_id, points_earned')
        .in('match_id', recentMatchIds)
      preds = data || []
    }

    // Sum recent points per user
    const recentPoints = {}
    preds.forEach(p => {
      recentPoints[p.user_id] = (recentPoints[p.user_id] || 0) + (p.points_earned || 0)
    })
    ;(preTournamentRes?.data || []).forEach(e => {
      recentPoints[e.user_id] = (recentPoints[e.user_id] || 0) + (e.points_awarded || 0)
    })
    ;(ordagosRes?.data || []).forEach(e => {
      recentPoints[e.user_id] = (recentPoints[e.user_id] || 0) + (e.points_awarded || 0)
    })

    // Current ranking (excluding bot)
    const current = currentRankings
      .filter(r => r.user_id !== BOT365_ID)
      .sort((a, b) => b.total_points - a.total_points || (b.exact_hits || 0) - (a.exact_hits || 0))

    // Simulate "48h ago" ranking by subtracting recent points
    const past = current.map(r => ({
      ...r,
      total_points: r.total_points - (recentPoints[r.user_id] || 0)
    })).sort((a, b) => b.total_points - a.total_points || (b.exact_hits || 0) - (a.exact_hits || 0))

    // Compute rank for each user in both lists
    const currentRank = {}
    const pastRank = {}
    current.forEach((r, i) => { currentRank[r.user_id] = i + 1 })
    past.forEach((r, i) => { pastRank[r.user_id] = i + 1 })

    // Delta = past rank - current rank (positive means moved up)
    const changes = {}
    Object.keys(currentRank).forEach(uid => {
      const delta = (pastRank[uid] || currentRank[uid]) - currentRank[uid]
      if (delta !== 0) changes[uid] = delta
    })

    setPositionChanges(changes)
  }

  if (loading) {
    return (
      <div style={{ padding: '16px' }}>
        <SkeletonLeaderboard rows={10} />
      </div>
    )
  }

  const medals = [
    'linear-gradient(135deg, #ffd700, #b8860b)',
    'linear-gradient(135deg, #c0c0c0, #808080)',
    'linear-gradient(135deg, #cd7f32, #8b4513)'
  ]

  const allRankings = demoMode ? mockRankings :
    rankings
      .filter(r => r.user_id === BOT365_ID || paidUsers.has(r.user_id))
      .map(r => ({ ...r, full_name: profileNames[r.user_id] || r.full_name || 'Participante' }))

  const bot365Entry = allRankings.find(u => u.user_id === BOT365_ID)
  const currentRankings = allRankings.filter(u => u.user_id !== BOT365_ID)
  const isEmpty = currentRankings.length === 0

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
          {currentRankings.length} participantes
        </p>
      </div>

      {isEmpty ? (
        <EmptyState
          icon="🏆"
          title="Sin clasificación aún"
          subtitle="Se rellenará cuando empiecen los partidos del Mundial."
        />
      ) : (
        <>
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

          {/* Table rows */}
          {currentRankings.map((user, index) => {
            const isMe = user.user_id === userId
            const { rank, tied } = getTiedRank(index)
            const rankLabel = tied ? `T${rank}` : `${rank}`
            const showBot365Line = bot365Entry && index === bot365InsertAfter
            const delta = positionChanges[user.user_id] || 0

            return (
              <div key={user.user_id}>
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

                <div
                  className={!isMe ? 'tap-scale' : ''}
                  onClick={() => !isMe && setH2hRival({ id: user.user_id, name: user.full_name })}
                  style={{
                    display: 'flex', alignItems: 'center', padding: '10px 12px',
                    borderBottom: '0.5px solid var(--border-light)',
                    background: isMe ? 'rgba(255, 204, 0, 0.04)' : 'transparent',
                    borderLeft: isMe ? '2px solid var(--gold)' : '2px solid transparent',
                    cursor: isMe ? 'default' : 'pointer',
                    transition: 'background 0.15s ease',
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

                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                    <span style={{
                      fontSize: '13px',
                      fontWeight: isMe ? '600' : '400',
                      color: isMe ? 'var(--gold)' : 'var(--text-primary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>
                      {user.full_name}{isMe ? ' (Tú)' : ''}
                    </span>

                    {/* Position change indicator */}
                    {delta !== 0 && (
                      <span style={{
                        fontSize: '9px', fontWeight: '700',
                        color: delta > 0 ? '#4ade80' : '#e74c3c',
                        flexShrink: 0
                      }}>
                        {delta > 0 ? `▲${delta}` : `▼${Math.abs(delta)}`}
                      </span>
                    )}
                  </div>

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

          {/* Bot365 at the bottom */}
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

      {/* H2H Modal */}
      {h2hRival && (
        <H2HModal
          userId={userId}
          rivalId={h2hRival.id}
          rivalName={h2hRival.name}
          onClose={() => setH2hRival(null)}
        />
      )}
    </div>
  )
}
