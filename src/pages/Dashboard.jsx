import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

export default function Dashboard({ session }) {
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [stats, setStats] = useState({ total: 0, completed: 0, points: 0, exactHits: 0, rank: '-' })
  const [topRanking, setTopRanking] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    // Perfil
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()
    if (profileData) setProfile(profileData)

    // Total de partidos de grupo
    const { count: totalMatches } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .eq('stage', 'group')

    // Predicciones del usuario
    const { data: preds } = await supabase
      .from('predictions')
      .select('*')
      .eq('user_id', session.user.id)

    const completed = preds?.length || 0
    const points = preds?.reduce((sum, p) => sum + (p.points_earned || 0), 0) || 0
    const exactHits = preds?.filter(p => p.points_earned === 3).length || 0

    // Leaderboard para ranking
    const { data: rankings } = await supabase
      .from('leaderboard')
      .select('*')

    let rank = '-'
    if (rankings) {
      const idx = rankings.findIndex(r => r.user_id === session.user.id)
      if (idx !== -1) rank = idx + 1
      setTopRanking(rankings.slice(0, 5))
    }

    setStats({
      total: totalMatches || 0,
      completed,
      points,
      exactHits,
      rank
    })
    setLoading(false)
  }

  if (loading) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
        Cargando...
      </div>
    )
  }

  const pct = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', padding: '16px' }}>

      {/* Tarjeta de posición */}
      <div style={{
        background: 'linear-gradient(135deg, #00392a, #005e3a)',
        borderRadius: '10px',
        padding: '18px 20px',
        marginBottom: '14px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Círculos decorativos */}
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
          fontSize: '11px', color: 'rgba(255,255,255,0.5)',
          textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px'
        }}>
          Tu posición
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
          <span style={{ fontSize: '36px', fontWeight: '700', color: '#fff' }}>
            {stats.rank}
          </span>
          <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)' }}>
            de {topRanking.length > 0 ? `${topRanking.length}+ participantes` : '...'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '20px', marginTop: '12px' }}>
          <div>
            <span style={{ fontSize: '20px', fontWeight: '600', color: 'var(--gold)' }}>{stats.points}</span>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginLeft: '4px' }}>pts</span>
          </div>
          <div>
            <span style={{ fontSize: '20px', fontWeight: '600', color: '#fff' }}>{stats.exactHits}</span>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginLeft: '4px' }}>exactos</span>
          </div>
          <div>
            <span style={{ fontSize: '20px', fontWeight: '600', color: '#fff' }}>{profile?.chips || 0}</span>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginLeft: '4px' }}>fichas</span>
          </div>
        </div>
      </div>

      {/* Barra de progreso */}
      <div style={{
        background: 'var(--bg-secondary)',
        borderRadius: '8px',
        padding: '14px 16px',
        marginBottom: '14px',
        border: '0.5px solid var(--border)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Predicciones completadas</span>
          <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: '600' }}>
            {stats.completed}/{stats.total}
          </span>
        </div>
        <div style={{
          height: '6px',
          background: 'var(--bg-input)',
          borderRadius: '3px',
          overflow: 'hidden'
        }}>
          <div style={{
            height: '100%',
            width: `${pct}%`,
            background: pct === 100 ? 'var(--green)' : 'var(--gold)',
            borderRadius: '3px',
            transition: 'width 0.4s ease'
          }} />
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '6px' }}>
          {pct === 100 ? 'Todas las predicciones completadas' : `${pct}% completado`}
        </div>
      </div>

      {/* Botones de acción */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
        <button
          onClick={() => navigate('/predictions')}
          style={{
            flex: 1,
            padding: '14px',
            background: 'var(--green)',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            textAlign: 'center'
          }}
        >
          <div style={{ fontSize: '14px', fontWeight: '600', letterSpacing: '0.3px' }}>Predicciones</div>
          <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '2px' }}>Fase de grupos</div>
        </button>
        <button
          onClick={() => navigate('/leaderboard')}
          style={{
            flex: 1,
            padding: '14px',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            border: '0.5px solid var(--border)',
            borderRadius: '8px',
            cursor: 'pointer',
            textAlign: 'center'
          }}
        >
          <div style={{ fontSize: '14px', fontWeight: '600' }}>Ranking</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Clasificación</div>
        </button>
      </div>

      {/* Top 5 Ranking */}
      {topRanking.length > 0 && (
        <div style={{
          background: 'var(--bg-secondary)',
          borderRadius: '8px',
          padding: '14px 16px',
          border: '0.5px solid var(--border)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '10px'
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
              Ver ranking completo
            </span>
          </div>

          {topRanking.map((user, index) => {
            const isMe = user.user_id === session.user.id
            const medals = [
              'linear-gradient(135deg, #ffd700, #b8860b)',
              'linear-gradient(135deg, #c0c0c0, #808080)',
              'linear-gradient(135deg, #cd7f32, #8b4513)'
            ]
            return (
              <div key={user.user_id} style={{
                display: 'flex',
                alignItems: 'center',
                padding: '8px 0',
                borderBottom: index < topRanking.length - 1 ? '0.5px solid var(--border-light)' : 'none'
              }}>
                <div style={{
                  width: '24px', height: '24px', borderRadius: '50%',
                  background: index < 3 ? medals[index] : 'var(--bg-secondary)',
                  border: index >= 3 ? '1px solid var(--border)' : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '11px', fontWeight: '700',
                  color: index < 3 ? '#1a1d26' : 'var(--text-muted)'
                }}>
                  {index + 1}
                </div>
                <span style={{
                  flex: 1, marginLeft: '10px',
                  fontSize: '13px', fontWeight: isMe ? '600' : '400',
                  color: isMe ? 'var(--gold)' : 'var(--text-primary)'
                }}>
                  {user.full_name}{isMe ? ' (Tú)' : ''}
                </span>
                <span style={{
                  fontSize: '14px', fontWeight: '600',
                  color: index === 0 ? 'var(--gold)' : 'var(--text-primary)'
                }}>
                  {user.total_points}
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text-dim)', marginLeft: '3px' }}>pts</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}