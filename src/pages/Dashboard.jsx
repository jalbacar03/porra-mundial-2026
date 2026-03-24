import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

export default function Dashboard({ session }) {
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [stats, setStats] = useState({ total: 0, completed: 0, points: 0, exactHits: 0, signHits: 0, rank: '-' })
  const [topRanking, setTopRanking] = useState([])
  const [groupProgress, setGroupProgress] = useState([])
  const [nextMatches, setNextMatches] = useState([])
  const [userPredictions, setUserPredictions] = useState({})
  const [paidCount, setPaidCount] = useState(0)
  const [totalUsers, setTotalUsers] = useState(0)
  const [dailyInsight, setDailyInsight] = useState(null)
  const [insightLoading, setInsightLoading] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAll()
    fetchInsight()
  }, [])

  async function fetchInsight() {
    setInsightLoading(true)
    try {
      const res = await fetch('/api/generate-insight')
      if (res.ok) {
        const data = await res.json()
        setDailyInsight(data.insight)
      }
    } catch (err) {
      // Silently fail — insight is optional
      console.warn('Insight not available:', err)
    }
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

    // All group matches
    const { data: allMatches } = await supabase
      .from('matches')
      .select('*, home_team:teams!matches_home_team_id_fkey(name, flag_url), away_team:teams!matches_away_team_id_fkey(name, flag_url)')
      .eq('stage', 'group')
      .order('match_date', { ascending: true })

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

    // Next 3 upcoming matches
    const now = new Date()
    const upcoming = allMatches?.filter(m => m.status !== 'finished' && new Date(m.match_date) > now).slice(0, 3) || []
    setNextMatches(upcoming)

    // Leaderboard
    const { data: rankings } = await supabase
      .from('leaderboard')
      .select('*')

    let rank = '-'
    let rankingsTotal = 0
    if (rankings) {
      rankingsTotal = rankings.length
      const idx = rankings.findIndex(r => r.user_id === session.user.id)
      if (idx !== -1) rank = idx + 1
      setTopRanking(rankings.slice(0, 5))
    }
    setTotalUsers(rankingsTotal)

    // Paid users for pot calculation
    const { count: paidUserCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('has_paid', true)
    setPaidCount(paidUserCount || 0)

    setStats({ total: totalMatches, completed, points, exactHits, signHits, rank })
    setLoading(false)
  }

  function formatDateShort(dateStr) {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  if (loading) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
        Cargando...
      </div>
    )
  }

  // Top 5 max points for bar scaling
  const maxPoints = topRanking.length > 0 ? Math.max(topRanking[0]?.total_points || 1, 1) : 1

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', padding: '16px', minHeight: '100svh' }}>

      {/* ===== POSITION CARD ===== */}
      <div style={{
        background: 'linear-gradient(135deg, #00392a, #005e3a)',
        borderRadius: '10px',
        padding: '18px 20px',
        marginBottom: '12px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute', top: '-25px', right: '-25px',
          width: '90px', height: '90px', borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.06)'
        }} />
        <div style={{
          position: 'absolute', top: '-50px', right: '-50px',
          width: '140px', height: '140px', borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.03)'
        }} />

        <div style={{
          fontSize: '10px', color: 'rgba(255,255,255,0.45)',
          textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: '4px'
        }}>
          Tu posición
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
          <span style={{ fontSize: '36px', fontWeight: '700', color: '#fff' }}>
            {stats.rank}
          </span>
          <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>
            de {totalUsers > 0 ? `${totalUsers} participantes` : '...'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '20px', marginTop: '12px' }}>
          <div>
            <span style={{ fontSize: '20px', fontWeight: '600', color: 'var(--gold)' }}>{stats.points}</span>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginLeft: '4px' }}>pts</span>
          </div>
        </div>
      </div>

      {/* ===== POT WIDGET ===== */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(255,204,0,0.10), rgba(255,204,0,0.03))',
        border: '1px solid rgba(255,204,0,0.18)',
        borderRadius: '10px',
        padding: '16px 20px',
        marginBottom: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div>
          <div style={{
            fontSize: '10px', color: 'var(--gold)', textTransform: 'uppercase',
            letterSpacing: '1px', fontWeight: '600', marginBottom: '4px'
          }}>
            💰 Bote acumulado
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            <span style={{ fontSize: '32px', fontWeight: '700', color: 'var(--gold)' }}>
              {paidCount * 25 * 0.8}€
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
              en premios
            </span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>
            {paidCount}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
            pagados
          </div>
        </div>
      </div>

      {/* ===== DAILY INSIGHT (Gemini) ===== */}
      {(dailyInsight || insightLoading) && (
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
            <span>✨</span> Crónica del día
          </div>

          {insightLoading ? (
            <div style={{
              padding: '12px', textAlign: 'center', color: 'var(--text-dim)',
              fontSize: '12px'
            }}>
              Generando crónica...
            </div>
          ) : (
            <div style={{
              fontSize: '13px', color: 'var(--text-secondary)',
              lineHeight: '1.7', whiteSpace: 'pre-line'
            }}>
              {dailyInsight}
            </div>
          )}
        </div>
      )}

      {/* ===== DAILY BET WIDGET (blurred) ===== */}
      <div style={{
        background: 'var(--bg-secondary)',
        borderRadius: '10px',
        padding: '16px 20px',
        marginBottom: '12px',
        border: '0.5px solid var(--border)',
        position: 'relative',
        overflow: 'hidden',
        minHeight: '80px'
      }}>
        {/* Blurred content behind */}
        <div style={{
          filter: 'blur(5px)',
          opacity: 0.4
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
              ¿Quién marcará el primer gol del día?
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ padding: '6px 14px', background: 'var(--green)', borderRadius: '4px', fontSize: '12px', color: '#fff' }}>Mbappé</div>
            <div style={{ padding: '6px 14px', background: 'var(--bg-input)', borderRadius: '4px', fontSize: '12px', color: 'var(--text-muted)' }}>Vini Jr</div>
            <div style={{ padding: '6px 14px', background: 'var(--bg-input)', borderRadius: '4px', fontSize: '12px', color: 'var(--text-muted)' }}>Haaland</div>
          </div>
        </div>

        {/* Overlay with lock */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(26,29,38,0.6)',
          backdropFilter: 'blur(2px)',
          WebkitBackdropFilter: 'blur(2px)',
          borderRadius: '10px'
        }}>
          <span style={{ fontSize: '20px', marginBottom: '4px' }}>🎲</span>
          <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--gold)' }}>
            Apuesta del día
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>
            Disponible durante el Mundial
          </span>
        </div>
      </div>

      {/* ===== ACTION BUTTONS ===== */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
        <button
          onClick={() => navigate('/predictions')}
          style={{
            flex: 1, padding: '14px',
            background: 'var(--green)', color: '#fff',
            border: 'none', borderRadius: '8px', cursor: 'pointer', textAlign: 'center'
          }}
        >
          <div style={{ fontSize: '14px', fontWeight: '600', letterSpacing: '0.3px' }}>Mis predicciones</div>
          <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '2px' }}>Partidos y apuestas</div>
        </button>
        <button
          onClick={() => navigate('/leaderboard')}
          style={{
            flex: 1, padding: '14px',
            background: 'var(--bg-secondary)', color: 'var(--text-primary)',
            border: '0.5px solid var(--border)', borderRadius: '8px', cursor: 'pointer', textAlign: 'center'
          }}
        >
          <div style={{ fontSize: '14px', fontWeight: '600' }}>Clasificación</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Ver ranking</div>
        </button>
      </div>

      {/* ===== NEXT MATCHES ===== */}
      {nextMatches.length > 0 && (
        <div style={{
          background: 'var(--bg-secondary)',
          borderRadius: '8px',
          padding: '14px 16px',
          marginBottom: '12px',
          border: '0.5px solid var(--border)'
        }}>
          <div style={{
            fontSize: '10px', color: 'var(--text-dim)',
            textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px'
          }}>
            Próximos partidos
          </div>

          {nextMatches.map((match, i) => {
            const hasPred = userPredictions[match.id]
            return (
              <div key={match.id} style={{
                display: 'flex', alignItems: 'center', padding: '8px 0',
                borderBottom: i < nextMatches.length - 1 ? '0.5px solid var(--border-light)' : 'none'
              }}>
                {/* Date */}
                <div style={{
                  width: '55px', flexShrink: 0,
                  fontSize: '10px', color: 'var(--text-dim)', lineHeight: '1.3'
                }}>
                  {formatDateShort(match.match_date)}
                </div>

                {/* Teams */}
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                  {match.home_team?.flag_url && (
                    <img src={match.home_team.flag_url} alt="" style={{
                      width: '16px', height: '11px', borderRadius: '1px', objectFit: 'cover', flexShrink: 0
                    }} />
                  )}
                  <span style={{
                    fontSize: '12px', color: 'var(--text-primary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                  }}>
                    {match.home_team?.name || 'TBD'}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--text-dim)', flexShrink: 0 }}>vs</span>
                  <span style={{
                    fontSize: '12px', color: 'var(--text-primary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                  }}>
                    {match.away_team?.name || 'TBD'}
                  </span>
                  {match.away_team?.flag_url && (
                    <img src={match.away_team.flag_url} alt="" style={{
                      width: '16px', height: '11px', borderRadius: '1px', objectFit: 'cover', flexShrink: 0
                    }} />
                  )}
                </div>

                {/* Prediction status */}
                <div style={{
                  fontSize: '9px', padding: '2px 8px', borderRadius: '3px', flexShrink: 0, marginLeft: '6px',
                  background: hasPred ? 'var(--green-light)' : 'rgba(255,204,0,0.08)',
                  color: hasPred ? 'var(--green)' : 'var(--gold)'
                }}>
                  {hasPred ? '✓' : '—'}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ===== TOP 5 RANKING (Visual bars) ===== */}
      {topRanking.length > 0 && (
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

          {topRanking.map((user, index) => {
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
              <div key={user.user_id} style={{ marginBottom: index < topRanking.length - 1 ? '8px' : 0 }}>
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
    </div>
  )
}
