import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function Predictions({ session }) {
  const [matches, setMatches] = useState([])
  const [predictions, setPredictions] = useState({})
  const [savedPredictions, setSavedPredictions] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [activeGroup, setActiveGroup] = useState('A')

  const groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    // Cargar partidos con equipos
    const { data: matchesData, error: matchesError } = await supabase
      .from('matches')
      .select(`
        *,
        home_team:teams!matches_home_team_id_fkey(id, name, code, flag_url),
        away_team:teams!matches_away_team_id_fkey(id, name, code, flag_url)
      `)
      .eq('stage', 'group')
      .order('match_date', { ascending: true })

    if (matchesError) {
      console.error('Error cargando partidos:', matchesError)
      setLoading(false)
      return
    }

    setMatches(matchesData || [])

    // Cargar predicciones existentes del usuario
    const { data: predsData, error: predsError } = await supabase
      .from('predictions')
      .select('*')
      .eq('user_id', session.user.id)

    if (!predsError && predsData) {
      const predsMap = {}
      predsData.forEach(p => {
        predsMap[p.match_id] = {
          home_score: p.predicted_home,
          away_score: p.predicted_away
        }
      })
      setPredictions(predsMap)
      setSavedPredictions(predsMap)
    }

    setLoading(false)
  }

  function updatePrediction(matchId, field, value) {
    // Solo permitir números del 0 al 99
    if (value !== '' && (isNaN(value) || parseInt(value) < 0 || parseInt(value) > 99)) return

    setPredictions(prev => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        [field]: value === '' ? '' : parseInt(value)
      }
    }))
  }

  async function savePredictions() {
    setSaving(true)
    setMessage('')

    // Filtrar solo las predicciones del grupo activo que están completas
    const groupMatches = matches.filter(m => m.group_name === activeGroup)
    const toSave = []

    for (const match of groupMatches) {
      const pred = predictions[match.id]
      if (pred && pred.home_score !== '' && pred.home_score !== undefined &&
          pred.away_score !== '' && pred.away_score !== undefined) {
        toSave.push({
          user_id: session.user.id,
          match_id: match.id,
          predicted_home: pred.home_score,
          predicted_away: pred.away_score
        })
      }
    }

    if (toSave.length === 0) {
      setMessage('No hay predicciones completas para guardar en este grupo')
      setSaving(false)
      return
    }

    // Upsert: inserta o actualiza si ya existe
    const { error } = await supabase
      .from('predictions')
      .upsert(toSave, { onConflict: 'user_id,match_id' })

    if (error) {
      console.error('Error guardando:', error)
      setMessage('Error al guardar: ' + error.message)
    } else {
      // Actualizar savedPredictions con lo que acabamos de guardar
      const newSaved = { ...savedPredictions }
      toSave.forEach(p => {
        newSaved[p.match_id] = {
          home_score: p.predicted_home,
          away_score: p.predicted_away
        }
      })
      setSavedPredictions(newSaved)
      setMessage(`✅ ${toSave.length} predicciones guardadas para el Grupo ${activeGroup}`)
    }

    setSaving(false)
    setTimeout(() => setMessage(''), 3000)
  }

  function formatDate(dateStr) {
    const date = new Date(dateStr)
    const options = { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
    return date.toLocaleDateString('es-ES', options)
  }

  function hasUnsavedChanges(matchId) {
    const current = predictions[matchId]
    const saved = savedPredictions[matchId]
    if (!current) return false
    if (!saved) return current.home_score !== '' && current.home_score !== undefined
    return current.home_score !== saved.home_score || current.away_score !== saved.away_score
  }

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Cargando partidos...</div>

  const groupMatches = matches.filter(m => m.group_name === activeGroup)

  // Contar predicciones completadas por grupo
  function countGroupPredictions(group) {
    const gMatches = matches.filter(m => m.group_name === group)
    let count = 0
    gMatches.forEach(m => {
      const saved = savedPredictions[m.id]
      if (saved && saved.home_score !== '' && saved.home_score !== undefined &&
          saved.away_score !== '' && saved.away_score !== undefined) {
        count++
      }
    })
    return count
  }

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>

      {/* Título */}
      <h2 style={{ textAlign: 'center', marginBottom: '4px' }}>⚽ Predicciones - Fase de Grupos</h2>
      <p style={{ textAlign: 'center', color: '#666', fontSize: '14px', marginTop: '0' }}>
        Introduce el resultado exacto para cada partido
      </p>

      {/* Selector de grupos */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px',
        justifyContent: 'center',
        marginBottom: '24px'
      }}>
        {groups.map(g => {
          const total = matches.filter(m => m.group_name === g).length
          const done = countGroupPredictions(g)
          const isComplete = done === total && total > 0
          return (
            <button
              key={g}
              onClick={() => setActiveGroup(g)}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: activeGroup === g ? '2px solid #2d6a4f' : '1px solid #ddd',
                background: activeGroup === g ? '#2d6a4f' : isComplete ? '#d4edda' : '#fff',
                color: activeGroup === g ? '#fff' : '#333',
                cursor: 'pointer',
                fontWeight: activeGroup === g ? 'bold' : 'normal',
                fontSize: '13px',
                position: 'relative'
              }}
            >
              Grupo {g}
              <span style={{
                display: 'block',
                fontSize: '10px',
                color: activeGroup === g ? '#ccc' : '#999',
                marginTop: '2px'
              }}>
                {done}/{total}
              </span>
            </button>
          )
        })}
      </div>

      {/* Partidos del grupo */}
      <div>
        {groupMatches.map((match, index) => {
          const pred = predictions[match.id] || {}
          const unsaved = hasUnsavedChanges(match.id)

          return (
            <div key={match.id} style={{
              border: unsaved ? '1px solid #ffc107' : '1px solid #eee',
              borderRadius: '10px',
              padding: '14px 16px',
              marginBottom: '10px',
              background: unsaved ? '#fffdf0' : '#fafafa'
            }}>
              {/* Fecha */}
              <div style={{ fontSize: '12px', color: '#888', marginBottom: '10px', textAlign: 'center' }}>
                📅 {formatDate(match.match_date)} — Jornada {match.matchday}
              </div>

              {/* Equipos y marcadores */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px'
              }}>
                {/* Equipo local */}
                <div style={{ flex: 1, textAlign: 'right', fontSize: '15px', fontWeight: '500' }}>
                  {match.home_team?.flag_url && (
                    <img src={match.home_team.flag_url} alt="" style={{ width: '20px', marginRight: '6px', verticalAlign: 'middle' }} />
                  )}
                  {match.home_team?.name || 'TBD'}
                </div>

                {/* Inputs de marcador */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input
                    type="number"
                    min="0"
                    max="99"
                    value={pred.home_score ?? ''}
                    onChange={e => updatePrediction(match.id, 'home_score', e.target.value)}
                    style={{
                      width: '42px',
                      height: '38px',
                      textAlign: 'center',
                      fontSize: '18px',
                      fontWeight: 'bold',
                      borderRadius: '6px',
                      border: '1px solid #ccc',
                      background: '#fff'
                    }}
                  />
                  <span style={{ fontWeight: 'bold', color: '#999' }}>-</span>
                  <input
                    type="number"
                    min="0"
                    max="99"
                    value={pred.away_score ?? ''}
                    onChange={e => updatePrediction(match.id, 'away_score', e.target.value)}
                    style={{
                      width: '42px',
                      height: '38px',
                      textAlign: 'center',
                      fontSize: '18px',
                      fontWeight: 'bold',
                      borderRadius: '6px',
                      border: '1px solid #ccc',
                      background: '#fff'
                    }}
                  />
                </div>

                {/* Equipo visitante */}
                <div style={{ flex: 1, textAlign: 'left', fontSize: '15px', fontWeight: '500' }}>
                  {match.away_team?.name || 'TBD'}
                  {match.away_team?.flag_url && (
                    <img src={match.away_team.flag_url} alt="" style={{ width: '20px', marginLeft: '6px', verticalAlign: 'middle' }} />
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Mensaje de estado */}
      {message && (
        <div style={{
          padding: '10px',
          marginTop: '12px',
          background: message.includes('Error') ? '#f8d7da' : '#d4edda',
          borderRadius: '6px',
          fontSize: '14px',
          textAlign: 'center',
          color: message.includes('Error') ? '#721c24' : '#155724'
        }}>
          {message}
        </div>
      )}

      {/* Botón guardar */}
      <button
        onClick={savePredictions}
        disabled={saving}
        style={{
          width: '100%',
          padding: '14px',
          marginTop: '16px',
          background: '#2d6a4f',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '16px',
          fontWeight: 'bold',
          cursor: saving ? 'not-allowed' : 'pointer',
          opacity: saving ? 0.7 : 1
        }}
      >
        {saving ? 'Guardando...' : `Guardar predicciones - Grupo ${activeGroup}`}
      </button>

      {/* Progreso total */}
      <div style={{
        marginTop: '20px',
        padding: '12px',
        background: '#f0f0f0',
        borderRadius: '8px',
        textAlign: 'center',
        fontSize: '14px',
        color: '#555'
      }}>
        Progreso total: {Object.keys(savedPredictions).length} / {matches.length} partidos completados
      </div>
    </div>
  )
}