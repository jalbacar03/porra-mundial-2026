import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts'

export default function Leaderboard() {
  const [rankings, setRankings] = useState([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState(null)

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
    setLoading(false)
  }

  if (loading) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
        Cargando clasificación...
      </div>
    )
  }

  if (rankings.length === 0) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
        Aún no hay datos de clasificación
      </div>
    )
  }

  const medals = [
    'linear-gradient(135deg, #ffd700, #b8860b)',
    'linear-gradient(135deg, #c0c0c0, #808080)',
    'linear-gradient(135deg, #cd7f32, #8b4513)'
  ]

  // Chart data — top 10 (or all if fewer)
  const chartData = rankings.slice(0, 10).map((user, i) => ({
    name: user.full_name?.split(' ')[0] || '?', // First name only for chart
    points: user.total_points,
    exact: user.exact_hits,
    isMe: user.user_id === userId
  }))

  const barColors = ['#ffd700', '#c0c0c0', '#cd7f32', '#007a45', '#007a45', '#007a45', '#007a45', '#007a45', '#007a45', '#007a45']

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '16px', minHeight: '100svh' }}>

      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{
          fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)',
          margin: '0 0 4px', letterSpacing: '0.3px'
        }}>
          Clasificación General
        </h2>
        <p style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
          {rankings.length} participantes
        </p>
      </div>

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
      {rankings.map((user, index) => {
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
    </div>
  )
}
