import { useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../supabase'
import { generateMockLeaderboard } from '../hooks/useDemoMode'
import { SkeletonLeaderboard } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'
import H2HModal from '../components/H2HModal'
import Avatar from '../components/Avatar'
import { displayName } from '../utils/nickname'
import { FRIENDLY_TOURNAMENT_ENABLED, isFriendlyVisible } from '../config/featureFlags'
const BOT365_ID = 'b0365b03-65b0-365b-0365-b0365b036500'

function calcProvisionalPoints(pred, match) {
  // El partido está live: tratar scores null como 0. Esto garantiza que al
  // kickoff (antes de que haya gol o el sync haya corrido), los que predijeron
  // empates ya vean sus puntos provisionales (0-0 → quien predijo 0-0 = 3,
  // quien predijo empate distinto = 1, resto = 0).
  const home = match.home_score ?? 0
  const away = match.away_score ?? 0
  if (pred.predicted_home === home && pred.predicted_away === away) return 3
  const predSign = Math.sign(pred.predicted_home - pred.predicted_away)
  const realSign = Math.sign(home - away)
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
  const [profileFullNames, setProfileFullNames] = useState({})
  const [paymentConfirmed, setPaymentConfirmed] = useState(new Set())
  const [searchParams] = useSearchParams()
  // ?only=friendly → modo "solo Liguilla": tab activa friendly + tab bar oculta.
  const onlyFriendly = searchParams.get('only') === 'friendly'
  const [activeTab, setActiveTab] = useState(onlyFriendly ? 'friendly' : 'mundial')
  const [friendlyRankings, setFriendlyRankings] = useState([])
  const [userJoinedFriendly, setUserJoinedFriendly] = useState(false)
  // Datos por user para vista SofaScore (PJ, exactos, signos, fallos, form)
  const [friendlyDetail, setFriendlyDetail] = useState({}) // { userId: {pj, ex, si, mi, form: [3,1,0,...]} }

  useEffect(() => {
    fetchData()
    supabase.from('profiles').select('id, full_name, nickname, has_paid, payment_confirmed').then(({ data }) => {
      if (data) {
        const map = {}
        const fullNames = {}
        const paid = new Set()
        const payConfirmed = new Set()
        data.forEach(p => {
          // Nickname tiene preferencia para display público; full_name como fallback.
          map[p.id] = displayName(p)
          fullNames[p.id] = displayName(p)
          if (p.has_paid) paid.add(p.id)
          if (p.payment_confirmed) payConfirmed.add(p.id)
        })
        setProfileNames(map)
        setProfileFullNames(fullNames)
        setPaidUsers(paid)
        setPaymentConfirmed(payConfirmed)
      }
    })
  }, [])

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) setUserId(user.id)

    const [lbRes, liveRes] = await Promise.all([
      supabase.from('leaderboard').select('*'),
      supabase.from('matches').select('id, home_score, away_score, status, stage').eq('status', 'live')
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

    // Pre-Mundial leaderboard (feature-flagged + admin-only durante prueba)
    // Visible para: (a) usuarios inscritos a La Liguilla, o
    //               (b) cualquier usuario pagado una vez pasado el deadline
    //                   de inscripción (modo espectador — pueden seguir el
    //                   torneo aunque no se apuntaron).
    if (FRIENDLY_TOURNAMENT_ENABLED) {
      const meProf = user
        ? (await supabase.from('profiles').select('friendly_joined, payment_confirmed, is_admin').eq('id', user.id).single()).data
        : null
      if (isFriendlyVisible(meProf)) {
        const { data: flb } = await supabase.from('leaderboard_friendly').select('*')
        if (flb) setFriendlyRankings(flb)
        const deadlinePassed = new Date() >= new Date('2026-06-04T18:30:00Z') // 20:30 hora España
        const canSeeSpectator = deadlinePassed && meProf?.payment_confirmed
        if (meProf?.friendly_joined || canSeeSpectator) setUserJoinedFriendly(true)

        // Detalle SofaScore-style: PJ, ex, si, mi, FORM por user.
        const { data: friendlyMatches } = await supabase
          .from('matches')
          .select('id, match_date, status')
          .eq('stage', 'friendly')
        if (friendlyMatches?.length) {
          const matchIds = friendlyMatches.map(m => m.id)
          const matchById = Object.fromEntries(friendlyMatches.map(m => [m.id, m]))
          const { data: detailPreds } = await supabase
            .from('predictions')
            .select('user_id, match_id, predicted_home, predicted_away, points_earned')
            .in('match_id', matchIds)
          const byUser = {}
          ;(detailPreds || []).forEach(p => {
            if (!byUser[p.user_id]) byUser[p.user_id] = { pj: 0, ex: 0, si: 0, mi: 0, form: [] }
            const u = byUser[p.user_id]
            if (p.predicted_home != null) u.pj++
            const m = matchById[p.match_id]
            if (m?.status === 'finished' && p.predicted_home != null) {
              const pts = p.points_earned || 0
              if (pts === 3) u.ex++
              else if (pts === 1) u.si++
              else u.mi++
              u.form.push({ pts, date: m.match_date })
            }
          })
          Object.values(byUser).forEach(u => {
            u.form.sort((a, b) => new Date(b.date) - new Date(a.date))
            u.form = u.form.slice(0, 5).map(f => f.pts)
          })
          setFriendlyDetail(byUser)
        }
      }
    }

    setLoading(false)
  }

  async function computePositionChanges(currentRankings) {
    const twoDaysAgo = new Date()
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
    const cutoff = twoDaysAgo.toISOString()

    // Position changes solo se calculan con partidos del MUNDIAL real
    // (excluye friendlies). Sin esto, el día que termine España-Irak los
    // "▲ N posiciones" del leaderboard del Mundial reflejarían cambios
    // que no son del Mundial.
    const [matchesRes, preTournamentRes] = await Promise.all([
      supabase.from('matches').select('id').eq('status', 'finished').gte('match_date', cutoff).not('stage', 'in', '("friendly","test")'),
      supabase.from('pre_tournament_entries').select('user_id, points_awarded').eq('is_resolved', true).gte('updated_at', cutoff)
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

  // Provisional points from live matches — SEPARADOS por stage. La tab
  // Mundial usa solo matches stage != 'friendly'/'test'; la tab Liguilla
  // usa solo matches stage='friendly'. Sin esto, durante España-Irak (un
  // friendly) los puntos rojos contaminarían el leaderboard del Mundial Y
  // la tab Liguilla mostraría 0 rojos.
  const provisionalByStage = useMemo(() => {
    const mundial = {}
    const friendly = {}
    if (liveMatches.length === 0) return { mundial, friendly }
    livePredictions.forEach(pred => {
      const match = liveMatches.find(m => m.id === pred.match_id)
      if (!match) return
      const pts = calcProvisionalPoints(pred, match)
      if (pts <= 0) return
      const target = match.stage === 'friendly' ? friendly : mundial
      target[pred.user_id] = (target[pred.user_id] || 0) + pts
    })
    return { mundial, friendly }
  }, [liveMatches, livePredictions])

  // Stages live separados — para que el badge "LIVE" en el header de cada tab
  // solo aparezca cuando hay un partido EN VIVO de esa tab concreta.
  const hasLiveMundial = liveMatches.some(m => m.stage !== 'friendly' && m.stage !== 'test')
  const hasLiveFriendly = liveMatches.some(m => m.stage === 'friendly')

  // Auto-refresh every 30s when there are live matches (fallback in case Realtime drops)
  useEffect(() => {
    if (!hasLiveMundial && !hasLiveFriendly) return
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [hasLiveMundial, hasLiveFriendly])

  // Realtime push: when ANY match row changes (score, status), refetch immediately
  useEffect(() => {
    const channel = supabase
      .channel('lb-matches-realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches' }, () => {
        fetchData()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

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

  // Source data depende de la tab. friendly leaderboard ya viene filtrado por
  // friendly_joined desde la vista; solo aplicamos display name.
  const sourceRankings = activeTab === 'friendly' ? friendlyRankings : rankings
  const allRankings = demoMode ? mockRankings :
    sourceRankings
      .filter(r => activeTab === 'friendly' ? true : (r.user_id === BOT365_ID || paidUsers.has(r.user_id)))
      .map(r => ({
        ...r,
        full_name: profileNames[r.user_id] || r.full_name || 'Participante',
        // Provisional según la tab activa — el cálculo ya separa friendly/mundial.
        provisional: (activeTab === 'friendly' ? provisionalByStage.friendly : provisionalByStage.mundial)[r.user_id] || 0,
        effective_points: (r.total_points || 0) + ((activeTab === 'friendly' ? provisionalByStage.friendly : provisionalByStage.mundial)[r.user_id] || 0)
      }))
      // Always sort points desc, then exact hits desc (the tiebreaker), so the
      // visible order matches both the rules and the 🎯 exactos shown per row —
      // independent of whatever order the leaderboard view returns.
      .sort((a, b) => (b.total_points || 0) - (a.total_points || 0) || (b.exact_hits || 0) - (a.exact_hits || 0))

  // Re-sort by effective points when live (provisional points in play)
  // Resort por effective_points solo si hay live de la tab actual (si hay
  // friendly live pero estoy en tab mundial, no resorting).
  const tabHasLive = activeTab === 'friendly' ? hasLiveFriendly : hasLiveMundial
  if (tabHasLive && !demoMode) {
    allRankings.sort((a, b) =>
      b.effective_points - a.effective_points || (b.exact_hits || 0) - (a.exact_hits || 0)
    )
  }

  // Feature flag: temporarily hide Bot365 from the public UI. Data stays in
  // the database, predictions keep loading, the leaderboard view keeps
  // including it — only the visible row is suppressed. Flip to `true` to
  // bring the "Referencia · Casas de apuestas" row back without redeploys
  // beyond this file.
  const SHOW_BOT365 = false

  const bot365Entry = SHOW_BOT365 ? allRankings.find(u => u.user_id === BOT365_ID) : null
  const currentRankings = allRankings.filter(u => u.user_id !== BOT365_ID)
  const isEmpty = currentRankings.length === 0

  function getTiedRank(index) {
    const getPts = (r) => tabHasLive ? r.effective_points : r.total_points
    const pts = getPts(currentRankings[index])
    const exactHits = currentRankings[index].exact_hits || 0
    // Walk back to the first row sharing this pts+exactHits → that's the rank.
    let firstWithSame = index
    while (firstWithSame > 0 &&
      getPts(currentRankings[firstWithSame - 1]) === pts &&
      (currentRankings[firstWithSame - 1].exact_hits || 0) === exactHits) {
      firstWithSame--
    }
    const rank = firstWithSame + 1
    // Tied if ANY neighbour (before OR after) shares the same pts+exactHits.
    // Applies uniformly to every position — including 1st — so all members
    // of a tie get the "T" prefix (T1, T1, T1), not just the ones after the
    // first.
    const tiedWithPrev = firstWithSame < index
    const tiedWithNext = index + 1 < currentRankings.length &&
      getPts(currentRankings[index + 1]) === pts &&
      (currentRankings[index + 1].exact_hits || 0) === exactHits
    const tied = tiedWithPrev || tiedWithNext
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
  const maxPts = Math.max(...fullRankings.map(u => tabHasLive ? u.effective_points : u.total_points), 1)
  const firstLetter = (name) => ((name || '?')[0] || '?').toUpperCase()

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '16px', minHeight: '100svh' }}>

      {/* Header */}
      <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <h2 style={{
          fontSize: '28px', fontWeight: '800', color: 'var(--text-primary)',
          margin: 0, letterSpacing: '-0.5px'
        }}>
          Clasificación
        </h2>
        {((activeTab === 'mundial' && hasLiveMundial) || (activeTab === 'friendly' && hasLiveFriendly)) && (
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

      {/* Tabs Mundial / Pre-Mundial — ocultas en modo onlyFriendly (entrada
          directa desde /pre-mundial → Clasificación). */}
      {userJoinedFriendly && !onlyFriendly && (
        <div style={{
          display: 'flex', gap: '6px', marginBottom: '14px',
          padding: '4px', borderRadius: '10px',
          background: 'var(--bg-secondary)'
        }}>
          {[
            { key: 'mundial',  label: 'Mundial' },
            { key: 'friendly', label: 'La Liguilla' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              style={{
                flex: 1, padding: '8px 12px', borderRadius: '8px',
                border: 'none', cursor: 'pointer',
                background: activeTab === t.key ? 'var(--green)' : 'transparent',
                color: activeTab === t.key ? '#fff' : 'var(--text-muted)',
                fontSize: '12px', fontWeight: '700',
                letterSpacing: '0.4px',
                transition: 'background 0.15s ease, color 0.15s ease'
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {isEmpty ? (
        <EmptyState
          icon="🏆"
          title="Sin clasificación aún"
          subtitle="Se rellenará cuando empiecen los partidos del Mundial."
        />
      ) : activeTab === 'friendly' ? (
        renderFriendlySofaScore({
          fullRankings, currentRankings, getTiedRank, friendlyDetail,
          userId, tabHasLive
        })
      ) : (
        // SofaScore/Flashscore-style: dense list, hairline separators between rows,
        // no per-row card chrome. Card wraps the whole table.
        <div style={{
          background: 'var(--bg-secondary)',
          borderRadius: '12px',
          overflow: 'hidden'
        }}>
          {fullRankings.map((user, idx) => {
            const isMe = user.user_id === userId
            const isBot = user.isBot
            // Compute tied rank within currentRankings (skip Bot for ranking)
            let rankLabel, isTied, rankNum
            if (isBot) {
              rankLabel = ''
              isTied = false
              rankNum = null
            } else {
              const realIdx = currentRankings.findIndex(u => u.user_id === user.user_id)
              const { rank, tied } = getTiedRank(realIdx)
              rankLabel = tied ? `T${rank}` : `${rank}`
              isTied = tied
              rankNum = rank
            }
            const delta = isBot ? 0 : (positionChanges[user.user_id] || 0)
            const isLast = idx === fullRankings.length - 1

            // Medal color for top 3 (only when not tied for cleaner visuals)
            const medalColor = rankNum === 1 ? '#ffd700' : rankNum === 2 ? '#c0c0c0' : rankNum === 3 ? '#cd7f32' : null

            return (
              <div
                key={user.user_id + idx}
                className={!isMe && !isBot ? 'tap-scale' : ''}
                onClick={() => !isMe && !isBot && setH2hRival({ id: user.user_id, name: user.full_name })}
                style={{
                  display: 'flex', alignItems: 'center',
                  padding: '10px 12px',
                  background: isMe ? 'rgba(0,122,69,0.10)' : 'transparent',
                  borderBottom: isLast ? 'none' : '0.5px solid rgba(255,255,255,0.05)',
                  borderLeft: isMe ? '3px solid var(--green)' : '3px solid transparent',
                  cursor: !isMe && !isBot ? 'pointer' : 'default',
                  opacity: isBot ? 0.65 : 1,
                  minHeight: '48px'
                }}>

                {/* Rank number — bold, no "º", small medal color for top 3 */}
                <div style={{
                  width: '24px', textAlign: 'center', flexShrink: 0,
                  fontSize: '13px', fontWeight: '700',
                  color: isBot ? 'var(--text-dim)'
                    : medalColor && !isTied ? medalColor
                    : isMe ? '#fff' : 'var(--text-muted)'
                }}>
                  {rankLabel}
                </div>

                {/* Avatar (initials only, smaller) */}
                <Avatar
                  name={isBot ? 'Bot365' : (profileFullNames[user.user_id] || user.full_name)}
                  size={28}
                  color={isMe ? 'rgba(0,144,81,0.25)' : 'rgba(255,255,255,0.05)'}
                  border={isMe ? '1px solid rgba(0,144,81,0.4)' : '1px solid rgba(255,255,255,0.06)'}
                  textColor={isBot ? 'var(--text-dim)' : isMe ? '#4ade80' : 'var(--text-muted)'}
                  style={{ marginLeft: '8px', marginRight: '10px', flexShrink: 0 }}
                />

                {/* Name (1 line, truncated) + delta + tiny payment dot */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{
                    fontSize: '14px',
                    fontWeight: isMe ? '700' : '500',
                    color: isBot ? 'var(--text-dim)' : 'var(--text-primary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    minWidth: 0, flex: 1
                  }}>
                    {isBot ? 'Bot365' : user.full_name}{isMe ? ' · Tú' : ''}
                  </span>
                  {/* Payment status — small dot + label, only when NOT paid */}
                  {!isBot && !paymentConfirmed.has(user.user_id) && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                      flexShrink: 0
                    }}>
                      <span style={{
                        width: '6px', height: '6px', borderRadius: '50%',
                        background: '#c2362b'
                      }} />
                      <span style={{
                        fontSize: '10px', fontWeight: '600',
                        color: '#c2362b', opacity: 0.9,
                        letterSpacing: '0.2px'
                      }}>
                        No pagado
                      </span>
                    </span>
                  )}
                  {delta !== 0 && (
                    <span style={{
                      fontSize: '10px', fontWeight: '700',
                      color: delta > 0 ? '#4ade80' : '#e74c3c',
                      flexShrink: 0
                    }}>
                      {delta > 0 ? `▲${delta}` : `▼${Math.abs(delta)}`}
                    </span>
                  )}
                </div>

                {/* Points (bold, right-aligned, no "pts" label).
                    Si hay partido en vivo de la tab actual: mostramos el
                    running total (total_points + provisional) en rojo
                    parpadeante, SIN signo "+". Cuando el partido acabe se
                    consolida y deja de parpadear.
                    Si no hay live: total_points normal en blanco/dorado. */}
                <div style={{
                  textAlign: 'right', flexShrink: 0,
                  display: 'flex', alignItems: 'baseline', gap: '6px',
                  marginLeft: '8px'
                }}>
                  <span
                    className={tabHasLive ? 'live-points' : ''}
                    style={{
                      fontSize: '16px', fontWeight: '800',
                      color: tabHasLive
                        ? 'var(--red)'
                        : isBot ? 'var(--text-dim)' : isMe ? 'var(--gold)' : 'var(--text-primary)',
                      minWidth: '24px', textAlign: 'right'
                    }}
                  >
                    {tabHasLive ? user.effective_points : user.total_points}
                  </span>
                  {/* Exactos count — tiny, only if > 0 to reduce clutter */}
                  {!isBot && (user.exact_hits || 0) > 0 && (
                    <span style={{
                      fontSize: '10px', whiteSpace: 'nowrap',
                      color: isTied ? 'var(--gold)' : 'var(--text-dim)',
                      fontWeight: isTied ? '600' : '400',
                      minWidth: '22px', textAlign: 'right'
                    }}>
                      🎯{user.exact_hits}
                    </span>
                  )}
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

// ─── Vista SofaScore-style para La Liguilla ──────────────────────────────
// Tabla compacta con columnas: #, NICK, PJ, 3·(exactos), 1·(signos), ×(fallos),
// PTS y FORM (últimos 5 resultados como puntitos colorados).
// Paleta: azul=3pts (exacto), verde=1pt (signo), gris=0pt, rojo parpadeo=live.
function renderFriendlySofaScore({ fullRankings, currentRankings, getTiedRank, friendlyDetail, userId, tabHasLive }) {
  const C = {
    blue: '#2563eb',
    green: '#4ade80',
    gold: '#ffd700',
    silver: '#c0c0c0',
    bronze: '#cd7f32',
  }
  return (
    <div style={{
      background: 'var(--bg-secondary)',
      borderRadius: '12px',
      overflow: 'hidden',
      border: '1px solid rgba(37,99,235,0.15)'
    }}>
      {/* Header con columnas */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '28px 1fr 28px 28px 28px 28px 32px 70px',
        gap: '4px', padding: '8px 10px',
        fontSize: '9px', fontWeight: '800',
        color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.8px',
        background: 'rgba(37,99,235,0.05)',
        borderBottom: '1px solid rgba(37,99,235,0.15)'
      }}>
        <span>#</span>
        <span>Participante</span>
        <span title="Predichos" style={{ textAlign: 'center' }}>PJ</span>
        <span title="Exactos (3pt)" style={{ textAlign: 'center', color: C.blue }}>3·</span>
        <span title="Signos (1pt)" style={{ textAlign: 'center', color: C.green }}>1·</span>
        <span title="Fallos" style={{ textAlign: 'center' }}>×</span>
        <span title="Puntos totales" style={{ textAlign: 'right' }}>PTS</span>
        <span title="Últimos 5" style={{ textAlign: 'center' }}>FORM</span>
      </div>
      {fullRankings.map((user, idx) => {
        const isMe = user.user_id === userId
        const realIdx = currentRankings.findIndex(u => u.user_id === user.user_id)
        const { rank, tied } = getTiedRank(realIdx)
        const rankLabel = tied ? `T${rank}` : `${rank}`
        const medalColor = rank === 1 ? C.gold : rank === 2 ? C.silver : rank === 3 ? C.bronze : 'var(--text-muted)'
        const d = friendlyDetail[user.user_id] || { pj: 0, ex: 0, si: 0, mi: 0, form: [] }
        const pts = tabHasLive ? user.effective_points : user.total_points
        const isLast = idx === fullRankings.length - 1
        const formDots = (d.form || []).map((p, i) => (
          <span key={i} style={{
            display: 'inline-block', width: '8px', height: '8px',
            borderRadius: '50%', marginRight: '2px',
            background: p === 3 ? C.blue : p === 1 ? C.green : 'rgba(255,255,255,0.18)'
          }} />
        ))
        return (
          <div key={user.user_id} style={{
            display: 'grid',
            gridTemplateColumns: '28px 1fr 28px 28px 28px 28px 32px 70px',
            gap: '4px', padding: '8px 10px',
            alignItems: 'center', minHeight: '36px',
            background: isMe ? 'rgba(37,99,235,0.10)' : 'transparent',
            borderLeft: isMe ? `3px solid ${C.blue}` : '3px solid transparent',
            borderBottom: isLast ? 'none' : '0.5px solid rgba(255,255,255,0.05)',
            fontSize: '13px',
            fontVariantNumeric: 'tabular-nums'
          }}>
            <span style={{ fontWeight: 800, color: medalColor, textAlign: 'center' }}>{rankLabel}</span>
            <span style={{
              color: 'var(--text-primary)', fontWeight: isMe ? 700 : 500,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              minWidth: 0
            }}>{user.full_name}</span>
            <span style={{ color: 'var(--text-muted)', textAlign: 'center', fontSize: '12px' }}>{d.pj}</span>
            <span style={{ color: d.ex > 0 ? C.blue : 'var(--text-dim)', textAlign: 'center', fontWeight: 700 }}>{d.ex}</span>
            <span style={{ color: d.si > 0 ? C.green : 'var(--text-dim)', textAlign: 'center', fontWeight: 700 }}>{d.si}</span>
            <span style={{ color: 'var(--text-dim)', textAlign: 'center' }}>{d.mi}</span>
            <span
              className={user.provisional > 0 ? 'live-points' : ''}
              style={{
                textAlign: 'right', fontWeight: 800,
                color: user.provisional > 0 ? 'var(--red)' : (isMe ? C.blue : 'var(--text-primary)'),
                fontSize: '14px'
              }}
            >{pts}</span>
            <span style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>{formDots}</span>
          </div>
        )
      })}
    </div>
  )
}
