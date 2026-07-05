import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../../../supabase'
import { FootballSpinner } from '../../../components/Skeleton'
import { KNOCKOUT_PREDICTIONS_DEADLINE } from '../../../hooks/useCountdown'
import { matchCCPoints } from '../../../utils/livePoints'

// La BD guarda estos literales EXACTOS en matches.stage (los escribe
// syncKnockoutTeams). NO usar 'r32'/'quarter_final' — no existen en la tabla y
// dejarían el cuadro real sin partidos.
const STAGE_ORDER = ['Round of 32', 'Round of 16', 'Quarter-finals', 'Semi-finals', 'Third place', 'Final']
const STAGE_LABELS = {
  'Round of 32': 'Dieciseisavos', 'Round of 16': 'Octavos',
  'Quarter-finals': 'Cuartos', 'Semi-finals': 'Semifinales',
  'Third place': '3er puesto', 'Final': 'Final'
}
const R32_STAGE = 'Round of 32'

export default function BracketResults({ session }) {
  const [matches, setMatches] = useState([])
  const [predictions, setPredictions] = useState({}) // matchId → { home, away }
  const [savedPredictions, setSavedPredictions] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState({})
  const [activeRound, setActiveRound] = useState(R32_STAGE)
  const [now, setNow] = useState(new Date())
  const [bracketPicks, setBracketPicks] = useState([])   // cuadro ciego → CC por partido

  const userId = session?.user?.id

  // Tick cada segundo (para el timer único del bloque)
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const [matchesRes, predsRes] = await Promise.all([
      supabase.from('matches')
        .select('id, stage, status, home_score, away_score, reg_home_score, reg_away_score, winner_team_id, match_date, home_team_id, away_team_id, home_team:teams!matches_home_team_id_fkey(id, name, flag_url), away_team:teams!matches_away_team_id_fkey(id, name, flag_url)')
        .neq('stage', 'group')
        .order('id', { ascending: true }),
      userId ? supabase.from('predictions')
        .select('match_id, predicted_home, predicted_away, predicted_advancer_id')
        .eq('user_id', userId)
        .gte('match_id', 73) : { data: [] }
    ])

    setMatches(matchesRes.data || [])

    const predMap = {}
    ;(predsRes.data || []).forEach(p => {
      if (p.predicted_home !== null && p.predicted_away !== null) {
        predMap[p.match_id] = { home: p.predicted_home, away: p.predicted_away, advancer: p.predicted_advancer_id ?? null }
      }
    })
    setPredictions(predMap)
    setSavedPredictions(predMap)
    setLoading(false)

    // Cuadro ciego del usuario → para el CC por partido
    if (userId) {
      const { data: bp } = await supabase.from('bracket_picks')
        .select('round, predicted_winner_id').eq('user_id', userId)
      setBracketPicks(bp || [])
    }

    // Auto-select most relevant round
    const m = matchesRes.data || []
    const firstOpen = STAGE_ORDER.find(s => m.some(match => match.stage === s && match.status !== 'finished'))
    if (firstOpen) setActiveRound(firstOpen)
  }

  // ¿Equipos reales ya determinados? (antes del sorteo/sync son null → no se predice)
  function teamsSet(match) {
    return match.home_team_id != null && match.away_team_id != null
  }

  // Una ronda solo se abre para predecir cuando TODOS sus cruces ya se conocen
  // (p.ej. cuartos espera a que acaben los 8 octavos). Así no se puede rellenar
  // un cruce suelto de la siguiente ronda antes de que esté completa.
  function roundFullyKnown(stage) {
    const ms = matches.filter(m => m.stage === stage)
    return ms.length > 0 && ms.every(m => m.home_team_id != null && m.away_team_id != null)
  }

  // Cierre POR PARTIDO: cada cruce admite predicción hasta que empieza ESE
  // partido (no un cierre único de ronda). Los ya jugados quedan cerrados por
  // status='finished'. La ronda debe estar completa (todos los cruces conocidos)
  // para poder empezar a predecir cualquiera de ella.
  function isBettingOpen(match) {
    if (match.status === 'finished') return false
    if (!teamsSet(match)) return false
    if (!roundFullyKnown(match.stage)) return false
    if (!match.match_date) return false
    return now < new Date(match.match_date)
  }

  function updatePrediction(matchId, field, value) {
    if (value !== '' && (isNaN(value) || parseInt(value) < 0 || parseInt(value) > 99)) return
    setPredictions(prev => {
      const next = { ...prev[matchId], [field]: value === '' ? '' : parseInt(value) }
      // Si el marcador pasa a ser decisivo (gana uno), "quién pasa" es implícito
      // → se limpia el selector. Solo se conserva el advancer en empates.
      if (next.home !== '' && next.home != null && next.away !== '' && next.away != null && next.home !== next.away) {
        next.advancer = null
      }
      return { ...prev, [matchId]: next }
    })
  }

  // Selector "¿quién pasa?" (solo aparece en empates).
  function setAdvancer(matchId, teamId) {
    setPredictions(prev => ({ ...prev, [matchId]: { ...prev[matchId], advancer: teamId } }))
  }

  // Una predicción está COMPLETA si tiene marcador y, en caso de empate, también
  // quién pasa (prórroga/penaltis).
  function predComplete(p) {
    if (!p || p.home === '' || p.home == null || p.away === '' || p.away == null) return false
    if (p.home === p.away) return p.advancer != null
    return true
  }

  const handleSave = useCallback(async (matchId) => {
    if (!userId) return
    const pred = predictions[matchId]
    if (!predComplete(pred)) return

    setSaving(s => ({ ...s, [matchId]: true }))

    const { error } = await supabase.from('predictions').upsert({
      user_id: userId,
      match_id: matchId,
      predicted_home: pred.home,
      predicted_away: pred.away,
      predicted_advancer_id: pred.home === pred.away ? pred.advancer : null
    }, { onConflict: 'user_id,match_id' })

    if (!error) {
      setSavedPredictions(prev => ({ ...prev, [matchId]: { ...pred } }))
    }

    setSaving(s => ({ ...s, [matchId]: false }))
  }, [userId, predictions])

  // Save all predictions for active round
  const handleSaveRound = useCallback(async () => {
    if (!userId) return
    const roundMatches = matches.filter(m => m.stage === activeRound)
    const toSave = []

    for (const match of roundMatches) {
      const pred = predictions[match.id]
      if (predComplete(pred) && isBettingOpen(match)) {
        toSave.push({
          user_id: userId,
          match_id: match.id,
          predicted_home: pred.home,
          predicted_away: pred.away,
          predicted_advancer_id: pred.home === pred.away ? pred.advancer : null
        })
      }
    }

    if (toSave.length === 0) return

    setSaving(s => ({ ...s, round: true }))
    const { error } = await supabase
      .from('predictions')
      .upsert(toSave, { onConflict: 'user_id,match_id' })

    if (!error) {
      const newSaved = { ...savedPredictions }
      toSave.forEach(p => {
        newSaved[p.match_id] = { home: p.predicted_home, away: p.predicted_away, advancer: p.predicted_advancer_id }
      })
      setSavedPredictions(newSaved)
    }
    setSaving(s => ({ ...s, round: false }))
  }, [userId, matches, predictions, activeRound, savedPredictions])

  // Scoring helper (post-partido): +1 por acertar quién pasa, +2 por el resultado
  // exacto a 90' (reg_*). Quién pasa predicho = ganador del marcador si decisivo,
  // o el advancer elegido si empate.
  function getMatchResult(match, pred) {
    if (!match || match.status !== 'finished' || !pred) return null
    if (match.winner_team_id == null || match.reg_home_score == null || match.reg_away_score == null) return null
    if (pred.home === '' || pred.home == null) return null

    const predAdv = pred.home > pred.away ? match.home_team_id
      : pred.home < pred.away ? match.away_team_id : pred.advancer
    const advOk = predAdv != null && predAdv === match.winner_team_id
    const resOk = pred.home === match.reg_home_score && pred.away === match.reg_away_score
    const points = (advOk ? 1 : 0) + (resOk ? 2 : 0)
    return { points, advOk, resOk }
  }

  function hasUnsavedChanges(matchId) {
    const current = predictions[matchId]
    const saved = savedPredictions[matchId]
    if (!predComplete(current)) return false
    if (!saved) return true
    return current.home !== saved.home || current.away !== saved.away ||
      (current.advancer ?? null) !== (saved.advancer ?? null)
  }

  if (loading) {
    return <FootballSpinner text="Cargando cuadro…" />
  }

  if (matches.length === 0) {
    return <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>Las eliminatorias aun no han comenzado</div>
  }

  const roundMatches = STAGE_ORDER.map(stage => ({
    stage, label: STAGE_LABELS[stage],
    matches: matches.filter(m => m.stage === stage)
  })).filter(r => r.matches.length > 0)

  const activeRoundData = roundMatches.find(r => r.stage === activeRound)
  const hasAnyUnsaved = activeRoundData?.matches.some(m => hasUnsavedChanges(m.id) && isBettingOpen(m))

  // Banner de estado de la ronda activa (cierre POR PARTIDO). Contamos cuántos
  // cruces siguen abiertos (aún no empezados) y cuál es el próximo en cerrarse.
  const activeAllFinished = activeRoundData?.matches.every(m => m.status === 'finished')
  const activeRoundKnown = activeRoundData?.matches.every(m => teamsSet(m))
  const openMatches = activeRoundData?.matches.filter(m => isBettingOpen(m)) || []
  const nextClose = openMatches.length
    ? new Date(Math.min(...openMatches.map(m => new Date(m.match_date).getTime())))
    : null
  const nextCloseStr = nextClose
    ? nextClose.toLocaleString('es-ES', { weekday: 'long', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' })
    : null

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '14px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 4px' }}>
          Cuadro de eliminatorias
        </h3>
        <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: 0 }}>
          Predice el resultado a 90 minutos. Cada cruce se cierra cuando empieza ese partido.
        </p>
        <div style={{
          marginTop: '8px', display: 'flex', gap: '12px',
          fontSize: '10px', color: 'var(--text-dim)'
        }}>
          <span><strong style={{ color: '#60a5fa' }}>+1</strong> quién pasa</span>
          <span><strong style={{ color: 'var(--gold)' }}>+2</strong> resultado a 90'</span>
          <span><strong style={{ color: 'var(--text-dim)' }}>máx 3</strong></span>
        </div>
      </div>

      {/* Round tabs */}
      <div style={{
        display: 'flex', gap: '4px', marginBottom: '14px',
        padding: '3px', background: 'var(--bg-input)', borderRadius: '8px', overflowX: 'auto'
      }}>
        {roundMatches.map(round => {
          const finished = round.matches.filter(m => m.status === 'finished').length
          const total = round.matches.length
          const predicted = round.matches.filter(m => savedPredictions[m.id]).length
          return (
            <button key={round.stage} onClick={() => setActiveRound(round.stage)} style={{
              flex: 1, padding: '7px 4px', borderRadius: '6px', border: 'none',
              background: activeRound === round.stage ? 'var(--bg-secondary)' : 'transparent',
              color: activeRound === round.stage ? 'var(--text-primary)' : 'var(--text-muted)',
              fontSize: '10px', fontWeight: activeRound === round.stage ? '600' : '400',
              cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0
            }}>
              {round.label}
              {finished === total && total > 0 ? (
                <span style={{ display: 'block', fontSize: '8px', color: 'var(--green)', marginTop: '1px' }}>✓ {finished}/{total}</span>
              ) : (
                <span style={{ display: 'block', fontSize: '8px', color: 'var(--text-dim)', marginTop: '1px' }}>{predicted}/{total}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Banner de estado — cierre POR PARTIDO (cada cruce hasta que empieza) */}
      {activeRoundData && !activeAllFinished && (
        <div style={{
          marginBottom: '12px', padding: '12px 14px', borderRadius: '10px',
          background: openMatches.length ? 'rgba(255,204,0,0.08)' : 'var(--bg-secondary)',
          border: openMatches.length ? '1px solid rgba(255,204,0,0.22)' : '0.5px solid var(--border)',
          fontSize: '11px', lineHeight: '1.45', color: 'var(--text-muted)'
        }}>
          {!activeRoundKnown ? (
            <span>⏳ <strong>Emparejamientos por confirmar.</strong> En cuanto se jueguen los cruces anteriores aparecerán los rivales y podrás predecir.</span>
          ) : openMatches.length > 0 ? (
            <span>🟢 <strong>Predice los cruces que aún no se han jugado.</strong> Cada uno se cierra cuando empieza ese partido{nextCloseStr ? <> — el próximo cierra <span style={{ textTransform: 'capitalize', color: 'var(--text-primary)', fontWeight: 700 }}>{nextCloseStr}</span></> : ''}.</span>
          ) : (
            <span>🔒 <strong>Sin cruces abiertos.</strong> Todos los partidos de esta ronda ya han empezado o terminado.</span>
          )}
        </div>
      )}

      {/* Match cards */}
      {activeRoundData && (
        <div>
          {activeRoundData.matches.map(match => {
            const isFinished = match.status === 'finished'
            const tset = teamsSet(match)
            const open = isBettingOpen(match)
            const pred = predictions[match.id] || {}
            const saved = savedPredictions[match.id]
            const isSaving = saving[match.id]
            const result = getMatchResult(match, saved)
            const unsaved = hasUnsavedChanges(match.id)

            return (
              <div key={match.id} style={{
                background: 'var(--bg-secondary)', borderRadius: '10px', padding: '12px 14px',
                marginBottom: '8px',
                borderLeft: result
                  ? result.points === 3 ? '3px solid var(--gold)'
                  : result.points > 0 ? '3px solid #2563eb'
                  : '3px solid var(--red)'
                  : '3px solid var(--border)',
                border: result
                  ? result.points === 3 ? '1px solid rgba(255,204,0,0.3)'
                  : result.points > 0 ? '1px solid rgba(37,99,235,0.2)'
                  : '1px solid rgba(231,76,60,0.2)'
                  : '0.5px solid var(--border)'
              }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '9px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    #{match.id} · {activeRoundData.label}
                  </span>
                  {isFinished && (
                    <span style={{ fontSize: '9px', color: 'var(--green)', fontWeight: '600' }}>Finalizado</span>
                  )}
                  {!isFinished && !tset && (
                    <span style={{ fontSize: '9px', color: 'var(--text-dim)', fontWeight: '600' }}>⏳ Por determinar</span>
                  )}
                  {!isFinished && tset && open && (
                    <span style={{ fontSize: '9px', color: '#60a5fa', fontWeight: '600' }}>Abierto</span>
                  )}
                  {!isFinished && tset && !open && (
                    <span style={{ fontSize: '9px', color: 'var(--red)', fontWeight: '600' }}>🔒 Cerrado</span>
                  )}
                </div>

                {/* Score row: Home [input] - [input] Away */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {/* Home team */}
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                    <span style={{
                      fontSize: '12px', fontWeight: '500', color: 'var(--text-primary)',
                      textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>
                      {match.home_team?.name || 'Por determinar'}
                    </span>
                    {match.home_team?.flag_url && (
                      <img src={match.home_team.flag_url} alt="" style={{
                        width: '20px', height: '14px', borderRadius: '2px', objectFit: 'cover', flexShrink: 0
                      }} />
                    )}
                  </div>

                  {/* Score inputs or final result */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                    {isFinished ? (
                      <>
                        <div style={{
                          width: '32px', height: '32px', borderRadius: '6px',
                          background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)'
                        }}>
                          {match.home_score}
                        </div>
                        <span style={{ fontSize: '12px', color: 'var(--text-dim)', fontWeight: '700' }}>-</span>
                        <div style={{
                          width: '32px', height: '32px', borderRadius: '6px',
                          background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)'
                        }}>
                          {match.away_score}
                        </div>
                      </>
                    ) : (
                      <>
                        <input
                          type="number"
                          min="0" max="99"
                          value={pred.home ?? ''}
                          onChange={e => updatePrediction(match.id, 'home', e.target.value)}
                          disabled={!open}
                          style={{
                            width: '36px', height: '36px', borderRadius: '6px',
                            border: unsaved ? '1.5px solid var(--gold)' : '1.5px solid var(--border)',
                            background: 'var(--bg-input)', color: 'var(--text-primary)',
                            fontSize: '16px', fontWeight: '700', textAlign: 'center',
                            outline: 'none', opacity: open ? 1 : 0.5
                          }}
                        />
                        <span style={{ fontSize: '12px', color: 'var(--text-dim)', fontWeight: '700' }}>-</span>
                        <input
                          type="number"
                          min="0" max="99"
                          value={pred.away ?? ''}
                          onChange={e => updatePrediction(match.id, 'away', e.target.value)}
                          disabled={!open}
                          style={{
                            width: '36px', height: '36px', borderRadius: '6px',
                            border: unsaved ? '1.5px solid var(--gold)' : '1.5px solid var(--border)',
                            background: 'var(--bg-input)', color: 'var(--text-primary)',
                            fontSize: '16px', fontWeight: '700', textAlign: 'center',
                            outline: 'none', opacity: open ? 1 : 0.5
                          }}
                        />
                      </>
                    )}
                  </div>

                  {/* Away team */}
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {match.away_team?.flag_url && (
                      <img src={match.away_team.flag_url} alt="" style={{
                        width: '20px', height: '14px', borderRadius: '2px', objectFit: 'cover', flexShrink: 0
                      }} />
                    )}
                    <span style={{
                      fontSize: '12px', fontWeight: '500', color: 'var(--text-primary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>
                      {match.away_team?.name || 'Por determinar'}
                    </span>
                  </div>
                </div>

                {/* ¿Quién pasa? — SOLO en empates (en marcador decisivo es implícito) */}
                {!isFinished && open && pred.home !== '' && pred.home != null &&
                  pred.away !== '' && pred.away != null && pred.home === pred.away && (
                  <div style={{ marginTop: '10px' }}>
                    <div style={{
                      fontSize: '10px', textAlign: 'center', marginBottom: '6px',
                      color: pred.advancer == null ? 'var(--gold)' : 'var(--text-dim)',
                      fontWeight: pred.advancer == null ? '700' : '400'
                    }}>
                      Empate — ¿quién pasa? (prórroga/penaltis)
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {[match.home_team, match.away_team].map(t => t && (
                        <button key={t.id} onClick={() => setAdvancer(match.id, t.id)} style={{
                          flex: 1, padding: '7px 6px', borderRadius: '6px', cursor: 'pointer',
                          border: pred.advancer === t.id ? '1.5px solid #60a5fa' : '1px solid var(--border)',
                          background: pred.advancer === t.id ? 'rgba(37,99,235,0.15)' : 'var(--bg-input)',
                          color: pred.advancer === t.id ? '#60a5fa' : 'var(--text-muted)',
                          fontSize: '11px', fontWeight: pred.advancer === t.id ? '700' : '500',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                        }}>
                          {pred.advancer === t.id ? '✓ ' : ''}{t.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Result feedback for finished matches */}
                {isFinished && saved && result && (() => {
                  const advName = saved.advancer === match.home_team_id ? match.home_team?.name
                    : saved.advancer === match.away_team_id ? match.away_team?.name : null
                  const parts = [result.advOk ? 'quién pasa' : null, result.resOk ? 'resultado' : null].filter(Boolean)
                  return (
                    <div style={{ marginTop: '8px', textAlign: 'center', fontSize: '10px' }}>
                      <span style={{ color: 'var(--text-dim)' }}>
                        Tu predicción: {saved.home}-{saved.away}{saved.home === saved.away && advName ? ` (pasa ${advName})` : ''}
                      </span>
                      <span style={{
                        marginLeft: '8px', fontWeight: '600',
                        color: result.points === 3 ? 'var(--gold)' : result.points > 0 ? '#60a5fa' : '#e74c3c'
                      }}>
                        {result.points > 0 ? `+${result.points}${parts.length ? ` (${parts.join(' + ')})` : ''}` : 'Fallo'}
                      </span>
                      {(() => {
                        const cc = matchCCPoints(bracketPicks, match)
                        return cc > 0
                          ? <span style={{ marginLeft: '6px', fontWeight: '700', color: '#c084fc' }}>· CC +{cc}</span>
                          : null
                      })()}
                    </div>
                  )
                })()}
                {isFinished && !saved && (
                  <div style={{ marginTop: '8px', textAlign: 'center', fontSize: '10px', color: 'var(--text-dim)' }}>
                    No predijiste este partido
                  </div>
                )}

                {/* Saved indicator */}
                {!isFinished && saved && !unsaved && (() => {
                  const advName = saved.advancer === match.home_team_id ? match.home_team?.name
                    : saved.advancer === match.away_team_id ? match.away_team?.name : null
                  return (
                    <div style={{ marginTop: '6px', textAlign: 'center', fontSize: '10px', color: 'var(--green)', fontWeight: '600' }}>
                      ✓ Guardado ({saved.home}-{saved.away}{saved.home === saved.away && advName ? `, pasa ${advName}` : ''})
                    </div>
                  )
                })()}
              </div>
            )
          })}

          {/* Save all button */}
          {hasAnyUnsaved && (
            <button
              onClick={handleSaveRound}
              disabled={saving.round}
              style={{
                width: '100%', padding: '12px', marginTop: '8px',
                borderRadius: '8px', border: 'none',
                background: 'var(--green)', color: '#fff',
                fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                opacity: saving.round ? 0.6 : 1
              }}
            >
              {saving.round ? 'Guardando...' : `Guardar predicciones — ${activeRoundData.label}`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
