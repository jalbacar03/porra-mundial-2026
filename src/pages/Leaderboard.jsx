import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts'

export default function Leaderboard() {
  const [rankings, setRankings] = useState([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState(null)
  const [activeTab, setActiveTab] = useState('general') // 'general' | 'last3'
  const [last3Rankings, setLast3Rankings] = useState([])

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) setUserId(user.id)

    const { data, error } = await supabase
      .from('leaderboard')
      .select('*')

    if (!error && data) setRankings(data)

    // Last 3 days: get matches finished in last 3 days and compute rankings from those
    await fetchLast3Days(user?.id)
    setLoading(false)
  }

  async function fetchLast3Days(currentUserId) {
    const threeDaysAgo = new Date()
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

    // Get matches finished recently (using updated_at or we check status + date)
    const { data: recentMatches } = await supabase
      .from('matches')
      .select('id')
      .eq('status', 'finished')
      .gte('match_date', threeDaysAgo.toISOString())

    if (!recentMatches || recentMatches.length === 0) {
      setLast3Rankings([])
      return
    }

    const matchIds = recentMatches.map(m => m.id)

    // Get predictions for those matches
    const { data: preds } = await supabase
      .from('predictions')
      .select('user_id, points_earned, match_id')
      .in('match_id', matchIds)

    if (!preds || preds.length === 0) {
      setLast3Rankings([])
      return
    }

    // Get all profiles for names
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')

    const profileMap = {}
    profiles?.forEach(p => { profileMap[p.id] = p.full_name })

    // Aggregate by user
    const userStats = {}
    preds.forEach(p => {
      if (!userStats[p.user_id]) {
        userStats[p.user_id] = { user_id: p.user_id, total_points: 0, exact_hits: 0, sign_hits: 0 }
      }
      userStats[p.user_id].total_points += (p.points_earned || 0)
      if (p.points_earned === 3) userStats[p.user_id].exact_hits++
      if (p.points_earned === 1) userStats[p.user_id].sign_hits++
    })

    const sorted = Object.values(userStats)
      .map(u => ({ ...u, full_name: profileMap[u.user_id] || '?' }))
      .sort((a, b) => b.total_points - a.total_points || b.exact_hits - a.exact_hits)

    setLast3Rankings(sorted)
  }

  if (loading) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
        Cargando clasificación...
      </div>
    )
  }

  const medals = [
    'linear-gradient(135deg, #ffd700, #b8860b)',
    'linear-gradient(135deg, #c0c0c0, #808080)',
    'linear-gradient(135deg, #cd7f32, #8b4513)'
  ]
  const barColors = ['#ffd700', '#c0c0c0', '#cd7f32', '#007a45', '#007a45', '#007a45', '#007a45', '#007a45', '#007a45', '#007a45']

  const currentRankings = activeTab === 'general' ? rankings : last3Rankings
  const isEmpty = currentRankings.length === 0

  // Chart data — top 10
  const chartData = currentRankings.slice(0, 10).map((user, i) => ({
    name: user.full_name?.split(' ')[0] || '?',
    points: user.total_points,
    isMe: user.user_id === userId
  }))

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '16px', minHeight: '100svh' }}>

      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{
          fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)',
          margin: '0 0 4px', letterSpacing: '0.3px'
        }}>
          Clasificación
        </h2>
        <p style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
          {rankings.length} participantes
        </p>
      </div>

      {/* Tab switcher */}
      <div style={{
        display: 'flex', gap: '4px', marginBottom: '16px',
        padding: '3px', background: 'var(--bg-input)', borderRadius: '6px'
      }}>
        <button
          onClick={() => setActiveTab('general')}
          style={{
            flex: 1, padding: '8px 12px', borderRadius: '4px', border: 'none',
            background: activeTab === 'general' ? 'var(--bg-secondary)' : 'transparent',
            color: activeTab === 'general' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontSize: '12px', fontWeight: activeTab === 'general' ? '600' : '400', cursor: 'pointer'
          }}
        >
          🏆 General
        </button>
        <button
          onClick={() => setActiveTab('last3')}
          style={{
            flex: 1, padding: '8px 12px', borderRadius: '4px', border: 'none',
            background: activeTab === 'last3' ? 'var(--bg-secondary)' : 'transparent',
            color: activeTab === 'last3' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontSize: '12px', fontWeight: activeTab === 'last3' ? '600' : '400', cursor: 'pointer'
          }}
        >
          🔥 Últimos 3 días
        </button>
      </div>

      {isEmpty ? (
        <div style={{
          padding: '40px 20px', textAlign: 'center', color: 'var(--text-dim)',
          fontSize: '13px', background: 'var(--bg-secondary)', borderRadius: '8px',
          border: '0.5px solid var(--border)'
        }}>
          {activeTab === 'general'
            ? 'Aún no hay datos de clasificación'
            : 'No hay partidos finalizados en los últimos 3 días'
          }
        </div>
      ) : (
        <>
          {/* ===== TOP 10 CHART ===== */}
          {chartData.length > 1 && (
            <div style={{
              background: 'var(--bg-secondary)',
              borderRadius: '8px',
              padding: '14px 12px 8px',
              marginBottom: '14px',
              border: '0.5px solid var(--border)'
            }}>
              <div style={{
                fontSize: '10px', color: 'var(--text-dim)',
                textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px',
                paddingLeft: '4px'
              }}>
                Top {chartData.length} — Puntos
              </div>
              <ResponsiveContainer width="100%" height={chartData.length * 32 + 10}>
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 0, right: 30, left: 0, bottom: 0 }}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={60}
                    tick={{ fill: '#6b7080', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Bar
                    dataKey="points"
                    radius={[0, 3, 3, 0]}
                    barSize={14}
                    label={{
                      position: 'right',
                      fill: '#9da3b0',
                      fontSize: 11,
                      fontWeight: 600
                    }}
                  >
                    {chartData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry.isMe ? '#ffcc00' : (barColors[i] || '#007a45')}
                        fillOpacity={entry.isMe ? 1 : 0.85}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ===== TABLE ===== */}
          {/* Table header */}
          <div style={{
            display: 'flex', padding: '8px 12px', fontSize: '10px',
            color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.6px',
            borderBottom: '0.5px solid var(--border)'
          }}>
            <span style={{ width: '36px' }}>#</span>
            <span style={{ flex: 1, minWidth: 0 }}>Nombre</span>
            <span className="leaderboard-pts" style={{ width: '50px', textAlign: 'center' }}>Pts</span>
            <span className="leaderboard-stat" style={{ width: '50px', textAlign: 'center' }}>Exact</span>
            <span className="leaderboard-stat" style={{ width: '50px', textAlign: 'center' }}>1X2</span>
          </div>

          {/* Table rows */}
          {currentRankings.map((user, index) => {
            const isMe = user.user_id === userId
            return (
              <div key={user.user_id} style={{
                display: 'flex', alignItems: 'center', padding: '10px 12px',
                borderBottom: '0.5px solid var(--border-light)',
                background: isMe ? 'rgba(255, 204, 0, 0.04)' : 'transparent',
                borderLeft: isMe ? '2px solid var(--gold)' : '2px solid transparent'
              }}>
                <div style={{ width: '36px' }}>
                  {index < 3 ? (
                    <div style={{
                      width: '24px', height: '24px', borderRadius: '50%',
                      background: medals[index],
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '11px', fontWeight: '700', color: '#1a1d26'
                    }}>
                      {index + 1}
                    </div>
                  ) : (
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500' }}>
                      {index + 1}
                    </span>
                  )}
                </div>

                <span style={{
                  flex: 1, fontSize: '13px',
                  fontWeight: isMe ? '600' : '400',
                  color: isMe ? 'var(--gold)' : 'var(--text-primary)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0
                }}>
                  {user.full_name}{isMe ? ' (Tú)' : ''}
                </span>

                <span className="leaderboard-pts" style={{
                  width: '50px', textAlign: 'center', fontSize: '14px', fontWeight: '600',
                  color: index === 0 ? 'var(--gold)' : 'var(--text-primary)'
                }}>
                  {user.total_points}
                </span>

                <span className="leaderboard-stat" style={{
                  width: '50px', textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)'
                }}>
                  {user.exact_hits}
                </span>

                <span className="leaderboard-stat" style={{
                  width: '50px', textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)'
                }}>
                  {user.sign_hits}
                </span>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
