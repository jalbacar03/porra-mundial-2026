import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { generateMockLeaderboard } from '../hooks/useDemoMode'
import { SkeletonDashboard } from '../components/Skeleton'
import PointsChart from '../components/PointsChart'
import { useNotifications } from '../hooks/useNotifications'

export default function Dashboard({ session, demoMode }) {
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [stats, setStats] = useState({ total: 0, completed: 0, points: 0, exactHits: 0, signHits: 0, rank: '-' })
  const [topRanking, setTopRanking] = useState([])
  const [groupProgress, setGroupProgress] = useState([])
  const [nextMatches, setNextMatches] = useState([])
  const [userPredictions, setUserPredictions] = useState({})
  const [totalUsers, setTotalUsers] = useState(0)
  const [dailyInsight, setDailyInsight] = useState(null)
  const [insightLoading, setInsightLoading] = useState(true)
  const [activeOrdago, setActiveOrdago] = useState(null)
  const [loading, setLoading] = useState(true)
  const { permission: notifPerm, requestPermission } = useNotifications()
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
    fetchActiveOrdago()
  }, [])

  async function fetchActiveOrdago() {
    try {
      const { data } = await supabase.from('ordagos')
        .select(`
          *,
          match:matches(
            id, match_date, status,
            home_team:teams!matches_home_team_id_fkey(name, flag_url),
            away_team:teams!matches_away_team_id_fkey(name, flag_url)
          )
        `)
        .in('status', ['open', 'locked'])
        .order('number')
        .limit(1)
      if (data?.[0]) setActiveOrdago(data[0])
    } catch { /* ordagos table may not exist yet */ }
  }

  async function fetchInsight() {
    setInsightLoading(true)
    try {
      const res = await fetch('/api/generate-insight')
      if (res.ok) {
        const data = await res.json()
        if (data.insight) {
          setDailyInsight(data.insight)
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
      nicknameMap[p.id] = p.nickname || p.full_name
      if (p.has_paid) paidSet.add(p.id)
    })

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
    setLoading(false)
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

  return (
    <div className="stagger-in" style={{ maxWidth: '500px', margin: '0 auto', padding: '16px', minHeight: '100svh' }}>

      {/* ===== POSITION + POT (unified) ===== */}
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

        {/* Position + stats */}
        <div>
          <div style={{
            fontSize: '11px', color: 'rgba(255,255,255,0.5)',
            textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: '6px'
          }}>
            Tu posición
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '40px', fontWeight: '700', color: '#fff', lineHeight: 1 }}>
              {displayStats.rank}
            </span>
            <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)' }}>
              / {displayTotalUsers > 0 ? displayTotalUsers : '...'}
            </span>
          </div>
          <div style={{ marginTop: '10px', display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '22px', fontWeight: '700', color: 'var(--gold)' }}>{displayStats.points}</span>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginLeft: '4px' }}>puntos</span>
            </div>
            <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.1)' }} />
            <div>
              <span style={{ fontSize: '14px', fontWeight: '600', color: '#4ade80' }}>{displayStats.exactHits}</span>
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginLeft: '3px' }}>exactos</span>
            </div>
          </div>
        </div>
      </div>

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
          <div style={{
            padding: '12px', textAlign: 'center', color: 'var(--text-dim)',
            fontSize: '12px'
          }}>
            Generando crónica...
          </div>
        ) : displayInsight ? (
          <div style={{
            fontSize: '13px', color: 'var(--text-secondary)',
            lineHeight: '1.7', whiteSpace: 'pre-line'
          }}>
            {displayInsight}
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

      {/* ===== ÓRDAGOS + NORMAS QUICK ACCESS ===== */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(255,204,0,0.06), rgba(255,204,0,0.02))',
        borderRadius: '10px',
        padding: '16px 18px',
        marginBottom: '12px',
        border: '0.5px solid rgba(255,204,0,0.12)'
      }}>
        <div style={{
          fontSize: '10px', color: 'var(--gold)', textTransform: 'uppercase',
          letterSpacing: '1px', fontWeight: '600', marginBottom: '10px',
          display: 'flex', alignItems: 'center', gap: '6px'
        }}>
          <span>🎲</span> Órdagos del Mundial
        </div>

        {/* Active ordago preview */}
        {activeOrdago ? (
          <div style={{
            background: 'var(--bg-input)', borderRadius: '8px', padding: '12px',
            marginBottom: '12px', border: '0.5px solid var(--border-light)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-primary)' }}>
                Órdago #{activeOrdago.number}: {activeOrdago.title}
              </span>
              <span style={{
                fontSize: '9px', padding: '2px 6px', borderRadius: '3px',
                background: activeOrdago.status === 'open' ? 'rgba(255,204,0,0.1)' : 'var(--bg-secondary)',
                color: activeOrdago.status === 'open' ? 'var(--gold)' : 'var(--text-dim)',
                fontWeight: '600'
              }}>
                {activeOrdago.status === 'open' ? '⏱ ABIERTO' : '🔒 PRÓXIMO'}
              </span>
            </div>
            {activeOrdago.match && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  {activeOrdago.match.home_team?.flag_url && (
                    <img src={activeOrdago.match.home_team.flag_url} alt="" style={{ width: '18px', height: '12px', borderRadius: '2px', objectFit: 'cover' }} />
                  )}
                  <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>{activeOrdago.match.home_team?.name || 'TBD'}</span>
                </div>
                <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>vs</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>{activeOrdago.match.away_team?.name || 'TBD'}</span>
                  {activeOrdago.match.away_team?.flag_url && (
                    <img src={activeOrdago.match.away_team.flag_url} alt="" style={{ width: '18px', height: '12px', borderRadius: '2px', objectFit: 'cover' }} />
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5', margin: '0 0 12px' }}>
            6 predicciones especiales a partidos concretos. Se desbloquean durante el torneo. ¿Te atreves?
          </p>
        )}

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => navigate('/predictions')}
            style={{
              flex: 1, padding: '10px', borderRadius: '6px', border: 'none',
              background: 'var(--gold)', color: '#1a1d26',
              fontSize: '12px', fontWeight: '600', cursor: 'pointer'
            }}
          >
            🎲 Ir a Órdagos
          </button>
          <button
            onClick={() => navigate('/rules')}
            style={{
              flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,204,0,0.2)',
              background: 'transparent', color: 'var(--gold)',
              fontSize: '12px', fontWeight: '600', cursor: 'pointer'
            }}
          >
            📋 Ver normas
          </button>
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
          <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '2px' }}>Partidos y predicciones</div>
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
      {demoMode && (
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
            Partidos de hoy
          </div>
          {[
            { home: 'España', away: 'Croacia', time: '18:00', status: 'finished', score: '3-0' },
            { home: 'Argentina', away: 'Senegal', time: '21:00', status: 'live', minute: '67\'' },
            { home: 'Brasil', away: 'Panamá', time: '22:00', status: 'upcoming' }
          ].map((m, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', padding: '8px 0',
              borderBottom: i < 2 ? '0.5px solid var(--border-light)' : 'none'
            }}>
              <div style={{ width: '45px', fontSize: '11px', color: 'var(--text-dim)' }}>{m.time}</div>
              <div style={{ flex: 1, fontSize: '12px', color: 'var(--text-primary)' }}>
                {m.home} vs {m.away}
              </div>
              <div style={{
                fontSize: '10px', padding: '2px 8px', borderRadius: '3px',
                background: m.status === 'finished' ? 'rgba(0,122,69,0.1)' : m.status === 'live' ? 'rgba(255,204,0,0.1)' : 'var(--bg-input)',
                color: m.status === 'finished' ? 'var(--green)' : m.status === 'live' ? 'var(--gold)' : 'var(--text-dim)',
                fontWeight: '600'
              }}>
                {m.status === 'finished' ? m.score : m.status === 'live' ? `🔴 ${m.minute}` : 'Próximo'}
              </div>
            </div>
          ))}
        </div>
      )}
      {!demoMode && nextMatches.length > 0 && (
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
    </div>
  )
}
