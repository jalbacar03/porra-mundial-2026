import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

function Leaderboard() {
  const [rankings, setRankings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLeaderboard()
  }, [])

  async function fetchLeaderboard() {
    const { data, error } = await supabase
      .from('leaderboard')
      .select('*')

    if (error) {
      console.error('Error fetching leaderboard:', error)
    } else {
      setRankings(data)
    }
    setLoading(false)
  }

  if (loading) return <p>Cargando clasificación...</p>

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: '20px' }}>
      <h1>Clasificación General</h1>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #333', textAlign: 'left' }}>
            <th style={{ padding: '10px' }}>#</th>
            <th style={{ padding: '10px' }}>Nombre</th>
            <th style={{ padding: '10px', textAlign: 'center' }}>Pts</th>
            <th style={{ padding: '10px', textAlign: 'center' }}>Exactos</th>
            <th style={{ padding: '10px', textAlign: 'center' }}>1X2</th>
            <th style={{ padding: '10px', textAlign: 'center' }}>Fallos</th>
          </tr>
        </thead>
        <tbody>
          {rankings.map((user, index) => (
            <tr key={user.user_id} style={{ borderBottom: '1px solid #ddd' }}>
              <td style={{ padding: '10px', fontWeight: index < 3 ? 'bold' : 'normal' }}>
                {index + 1}
              </td>
              <td style={{ padding: '10px' }}>{user.full_name}</td>
              <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>
                {user.total_points}
              </td>
              <td style={{ padding: '10px', textAlign: 'center' }}>{user.exact_hits}</td>
              <td style={{ padding: '10px', textAlign: 'center' }}>{user.sign_hits}</td>
              <td style={{ padding: '10px', textAlign: 'center' }}>{user.misses}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default Leaderboard