import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabase'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { generateDemoMatchStatuses } from '../hooks/useDemoMode'
import { SkeletonDashboard } from '../components/Skeleton'
import Avatar from '../components/Avatar'

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

  // View others state
  const [viewUser, setViewUser] = useState('')
  const [viewPredictions, setViewPredictions] = useState([])
  const [viewBetEntries, setViewBetEntries] = useState([])
  const [viewLoading, setViewLoading] = useState(false)
  const [viewGroup, setViewGroup] = useState('A')

  // Shared data
  const [teams, setTeams] = useState([])
  const [allPreTournamentEntries, setAllPreTournamentEntries] = useState([])
  const [allMatches, setAllMatches] = useState([])

  const groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']
  const betCategories = [
    { key: 'all', label: 'Todas' },
    { key: 'players', label: 'Jugadores' },
    { key: 'teams', label: 'Selecciones' },
    { key: 'yesno', label: '¿Sí o No?' }
  ]

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) setUserId(user.id)

    const queries = [
      supabase.from('matches')
        .select('*, home_team:teams!matches_home_team_id_fkey(name, flag_url), away_team:teams!matches_away_team_id_fkey(name, flag_url)')
        .in('stage', ['group', 'friendly']).order('match_date', { ascending: true }),
      supabase.from('predictions').select('match_id, predicted_home, predicted_away, user_id'),
      supabase.from('profiles').select('id, full_name, has_paid, avatar_url'),
      supabase.from('pre_tournament_bets').select('*').order('id', { ascending: true }),
      supabase.from('pre_tournament_entries').select('bet_id, user_id, value, points_awarded, is_resolved'),
      supabase.from('leaderboard').select('*'),
      supabase.from('teams').select('id, name, flag_url'),
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
    setAllMatches(results[7].data || [])
    if (results[8]) setMyPredictions(results[8].data || [])
    setLoading(false)
  }

  // ========== H2H FETCH ==========
  async function fetchH2hPredictions(userAId, userBId) {
    if (!userAId || !userBId) return
    setH2hLoading(true)
    const [predsRes, betEntriesARes, betEntriesBRes] = await Promise.all([
      supabase.from('predictions')
        .select('user_id, match_id, predicted_home, predicted_away, points_earned')
        .in('user_id', [userAId, userBId]),
      supabase.from('pre_tournament_entries')
        .select('bet_id, value, points_awarded, is_resolved')
        .eq('user_id', userAId),
      supabase.from('pre_tournament_entries')
        .select('bet_id, value, points_awarded, is_resolved')
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
    setH2hLoading(false)
  }

  // ========== VIEW OTHERS FETCH ==========
  async function fetchViewUser(uid) {
    if (!uid) return
    setViewLoading(true)
    const [predsRes, entriesRes] = await Promise.all([
      supabase.from('predictions')
        .select('match_id, predicted_home, predicted_away, points_earned')
        .eq('user_id', uid),
      supabase.from('pre_tournament_entries')
        .select('bet_id, value, points_awarded, is_resolved')
        .eq('user_id', uid)
    ])
    setViewPredictions(predsRes.data || [])
    setViewBetEntries(entriesRes.data || [])
    setViewLoading(false)
  }

  function getProfileName(id) {
    const p = profiles.find(pr => pr.id === id)
    return p ? (p.full_name || 'Participante') : 'Participante'
  }

  function getProfileAvatar(id) {
    const p = profiles.find(pr => pr.id === id)
    return p?.avatar_url || null
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
  const SectionHeader = ({ children, accent }) => (
    <div style={{
      fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase',
      letterSpacing: '1.2px', fontWeight: '700', marginBottom: '14px',
      display: 'flex', alignItems: 'center', gap: '8px'
    }}>
      {accent && <span style={{ color: accent }}>{accent === 'var(--gold)' ? '★' : '•'}</span>}
      <span>{children}</span>
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
      <div style={{ marginBottom: '14px' }}>
        <h1 style={{
          fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)',
          margin: '0 0 6px', letterSpacing: '-0.4px'
        }}>
          Stats
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '500' }}>
            {finishedMatches.length} <span style={{ color: 'var(--text-dim)' }}>de</span> {totalMatches} partidos
          </span>
          {demoMode && (
            <span style={{
              fontSize: '9px', color: 'var(--gold)', fontWeight: '700',
              padding: '2px 8px', borderRadius: '4px',
              background: 'rgba(255,204,0,0.1)', letterSpacing: '0.8px'
            }}>DEMO</span>
          )}
        </div>
      </div>

      {/* Progress bar — tournament progress */}
      <div style={{
        background: 'var(--bg-input)', borderRadius: '4px', height: '4px',
        marginBottom: '16px', overflow: 'hidden'
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
        marginBottom: '16px', gap: '6px'
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
              padding: '6px 12px', borderRadius: '20px', border: 'none',
              background: activeTab === tab.key ? 'var(--green)' : 'var(--bg-secondary)',
              color: activeTab === tab.key ? '#fff' : 'var(--text-muted)',
              fontSize: '12px', fontWeight: activeTab === tab.key ? '700' : '500', cursor: 'pointer',
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
          {/* Hero accuracy card — Dashboard hero style */}
          <div style={{
            background: 'linear-gradient(135deg, #00392a, #00643d)',
            borderRadius: '14px',
            padding: '18px 20px',
            marginBottom: '12px',
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

            <div style={{
              fontSize: '10px', color: 'rgba(255,255,255,0.5)',
              textTransform: 'uppercase', letterSpacing: '1.4px', fontWeight: '600',
              marginBottom: '10px'
            }}>
              Acierto global
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                  <span style={{ fontSize: '46px', fontWeight: '800', color: '#fff', lineHeight: 1 }}>
                    {accuracyRate}
                  </span>
                  <span style={{ fontSize: '20px', fontWeight: '700', color: 'rgba(255,255,255,0.5)' }}>%</span>
                </div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)', marginTop: '8px', fontWeight: '500' }}>
                  {totalExacts} exactos · {totalSigns} signos · {lbSorted.reduce((s, u) => s + (u.misses || 0), 0)} fallos
                </div>
              </div>
              {/* Mini gauge */}
              <div style={{ position: 'relative', width: '76px', height: '76px', flexShrink: 0 }}>
                <ResponsiveContainer width={76} height={76}>
                  <PieChart>
                    <Pie
                      data={[{ value: accuracyRate }, { value: 100 - accuracyRate }]}
                      cx="50%" cy="50%"
                      innerRadius={28} outerRadius={36}
                      startAngle={90} endAngle={-270}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      <Cell fill="#ffcc00" />
                      <Cell fill="rgba(255,255,255,0.1)" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div style={{
                  position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                  fontSize: '13px', fontWeight: '800', color: '#fff'
                }}>
                  {finishedMatches.length}
                </div>
              </div>
            </div>
          </div>

          {/* Stats strip — horizontal scroll */}
          <div style={{
            display: 'flex', gap: '8px', overflowX: 'auto', scrollbarWidth: 'none',
            WebkitOverflowScrolling: 'touch', marginBottom: '14px', padding: '2px 0'
          }}>
            {[
              { value: totalUsers, label: 'Participantes', color: 'var(--text-primary)' },
              { value: totalPredictions.toLocaleString(), label: 'Predicciones', color: 'var(--gold)' },
              { value: `${avgPoints}`, label: 'Media pts', color: 'var(--text-primary)' },
              { value: lbSorted[0]?.total_points || 0, label: 'Líder', color: 'var(--gold)' }
            ].map((s, i) => (
              <div key={i} style={{
                minWidth: '96px', flex: '1 0 auto', background: 'var(--bg-secondary)',
                borderRadius: '10px', padding: '12px 10px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '20px', fontWeight: '800', color: s.color, lineHeight: 1 }}>{s.value}</div>
                <div style={{
                  fontSize: '9px', color: 'var(--text-dim)', textTransform: 'uppercase',
                  letterSpacing: '1px', marginTop: '6px', fontWeight: '700'
                }}>{s.label}</div>
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
            <SectionHeader>Top 5 — desglose</SectionHeader>
            {lbSorted.slice(0, 5).map((user, i) => {
              const total = (user.exact_hits || 0) + (user.sign_hits || 0) + (user.misses || 0)
              const exactPct = total > 0 ? ((user.exact_hits || 0) / total) * 100 : 0
              const signPct = total > 0 ? ((user.sign_hits || 0) / total) * 100 : 0
              const isMe = user.user_id === userId
              const fullName = getProfileName(user.user_id) || user.full_name
              return (
                <div key={user.user_id} style={{
                  marginBottom: i < 4 ? '12px' : 0,
                  paddingBottom: i < 4 ? '12px' : 0,
                  borderBottom: i < 4 ? '0.5px solid var(--border-light)' : 'none'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <span style={{
                      width: '20px', textAlign: 'center', flexShrink: 0,
                      fontSize: '13px', fontWeight: '700',
                      color: i === 0 ? 'var(--gold)' : 'var(--text-muted)'
                    }}>
                      {i + 1}
                    </span>
                    <Avatar
                      url={getProfileAvatar(user.user_id)}
                      name={fullName}
                      size={30}
                      color={isMe ? 'rgba(0,144,81,0.25)' : 'rgba(255,255,255,0.05)'}
                      border={isMe ? '1px solid rgba(0,144,81,0.4)' : '1px solid rgba(255,255,255,0.06)'}
                      textColor={isMe ? '#4ade80' : 'var(--text-muted)'}
                    />
                    <span style={{
                      flex: 1, fontSize: '13px',
                      color: 'var(--text-primary)',
                      fontWeight: isMe ? '700' : '500',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>
                      {fullName}{isMe ? ' · Tú' : ''}
                    </span>
                    <span style={{
                      fontSize: '15px', fontWeight: '800',
                      color: i === 0 ? 'var(--gold)' : 'var(--text-primary)'
                    }}>
                      {user.total_points}
                      <span style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: '500', marginLeft: '3px' }}>pts</span>
                    </span>
                  </div>
                  {/* stacked accuracy bar */}
                  <div style={{
                    display: 'flex', height: '6px', borderRadius: '3px', overflow: 'hidden',
                    background: 'var(--bg-input)', marginLeft: '40px'
                  }}>
                    <div style={{ width: `${exactPct}%`, background: 'var(--gold)', transition: 'width 0.4s' }} />
                    <div style={{ width: `${signPct}%`, background: 'var(--green)', transition: 'width 0.4s' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '5px', marginLeft: '40px' }}>
                    <span style={{ fontSize: '10px', color: 'var(--gold)', fontWeight: '600' }}>{user.exact_hits || 0} exactos</span>
                    <span style={{ fontSize: '10px', color: 'var(--green)', fontWeight: '600' }}>{user.sign_hits || 0} signos</span>
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
            {/* Position hero — Dashboard style */}
            <div style={{
              background: 'linear-gradient(135deg, #00392a, #00643d)',
              borderRadius: '14px',
              padding: '18px 20px',
              marginBottom: '12px',
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

              <div style={{
                fontSize: '10px', color: 'rgba(255,255,255,0.5)',
                textTransform: 'uppercase', letterSpacing: '1.4px', fontWeight: '600',
                marginBottom: '8px'
              }}>
                Tu posición
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', marginBottom: '12px' }}>
                <span style={{ fontSize: '46px', fontWeight: '800', color: '#fff', lineHeight: 1 }}>
                  {myRank > 0 ? myRank : '-'}
                </span>
                {myRank > 0 && (
                  <span style={{ fontSize: '15px', color: 'rgba(255,255,255,0.5)', paddingBottom: '6px' }}>
                    /{lbSorted.length}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '20px', alignItems: 'baseline' }}>
                <div>
                  <div style={{ fontSize: '22px', fontWeight: '800', color: '#fff', lineHeight: 1 }}>
                    {myPoints}
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
                    {percentile}<span style={{ fontSize: '14px' }}>%</span>
                  </div>
                  <div style={{
                    fontSize: '9px', color: 'rgba(255,255,255,0.5)',
                    textTransform: 'uppercase', letterSpacing: '1.2px', marginTop: '4px', fontWeight: '600'
                  }}>
                    Top
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '22px', fontWeight: '800', color: '#fff', lineHeight: 1 }}>
                    {myExacts}
                  </div>
                  <div style={{
                    fontSize: '9px', color: 'rgba(255,255,255,0.5)',
                    textTransform: 'uppercase', letterSpacing: '1.2px', marginTop: '4px', fontWeight: '600'
                  }}>
                    Exactos
                  </div>
                </div>
              </div>

              {nextUp && ptsToNext > 0 && (
                <div style={{
                  marginTop: '14px', padding: '8px 12px',
                  background: 'rgba(0,0,0,0.25)', borderRadius: '8px',
                  fontSize: '11px', color: 'rgba(255,255,255,0.85)',
                  display: 'inline-flex', alignItems: 'center', gap: '6px'
                }}>
                  <span style={{ color: 'var(--gold)', fontWeight: '700' }}>▲ {ptsToNext} pts</span>
                  <span style={{ color: 'rgba(255,255,255,0.55)' }}>de {nextUp.full_name} ({myRank - 1}º)</span>
                </div>
              )}
            </div>

            {/* Accuracy comparison */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px'
            }}>
              <div style={{
                background: 'var(--bg-secondary)', borderRadius: '10px',
                padding: '14px 12px', textAlign: 'center'
              }}>
                <div style={{
                  fontSize: '22px', fontWeight: '800',
                  color: myAccuracy >= avgAcc ? 'var(--green)' : 'var(--red)', lineHeight: 1
                }}>
                  {myAccuracy}%
                </div>
                <div style={{
                  fontSize: '9px', color: 'var(--text-dim)', textTransform: 'uppercase',
                  letterSpacing: '1px', marginTop: '6px', fontWeight: '700'
                }}>Tu acierto</div>
                <div style={{
                  fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.3
                }}>
                  {myAccuracy >= avgAcc ? `+${myAccuracy - avgAcc}% vs media` : `${myAccuracy - avgAcc}% vs media`}
                </div>
              </div>
              <div style={{
                background: 'var(--bg-secondary)', borderRadius: '10px',
                padding: '14px 12px', textAlign: 'center'
              }}>
                <div style={{
                  fontSize: '22px', fontWeight: '800', color: 'var(--gold)', lineHeight: 1
                }}>
                  {myExacts}
                </div>
                <div style={{
                  fontSize: '9px', color: 'var(--text-dim)', textTransform: 'uppercase',
                  letterSpacing: '1px', marginTop: '6px', fontWeight: '700'
                }}>Exactos</div>
                <div style={{
                  fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.3
                }}>
                  {mySigns} signos · {myMisses} fallos
                </div>
              </div>
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {groupPerf.map((g, i) => (
                    <div key={g.group} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{
                        fontSize: '11px', fontWeight: '700', width: '32px',
                        color: i === 0 ? 'var(--gold)' : i === groupPerf.length - 1 ? 'var(--red)' : 'var(--text-muted)'
                      }}>
                        Gr.{g.group}
                      </span>
                      <div style={{ flex: 1, height: '8px', background: 'var(--bg-input)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: '4px',
                          background: i === 0 ? 'linear-gradient(90deg, var(--green), var(--gold))' : 'var(--green)',
                          width: `${groupPerf[0].points > 0 ? (g.points / groupPerf[0].points) * 100 : 0}%`,
                          transition: 'width 0.4s ease'
                        }} />
                      </div>
                      <span style={{
                        fontSize: '13px', fontWeight: '700',
                        color: 'var(--text-primary)', width: '36px', textAlign: 'right'
                      }}>
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
                  <div key={i} style={{ marginBottom: i < 2 ? '14px' : 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: '600' }}>{row.label}</span>
                      <span style={{ fontSize: '11px', color: better ? '#4ade80' : 'var(--red)', fontWeight: '700' }}>
                        {better ? '+' : ''}{row.mine - row.avg} vs media
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ height: '8px', background: 'var(--bg-input)', borderRadius: '4px', overflow: 'hidden', marginBottom: '3px' }}>
                          <div style={{
                            height: '100%', borderRadius: '4px',
                            background: 'linear-gradient(90deg, var(--green), var(--gold))',
                            width: `${(row.mine / maxVal) * 100}%`,
                            transition: 'width 0.4s ease'
                          }} />
                        </div>
                        <div style={{ height: '5px', background: 'var(--bg-input)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: '3px',
                            background: 'var(--text-dim)',
                            width: `${(row.avg / maxVal) * 100}%`,
                            transition: 'width 0.4s ease'
                          }} />
                        </div>
                      </div>
                      <div style={{ width: '52px', textAlign: 'right' }}>
                        <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--gold)', lineHeight: 1 }}>{row.mine}</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-dim)', lineHeight: 1, marginTop: '3px', fontWeight: '600' }}>{row.avg}</div>
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
                return p?.full_name || '?'
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
                              {d.match.home_team?.name || 'Por determinar'} vs {d.match.away_team?.name || 'Por determinar'}
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
          {/* Section header */}
          <div style={{
            fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase',
            letterSpacing: '1.2px', fontWeight: '700', marginBottom: '10px'
          }}>
            Consenso por grupo
          </div>

          {/* Group selector */}
          <div className="group-tabs" style={{ marginBottom: '14px', gap: '6px' }}>
            {groups.map(g => {
              const groupMs = displayMatches.filter(m => m.group_name === g)
              const finished = groupMs.filter(m => m.status === 'finished').length
              return (
                <button
                  key={g}
                  onClick={() => setActiveGroup(g)}
                  style={{
                    padding: '6px 12px', borderRadius: '20px', border: 'none',
                    background: activeGroup === g ? 'var(--green)' : 'var(--bg-secondary)',
                    color: activeGroup === g ? '#fff' : finished > 0 ? 'var(--green)' : 'var(--text-muted)',
                    cursor: 'pointer', fontSize: '12px', fontWeight: '700',
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
                background: 'var(--bg-secondary)',
                borderRadius: '12px', padding: '14px 16px',
                marginBottom: '10px',
                border: 'none'
              }}>
                {/* Top row: date + status pill */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  marginBottom: '10px'
                }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                    {formatDate(match.match_date)}
                  </span>
                  {isFinished && (
                    <span style={{
                      fontSize: '9px', fontWeight: '700', color: 'var(--green)',
                      padding: '2px 8px', borderRadius: '20px',
                      background: 'rgba(0,122,69,0.12)', textTransform: 'uppercase', letterSpacing: '0.8px'
                    }}>FT</span>
                  )}
                </div>

                {/* Teams row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, justifyContent: 'flex-end', minWidth: 0 }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {match.home_team?.name || 'Por determinar'}
                    </span>
                    {match.home_team?.flag_url && <img src={match.home_team.flag_url} alt="" style={{ width: '24px', height: '17px', borderRadius: '3px', objectFit: 'cover', flexShrink: 0 }} />}
                  </div>

                  {isFinished ? (
                    <div style={{
                      padding: '4px 12px', background: 'var(--bg-input)',
                      borderRadius: '6px',
                      fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '2px',
                      fontFamily: 'SF Mono, Monaco, monospace', minWidth: '64px', textAlign: 'center'
                    }}>
                      {match.home_score}-{match.away_score}
                    </div>
                  ) : (
                    <span style={{
                      fontSize: '11px', color: 'var(--text-dim)', fontWeight: '700',
                      padding: '4px 10px', background: 'var(--bg-input)', borderRadius: '6px',
                      minWidth: '64px', textAlign: 'center'
                    }}>vs</span>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                    {match.away_team?.flag_url && <img src={match.away_team.flag_url} alt="" style={{ width: '24px', height: '17px', borderRadius: '3px', objectFit: 'cover', flexShrink: 0 }} />}
                    <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {match.away_team?.name || 'Por determinar'}
                    </span>
                  </div>
                </div>

                {/* Consensus */}
                {consensus ? (
                  <>
                    {/* 1X2 Odds — bet365 style */}
                    <div style={{ marginBottom: '10px' }}>
                      <OddsBar homePct={consensus.homePct} drawPct={consensus.drawPct} awayPct={consensus.awayPct} />
                    </div>

                    {/* Favorite result + total predictions */}
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '10px 12px', borderRadius: '8px',
                      background: 'var(--bg-input)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: 'var(--gold)', fontSize: '12px' }}>★</span>
                        <span style={{
                          fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)',
                          letterSpacing: '2px', fontFamily: 'SF Mono, Monaco, monospace'
                        }}>
                          {consensus.topResult}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--gold)', fontWeight: '700' }}>
                          {consensus.topResultPct}%
                        </span>
                      </div>
                      <span style={{
                        fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600',
                        textTransform: 'uppercase', letterSpacing: '0.6px'
                      }}>
                        {consensus.total} pred.
                      </span>
                    </div>
                  </>
                ) : (
                  <div style={{
                    padding: '12px', textAlign: 'center', color: 'var(--text-dim)',
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
          {/* Section header */}
          <div style={{
            fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase',
            letterSpacing: '1.2px', fontWeight: '700', marginBottom: '10px'
          }}>
            Consenso predicciones especiales
          </div>

          {/* Category filter */}
          <div className="group-tabs" style={{ marginBottom: '14px', gap: '6px' }}>
            {betCategories.map(cat => (
              <button
                key={cat.key}
                onClick={() => setActiveBetCategory(cat.key)}
                style={{
                  padding: '6px 12px', borderRadius: '20px', border: 'none',
                  background: activeBetCategory === cat.key ? 'var(--green)' : 'var(--bg-secondary)',
                  color: activeBetCategory === cat.key ? '#fff' : 'var(--text-muted)',
                  cursor: 'pointer', fontSize: '12px', fontWeight: '700',
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
              <div key={bet.id} style={{
                background: 'var(--bg-secondary)',
                borderRadius: '12px', padding: '14px 16px',
                marginBottom: '10px',
                border: 'none'
              }}>
                {/* Header */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                  gap: '12px', marginBottom: '12px'
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)',
                      letterSpacing: '-0.1px', lineHeight: 1.3, marginBottom: '4px'
                    }}>
                      {bet.name || bet.question}
                    </div>
                    <div style={{
                      fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600',
                      textTransform: 'uppercase', letterSpacing: '0.6px'
                    }}>
                      {stats.total} respuestas
                    </div>
                  </div>
                  <span style={{
                    fontSize: '10px', color: 'var(--gold)', fontWeight: '700',
                    padding: '3px 9px', borderRadius: '20px',
                    background: 'rgba(255,204,0,0.1)', whiteSpace: 'nowrap',
                    textTransform: 'uppercase', letterSpacing: '0.6px'
                  }}>
                    Máx. {bet.max_points} pts
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                  {stats.topAnswers.length > 0 ? (
                    stats.topAnswers.map((a, i) => (
                      <div key={i}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px', gap: '8px' }}>
                          <span style={{
                            fontSize: '13px', color: i === 0 ? 'var(--text-primary)' : 'var(--text-muted)',
                            fontWeight: i === 0 ? '700' : '500',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0
                          }}>
                            {i === 0 && <span style={{ color: 'var(--gold)', fontSize: '12px', flexShrink: 0 }}>★</span>}
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.answer}</span>
                          </span>
                          <span style={{
                            fontSize: '12px', fontWeight: '700', flexShrink: 0,
                            color: i === 0 ? 'var(--gold)' : 'var(--text-muted)'
                          }}>
                            {a.pct}%
                          </span>
                        </div>
                        <div style={{
                          height: '6px', background: 'var(--bg-input)', borderRadius: '3px', overflow: 'hidden'
                        }}>
                          <div style={{
                            height: '100%',
                            width: `${a.pct}%`,
                            background: i === 0
                              ? 'linear-gradient(90deg, var(--green), var(--gold))'
                              : 'rgba(157,163,176,0.35)',
                            borderRadius: '3px',
                            transition: 'width 0.5s ease'
                          }} />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{
                      padding: '14px', textAlign: 'center', color: 'var(--text-dim)',
                      fontSize: '12px', background: 'var(--bg-input)', borderRadius: '8px'
                    }}>
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
          (a.full_name || '').localeCompare(b.full_name || '')
        )

        const selectStyle = {
          width: '100%', padding: '10px 12px', borderRadius: '8px',
          border: 'none', background: 'var(--bg-input)',
          color: 'var(--text-primary)', fontSize: '13px', outline: 'none',
          appearance: 'auto', fontWeight: '600'
        }

        const lbA = leaderboard.find(u => u.user_id === h2hUserA)
        const lbB = leaderboard.find(u => u.user_id === h2hUserB)
        const rankA = h2hUserA ? lbSorted.findIndex(u => u.user_id === h2hUserA) + 1 : 0
        const rankB = h2hUserB ? lbSorted.findIndex(u => u.user_id === h2hUserB) + 1 : 0

        const h2hGroupMatches = displayMatches.filter(m => m.group_name === h2hGroup && m.status === 'finished')

        return (
          <div className="tab-fade-in">
            {/* Section header */}
            <div style={{
              fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase',
              letterSpacing: '1.2px', fontWeight: '700', marginBottom: '10px'
            }}>
              Comparador H2H
            </div>

            <div style={{
              background: 'var(--bg-secondary)', borderRadius: '12px',
              padding: '14px 16px', marginBottom: '12px'
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{
                    fontSize: '10px', color: 'var(--gold)', marginBottom: '6px',
                    display: 'block', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px'
                  }}>Jugador A</label>
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
                      <option key={p.id} value={p.id}>{p.full_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{
                    fontSize: '10px', color: 'var(--green)', marginBottom: '6px',
                    display: 'block', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px'
                  }}>Jugador B</label>
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
                      <option key={p.id} value={p.id}>{p.full_name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* H2H Summary */}
            {h2hUserA && h2hUserB && !h2hLoading && lbA && lbB && (
              <>
                {/* Side-by-side avatars + stat bars */}
                <div style={{
                  background: 'var(--bg-secondary)', borderRadius: '12px',
                  padding: '18px 16px', marginBottom: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                      <Avatar
                        url={getProfileAvatar(h2hUserA)}
                        name={getProfileName(h2hUserA)}
                        size={60}
                        color="rgba(255,204,0,0.12)"
                        border="2px solid var(--gold)"
                        textColor="var(--gold)"
                      />
                      <div style={{ textAlign: 'center' }}>
                        <div style={{
                          fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)',
                          letterSpacing: '-0.1px',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '130px'
                        }}>
                          {getProfileName(h2hUserA)}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--gold)', fontWeight: '700', marginTop: '3px' }}>
                          #{rankA || '-'}
                        </div>
                      </div>
                    </div>
                    <div style={{
                      fontSize: '12px', fontWeight: '800', color: 'var(--text-muted)',
                      padding: '6px 12px', background: 'var(--bg-input)', borderRadius: '20px',
                      letterSpacing: '1.5px'
                    }}>VS</div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                      <Avatar
                        url={getProfileAvatar(h2hUserB)}
                        name={getProfileName(h2hUserB)}
                        size={60}
                        color="rgba(0,122,69,0.15)"
                        border="2px solid var(--green)"
                        textColor="#4ade80"
                      />
                      <div style={{ textAlign: 'center' }}>
                        <div style={{
                          fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)',
                          letterSpacing: '-0.1px',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '130px'
                        }}>
                          {getProfileName(h2hUserB)}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--green)', fontWeight: '700', marginTop: '3px' }}>
                          #{rankB || '-'}
                        </div>
                      </div>
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
                        <div style={{
                          textAlign: 'center', fontSize: '10px', color: 'var(--text-muted)',
                          marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.8px',
                          fontWeight: '700'
                        }}>
                          {row.label}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{
                            width: '36px', textAlign: 'right', fontSize: '15px', fontWeight: '800',
                            color: aWins ? 'var(--gold)' : 'var(--text-dim)'
                          }}>{row.valA}</span>
                          <div style={{ flex: 1, display: 'flex', gap: '4px' }}>
                            <div style={{ flex: 1, height: '8px', background: 'var(--bg-input)', borderRadius: '4px', overflow: 'hidden', display: 'flex', justifyContent: 'flex-end' }}>
                              <div style={{
                                height: '100%', borderRadius: '4px',
                                background: aWins ? 'var(--gold)' : 'rgba(157,163,176,0.3)',
                                width: `${(row.valA / maxVal) * 100}%`,
                                transition: 'width 0.4s'
                              }} />
                            </div>
                            <div style={{ flex: 1, height: '8px', background: 'var(--bg-input)', borderRadius: '4px', overflow: 'hidden' }}>
                              <div style={{
                                height: '100%', borderRadius: '4px',
                                background: bWins ? 'var(--green)' : 'rgba(157,163,176,0.3)',
                                width: `${(row.valB / maxVal) * 100}%`,
                                transition: 'width 0.4s'
                              }} />
                            </div>
                          </div>
                          <span style={{
                            width: '36px', textAlign: 'left', fontSize: '15px', fontWeight: '800',
                            color: bWins ? 'var(--green)' : 'var(--text-dim)'
                          }}>{row.valB}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* H2H score tally — moved up for prominence */}
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
                    <div style={{
                      background: 'var(--bg-secondary)', borderRadius: '12px',
                      padding: '14px 16px', marginBottom: '12px'
                    }}>
                      <div style={{
                        fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase',
                        letterSpacing: '1.2px', fontWeight: '700', marginBottom: '12px', textAlign: 'center'
                      }}>
                        Balance partido a partido
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px' }}>
                        <div style={{ textAlign: 'center', flex: 1 }}>
                          <div style={{ fontSize: '28px', fontWeight: '800', color: winsA > winsB ? 'var(--gold)' : 'var(--text-dim)', lineHeight: 1 }}>{winsA}</div>
                          <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '6px', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: '700' }}>Mejor A</div>
                        </div>
                        <div style={{ textAlign: 'center', flex: 1 }}>
                          <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-dim)', lineHeight: 1 }}>{ties}</div>
                          <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '6px', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: '700' }}>Empates</div>
                        </div>
                        <div style={{ textAlign: 'center', flex: 1 }}>
                          <div style={{ fontSize: '28px', fontWeight: '800', color: winsB > winsA ? 'var(--green)' : 'var(--text-dim)', lineHeight: 1 }}>{winsB}</div>
                          <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '6px', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: '700' }}>Mejor B</div>
                        </div>
                      </div>
                    </div>
                  )
                })()}

                {/* Match-by-match comparison */}
                <div style={{
                  background: 'var(--bg-secondary)', borderRadius: '12px',
                  padding: '14px 16px', marginBottom: '12px'
                }}>
                  <div style={{
                    fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase',
                    letterSpacing: '1.2px', fontWeight: '700', marginBottom: '12px'
                  }}>
                    Partido a partido
                  </div>

                  {/* Group selector */}
                  <div className="group-tabs" style={{ marginBottom: '12px', gap: '6px' }}>
                    {groups.map(g => (
                      <button
                        key={g}
                        onClick={() => setH2hGroup(g)}
                        style={{
                          padding: '6px 12px', borderRadius: '20px', border: 'none',
                          background: h2hGroup === g ? 'var(--green)' : 'var(--bg-input)',
                          color: h2hGroup === g ? '#fff' : 'var(--text-muted)',
                          cursor: 'pointer', fontSize: '12px', fontWeight: '700',
                          whiteSpace: 'nowrap', flexShrink: 0,
                          transition: 'all 0.2s ease'
                        }}
                      >{g}</button>
                    ))}
                  </div>

                  {h2hGroupMatches.length === 0 ? (
                    <div style={{
                      padding: '16px', textAlign: 'center', color: 'var(--text-dim)',
                      fontSize: '12px', background: 'var(--bg-input)', borderRadius: '8px'
                    }}>
                      No hay partidos finalizados en el Grupo {h2hGroup}
                    </div>
                  ) : (
                    h2hGroupMatches.map(match => {
                      const predA = h2hPredictions[match.id]?.[h2hUserA]
                      const predB = h2hPredictions[match.id]?.[h2hUserB]
                      return (
                        <div key={match.id} style={{
                          padding: '12px 0', borderBottom: '0.5px solid var(--border-light)'
                        }}>
                          {/* Match header */}
                          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: '600', textAlign: 'right', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {match.home_team?.name}
                            </span>
                            <span style={{
                              padding: '3px 10px', background: 'var(--bg-input)', borderRadius: '6px',
                              fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)',
                              fontFamily: 'SF Mono, Monaco, monospace', letterSpacing: '1px'
                            }}>
                              {match.home_score}-{match.away_score}
                            </span>
                            <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: '600', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {match.away_team?.name}
                            </span>
                          </div>
                          {/* Predictions side by side */}
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <div style={{
                              flex: 1, textAlign: 'center', padding: '8px', borderRadius: '8px',
                              background: predA?.points_earned === 3 ? 'rgba(0,122,69,0.18)' : predA?.points_earned === 1 ? 'rgba(255,204,0,0.1)' : 'var(--bg-input)'
                            }}>
                              <div style={{ fontSize: '9px', color: 'var(--gold)', marginBottom: '3px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                                A
                              </div>
                              <div style={{
                                fontSize: '15px', fontWeight: '800',
                                fontFamily: 'SF Mono, Monaco, monospace', letterSpacing: '1px',
                                color: predA?.points_earned === 3 ? '#4ade80' : predA?.points_earned === 1 ? 'var(--gold)' : 'var(--text-muted)'
                              }}>
                                {predA ? `${predA.predicted_home}-${predA.predicted_away}` : '—'}
                              </div>
                              <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '3px', fontWeight: '600' }}>
                                {predA ? `+${predA.points_earned || 0}` : ''}
                              </div>
                            </div>
                            <div style={{
                              flex: 1, textAlign: 'center', padding: '8px', borderRadius: '8px',
                              background: predB?.points_earned === 3 ? 'rgba(0,122,69,0.18)' : predB?.points_earned === 1 ? 'rgba(255,204,0,0.1)' : 'var(--bg-input)'
                            }}>
                              <div style={{ fontSize: '9px', color: 'var(--green)', marginBottom: '3px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                                B
                              </div>
                              <div style={{
                                fontSize: '15px', fontWeight: '800',
                                fontFamily: 'SF Mono, Monaco, monospace', letterSpacing: '1px',
                                color: predB?.points_earned === 3 ? '#4ade80' : predB?.points_earned === 1 ? 'var(--gold)' : 'var(--text-muted)'
                              }}>
                                {predB ? `${predB.predicted_home}-${predB.predicted_away}` : '—'}
                              </div>
                              <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '3px', fontWeight: '600' }}>
                                {predB ? `+${predB.points_earned || 0}` : ''}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>

                {/* Pre-tournament bet comparison */}
                {bets.length > 0 && (h2hBetEntriesA.length > 0 || h2hBetEntriesB.length > 0) && (
                  <div style={{
                    background: 'var(--bg-secondary)', borderRadius: '12px',
                    padding: '14px 16px', marginBottom: '12px'
                  }}>
                    <div style={{
                      fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase',
                      letterSpacing: '1.2px', fontWeight: '700', marginBottom: '10px'
                    }}>
                      Predicciones pre-torneo
                    </div>
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
                        <div key={bet.id} style={{ padding: '10px 0', borderBottom: '0.5px solid var(--border-light)' }}>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', textAlign: 'center', fontWeight: '600' }}>
                            {bet.name || bet.question}
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <div style={{
                              flex: 1, textAlign: 'center', padding: '8px', borderRadius: '8px',
                              background: resolved && ptsA > ptsB ? 'rgba(0,122,69,0.15)' : 'var(--bg-input)'
                            }}>
                              <div style={{ fontSize: '9px', color: 'var(--gold)', marginBottom: '4px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.6px' }}>A</div>
                              <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {valA || '—'}
                              </div>
                              {resolved && <div style={{ fontSize: '10px', color: ptsA > 0 ? '#4ade80' : 'var(--text-dim)', marginTop: '3px', fontWeight: '700' }}>+{ptsA}</div>}
                            </div>
                            <div style={{
                              flex: 1, textAlign: 'center', padding: '8px', borderRadius: '8px',
                              background: resolved && ptsB > ptsA ? 'rgba(0,122,69,0.15)' : 'var(--bg-input)'
                            }}>
                              <div style={{ fontSize: '9px', color: 'var(--green)', marginBottom: '4px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.6px' }}>B</div>
                              <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {valB || '—'}
                              </div>
                              {resolved && <div style={{ fontSize: '10px', color: ptsB > 0 ? '#4ade80' : 'var(--text-dim)', marginTop: '3px', fontWeight: '700' }}>+{ptsB}</div>}
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
                padding: '32px 20px', textAlign: 'center', color: 'var(--text-muted)',
                fontSize: '13px', background: 'var(--bg-secondary)', borderRadius: '12px',
                fontWeight: '500'
              }}>
                Aun no hay datos en el leaderboard para estos usuarios.
              </div>
            )}

            {(!h2hUserA || !h2hUserB) && (
              <div style={{
                padding: '32px 20px', textAlign: 'center', color: 'var(--text-muted)',
                fontSize: '13px', background: 'var(--bg-secondary)', borderRadius: '12px',
                fontWeight: '500'
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
          (a.full_name || '').localeCompare(b.full_name || '')
        )

        const viewGroupMatches = displayMatches.filter(m => m.group_name === viewGroup)

        return (
          <div className="tab-fade-in">
            {!betsClosed ? (
              <div style={{
                background: 'var(--bg-secondary)', borderRadius: '12px',
                padding: '40px 20px', textAlign: 'center'
              }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔒</div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px', letterSpacing: '-0.1px' }}>
                  Disponible cuando cierre el plazo
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                  Podras ver las predicciones de todos los participantes una vez empiece el Mundial (11 junio 2026).
                </div>
              </div>
            ) : (
              <>
                {/* Section header */}
                <div style={{
                  fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase',
                  letterSpacing: '1.2px', fontWeight: '700', marginBottom: '10px'
                }}>
                  Ver predicciones de otros
                </div>

                <div style={{
                  background: 'var(--bg-secondary)', borderRadius: '12px',
                  padding: '14px 16px', marginBottom: '12px'
                }}>
                  <select
                    value={viewUser}
                    onChange={e => {
                      setViewUser(e.target.value)
                      if (e.target.value) fetchViewUser(e.target.value)
                    }}
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: '8px',
                      border: 'none', background: 'var(--bg-input)',
                      color: 'var(--text-primary)', fontSize: '13px', outline: 'none',
                      appearance: 'auto', fontWeight: '600'
                    }}
                  >
                    <option value="">Seleccionar participante...</option>
                    {sortedProfiles.map(p => (
                      <option key={p.id} value={p.id}>{p.full_name}</option>
                    ))}
                  </select>
                  {viewUser && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      marginTop: '12px', padding: '10px 12px',
                      background: 'var(--bg-input)', borderRadius: '20px',
                      border: '1px solid rgba(0,122,69,0.25)'
                    }}>
                      <Avatar
                        url={getProfileAvatar(viewUser)}
                        name={getProfileName(viewUser)}
                        size={32}
                        color="rgba(0,122,69,0.15)"
                        border="1px solid rgba(0,122,69,0.3)"
                        textColor="#4ade80"
                      />
                      <div style={{
                        fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        letterSpacing: '-0.1px', flex: 1
                      }}>
                        {getProfileName(viewUser)}
                      </div>
                      <span style={{
                        fontSize: '9px', color: 'var(--green)', fontWeight: '700',
                        textTransform: 'uppercase', letterSpacing: '0.8px',
                        padding: '3px 8px', background: 'rgba(0,122,69,0.15)', borderRadius: '20px'
                      }}>
                        Activo
                      </span>
                    </div>
                  )}
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
                          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px'
                        }}>
                          {[
                            { value: totalPts, label: 'Puntos', color: 'var(--text-primary)' },
                            { value: exacts, label: 'Exactos', color: 'var(--gold)' },
                            { value: signs, label: 'Signos', color: 'var(--green)' }
                          ].map((s, i) => (
                            <div key={i} style={{
                              background: 'var(--bg-secondary)', borderRadius: '12px',
                              padding: '14px 8px', textAlign: 'center'
                            }}>
                              <div style={{ fontSize: '22px', fontWeight: '800', color: s.color, lineHeight: 1, letterSpacing: '-0.4px' }}>{s.value}</div>
                              <div style={{
                                fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase',
                                letterSpacing: '1.2px', marginTop: '8px', fontWeight: '700'
                              }}>{s.label}</div>
                            </div>
                          ))}
                        </div>
                      )
                    })()}

                    {/* Match predictions */}
                    <div style={{
                      background: 'var(--bg-secondary)', borderRadius: '12px',
                      padding: '14px 16px', marginBottom: '12px'
                    }}>
                      <div style={{
                        fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase',
                        letterSpacing: '1.2px', fontWeight: '700', marginBottom: '12px'
                      }}>
                        Predicciones de partidos
                      </div>

                      {/* Group selector */}
                      <div className="group-tabs" style={{ marginBottom: '12px', gap: '6px' }}>
                        {groups.map(g => (
                          <button
                            key={g}
                            onClick={() => setViewGroup(g)}
                            style={{
                              padding: '6px 12px', borderRadius: '20px', border: 'none',
                              background: viewGroup === g ? 'var(--green)' : 'var(--bg-input)',
                              color: viewGroup === g ? '#fff' : 'var(--text-muted)',
                              cursor: 'pointer', fontSize: '12px', fontWeight: '700',
                              whiteSpace: 'nowrap', flexShrink: 0,
                              transition: 'all 0.2s ease'
                            }}
                          >{g}</button>
                        ))}
                      </div>

                      {viewGroupMatches.length === 0 ? (
                        <div style={{
                          padding: '16px', textAlign: 'center', color: 'var(--text-dim)',
                          fontSize: '12px', background: 'var(--bg-input)', borderRadius: '8px'
                        }}>
                          No hay partidos en el Grupo {viewGroup}
                        </div>
                      ) : (
                        viewGroupMatches.map(match => {
                          const pred = viewPredictions.find(p => p.match_id === match.id)
                          const isFinished = match.status === 'finished'
                          return (
                            <div key={match.id} style={{
                              padding: '12px 0', borderBottom: '0.5px solid var(--border-light)'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: isFinished && pred ? '6px' : 0 }}>
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end', minWidth: 0 }}>
                                  <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {match.home_team?.name}
                                  </span>
                                  {match.home_team?.flag_url && <img src={match.home_team.flag_url} alt="" style={{ width: '20px', height: '14px', borderRadius: '2px', objectFit: 'cover', flexShrink: 0 }} />}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', minWidth: '68px' }}>
                                  {isFinished ? (
                                    <span style={{
                                      fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)',
                                      fontFamily: 'SF Mono, Monaco, monospace', letterSpacing: '1px',
                                      padding: '2px 8px', background: 'var(--bg-input)', borderRadius: '4px'
                                    }}>
                                      {match.home_score}-{match.away_score}
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.8px' }}>vs</span>
                                  )}
                                  {pred ? (
                                    <span style={{
                                      fontSize: '12px', fontWeight: '800',
                                      padding: '2px 8px', borderRadius: '4px',
                                      fontFamily: 'SF Mono, Monaco, monospace', letterSpacing: '1px',
                                      background: isFinished ? (pred.points_earned === 3 ? 'rgba(0,122,69,0.18)' : pred.points_earned === 1 ? 'rgba(255,204,0,0.1)' : 'var(--bg-input)') : 'var(--bg-input)',
                                      color: isFinished ? (pred.points_earned === 3 ? '#4ade80' : pred.points_earned === 1 ? 'var(--gold)' : 'var(--text-dim)') : 'var(--text-primary)'
                                    }}>
                                      {pred.predicted_home}-{pred.predicted_away}
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>—</span>
                                  )}
                                </div>
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                                  {match.away_team?.flag_url && <img src={match.away_team.flag_url} alt="" style={{ width: '20px', height: '14px', borderRadius: '2px', objectFit: 'cover', flexShrink: 0 }} />}
                                  <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {match.away_team?.name}
                                  </span>
                                </div>
                              </div>
                              {isFinished && pred && (
                                <div style={{ textAlign: 'center' }}>
                                  <span style={{
                                    fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px',
                                    color: pred.points_earned === 3 ? '#4ade80' : pred.points_earned === 1 ? 'var(--gold)' : 'var(--text-dim)'
                                  }}>
                                    {pred.points_earned === 3 ? 'Exacto · +3' : pred.points_earned === 1 ? 'Signo · +1' : 'Fallo · 0'}
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
                      <div style={{
                        background: 'var(--bg-secondary)', borderRadius: '12px',
                        padding: '14px 16px', marginBottom: '12px'
                      }}>
                        <div style={{
                          fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase',
                          letterSpacing: '1.2px', fontWeight: '700', marginBottom: '10px'
                        }}>
                          Predicciones pre-torneo
                        </div>
                        {bets.map(bet => {
                          const entry = viewBetEntries.find(e => e.bet_id === bet.id)
                          if (!entry) return null
                          const resolved = entry.is_resolved
                          return (
                            <div key={bet.id} style={{
                              padding: '10px 0', borderBottom: '0.5px solid var(--border-light)'
                            }}>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '600' }}>
                                {bet.name || bet.question}
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                                <span style={{
                                  fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)',
                                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                                  letterSpacing: '-0.1px'
                                }}>
                                  {formatBetValue(entry.value, bet.input_type)}
                                </span>
                                {resolved && (
                                  <span style={{
                                    fontSize: '10px', fontWeight: '700', padding: '3px 9px', borderRadius: '20px',
                                    textTransform: 'uppercase', letterSpacing: '0.6px',
                                    background: (entry.points_awarded || 0) > 0 ? 'rgba(0,122,69,0.18)' : 'var(--bg-input)',
                                    color: (entry.points_awarded || 0) > 0 ? '#4ade80' : 'var(--text-dim)'
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

                  </>
                )}

                {!viewUser && (
                  <div style={{
                    padding: '32px 20px', textAlign: 'center', color: 'var(--text-muted)',
                    fontSize: '13px', background: 'var(--bg-secondary)', borderRadius: '12px',
                    fontWeight: '500'
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
