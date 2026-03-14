import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function Dashboard({ session }) {
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    fetchMatches()
    fetchProfile()
  }, [])

  async function fetchMatches() {
    const { data, error } = await supabase
      .from('matches')
      .select(`
        *,
        home_team:teams!matches_home_team_id_fkey(id, name, code, flag_url),
        away_team:teams!matches_away_team_id_fkey(id, name, code, flag_url)
      `)
      .order('match_date', { ascending: true })

    if (error) {
      console.error('Error cargando partidos:', error)
    } else {
      setMatches(data)
    }
    setLoading(false)
  }

  async function fetchProfile() {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()

    if (!error) setProfile(data)
  }

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Cargando partidos...</div>

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
      
      {/* Cabecera */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ margin: 0 }}>🏆 Porra Mundial 2026</h1>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '14px', color: '#666' }}>{session.user.email}</div>
          {profile && <div style={{ fontSize: '14px', fontWeight: 'bold' }}>🪙 {profile.chips} fichas</div>}
        </div>
      </div>

      {/* Lista de partidos */}
      {matches.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#999', border: '2px dashed #ddd', borderRadius: '8px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚽</div>
          <div style={{ fontSize: '18px' }}>Los partidos se cargarán próximamente</div>
          <div style={{ fontSize: '14px', marginTop: '8px' }}>Vuelve cuando se confirmen los 48 equipos</div>
        </div>
      ) : (
        <div>
          {matches.map(match => (
            <div key={match.id} style={{
              border: '1px solid #eee',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                <span>{match.home_team?.name || 'TBD'}</span>
              </div>
              <div style={{ textAlign: 'center', padding: '0 16px' }}>
                {match.status === 'finished' 
                  ? <strong>{match.home_score} - {match.away_score}</strong>
                  : <span style={{ color: '#999', fontSize: '14px' }}>vs</span>
                }
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, justifyContent: 'flex-end' }}>
                <span>{match.away_team?.name || 'TBD'}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}