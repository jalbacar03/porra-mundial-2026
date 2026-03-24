import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../supabase'
import { calculateGroupStandings } from '../../utils/groupStandings'

/**
 * Shows a mini preview of group standings based on the user's predictions.
 * Highlights who qualifies (top 2 green, best 3rd yellow, eliminated red).
 * Provides a button to auto-fill the R32 bet.
 */
export default function GroupStandingsPreview({ session, onAutoFillR32 }) {
  const [matches, setMatches] = useState([])
  const [predictions, setPredictions] = useState({})
  const [loading, setLoading] = useState(true)
  const [activeGroup, setActiveGroup] = useState('A')

  const groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    const [matchesRes, predsRes] = await Promise.all([
      supabase
        .from('matches')
        .select(`*, home_team:teams!matches_home_team_id_fkey(id, name, code, flag_url), away_team:teams!matches_away_team_id_fkey(id, name, code, flag_url)`)
        .eq('stage', 'group')
        .order('match_date'),
      supabase
        .from('predictions')
        .select('*')
        .eq('user_id', session.user.id)
    ])

    if (matchesRes.data) setMatches(matchesRes.data)
    if (predsRes.data) {
      const map = {}
      predsRes.data.forEach(p => {
        map[p.match_id] = { home_score: p.predicted_home, away_score: p.predicted_away }
      })
      setPredictions(map)
    }
    setLoading(false)
  }

  const { groupStandings, qualified32, thirdPlaceRanking } = useMemo(() => {
    if (!matches.length) return { groupStandings: {}, qualified32: [], thirdPlaceRanking: [] }
    return calculateGroupStandings(matches, predictions)
  }, [matches, predictions])

  // Count how many predictions are filled
  const totalGroupMatches = matches.length
  const filledPredictions = Object.keys(predictions).filter(k => {
    const p = predictions[k]
    return p.home_score != null && p.away_score != null
  }).length

  const qualified3rdIds = useMemo(() => {
    return thirdPlaceRanking.slice(0, 8).map(t => t.team.id)
  }, [thirdPlaceRanking])

  if (loading) return null

  if (filledPredictions < totalGroupMatches * 0.5) {
    return (
      <div style={{
        background: 'var(--bg-secondary)', borderRadius: '8px', padding: '16px',
        marginBottom: '14px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)'
      }}>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>
          📊 Clasificación de grupos
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
          Completa al menos el 50% de tus predicciones de partidos para ver las clasificaciones estimadas
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '6px' }}>
          {filledPredictions}/{totalGroupMatches} partidos predichos
        </div>
      </div>
    )
  }

  const currentStandings = groupStandings[activeGroup] || []

  return (
    <div style={{
      background: 'var(--bg-secondary)', borderRadius: '8px', padding: '14px',
      marginBottom: '14px', border: '1px solid rgba(255,255,255,0.05)'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
            📊 Tus clasificaciones según predicciones
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>
            {filledPredictions}/{totalGroupMatches} partidos · {qualified32.length} clasificados
          </div>
        </div>
        {onAutoFillR32 && qualified32.length === 32 && (
          <button
            onClick={() => onAutoFillR32(qualified32)}
            style={{
              padding: '6px 12px', borderRadius: '6px', border: 'none',
              background: 'var(--green)', color: '#fff', fontSize: '11px',
              fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap'
            }}
          >
            Auto-rellenar 32avos
          </button>
        )}
      </div>

      {/* Group tabs */}
      <div style={{
        display: 'flex', gap: '4px', overflowX: 'auto', marginBottom: '10px',
        paddingBottom: '4px'
      }}>
        {groups.map(g => {
          const isActive = activeGroup === g
          const table = groupStandings[g] || []
          const allPredicted = table.every(t => t.played === 3)
          return (
            <button
              key={g}
              onClick={() => setActiveGroup(g)}
              style={{
                padding: '4px 8px', borderRadius: '4px', border: 'none',
                background: isActive ? 'var(--green)' : allPredicted ? 'rgba(0,122,69,0.15)' : 'var(--bg-primary)',
                color: isActive ? '#fff' : allPredicted ? 'var(--green)' : 'var(--text-muted)',
                cursor: 'pointer', fontSize: '11px', fontWeight: isActive ? '600' : '400',
                minWidth: '28px', flexShrink: 0
              }}
            >
              {g}
            </button>
          )
        })}
      </div>

      {/* Standings table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
        <thead>
          <tr style={{ color: 'var(--text-dim)', fontSize: '10px', textTransform: 'uppercase' }}>
            <th style={{ textAlign: 'left', padding: '4px 6px', fontWeight: '500' }}>#</th>
            <th style={{ textAlign: 'left', padding: '4px 6px', fontWeight: '500' }}>Equipo</th>
            <th style={{ textAlign: 'center', padding: '4px 6px', fontWeight: '500' }}>PJ</th>
            <th style={{ textAlign: 'center', padding: '4px 6px', fontWeight: '500' }}>G</th>
            <th style={{ textAlign: 'center', padding: '4px 6px', fontWeight: '500' }}>E</th>
            <th style={{ textAlign: 'center', padding: '4px 6px', fontWeight: '500' }}>P</th>
            <th style={{ textAlign: 'center', padding: '4px 6px', fontWeight: '500' }}>DG</th>
            <th style={{ textAlign: 'center', padding: '4px 6px', fontWeight: '500' }}>Pts</th>
          </tr>
        </thead>
        <tbody>
          {currentStandings.map((row, idx) => {
            const isTop2 = idx < 2
            const is3rdQualified = idx === 2 && qualified3rdIds.includes(row.team.id)
            const bgColor = isTop2
              ? 'rgba(0,122,69,0.12)'
              : is3rdQualified
                ? 'rgba(255,204,0,0.1)'
                : idx === 2
                  ? 'rgba(255,204,0,0.05)'
                  : 'transparent'
            const borderLeft = isTop2
              ? '3px solid var(--green)'
              : is3rdQualified
                ? '3px solid #ffcc00'
                : '3px solid transparent'

            return (
              <tr key={row.team.id} style={{ background: bgColor }}>
                <td style={{ padding: '6px', borderLeft, fontWeight: '600', color: 'var(--text-muted)' }}>
                  {idx + 1}
                </td>
                <td style={{ padding: '6px', fontWeight: '500', color: 'var(--text-primary)' }}>
                  {row.team.flag_url && (
                    <img src={row.team.flag_url} alt="" style={{ width: '16px', height: '12px', marginRight: '6px', verticalAlign: 'middle', borderRadius: '1px' }} />
                  )}
                  {row.team.name}
                </td>
                <td style={{ textAlign: 'center', padding: '6px', color: 'var(--text-muted)' }}>{row.played}</td>
                <td style={{ textAlign: 'center', padding: '6px', color: 'var(--text-muted)' }}>{row.w}</td>
                <td style={{ textAlign: 'center', padding: '6px', color: 'var(--text-muted)' }}>{row.d}</td>
                <td style={{ textAlign: 'center', padding: '6px', color: 'var(--text-muted)' }}>{row.l}</td>
                <td style={{ textAlign: 'center', padding: '6px', color: row.gd > 0 ? 'var(--green)' : row.gd < 0 ? '#e74c3c' : 'var(--text-muted)' }}>
                  {row.gd > 0 ? '+' : ''}{row.gd}
                </td>
                <td style={{ textAlign: 'center', padding: '6px', fontWeight: '700', color: '#ffcc00' }}>{row.pts}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '12px', marginTop: '8px', fontSize: '10px', color: 'var(--text-dim)' }}>
        <span><span style={{ color: 'var(--green)' }}>■</span> Clasifica directo (top 2)</span>
        <span><span style={{ color: '#ffcc00' }}>■</span> Mejor 3º (clasifica)</span>
      </div>
    </div>
  )
}
