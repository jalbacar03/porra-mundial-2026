import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

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

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '16px', minHeight: '100svh' }}>

      {/* Cabecera */}
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

      {/* Cabecera de tabla */}
      <div style={{
        display: 'flex',
        padding: '8px 12px',
        fontSize: '10px',
        color: 'var(--text-dim)',
        textTransform: 'uppercase',
        letterSpacing: '0.6px',
        borderBottom: '0.5px solid var(--border)'
      }}>
        <span style={{ width: '36px' }}>#</span>
        <span style={{ flex: 1, minWidth: 0 }}>Nombre</span>
        <span className="leaderboard-pts" style={{ width: '50px', textAlign: 'center' }}>Pts</span>
        <span className="leaderboard-stat" style={{ width: '50px', textAlign: 'center' }}>Exact</span>
        <span className="leaderboard-stat" style={{ width: '50px', textAlign: 'center' }}>1X2</span>
      </div>

      {/* Filas */}
      {rankings.map((user, index) => {
        const isMe = user.user_id === userId
        return (
          <div key={user.user_id} style={{
            display: 'flex',
            alignItems: 'center',
            padding: '10px 12px',
            borderBottom: '0.5px solid var(--border-light)',
            background: isMe ? 'rgba(255, 204, 0, 0.04)' : 'transparent',
            borderLeft: isMe ? '2px solid var(--gold)' : '2px solid transparent'
          }}>
            {/* Posición */}
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

            {/* Nombre */}
            <span style={{
              flex: 1, fontSize: '13px',
              fontWeight: isMe ? '600' : '400',
              color: isMe ? 'var(--gold)' : 'var(--text-primary)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              minWidth: 0
            }}>
              {user.full_name}{isMe ? ' (Tú)' : ''}
            </span>

            {/* Puntos */}
            <span className="leaderboard-pts" style={{
              width: '50px', textAlign: 'center',
              fontSize: '14px', fontWeight: '600',
              color: index === 0 ? 'var(--gold)' : 'var(--text-primary)'
            }}>
              {user.total_points}
            </span>

            {/* Exactos */}
            <span className="leaderboard-stat" style={{
              width: '50px', textAlign: 'center',
              fontSize: '13px', color: 'var(--text-secondary)'
            }}>
              {user.exact_hits}
            </span>

            {/* 1X2 */}
            <span className="leaderboard-stat" style={{
              width: '50px', textAlign: 'center',
              fontSize: '13px', color: 'var(--text-secondary)'
            }}>
              {user.sign_hits}
            </span>
          </div>
        )
      })}
    </div>
  )
}