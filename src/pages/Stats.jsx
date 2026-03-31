import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabase'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { generateDemoMatchStatuses } from '../hooks/useDemoMode'
import { SkeletonDashboard } from '../components/Skeleton'

const BOT365_ID = 'b0365b03-65b0-365b-0365-b0365b036500'

export default function Stats({ demoMode }) {
  const [matches, setMatches] = useState([])
  const [allPredictions, setAllPredictions] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeGroup, setActiveGroup] = useState('A')
  const [totalUsers, setTotalUsers] = useState(0)
  const [activeTab, setActiveTab] = useState('overview')
  const [bets, setBets] = useState([])
  const [betEntries, setBetEntries] = useState([])
  const [activeBetCategory, setActiveBetCategory] = useState('all')
  const [leaderboard, setLeaderboard] = useState([])
  const [userId, setUserId] = useState(null)
  const [myPredictions, setMyPredictions] = useState([])

  // H2H state
  const [profiles, setProfiles] = useState([])
  const [h2hUserA, setH2hUserA] = useState('')
  const [h2hUserB, setH2hUserB] = useState('')
  const [h2hPredictions, setH2hPredictions] = useState({})
  const [h2hLoading, setH2hLoading] = useState(false)
  const [h2hGroup, setH2hGroup] = useState('A')
  const [h2hBetEntriesA, setH2hBetEntriesA] = useState([])
  const [h2hBetEntriesB, setH2hBetEntriesB] = useState([])
  const [h2hOrdagoEntriesA, setH2hOrdagoEntriesA] = useState([])
  const [h2hOrdagoEntriesB, setH2hOrdagoEntriesB] = useState([])

  // View others state
  const [viewUser, setViewUser] = useState('')
  const [viewPredictions, setViewPredictions] = useState([])
  const [viewBetEntries, setViewBetEntries] = useState([])
  const [viewOrdagoEntries, setViewOrdagoEntries] = useState([])
  const [viewLoading, setViewLoading] = useState(false)
  const [viewGroup, setViewGroup] = useState('A')

  // Shared data
  const [teams, setTeams] = useState([])
  const [ordagos, setOrdagos] = useState([])
  const [allPreTournamentEntries, setAllPreTournamentEntries] = useState([])
  const [allMatches, setAllMatches] = useState([])

  const groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']
  const betCategories = [
    { key: 'all', label: 'Todas' },
    { key: 'podium', label: '🏆 Podio' },
    { key: 'players', label: '⚽ Jugadores' },
    { key: 'teams', label: '🌍 Equipos' },
    { key: 'stats', label: '📊 Estadísticas' },
    { key: 'yesno', label: '✅ Sí/No' }
  ]

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) setUserId(user.id)

    const queries = [
      supabase.from('matches')
        .select('*, home_team:teams!matches_home_team_id_fkey(name, flag_url), away_team:teams!matches_away_team_id_fkey(name, flag_url)')
        .eq('stage', 'group').order('match_date', { ascending: true }),
      supabase.from('predictions').select('match_id, predicted_home, predicted_away, user_id'),
      supabase.from('profiles').select('id, full_name, nickname, has_paid'),
      supabase.from('pre_tournament_bets').select('*').order('id', { ascending: true }),
      supabase.from('pre_tournament_entries').select('bet_id, user_id, value, points_awarded, is_resolved'),
      supabase.from('leaderboard').select('*'),
      supabase.from('teams').select('id, name, flag_url'),
      supabase.from('ordagos').select(`
        *,
        match:matches(
          id, match_date, status, home_score, away_score,
          home_team:teams!matches_home_team_id_fkey(id, name, flag_url),
          away_team:teams!matches_away_team_id_fkey(id, name, flag_url)
        )
      `).order('number'),
      supabase.from('matches')
        .select('*, home_team:teams!matches_home_team_id_fkey(id, name, flag_url), away_team:teams!matches_away_team_id_fkey(id, name, flag_url)')
        .order('match_date', { ascending: true })
    ]

    // Fetch user's own predictions with points
    if (user) {
      queries.push(
        supabase.from('predictions')
          .select('match_id, predicted_home, predicted_away, points_earned')
          .eq('user_id', user.id)
      )
    }

    const results = await Promise.all(queries)

    setMatches(results[0].data || [])
    setAllPredictions(results[1].data || [])
    const profilesData = results[2].data || []
    setProfiles(profilesData)
    setTotalUsers(profilesData.length)
    setBets(results[3].data || [])
    const allEntries = results[4].data || []
    setBetEntries(allEntries)
    setAllPreTournamentEntries(allEntries)
    setLeaderboard(results[5].data || [])
    setTeams(results[6].data || [])
    setOrdagos(results[7].data || [])
    setAllMatches(results[8].data || [])
    if (results[9]) setMyPredictions(results[9].data || [])
    setLoading(false)
  }

  // ========== H2H FETCH ==========
  async function fetchH2hPredictions(userAId, userBId) {
    if (!userAId || !userBId) return
    setH2hLoading(true)
    const [predsRes, betEntriesARes, betEntriesBRes, ordagoARes, ordagoBRes] = await Promise.all([
      supabase.from('predictions')
        .select('user_id, match_id, predicted_home, predicted_away, points_earned')
        .in('user_id', [userAId, userBId]),
      supabase.from('pre_tournament_entries')
        .select('bet_id, value, points_awarded, is_resolved')
        .eq('user_id', userAId),
      supabase.from('pre_tournament_entries')
        .select('bet_id, value, points_awarded, is_resolved')
        .eq('user_id', userBId),
      supabase.from('ordago_entries')
        .select('ordago_id, predicted_home, predicted_away, points_awarded')
        .eq('user_id', userAId),
      supabase.from('ordago_entries')
        .select('ordago_id, predicted_home, predicted_away, points_awarded')
        .eq('user_id', userBId)
    ])
    const map = {}
    ;(predsRes.data || []).forEach(p => {
      if (!map[p.match_id]) map[p.match_id] = {}
      map[p.match_id][p.user_id] = p
    })
    setH2hPredictions(map)
    setH2hBetEntriesA(betEntriesARes.data || [])
    setH2hBetEntriesB(betEntriesBRes.data || [])
    setH2hOrdagoEntriesA(ordagoARes.data || [])
    setH2hOrdagoEntriesB(ordagoBRes.data || [])
    setH2hLoading(false)
  }

  // ========== VIEW OTHERS FETCH ==========
  async function fetchViewUser(uid) {
    if (!uid) return
    setViewLoading(true)
    const [predsRes, entriesRes, ordagoRes] = await Promise.all([
      supabase.from('predictions')
        .select('match_id, predicted_home, predicted_away, points_earned')
        .eq('user_id', uid),
      supabase.from('pre_tournament_entries')
        .select('bet_id, value, points_awarded, is_resolved')
        .eq('user_id', uid),
      supabase.from('ordago_entries')
        .select('ordago_id, predicted_home, predicted_away, points_awarded')
        .eq('user_id', uid)
    ])
    setViewPredictions(predsRes.data || [])
    setViewBetEntries(entriesRes.data || [])
    setViewOrdagoEntries(ordagoRes.data || [])
    setViewLoading(false)
  }

  function getProfileName(id) {
    const p = profiles.find(pr => pr.id === id)
    return p ? (p.nickname || p.full_name || 'Participante') : 'Participante'
  }

  function getTeamName(teamId) {
    const t = teams.find(tm => tm.id === teamId)
    return t ? t.name : `Equipo ${teamId}`
  }

  function formatBetValue(value, inputType) {
    if (!value) return '-'
    if (inputType === 'single_team') return getTeamName(value.team_id)
    if (inputType === 'multi_team') return (value.teams || []).map(id => getTeamName(id)).join(', ')
    if (inputType === 'single_player') return value.player_name || '-'
    if (inputType === 'yes_no') return value.answer === 'yes' ? 'Si' : 'No'
    if (inputType === 'range') return value.range || '-'
    if (inputType === 'single_group') return `Grupo ${value.group}` || '-'
    return JSON.stringify(value)
  }

  // ========== COMPUTED STATS ==========

  function getMatchConsensus(matchId) {
    const preds = allPredictions.filter(p => p.match_id === matchId)
    if (preds.length === 0) return null
    let homeWins = 0, draws = 0, awayWins = 0
    const resultCounts = {}
    preds.forEach(p => {
      if (p.predicted_home > p.predicted_away) homeWins++
      else if (p.predicted_home === p.predicted_away) draws++
      else awayWins++
      const key = `${p.predicted_home}-${p.predicted_away}`
      resultCounts[key] = (resultCounts[key] || 0) + 1
    })
    const total = preds.length
    let topResult = null, topCount = 0
    Object.entries(resultCounts).forEach(([result, count]) => {
      if (count > topCount) { topResult = result; topCount = count }
    })
    return {
      total, homeWins, draws, awayWins,
      homePct: Math.round((homeWins / total) * 100),
      drawPct: Math.round((draws / total) * 100),
      awayPct: Math.round((awayWins / total) * 100),
      topResult, topResultPct: Math.round((topCount / total) * 100), topResultCount: topCount
    }
  }

  function getBetStats(betId) {
    const entries = betEntries.filter(e => e.bet_id === betId)
    if (entries.length === 0) return { total: 0, topAnswers: [] }
    const bet = bets.find(b => b.id === betId)
    const counts = {}
    entries.forEach(e => {
      const a = formatBetValue(e.value, bet?.input_type) || '?'
      counts[a] = (counts[a] || 0) + 1
    })
    const sorted = Object.entries(counts)
      .sort(([, a], [, b]) => b - a).slice(0, 5)
      .map(([answer, count]) => ({ answer, count, pct: Math.round((count / entries.length) * 100) }))
    return { total: entries.length, topAnswers: sorted }
  }

  function formatDate(dateStr) {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleDateString('es-ES', {
      weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    })
  }

  // ========== OVERVIEW COMPUTED ==========

  // Demo mode: simulate some matches as finished
  const displayMatches = useMemo(() => {
    if (!demoMode || !matches.length) return matches
    return generateDemoMatchStatuses(matches)
  }, [demoMode, matches])

  const finishedMatches = displayMatches.filter(m => m.status === 'finished')
  const totalMatches = displayMatches.length
  const totalPredictions = allPredictions.length

  // Global 1X2 consensus across all matches
  const global1X2 = (() => {
    let h = 0, d = 0, a = 0
    allPredictions.forEach(p => {
      if (p.predicted_home > p.predicted_away) h++
      else if (p.predicted_home === p.predicted_away) d++
      else a++
    })
    const t = h + d + a || 1
    return [
      { name: 'Local', value: Math.round((h / t) * 100), color: '#007a45' },
      { name: 'Empate', value: Math.round((d / t) * 100), color: '#4a4f5e' },
      { name: 'Visitante', value: Math.round((a / t) * 100), color: '#ffcc00' }
    ]
  })()

  // Most predicted results across all matches
  const topResults = (() => {
    const counts = {}
    allPredictions.forEach(p => {
      const key = `${p.predicted_home}-${p.predicted_away}`
      counts[key] = (counts[key] || 0) + 1
    })
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([result, count]) => ({ result, count, pct: Math.round((count / (totalPredictions || 1)) * 100) }))
  })()

  // Leaderboard stats
  const paidUserIds = useMemo(() => new Set(profiles.filter(p => p.has_paid).map(p => p.id)), [profiles])
  const lbSorted = [...leaderboard].filter(u => u.user_id !== BOT365_ID && paidUserIds.has(u.user_id)).sort((a, b) => b.total_points - a.total_points)
  const avgPoints = lbSorted.length > 0 ? Math.round(lbSorted.reduce((s, u) => s + u.total_points, 0) / lbSorted.length) : 0
  const totalExacts = lbSorted.reduce((s, u) => s + (u.exact_hits || 0), 0)
  const totalSigns = lbSorted.reduce((s, u) => s + (u.sign_hits || 0), 0)

  // Accuracy rate (exact + sign hits vs total predictions per finished match)
  const accuracyRate = (() => {
    if (lbSorted.length === 0) return 0
    const totalHits = totalExacts + totalSigns
    const totalAttempts = finishedMatches.length * lbSorted.length
    return totalAttempts > 0 ? Math.round((totalHits / totalAttempts) * 100) : 0
  })()

  // Group with most goals predicted
  const groupGoals = (() => {
    const goalsByGroup = {}
    matches.forEach(m => {
      const preds = allPredictions.filter(p => p.match_id === m.id)
      const totalGoals = preds.reduce((s, p) => s + p.predicted_home + p.predicted_away, 0)
      const g = m.group_name
      goalsByGroup[g] = (goalsByGroup[g] || 0) + totalGoals
    })
    return Object.entries(goalsByGroup)
      .map(([group, goals]) => ({ group: `Gr. ${group}`, goals }))
      .sort((a, b) => b.goals - a.goals)
  })()

  if (loading) {
    return (
      <div style={{ padding: '16px' }}>
        <SkeletonDashboard />
      </div>
    )
  }

  const groupMatches = displayMatches.filter(m => m.group_name === activeGroup)
  const filteredBets = activeBetCategory === 'all' ? bets : bets.filter(b => b.category === activeBetCategory)

  // ========== STAT CARD COMPONENT ==========
  const StatCard = ({ value, label, color, sub }) => (
    <div className="stats-card" style={{
      textAlign: 'center', padding: '16px 12px', marginBottom: 0,
      position: 'relative', overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
        background: `linear-gradient(90deg, ${color || 'var(--green)'}, transparent)`
      }} />
      <div style={{ fontSize: '24px', fontWeight: '800', color: color || 'var(--text-primary)', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{
        fontSize: '9px', color: 'var(--text-dim)', textTransform: 'uppercase',
        letterSpacing: '1px', marginTop: '8px', fontWeight: '600'
      }}>
        {label}
      </div>
      {sub && (
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.3 }}>
          {sub}
        </div>
      )}
    </div>
  )

  // ========== SECTION HEADER ==========
  const SectionHeader = ({ children }) => (
    <div style={{
      fontSize: '10px', color: 'var(--gold)', textTransform: 'uppercase',
      letterSpacing: '1.2px', fontWeight: '700', marginBottom: '16px',
      display: 'flex', alignItems: 'center', gap: '8px'
    }}>
      <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--gold)', flexShrink: 0 }} />
      <span>{children}</span>
      <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, var(--border), transparent)' }} />
    </div>
  )

  // ========== ODDS BAR (1X2 bet365-style) ==========
  const OddsBar = ({ homePct, drawPct, awayPct }) => {
    const max = Math.max(homePct, drawPct, awayPct)
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
        <div className="odds-pill" style={{
          background: 'rgba(0,122,69,0.12)',
          color: '#00c464',
          borderColor: homePct === max ? 'rgba(0,122,69,0.4)' : 'transparent'
        }}>
          <div style={{ fontSize: '9px', fontWeight: '600', letterSpacing: '0.5px', opacity: 0.7 }}>1</div>
          <div style={{ fontSize: '18px', fontWeight: '800', lineHeight: 1.2 }}>{homePct}%</div>
        </div>
        <div className="odds-pill" style={{
          background: 'rgba(74,79,94,0.25)',
          color: 'var(--text-secondary)',
          borderColor: drawPct === max ? 'rgba(74,79,94,0.5)' : 'transparent'
        }}>
          <div style={{ fontSize: '9px', fontWeight: '600', letterSpacing: '0.5px', opacity: 0.7 }}>X</div>
          <div style={{ fontSize: '18px', fontWeight: '800', lineHeight: 1.2 }}>{drawPct}%</div>
        </div>
        <div className="odds-pill" style={{
          background: 'rgba(255,204,0,0.1)',
          color: '#ffcc00',
          borderColor: awayPct === max ? 'rgba(255,204,0,0.35)' : 'transparent'
        }}>
          <div style={{ fontSize: '9px', fontWeight: '600', letterSpacing: '0.5px', opacity: 0.7 }}>2</div>
          <div style={{ fontSize: '18px', fontWeight: '800', lineHeight: 1.2 }}>{awayPct}%</div>
        </div>
      </div>
    )
  }

  // ========== RENDER ==========
  return (
    <div className="stagger-in" style={{ maxWidth: '500px', margin: '0 auto', padding: '16px', minHeight: '100svh' }}>

      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{
          fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)',
          margin: '0 0 4px', letterSpacing: '0.3px'
        }}>
          Stats del Mundial
        </h2>
        <p style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
          {finishedMatches.length} de {totalMatches} partidos jugados
          {demoMode && <span style={{ color: 'var(--gold)', marginLeft: '6px', fontSize: '10px', fontWeight: '600' }}>(DEMO)</span>}
        </p>
      </div>

      {/* Progress bar — tournament progress */}
      <div style={{
        background: 'var(--bg-input)', borderRadius: '4px', height: '6px',
        marginBottom: '18px', overflow: 'hidden'
      }}>
        <div style={{
          height: '100%', borderRadius: '4px',
          background: 'linear-gradient(90deg, var(--green), var(--gold))',
          width: `${totalMatches > 0 ? (finishedMatches.length / totalMatches) * 100 : 0}%`,
          transition: 'width 0.6s ease'
        }} />
      </div>

      {/* 6-Tab switcher */}
      <div className="group-tabs" style={{
        marginBottom: '18px', gap: '6px'
      }}>
        {[
          { key: 'overview', label: 'Resumen' },
          { key: 'me', label: 'Tú' },
          { key: 'matches', label: 'Partidos' },
          { key: 'bets', label: 'Predicciones' },
          { key: 'h2h', label: 'H2H' },
          { key: 'view', label: 'Otros' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '7px 14px', borderRadius: '20px', border: 'none',
              background: activeTab === tab.key ? 'var(--green)' : 'var(--bg-secondary)',
              color: activeTab === tab.key ? '#fff' : 'var(--text-muted)',
              fontSize: '12px', fontWeight: activeTab === tab.key ? '600' : '400', cursor: 'pointer',
              whiteSpace: 'nowrap', flexShrink: 0,
              transition: 'all 0.2s ease'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ==================== OVERVIEW TAB ==================== */}
      {activeTab === 'overview' && (
        <div className="tab-fade-in">
          {/* Hero accuracy card */}
          <div className="stats-hero" style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
              <div>
                <div className="gradient-text" style={{ fontSize: '52px', fontWeight: '900', lineHeight: 1 }}>
                  {accuracyRate}%
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1.5px', marginTop: '8px', fontWeight: '600' }}>
                  Tasa de acierto global
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {totalExacts} exactos · {totalSigns} signos · {lbSorted.reduce((s, u) => s + (u.misses || 0), 0)} fallos
                </div>
              </div>
              {/* Mini gauge */}
              <div style={{ position: 'relative', width: '80px', height: '80px', flexShrink: 0 }}>
                <ResponsiveContainer width={80} height={80}>
                  <PieChart>
                    <Pie
                      data={[{ value: accuracyRate }, { value: 100 - accuracyRate }]}
                      cx="50%" cy="50%"
                      innerRadius={30} outerRadius={38}
                      startAngle={90} endAngle={-270}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      <Cell fill="url(#gaugeGradient)" />
                      <Cell fill="rgba(42,45,56,0.5)" />
                    </Pie>
                    <defs>
                      <linearGradient id="gaugeGradient" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#007a45" />
                        <stop offset="100%" stopColor="#ffcc00" />
                      </linearGradient>
                    </defs>
                  </PieChart>
                </ResponsiveContainer>
                <div style={{
                  position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                  fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)'
                }}>
                  {finishedMatches.length}
                </div>
              </div>
            </div>
          </div>

          {/* Stats strip — horizontal scroll */}
          <div style={{
            display: 'flex', gap: '10px', overflowX: 'auto', scrollbarWidth: 'none',
            WebkitOverflowScrolling: 'touch', marginBottom: '14px', padding: '2px 0'
          }}>
            {[
              { value: totalUsers, label: 'Participantes', color: 'var(--text-primary)' },
              { value: totalPredictions.toLocaleString(), label: 'Predicciones', color: 'var(--gold)' },
              { value: `${avgPoints}`, label: 'Media pts', color: 'var(--text-primary)' },
              { value: lbSorted[0]?.total_points || 0, label: 'Lider', color: 'var(--gold)' }
            ].map((s, i) => (
              <div key={i} style={{
                minWidth: '100px', flex: '1 0 auto', background: 'var(--bg-secondary)',
                borderRadius: '10px', padding: '14px 12px', border: '0.5px solid var(--border)',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '20px', fontWeight: '700', color: s.color, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: '8px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '6px', fontWeight: '600' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* 1X2 Global — bet365 style */}
          <div className="stats-card">
            <SectionHeader>Tendencia global 1X2</SectionHeader>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ position: 'relative', width: '140px', height: '140px', flexShrink: 0 }}>
                <ResponsiveContainer width={140} height={140}>
                  <PieChart>
                    <Pie
                      data={global1X2}
                      cx="50%" cy="50%"
                      innerRadius={42} outerRadius={66}
                      paddingAngle={4}
                      cornerRadius={3}
                      dataKey="value"
                      startAngle={90} endAngle={-270}
                    >
                      {global1X2.map((entry, i) => (
                        <Cell key={i} fill={entry.color} stroke="none" />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                {/* Center label */}
                <div style={{
                  position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)' }}>
                    {global1X2[0].value}%
                  </div>
                  <div style={{ fontSize: '8px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Local
                  </div>
                </div>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {global1X2.map((item, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '8px 12px', borderRadius: '8px',
                    background: `${item.color}10`,
                    border: `1px solid ${item.color}20`
                  }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', flex: 1 }}>{item.name}</span>
                    <span style={{ fontSize: '16px', fontWeight: '800', color: item.color }}>{item.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top predicted results */}
          <div className="stats-card">
            <SectionHeader>Resultados mas predichos</SectionHeader>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {topResults.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '10px', fontWeight: '700',
                    background: i === 0 ? 'linear-gradient(135deg, #ffcc00, #ff9500)' : i === 1 ? 'rgba(192,192,192,0.15)' : i === 2 ? 'rgba(205,127,50,0.15)' : 'var(--bg-input)',
                    color: i === 0 ? '#1a1d26' : i <= 2 ? 'var(--text-muted)' : 'var(--text-dim)'
                  }}>
                    {i + 1}
                  </div>
                  <div style={{
                    fontSize: '17px', fontWeight: '800', letterSpacing: '2px',
                    color: i === 0 ? 'var(--gold)' : 'var(--text-primary)', width: '42px', textAlign: 'center',
                    fontFamily: 'SF Mono, Monaco, monospace'
                  }}>
                    {r.result}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ height: '6px', background: 'var(--bg-input)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: '3px',
                        background: i === 0 ? 'linear-gradient(90deg, var(--gold), rgba(255,204,0,0.4))' : 'var(--green)',
                        width: `${(r.count / (topResults[0]?.count || 1)) * 100}%`,
                        animation: 'barGrow 0.6s ease forwards',
                        boxShadow: i === 0 ? '0 0 8px rgba(255,204,0,0.2)' : 'none'
                      }} />
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', minWidth: '42px' }}>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: i === 0 ? 'var(--gold)' : 'var(--text-primary)' }}>{r.pct}%</div>
                    <div style={{ fontSize: '9px', color: 'var(--text-dim)' }}>{r.count}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Goals by group — horizontal bar chart */}
          <div className="stats-card">
            <SectionHeader>Goles predichos por grupo</SectionHeader>
            <ResponsiveContainer width="100%" height={groupGoals.length * 34 + 10}>
              <BarChart
                data={groupGoals.slice(0, 8)}
                layout="vertical"
                margin={{ top: 0, right: 40, left: 0, bottom: 0 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category" dataKey="group" width={42}
                  tick={{ fill: '#6b7080', fontSize: 11, fontWeight: 600 }}
                  axisLine={false} tickLine={false}
                />
                <Tooltip
                  contentStyle={{ background: '#22252f', border: '1px solid #2a2d38', borderRadius: '8px', fontSize: '12px' }}
                  formatter={(value) => [`${value} goles`, 'Total']}
                />
                <Bar
                  dataKey="goals" radius={[0, 6, 6, 0]} barSize={20}
                  label={{ position: 'right', fill: '#9da3b0', fontSize: 11, fontWeight: 600 }}
                >
                  {groupGoals.slice(0, 8).map((entry, i) => (
                    <Cell key={i} fill={i === 0 ? '#ffcc00' : i === 1 ? '#007a45' : '#2a4a3a'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Leaderboard top 5 — accuracy breakdown */}
          <div className="stats-card">
            <SectionHeader>Top 5 — Desglose</SectionHeader>
            {lbSorted.slice(0, 5).map((user, i) => {
              const total = (user.exact_hits || 0) + (user.sign_hits || 0) + (user.misses || 0)
              const exactPct = total > 0 ? ((user.exact_hits || 0) / total) * 100 : 0
              const signPct = total > 0 ? ((user.sign_hits || 0) / total) * 100 : 0
              const medalColors = ['linear-gradient(135deg, #ffd700, #ff9500)', 'linear-gradient(135deg, #c0c0c0, #808080)', 'linear-gradient(135deg, #cd7f32, #8b4513)']
              return (
                <div key={user.user_id} style={{
                  marginBottom: i < 4 ? '14px' : 0,
                  padding: i < 3 ? '10px 12px' : '4px 0',
                  borderRadius: i < 3 ? '8px' : 0,
                  background: i < 3 ? `${i === 0 ? 'rgba(255,204,0,0.04)' : i === 1 ? 'rgba(192,192,192,0.04)' : 'rgba(205,127,50,0.04)'}` : 'transparent',
                  borderLeft: i < 3 ? `3px solid ${i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : '#cd7f32'}` : '3px solid transparent'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <div style={{
                      width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0,
                      background: i < 3 ? medalColors[i] : 'var(--bg-input)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '11px', fontWeight: '700', color: i < 3 ? '#1a1d26' : 'var(--text-dim)'
                    }}>
                      {i + 1}
                    </div>
                    <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '500', flex: 1 }}>
                      {user.full_name}
                    </span>
                    <span style={{ fontSize: '14px', fontWeight: '800', color: i === 0 ? 'var(--gold)' : 'var(--text-primary)' }}>
                      {user.total_points}
                    </span>
                  </div>
                  <div style={{ display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden', background: 'var(--bg-input)', marginLeft: '36px' }}>
                    <div style={{ width: `${exactPct}%`, background: 'var(--gold)', transition: 'width 0.4s' }} />
                    <div style={{ width: `${signPct}%`, background: 'var(--green)', transition: 'width 0.4s', marginLeft: '1px' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '3px' }}>
                    <span style={{ fontSize: '10px', color: 'var(--gold)' }}>{user.exact_hits || 0} exactos</span>
                    <span style={{ fontSize: '10px', color: 'var(--green)' }}>{user.sign_hits || 0} signos</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>{user.misses || 0} fallos</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ==================== PERSONAL TAB ==================== */}
      {activeTab === 'me' && (() => {
        const myLb = lbSorted.find(u => u.user_id === userId)
        const myRank = lbSorted.findIndex(u => u.user_id === userId) + 1
        const myExacts = myLb?.exact_hits || 0
        const mySigns = myLb?.sign_hits || 0
        const myMisses = myLb?.misses || 0
        const myPoints = myLb?.total_points || 0
        const myTotal = myExacts + mySigns + myMisses
        const myAccuracy = myTotal > 0 ? Math.round(((myExacts + mySigns) / myTotal) * 100) : 0
        const avgAcc = accuracyRate

        // Best/worst groups
        const groupPerf = groups.map(g => {
          const gMatchIds = matches.filter(m => m.group_name === g).map(m => m.id)
          const gPreds = myPredictions.filter(p => gMatchIds.includes(p.match_id) && p.points_earned !== null)
          const pts = gPreds.reduce((s, p) => s + (p.points_earned || 0), 0)
          return { group: g, points: pts, total: gPreds.length }
        }).filter(g => g.total > 0).sort((a, b) => b.points - a.points)

        // Score distribution
        const scoreDist = [
          { label: 'Exactos (3pts)', value: myExacts, color: 'var(--gold)' },
          { label: 'Signos (1pt)', value: mySigns, color: 'var(--green)' },
          { label: 'Fallos (0pts)', value: myMisses, color: 'var(--red)' }
        ]

        // Percentile
        const percentile = lbSorted.length > 1
          ? Math.round(((lbSorted.length - myRank) / (lbSorted.length - 1)) * 100)
          : 100

        // Points to next rank
        const nextUp = myRank > 1 ? lbSorted[myRank - 2] : null
        const ptsToNext = nextUp ? nextUp.total_points - myPoints : 0

        return (
          <div className="tab-fade-in">
            {/* Position card */}
            <div className="stats-hero" style={{ marginBottom: '14px' }}>
              <div className="gradient-text" style={{ fontSize: '52px', fontWeight: '900', lineHeight: 1 }}>
                {myRank > 0 ? `#${myRank}` : '-'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                de {lbSorted.length} participantes
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>
                Top {percentile}% · {myPoints} puntos
              </div>
              {nextUp && ptsToNext > 0 && (
                <div style={{
                  marginTop: '10px', padding: '6px 12px', background: 'var(--bg-input)',
                  borderRadius: '6px', fontSize: '11px', color: 'var(--text-muted)', display: 'inline-block'
                }}>
                  A {ptsToNext} pts de {nextUp.full_name} ({myRank - 1}º)
                </div>
              )}
            </div>

            {/* Accuracy comparison */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px'
            }}>
              <StatCard value={`${myAccuracy}%`} label="Tu acierto" color={myAccuracy >= avgAcc ? 'var(--green)' : 'var(--red)'}
                sub={myAccuracy >= avgAcc ? `+${myAccuracy - avgAcc}% vs media` : `${myAccuracy - avgAcc}% vs media`} />
              <StatCard value={myExacts} label="Exactos" color="var(--gold)"
                sub={`${mySigns} signos · ${myMisses} fallos`} />
            </div>

            {/* Score distribution bar */}
            <div className="stats-card">
              <SectionHeader>Distribución de resultados</SectionHeader>

              {/* Stacked bar */}
              {myTotal > 0 && (
                <div style={{ display: 'flex', height: '28px', borderRadius: '6px', overflow: 'hidden', marginBottom: '12px' }}>
                  {scoreDist.map((s, i) => s.value > 0 && (
                    <div key={i} style={{
                      width: `${(s.value / myTotal) * 100}%`, background: s.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '11px', fontWeight: '700', color: i === 2 ? '#fff' : '#1a1d26',
                      minWidth: '24px'
                    }}>
                      {Math.round((s.value / myTotal) * 100)}%
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                {scoreDist.map((s, i) => (
                  <div key={i} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '18px', fontWeight: '700', color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '2px' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Performance by group */}
            {groupPerf.length > 0 && (
              <div className="stats-card">
                <SectionHeader>Rendimiento por grupo</SectionHeader>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {groupPerf.map((g, i) => (
                    <div key={g.group} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        fontSize: '11px', fontWeight: '600', width: '28px',
                        color: i === 0 ? 'var(--gold)' : i === groupPerf.length - 1 ? 'var(--red)' : 'var(--text-muted)'
                      }}>
                        Gr.{g.group}
                      </span>
                      <div style={{ flex: 1, height: '14px', background: 'var(--bg-input)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: '3px',
                          background: i === 0 ? 'var(--gold)' : 'var(--green)',
                          width: `${groupPerf[0].points > 0 ? (g.points / groupPerf[0].points) * 100 : 0}%`
                        }} />
                      </div>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)', width: '32px', textAlign: 'right' }}>
                        {g.points}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Comparison vs average */}
            <div className="stats-card">
              <SectionHeader>Tú vs la media</SectionHeader>
              {[
                { label: 'Puntos', mine: myPoints, avg: avgPoints },
                { label: 'Exactos', mine: myExacts, avg: lbSorted.length > 0 ? Math.round(totalExacts / lbSorted.length) : 0 },
                { label: 'Signos', mine: mySigns, avg: lbSorted.length > 0 ? Math.round(totalSigns / lbSorted.length) : 0 }
              ].map((row, i) => {
                const maxVal = Math.max(row.mine, row.avg, 1)
                const better = row.mine >= row.avg
                return (
                  <div key={i} style={{ marginBottom: i < 2 ? '12px' : 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{row.label}</span>
                      <span style={{ fontSize: '11px', color: better ? 'var(--green)' : 'var(--red)', fontWeight: '600' }}>
                        {better ? '+' : ''}{row.mine - row.avg} vs media
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ height: '8px', background: 'var(--bg-input)', borderRadius: '4px', overflow: 'hidden', marginBottom: '2px' }}>
                          <div style={{ height: '100%', borderRadius: '4px', background: 'var(--gold)', width: `${(row.mine / maxVal) * 100}%` }} />
                        </div>
                        <div style={{ height: '6px', background: 'var(--bg-input)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: '3px', background: 'var(--text-dim)', width: `${(row.avg / maxVal) * 100}%` }} />
                        </div>
                      </div>
                      <div style={{ width: '50px', textAlign: 'right' }}>
                        <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--gold)', lineHeight: 1 }}>{row.mine}</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-dim)', lineHeight: 1, marginTop: '2px' }}>{row.avg}</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* ===== ¿QUÉ NECESITAS? — Scenario simulator ===== */}
            {(() => {
              // Upcoming matches (scheduled, from allMatches)
              const upcoming = allMatches
                .filter(m => m.status === 'scheduled')
                .slice(0, 6)

              if (upcoming.length === 0 || myRank === 0) return null

              // Rivals: user above and below
              const rivalAbove = myRank > 1 ? lbSorted[myRank - 2] : null
              const rivalBelow = myRank < lbSorted.length ? lbSorted[myRank] : null

              // Get nickname helper
              const getName = (uid) => {
                const p = profiles.find(pr => pr.id === uid)
                return p?.nickname || p?.full_name || '?'
              }

              // For each upcoming match, check divergence with rival above
              const divergences = []
              if (rivalAbove) {
                for (const match of upcoming) {
                  const myPred = allPredictions.find(p => p.match_id === match.id && p.user_id === userId)
                  const rivalPred = allPredictions.find(p => p.match_id === match.id && p.user_id === rivalAbove.user_id)
                  if (!myPred || !rivalPred) continue

                  const mySign = Math.sign(myPred.predicted_home - myPred.predicted_away)
                  const rivalSign = Math.sign(rivalPred.predicted_home - rivalPred.predicted_away)
                  if (mySign !== rivalSign) {
                    divergences.push({
                      match,
                      myPred: `${myPred.predicted_home}-${myPred.predicted_away}`,
                      rivalPred: `${rivalPred.predicted_home}-${rivalPred.predicted_away}`,
                      rivalName: getName(rivalAbove.user_id)
                    })
                  }
                }
              }

              // Best/worst case for next matches
              const bestCase = upcoming.length * 3
              const worstCase = 0

              // How many exact hits needed to overtake rival above
              const gapToAbove = rivalAbove ? rivalAbove.total_points - myPoints : 0
              const exactsNeeded = gapToAbove > 0 ? Math.ceil(gapToAbove / 3) : 0
              const signsNeeded = gapToAbove > 0 ? gapToAbove : 0

              // Gap from below
              const gapFromBelow = rivalBelow ? myPoints - rivalBelow.total_points : null

              return (
                <div className="stats-card" style={{ position: 'relative', overflow: 'hidden' }}>
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
                    background: 'linear-gradient(90deg, var(--gold), var(--green), var(--gold))'
                  }} />
                  <SectionHeader>¿Qué necesitas?</SectionHeader>

                  {/* Gap to position above */}
                  {rivalAbove && gapToAbove > 0 && (
                    <div style={{
                      padding: '14px', borderRadius: '10px', marginBottom: '12px',
                      background: 'linear-gradient(135deg, rgba(255,204,0,0.06), rgba(0,122,69,0.04))',
                      border: '1px solid rgba(255,204,0,0.12)'
                    }}>
                      <div style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                        Estás a <span style={{ color: 'var(--gold)', fontWeight: '800', fontSize: '14px' }}>{gapToAbove} pts</span> de{' '}
                        <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{getName(rivalAbove.user_id)}</span>{' '}
                        <span style={{ color: 'var(--text-dim)' }}>({myRank - 1}º)</span>
                      </div>
                      <div style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <div style={{
                          padding: '6px 10px', borderRadius: '6px', background: 'rgba(255,204,0,0.1)',
                          fontSize: '11px', color: 'var(--gold)', fontWeight: '600'
                        }}>
                          {exactsNeeded} exacto{exactsNeeded !== 1 ? 's' : ''} para adelantar
                        </div>
                        {gapToAbove <= upcoming.length && (
                          <div style={{
                            padding: '6px 10px', borderRadius: '6px', background: 'rgba(0,122,69,0.1)',
                            fontSize: '11px', color: 'var(--green)', fontWeight: '600'
                          }}>
                            o {signsNeeded} signo{signsNeeded !== 1 ? 's' : ''} seguidos
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Threat from below */}
                  {rivalBelow && gapFromBelow !== null && gapFromBelow <= 6 && (
                    <div style={{
                      padding: '12px', borderRadius: '10px', marginBottom: '12px',
                      background: 'rgba(226,75,74,0.06)', border: '1px solid rgba(226,75,74,0.12)'
                    }}>
                      <div style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                        <span style={{ color: 'var(--red)', fontWeight: '600' }}>⚠</span>{' '}
                        <span style={{ fontWeight: '600' }}>{getName(rivalBelow.user_id)}</span>{' '}
                        <span style={{ color: 'var(--text-dim)' }}>({myRank + 1}º)</span> está solo a{' '}
                        <span style={{ color: 'var(--red)', fontWeight: '700' }}>{gapFromBelow} pts</span>
                      </div>
                    </div>
                  )}

                  {/* Divergences — key matches */}
                  {divergences.length > 0 && (
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{
                        fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600',
                        textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px'
                      }}>
                        Partidos clave vs {divergences[0].rivalName}
                      </div>
                      {divergences.slice(0, 3).map((d, i) => (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'center', gap: '10px',
                          padding: '10px 0',
                          borderBottom: i < Math.min(divergences.length, 3) - 1 ? '0.5px solid var(--border-light)' : 'none'
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: '500' }}>
                              {d.match.home_team?.name || 'TBD'} vs {d.match.away_team?.name || 'TBD'}
                            </div>
                            <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '2px' }}>
                              {d.match.stage === 'group' ? `Grupo ${d.match.group_name}` : d.match.stage?.replace('_', ' ')}
                            </div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '9px', color: 'var(--text-dim)', marginBottom: '2px' }}>Tú</div>
                            <div style={{
                              fontSize: '13px', fontWeight: '700', color: 'var(--gold)',
                              fontFamily: 'SF Mono, Monaco, monospace'
                            }}>{d.myPred}</div>
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>vs</div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '9px', color: 'var(--text-dim)', marginBottom: '2px' }}>{d.rivalName.split(' ')[0]}</div>
                            <div style={{
                              fontSize: '13px', fontWeight: '700', color: 'var(--text-muted)',
                              fontFamily: 'SF Mono, Monaco, monospace'
                            }}>{d.rivalPred}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Best case scenario */}
                  <div style={{
                    padding: '12px', borderRadius: '10px',
                    background: 'var(--bg-input)', textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                      Próximos {upcoming.length} partidos
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '20px' }}>
                      <div>
                        <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>Mejor caso</div>
                        <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--green)' }}>+{bestCase}</div>
                      </div>
                      <div style={{ width: '1px', background: 'var(--border)' }} />
                      <div>
                        <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>Tu potencial</div>
                        <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--gold)' }}>{myPoints + bestCase}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        )
      })()}

      {/* ==================== MATCHES TAB ==================== */}
      {activeTab === 'matches' && (
        <div className="tab-fade-in">
          {/* Group selector */}
          <div className="group-tabs" style={{ marginBottom: '14px' }}>
            {groups.map(g => {
              const groupMs = displayMatches.filter(m => m.group_name === g)
              const finished = groupMs.filter(m => m.status === 'finished').length
              return (
                <button
                  key={g}
                  onClick={() => setActiveGroup(g)}
                  style={{
                    padding: '6px 14px', borderRadius: '20px', border: 'none',
                    background: activeGroup === g ? 'var(--green)' : finished > 0 ? 'var(--green-light)' : 'var(--bg-secondary)',
                    color: activeGroup === g ? '#fff' : finished > 0 ? 'var(--green)' : 'var(--text-muted)',
                    cursor: 'pointer', fontSize: '12px', fontWeight: activeGroup === g ? '600' : '400',
                    whiteSpace: 'nowrap', flexShrink: 0, position: 'relative',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {g}
                  {finished > 0 && activeGroup !== g && (
                    <span style={{
                      position: 'absolute', top: '-2px', right: '-2px',
                      width: '6px', height: '6px', borderRadius: '50%',
                      background: 'var(--green)'
                    }} />
                  )}
                </button>
              )
            })}
          </div>

          {/* Match cards */}
          {groupMatches.map(match => {
            const consensus = getMatchConsensus(match.id)
            const isFinished = match.status === 'finished'
            return (
              <div key={match.id} style={{
                background: isFinished ? 'linear-gradient(135deg, rgba(0,122,69,0.04) 0%, var(--bg-secondary) 100%)' : 'var(--bg-secondary)',
                borderRadius: '14px', padding: '18px 20px',
                marginBottom: '12px',
                border: isFinished ? '1px solid rgba(0,122,69,0.2)' : '0.5px solid var(--border)'
              }}>
                <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginBottom: '12px', textAlign: 'center' }}>
                  {formatDate(match.match_date)}
                </div>

                {/* Teams row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, justifyContent: 'flex-end' }}>
                    <span style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {match.home_team?.name || 'TBD'}
                    </span>
                    {match.home_team?.flag_url && <img src={match.home_team.flag_url} alt="" style={{ width: '28px', height: '20px', borderRadius: '3px', objectFit: 'cover', flexShrink: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />}
                  </div>

                  {isFinished ? (
                    <div style={{
                      padding: '6px 16px', background: 'linear-gradient(135deg, var(--green), #00a85a)',
                      borderRadius: '8px',
                      fontSize: '20px', fontWeight: '800', color: '#fff', letterSpacing: '3px',
                      boxShadow: '0 2px 8px rgba(0,122,69,0.3)',
                      fontFamily: 'SF Mono, Monaco, monospace'
                    }}>
                      {match.home_score}-{match.away_score}
                    </div>
                  ) : (
                    <span style={{
                      fontSize: '12px', color: 'var(--text-dim)', fontWeight: '700',
                      padding: '4px 12px', border: '1px dashed var(--border)', borderRadius: '6px'
                    }}>vs</span>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                    {match.away_team?.flag_url && <img src={match.away_team.flag_url} alt="" style={{ width: '28px', height: '20px', borderRadius: '3px', objectFit: 'cover', flexShrink: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />}
                    <span style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {match.away_team?.name || 'TBD'}
                    </span>
                  </div>
                </div>

                {/* Consensus */}
                {consensus ? (
                  <>
                    <div style={{ fontSize: '10px', color: 'var(--text-dim)', textAlign: 'center', marginBottom: '10px' }}>
                      {consensus.total} predicciones
                    </div>

                    {/* 1X2 Odds — bet365 style */}
                    <div style={{ marginBottom: '12px' }}>
                      <OddsBar homePct={consensus.homePct} drawPct={consensus.drawPct} awayPct={consensus.awayPct} />
                    </div>

                    {/* Favorite result */}
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '10px 14px', borderRadius: '8px',
                      background: 'rgba(255,204,0,0.04)', border: '1px solid rgba(255,204,0,0.1)'
                    }}>
                      <div>
                        <span style={{ fontSize: '9px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Favorito</span>
                        <div style={{
                          fontSize: '20px', fontWeight: '900', color: 'var(--text-primary)', marginTop: '2px',
                          letterSpacing: '4px', fontFamily: 'SF Mono, Monaco, monospace'
                        }}>
                          {consensus.topResult}
                        </div>
                      </div>
                      <div style={{
                        padding: '6px 12px', background: 'var(--gold-dim)', borderRadius: '6px'
                      }}>
                        <span style={{ fontSize: '15px', fontWeight: '800', color: 'var(--gold)' }}>
                          {consensus.topResultPct}%
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{
                    padding: '14px', textAlign: 'center', color: 'var(--text-dim)',
                    fontSize: '11px', background: 'var(--bg-input)', borderRadius: '8px'
                  }}>
                    Sin predicciones aun
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ==================== BETS TAB ==================== */}
      {activeTab === 'bets' && (
        <div className="tab-fade-in">
          {/* Category filter */}
          <div className="group-tabs" style={{ marginBottom: '14px' }}>
            {betCategories.map(cat => (
              <button
                key={cat.key}
                onClick={() => setActiveBetCategory(cat.key)}
                style={{
                  padding: '6px 12px', borderRadius: '20px', border: 'none',
                  background: activeBetCategory === cat.key ? 'var(--green)' : 'var(--bg-secondary)',
                  color: activeBetCategory === cat.key ? '#fff' : 'var(--text-muted)',
                  cursor: 'pointer', fontSize: '11px', fontWeight: activeBetCategory === cat.key ? '600' : '400',
                  whiteSpace: 'nowrap', flexShrink: 0,
                  transition: 'all 0.2s ease'
                }}
              >{cat.label}</button>
            ))}
          </div>

          {/* Bet cards */}
          {filteredBets.map(bet => {
            const stats = getBetStats(bet.id)
            return (
              <div key={bet.id} className="stats-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '3px' }}>
                      {bet.name || bet.question}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
                      Máx. {bet.max_points} pts · {stats.total} respuestas
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {stats.topAnswers.length > 0 ? (
                    stats.topAnswers.map((a, i) => (
                      <div key={i}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{
                            fontSize: '12px', color: i === 0 ? 'var(--gold)' : 'var(--text-primary)',
                            fontWeight: i === 0 ? '600' : '400',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%'
                          }}>
                            {i === 0 ? '👑 ' : ''}{a.answer}
                          </span>
                          <span style={{
                            fontSize: '12px', fontWeight: '600',
                            color: i === 0 ? 'var(--gold)' : 'var(--text-muted)'
                          }}>
                            {a.pct}%
                          </span>
                        </div>
                        <div style={{
                          height: '8px', background: 'var(--bg-input)', borderRadius: '4px', overflow: 'hidden'
                        }}>
                          <div style={{
                            height: '100%',
                            width: `${a.pct}%`,
                            background: i === 0 ? 'linear-gradient(90deg, var(--gold), rgba(255,204,0,0.4))' : 'var(--green)',
                            borderRadius: '4px',
                            transition: 'width 0.5s ease'
                          }} />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '11px' }}>
                      Sin respuestas aún
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ==================== H2H TAB ==================== */}
      {activeTab === 'h2h' && (() => {
        const sortedProfiles = [...profiles].filter(p => p.id !== BOT365_ID).sort((a, b) =>
          (a.nickname || a.full_name || '').localeCompare(b.nickname || b.full_name || '')
        )

        const selectStyle = {
          width: '100%', padding: '10px 12px', borderRadius: '6px',
          border: '0.5px solid var(--border)', background: 'var(--bg-input)',
          color: 'var(--text-primary)', fontSize: '13px', outline: 'none',
          appearance: 'auto'
        }

        const lbA = leaderboard.find(u => u.user_id === h2hUserA)
        const lbB = leaderboard.find(u => u.user_id === h2hUserB)
        const rankA = h2hUserA ? lbSorted.findIndex(u => u.user_id === h2hUserA) + 1 : 0
        const rankB = h2hUserB ? lbSorted.findIndex(u => u.user_id === h2hUserB) + 1 : 0

        const h2hGroupMatches = displayMatches.filter(m => m.group_name === h2hGroup && m.status === 'finished')

        return (
          <div className="tab-fade-in">
            <div className="stats-card">
              <SectionHeader>Comparador H2H</SectionHeader>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                <div>
                  <label style={{ fontSize: '10px', color: 'var(--text-dim)', marginBottom: '4px', display: 'block' }}>Jugador A</label>
                  <select
                    value={h2hUserA}
                    onChange={e => {
                      setH2hUserA(e.target.value)
                      if (e.target.value && h2hUserB) fetchH2hPredictions(e.target.value, h2hUserB)
                    }}
                    style={selectStyle}
                  >
                    <option value="">Seleccionar...</option>
                    {sortedProfiles.map(p => (
                      <option key={p.id} value={p.id}>{p.nickname || p.full_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '10px', color: 'var(--text-dim)', marginBottom: '4px', display: 'block' }}>Jugador B</label>
                  <select
                    value={h2hUserB}
                    onChange={e => {
                      setH2hUserB(e.target.value)
                      if (h2hUserA && e.target.value) fetchH2hPredictions(h2hUserA, e.target.value)
                    }}
                    style={selectStyle}
                  >
                    <option value="">Seleccionar...</option>
                    {sortedProfiles.map(p => (
                      <option key={p.id} value={p.id}>{p.nickname || p.full_name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* H2H Summary */}
            {h2hUserA && h2hUserB && !h2hLoading && lbA && lbB && (
              <>
                {/* Side-by-side stats */}
                <div className="stats-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div style={{ textAlign: 'center', flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--gold)', marginBottom: '2px' }}>
                        {getProfileName(h2hUserA)}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>#{rankA || '-'}</div>
                    </div>
                    <div style={{
                      fontSize: '11px', fontWeight: '700', color: 'var(--text-dim)',
                      padding: '4px 10px', background: 'var(--bg-input)', borderRadius: '4px'
                    }}>VS</div>
                    <div style={{ textAlign: 'center', flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--green)', marginBottom: '2px' }}>
                        {getProfileName(h2hUserB)}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>#{rankB || '-'}</div>
                    </div>
                  </div>

                  {/* Stat rows */}
                  {[
                    { label: 'Puntos', valA: lbA.total_points || 0, valB: lbB.total_points || 0 },
                    { label: 'Exactos', valA: lbA.exact_hits || 0, valB: lbB.exact_hits || 0 },
                    { label: 'Signos', valA: lbA.sign_hits || 0, valB: lbB.sign_hits || 0 },
                    { label: 'Fallos', valA: lbA.misses || 0, valB: lbB.misses || 0 },
                    { label: 'Pre-torneo', valA: lbA.pre_tournament_points || 0, valB: lbB.pre_tournament_points || 0 }
                  ].map((row, i) => {
                    const maxVal = Math.max(row.valA, row.valB, 1)
                    const aWins = row.label === 'Fallos' ? row.valA < row.valB : row.valA > row.valB
                    const bWins = row.label === 'Fallos' ? row.valB < row.valA : row.valB > row.valA
                    return (
                      <div key={i} style={{ marginBottom: '12px' }}>
                        <div style={{ textAlign: 'center', fontSize: '10px', color: 'var(--text-dim)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          {row.label}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            width: '32px', textAlign: 'right', fontSize: '14px', fontWeight: '700',
                            color: aWins ? 'var(--gold)' : 'var(--text-muted)'
                          }}>{row.valA}</span>
                          <div style={{ flex: 1, display: 'flex', gap: '3px' }}>
                            <div style={{ flex: 1, height: '10px', background: 'var(--bg-input)', borderRadius: '3px', overflow: 'hidden', display: 'flex', justifyContent: 'flex-end' }}>
                              <div style={{
                                height: '100%', borderRadius: '3px',
                                background: aWins ? 'var(--gold)' : 'var(--text-dim)',
                                width: `${(row.valA / maxVal) * 100}%`,
                                transition: 'width 0.4s'
                              }} />
                            </div>
                            <div style={{ flex: 1, height: '10px', background: 'var(--bg-input)', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{
                                height: '100%', borderRadius: '3px',
                                background: bWins ? 'var(--green)' : 'var(--text-dim)',
                                width: `${(row.valB / maxVal) * 100}%`,
                                transition: 'width 0.4s'
                              }} />
                            </div>
                          </div>
                          <span style={{
                            width: '32px', textAlign: 'left', fontSize: '14px', fontWeight: '700',
                            color: bWins ? 'var(--green)' : 'var(--text-muted)'
                          }}>{row.valB}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Match-by-match comparison */}
                <div className="stats-card">
                  <SectionHeader>Partido a partido</SectionHeader>

                  {/* Group selector */}
                  <div className="group-tabs" style={{ marginBottom: '12px' }}>
                    {groups.map(g => (
                      <button
                        key={g}
                        onClick={() => setH2hGroup(g)}
                        style={{
                          padding: '5px 12px', borderRadius: '20px', border: 'none',
                          background: h2hGroup === g ? 'var(--green)' : 'var(--bg-input)',
                          color: h2hGroup === g ? '#fff' : 'var(--text-muted)',
                          cursor: 'pointer', fontSize: '11px', fontWeight: h2hGroup === g ? '600' : '400',
                          whiteSpace: 'nowrap', flexShrink: 0,
                          transition: 'all 0.2s ease'
                        }}
                      >{g}</button>
                    ))}
                  </div>

                  {h2hGroupMatches.length === 0 ? (
                    <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '12px' }}>
                      No hay partidos finalizados en el Grupo {h2hGroup}
                    </div>
                  ) : (
                    h2hGroupMatches.map(match => {
                      const predA = h2hPredictions[match.id]?.[h2hUserA]
                      const predB = h2hPredictions[match.id]?.[h2hUserB]
                      return (
                        <div key={match.id} style={{
                          padding: '10px 0', borderBottom: '0.5px solid var(--border-light)'
                        }}>
                          {/* Match header */}
                          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: '500', textAlign: 'right', flex: 1 }}>
                              {match.home_team?.name}
                            </span>
                            <span style={{
                              padding: '2px 8px', background: 'var(--green-light)', borderRadius: '4px',
                              fontSize: '13px', fontWeight: '700', color: 'var(--green)'
                            }}>
                              {match.home_score}-{match.away_score}
                            </span>
                            <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: '500', flex: 1 }}>
                              {match.away_team?.name}
                            </span>
                          </div>
                          {/* Predictions side by side */}
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <div style={{
                              flex: 1, textAlign: 'center', padding: '6px 8px', borderRadius: '6px',
                              background: predA?.points_earned === 3 ? 'rgba(0,122,69,0.15)' : predA?.points_earned === 1 ? 'rgba(255,204,0,0.08)' : 'var(--bg-input)',
                              border: predA?.points_earned === 3 ? '0.5px solid var(--green)' : predA?.points_earned === 1 ? '0.5px solid var(--gold)' : '0.5px solid transparent'
                            }}>
                              <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginBottom: '2px' }}>
                                {getProfileName(h2hUserA)}
                              </div>
                              <div style={{
                                fontSize: '15px', fontWeight: '700',
                                color: predA?.points_earned === 3 ? 'var(--green)' : predA?.points_earned === 1 ? 'var(--gold)' : 'var(--text-muted)'
                              }}>
                                {predA ? `${predA.predicted_home}-${predA.predicted_away}` : '-'}
                              </div>
                              <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '2px' }}>
                                {predA ? `${predA.points_earned || 0} pts` : ''}
                              </div>
                            </div>
                            <div style={{
                              flex: 1, textAlign: 'center', padding: '6px 8px', borderRadius: '6px',
                              background: predB?.points_earned === 3 ? 'rgba(0,122,69,0.15)' : predB?.points_earned === 1 ? 'rgba(255,204,0,0.08)' : 'var(--bg-input)',
                              border: predB?.points_earned === 3 ? '0.5px solid var(--green)' : predB?.points_earned === 1 ? '0.5px solid var(--gold)' : '0.5px solid transparent'
                            }}>
                              <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginBottom: '2px' }}>
                                {getProfileName(h2hUserB)}
                              </div>
                              <div style={{
                                fontSize: '15px', fontWeight: '700',
                                color: predB?.points_earned === 3 ? 'var(--green)' : predB?.points_earned === 1 ? 'var(--gold)' : 'var(--text-muted)'
                              }}>
                                {predB ? `${predB.predicted_home}-${predB.predicted_away}` : '-'}
                              </div>
                              <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '2px' }}>
                                {predB ? `${predB.points_earned || 0} pts` : ''}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>

                {/* H2H score tally */}
                {(() => {
                  let winsA = 0, winsB = 0, ties = 0
                  const finishedIds = displayMatches.filter(m => m.status === 'finished').map(m => m.id)
                  finishedIds.forEach(mId => {
                    const pA = h2hPredictions[mId]?.[h2hUserA]
                    const pB = h2hPredictions[mId]?.[h2hUserB]
                    if (pA && pB) {
                      if ((pA.points_earned || 0) > (pB.points_earned || 0)) winsA++
                      else if ((pB.points_earned || 0) > (pA.points_earned || 0)) winsB++
                      else ties++
                    }
                  })
                  if (winsA + winsB + ties === 0) return null
                  return (
                    <div className="stats-card" style={{ textAlign: 'center' }}>
                      <SectionHeader>Balance H2H</SectionHeader>
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px' }}>
                        <div>
                          <div style={{ fontSize: '24px', fontWeight: '800', color: winsA > winsB ? 'var(--gold)' : 'var(--text-muted)' }}>{winsA}</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>Mejor pred.</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-dim)' }}>{ties}</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>Empates</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '24px', fontWeight: '800', color: winsB > winsA ? 'var(--green)' : 'var(--text-muted)' }}>{winsB}</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>Mejor pred.</div>
                        </div>
                      </div>
                    </div>
                  )
                })()}

                {/* Pre-tournament bet comparison */}
                {bets.length > 0 && (h2hBetEntriesA.length > 0 || h2hBetEntriesB.length > 0) && (
                  <div className="stats-card">
                    <SectionHeader>Predicciones pre-torneo</SectionHeader>
                    {bets.map(bet => {
                      const entryA = h2hBetEntriesA.find(e => e.bet_id === bet.id)
                      const entryB = h2hBetEntriesB.find(e => e.bet_id === bet.id)
                      if (!entryA && !entryB) return null
                      const valA = formatBetValue(entryA?.value, bet.input_type)
                      const valB = formatBetValue(entryB?.value, bet.input_type)
                      const ptsA = entryA?.points_awarded || 0
                      const ptsB = entryB?.points_awarded || 0
                      const resolved = entryA?.is_resolved || entryB?.is_resolved
                      return (
                        <div key={bet.id} style={{ padding: '8px 0', borderBottom: '0.5px solid var(--border-light)' }}>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', textAlign: 'center' }}>
                            {bet.name || bet.question}
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <div style={{
                              flex: 1, textAlign: 'center', padding: '6px 4px', borderRadius: '6px',
                              background: resolved && ptsA > ptsB ? 'rgba(0,122,69,0.1)' : 'var(--bg-input)',
                              border: resolved && ptsA > ptsB ? '0.5px solid var(--green)' : '0.5px solid transparent'
                            }}>
                              <div style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {valA}
                              </div>
                              {resolved && <div style={{ fontSize: '10px', color: ptsA > 0 ? 'var(--green)' : 'var(--text-dim)', marginTop: '2px' }}>{ptsA} pts</div>}
                            </div>
                            <div style={{
                              flex: 1, textAlign: 'center', padding: '6px 4px', borderRadius: '6px',
                              background: resolved && ptsB > ptsA ? 'rgba(0,122,69,0.1)' : 'var(--bg-input)',
                              border: resolved && ptsB > ptsA ? '0.5px solid var(--green)' : '0.5px solid transparent'
                            }}>
                              <div style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {valB}
                              </div>
                              {resolved && <div style={{ fontSize: '10px', color: ptsB > 0 ? 'var(--green)' : 'var(--text-dim)', marginTop: '2px' }}>{ptsB} pts</div>}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Ordago comparison */}
                {ordagos.length > 0 && (h2hOrdagoEntriesA.length > 0 || h2hOrdagoEntriesB.length > 0) && (
                  <div className="stats-card">
                    <SectionHeader>Ordagos</SectionHeader>
                    {ordagos.map(ord => {
                      const oA = h2hOrdagoEntriesA.find(e => e.ordago_id === ord.id)
                      const oB = h2hOrdagoEntriesB.find(e => e.ordago_id === ord.id)
                      if (!oA && !oB) return null
                      const isResolved = ord.status === 'resolved'
                      const ptsA = oA?.points_awarded || 0
                      const ptsB = oB?.points_awarded || 0
                      return (
                        <div key={ord.id} style={{ padding: '8px 0', borderBottom: '0.5px solid var(--border-light)' }}>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', textAlign: 'center' }}>
                            {ord.title || `Ordago #${ord.number}`}
                            {ord.match && (
                              <span style={{ color: 'var(--text-dim)' }}>
                                {' '}({ord.match.home_team?.name} vs {ord.match.away_team?.name})
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <div style={{
                              flex: 1, textAlign: 'center', padding: '6px', borderRadius: '6px',
                              background: isResolved && ptsA > ptsB ? 'rgba(0,122,69,0.1)' : 'var(--bg-input)',
                              border: isResolved && ptsA > ptsB ? '0.5px solid var(--green)' : '0.5px solid transparent'
                            }}>
                              <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
                                {oA ? `${oA.predicted_home}-${oA.predicted_away}` : '-'}
                              </div>
                              {isResolved && <div style={{ fontSize: '10px', color: ptsA > 0 ? 'var(--green)' : 'var(--text-dim)', marginTop: '2px' }}>{ptsA} pts</div>}
                            </div>
                            <div style={{
                              flex: 1, textAlign: 'center', padding: '6px', borderRadius: '6px',
                              background: isResolved && ptsB > ptsA ? 'rgba(0,122,69,0.1)' : 'var(--bg-input)',
                              border: isResolved && ptsB > ptsA ? '0.5px solid var(--green)' : '0.5px solid transparent'
                            }}>
                              <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
                                {oB ? `${oB.predicted_home}-${oB.predicted_away}` : '-'}
                              </div>
                              {isResolved && <div style={{ fontSize: '10px', color: ptsB > 0 ? 'var(--green)' : 'var(--text-dim)', marginTop: '2px' }}>{ptsB} pts</div>}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}

            {h2hLoading && (
              <div style={{ padding: '30px', textAlign: 'center' }}>
                <div className="pulse-dots" style={{ justifyContent: 'center' }}>
                  <span style={{ width: 6, height: 6, background: 'var(--green)' }} />
                  <span style={{ width: 6, height: 6, background: 'var(--green)' }} />
                  <span style={{ width: 6, height: 6, background: 'var(--green)' }} />
                </div>
              </div>
            )}

            {h2hUserA && h2hUserB && !h2hLoading && (!lbA || !lbB) && (
              <div style={{
                padding: '30px 20px', textAlign: 'center', color: 'var(--text-dim)',
                fontSize: '12px', background: 'var(--bg-secondary)', borderRadius: '8px',
                border: '0.5px solid var(--border)'
              }}>
                Aun no hay datos en el leaderboard para estos usuarios.
              </div>
            )}

            {(!h2hUserA || !h2hUserB) && (
              <div style={{
                padding: '30px 20px', textAlign: 'center', color: 'var(--text-dim)',
                fontSize: '12px', background: 'var(--bg-secondary)', borderRadius: '8px',
                border: '0.5px solid var(--border)'
              }}>
                Selecciona dos participantes para comparar sus predicciones
              </div>
            )}
          </div>
        )
      })()}

      {/* ==================== VIEW OTHERS TAB ==================== */}
      {activeTab === 'view' && (() => {
        // Bets close when World Cup starts: June 11, 2026
        const betsClosedDate = new Date('2026-06-11T00:00:00Z')
        const betsClosed = new Date() >= betsClosedDate

        const sortedProfiles = [...profiles].filter(p => p.id !== BOT365_ID).sort((a, b) =>
          (a.nickname || a.full_name || '').localeCompare(b.nickname || b.full_name || '')
        )

        const viewGroupMatches = displayMatches.filter(m => m.group_name === viewGroup)

        return (
          <div className="tab-fade-in">
            {!betsClosed ? (
              <div className="stats-card" style={{ padding: '40px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔒</div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '8px' }}>
                  Disponible cuando cierre el plazo
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-dim)', lineHeight: '1.5' }}>
                  Podras ver las predicciones de todos los participantes una vez empiece el Mundial (11 junio 2026).
                </div>
              </div>
            ) : (
              <>
                <div className="stats-card">
                  <SectionHeader>Ver predicciones de otros</SectionHeader>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '12px', lineHeight: '1.4' }}>
                    Todas las predicciones de cada participante
                  </div>
                  <select
                    value={viewUser}
                    onChange={e => {
                      setViewUser(e.target.value)
                      if (e.target.value) fetchViewUser(e.target.value)
                    }}
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: '6px',
                      border: '0.5px solid var(--border)', background: 'var(--bg-input)',
                      color: 'var(--text-primary)', fontSize: '13px', outline: 'none',
                      appearance: 'auto'
                    }}
                  >
                    <option value="">Seleccionar participante...</option>
                    {sortedProfiles.map(p => (
                      <option key={p.id} value={p.id}>{p.nickname || p.full_name}</option>
                    ))}
                  </select>
                </div>

                {viewLoading && (
                  <div style={{ padding: '30px', textAlign: 'center' }}>
                    <div className="pulse-dots" style={{ justifyContent: 'center' }}>
                      <span style={{ width: 6, height: 6, background: 'var(--green)' }} />
                      <span style={{ width: 6, height: 6, background: 'var(--green)' }} />
                      <span style={{ width: 6, height: 6, background: 'var(--green)' }} />
                    </div>
                  </div>
                )}

                {viewUser && !viewLoading && (
                  <>
                    {/* Summary card */}
                    {(() => {
                      const totalPts = viewPredictions.reduce((s, p) => s + (p.points_earned || 0), 0)
                      const exacts = viewPredictions.filter(p => p.points_earned === 3).length
                      const signs = viewPredictions.filter(p => p.points_earned === 1).length
                      return (
                        <div style={{
                          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '14px'
                        }}>
                          <div style={{
                            background: 'var(--bg-secondary)', borderRadius: '8px', padding: '12px',
                            border: '0.5px solid var(--border)', textAlign: 'center'
                          }}>
                            <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)' }}>{totalPts}</div>
                            <div style={{ fontSize: '9px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Puntos</div>
                          </div>
                          <div style={{
                            background: 'var(--bg-secondary)', borderRadius: '8px', padding: '12px',
                            border: '0.5px solid var(--border)', textAlign: 'center'
                          }}>
                            <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--gold)' }}>{exacts}</div>
                            <div style={{ fontSize: '9px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Exactos</div>
                          </div>
                          <div style={{
                            background: 'var(--bg-secondary)', borderRadius: '8px', padding: '12px',
                            border: '0.5px solid var(--border)', textAlign: 'center'
                          }}>
                            <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--green)' }}>{signs}</div>
                            <div style={{ fontSize: '9px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Signos</div>
                          </div>
                        </div>
                      )
                    })()}

                    {/* Match predictions */}
                    <div className="stats-card">
                      <SectionHeader>Predicciones de partidos</SectionHeader>

                      {/* Group selector */}
                      <div className="group-tabs" style={{ marginBottom: '12px' }}>
                        {groups.map(g => (
                          <button
                            key={g}
                            onClick={() => setViewGroup(g)}
                            style={{
                              padding: '5px 12px', borderRadius: '20px', border: 'none',
                              background: viewGroup === g ? 'var(--green)' : 'var(--bg-input)',
                              color: viewGroup === g ? '#fff' : 'var(--text-muted)',
                              cursor: 'pointer', fontSize: '11px', fontWeight: viewGroup === g ? '600' : '400',
                              whiteSpace: 'nowrap', flexShrink: 0,
                              transition: 'all 0.2s ease'
                            }}
                          >{g}</button>
                        ))}
                      </div>

                      {viewGroupMatches.length === 0 ? (
                        <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '12px' }}>
                          No hay partidos en el Grupo {viewGroup}
                        </div>
                      ) : (
                        viewGroupMatches.map(match => {
                          const pred = viewPredictions.find(p => p.match_id === match.id)
                          const isFinished = match.status === 'finished'
                          return (
                            <div key={match.id} style={{
                              padding: '10px 0', borderBottom: '0.5px solid var(--border-light)'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                                  <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: '500' }}>
                                    {match.home_team?.name}
                                  </span>
                                  {match.home_team?.flag_url && <img src={match.home_team.flag_url} alt="" style={{ width: '18px', height: '12px', borderRadius: '2px', objectFit: 'cover' }} />}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', minWidth: '60px' }}>
                                  {isFinished ? (
                                    <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--green)' }}>
                                      {match.home_score}-{match.away_score}
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>vs</span>
                                  )}
                                  {pred ? (
                                    <span style={{
                                      fontSize: '12px', fontWeight: '600',
                                      padding: '1px 8px', borderRadius: '4px',
                                      background: isFinished ? (pred.points_earned === 3 ? 'rgba(0,122,69,0.15)' : pred.points_earned === 1 ? 'rgba(255,204,0,0.08)' : 'var(--bg-input)') : 'var(--bg-input)',
                                      color: isFinished ? (pred.points_earned === 3 ? 'var(--green)' : pred.points_earned === 1 ? 'var(--gold)' : 'var(--text-dim)') : 'var(--text-primary)'
                                    }}>
                                      {pred.predicted_home}-{pred.predicted_away}
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>-</span>
                                  )}
                                </div>
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  {match.away_team?.flag_url && <img src={match.away_team.flag_url} alt="" style={{ width: '18px', height: '12px', borderRadius: '2px', objectFit: 'cover' }} />}
                                  <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: '500' }}>
                                    {match.away_team?.name}
                                  </span>
                                </div>
                              </div>
                              {isFinished && pred && (
                                <div style={{ textAlign: 'center' }}>
                                  <span style={{
                                    fontSize: '10px', fontWeight: '600',
                                    color: pred.points_earned === 3 ? 'var(--green)' : pred.points_earned === 1 ? 'var(--gold)' : 'var(--text-dim)'
                                  }}>
                                    {pred.points_earned === 3 ? 'Exacto (+3)' : pred.points_earned === 1 ? 'Signo (+1)' : 'Fallo (0)'}
                                  </span>
                                </div>
                              )}
                            </div>
                          )
                        })
                      )}
                    </div>

                    {/* Pre-tournament bets */}
                    {viewBetEntries.length > 0 && (
                      <div className="stats-card">
                        <SectionHeader>Predicciones pre-torneo</SectionHeader>
                        {bets.map(bet => {
                          const entry = viewBetEntries.find(e => e.bet_id === bet.id)
                          if (!entry) return null
                          const resolved = entry.is_resolved
                          return (
                            <div key={bet.id} style={{
                              padding: '10px 0', borderBottom: '0.5px solid var(--border-light)'
                            }}>
                              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                                {bet.name || bet.question}
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{
                                  fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)',
                                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%'
                                }}>
                                  {formatBetValue(entry.value, bet.input_type)}
                                </span>
                                {resolved && (
                                  <span style={{
                                    fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '4px',
                                    background: (entry.points_awarded || 0) > 0 ? 'rgba(0,122,69,0.15)' : 'var(--bg-input)',
                                    color: (entry.points_awarded || 0) > 0 ? 'var(--green)' : 'var(--text-dim)'
                                  }}>
                                    {entry.points_awarded || 0} pts
                                  </span>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Ordagos */}
                    {viewOrdagoEntries.length > 0 && ordagos.length > 0 && (
                      <div className="stats-card">
                        <SectionHeader>Ordagos</SectionHeader>
                        {ordagos.map(ord => {
                          const entry = viewOrdagoEntries.find(e => e.ordago_id === ord.id)
                          if (!entry) return null
                          const isResolved = ord.status === 'resolved'
                          return (
                            <div key={ord.id} style={{
                              padding: '10px 0', borderBottom: '0.5px solid var(--border-light)'
                            }}>
                              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                                {ord.title || `Ordago #${ord.number}`}
                                {ord.match && (
                                  <span style={{ color: 'var(--text-dim)', fontSize: '11px' }}>
                                    {' '}({ord.match.home_team?.name} vs {ord.match.away_team?.name})
                                  </span>
                                )}
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
                                  {entry.predicted_home}-{entry.predicted_away}
                                </span>
                                {isResolved && (
                                  <span style={{
                                    fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '4px',
                                    background: (entry.points_awarded || 0) > 0 ? 'rgba(0,122,69,0.15)' : 'var(--bg-input)',
                                    color: (entry.points_awarded || 0) > 0 ? 'var(--green)' : 'var(--text-dim)'
                                  }}>
                                    {entry.points_awarded > 0 ? '+' : ''}{entry.points_awarded || 0} pts
                                  </span>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </>
                )}

                {!viewUser && (
                  <div style={{
                    padding: '30px 20px', textAlign: 'center', color: 'var(--text-dim)',
                    fontSize: '12px', background: 'var(--bg-secondary)', borderRadius: '8px',
                    border: '0.5px solid var(--border)'
                  }}>
                    Selecciona un participante para ver sus predicciones
                  </div>
                )}
              </>
            )}
          </div>
        )
      })()}
    </div>
  )
}
