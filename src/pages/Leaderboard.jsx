import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../supabase'
import { generateMockLeaderboard } from '../hooks/useDemoMode'
import { SkeletonLeaderboard } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'
import H2HModal from '../components/H2HModal'
const BOT365_ID = 'b0365b03-65b0-365b-0365-b0365b036500'

function calcProvisionalPoints(pred, match) {
  if (match.home_score === null) return 0
  if (pred.predicted_home === match.home_score && pred.predicted_away === match.away_score) return 3
  const predSign = Math.sign(pred.predicted_home - pred.predicted_away)
  const realSign = Math.sign(match.home_score - match.away_score)
  return predSign === realSign ? 1 : 0
}

export default function Leaderboard({ demoMode }) {
  const [rankings, setRankings] = useState([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState(null)
  const [profileNames, setProfileNames] = useState({})
  const [positionChanges, setPositionChanges] = useState({})
  const [h2hRival, setH2hRival] = useState(null)
  const [liveMatches, setLiveMatches] = useState([])
  const [livePredictions, setLivePredictions] = useState([])

  const mockRankings = useMemo(() => {
    if (!demoMode || !userId) return []
    return generateMockLeaderboard(userId)
  }, [demoMode, userId])

  const [paidUsers, setPaidUsers] = useState(new Set())

  useEffect(() => {
    fetchData()
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

    const [lbRes, liveRes] = await Promise.all([
      supabase.from('leaderboard').select('*'),
      supabase.from('matches').select('id, home_score, away_score, status').eq('status', 'live')
    ])

    if (!lbRes.error && lbRes.data) {
      setRankings(lbRes.data)
      await computePositionChanges(lbRes.data)
    }

    const liveData = liveRes.data || []
    setLiveMatches(liveData)

    if (liveData.length > 0) {
      const { data: livePredsData } = await supabase
        .from('predictions')
        .select('user_id, match_id, predicted_home, predicted_away')
        .in('match_id', liveData.map(m => m.id))
      setLivePredictions(livePredsData || [])
    } else {
      setLivePredictions([])
    }

    setLoading(false)
  }

  async function computePositionChanges(currentRankings) {
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

    const current = currentRankings
      .filter(r => r.user_id !== BOT365_ID)
      .sort((a, b) => b.total_points - a.total_points || (b.exact_hits || 0) - (a.exact_hits || 0))

    const past = current.map(r => ({
      ...r,
      total_points: r.total_points - (recentPoints[r.user_id] || 0)
    })).sort((a, b) => b.total_points - a.total_points || (b.exact_hits || 0) - (a.exact_hits || 0))

    const currentRank = {}
    const pastRank = {}
    current.forEach((r, i) => { currentRank[r.user_id] = i + 1 })
    past.forEach((r, i) => { pastRank[r.user_id] = i + 1 })

    const changes = {}
    Object.keys(currentRank).forEach(uid => {
      const delta = (pastRank[uid] || currentRank[uid]) - currentRank[uid]
      if (delta !== 0) changes[uid] = delta
    })

    setPositionChanges(changes)
  }

  // Provisional points from live matches
  const provisionalPoints = useMemo(() => {
    if (liveMatches.length === 0) return {}
    const byUser = {}
    livePredictions.forEach(pred => {
      const match = liveMatches.find(m => m.id === pred.match_id)
      if (!match) return
      const pts = calcProvisionalPoints(pred, match)
      if (pts > 0) byUser[pred.user_id] = (byUser[pred.user_id] || 0) + pts
    })
    return byUser
  }, [liveMatches, livePredictions])

  const hasLive = liveMatches.length > 0

  // Auto-refresh every 60s when there are live matches
  useEffect(() => {
    if (!hasLive) return
    const interval = setInterval(fetchData, 60000)
    return () => clearInterval(interval)
  }, [hasLive])

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
      .map(r => ({
        ...r,
        full_name: profileNames[r.user_id] || r.full_name || 'Participante',
        provisional: provisionalPoints[r.user_id] || 0,
        effective_points: r.total_points + (provisionalPoints[r.user_id] || 0)
      }))

  // Re-sort by effective points when live
  if (hasLive && !demoMode) {
    allRankings.sort((a, b) =>
      b.effective_points - a.effective_points || (b.exact_hits || 0) - (a.exact_hits || 0)
    )
  }

  const bot365Entry = allRankings.find(u => u.user_id === BOT365_ID)
  const currentRankings = allRankings.filter(u => u.user_id !== BOT365_ID)
  const isEmpty = currentRankings.length === 0

  function getTiedRank(index) {
    if (index === 0) return { rank: 1, tied: false }
    const getPts = (r) => hasLive ? r.effective_points : r.total_points
    const pts = getPts(currentRankings[index])
    const exactHits = currentRankings[index].exact_hits || 0
    let firstWithSame = index
    while (firstWithSame > 0 &&
      getPts(currentRankings[firstWithSame - 1]) === pts &&
      (currentRankings[firstWithSame - 1].exact_hits || 0) === exactHits) {
      firstWithSame--
    }
    const rank = firstWithSame + 1
    const tied = firstWithSame < index ||
      (index + 1 < currentRankings.length &&
        getPts(currentRankings[index + 1]) === pts &&
        (currentRankings[index + 1].exact_hits || 0) === exactHits)
    return { rank, tied }
  }

  const bot365InsertAfter = bot365Entry
    ? currentRankings.filter(u => u.effective_points > bot365Entry.effective_points).length
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
          {hasLive && (
            <span className="live-pulse" style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              marginLeft: '10px', padding: '2px 8px', borderRadius: '20px',
              background: 'rgba(226,75,74,0.15)', border: '1px solid rgba(226,75,74,0.3)',
              fontSize: '10px', fontWeight: '700', color: 'var(--red)',
              textTransform: 'uppercase', letterSpacing: '1px'
            }}>
              <span className="live-dot" /> LIVE
            </span>
          )}
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
            <span style={{ minWidth: '55px', textAlign: 'center' }}>Puntos</span>
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
                    <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                      {bot365Entry.total_points}
                      {bot365Entry.provisional > 0 && (
                        <span className="live-pulse" style={{ fontSize: '10px', color: 'var(--red)', fontWeight: '700' }}>
                          +{bot365Entry.provisional}
                        </span>
                      )}
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
                    minWidth: '55px', textAlign: 'center', fontSize: '14px', fontWeight: '600',
                    color: rank === 1 ? 'var(--gold)' : 'var(--text-primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px'
                  }}>
                    {user.total_points}
                    {user.provisional > 0 && (
                      <span className="live-pulse" style={{
                        fontSize: '11px', fontWeight: '700', color: 'var(--red)'
                      }}>
                        +{user.provisional}
                      </span>
                    )}
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
              <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                {bot365Entry.total_points}
                {bot365Entry.provisional > 0 && (
                  <span className="live-pulse" style={{ fontSize: '10px', color: 'var(--red)', fontWeight: '700' }}>
                    +{bot365Entry.provisional}
                  </span>
                )}
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
