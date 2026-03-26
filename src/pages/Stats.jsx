import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'

export default function Stats() {
  const [matches, setMatches] = useState([])
  const [allPredictions, setAllPredictions] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeGroup, setActiveGroup] = useState('A')
  const [totalUsers, setTotalUsers] = useState(0)
  const [activeTab, setActiveTab] = useState('overview') // 'overview' | 'matches' | 'bets'
  const [bets, setBets] = useState([])
  const [betEntries, setBetEntries] = useState([])
  const [activeBetCategory, setActiveBetCategory] = useState('all')
  const [leaderboard, setLeaderboard] = useState([])

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
    const [matchesRes, predsRes, countRes, betsRes, entriesRes, lbRes] = await Promise.all([
      supabase.from('matches')
        .select('*, home_team:teams!matches_home_team_id_fkey(name, flag_url), away_team:teams!matches_away_team_id_fkey(name, flag_url)')
        .eq('stage', 'group').order('match_date', { ascending: true }),
      supabase.from('predictions').select('match_id, predicted_home, predicted_away'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('pre_tournament_bets').select('*').order('id', { ascending: true }),
      supabase.from('pre_tournament_entries').select('bet_id, answer'),
      supabase.from('leaderboard').select('*')
    ])

    setMatches(matchesRes.data || [])
    setAllPredictions(predsRes.data || [])
    setTotalUsers(countRes.count || 0)
    setBets(betsRes.data || [])
    setBetEntries(entriesRes.data || [])
    setLeaderboard(lbRes.data || [])
    setLoading(false)
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
    const counts = {}
    entries.forEach(e => { const a = e.answer || '?'; counts[a] = (counts[a] || 0) + 1 })
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

  const finishedMatches = matches.filter(m => m.status === 'finished')
  const totalMatches = matches.length
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
  const BOT365_ID = 'b0365b03-65b0-365b-0365-b0365b036500'
  const lbSorted = [...leaderboard].filter(u => u.user_id !== BOT365_ID).sort((a, b) => b.total_points - a.total_points)
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
      <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
        Cargando stats...
      </div>
    )
  }

  const groupMatches = matches.filter(m => m.group_name === activeGroup)
  const filteredBets = activeBetCategory === 'all' ? bets : bets.filter(b => b.category === activeBetCategory)

  // ========== STAT CARD COMPONENT ==========
  const StatCard = ({ value, label, color, sub }) => (
    <div style={{
      background: 'var(--bg-secondary)', borderRadius: '10px', padding: '16px 12px',
      border: '0.5px solid var(--border)', textAlign: 'center', position: 'relative', overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
        background: color || 'var(--green)'
      }} />
      <div style={{ fontSize: '28px', fontWeight: '800', color: color || 'var(--text-primary)', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{
        fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase',
        letterSpacing: '0.8px', marginTop: '6px', fontWeight: '600'
      }}>
        {label}
      </div>
      {sub && (
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
          {sub}
        </div>
      )}
    </div>
  )

  // ========== RENDER ==========
  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', padding: '16px', minHeight: '100svh' }}>

      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{
          fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)',
          margin: '0 0 4px', letterSpacing: '0.3px'
        }}>
          Stats del Mundial
        </h2>
        <p style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
          {finishedMatches.length} de {totalMatches} partidos jugados
        </p>
      </div>

      {/* Progress bar — tournament progress */}
      <div style={{
        background: 'var(--bg-input)', borderRadius: '6px', height: '8px',
        marginBottom: '18px', overflow: 'hidden'
      }}>
        <div style={{
          height: '100%', borderRadius: '6px',
          background: 'linear-gradient(90deg, var(--green), var(--gold))',
          width: `${totalMatches > 0 ? (finishedMatches.length / totalMatches) * 100 : 0}%`,
          transition: 'width 0.6s ease'
        }} />
      </div>

      {/* 3-Tab switcher */}
      <div style={{
        display: 'flex', gap: '4px', marginBottom: '18px',
        padding: '3px', background: 'var(--bg-input)', borderRadius: '8px'
      }}>
        {[
          { key: 'overview', label: '📊 Resumen' },
          { key: 'matches', label: '⚽ Partidos' },
          { key: 'bets', label: '🎯 Apuestas' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1, padding: '9px 8px', borderRadius: '6px', border: 'none',
              background: activeTab === tab.key ? 'var(--bg-secondary)' : 'transparent',
              color: activeTab === tab.key ? 'var(--text-primary)' : 'var(--text-muted)',
              fontSize: '12px', fontWeight: activeTab === tab.key ? '600' : '400', cursor: 'pointer'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ==================== OVERVIEW TAB ==================== */}
      {activeTab === 'overview' && (
        <>
          {/* Big stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '18px' }}>
            <StatCard value={totalUsers} label="Participantes" color="var(--text-primary)" />
            <StatCard value={`${accuracyRate}%`} label="Tasa de acierto" color="var(--green)" sub={`${totalExacts} exactos · ${totalSigns} signos`} />
            <StatCard value={totalPredictions.toLocaleString()} label="Predicciones" color="var(--gold)" />
            <StatCard value={`${avgPoints} pts`} label="Media por jugador" color="var(--text-primary)" sub={`Líder: ${lbSorted[0]?.total_points || 0} pts`} />
          </div>

          {/* 1X2 Global — Donut chart */}
          <div style={{
            background: 'var(--bg-secondary)', borderRadius: '10px', padding: '18px',
            border: '0.5px solid var(--border)', marginBottom: '14px'
          }}>
            <div style={{
              fontSize: '11px', color: 'var(--gold)', textTransform: 'uppercase',
              letterSpacing: '1px', fontWeight: '700', marginBottom: '14px'
            }}>
              Tendencia global 1X2
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <ResponsiveContainer width={120} height={120}>
                <PieChart>
                  <Pie
                    data={global1X2}
                    cx="50%" cy="50%"
                    innerRadius={32} outerRadius={55}
                    paddingAngle={3}
                    dataKey="value"
                    startAngle={90} endAngle={-270}
                  >
                    {global1X2.map((entry, i) => (
                      <Cell key={i} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {global1X2.map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '10px', height: '10px', borderRadius: '50%', background: item.color, flexShrink: 0
                    }} />
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', flex: 1 }}>{item.name}</span>
                    <span style={{ fontSize: '16px', fontWeight: '700', color: item.color }}>{item.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top predicted results */}
          <div style={{
            background: 'var(--bg-secondary)', borderRadius: '10px', padding: '18px',
            border: '0.5px solid var(--border)', marginBottom: '14px'
          }}>
            <div style={{
              fontSize: '11px', color: 'var(--gold)', textTransform: 'uppercase',
              letterSpacing: '1px', fontWeight: '700', marginBottom: '14px'
            }}>
              Resultados más predichos
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {topResults.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '40px', fontSize: '16px', fontWeight: '800',
                    color: i === 0 ? 'var(--gold)' : 'var(--text-primary)', textAlign: 'center'
                  }}>
                    {r.result}
                  </div>
                  <div style={{ flex: 1, height: '20px', background: 'var(--bg-input)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: '4px',
                      background: i === 0 ? 'linear-gradient(90deg, var(--gold), rgba(255,204,0,0.4))' : 'var(--green)',
                      width: `${(r.count / (topResults[0]?.count || 1)) * 100}%`,
                      transition: 'width 0.5s ease'
                    }} />
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', width: '50px', textAlign: 'right' }}>
                    {r.count} <span style={{ fontSize: '10px' }}>({r.pct}%)</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Goals by group — horizontal bar chart */}
          <div style={{
            background: 'var(--bg-secondary)', borderRadius: '10px', padding: '18px',
            border: '0.5px solid var(--border)', marginBottom: '14px'
          }}>
            <div style={{
              fontSize: '11px', color: 'var(--gold)', textTransform: 'uppercase',
              letterSpacing: '1px', fontWeight: '700', marginBottom: '14px'
            }}>
              Goles predichos por grupo
            </div>
            <ResponsiveContainer width="100%" height={groupGoals.length * 28 + 10}>
              <BarChart
                data={groupGoals.slice(0, 8)}
                layout="vertical"
                margin={{ top: 0, right: 30, left: 0, bottom: 0 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category" dataKey="group" width={42}
                  tick={{ fill: '#6b7080', fontSize: 11 }}
                  axisLine={false} tickLine={false}
                />
                <Tooltip
                  contentStyle={{ background: '#22252f', border: '1px solid #2a2d38', borderRadius: '6px', fontSize: '12px' }}
                  formatter={(value) => [`${value} goles`, 'Total']}
                />
                <Bar dataKey="goals" radius={[0, 4, 4, 0]} barSize={16}>
                  {groupGoals.slice(0, 8).map((entry, i) => (
                    <Cell key={i} fill={i === 0 ? '#ffcc00' : i === 1 ? '#007a45' : '#2a4a3a'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Leaderboard top 5 — accuracy breakdown */}
          <div style={{
            background: 'var(--bg-secondary)', borderRadius: '10px', padding: '18px',
            border: '0.5px solid var(--border)', marginBottom: '14px'
          }}>
            <div style={{
              fontSize: '11px', color: 'var(--gold)', textTransform: 'uppercase',
              letterSpacing: '1px', fontWeight: '700', marginBottom: '14px'
            }}>
              Top 5 — Desglose de puntos
            </div>
            {lbSorted.slice(0, 5).map((user, i) => {
              const total = (user.exact_hits || 0) + (user.sign_hits || 0) + (user.misses || 0)
              const exactPct = total > 0 ? ((user.exact_hits || 0) / total) * 100 : 0
              const signPct = total > 0 ? ((user.sign_hits || 0) / total) * 100 : 0
              return (
                <div key={user.user_id} style={{ marginBottom: i < 4 ? '12px' : 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: '500' }}>
                      <span style={{
                        color: i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : 'var(--text-dim)',
                        fontWeight: '700', marginRight: '6px', fontSize: '11px'
                      }}>
                        {i + 1}.
                      </span>
                      {user.full_name}
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: i === 0 ? 'var(--gold)' : 'var(--text-primary)' }}>
                      {user.total_points} pts
                    </span>
                  </div>
                  <div style={{ display: 'flex', height: '6px', borderRadius: '3px', overflow: 'hidden', background: 'var(--bg-input)' }}>
                    <div style={{ width: `${exactPct}%`, background: 'var(--gold)', transition: 'width 0.4s' }} />
                    <div style={{ width: `${signPct}%`, background: 'var(--green)', transition: 'width 0.4s' }} />
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
        </>
      )}

      {/* ==================== MATCHES TAB ==================== */}
      {activeTab === 'matches' && (
        <>
          {/* Group selector */}
          <div className="group-tabs" style={{ marginBottom: '14px' }}>
            {groups.map(g => {
              const groupMs = matches.filter(m => m.group_name === g)
              const finished = groupMs.filter(m => m.status === 'finished').length
              return (
                <button
                  key={g}
                  onClick={() => setActiveGroup(g)}
                  style={{
                    padding: '6px 14px', borderRadius: '4px', border: 'none',
                    background: activeGroup === g ? 'var(--green)' : finished > 0 ? 'var(--green-light)' : 'var(--bg-secondary)',
                    color: activeGroup === g ? '#fff' : finished > 0 ? 'var(--green)' : 'var(--text-muted)',
                    cursor: 'pointer', fontSize: '12px', fontWeight: activeGroup === g ? '600' : '400',
                    whiteSpace: 'nowrap', flexShrink: 0, position: 'relative'
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
                background: 'var(--bg-secondary)', borderRadius: '10px', padding: '14px 16px',
                marginBottom: '10px', border: `0.5px solid ${isFinished ? 'var(--green)' : 'var(--border)'}`,
                borderLeft: isFinished ? '3px solid var(--green)' : '3px solid transparent'
              }}>
                <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginBottom: '10px', textAlign: 'center' }}>
                  {formatDate(match.match_date)}
                </div>

                {/* Teams row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, justifyContent: 'flex-end' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {match.home_team?.name || 'TBD'}
                    </span>
                    {match.home_team?.flag_url && <img src={match.home_team.flag_url} alt="" style={{ width: '22px', height: '15px', borderRadius: '2px', objectFit: 'cover', flexShrink: 0 }} />}
                  </div>

                  {isFinished ? (
                    <div style={{
                      padding: '4px 12px', background: 'var(--green-light)', borderRadius: '6px',
                      fontSize: '18px', fontWeight: '800', color: 'var(--green)', letterSpacing: '2px'
                    }}>
                      {match.home_score} — {match.away_score}
                    </div>
                  ) : (
                    <span style={{
                      fontSize: '11px', color: 'var(--text-dim)', fontWeight: '600',
                      padding: '4px 10px', background: 'var(--bg-input)', borderRadius: '4px'
                    }}>vs</span>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                    {match.away_team?.flag_url && <img src={match.away_team.flag_url} alt="" style={{ width: '22px', height: '15px', borderRadius: '2px', objectFit: 'cover', flexShrink: 0 }} />}
                    <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {match.away_team?.name || 'TBD'}
                    </span>
                  </div>
                </div>

                {/* Consensus */}
                {consensus ? (
                  <>
                    <div style={{ fontSize: '10px', color: 'var(--text-dim)', textAlign: 'center', marginBottom: '8px' }}>
                      {consensus.total} predicciones
                    </div>

                    {/* 1X2 Bar */}
                    <div style={{ display: 'flex', height: '26px', borderRadius: '5px', overflow: 'hidden', marginBottom: '10px' }}>
                      {consensus.homePct > 0 && (
                        <div style={{
                          width: `${consensus.homePct}%`, background: '#007a45',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '10px', fontWeight: '700', color: '#fff',
                          minWidth: consensus.homePct > 8 ? 'auto' : '24px'
                        }}>{consensus.homePct}%</div>
                      )}
                      {consensus.drawPct > 0 && (
                        <div style={{
                          width: `${consensus.drawPct}%`, background: '#4a4f5e',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '10px', fontWeight: '700', color: '#fff',
                          minWidth: consensus.drawPct > 8 ? 'auto' : '24px'
                        }}>{consensus.drawPct}%</div>
                      )}
                      {consensus.awayPct > 0 && (
                        <div style={{
                          width: `${consensus.awayPct}%`, background: '#ffcc00',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '10px', fontWeight: '700', color: '#1a1d26',
                          minWidth: consensus.awayPct > 8 ? 'auto' : '24px'
                        }}>{consensus.awayPct}%</div>
                      )}
                    </div>

                    {/* Favorite result */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>Pronóstico favorito</span>
                        <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', marginTop: '2px' }}>
                          {consensus.topResult}
                        </div>
                      </div>
                      <div style={{
                        padding: '4px 10px', background: 'var(--gold-dim)', borderRadius: '4px'
                      }}>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--gold)' }}>
                          {consensus.topResultPct}%
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{
                    padding: '12px', textAlign: 'center', color: 'var(--text-dim)',
                    fontSize: '11px', background: 'var(--bg-input)', borderRadius: '6px'
                  }}>
                    Sin predicciones aún
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}

      {/* ==================== BETS TAB ==================== */}
      {activeTab === 'bets' && (
        <>
          {/* Category filter */}
          <div className="group-tabs" style={{ marginBottom: '14px' }}>
            {betCategories.map(cat => (
              <button
                key={cat.key}
                onClick={() => setActiveBetCategory(cat.key)}
                style={{
                  padding: '6px 12px', borderRadius: '4px', border: 'none',
                  background: activeBetCategory === cat.key ? 'var(--green)' : 'var(--bg-secondary)',
                  color: activeBetCategory === cat.key ? '#fff' : 'var(--text-muted)',
                  cursor: 'pointer', fontSize: '11px', fontWeight: activeBetCategory === cat.key ? '600' : '400',
                  whiteSpace: 'nowrap', flexShrink: 0
                }}
              >{cat.label}</button>
            ))}
          </div>

          {/* Bet cards */}
          {filteredBets.map(bet => {
            const stats = getBetStats(bet.id)
            return (
              <div key={bet.id} style={{
                background: 'var(--bg-secondary)', borderRadius: '10px', padding: '16px',
                marginBottom: '10px', border: '0.5px solid var(--border)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '3px' }}>
                      {bet.question}
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
        </>
      )}
    </div>
  )
}
