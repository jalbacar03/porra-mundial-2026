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

  // Build a unified ranking list including Bot365 inline (no separator)
  const fullRankings = bot365Entry
    ? [
        ...currentRankings.slice(0, bot365InsertAfter),
        { ...bot365Entry, isBot: true },
        ...currentRankings.slice(bot365InsertAfter)
      ]
    : currentRankings
  const maxPts = Math.max(...fullRankings.map(u => hasLive ? u.effective_points : u.total_points), 1)
  const initials = (name) => {
    if (!name) return '?'
    const parts = name.trim().split(/\s+/)
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + (parts[parts.length - 1][0] || '')).toUpperCase()
  }
  const avatarColors = [
    'linear-gradient(135deg, #d4af37, #8b6f1c)',
    'linear-gradient(135deg, #4a90e2, #2c5fa3)',
    'linear-gradient(135deg, #e07b39, #a14e1e)',
    'linear-gradient(135deg, #2dbf7e, #1a6f4d)',
    'linear-gradient(135deg, #b454c4, #6f2c7c)',
    'linear-gradient(135deg, #5b6cf2, #3243aa)',
    'linear-gradient(135deg, #ec5f7a, #a82d44)',
    'linear-gradient(135deg, #58c4d4, #2c7a85)'
  ]
  const colorFor = (uid) => {
    let h = 0
    for (const c of (uid || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0
    return avatarColors[h % avatarColors.length]
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '16px', minHeight: '100svh' }}>

      {/* Header */}
      <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <h2 style={{
          fontSize: '28px', fontWeight: '800', color: 'var(--text-primary)',
          margin: 0, letterSpacing: '-0.5px'
        }}>
          Clasificación
        </h2>
        {hasLive && (
          <span className="live-pulse" style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            padding: '3px 9px', borderRadius: '20px',
            background: 'rgba(226,75,74,0.15)', border: '1px solid rgba(226,75,74,0.3)',
            fontSize: '10px', fontWeight: '700', color: 'var(--red)',
            textTransform: 'uppercase', letterSpacing: '1px'
          }}>
            <span className="live-dot" /> LIVE
          </span>
        )}
      </div>

      {isEmpty ? (
        <EmptyState
          icon="🏆"
          title="Sin clasificación aún"
          subtitle="Se rellenará cuando empiecen los partidos del Mundial."
        />
      ) : (
        <div>
          {fullRankings.map((user, idx) => {
            const isMe = user.user_id === userId
            const isBot = user.isBot
            // Compute tied rank within currentRankings (skip Bot for ranking)
            let rankLabel, isTied
            if (isBot) {
              rankLabel = ''
              isTied = false
            } else {
              const realIdx = currentRankings.findIndex(u => u.user_id === user.user_id)
              const { rank, tied } = getTiedRank(realIdx)
              rankLabel = tied ? `T${rank}` : `${rank}`
              isTied = tied
            }
            const delta = isBot ? 0 : (positionChanges[user.user_id] || 0)
            const pts = hasLive ? user.effective_points : user.total_points
            const barPct = Math.max(8, Math.round((pts / maxPts) * 100))

            return (
              <div
                key={user.user_id + idx}
                className={!isMe && !isBot ? 'tap-scale' : ''}
                onClick={() => !isMe && !isBot && setH2hRival({ id: user.user_id, name: user.full_name })}
                style={{
                  position: 'relative',
                  display: 'flex', alignItems: 'center',
                  padding: '14px 14px 16px',
                  marginBottom: '6px',
                  borderRadius: '12px',
                  background: isMe ? 'rgba(0,122,69,0.1)' : isBot ? 'rgba(255,255,255,0.02)' : 'var(--bg-secondary)',
                  border: isMe ? '1px solid rgba(0,144,81,0.4)' : '1px solid transparent',
                  cursor: !isMe && !isBot ? 'pointer' : 'default',
                  opacity: isBot ? 0.7 : 1
                }}>

                {/* Rank number */}
                <div style={{
                  width: '28px', textAlign: 'center', flexShrink: 0,
                  fontSize: '15px', fontWeight: '600',
                  color: isBot ? 'var(--text-dim)' : isMe ? '#fff' : 'var(--text-muted)'
                }}>
                  {rankLabel}
                </div>

                {/* Avatar */}
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%',
                  marginLeft: '6px', marginRight: '12px', flexShrink: 0,
                  background: isBot ? '#3a3d48' : colorFor(user.user_id),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '12px', fontWeight: '700',
                  color: isBot ? '#9da3b0' : '#fff',
                  letterSpacing: '0.5px'
                }}>
                  {isBot ? 'B' : initials(user.full_name)}
                </div>

                {/* Name + delta */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    fontSize: '15px',
                    fontWeight: isMe ? '700' : '500',
                    color: isBot ? 'var(--text-dim)' : 'var(--text-primary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                  }}>
                    {isBot ? 'Bot365' : user.full_name}{isMe ? ' · Tú' : ''}
                  </span>
                  {delta !== 0 && (
                    <span style={{
                      fontSize: '11px', fontWeight: '700',
                      color: delta > 0 ? '#4ade80' : '#e74c3c',
                      flexShrink: 0
                    }}>
                      {delta > 0 ? `▲${delta}` : `▼${Math.abs(delta)}`}
                    </span>
                  )}
                  {!isBot && delta === 0 && !isTied && (
                    <span style={{ fontSize: '11px', color: 'var(--text-dim)', flexShrink: 0 }}>·</span>
                  )}
                </div>

                {/* Points */}
                <div style={{
                  textAlign: 'right', flexShrink: 0,
                  display: 'flex', alignItems: 'baseline', gap: '4px'
                }}>
                  <span style={{
                    fontSize: '17px', fontWeight: '700',
                    color: isBot ? 'var(--text-dim)' : isMe ? 'var(--gold)' : 'var(--text-primary)'
                  }}>
                    {user.total_points}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>pts</span>
                  {user.provisional > 0 && (
                    <span className="live-pulse" style={{
                      fontSize: '11px', fontWeight: '700', color: 'var(--red)', marginLeft: '2px'
                    }}>
                      +{user.provisional}
                    </span>
                  )}
                </div>

                {/* Progress bar at bottom of row */}
                <div style={{
                  position: 'absolute', bottom: 0, left: '14px', right: '14px',
                  height: '2px', borderRadius: '2px', overflow: 'hidden',
                  background: 'rgba(255,255,255,0.04)'
                }}>
                  <div style={{
                    width: `${barPct}%`, height: '100%',
                    background: isBot ? 'rgba(255,255,255,0.1)' : isMe ? 'var(--gold)' : 'var(--green)',
                    transition: 'width 0.4s ease'
                  }} />
                </div>
              </div>
            )
          })}
        </div>
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
