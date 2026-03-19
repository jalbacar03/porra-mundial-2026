import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useCountdown, PREDICTIONS_DEADLINE } from '../hooks/useCountdown'

export default function Predictions({ session }) {
  const [matches, setMatches] = useState([])
  const [predictions, setPredictions] = useState({})
  const [savedPredictions, setSavedPredictions] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [activeGroup, setActiveGroup] = useState('A')
  const deadline = useCountdown(PREDICTIONS_DEADLINE)

  const groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
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

    const { error } = await supabase
      .from('predictions')
      .upsert(toSave, { onConflict: 'user_id,match_id' })

    if (error) {
      setMessage('Error al guardar: ' + error.message)
    } else {
      const newSaved = { ...savedPredictions }
      toSave.forEach(p => {
        newSaved[p.match_id] = {
          home_score: p.predicted_home,
          away_score: p.predicted_away
        }
      })
      setSavedPredictions(newSaved)
      setMessage(`${toSave.length} predicciones guardadas — Grupo ${activeGroup}`)
    }
    setSaving(false)
    setTimeout(() => setMessage(''), 3000)
  }

  function formatDate(dateStr) {
    const date = new Date(dateStr)
    return date.toLocaleDateString('es-ES', {
      weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    })
  }

  function hasUnsavedChanges(matchId) {
    const current = predictions[matchId]
    const saved = savedPredictions[matchId]
    if (!current) return false
    if (!saved) return current.home_score !== '' && current.home_score !== undefined
    return current.home_score !== saved.home_score || current.away_score !== saved.away_score
  }

  function isSaved(matchId) {
    const saved = savedPredictions[matchId]
    return saved && saved.home_score !== '' && saved.home_score !== undefined &&
           saved.away_score !== '' && saved.away_score !== undefined
  }

  function countGroupPredictions(group) {
    const gMatches = matches.filter(m => m.group_name === group)
    let count = 0
    gMatches.forEach(m => {
      if (isSaved(m.id)) count++
    })
    return count
  }

  if (loading) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
        Cargando partidos...
      </div>
    )
  }

  const groupMatches = matches.filter(m => m.group_name === activeGroup)
  const groupTotal = groupMatches.length
  const groupDone = countGroupPredictions(activeGroup)

  // Agrupar partidos por jornada
  const matchesByMatchday = {}
  groupMatches.forEach(m => {
    const key = m.matchday || 1
    if (!matchesByMatchday[key]) matchesByMatchday[key] = []
    matchesByMatchday[key].push(m)
  })

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', padding: '16px' }}>

      {/* Countdown deadline predicciones */}
      {!deadline.expired && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(255,204,0,0.08), rgba(255,204,0,0.03))',
          border: '1px solid rgba(255,204,0,0.15)',
          borderRadius: '10px',
          padding: '16px 18px',
          marginBottom: '16px',
          textAlign: 'center'
        }}>
          <div style={{
            fontSize: '10px',
            color: 'var(--gold)',
            textTransform: 'uppercase',
            letterSpacing: '1.2px',
            marginBottom: '8px',
            fontWeight: '600'
          }}>
            Tiempo restante para predicciones
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '12px',
            marginBottom: '10px'
          }}>
            {[
              { value: deadline.days, label: 'días' },
              { value: deadline.hours, label: 'horas' },
              { value: deadline.minutes, label: 'min' }
            ].map((unit, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize: '24px',
                  fontWeight: '700',
                  color: 'var(--gold)',
                  lineHeight: '1',
                  fontVariantNumeric: 'tabular-nums',
                  minWidth: '40px'
                }}>
                  {String(unit.value).padStart(2, '0')}
                </div>
                <div style={{
                  fontSize: '9px',
                  color: 'var(--text-dim)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginTop: '3px'
                }}>
                  {unit.label}
                </div>
              </div>
            ))}
          </div>

          <div style={{
            fontSize: '11px',
            color: 'var(--text-muted)',
            lineHeight: '1.5'
          }}>
            Todas las predicciones de fase de grupos deben realizarse <span style={{ color: 'var(--gold)', fontWeight: '600' }}>48 horas antes</span> del inicio del Mundial
          </div>
        </div>
      )}

      {deadline.expired && (
        <div style={{
          background: 'var(--red-bg)',
          border: '1px solid rgba(226,75,74,0.2)',
          borderRadius: '10px',
          padding: '14px 18px',
          marginBottom: '16px',
          textAlign: 'center',
          fontSize: '13px',
          color: 'var(--red)',
          fontWeight: '500'
        }}>
          🔒 El plazo para predicciones de fase de grupos ha finalizado
        </div>
      )}

      {/* Cabecera */}
      <div style={{ marginBottom: '14px' }}>
        <h2 style={{
          fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)',
          margin: '0 0 4px', letterSpacing: '0.3px'
        }}>
          Predicciones — Fase de Grupos
        </h2>
        <p style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
          Introduce el resultado exacto de cada partido
        </p>
      </div>

      {/* Selector de grupos */}
      <div className="group-tabs" style={{ marginBottom: '16px' }}>
        {groups.map(g => {
          const total = matches.filter(m => m.group_name === g).length
          const done = countGroupPredictions(g)
          const isActive = activeGroup === g
          const isComplete = done === total && total > 0
          return (
            <button
              key={g}
              onClick={() => setActiveGroup(g)}
              style={{
                padding: '6px 14px',
                borderRadius: '4px',
                border: 'none',
                background: isActive ? 'var(--green)' : isComplete ? 'var(--green-light)' : 'var(--bg-secondary)',
                color: isActive ? '#fff' : isComplete ? 'var(--green)' : 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: isActive ? '600' : '400',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}
            >
              {g} <span style={{ opacity: 0.6, fontSize: '10px' }}>{done}/{total}</span>
            </button>
          )
        })}
      </div>

      {/* Progreso del grupo */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: '6px',
        marginBottom: '12px', border: '0.5px solid var(--border)'
      }}>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          Grupo {activeGroup}
        </span>
        <span style={{ fontSize: '12px', fontWeight: '600', color: groupDone === groupTotal && groupTotal > 0 ? 'var(--green)' : 'var(--gold)' }}>
          {groupDone}/{groupTotal} completados
        </span>
      </div>

      {/* Partidos por jornada */}
      {Object.entries(matchesByMatchday).map(([matchday, mdMatches]) => (
        <div key={matchday}>
          {/* Separador de jornada */}
          <div style={{
            fontSize: '10px', color: 'var(--text-dim)',
            textTransform: 'uppercase', letterSpacing: '0.8px',
            padding: '10px 0 6px',
            borderBottom: '0.5px solid var(--border-light)'
          }}>
            Jornada {matchday}
          </div>

          {mdMatches.map(match => {
            const pred = predictions[match.id] || {}
            const unsaved = hasUnsavedChanges(match.id)
            const saved = isSaved(match.id)

            return (
              <div key={match.id} style={{
                padding: '12px 0',
                borderBottom: '0.5px solid var(--border-light)'
              }}>
                {/* Fecha */}
                <div style={{
                  fontSize: '11px', color: 'var(--text-dim)',
                  marginBottom: '10px', textAlign: 'center'
                }}>
                  {formatDate(match.match_date)}
                </div>

                {/* Equipos y marcadores */}
                <div style={{
                  display: 'flex', alignItems: 'center'
                }}>
                  {/* Equipo local */}
                  <div style={{
                    flex: 1, display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0
                  }}>
                    {match.home_team?.flag_url && (
                      <img
                        src={match.home_team.flag_url}
                        alt=""
                        style={{ width: '20px', height: '14px', borderRadius: '2px', objectFit: 'cover', flexShrink: 0 }}
                      />
                    )}
                    <span style={{
                      fontSize: '13px', color: 'var(--text-primary)', fontWeight: '500',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>
                      {match.home_team?.name || 'TBD'}
                    </span>
                  </div>

                  {/* Inputs */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '0 4px', flexShrink: 0 }}>
                    <input
                      type="number"
                      min="0"
                      max="99"
                      value={pred.home_score ?? ''}
                      onChange={e => updatePrediction(match.id, 'home_score', e.target.value)}
                      style={{
                        width: '36px',
                        height: '32px',
                        textAlign: 'center',
                        fontSize: '15px',
                        fontWeight: '600',
                        borderRadius: '4px',
                        border: unsaved ? '1px solid var(--gold)' : saved ? '1px solid var(--border)' : '1px solid var(--green)',
                        background: 'var(--bg-input)',
                        color: pred.home_score !== '' && pred.home_score !== undefined ? 'var(--gold)' : 'var(--text-dim)',
                        outline: 'none'
                      }}
                    />
                    <span style={{ color: 'var(--text-dim)', fontSize: '11px' }}>:</span>
                    <input
                      type="number"
                      min="0"
                      max="99"
                      value={pred.away_score ?? ''}
                      onChange={e => updatePrediction(match.id, 'away_score', e.target.value)}
                      style={{
                        width: '36px',
                        height: '32px',
                        textAlign: 'center',
                        fontSize: '15px',
                        fontWeight: '600',
                        borderRadius: '4px',
                        border: unsaved ? '1px solid var(--gold)' : saved ? '1px solid var(--border)' : '1px solid var(--green)',
                        background: 'var(--bg-input)',
                        color: pred.away_score !== '' && pred.away_score !== undefined ? 'var(--gold)' : 'var(--text-dim)',
                        outline: 'none'
                      }}
                    />
                  </div>

                  {/* Equipo visitante */}
                  <div style={{
                    flex: 1, display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end', minWidth: 0
                  }}>
                    <span style={{
                      fontSize: '13px', color: 'var(--text-primary)', fontWeight: '500',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>
                      {match.away_team?.name || 'TBD'}
                    </span>
                    {match.away_team?.flag_url && (
                      <img
                        src={match.away_team.flag_url}
                        alt=""
                        style={{ width: '20px', height: '14px', borderRadius: '2px', objectFit: 'cover', flexShrink: 0 }}
                      />
                    )}
                  </div>
                </div>

                {/* Badge de estado */}
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '8px' }}>
                  {unsaved ? (
                    <span style={{
                      padding: '2px 10px', borderRadius: '3px', fontSize: '10px',
                      background: 'var(--gold-dim)', color: 'var(--gold)'
                    }}>
                      Sin guardar
                    </span>
                  ) : saved ? (
                    <span style={{
                      padding: '2px 10px', borderRadius: '3px', fontSize: '10px',
                      background: 'var(--green-light)', color: 'var(--green)'
                    }}>
                      Guardado
                    </span>
                  ) : (
                    <span style={{
                      padding: '2px 10px', borderRadius: '3px', fontSize: '10px',
                      background: 'var(--bg-secondary)', color: 'var(--text-dim)'
                    }}>
                      Pendiente
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ))}

      {/* Mensaje */}
      {message && (
        <div style={{
          padding: '10px 12px',
          marginTop: '12px',
          background: message.includes('Error') ? 'var(--red-bg)' : 'var(--green-light)',
          borderRadius: '6px',
          fontSize: '13px',
          textAlign: 'center',
          color: message.includes('Error') ? 'var(--red)' : 'var(--green)'
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
          padding: '13px',
          marginTop: '14px',
          background: 'var(--green)',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          fontSize: '13px',
          fontWeight: '600',
          cursor: saving ? 'not-allowed' : 'pointer',
          letterSpacing: '0.5px',
          textTransform: 'uppercase',
          opacity: saving ? 0.7 : 1
        }}
      >
        {saving ? 'Guardando...' : `Guardar grupo ${activeGroup}`}
      </button>
    </div>
  )
}