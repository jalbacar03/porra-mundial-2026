import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../../supabase'
import { calculateGroupStandings } from '../../../utils/groupStandings'
import { generateMockPredictions, generateDemoMatchStatuses } from '../../../hooks/useDemoMode'
import { useToast } from '../../../components/Toast'
import { SkeletonCard } from '../../../components/Skeleton'
import { useRateLimit } from '../../../hooks/useRateLimit'
import { PulseDots } from '../../../components/Skeleton'

export default function GroupMatchPredictions({ session, deadline, demoMode }) {
  const [matches, setMatches] = useState([])
  const [predictions, setPredictions] = useState({})
  const [savedPredictions, setSavedPredictions] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeGroup, setActiveGroup] = useState('A')
  const toast = useToast()
  const guard = useRateLimit()

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
      toast.info('No hay predicciones completas para guardar en este grupo')
      setSaving(false)
      return
    }

    const { error } = await supabase
      .from('predictions')
      .upsert(toSave, { onConflict: 'user_id,match_id' })

    if (error) {
      toast.error('Error al guardar: ' + error.message)
    } else {
      const newSaved = { ...savedPredictions }
      toSave.forEach(p => {
        newSaved[p.match_id] = {
          home_score: p.predicted_home,
          away_score: p.predicted_away
        }
      })
      setSavedPredictions(newSaved)
      toast.success(`${toSave.length} predicciones guardadas — Grupo ${activeGroup}`)
    }
    setSaving(false)
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

  // Calculate standings from saved predictions
  const { groupStandings, qualified32 } = useMemo(() => {
    if (!matches.length) return { groupStandings: {}, qualified32: [] }
    // Merge saved + current predictions (saved takes priority for standings)
    const allPreds = { ...predictions }
    Object.keys(savedPredictions).forEach(k => {
      if (savedPredictions[k].home_score != null && savedPredictions[k].away_score != null) {
        allPreds[k] = savedPredictions[k]
      }
    })
    return calculateGroupStandings(matches, allPreds)
  }, [matches, savedPredictions, predictions])

  // Demo mode: generate mock predictions and match statuses
  const demoPredictions = useMemo(() => {
    if (!demoMode || !matches.length) return null
    return generateMockPredictions(matches)
  }, [demoMode, matches])

  const demoMatches = useMemo(() => {
    if (!demoMode || !matches.length) return null
    return generateDemoMatchStatuses(matches)
  }, [demoMode, matches])

  // Use demo data if active, otherwise real data
  const displayPredictions = demoMode && demoPredictions ? demoPredictions : predictions
  const displaySavedPredictions = demoMode && demoPredictions ? demoPredictions : savedPredictions
  const displayMatches = demoMode && demoMatches ? demoMatches : matches

  // Recalculate standings with display data
  const { groupStandings: demoGroupStandings } = useMemo(() => {
    if (!demoMode || !demoMatches?.length || !demoPredictions) return { groupStandings: {} }
    return calculateGroupStandings(demoMatches, demoPredictions)
  }, [demoMode, demoMatches, demoPredictions])

  const activeGroupStandings = demoMode && demoGroupStandings
    ? (demoGroupStandings[activeGroup] || [])
    : (groupStandings[activeGroup] || [])
  const currentGroupStandings = activeGroupStandings
  const groupHasPredictions = currentGroupStandings.some(t => t.played > 0) || demoMode

  if (loading) {
    return (
      <div style={{ padding: '16px 0' }}>
        {Array.from({ length: 4 }, (_, i) => <SkeletonCard key={i} />)}
      </div>
    )
  }

  const groupMatches = displayMatches.filter(m => m.group_name === activeGroup)
  const groupTotal = groupMatches.length
  const groupDone = demoMode ? groupTotal : countGroupPredictions(activeGroup)

  const matchesByMatchday = {}
  groupMatches.forEach(m => {
    const key = m.matchday || 1
    if (!matchesByMatchday[key]) matchesByMatchday[key] = []
    matchesByMatchday[key].push(m)
  })

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '14px' }}>
        <h3 style={{
          fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)',
          margin: '0 0 4px'
        }}>
          Partidos Fase de Grupos
        </h3>
        <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: 0 }}>
          Introduce el resultado exacto de cada partido
        </p>
      </div>

      {/* Group tabs */}
      <div className="group-tabs" style={{ marginBottom: '16px' }}>
        {groups.map(g => {
          const total = displayMatches.filter(m => m.group_name === g).length
          const done = demoMode ? total : countGroupPredictions(g)
          const isActive = activeGroup === g
          const isComplete = done === total && total > 0
          return (
            <button
              key={g}
              onClick={() => setActiveGroup(g)}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                border: 'none',
                background: isActive ? 'var(--green)' : isComplete ? 'var(--green-light)' : 'var(--bg-secondary)',
                color: isActive ? '#fff' : isComplete ? 'var(--green)' : 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: isActive ? '600' : '400',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                transition: 'all 0.2s ease'
              }}
            >
              {g} <span style={{ opacity: 0.6, fontSize: '10px' }}>{done}/{total}</span>
            </button>
          )
        })}
      </div>

      {/* Group progress */}
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

      {/* Matches by matchday */}
      {Object.entries(matchesByMatchday).map(([matchday, mdMatches]) => (
        <div key={matchday}>
          <div style={{
            fontSize: '10px', color: 'var(--text-dim)',
            textTransform: 'uppercase', letterSpacing: '0.8px',
            padding: '10px 0 6px',
            borderBottom: '0.5px solid var(--border-light)'
          }}>
            Jornada {matchday}
          </div>

          {mdMatches.map(match => {
            const pred = demoMode ? (displayPredictions[match.id] || {}) : (predictions[match.id] || {})
            const unsaved = demoMode ? false : hasUnsavedChanges(match.id)
            const saved = demoMode ? true : isSaved(match.id)
            const isFinished = match.status === 'finished'
            const isLive = match.status === 'live'

            // In demo mode, calculate points for finished matches
            let demoPoints = null
            if (demoMode && isFinished && pred.home_score !== undefined) {
              const predSign = Math.sign(pred.home_score - pred.away_score)
              const realSign = Math.sign(match.home_score - match.away_score)
              if (pred.home_score === match.home_score && pred.away_score === match.away_score) {
                demoPoints = 3
              } else if (predSign === realSign) {
                demoPoints = 1
              } else {
                demoPoints = 0
              }
            }

            return (
              <div key={match.id} style={{
                padding: '12px 0',
                borderBottom: '0.5px solid var(--border-light)'
              }}>
                {/* Date + status badge */}
                <div style={{
                  fontSize: '11px', color: 'var(--text-dim)',
                  marginBottom: '10px', textAlign: 'center',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                }}>
                  <span>{formatDate(match.match_date)}</span>
                  {demoMode && isFinished && (
                    <span style={{
                      fontSize: '9px', padding: '1px 6px', borderRadius: '3px',
                      background: 'rgba(0,122,69,0.1)', color: 'var(--green)', fontWeight: '600'
                    }}>FINAL</span>
                  )}
                  {demoMode && isLive && (
                    <span style={{
                      fontSize: '9px', padding: '1px 6px', borderRadius: '3px',
                      background: 'rgba(226,75,74,0.15)', color: '#ff6b6b', fontWeight: '600',
                      animation: 'pulse 2s infinite'
                    }}>EN VIVO</span>
                  )}
                </div>

                {/* Actual result for finished/live demo matches */}
                {demoMode && (isFinished || isLive) && (
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    marginBottom: '6px', padding: '4px 0'
                  }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Resultado:</span>
                    <span style={{
                      fontSize: '16px', fontWeight: '700',
                      color: isLive ? '#ff6b6b' : 'var(--text-primary)',
                      fontVariantNumeric: 'tabular-nums'
                    }}>
                      {match.home_score} - {match.away_score}
                    </span>
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{
                    flex: 1, display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0
                  }}>
                    {match.home_team?.flag_url && (
                      <img src={match.home_team.flag_url} alt=""
                        style={{ width: '20px', height: '14px', borderRadius: '2px', objectFit: 'cover', flexShrink: 0 }} />
                    )}
                    <span style={{
                      fontSize: '13px', color: 'var(--text-primary)', fontWeight: '500',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>
                      {match.home_team?.name || 'TBD'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '0 4px', flexShrink: 0 }}>
                    <input
                      type="number" min="0" max="99"
                      value={pred.home_score ?? ''}
                      onChange={e => !demoMode && updatePrediction(match.id, 'home_score', e.target.value)}
                      disabled={deadline.expired || demoMode}
                      style={{
                        width: '36px', height: '32px', textAlign: 'center',
                        fontSize: '15px', fontWeight: '600', borderRadius: '4px',
                        border: demoMode ? '1px solid var(--border)' : unsaved ? '1px solid var(--gold)' : saved ? '1px solid var(--border)' : '1px solid var(--green)',
                        background: 'var(--bg-input)',
                        color: pred.home_score !== '' && pred.home_score !== undefined ? 'var(--gold)' : 'var(--text-dim)',
                        outline: 'none',
                        opacity: demoMode ? 0.8 : deadline.expired ? 0.5 : 1
                      }}
                    />
                    <span style={{ color: 'var(--text-dim)', fontSize: '11px' }}>:</span>
                    <input
                      type="number" min="0" max="99"
                      value={pred.away_score ?? ''}
                      onChange={e => !demoMode && updatePrediction(match.id, 'away_score', e.target.value)}
                      disabled={deadline.expired || demoMode}
                      style={{
                        width: '36px', height: '32px', textAlign: 'center',
                        fontSize: '15px', fontWeight: '600', borderRadius: '4px',
                        border: demoMode ? '1px solid var(--border)' : unsaved ? '1px solid var(--gold)' : saved ? '1px solid var(--border)' : '1px solid var(--green)',
                        background: 'var(--bg-input)',
                        color: pred.away_score !== '' && pred.away_score !== undefined ? 'var(--gold)' : 'var(--text-dim)',
                        outline: 'none',
                        opacity: demoMode ? 0.8 : deadline.expired ? 0.5 : 1
                      }}
                    />
                  </div>

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
                      <img src={match.away_team.flag_url} alt=""
                        style={{ width: '20px', height: '14px', borderRadius: '2px', objectFit: 'cover', flexShrink: 0 }} />
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '8px', gap: '6px' }}>
                  {demoMode && isFinished && demoPoints !== null ? (
                    <span style={{
                      padding: '2px 10px', borderRadius: '3px', fontSize: '10px', fontWeight: '600',
                      background: demoPoints === 3 ? 'rgba(0,122,69,0.15)' : demoPoints === 1 ? 'rgba(255,204,0,0.1)' : 'rgba(226,75,74,0.1)',
                      color: demoPoints === 3 ? 'var(--green)' : demoPoints === 1 ? 'var(--gold)' : '#e74c3c'
                    }}>
                      {demoPoints === 3 ? 'Exacto +3' : demoPoints === 1 ? 'Signo +1' : 'Fallo 0'}
                    </span>
                  ) : demoMode && isLive ? (
                    <span style={{ padding: '2px 10px', borderRadius: '3px', fontSize: '10px', background: 'rgba(226,75,74,0.1)', color: '#ff6b6b' }}>
                      En juego...
                    </span>
                  ) : demoMode ? (
                    <span style={{ padding: '2px 10px', borderRadius: '3px', fontSize: '10px', background: 'var(--green-light)', color: 'var(--green)' }}>
                      Guardado
                    </span>
                  ) : unsaved ? (
                    <span style={{ padding: '2px 10px', borderRadius: '3px', fontSize: '10px', background: 'var(--gold-dim)', color: 'var(--gold)' }}>
                      Sin guardar
                    </span>
                  ) : saved ? (
                    <span style={{ padding: '2px 10px', borderRadius: '3px', fontSize: '10px', background: 'var(--green-light)', color: 'var(--green)' }}>
                      Guardado
                    </span>
                  ) : (
                    <span style={{ padding: '2px 10px', borderRadius: '3px', fontSize: '10px', background: 'var(--bg-secondary)', color: 'var(--text-dim)' }}>
                      Pendiente
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ))}

      {/* Save button */}
      {!deadline.expired && !demoMode && (
        <button
          onClick={guard(savePredictions)}
          disabled={saving}
          style={{
            width: '100%', padding: '13px', marginTop: '14px',
            background: 'var(--green)', color: '#fff', border: 'none',
            borderRadius: '6px', fontSize: '13px', fontWeight: '600',
            cursor: saving ? 'not-allowed' : 'pointer',
            letterSpacing: '0.5px', textTransform: 'uppercase',
            opacity: saving ? 0.7 : 1
          }}
        >
          {saving ? <><PulseDots color="#fff" /> Guardando</> : `Guardar grupo ${activeGroup}`}
        </button>
      )}

      {/* Mini standings table */}
      {groupHasPredictions && (
        <div style={{
          marginTop: '16px', background: 'var(--bg-secondary)',
          borderRadius: '8px', padding: '12px',
          border: '1px solid rgba(255,255,255,0.05)'
        }}>
          <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            📊 Clasificación Grupo {activeGroup}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
            <thead>
              <tr style={{ color: 'var(--text-dim)', fontSize: '9px', textTransform: 'uppercase' }}>
                <th style={{ textAlign: 'left', padding: '3px 4px' }}>#</th>
                <th style={{ textAlign: 'left', padding: '3px 4px' }}>Equipo</th>
                <th style={{ textAlign: 'center', padding: '3px 4px' }}>PJ</th>
                <th style={{ textAlign: 'center', padding: '3px 4px' }}>G</th>
                <th style={{ textAlign: 'center', padding: '3px 4px' }}>E</th>
                <th style={{ textAlign: 'center', padding: '3px 4px' }}>P</th>
                <th style={{ textAlign: 'center', padding: '3px 4px' }}>DG</th>
                <th style={{ textAlign: 'center', padding: '3px 4px' }}>Pts</th>
              </tr>
            </thead>
            <tbody>
              {currentGroupStandings.map((row, idx) => {
                const isTop2 = idx < 2
                const bgColor = isTop2 ? 'rgba(0,122,69,0.1)' : idx === 2 ? 'rgba(255,204,0,0.06)' : 'transparent'
                const borderLeft = isTop2 ? '3px solid var(--green)' : idx === 2 ? '3px solid rgba(255,204,0,0.3)' : '3px solid transparent'
                return (
                  <tr key={row.team.id} style={{ background: bgColor }}>
                    <td style={{ padding: '5px 4px', borderLeft, fontWeight: '600', color: 'var(--text-dim)' }}>{idx + 1}</td>
                    <td style={{ padding: '5px 4px', fontWeight: '500', color: 'var(--text-primary)' }}>
                      {row.team.flag_url && (
                        <img src={row.team.flag_url} alt="" style={{ width: '14px', height: '10px', marginRight: '5px', verticalAlign: 'middle', borderRadius: '1px' }} />
                      )}
                      {row.team.name}
                    </td>
                    <td style={{ textAlign: 'center', padding: '5px 4px', color: 'var(--text-muted)' }}>{row.played}</td>
                    <td style={{ textAlign: 'center', padding: '5px 4px', color: 'var(--text-muted)' }}>{row.w}</td>
                    <td style={{ textAlign: 'center', padding: '5px 4px', color: 'var(--text-muted)' }}>{row.d}</td>
                    <td style={{ textAlign: 'center', padding: '5px 4px', color: 'var(--text-muted)' }}>{row.l}</td>
                    <td style={{ textAlign: 'center', padding: '5px 4px', color: row.gd > 0 ? 'var(--green)' : row.gd < 0 ? '#e74c3c' : 'var(--text-muted)' }}>
                      {row.gd > 0 ? '+' : ''}{row.gd}
                    </td>
                    <td style={{ textAlign: 'center', padding: '5px 4px', fontWeight: '700', color: '#ffcc00' }}>{row.pts}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div style={{ fontSize: '9px', color: 'var(--text-dim)', marginTop: '6px' }}>
            <span style={{ color: 'var(--green)' }}>■</span> Clasifica directo · <span style={{ color: '#ffcc00' }}>■</span> Posible mejor 3º
          </div>
        </div>
      )}
    </div>
  )
}
