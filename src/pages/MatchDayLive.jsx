import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '../supabase'
import { SkeletonDashboard } from '../components/Skeleton'

const BOT365_ID = 'b0365b03-65b0-365b-0365-b0365b036500'

// Match status helpers
const isLive = (m) => m.status === 'live'
const isFinished = (m) => m.status === 'finished'
const isToday = (dateStr) => {
  const d = new Date(dateStr)
  const now = new Date()
  return d.toDateString() === now.toDateString()
}
const isUpcoming = (m) => m.status === 'scheduled' && new Date(m.match_date) > new Date()

function getElapsedMinute(matchDate) {
  const start = new Date(matchDate)
  const now = new Date()
  const diff = Math.floor((now - start) / 60000)
  if (diff < 0) return null
  if (diff <= 45) return diff
  if (diff <= 60) return '45+'
  if (diff <= 105) return diff - 15
  return '90+'
}

function getMatchProgress(matchDate) {
  const start = new Date(matchDate)
  const now = new Date()
  const diffMin = Math.floor((now - start) / 60000)
  if (diffMin <= 0) return 0
  if (diffMin <= 45) return (diffMin / 45) * 47
  if (diffMin <= 60) return 50
  if (diffMin <= 105) return 50 + ((diffMin - 60) / 45) * 47
  return 100
}

function getPointsStatus(pred, match) {
  if (!pred || match.home_score === null) return null
  const exactMatch = pred.predicted_home === match.home_score && pred.predicted_away === match.away_score
  if (exactMatch) return { points: 3, label: 'Exacto', color: 'var(--green)', bg: 'rgba(0,122,69,0.15)' }
  const predSign = Math.sign(pred.predicted_home - pred.predicted_away)
  const realSign = Math.sign(match.home_score - match.away_score)
  if (predSign === realSign) return { points: 1, label: 'Signo', color: 'var(--gold)', bg: 'rgba(255,204,0,0.1)' }
  return { points: 0, label: 'Fallo', color: 'var(--red)', bg: 'rgba(226,75,74,0.1)' }
}

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
}

