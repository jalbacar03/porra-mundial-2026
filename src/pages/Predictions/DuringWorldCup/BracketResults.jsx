import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../supabase'

const STAGE_ORDER = ['r32', 'r16', 'quarter_final', 'semi_final', 'final']
const STAGE_LABELS = {
  r32: 'Dieciseisavos', r16: 'Octavos',
  quarter_final: 'Cuartos', semi_final: 'Semifinales', final: 'Final'
}

export default function BracketResults({ session }) {
  const [matches, setMatches] = useState([])
  const [predictions, setPredictions] = useState({}) // matchId → { home, away }
  const [savedPredictions, setSavedPredictions] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState({})
  const [activeRound, setActiveRound] = useState('r32')
  const [now, setNow] = useState(new Date())

  const userId = session?.user?.id

  // Tick every minute
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const [matchesRes, predsRes] = await Promise.all([
      supabase.from('matches')
        .select('id, stage, status, home_score, away_score, match_date, home_team_id, away_team_id, home_team:teams!matches_home_team_id_fkey(id, name, flag_url), away_team:teams!matches_away_team_id_fkey(id, name, flag_url)')
        .neq('stage', 'group')
        .order('id', { ascending: true }),
      userId ? supabase.from('predictions')
        .select('match_id, predicted_home, predicted_away')
        .eq('user_id', userId)
        .gte('match_id', 73) : { data: [] }
    ])

    setMatches(matchesRes.data || [])

    const predMap = {}
    ;(predsRes.data || []).forEach(p => {
      if (p.predicted_home !== null && p.predicted_away !== null) {
        predMap[p.match_id] = { home: p.predicted_home, away: p.predicted_away }
      }
    })
    setPredictions(predMap)
    setSavedPredictions(predMap)
    setLoading(false)

    // Auto-select most relevant round
    const m = matchesRes.data || []
    const firstOpen = STAGE_ORDER.find(s => m.some(match => match.stage === s && match.status !== 'finished'))
    if (firstOpen) setActiveRound(firstOpen)
  }

  // Deadline: 3h before match
  function getDeadline(matchDate) {
    return new Date(new Date(matchDate).getTime() - 3 * 60 * 60 * 1000)
  }

  function isBettingOpen(match) {
    if (match.status === 'finished') return false
    if (!match.match_date) return false
    return now < getDeadline(match.match_date)
  }

  function formatCountdown(matchDate) {
    const deadline = getDeadline(matchDate)
    const diff = deadline - now
    if (diff <= 0) return null
    const days = Math.floor(diff / 86400000)
    const hours = Math.floor((diff % 86400000) / 3600000)
    const mins = Math.floor((diff % 3600000) / 60000)
    if (days > 0) return `${days}d ${hours}h`
    if (hours > 0) return `${hours}h ${mins}m`
    return `${mins}m`
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

  const handleSave = useCallback(async (matchId) => {
    if (!userId) return
    const pred = predictions[matchId]
    if (!pred || pred.home === '' || pred.home === undefined ||
        pred.away === '' || pred.away === undefined) return

    setSaving(s => ({ ...s, [matchId]: true }))

    const { error } = await supabase.from('predictions').upsert({
      user_id: userId,
      match_id: matchId,
      predicted_home: pred.home,
      predicted_away: pred.away
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
      if (pred && pred.home !== '' && pred.home !== undefined &&
          pred.away !== '' && pred.away !== undefined && isBettingOpen(match)) {
        toSave.push({
          user_id: userId,
          match_id: match.id,
          predicted_home: pred.home,
          predicted_away: pred.away
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
        newSaved[p.match_id] = { home: p.predicted_home, away: p.predicted_away }
      })
      setSavedPredictions(newSaved)
    }
    setSaving(s => ({ ...s, round: false }))
  }, [userId, matches, predictions, activeRound, savedPredictions])

  // Scoring helpers
  function getMatchResult(match, pred) {
    if (!match || match.status !== 'finished' || !pred) return null
    if (match.home_score === null || match.away_score === null) return null
    if (pred.home === '' || pred.home === undefined) return null

    const isExact = pred.home === match.home_score && pred.away === match.away_score
    const realSign = match.home_score > match.away_score ? '1' : match.home_score < match.away_score ? '2' : 'X'
    const predSign = pred.home > pred.away ? '1' : pred.home < pred.away ? '2' : 'X'
    const isSign = realSign === predSign

    if (isExact) return { type: 'exact', points: 3 }
    if (isSign) return { type: 'sign', points: 1 }
    return { type: 'fallo', points: 0 }
  }

  function hasUnsavedChanges(matchId) {
    const current = predictions[matchId]
    const saved = savedPredictions[matchId]
    if (!current || current.home === '' || current.home === undefined) return false
    if (!saved) return true
    return current.home !== saved.home || current.away !== saved.away
  }

  if (loading) {
    return <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>Cargando cuadro...</div>
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

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '14px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 4px' }}>
          Cuadro de eliminatorias
        </h3>
        <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: 0 }}>
          Predice el resultado a 90 minutos. Apuestas cierran 3h antes del inicio.
        </p>
        <div style={{
          marginTop: '8px', display: 'flex', gap: '12px',
          fontSize: '10px', color: 'var(--text-dim)'
        }}>
          <span><strong style={{ color: '#4ade80' }}>3 pts</strong> exacto</span>
          <span><strong style={{ color: 'var(--gold)' }}>1 pt</strong> signo 1X2</span>
          <span><strong style={{ color: 'var(--text-dim)' }}>0</strong> fallo</span>
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

      {/* Match cards */}
      {activeRoundData && (
        <div>
          {activeRoundData.matches.map(match => {
            const isFinished = match.status === 'finished'
            const open = isBettingOpen(match)
            const pred = predictions[match.id] || {}
            const saved = savedPredictions[match.id]
            const countdown = match.match_date ? formatCountdown(match.match_date) : null
            const isSaving = saving[match.id]
            const result = getMatchResult(match, saved)
            const unsaved = hasUnsavedChanges(match.id)

            return (
              <div key={match.id} style={{
                background: 'var(--bg-secondary)', borderRadius: '10px', padding: '12px 14px',
                marginBottom: '8px',
                borderLeft: result
                  ? result.type === 'exact' ? '3px solid var(--gold)'
                  : result.type === 'sign' ? '3px solid var(--green)'
                  : '3px solid var(--red)'
                  : isFinished ? '3px solid var(--green)' : '3px solid var(--border)',
                border: result
                  ? result.type === 'exact' ? '1px solid rgba(255,204,0,0.3)'
                  : result.type === 'sign' ? '1px solid rgba(0,122,69,0.2)'
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
                  {!isFinished && open && countdown && (
                    <span style={{ fontSize: '9px', color: 'var(--gold)', fontWeight: '600' }}>⏱ {countdown}</span>
                  )}
                  {!isFinished && !open && (
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
                      {match.home_team?.name || 'TBD'}
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
                      {match.away_team?.name || 'TBD'}
                    </span>
                  </div>
                </div>

                {/* Result feedback for finished matches */}
                {isFinished && saved && result && (
                  <div style={{
                    marginTop: '8px', textAlign: 'center', fontSize: '10px'
                  }}>
                    <span style={{ color: 'var(--text-dim)' }}>
                      Tu prediccion: {saved.home}-{saved.away}
                    </span>
                    <span style={{
                      marginLeft: '8px', fontWeight: '600',
                      color: result.type === 'exact' ? 'var(--gold)' :
                             result.type === 'sign' ? '#4ade80' : '#e74c3c'
                    }}>
                      {result.type === 'exact' ? `¡Exacto! +${result.points}` :
                       result.type === 'sign' ? `Signo OK +${result.points}` :
                       'Fallo'}
                    </span>
                  </div>
                )}
                {isFinished && !saved && (
                  <div style={{ marginTop: '8px', textAlign: 'center', fontSize: '10px', color: 'var(--text-dim)' }}>
                    No predijiste este partido
                  </div>
                )}

                {/* Saved indicator */}
                {!isFinished && saved && !unsaved && (
                  <div style={{ marginTop: '6px', textAlign: 'center', fontSize: '10px', color: 'var(--green)', fontWeight: '600' }}>
                    ✓ Guardado ({saved.home}-{saved.away})
                  </div>
                )}
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
