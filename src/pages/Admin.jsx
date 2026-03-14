import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

function Admin({ session }) {
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [scores, setScores] = useState({})
  const [saving, setSaving] = useState(null)

  useEffect(() => {
    checkAdmin()
    fetchMatches()
  }, [])

  async function checkAdmin() {
    const { data } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', session.user.id)
      .single()

    if (data?.is_admin) setIsAdmin(true)
  }

  async function fetchMatches() {
    const { data, error } = await supabase
      .from('matches')
      .select('*, home_team:teams!matches_home_team_id_fkey(name), away_team:teams!matches_away_team_id_fkey(name)')
      .order('matchday', { ascending: true })

    if (error) {
      console.error('Error:', error)
    } else {
      setMatches(data)
      const initialScores = {}
      data.forEach(m => {
        initialScores[m.id] = {
          home: m.home_score !== null ? String(m.home_score) : '',
          away: m.away_score !== null ? String(m.away_score) : ''
        }
      })
      setScores(initialScores)
    }
    setLoading(false)
  }

  async function saveResult(matchId) {
    const home = parseInt(scores[matchId]?.home)
    const away = parseInt(scores[matchId]?.away)

    if (isNaN(home) || isNaN(away) || home < 0 || away < 0) {
      alert('Introduce un resultado válido (números positivos)')
      return
    }

    setSaving(matchId)
    const { error } = await supabase
      .from('matches')
      .update({ home_score: home, away_score: away, status: 'finished' })
      .eq('id', matchId)

    if (error) {
      alert('Error al guardar: ' + error.message)
    } else {
      setMatches(prev => prev.map(m =>
        m.id === matchId ? { ...m, home_score: home, away_score: away, status: 'finished' } : m
      ))
    }
    setSaving(null)
  }

  function updateScore(matchId, side, value) {
    setScores(prev => ({
      ...prev,
      [matchId]: { ...prev[matchId], [side]: value }
    }))
  }

  if (loading) return <p style={{ padding: '20px' }}>Cargando...</p>
  if (!isAdmin) return <p style={{ padding: '20px' }}>No tienes permisos de administrador.</p>

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Panel de Admin</h1>
      <h2>Introducir resultados</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #333', textAlign: 'left' }}>
            <th style={{ padding: '10px' }}>Partido</th>
            <th style={{ padding: '10px', textAlign: 'center' }}>Resultado</th>
            <th style={{ padding: '10px', textAlign: 'center' }}>Estado</th>
            <th style={{ padding: '10px' }}></th>
          </tr>
        </thead>
        <tbody>
          {matches.map(match => (
            <tr key={match.id} style={{ borderBottom: '1px solid #ddd' }}>
              <td style={{ padding: '10px' }}>
                {match.home_team?.name || 'Local'} vs {match.away_team?.name || 'Visitante'}
              </td>
              <td style={{ padding: '10px', textAlign: 'center' }}>
                <input
                  type="number"
                  min="0"
                  value={scores[match.id]?.home ?? ''}
                  onChange={e => updateScore(match.id, 'home', e.target.value)}
                  style={{ width: '50px', padding: '6px', textAlign: 'center', borderRadius: '4px', border: '1px solid #ccc' }}
                />
                <span style={{ margin: '0 8px' }}>-</span>
                <input
                  type="number"
                  min="0"
                  value={scores[match.id]?.away ?? ''}
                  onChange={e => updateScore(match.id, 'away', e.target.value)}
                  style={{ width: '50px', padding: '6px', textAlign: 'center', borderRadius: '4px', border: '1px solid #ccc' }}
                />
              </td>
              <td style={{ padding: '10px', textAlign: 'center', fontSize: '13px', color: match.status === 'finished' ? '#2d6a4f' : '#999' }}>
                {match.status === 'finished' ? '✅ Finalizado' : '⏳ Pendiente'}
              </td>
              <td style={{ padding: '10px' }}>
                <button
                  onClick={() => saveResult(match.id)}
                  disabled={saving === match.id}
                  style={{
                    padding: '6px 16px',
                    background: '#2d6a4f',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '13px'
                  }}
                >
                  {saving === match.id ? 'Guardando...' : 'Guardar'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default Admin