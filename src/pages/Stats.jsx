import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useCountdown, PREDICTIONS_DEADLINE } from '../hooks/useCountdown'

export default function Stats() {
  const [matches, setMatches] = useState([])
  const [allPredictions, setAllPredictions] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeGroup, setActiveGroup] = useState('A')
  const [totalUsers, setTotalUsers] = useState(0)
  const [activeTab, setActiveTab] = useState('matches') // 'matches' | 'bets'
  const [bets, setBets] = useState([])
  const [betEntries, setBetEntries] = useState([])
  const [activeBetCategory, setActiveBetCategory] = useState('all')
  const deadline = useCountdown(PREDICTIONS_DEADLINE)

  const groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']
  const betCategories = [
    { key: 'all', label: 'Todas' },
    { key: 'podium', label: '🏆 Podio' },
    { key: 'players', label: '⚽ Jugadores' },
    { key: 'teams', label: '🌍 Equipos' },
    { key: 'stats', label: '📊 Estadísticas' },
    { key: 'yesno', label: '✅ Sí/No' }
  ]

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    // All group matches with teams
    const { data: matchesData } = await supabase
      .from('matches')
      .select('*, home_team:teams!matches_home_team_id_fkey(name, flag_url), away_team:teams!matches_away_team_id_fkey(name, flag_url)')
      .eq('stage', 'group')
      .order('match_date', { ascending: true })

    // All predictions (anonymous)
    const { data: predsData } = await supabase
      .from('predictions')
      .select('match_id, predicted_home, predicted_away')

    // Total users count
    const { count } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })

    // Pre-tournament bets
    const { data: betsData } = await supabase
      .from('pre_tournament_bets')
      .select('*')
      .order('id', { ascending: true })

    // Pre-tournament entries (just answers, no user info)
    const { data: entriesData } = await supabase
      .from('pre_tournament_entries')
      .select('bet_id, answer')

    setMatches(matchesData || [])
    setAllPredictions(predsData || [])
    setTotalUsers(count || 0)
    setBets(betsData || [])
    setBetEntries(entriesData || [])
    setLoading(false)
  }

  function getMatchConsensus(matchId) {
    const preds = allPredictions.filter(p => p.match_id === matchId)
    if (preds.length === 0) return null

    let homeWins = 0, draws = 0, awayWins = 0
    const resultCounts = {}

    preds.forEach(p => {
      const h = p.predicted_home
      const a = p.predicted_away
      if (h > a) homeWins++
      else if (h === a) draws++
      else awayWins++

      const key = `${h}-${a}`
      resultCounts[key] = (resultCounts[key] || 0) + 1
    })

    const total = preds.length
    let topResult = null
    let topCount = 0
    Object.entries(resultCounts).forEach(([result, count]) => {
      if (count > topCount) {
        topResult = result
        topCount = count
      }
    })

    return {
      total,
      homeWins, draws, awayWins,
      homePct: Math.round((homeWins / total) * 100),
      drawPct: Math.round((draws / total) * 100),
      awayPct: Math.round((awayWins / total) * 100),
      topResult,
      topResultPct: Math.round((topCount / total) * 100),
      topResultCount: topCount
    }
  }

  function getBetStats(betId) {
    const entries = betEntries.filter(e => e.bet_id === betId)
    if (entries.length === 0) return { total: 0, topAnswers: [] }

    const counts = {}
    entries.forEach(e => {
      const answer = e.answer || '?'
      counts[answer] = (counts[answer] || 0) + 1
    })

    const sorted = Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([answer, count]) => ({
        answer,
        count,
        pct: Math.round((count / entries.length) * 100)
      }))

    return { total: entries.length, topAnswers: sorted }
  }

  function formatDate(dateStr) {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleDateString('es-ES', {
      weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
        Cargando stats...
      </div>
    )
  }

  const groupMatches = matches.filter(m => m.group_name === activeGroup)
  const totalPredictions = allPredictions.length
  const matchesWithPreds = new Set(allPredictions.map(p => p.match_id)).size
  const avgPerMatch = matchesWithPreds > 0 ? Math.round(totalPredictions / matchesWithPreds) : 0

  const filteredBets = activeBetCategory === 'all'
    ? bets
    : bets.filter(b => b.category === activeBetCategory)

  // Are pre-tournament bets still open?
  const betsLocked = !deadline.expired

  function countGroupPreds(group) {
    const gMatchIds = matches.filter(m => m.group_name === group).map(m => m.id)
    return allPredictions.filter(p => gMatchIds.includes(p.match_id)).length
  }

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', padding: '16px', minHeight: '100svh' }}>

      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{
          fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)',
          margin: '0 0 4px', letterSpacing: '0.3px'
        }}>
          Stats de la Porra
        </h2>
        <p style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
          Cómo ha apostado el grupo
        </p>
      </div>

      {/* Global stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '16px' }}>
        <div style={{
          background: 'var(--bg-secondary)', borderRadius: '8px', padding: '12px',
          border: '0.5px solid var(--border)', textAlign: 'center'
        }}>
          <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)' }}>
            {totalUsers}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '2px' }}>
            Jugadores
          </div>
        </div>
        <div style={{
          background: 'var(--bg-secondary)', borderRadius: '8px', padding: '12px',
          border: '0.5px solid var(--border)', textAlign: 'center'
        }}>
          <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--gold)' }}>
            {totalPredictions}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '2px' }}>
            Predicciones
          </div>
        </div>
        <div style={{
          background: 'var(--bg-secondary)', borderRadius: '8px', padding: '12px',
          border: '0.5px solid var(--border)', textAlign: 'center'
        }}>
          <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--green)' }}>
            {betEntries.length}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '2px' }}>
            Apuestas
          </div>
        </div>
      </div>

      {/* Tab switcher: Partidos / Apuestas Pre-Torneo */}
      <div style={{
        display: 'flex', gap: '4px', marginBottom: '16px',
        padding: '3px', background: 'var(--bg-input)', borderRadius: '6px'
      }}>
        <button
          onClick={() => setActiveTab('matches')}
          style={{
            flex: 1, padding: '8px 12px', borderRadius: '4px', border: 'none',
            background: activeTab === 'matches' ? 'var(--bg-secondary)' : 'transparent',
            color: activeTab === 'matches' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontSize: '12px', fontWeight: activeTab === 'matches' ? '600' : '400', cursor: 'pointer'
          }}
        >
          ⚽ Partidos
        </button>
        <button
          onClick={() => setActiveTab('bets')}
          style={{
            flex: 1, padding: '8px 12px', borderRadius: '4px', border: 'none',
            background: activeTab === 'bets' ? 'var(--bg-secondary)' : 'transparent',
            color: activeTab === 'bets' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontSize: '12px', fontWeight: activeTab === 'bets' ? '600' : '400', cursor: 'pointer'
          }}
        >
          🏆 Apuestas Pre-Torneo
        </button>
      </div>

      {/* ========== MATCHES TAB ========== */}
      {activeTab === 'matches' && (
        <>
          {/* Group selector */}
          <div className="group-tabs" style={{ marginBottom: '14px' }}>
            {groups.map(g => {
              const isActive = activeGroup === g
              const hasPreds = countGroupPreds(g) > 0
              return (
                <button
                  key={g}
                  onClick={() => setActiveGroup(g)}
                  style={{
                    padding: '6px 14px', borderRadius: '4px', border: 'none',
                    background: isActive ? 'var(--green)' : hasPreds ? 'var(--green-light)' : 'var(--bg-secondary)',
                    color: isActive ? '#fff' : hasPreds ? 'var(--green)' : 'var(--text-muted)',
                    cursor: 'pointer', fontSize: '12px', fontWeight: isActive ? '600' : '400',
                    whiteSpace: 'nowrap', flexShrink: 0
                  }}
                >
                  {g}
                </button>
              )
            })}
          </div>

          {/* Match consensus cards */}
          {groupMatches.map(match => {
            const consensus = getMatchConsensus(match.id)

            return (
              <div key={match.id} style={{
                background: 'var(--bg-secondary)',
                borderRadius: '8px',
                padding: '14px 16px',
                marginBottom: '10px',
                border: '0.5px solid var(--border)'
              }}>
                {/* Date */}
                <div style={{
                  fontSize: '10px', color: 'var(--text-dim)', marginBottom: '10px', textAlign: 'center'
                }}>
                  {formatDate(match.match_date)}
                </div>

                {/* Teams */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '14px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, justifyContent: 'flex-end' }}>
                    <span style={{
                      fontSize: '13px', color: 'var(--text-primary)', fontWeight: '500',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>
                      {match.home_team?.name || 'TBD'}
                    </span>
                    {match.home_team?.flag_url && (
                      <img src={match.home_team.flag_url} alt="" style={{
                        width: '22px', height: '15px', borderRadius: '2px', objectFit: 'cover', flexShrink: 0
                      }} />
                    )}
                  </div>
                  <span style={{
                    fontSize: '11px', color: 'var(--text-dim)', fontWeight: '600',
                    padding: '2px 8px', background: 'var(--bg-input)', borderRadius: '3px'
                  }}>
                    vs
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                    {match.away_team?.flag_url && (
                      <img src={match.away_team.flag_url} alt="" style={{
                        width: '22px', height: '15px', borderRadius: '2px', objectFit: 'cover', flexShrink: 0
                      }} />
                    )}
                    <span style={{
                      fontSize: '13px', color: 'var(--text-primary)', fontWeight: '500',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>
                      {match.away_team?.name || 'TBD'}
                    </span>
                  </div>
                </div>

                {/* Actual result if finished */}
                {match.status === 'finished' && (
                  <div style={{
                    textAlign: 'center', marginBottom: '14px',
                    padding: '6px', background: 'var(--green-light)', borderRadius: '4px'
                  }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Resultado final
                    </span>
                    <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--green)', marginTop: '2px' }}>
                      {match.home_score} — {match.away_score}
                    </div>
                  </div>
                )}

                {/* Consensus */}
                {consensus ? (
                  <>
                    {/* 1X2 Bar */}
                    <div style={{ marginBottom: '10px' }}>
                      <div style={{
                        display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '10px', color: 'var(--text-dim)'
                      }}>
                        <span>Local</span>
                        <span>Empate</span>
                        <span>Visitante</span>
                      </div>

                      <div style={{
                        display: 'flex', height: '28px', borderRadius: '4px', overflow: 'hidden'
                      }}>
                        {consensus.homePct > 0 && (
                          <div style={{
                            width: `${consensus.homePct}%`, background: '#007a45',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '11px', fontWeight: '700', color: '#fff',
                            minWidth: consensus.homePct > 10 ? 'auto' : '28px',
                            transition: 'width 0.4s ease'
                          }}>
                            {consensus.homePct}%
                          </div>
                        )}
                        {consensus.drawPct > 0 && (
                          <div style={{
                            width: `${consensus.drawPct}%`, background: '#4a4f5e',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '11px', fontWeight: '700', color: '#fff',
                            minWidth: consensus.drawPct > 10 ? 'auto' : '28px',
                            transition: 'width 0.4s ease'
                          }}>
                            {consensus.drawPct}%
                          </div>
                        )}
                        {consensus.awayPct > 0 && (
                          <div style={{
                            width: `${consensus.awayPct}%`, background: '#ffcc00',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '11px', fontWeight: '700', color: '#1a1d26',
                            minWidth: consensus.awayPct > 10 ? 'auto' : '28px',
                            transition: 'width 0.4s ease'
                          }}>
                            {consensus.awayPct}%
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Popular result + count */}
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}>
                      <div>
                        <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>Pronóstico favorito</span>
                        <div style={{
                          fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', marginTop: '2px'
                        }}>
                          {consensus.topResult}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>Apostaron</span>
                        <div style={{
                          fontSize: '14px', fontWeight: '600', color: 'var(--gold)', marginTop: '2px'
                        }}>
                          {consensus.topResultCount}<span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>/{consensus.total}</span>
                          <span style={{ fontSize: '10px', color: 'var(--text-dim)', marginLeft: '4px' }}>({consensus.topResultPct}%)</span>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{
                    padding: '16px', textAlign: 'center', color: 'var(--text-dim)',
                    fontSize: '12px', background: 'var(--bg-input)', borderRadius: '6px'
                  }}>
                    Sin predicciones aún
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}

      {/* ========== BETS TAB ========== */}
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
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Bet stats cards */}
          {filteredBets.map(bet => {
            const stats = getBetStats(bet.id)

            return (
              <div key={bet.id} style={{
                background: 'var(--bg-secondary)',
                borderRadius: '8px',
                padding: '14px 16px',
                marginBottom: '10px',
                border: '0.5px solid var(--border)',
                position: 'relative',
                overflow: 'hidden'
              }}>
                {/* Header */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px'
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '2px' }}>
                      {bet.question}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
                      Máx. {bet.max_points} pts
                    </div>
                  </div>
                  <div style={{
                    padding: '3px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '600',
                    background: 'var(--green-light)', color: 'var(--green)', flexShrink: 0, marginLeft: '8px'
                  }}>
                    {stats.total} resp.
                  </div>
                </div>

                {/* Answers breakdown — blurred if bets still open */}
                <div style={{ position: 'relative' }}>
                  {betsLocked && (
                    <div style={{
                      position: 'absolute', inset: 0, zIndex: 2,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      background: 'rgba(26,29,38,0.7)',
                      backdropFilter: 'blur(6px)',
                      WebkitBackdropFilter: 'blur(6px)',
                      borderRadius: '6px'
                    }}>
                      <span style={{ fontSize: '24px', marginBottom: '4px' }}>🔒</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '500' }}>
                        Visible al cerrar las apuestas
                      </span>
                    </div>
                  )}

                  {/* Bars (always rendered, blurred when locked) */}
                  <div style={{
                    display: 'flex', flexDirection: 'column', gap: '6px',
                    filter: betsLocked ? 'blur(4px)' : 'none',
                    minHeight: '60px'
                  }}>
                    {stats.topAnswers.length > 0 ? (
                      stats.topAnswers.map((a, i) => (
                        <div key={i}>
                          <div style={{
                            display: 'flex', justifyContent: 'space-between', marginBottom: '3px'
                          }}>
                            <span style={{
                              fontSize: '12px', color: 'var(--text-primary)',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%'
                            }}>
                              {a.answer}
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                              {a.count} ({a.pct}%)
                            </span>
                          </div>
                          <div style={{
                            height: '6px', background: 'var(--bg-input)', borderRadius: '3px', overflow: 'hidden'
                          }}>
                            <div style={{
                              height: '100%',
                              width: `${a.pct}%`,
                              background: i === 0 ? 'var(--gold)' : 'var(--green)',
                              borderRadius: '3px',
                              transition: 'width 0.4s ease'
                            }} />
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{
                        padding: '12px', textAlign: 'center', color: 'var(--text-dim)',
                        fontSize: '11px'
                      }}>
                        Sin respuestas aún
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
