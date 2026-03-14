import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

export default function Admin({ session }) {
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

    if (!error && data) {
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
      alert('Introduce un resultado válido')
      return
    }

    setSaving(matchId)
    const { error } = await supabase
      .from('matches')
      .update({ home_score: home, away_score: away, status: 'finished' })
      .eq('id', matchId)

    if (error) {
      alert('Error: ' + error.message)
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

  if (loading) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
        Cargando...
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
        No tienes permisos de administrador.
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: '16px' }}>

      <div style={{ marginBottom: '16px' }}>
        <h2 style={{
          fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)',
          margin: '0 0 4px', letterSpacing: '0.3px'
        }}>
          Panel de Admin
        </h2>
        <p style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
          Introducir resultados reales
        </p>
      </div>

      {/* Lista de partidos */}
      {matches.map(match => (
        <div key={match.id} style={{
          display: 'flex',
          alignItems: 'center',
          padding: '10px 12px',
          borderBottom: '0.5px solid var(--border-light)',
          gap: '10px'
        }}>
          {/* Equipos */}
          <div style={{ flex: 1, fontSize: '13px', color: 'var(--text-primary)', minWidth: 0 }}>
            <span style={{ fontWeight: '500' }}>{match.home_team?.name || 'Local'}</span>
            <span style={{ color: 'var(--text-dim)', margin: '0 6px' }}>vs</span>
            <span style={{ fontWeight: '500' }}>{match.away_team?.name || 'Visitante'}</span>
          </div>

          {/* Inputs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
            <input
              type="number"
              min="0"
              value={scores[match.id]?.home ?? ''}
              onChange={e => updateScore(match.id, 'home', e.target.value)}
              style={{
                width: '40px', height: '32px', textAlign: 'center',
                borderRadius: '4px', border: '0.5px solid var(--border)',
                background: 'var(--bg-input)', color: 'var(--text-primary)',
                fontSize: '14px', fontWeight: '600'
              }}
            />
            <span style={{ color: 'var(--text-dim)', fontSize: '11px' }}>:</span>
            <input
              type="number"
              min="0"
              value={scores[match.id]?.away ?? ''}
              onChange={e => updateScore(match.id, 'away', e.target.value)}
              style={{
                width: '40px', height: '32px', textAlign: 'center',
                borderRadius: '4px', border: '0.5px solid var(--border)',
                background: 'var(--bg-input)', color: 'var(--text-primary)',
                fontSize: '14px', fontWeight: '600'
              }}
            />
          </div>

          {/* Estado */}
          <span style={{
            fontSize: '10px', flexShrink: 0, width: '65px', textAlign: 'center',
            padding: '3px 8px', borderRadius: '3px',
            background: match.status === 'finished' ? 'var(--green-light)' : 'var(--bg-secondary)',
            color: match.status === 'finished' ? 'var(--green)' : 'var(--text-dim)'
          }}>
            {match.status === 'finished' ? 'Finalizado' : 'Pendiente'}
          </span>

          {/* Botón guardar */}
          <button
            onClick={() => saveResult(match.id)}
            disabled={saving === match.id}
            style={{
              padding: '6px 14px',
              background: 'var(--green)',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: '600',
              flexShrink: 0,
              opacity: saving === match.id ? 0.7 : 1
            }}
          >
            {saving === match.id ? '...' : 'Guardar'}
          </button>
        </div>
      ))}
    </div>
  )
}