function formatCountdown(dateStr) {
  const diff = new Date(dateStr) - new Date()
  if (diff <= 0) return 'Ahora'
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  if (d > 0) return `${d}d ${h}h`
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`
}

const medalColors = [
  'linear-gradient(135deg, #ffd700, #b8860b)',
  'linear-gradient(135deg, #c0c0c0, #808080)',
  'linear-gradient(135deg, #cd7f32, #8b4513)'
]

export default function MatchDayLive({ session }) {
  const [matches, setMatches] = useState([])
  const [predictions, setPredictions] = useState({})
  const [allPredictions, setAllPredictions] = useState([])
  const [leaderboard, setLeaderboard] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const [changedScores, setChangedScores] = useState(new Set())
  const prevScoresRef = useRef({})

  const fetchData = useCallback(async () => {
    const userId = session?.user?.id

    const [matchesRes, predsRes, allPredsRes, lbRes, profilesRes] = await Promise.all([
      supabase.from('matches')
        .select('*, home_team:teams!matches_home_team_id_fkey(id, name, flag_url), away_team:teams!matches_away_team_id_fkey(id, name, flag_url)')
        .order('match_date', { ascending: true }),
      userId ? supabase.from('predictions')
        .select('match_id, predicted_home, predicted_away, points_earned')
        .eq('user_id', userId) : { data: [] },
      supabase.from('predictions')
        .select('match_id, predicted_home, predicted_away, user_id'),
      supabase.from('leaderboard').select('*'),
      supabase.from('profiles').select('id, full_name, nickname, has_paid')
    ])

    const newMatches = matchesRes.data || []

    // Detect score changes for animation
    const newChanged = new Set()
    newMatches.forEach(m => {
      const prev = prevScoresRef.current[m.id]
      if (prev && (prev.home !== m.home_score || prev.away !== m.away_score)) {
        newChanged.add(m.id)
      }
      prevScoresRef.current[m.id] = { home: m.home_score, away: m.away_score }
    })
    if (newChanged.size > 0) {
      setChangedScores(newChanged)
      setTimeout(() => setChangedScores(new Set()), 700)
    }

    setMatches(newMatches)

    const predsMap = {}
    ;(predsRes.data || []).forEach(p => { predsMap[p.match_id] = p })
    setPredictions(predsMap)

    setAllPredictions(allPredsRes.data || [])
    setLeaderboard(lbRes.data || [])
    setProfiles(profilesRes.data || [])
    setLoading(false)
    setLastRefresh(new Date())
  }, [session])

  useEffect(() => { fetchData() }, [fetchData])

  // Auto-refresh every 60s when there are live matches
  useEffect(() => {
    const hasLive = matches.some(m => isLive(m))
    if (!hasLive) return
    const interval = setInterval(fetchData, 60000)
    return () => clearInterval(interval)
  }, [matches, fetchData])

  const paidUserIds = useMemo(() => new Set(profiles.filter(p => p.has_paid).map(p => p.id)), [profiles])

  // Categorize matches
  const todayMatches = useMemo(() =>
    matches.filter(m => isToday(m.match_date)),
  [matches])

  const liveMatches = useMemo(() =>
    matches.filter(m => isLive(m)),
  [matches])

  // If no today matches, find the next match day
  const nextMatchDay = useMemo(() => {
    if (todayMatches.length > 0) return null
    const upcoming = matches.filter(m => isUpcoming(m))
    if (upcoming.length === 0) return null
    const nextDate = upcoming[0].match_date
    const nextDay = new Date(nextDate).toDateString()
    return {
      date: nextDate,
      matches: upcoming.filter(m => new Date(m.match_date).toDateString() === nextDay)
    }
  }, [todayMatches, matches])

  // Find last played day for recent results
  const recentFinished = useMemo(() => {
    const finished = matches.filter(m => isFinished(m)).reverse()
    if (finished.length === 0) return []
    const lastDay = new Date(finished[0].match_date).toDateString()
    return finished.filter(m => new Date(m.match_date).toDateString() === lastDay)
  }, [matches])

  // Display matches: today > next day > last played
  const displayMatches = todayMatches.length > 0
    ? todayMatches
    : nextMatchDay
      ? nextMatchDay.matches
      : recentFinished

  const displayLabel = todayMatches.length > 0
    ? 'Hoy'
    : nextMatchDay
      ? formatDate(nextMatchDay.date)
      : recentFinished.length > 0
        ? 'Últimos resultados'
        : null

  // My today points
  const myTodayPoints = useMemo(() => {
    const userId = session?.user?.id
    if (!userId) return 0
    return displayMatches.reduce((sum, match) => {
      const pred = predictions[match.id]
      if (!pred || match.home_score === null) return sum
      const status = getPointsStatus(pred, match)
      return sum + (status?.points || 0)
    }, 0)
  }, [displayMatches, predictions, session])

  // Today's leaderboard delta
  const todayDelta = useMemo(() => {
    const todayFinishedIds = todayMatches.filter(m => isFinished(m)).map(m => m.id)
    const liveIds = liveMatches.map(m => m.id)
    const relevantIds = [...todayFinishedIds, ...liveIds]
    if (relevantIds.length === 0) return []

    const userPoints = {}
    allPredictions.filter(p => relevantIds.includes(p.match_id)).forEach(p => {
      const match = matches.find(m => m.id === p.match_id)
      if (!match || match.home_score === null) return
      const status = getPointsStatus(p, match)
      if (!status) return
      if (!paidUserIds.has(p.user_id) || p.user_id === BOT365_ID) return
      userPoints[p.user_id] = (userPoints[p.user_id] || 0) + status.points
    })

    return Object.entries(userPoints)
      .map(([userId, pts]) => {
        const prof = profiles.find(p => p.id === userId)
        return { userId, points: pts, name: prof?.nickname || prof?.full_name || '?' }
      })
      .sort((a, b) => b.points - a.points)
      .slice(0, 10)
  }, [todayMatches, liveMatches, allPredictions, matches, profiles, paidUserIds])

  // Consensus for a match
  function getConsensus(matchId) {
    const preds = allPredictions.filter(p => p.match_id === matchId)
    if (preds.length === 0) return null
    let h = 0, d = 0, a = 0
    const results = {}
    preds.forEach(p => {
      if (p.predicted_home > p.predicted_away) h++
      else if (p.predicted_home === p.predicted_away) d++
      else a++
      const key = `${p.predicted_home}-${p.predicted_away}`
      results[key] = (results[key] || 0) + 1
    })
    const total = preds.length
    const topResult = Object.entries(results).sort(([,a],[,b]) => b - a)[0]
    return {
      total,
      homePct: Math.round((h / total) * 100),
      drawPct: Math.round((d / total) * 100),
      awayPct: Math.round((a / total) * 100),
      favorite: topResult ? topResult[0] : null,
      favoritePct: topResult ? Math.round((topResult[1] / total) * 100) : 0
    }
  }

  if (loading) return <div style={{ padding: '16px' }}><SkeletonDashboard /></div>

  const hasLive = liveMatches.length > 0
  const hasActivity = hasLive || todayMatches.some(isFinished)

  return (
    <div className="stagger-in" style={{ maxWidth: '500px', margin: '0 auto', padding: '16px', minHeight: '100svh' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', margin: '0 0 4px', letterSpacing: '0.3px' }}>
            Match Day
            {hasLive && (
              <span className="live-pulse" style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                marginLeft: '10px', padding: '2px 8px', borderRadius: '20px',
                background: 'rgba(226,75,74,0.15)', border: '1px solid rgba(226,75,74,0.3)',
                fontSize: '10px', fontWeight: '700', color: 'var(--red)',
                textTransform: 'uppercase', letterSpacing: '1px'
              }}>
                <span className="live-dot" /> {liveMatches.length} EN VIVO
              </span>
            )}
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
            {displayLabel}
          </p>
        </div>
        <button
          onClick={fetchData}
          style={{
            padding: '6px 12px', borderRadius: '20px', border: '0.5px solid var(--border)',
            background: 'var(--bg-secondary)', color: 'var(--text-muted)',
            fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
          }}
        >
          ↻ {lastRefresh.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
        </button>
      </div>

      {/* Hero stats row */}
      {hasActivity && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <div className="stats-card" style={{ flex: 1, padding: '12px', marginBottom: 0, textAlign: 'center' }}>
            <div style={{ fontSize: '9px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Tus pts hoy
            </div>
            <div className="gradient-text" style={{ fontSize: '24px', fontWeight: '900' }}>
              +{myTodayPoints}
            </div>
          </div>
          <div className="stats-card" style={{ flex: 1, padding: '12px', marginBottom: 0, textAlign: 'center' }}>
            <div style={{ fontSize: '9px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Partidos
            </div>
            <div style={{ fontSize: '24px', fontWeight: '900', color: 'var(--text-primary)' }}>
              {todayMatches.filter(m => isFinished(m) || isLive(m)).length}/{todayMatches.length}
            </div>
          </div>
        </div>
      )}

      {/* Countdown to next match */}
      {nextMatchDay && todayMatches.length === 0 && (
        <div className="stats-hero" style={{ textAlign: 'center', padding: '32px 20px', marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
            Próximo partido en
          </div>
          <div className="countdown-mono" style={{ fontSize: '28px', fontWeight: '900', color: 'var(--text-primary)' }}>
            {formatCountdown(nextMatchDay.date)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '8px' }}>
            {formatDate(nextMatchDay.date)}
          </div>
        </div>
      )}

      {/* No matches state */}
      {displayMatches.length === 0 && (
        <div className="stats-hero" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>⚽</div>
          <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '8px' }}>
            No hay partidos programados
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
            Los partidos aparecerán aquí cuando empiece el Mundial
          </div>
        </div>
      )}

      {/* Match Cards */}
      {displayMatches.map(match => {
        const pred = predictions[match.id]
        const status = getPointsStatus(pred, match)
        const consensus = getConsensus(match.id)
        const live = isLive(match)
        const finished = isFinished(match)
        const scheduled = !live && !finished
        const elapsed = live ? getElapsedMinute(match.match_date) : null

        return (
          <div key={match.id} className={live ? 'live-match-card' : 'stats-card'} style={{
            ...(live ? {
              border: '1px solid rgba(226,75,74,0.3)',
              background: 'linear-gradient(160deg, rgba(226,75,74,0.06) 0%, var(--bg-secondary) 40%, rgba(0,122,69,0.04) 100%)',
            } : finished ? {
              border: '1px solid rgba(0,122,69,0.2)',
              background: 'linear-gradient(135deg, rgba(0,122,69,0.04) 0%, var(--bg-secondary) 100%)',
            } : {}),
            position: 'relative', overflow: 'hidden'
          }}>

            {/* Top accent line */}
            {(live || finished) && (
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
                background: live
                  ? 'linear-gradient(90deg, var(--red), rgba(226,75,74,0.3))'
                  : 'linear-gradient(90deg, var(--green), rgba(0,122,69,0.2))'
              }} />
            )}

            {/* Match header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: live ? '6px' : '16px' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {match.stage === 'group' ? `Grupo ${match.group_name}` : match.stage?.replace('_', ' ')}
              </span>
              {live && (
                <span style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  fontSize: '10px', fontWeight: '700', color: 'var(--red)'
                }}>
                  <span className="live-dot" />
                  {elapsed ? `${elapsed}'` : 'EN VIVO'}
                </span>
              )}
              {scheduled && (
                <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
                  {formatTime(match.match_date)}
                </span>
              )}
              {finished && (
                <span style={{ fontSize: '10px', color: 'var(--green)', fontWeight: '600' }}>
                  FINAL
                </span>
              )}
            </div>

            {/* Progress bar for live matches */}
            {live && (
              <div className="match-progress-bar">
                <div className="match-progress-fill" style={{ width: `${Math.min(getMatchProgress(match.match_date), 100)}%` }} />
              </div>
            )}

            {/* Teams + Score */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', marginBottom: '18px' }}>
              {/* Home team */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                {match.home_team?.flag_url && (
                  <img src={match.home_team.flag_url} alt="" style={{
                    width: '40px', height: '28px', borderRadius: '4px', objectFit: 'cover',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
                  }} />
                )}
                <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: '600', textAlign: 'center' }}>
                  {match.home_team?.name || 'TBD'}
                </span>
              </div>

              {/* Score */}
              <div style={{ textAlign: 'center', minWidth: '90px' }}>
                {(live || finished) ? (
                  <div className={changedScores.has(match.id) ? 'score-changed' : ''} style={{
                    padding: '8px 20px',
                    background: live
                      ? 'linear-gradient(135deg, rgba(226,75,74,0.2), rgba(226,75,74,0.08))'
                      : 'linear-gradient(135deg, var(--green), #00a85a)',
                    borderRadius: '10px',
                    fontSize: '28px', fontWeight: '900', letterSpacing: '4px',
                    color: live ? 'var(--text-primary)' : '#fff',
                    fontFamily: 'SF Mono, Monaco, monospace',
                    boxShadow: finished ? '0 2px 8px rgba(0,122,69,0.3)' : 'none',
                    border: live ? '1px solid rgba(226,75,74,0.3)' : 'none'
                  }}>
                    {match.home_score}-{match.away_score}
                  </div>
                ) : (
                  <div style={{
                    padding: '8px 20px', borderRadius: '10px',
                    border: '1px dashed var(--border)',
                    fontSize: '14px', color: 'var(--text-dim)', fontWeight: '700'
                  }}>
                    vs
                  </div>
                )}
              </div>

              {/* Away team */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                {match.away_team?.flag_url && (
                  <img src={match.away_team.flag_url} alt="" style={{
                    width: '40px', height: '28px', borderRadius: '4px', objectFit: 'cover',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
                  }} />
                )}
                <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: '600', textAlign: 'center' }}>
                  {match.away_team?.name || 'TBD'}
                </span>
              </div>
            </div>

            {/* Your prediction vs reality */}
            {pred && (
              <div style={{
                display: 'flex', gap: '10px', alignItems: 'stretch', marginBottom: consensus ? '14px' : 0
              }}>
                {/* Your prediction */}
                <div className={status?.points === 3 ? 'exact-celebration' : ''} style={{
                  flex: 1, padding: '12px', borderRadius: '10px', textAlign: 'center',
                  background: status ? status.bg : 'var(--bg-input)',
                  border: status ? `1px solid ${status.color}30` : '1px solid var(--border)'
                }}>
                  <div style={{ fontSize: '9px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                    Tu predicción
                  </div>
                  <div style={{
                    fontSize: '22px', fontWeight: '800', letterSpacing: '3px',
                    fontFamily: 'SF Mono, Monaco, monospace',
                    color: status ? status.color : 'var(--text-primary)'
                  }}>
                    {pred.predicted_home}-{pred.predicted_away}
                  </div>
                  {status && (
                    <div style={{
                      marginTop: '6px', fontSize: '11px', fontWeight: '700',
                      color: status.color
                    }}>
                      {status.label} · +{status.points} pts
                    </div>
                  )}
                </div>

                {/* Points indicator */}
                {status && (
                  <div style={{
                    width: '60px', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    borderRadius: '10px', background: status.bg,
                    border: `1px solid ${status.color}30`
                  }}>
                    <div style={{
                      fontSize: '28px', fontWeight: '900', color: status.color, lineHeight: 1
                    }}>
                      {status.points === 3 ? '✓' : status.points === 1 ? '~' : '✗'}
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: '800', color: status.color, marginTop: '2px' }}>
                      +{status.points}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* No prediction warning */}
            {!pred && scheduled && (
              <div style={{
                padding: '10px', borderRadius: '8px', textAlign: 'center',
                background: 'rgba(255,204,0,0.06)', border: '1px solid rgba(255,204,0,0.15)',
                fontSize: '11px', color: 'var(--gold)'
              }}>
                No has predicho este partido
              </div>
            )}

            {/* Consensus bar */}
            {consensus && (live || finished) && (
              <div style={{ marginTop: pred ? 0 : '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                  {[
                    { label: '1', pct: consensus.homePct, color: '#00c464', bg: 'rgba(0,122,69,0.12)' },
                    { label: 'X', pct: consensus.drawPct, color: 'var(--text-secondary)', bg: 'rgba(74,79,94,0.25)' },
                    { label: '2', pct: consensus.awayPct, color: '#ffcc00', bg: 'rgba(255,204,0,0.1)' }
                  ].map(({ label, pct, color, bg }) => {
                    const max = Math.max(consensus.homePct, consensus.drawPct, consensus.awayPct)
                    return (
                      <div key={label} className="odds-pill" style={{
                        background: bg, color,
                        borderColor: pct === max ? `${color}60` : 'transparent',
                        padding: '6px 4px'
                      }}>
                        <div style={{ fontSize: '8px', fontWeight: '600', letterSpacing: '0.5px', opacity: 0.7 }}>{label}</div>
                        <div style={{ fontSize: '14px', fontWeight: '800', lineHeight: 1.2 }}>{pct}%</div>
                      </div>
                    )
                  })}
                </div>
                {consensus.favorite && (
                  <div style={{
                    marginTop: '8px', textAlign: 'center', fontSize: '10px', color: 'var(--text-dim)'
                  }}>
                    Favorito: <span style={{ color: 'var(--text-muted)', fontWeight: '600', fontFamily: 'SF Mono, Monaco, monospace' }}>{consensus.favorite}</span>
                    <span style={{ marginLeft: '4px', color: 'var(--gold)' }}>({consensus.favoritePct}%)</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Today's leaderboard delta */}
      {todayDelta.length > 0 && (
        <div className="stats-card" style={{ marginTop: '8px' }}>
          <div style={{
            fontSize: '10px', color: 'var(--gold)', textTransform: 'uppercase',
            letterSpacing: '1.2px', fontWeight: '700', marginBottom: '14px',
            display: 'flex', alignItems: 'center', gap: '8px'
          }}>
            <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--gold)', flexShrink: 0 }} />
            <span>Puntos de hoy</span>
            <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, var(--border), transparent)' }} />
          </div>

          {todayDelta.map((user, i) => {
            const isMe = user.userId === session?.user?.id
            return (
              <div key={user.userId} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '8px 0',
                borderBottom: i < todayDelta.length - 1 ? '0.5px solid var(--border-light)' : 'none'
              }}>
                {i < 3 ? (
                  <div style={{
                    width: '20px', height: '20px', borderRadius: '50%',
                    background: medalColors[i],
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '10px', fontWeight: '700', color: '#1a1d26', flexShrink: 0
                  }}>
                    {i + 1}
                  </div>
                ) : (
                  <span style={{
                    width: '20px', fontSize: '11px', fontWeight: '600',
                    color: 'var(--text-dim)', textAlign: 'center', flexShrink: 0
                  }}>
                    {i + 1}
                  </span>
                )}
                <span style={{
                  flex: 1, fontSize: '13px',
                  color: isMe ? 'var(--gold)' : 'var(--text-primary)',
                  fontWeight: isMe ? '600' : '400'
                }}>
                  {user.name}{isMe ? ' (Tú)' : ''}
                </span>
                <span style={{
                  fontSize: '14px', fontWeight: '800',
                  color: user.points > 0 ? 'var(--green)' : 'var(--text-dim)',
                  fontFamily: 'SF Mono, Monaco, monospace'
                }}>
                  +{user.points}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Auto-refresh indicator */}
      {hasLive && (
        <div style={{
          textAlign: 'center', padding: '16px', fontSize: '10px', color: 'var(--text-dim)'
        }}>
          Actualización automática cada 60s
        </div>
      )}
    </div>
  )
}
