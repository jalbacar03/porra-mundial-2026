import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { generateMockLeaderboard } from '../hooks/useDemoMode'
import { SkeletonDashboard } from '../components/Skeleton'
import PointsChart from '../components/PointsChart'
import Avatar from '../components/Avatar'
import PWAInstallBanner from '../components/PWAInstallBanner'
import { PREDICTIONS_DEADLINE } from '../hooks/useCountdown'
import { useNotifications } from '../hooks/useNotifications'
import { useLivePoints } from '../hooks/useLivePoints'
import { displayName } from '../utils/nickname'
import { isFriendlyVisible } from '../config/featureFlags'
import NicknameModal from '../components/NicknameModal'

export default function Dashboard({ session, demoMode }) {
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [stats, setStats] = useState({ total: 0, completed: 0, points: 0, exactHits: 0, signHits: 0, rank: '-' })
  const [topRanking, setTopRanking] = useState([])
  const [groupProgress, setGroupProgress] = useState([])
  const [specialsCount, setSpecialsCount] = useState(0)
  const [bracketCount, setBracketCount] = useState(0)
  const [activeBetsCount, setActiveBetsCount] = useState(0)
  const [nextMatches, setNextMatches] = useState([])
  const [userPredictions, setUserPredictions] = useState({})
  const [totalUsers, setTotalUsers] = useState(0)
  const [totalParticipants, setTotalParticipants] = useState(0)
  const [testMatch, setTestMatch] = useState(null) // Pre-Mundial dry-run match (stage='test')
  const [editingNickname, setEditingNickname] = useState(false)
  const [dailyInsight, setDailyInsight] = useState(null)
  const [dailyInsightLong, setDailyInsightLong] = useState(null)
  const [insightLoading, setInsightLoading] = useState(true)
  const [showInsightLong, setShowInsightLong] = useState(false)
  const [postMatchReport, setPostMatchReport] = useState(null)
  const [liveMatches, setLiveMatches] = useState([])
  const [livePredictions, setLivePredictions] = useState({})
  const [loading, setLoading] = useState(true)
  const { permission: notifPerm, requestPermission, sendLocal, subscribePush } = useNotifications()
  const { points: livePoints, matchCount: liveMatchCount } = useLivePoints(session?.user?.id)
  const hasLiveMundial = liveMatchCount > 0
  const [notifDismissed, setNotifDismissed] = useState(() => localStorage.getItem('porra26_notif_dismissed') === '1')

  // Stable mock data (regenerate only when demoMode changes)
  const mockData = useMemo(() => {
    if (!demoMode) return null
    const mockRankings = generateMockLeaderboard(session.user.id)
    const myMock = mockRankings.find(r => r.user_id === session.user.id)
    const myIdx = mockRankings.indexOf(myMock)
    return { rankings: mockRankings, myStats: myMock, myRank: myIdx + 1 }
  }, [demoMode, session.user.id])

  useEffect(() => {
    fetchAll()
    fetchInsight()
  }, [])

  // If permission was already granted previously (e.g. user reinstalled the
  // PWA), make sure the push subscription is registered server-side. Idempotent.
  useEffect(() => {
    if (notifPerm === 'granted' && session?.user?.id) {
      subscribePush(session.user.id)
    }
  }, [notifPerm, session?.user?.id])

  // Realtime: when any match changes, refetch + (foreground) push notification
  // when a match the user predicted finishes. notifiedRef prevents duplicates
  // if multiple updates arrive for the same match.
  const notifiedRef = useRef(new Set())
  useEffect(() => {
    const channel = supabase
      .channel('dash-matches-realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches' }, async (payload) => {
        fetchAll()
        const m = payload.new
        if (!m || m.status !== 'finished') return
        if (notifiedRef.current.has(m.id)) return
        if (!userPredictions[m.id]) return // user didn't predict this match → skip
        notifiedRef.current.add(m.id)
        // Fetch team names for the title (cheap)
        const { data: teams } = await supabase
          .from('matches')
          .select('home_team:teams!matches_home_team_id_fkey(name), away_team:teams!matches_away_team_id_fkey(name)')
          .eq('id', m.id).maybeSingle()
        const home = teams?.home_team?.name || ''
        const away = teams?.away_team?.name || ''
        sendLocal(`Final: ${home} ${m.home_score}-${m.away_score} ${away}`, {
          body: 'Abre la app para ver tus puntos.',
          tag: `match-${m.id}`
        })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userPredictions, sendLocal])

  async function fetchInsight() {
    setInsightLoading(true)
    try {
      // Send the user's Supabase JWT — the endpoint is auth-gated to stop
      // anonymous callers from burning Gemini quota.
      const { data: { session: s } } = await supabase.auth.getSession()
      const res = await fetch('/api/generate-insight', {
        headers: s?.access_token ? { Authorization: `Bearer ${s.access_token}` } : {}
      })
      if (res.ok) {
        const data = await res.json()
        if (data.insight) {
          setDailyInsight(data.insight)
          setDailyInsightLong(data.insightLong || null)
          setInsightLoading(false)
          return
        }
      }
    } catch (err) {
      console.warn('Insight not available, falling back to RSS:', err)
    }
    // Fallback: fetch RSS headlines
    try {
      const feeds = [
        'https://e00-marca.uecdn.es/rss/futbol/mundial.xml',
        'https://feeds.as.com/mrss-s/pages/as/site/as.com/section/futbol/subsection/mundial/',
        'https://feeds.bbci.co.uk/sport/football/rss.xml'
      ]
      const headlines = []
      for (const feedUrl of feeds) {
        try {
          const r = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}`)
          if (r.ok) {
            const d = await r.json()
            if (d.items) headlines.push(...d.items.slice(0, 3).map(i => i.title))
          }
        } catch { /* skip failed feed */ }
      }
      if (headlines.length > 0) {
        setDailyInsight('📰 Últimas noticias del Mundial:\n\n' + headlines.slice(0, 5).map(h => `• ${h}`).join('\n'))
      }
    } catch { /* no fallback available */ }
    setInsightLoading(false)
  }

  async function fetchAll() {
    // Profile
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()
    if (profileData) setProfile(profileData)

    // All matches (for group progress + post-match report)
    const { data: allMatchesData } = await supabase
      .from('matches')
      .select('*, home_team:teams!matches_home_team_id_fkey(name, flag_url), away_team:teams!matches_away_team_id_fkey(name, flag_url)')
      .order('match_date', { ascending: true })

    const allMatches = allMatchesData?.filter(m => m.stage === 'group') || []

    const totalMatches = allMatches?.length || 0

    // User predictions
    const { data: preds } = await supabase
      .from('predictions')
      .select('*')
      .eq('user_id', session.user.id)

    const completed = preds?.length || 0
    const points = preds?.reduce((sum, p) => sum + (p.points_earned || 0), 0) || 0
    const exactHits = preds?.filter(p => p.points_earned === 3).length || 0
    const signHits = preds?.filter(p => p.points_earned === 1).length || 0

    // Build predictions map
    const predsMap = {}
    preds?.forEach(p => { predsMap[p.match_id] = true })
    setUserPredictions(predsMap)

    // Group progress
    const groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']
    const gProgress = groups.map(g => {
      const gMatches = allMatches?.filter(m => m.group_name === g) || []
      const gPredicted = gMatches.filter(m => predsMap[m.id]).length
      return { group: g, total: gMatches.length, done: gPredicted }
    })
    setGroupProgress(gProgress)

    // Pre-Mundial progress: count user's specials + bracket picks + active bets total.
    // Exclude round_of_32 from the bets count — it auto-fills from group predictions
    // and the user never picks it directly (so it would inflate the denominator).
    const [specialsRes, bracketRes, activeBetsRes] = await Promise.all([
      supabase.from('pre_tournament_entries').select('id', { count: 'exact', head: true }).eq('user_id', session.user.id),
      // Cuadro: contar solo picks que el usuario hace manualmente (R16+QF+SF+Final = 15).
      // R32 se auto-rellena desde las predicciones de grupo — incluirlo aquí infla
      // el numerador (29/15) aunque el usuario no haya tocado nada.
      supabase.from('bracket_picks').select('id', { count: 'exact', head: true }).eq('user_id', session.user.id).not('predicted_winner_id', 'is', null).neq('round', 'r32'),
      supabase.from('pre_tournament_bets').select('id', { count: 'exact', head: true }).eq('is_active', true).neq('slug', 'round_of_32')
    ])
    setSpecialsCount(specialsRes.count || 0)
    setBracketCount(bracketRes.count || 0)
    setActiveBetsCount(activeBetsRes.count || 13)

    // Live matches (status='live') and next upcoming
    const now = new Date()
    const live = (allMatchesData || []).filter(m => m.status === 'live')
    setLiveMatches(live)
    const upcoming = allMatches?.filter(m => m.status !== 'finished' && m.status !== 'live' && new Date(m.match_date) > now).slice(0, 3) || []
    setNextMatches(upcoming)

    // User's predictions for live matches (for the EN DIRECTO overlay)
    if (live.length > 0) {
      const liveIds = live.map(m => m.id)
      const livePreds = {}
      preds?.filter(p => liveIds.includes(p.match_id)).forEach(p => { livePreds[p.match_id] = p })
      setLivePredictions(livePreds)
    }

    // Leaderboard + profiles for nickname
    const BOT365_ID = 'b0365b03-65b0-365b-0365-b0365b036500'
    const { data: rankings } = await supabase
      .from('leaderboard')
      .select('*')
    const { data: allProfiles } = await supabase
      .from('profiles')
      .select('id, full_name, nickname, has_paid')

    const nicknameMap = {}
    const paidSet = new Set()
    allProfiles?.forEach(p => {
      nicknameMap[p.id] = displayName(p)
      if (p.has_paid) paidSet.add(p.id)
    })

    // Bote: total de participantes (excluyendo Bot365), tanto pagados como no.
    // El user pidió contar a todo el mundo: damos por hecho que pagarán todos.
    const participantsCount = (allProfiles || []).filter(p => p.id !== BOT365_ID).length
    setTotalParticipants(participantsCount)

    // Test match (pre-Mundial dry-run): a single friendly used to validate
    // the live flow end-to-end. Shown as a prominent banner if it exists
    // and hasn't finished yet.
    // Próximo partido a destacar: el friendly más cercano (live > scheduled
    // ordenado por fecha). Si está live, el banner muestra score + minuto.
    const nowIso = new Date().toISOString()
    const in3hIso = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString()
    const { data: testMatchData } = await supabase
      .from('matches')
      .select('*, home_team:teams!matches_home_team_id_fkey(id, name, flag_url), away_team:teams!matches_away_team_id_fkey(id, name, flag_url)')
      .eq('stage', 'friendly')
      .neq('status', 'finished')
      .lte('match_date', in3hIso)  // solo si está en próximas 3h (o ya en juego)
      .order('match_date', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (testMatchData) {
      const testPred = preds?.find(p => p.match_id === testMatchData.id)
      setTestMatch({ ...testMatchData, userPrediction: testPred || null })
    }

    let rank = '-'
    let rankingsTotal = 0
    if (rankings) {
      // Filter out Bot365 and unpaid users
      const realRankings = rankings.filter(r => r.user_id !== BOT365_ID && paidSet.has(r.user_id))
      rankingsTotal = realRankings.length

      // Calculate tied position
      const myIdx = realRankings.findIndex(r => r.user_id === session.user.id)
      if (myIdx !== -1) {
        const myPts = realRankings[myIdx].total_points
        let firstWithSame = myIdx
        while (firstWithSame > 0 && realRankings[firstWithSame - 1].total_points === myPts) {
          firstWithSame--
        }
        const pos = firstWithSame + 1
        const isTied = (firstWithSame < myIdx) ||
          (myIdx + 1 < realRankings.length && realRankings[myIdx + 1].total_points === myPts)
        rank = isTied ? `T${pos}` : pos
      }

      setTopRanking(realRankings.slice(0, 5).map(r => ({
        ...r,
        full_name: nicknameMap[r.user_id] || r.full_name
      })))
    }
    setTotalUsers(rankingsTotal)

    setStats({ total: totalMatches, completed, points, exactHits, signHits, rank })

    // Post-match report: find the most recent completed match day
    const finishedAll = (allMatchesData || []).filter(m => m.status === 'finished' && m.home_score !== null)
    if (finishedAll.length > 0 && preds?.length > 0) {
      // Group finished matches by date
      const matchesByDay = {}
      finishedAll.forEach(m => {
        const day = new Date(m.match_date).toDateString()
        if (!matchesByDay[day]) matchesByDay[day] = []
        matchesByDay[day].push(m)
      })
      // Get the most recent match day
      const sortedDays = Object.keys(matchesByDay).sort((a, b) => new Date(b) - new Date(a))
      const lastDay = sortedDays[0]
      const lastDayMatches = matchesByDay[lastDay]

      // Check user's predictions for those matches
      const predsMap2 = {}
      preds.forEach(p => { predsMap2[p.match_id] = p })

      let dayExacts = 0, daySigns = 0, dayMisses = 0, dayPoints = 0
      let bestMatch = null, bestPoints = -1
      lastDayMatches.forEach(m => {
        const pred = predsMap2[m.id]
        if (!pred) return
        const pts = pred.points_earned || 0
        dayPoints += pts
        if (pts === 3) { dayExacts++; if (pts > bestPoints) { bestPoints = pts; bestMatch = m } }
        else if (pts === 1) { daySigns++; if (pts > bestPoints) { bestPoints = pts; bestMatch = m } }
        else dayMisses++
      })

      const dayTotal = dayExacts + daySigns + dayMisses
      if (dayTotal > 0) {
        setPostMatchReport({
          date: lastDay,
          dateLabel: new Date(lastDay).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }),
          matches: lastDayMatches.length,
          predicted: dayTotal,
          exacts: dayExacts,
          signs: daySigns,
          misses: dayMisses,
          points: dayPoints,
          bestMatch,
          bestPoints
        })
      }
    }

    setLoading(false)
  }

  // Formato del minuto/estado del partido para el banner: "23'", "HT", "75'", "FT", etc.
function formatLiveMinute(m) {
  if (!m) return ''
  const s = m.live_status_short
  if (s === 'HT') return 'Descanso'
  if (s === 'BT') return 'Break'
  if (s === 'P')  return 'Penaltis'
  if (s === 'ET') return `${m.live_minute || ''}' prórroga`.trim()
  if (m.live_minute != null) return `${m.live_minute}'`
  return ''
}

function formatDateShort(dateStr) {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  if (loading) {
    return <SkeletonDashboard />
  }

  // Use mock data in demo mode
  const displayStats = demoMode && mockData
    ? { ...stats, points: mockData.myStats?.total_points || 27, exactHits: mockData.myStats?.exact_hits || 5, signHits: mockData.myStats?.sign_hits || 8, rank: mockData.myRank, completed: stats.total }
    : stats
  const displayTopRanking = demoMode && mockData ? mockData.rankings.slice(0, 5) : topRanking
  const displayTotalUsers = demoMode && mockData ? mockData.rankings.length : totalUsers
  const displayInsight = demoMode
    ? 'Jornada 2 del Mundial completada. España goleo 3-0 a Croacia con un doblete de Pedri. Argentina empato 1-1 ante Senegal en un partido muy disputado. Brasil vencio a Panama por la minima (1-0) con gol de Vinicius en el 89\'. Japon dio la sorpresa al derrotar a Alemania 2-1 repitiendo la hazana de Qatar 2022.'
    : dailyInsight
  const displayInsightLoading = demoMode ? false : insightLoading

  // Top 5 max points for bar scaling
  const maxPoints = displayTopRanking.length > 0 ? Math.max(displayTopRanking[0]?.total_points || 1, 1) : 1

  // Greeting + delta vs yesterday (from postMatchReport.points)
  const userName = (profile?.full_name || 'Participante').split(' ')[0]
  const userInitial = ((profile?.full_name || '?')[0] || '?').toUpperCase()
  const deltaVsYesterday = postMatchReport?.points || 0
  const hasLive = liveMatches.length > 0

  // Leader info: highest paid (excluding bot), names tied if multiple
  const myPoints = displayStats.points
  const leaderInfo = (() => {
    if (!displayTopRanking.length) return null
    const top = displayTopRanking[0]
    const topPts = top.total_points
    if (myPoints >= topPts) return null
    const tied = displayTopRanking.filter(r => r.total_points === topPts)
    return { points: topPts, names: tied.map(t => t.full_name).join(', ') }
  })()

  function calcLivePts(pred, match) {
    if (!pred || match.home_score === null) return 0
    if (pred.predicted_home === match.home_score && pred.predicted_away === match.away_score) return 3
    return Math.sign(pred.predicted_home - pred.predicted_away) === Math.sign(match.home_score - match.away_score) ? 1 : 0
  }

  return (
    <div className="stagger-in" style={{ maxWidth: '500px', margin: '0 auto', padding: '16px', minHeight: '100svh' }}>

      {/* ===== HEADER: "PORRA MUNDIAL 26" + greeting + avatar ===== */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{
          fontSize: '10px', fontWeight: '700', color: 'var(--text-dim)',
          letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '6px'
        }}>
          Porra Mundial <span style={{ color: 'var(--gold)' }}>26</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <h1 style={{
            fontSize: '26px', fontWeight: '800', color: 'var(--text-primary)',
            margin: 0, letterSpacing: '-0.5px'
          }}>
            Hola, {userName}
          </h1>
          <button
            onClick={() => setEditingNickname(true)}
            aria-label="Cambiar nickname"
            title="Cambiar nickname"
            style={{
              background: 'transparent', border: 'none', padding: 0,
              cursor: 'pointer', borderRadius: '50%'
            }}
          >
            <Avatar
              name={profile?.nickname || profile?.full_name}
              size={40}
              color="rgba(0,144,81,0.18)"
              border="1px solid rgba(0,144,81,0.3)"
              textColor="#4ade80"
            />
          </button>
        </div>
      </div>

      {/* PWA install prompt — only renders when applicable (not standalone, not dismissed) */}
      {!demoMode && <PWAInstallBanner />}

      {/* === TEST MATCH BANNER (dry-run pre-Mundial) === */}
      {testMatch && (() => {
        const matchDate = new Date(testMatch.match_date)
        const isLive = testMatch.status === 'live'
        const dateStr = matchDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })
        const timeStr = matchDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
        const pred = testMatch.userPrediction
        const hasPred = pred && pred.predicted_home !== null && pred.predicted_away !== null
        return (
          <div
            onClick={() => navigate('/pre-mundial')}
            role="button" tabIndex={0}
            className="tap-scale"
            style={{
              marginBottom: '14px',
              padding: '14px 16px',
              borderRadius: '14px',
              background: isLive
                ? 'linear-gradient(135deg, #3a1418, #5a1d24)'
                : 'linear-gradient(135deg, #1a2433, #2a3950)',
              border: isLive
                ? '1.5px solid rgba(226,75,74,0.5)'
                : '1px solid rgba(100,150,255,0.25)',
              cursor: 'pointer',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{
                fontSize: '10px', fontWeight: '800',
                color: isLive ? 'var(--red)' : '#7eb3ff',
                letterSpacing: '1.4px', textTransform: 'uppercase'
              }}>
                {isLive
                  ? `🔴 EN DIRECTO${formatLiveMinute(testMatch) ? ` · ${formatLiveMinute(testMatch)}` : ''}`
                  : 'La Liguilla · próximo partido'}
              </span>
              {isLive && <span className="live-dot" />}
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: '12px', marginBottom: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                {testMatch.home_team?.flag_url && (
                  <img src={testMatch.home_team.flag_url} alt="" style={{ width: '24px', height: '16px', borderRadius: '2px' }} />
                )}
                <span style={{ fontSize: '16px', fontWeight: '700', color: '#fff' }}>
                  {testMatch.home_team?.name || '?'}
                </span>
              </div>
              {isLive ? (
                <span className="live-pulse" style={{ fontSize: '22px', fontWeight: '800', color: '#fff' }}>
                  {testMatch.home_score ?? 0} - {testMatch.away_score ?? 0}
                </span>
              ) : (
                <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', fontWeight: '600' }}>vs</span>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, justifyContent: 'flex-end' }}>
                <span style={{ fontSize: '16px', fontWeight: '700', color: '#fff' }}>
                  {testMatch.away_team?.name || '?'}
                </span>
                {testMatch.away_team?.flag_url && (
                  <img src={testMatch.away_team.flag_url} alt="" style={{ width: '24px', height: '16px', borderRadius: '2px' }} />
                )}
              </div>
            </div>
            <div style={{
              fontSize: '12px', color: 'rgba(255,255,255,0.6)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <span>
                {dateStr} · {timeStr}
                {testMatch.city && ` · 📍 ${testMatch.city}`}
              </span>
              {hasPred ? (
                <span style={{
                  fontSize: '11px', fontWeight: '700', color: '#4ade80',
                  background: 'rgba(74,222,128,0.12)',
                  padding: '4px 8px', borderRadius: '6px'
                }}>
                  ✓ Tu predicción: {pred.predicted_home}-{pred.predicted_away}
                </span>
              ) : (
                <span style={{
                  fontSize: '11px', fontWeight: '700', color: '#ffcc00',
                  background: 'rgba(255,204,0,0.12)',
                  padding: '4px 8px', borderRadius: '6px'
                }}>
                  Predice ahora →
                </span>
              )}
            </div>
            {/* CTA siempre visible: lleva al calendario de los 12 partidos */}
            <div style={{
              marginTop: '12px', paddingTop: '10px',
              borderTop: '1px solid rgba(255,255,255,0.08)',
              fontSize: '12px', color: 'rgba(255,255,255,0.7)', fontWeight: '600',
              textAlign: 'center'
            }}>
              Ver los 12 partidos y clasificación de La Liguilla →
            </div>
          </div>
        )
      })()}

      {/* === PRE-MUNDIAL CARD (genérico) ===
          Solo aparece cuando NO hay próximo partido friendly en ventana ±3h
          (es decir, no estamos mostrando el banner "próximo partido" arriba).
          Evita el doble widget azul cuando ya hay info concreta del partido.
       */}
      {isFriendlyVisible(profile) && profile?.has_paid && !testMatch && (() => {
        const LIGUILLA_DEADLINE = new Date('2026-06-04T18:50:00Z') // 20:50 hora España
        const deadlinePassed = new Date() >= LIGUILLA_DEADLINE
        const inLiguilla = !!profile.friendly_joined
        // Color/copy según el estado
        const stateColor = inLiguilla ? '#7eb3ff' : (deadlinePassed ? '#9b9eaa' : '#ffcc00')
        const bgGradient = inLiguilla
          ? 'linear-gradient(135deg, #1a2433, #0f1b2e)'
          : deadlinePassed
            ? 'linear-gradient(135deg, #1a1d26, #1a1d26)'
            : 'linear-gradient(135deg, #2a2410, #3a1d18)'
        const borderColor = inLiguilla
          ? '1px solid rgba(100,150,255,0.25)'
          : deadlinePassed
            ? '1px solid rgba(255,255,255,0.08)'
            : '1.5px solid rgba(255,204,0,0.4)'
        const titleText = inLiguilla
          ? 'Estás dentro de La Liguilla'
          : deadlinePassed
            ? 'La Liguilla en marcha'
            : '12 amistosos. Top 3 recuperan los 20€'
        const ctaText = inLiguilla
          ? 'Predice tus partidos →'
          : deadlinePassed
            ? 'Sigue la clasificación y resultados →'
            : 'Pulsa para apuntarte →'
        return (
          <div
            onClick={() => navigate('/pre-mundial')}
            role="button" tabIndex={0}
            className="tap-scale"
            style={{
              marginBottom: '14px', padding: '14px 16px',
              borderRadius: '14px',
              background: bgGradient,
              border: borderColor,
              cursor: 'pointer'
            }}
          >
            <div style={{
              fontSize: '10px', fontWeight: '800',
              color: stateColor,
              letterSpacing: '1.4px', textTransform: 'uppercase',
              marginBottom: '6px'
            }}>
              🏆 La Liguilla · 4-9 jun
            </div>
            <div style={{
              fontSize: '16px', fontWeight: '700', color: '#fff',
              marginBottom: '4px'
            }}>
              {titleText}
            </div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
              {ctaText}
            </div>
          </div>
        )
      })()}

      {/* ===== HERO: TU POSICIÓN · LIVE + BOTE ===== */}
      <div style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '14px',
        flexWrap: 'wrap'
      }}>
      <div style={{
        flex: '2 1 280px',
        background: 'linear-gradient(135deg, #00392a, #00643d)',
        borderRadius: '14px',
        padding: '18px 20px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute', top: '-30px', right: '-30px',
          width: '100px', height: '100px', borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.05)'
        }} />
        <div style={{
          position: 'absolute', top: '-60px', right: '-60px',
          width: '160px', height: '160px', borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.03)'
        }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <span style={{
            fontSize: '10px', color: 'rgba(255,255,255,0.5)',
            textTransform: 'uppercase', letterSpacing: '1.4px', fontWeight: '600'
          }}>
            Tu posición
          </span>
          {hasLive && (
            <>
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px' }}>·</span>
              <span className="live-pulse" style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                fontSize: '10px', fontWeight: '700', color: '#ff6b6b',
                textTransform: 'uppercase', letterSpacing: '1.2px'
              }}>
                <span className="live-dot" /> Live
              </span>
            </>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', marginBottom: '14px' }}>
          <span style={{ fontSize: '46px', fontWeight: '800', color: '#fff', lineHeight: 1 }}>
            {displayStats.rank}{typeof displayStats.rank === 'number' && <span>.<sup style={{ fontSize: '24px', fontWeight: '700' }}>º</sup></span>}
          </span>
          <span style={{ fontSize: '15px', color: 'rgba(255,255,255,0.5)', paddingBottom: '6px' }}>
            /{displayTotalUsers > 0 ? displayTotalUsers : '?'}
          </span>
          {/* ▲ delta if positive */}
          {deltaVsYesterday > 0 && (
            <span style={{
              marginLeft: 'auto', marginBottom: '8px',
              padding: '4px 9px', borderRadius: '20px',
              background: 'rgba(0,0,0,0.25)', color: '#4ade80',
              fontSize: '11px', fontWeight: '700',
              display: 'inline-flex', alignItems: 'center', gap: '3px'
            }}>
              ▲ {deltaVsYesterday}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '20px', alignItems: 'baseline' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', flexWrap: 'wrap' }}>
              <span
                className={hasLiveMundial ? 'live-points' : ''}
                style={{
                  fontSize: '22px', fontWeight: '800',
                  color: hasLiveMundial ? 'var(--red)' : '#fff',
                  lineHeight: 1
                }}
              >
                {hasLiveMundial ? (displayStats.points + livePoints) : displayStats.points}
              </span>
              {leaderInfo && (
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', fontWeight: '500' }}>
                  · líder {leaderInfo.points} <span style={{ color: 'rgba(255,255,255,0.6)' }}>({leaderInfo.names})</span>
                </span>
              )}
            </div>
            <div style={{
              fontSize: '9px', color: 'rgba(255,255,255,0.5)',
              textTransform: 'uppercase', letterSpacing: '1.2px', marginTop: '4px', fontWeight: '600'
            }}>
              Puntos
            </div>
          </div>
          <div>
            <div style={{ fontSize: '22px', fontWeight: '800', color: 'var(--gold)', lineHeight: 1 }}>
              {displayStats.exactHits}
            </div>
            <div style={{
              fontSize: '9px', color: 'rgba(255,255,255,0.5)',
              textTransform: 'uppercase', letterSpacing: '1.2px', marginTop: '4px', fontWeight: '600'
            }}>
              Exactos
            </div>
          </div>
          {deltaVsYesterday > 0 && (
            <div>
              <div style={{ fontSize: '22px', fontWeight: '800', color: '#4ade80', lineHeight: 1 }}>
                +{deltaVsYesterday}
              </div>
              <div style={{
                fontSize: '9px', color: 'rgba(255,255,255,0.5)',
                textTransform: 'uppercase', letterSpacing: '1.2px', marginTop: '4px', fontWeight: '600'
              }}>
                Vs. Ayer
              </div>
            </div>
          )}
        </div>
      </div>

      {/* === BOTE ACUMULADO === */}
      {(() => {
        // El bote (N×16€) ya es el 100% repartible. Mantenemos la proporción
        // antigua 5:2:1 (antes 50/20/10 sobre 100€/persona) renormalizada para
        // que la suma cubra el bote entero: 62.5% / 25% / 12.5%.
        const bote = totalParticipants * 16
        const first  = Math.round(bote * 0.625)
        const second = Math.round(bote * 0.25)
        const third  = bote - first - second  // resto (asegura que suma exacta = bote)
        return (
          <div style={{
            flex: '1 1 220px',
            background: 'linear-gradient(135deg, #1a1d26, #2a2410)',
            borderRadius: '14px',
            padding: '18px 20px',
            position: 'relative',
            overflow: 'hidden',
            border: '1px solid rgba(255,204,0,0.18)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px'
          }}>
            {/* decorative circle */}
            <div style={{
              position: 'absolute', top: '-30px', right: '-30px',
              width: '100px', height: '100px', borderRadius: '50%',
              border: '1px solid rgba(255,204,0,0.08)'
            }} />

            {/* Left: bote total */}
            <div style={{ flex: '1 1 auto', minWidth: 0 }}>
              <div style={{
                fontSize: '10px', color: 'rgba(255,204,0,0.6)',
                textTransform: 'uppercase', letterSpacing: '1.4px', fontWeight: '600',
                marginBottom: '8px'
              }}>
                Bote acumulado
              </div>
              <div style={{
                fontSize: '30px', fontWeight: '800', color: 'var(--gold)',
                lineHeight: 1, letterSpacing: '-1px'
              }}>
                {bote.toLocaleString('es-ES')} €
              </div>
            </div>

            {/* Right: distribución compacta */}
            <div style={{
              flexShrink: 0, paddingLeft: '12px',
              borderLeft: '1px solid rgba(255,204,0,0.12)',
              fontSize: '10px', lineHeight: '1.45',
              color: 'rgba(255,255,255,0.65)',
              minWidth: '90px'
            }}>
              <div style={{
                fontSize: '8.5px', color: 'rgba(255,204,0,0.55)',
                textTransform: 'uppercase', letterSpacing: '1.1px', fontWeight: '700',
                marginBottom: '4px'
              }}>
                Reparto
              </div>
              <div><span style={{ color: '#ffd700', fontWeight: 700 }}>1º</span> · {first.toLocaleString('es-ES')}€</div>
              <div><span style={{ color: '#c0c0c0', fontWeight: 700 }}>2º</span> · {second.toLocaleString('es-ES')}€</div>
              <div><span style={{ color: '#cd7f32', fontWeight: 700 }}>3º</span> · {third.toLocaleString('es-ES')}€</div>
            </div>
          </div>
        )
      })()}

      </div>

      {/* ===== TU PROGRESO (pre-Mundial only — pushes users to complete predictions) ===== */}
      {!demoMode && new Date() < PREDICTIONS_DEADLINE && (() => {
        const groupTotal = groupProgress.reduce((s, g) => s + g.total, 0) || 72
        const groupDone = groupProgress.reduce((s, g) => s + g.done, 0)
        const items = [
          { label: 'Grupos', done: groupDone, total: groupTotal },
          { label: 'Especiales', done: specialsCount, total: activeBetsCount },
          { label: 'Cuadro', done: bracketCount, total: 15 }
        ]
        const allDone = items.every(i => i.done >= i.total)
        return (
          <div onClick={() => navigate('/predictions')} role="button" tabIndex={0}
            style={{
              marginBottom: '14px', padding: '14px 16px',
              background: 'var(--bg-secondary)', borderRadius: '12px',
              border: allDone ? '1px solid rgba(0,144,81,0.3)' : '1px solid var(--border-light)',
              cursor: 'pointer'
            }}>
            <div style={{
              display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '12px'
            }}>
              <span style={{
                fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '1.2px'
              }}>Tu progreso</span>
              <span style={{
                fontSize: '11px', fontWeight: '600',
                color: allDone ? 'var(--green)' : 'var(--gold)'
              }}>
                {allDone ? '✓ Completo' : 'Cierra el 9 jun'}
              </span>
            </div>
            {items.map(it => {
              const pct = it.total > 0 ? Math.min(100, Math.round((it.done / it.total) * 100)) : 0
              const complete = it.done >= it.total
              return (
                <div key={it.label} style={{ marginBottom: '10px', cursor: 'pointer' }}
                     onClick={() => navigate('/predictions')}>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                    marginBottom: '4px'
                  }}>
                    <span style={{
                      fontSize: '12px', fontWeight: '600',
                      color: complete ? 'var(--green)' : 'var(--text-primary)'
                    }}>{it.label}</span>
                    <span style={{
                      fontSize: '12px', fontWeight: '700',
                      color: complete ? 'var(--green)' : 'var(--text-muted)',
                      fontVariantNumeric: 'tabular-nums'
                    }}>
                      {it.done} / {it.total}
                    </span>
                  </div>
                  <div style={{
                    height: '4px', borderRadius: '3px',
                    background: 'rgba(255,255,255,0.04)', overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${pct}%`, height: '100%',
                      background: complete
                        ? 'var(--green)'
                        : 'linear-gradient(90deg, var(--green), var(--gold))',
                      transition: 'width 0.4s ease'
                    }} />
                  </div>
                </div>
              )
            })}
          </div>
        )
      })()}

      {/* ===== EN DIRECTO (live match widget with prediction overlay) ===== */}
      {liveMatches.length > 0 && (
        <div style={{ marginBottom: '14px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: '8px', padding: '0 4px'
          }}>
            <span style={{
              fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '1.2px'
            }}>En directo</span>
            <span className="live-pulse" style={{
              fontSize: '11px', fontWeight: '700', color: 'var(--red)',
              display: 'inline-flex', alignItems: 'center', gap: '4px'
            }}>
              <span className="live-dot" /> {liveMatches[0].minute ? `MIN ${liveMatches[0].minute}'` : 'LIVE'}
            </span>
          </div>
          {liveMatches.slice(0, 1).map(m => {
            const pred = livePredictions[m.id]
            const livePts = pred ? calcLivePts(pred, m) : 0
            return (
              <div key={m.id} style={{
                background: 'var(--bg-secondary)', borderRadius: '12px',
                padding: '14px 16px', borderLeft: '3px solid var(--red)',
                cursor: 'pointer'
              }} onClick={() => navigate('/match-day-live')}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {m.home_team?.flag_url && <img src={m.home_team.flag_url} alt="" style={{ width: '22px', height: '14px', borderRadius: '2px', objectFit: 'cover' }} />}
                    <span style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>{m.home_team?.name}</span>
                  </div>
                  <span style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)' }}>{m.home_score ?? 0}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {m.away_team?.flag_url && <img src={m.away_team.flag_url} alt="" style={{ width: '22px', height: '14px', borderRadius: '2px', objectFit: 'cover' }} />}
                    <span style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>{m.away_team?.name}</span>
                  </div>
                  <span style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)' }}>{m.away_score ?? 0}</span>
                </div>
                {pred && (
                  <div style={{
                    marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px', borderRadius: '8px',
                    background: livePts > 0 ? 'rgba(255,204,0,0.08)' : 'rgba(255,255,255,0.03)',
                    border: livePts > 0 ? '1px solid rgba(255,204,0,0.25)' : '1px solid var(--border-light)'
                  }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Tu predicción <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{pred.predicted_home} — {pred.predicted_away}</span>
                      {livePts === 3 && <span style={{ marginLeft: '4px', color: 'var(--gold)' }}>✓</span>}
                      {livePts === 1 && <span style={{ marginLeft: '4px', color: 'var(--green)' }}>~</span>}
                    </span>
                    <span style={{
                      fontSize: '13px', fontWeight: '700',
                      color: livePts > 0 ? 'var(--gold)' : 'var(--text-dim)'
                    }}>
                      {livePts > 0 ? `+${livePts} pts` : '0 pts'}
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ===== POST-MATCH REPORT ===== */}
      {postMatchReport && !demoMode && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(0,122,69,0.06), var(--bg-secondary))',
          borderRadius: '10px',
          padding: '16px 18px',
          marginBottom: '12px',
          border: '1px solid rgba(0,122,69,0.15)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
            background: 'linear-gradient(90deg, var(--green), var(--gold), var(--green))'
          }} />
          <div style={{
            fontSize: '10px', color: 'var(--green)', textTransform: 'uppercase',
            letterSpacing: '1px', fontWeight: '600', marginBottom: '12px',
            display: 'flex', alignItems: 'center', gap: '6px'
          }}>
            <span>📊</span> Informe de jornada
            <span style={{
              fontSize: '9px', color: 'var(--text-dim)', fontWeight: '400',
              marginLeft: 'auto', textTransform: 'capitalize', letterSpacing: '0'
            }}>{postMatchReport.dateLabel}</span>
          </div>

          {/* Stats row */}
          <div style={{
            display: 'flex', gap: '8px', marginBottom: '12px'
          }}>
            {[
              { value: postMatchReport.exacts, label: 'Exactos', color: 'var(--gold)', bg: 'rgba(255,204,0,0.08)' },
              { value: postMatchReport.signs, label: 'Signos', color: 'var(--green)', bg: 'rgba(0,122,69,0.08)' },
              { value: postMatchReport.misses, label: 'Fallos', color: 'var(--red)', bg: 'rgba(226,75,74,0.08)' }
            ].map((s, i) => (
              <div key={i} style={{
                flex: 1, textAlign: 'center', padding: '10px 4px',
                borderRadius: '8px', background: s.bg
              }}>
                <div style={{ fontSize: '20px', fontWeight: '800', color: s.color, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: '9px', color: 'var(--text-dim)', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Points earned + accuracy */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-input)'
          }}>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Puntos ganados: </span>
              <span style={{ fontSize: '16px', fontWeight: '800', color: 'var(--green)' }}>+{postMatchReport.points}</span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Aciertos: </span>
              <span style={{
                fontSize: '14px', fontWeight: '700',
                color: (postMatchReport.exacts + postMatchReport.signs) / postMatchReport.predicted >= 0.5 ? 'var(--green)' : 'var(--red)'
              }}>
                {postMatchReport.exacts + postMatchReport.signs}/{postMatchReport.predicted}
              </span>
            </div>
          </div>

          {/* Best prediction */}
          {postMatchReport.bestMatch && postMatchReport.bestPoints === 3 && (
            <div style={{
              marginTop: '10px', padding: '8px 12px', borderRadius: '6px',
              background: 'rgba(255,204,0,0.06)', border: '1px solid rgba(255,204,0,0.1)',
              fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center'
            }}>
              Mejor predicción: <span style={{ color: 'var(--gold)', fontWeight: '600' }}>
                {postMatchReport.bestMatch.home_team?.name} {postMatchReport.bestMatch.home_score}-{postMatchReport.bestMatch.away_score} {postMatchReport.bestMatch.away_team?.name}
              </span> <span style={{ color: 'var(--green)' }}>(exacto)</span>
            </div>
          )}
        </div>
      )}

      {/* Demo post-match report */}
      {demoMode && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(0,122,69,0.06), var(--bg-secondary))',
          borderRadius: '10px',
          padding: '16px 18px',
          marginBottom: '12px',
          border: '1px solid rgba(0,122,69,0.15)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
            background: 'linear-gradient(90deg, var(--green), var(--gold), var(--green))'
          }} />
          <div style={{
            fontSize: '10px', color: 'var(--green)', textTransform: 'uppercase',
            letterSpacing: '1px', fontWeight: '600', marginBottom: '12px',
            display: 'flex', alignItems: 'center', gap: '6px'
          }}>
            <span>📊</span> Informe de jornada
            <span style={{ fontSize: '9px', color: 'var(--text-dim)', fontWeight: '400', marginLeft: 'auto', letterSpacing: '0' }}>jueves 12 de junio</span>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            {[
              { value: 1, label: 'Exactos', color: 'var(--gold)', bg: 'rgba(255,204,0,0.08)' },
              { value: 2, label: 'Signos', color: 'var(--green)', bg: 'rgba(0,122,69,0.08)' },
              { value: 1, label: 'Fallos', color: 'var(--red)', bg: 'rgba(226,75,74,0.08)' }
            ].map((s, i) => (
              <div key={i} style={{
                flex: 1, textAlign: 'center', padding: '10px 4px',
                borderRadius: '8px', background: s.bg
              }}>
                <div style={{ fontSize: '20px', fontWeight: '800', color: s.color, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: '9px', color: 'var(--text-dim)', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-input)'
          }}>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Puntos ganados: </span>
              <span style={{ fontSize: '16px', fontWeight: '800', color: 'var(--green)' }}>+5</span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Aciertos: </span>
              <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--green)' }}>3/4</span>
            </div>
          </div>
          <div style={{
            marginTop: '10px', padding: '8px 12px', borderRadius: '6px',
            background: 'rgba(255,204,0,0.06)', border: '1px solid rgba(255,204,0,0.1)',
            fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center'
          }}>
            Mejor predicción: <span style={{ color: 'var(--gold)', fontWeight: '600' }}>España 3-0 Croacia</span> <span style={{ color: 'var(--green)' }}>(exacto)</span>
          </div>
        </div>
      )}

      {/* ===== DAILY INSIGHT (Gemini) ===== */}
      <div style={{
        background: 'var(--bg-secondary)',
        borderRadius: '10px',
        padding: '16px 18px',
        marginBottom: '12px',
        border: '0.5px solid var(--border)',
        position: 'relative'
      }}>
        <div style={{
          fontSize: '10px', color: 'var(--gold)', textTransform: 'uppercase',
          letterSpacing: '1px', fontWeight: '600', marginBottom: '10px',
          display: 'flex', alignItems: 'center', gap: '6px'
        }}>
          <span>📰</span> Crónica del día
          <span style={{
            fontSize: '8px', color: 'var(--text-dim)', background: 'var(--bg-input)',
            padding: '2px 6px', borderRadius: '3px', fontWeight: '500',
            letterSpacing: '0.5px', marginLeft: 'auto'
          }}>GENERADA POR IA</span>
        </div>

        {displayInsightLoading ? (
          <FootballSpinner size={24} text="Generando crónica…" />
        ) : displayInsight ? (
          <div>
            <div style={{
              fontSize: '13px', color: 'var(--text-secondary)',
              lineHeight: '1.7', whiteSpace: 'pre-line'
            }}>
              {displayInsight}
            </div>
            {dailyInsightLong && (
              <button
                onClick={() => setShowInsightLong(true)}
                style={{
                  marginTop: '12px', padding: '8px 14px',
                  background: 'transparent',
                  border: '1px solid rgba(255,204,0,0.3)',
                  borderRadius: '6px', color: 'var(--gold)',
                  fontSize: '12px', fontWeight: '600',
                  cursor: 'pointer', letterSpacing: '0.3px'
                }}
              >
                Leer crónica completa →
              </button>
            )}
          </div>
        ) : (
          <div style={{
            padding: '12px', textAlign: 'center', color: 'var(--text-dim)',
            fontSize: '12px', background: 'var(--bg-input)', borderRadius: '6px'
          }}>
            No hay crónica disponible hoy
          </div>
        )}
      </div>

      {/* Modal: long-form chronicle (Economist style) */}
      {showInsightLong && dailyInsightLong && (
        <div
          onClick={() => setShowInsightLong(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 0
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-secondary)',
              borderRadius: '16px 16px 0 0',
              padding: '20px 18px',
              width: '100%', maxWidth: '600px',
              maxHeight: '90vh', overflowY: 'auto',
              paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))'
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px'
            }}>
              <span style={{
                fontSize: '10px', color: 'var(--gold)', textTransform: 'uppercase',
                letterSpacing: '1.2px', fontWeight: '700'
              }}>📰 Crónica del día · completa</span>
              <button onClick={() => setShowInsightLong(false)} style={{
                background: 'none', border: 'none', color: 'var(--text-muted)',
                fontSize: '22px', cursor: 'pointer', padding: '0 4px'
              }}>×</button>
            </div>
            <div style={{
              fontSize: '14px', color: 'var(--text-primary)',
              lineHeight: '1.65', whiteSpace: 'pre-line',
              fontFamily: 'Georgia, "Times New Roman", serif'
            }}>
              {dailyInsightLong}
            </div>
          </div>
        </div>
      )}

      {/* ===== ACCESO RÁPIDO: PREDICCIONES + NORMAS ===== */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(0,122,69,0.06), rgba(0,122,69,0.02))',
        borderRadius: '10px',
        padding: '14px 16px',
        marginBottom: '12px',
        border: '0.5px solid rgba(0,122,69,0.15)',
        display: 'flex',
        gap: '8px'
      }}>
        <button
          onClick={() => navigate('/predictions')}
          style={{
            flex: 1, padding: '10px', borderRadius: '6px', border: 'none',
            background: 'var(--green)', color: '#fff',
            fontSize: '12px', fontWeight: '600', cursor: 'pointer'
          }}
        >
          ⚽ Mis predicciones
        </button>
        <button
          onClick={() => navigate('/rules')}
          style={{
            flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid var(--border)',
            background: 'transparent', color: 'var(--text-primary)',
            fontSize: '12px', fontWeight: '600', cursor: 'pointer'
          }}
        >
          📋 Ver normas
        </button>
      </div>

      {/* ===== PRÓXIMOS (compact rows with badges) ===== */}
      {!demoMode && nextMatches.length > 0 && (() => {
        const today = new Date()
        const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1)
        const sameDay = (a, b) => a.toDateString() === b.toDateString()
        const dayLabel = (d) => sameDay(d, today) ? 'HOY' : sameDay(d, tomorrow) ? 'MAÑ' : d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).toUpperCase().replace('.', '')
        const timeLabel = (d) => d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
        return (
          <div style={{ marginBottom: '14px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0 4px', marginBottom: '8px'
            }}>
              <span style={{
                fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '1.2px'
              }}>Próximos</span>
              <span onClick={() => navigate('/predictions')} style={{
                fontSize: '11px', color: 'var(--green)', fontWeight: '600',
                textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer'
              }}>Ver todos</span>
            </div>
            {nextMatches.map((match, i) => {
              const hasPred = userPredictions[match.id]
              const d = new Date(match.match_date)
              return (
                <div key={match.id} onClick={() => navigate(`/match/${match.id}`)} style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '12px 14px', marginBottom: '6px',
                  background: 'var(--bg-secondary)', borderRadius: '10px', cursor: 'pointer'
                }}>
                  <div style={{ flexShrink: 0, textAlign: 'left', minWidth: '46px' }}>
                    <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-dim)', letterSpacing: '0.5px' }}>{dayLabel(d)}</div>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', marginTop: '1px' }}>{timeLabel(d)}</div>
                    {match.city && (
                      <div style={{ fontSize: '9px', color: 'var(--text-dim)', marginTop: '2px', whiteSpace: 'nowrap' }}>
                        📍 {match.city}
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {match.home_team?.flag_url && <img src={match.home_team.flag_url} alt="" style={{ width: '18px', height: '12px', borderRadius: '2px', objectFit: 'cover', flexShrink: 0 }} />}
                    <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{match.home_team?.name || 'Por determinar'}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-dim)', flexShrink: 0 }}>vs</span>
                    <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{match.away_team?.name || 'Por determinar'}</span>
                    {match.away_team?.flag_url && <img src={match.away_team.flag_url} alt="" style={{ width: '18px', height: '12px', borderRadius: '2px', objectFit: 'cover', flexShrink: 0 }} />}
                  </div>
                  <div style={{
                    flexShrink: 0, fontSize: '11px', fontWeight: '700',
                    padding: '4px 9px', borderRadius: '6px',
                    background: hasPred ? 'rgba(0,122,69,0.12)' : 'rgba(255,255,255,0.04)',
                    color: hasPred ? 'var(--green)' : 'var(--text-dim)',
                    border: '1px solid transparent'
                  }}>
                    {hasPred ? '✓' : '—'}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })()}

      {/* ===== NOTIFICATION PROMPT ===== */}
      {notifPerm === 'default' && !notifDismissed && !demoMode && (
        <div style={{
          background: 'var(--bg-secondary)',
          borderRadius: '8px',
          padding: '12px 16px',
          border: '0.5px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <span style={{ fontSize: '20px', flexShrink: 0 }}>🔔</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '2px' }}>
              Activa las notificaciones
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Te avisaremos cuando se resuelvan partidos y cambies de posición.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
            <button
              onClick={() => { setNotifDismissed(true); localStorage.setItem('porra26_notif_dismissed', '1') }}
              style={{
                padding: '6px 10px', background: 'none', border: '1px solid var(--border)',
                borderRadius: '6px', color: 'var(--text-dim)', fontSize: '11px', cursor: 'pointer',
              }}
            >
              No
            </button>
            <button
              onClick={async () => {
                const result = await requestPermission()
                if (result === 'granted') {
                  await subscribePush(session.user.id)
                }
                if (result === 'granted' || result === 'denied') setNotifDismissed(true)
              }}
              style={{
                padding: '6px 12px', background: 'var(--green)', border: 'none',
                borderRadius: '6px', color: '#fff', fontSize: '11px', fontWeight: '600', cursor: 'pointer',
              }}
            >
              Activar
            </button>
          </div>
        </div>
      )}

      {/* ===== TOP 5 RANKING (Visual bars) ===== */}
      {displayTopRanking.length > 0 && (
        <div style={{
          background: 'var(--bg-secondary)',
          borderRadius: '8px',
          padding: '14px 16px',
          border: '0.5px solid var(--border)'
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px'
          }}>
            <span style={{
              fontSize: '10px', color: 'var(--text-dim)',
              textTransform: 'uppercase', letterSpacing: '0.8px'
            }}>
              Top 5
            </span>
            <span
              onClick={() => navigate('/leaderboard')}
              style={{ fontSize: '10px', color: 'var(--green)', cursor: 'pointer' }}
            >
              Ver completo
            </span>
          </div>

          {displayTopRanking.map((user, index) => {
            const isMe = user.user_id === session.user.id
            const barColors = [
              'linear-gradient(90deg, #ffd700, #b8860b)',
              'linear-gradient(90deg, #c0c0c0, #888)',
              'linear-gradient(90deg, #cd7f32, #8b4513)',
              'linear-gradient(90deg, #007a45, #005e3a)',
              'linear-gradient(90deg, #007a45, #005e3a)'
            ]
            const barWidth = maxPoints > 0 ? Math.max((user.total_points / maxPoints) * 100, 8) : 8

            return (
              <div key={user.user_id} style={{ marginBottom: index < displayTopRanking.length - 1 ? '8px' : 0 }}>
                {/* Name row */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      fontSize: '11px', fontWeight: '700', color: 'var(--text-dim)',
                      width: '16px', textAlign: 'right'
                    }}>
                      {index + 1}
                    </span>
                    <span style={{
                      fontSize: '12px', fontWeight: isMe ? '600' : '400',
                      color: isMe ? 'var(--gold)' : 'var(--text-primary)'
                    }}>
                      {user.full_name}{isMe ? ' (Tú)' : ''}
                    </span>
                  </div>
                  <span style={{
                    fontSize: '12px', fontWeight: '600',
                    color: index === 0 ? 'var(--gold)' : 'var(--text-primary)'
                  }}>
                    {user.total_points} <span style={{ fontSize: '9px', color: 'var(--text-dim)' }}>pts</span>
                  </span>
                </div>
                {/* Bar */}
                <div style={{
                  height: '6px', background: 'var(--bg-input)', borderRadius: '3px',
                  overflow: 'hidden', marginLeft: '24px'
                }}>
                  <div style={{
                    height: '100%', width: `${barWidth}%`,
                    background: barColors[index] || barColors[4],
                    borderRadius: '3px',
                    transition: 'width 0.5s ease'
                  }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Points history chart */}
      {!demoMode && <PointsChart userId={session.user.id} />}

      {/* Nickname edit modal — abierto al pulsar el avatar arriba */}
      {editingNickname && (
        <NicknameModal
          session={session}
          mode="edit"
          onClose={() => setEditingNickname(false)}
          onSaved={(nick) => setProfile(p => p ? { ...p, nickname: nick } : p)}
        />
      )}

    </div>
  )
}
