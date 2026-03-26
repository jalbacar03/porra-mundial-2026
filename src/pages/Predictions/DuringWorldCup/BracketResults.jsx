import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../supabase'

const STAGE_ORDER = ['r32', 'r16', 'quarter_final', 'semi_final', 'final']
const STAGE_LABELS = {
  r32: 'Dieciseisavos', r16: 'Octavos',
  quarter_final: 'Cuartos', semi_final: 'Semifinales', final: 'Final'
}
const STAGE_POINTS = {
  r32: 0, r16: 1, quarter_final: 2, semi_final: 4, final: 5
}

export default function BracketResults({ session }) {
  const [matches, setMatches] = useState([])
  const [picks, setPicks] = useState({}) // matchId → 'home' | 'away'
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState({})
  const [activeRound, setActiveRound] = useState('final')
  const [now, setNow] = useState(new Date())

  const userId = session?.user?.id

  // Tick every minute for countdown timers
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const [matchesRes, picksRes] = await Promise.all([
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

    // Convert predictions to picks: predicted_home > predicted_away = 'home', else 'away'
    const pickMap = {}
    ;(picksRes.data || []).forEach(p => {
      if (p.predicted_home !== null && p.predicted_away !== null) {
        pickMap[p.match_id] = p.predicted_home > p.predicted_away ? 'home' : 'away'
      }
    })
    setPicks(pickMap)
    setLoading(false)

    // Auto-select the most relevant round
    const m = matchesRes.data || []
    const firstOpen = STAGE_ORDER.find(s => m.some(match => match.stage === s && match.status !== 'finished'))
    if (firstOpen) setActiveRound(firstOpen)
  }

  const handlePick = useCallback(async (matchId, side) => {
    if (!userId) return
    const prev = picks[matchId]
    if (prev === side) return // already picked this

    // Optimistic update
    setPicks(p => ({ ...p, [matchId]: side }))
    setSaving(s => ({ ...s, [matchId]: true }))

    const predicted_home = side === 'home' ? 1 : 0
    const predicted_away = side === 'away' ? 1 : 0

    const { error } = await supabase.from('predictions').upsert({
      user_id: userId,
      match_id: matchId,
      predicted_home,
      predicted_away
    }, { onConflict: 'user_id,match_id' })

    if (error) {
      // Revert on error
      setPicks(p => ({ ...p, [matchId]: prev }))
      console.error('Error saving pick:', error)
    }

    setSaving(s => ({ ...s, [matchId]: false }))
  }, [userId, picks])

  // Countdown helpers
  function getBettingDeadline(matchDate) {
    return new Date(new Date(matchDate).getTime() - 3 * 60 * 60 * 1000)
  }

  function isBettingOpen(match) {
    if (match.status === 'finished') return false
    if (!match.match_date) return false
    return now < getBettingDeadline(match.match_date)
  }

  function formatCountdown(matchDate) {
    const deadline = getBettingDeadline(matchDate)
    const diff = deadline - now
    if (diff <= 0) return null

    const days = Math.floor(diff / 86400000)
    const hours = Math.floor((diff % 86400000) / 3600000)
    const mins = Math.floor((diff % 3600000) / 60000)

    if (days > 0) return `${days}d ${hours}h`
    if (hours > 0) return `${hours}h ${mins}m`
    return `${mins}m`
  }

  function getWinner(m) {
    if (!m || m.status !== 'finished') return null
    return m.home_score > m.away_score ? m.home_team : m.away_team
  }

  if (loading) {
    return <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>Cargando cuadro...</div>
  }

  if (matches.length === 0) {
    return <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>Las eliminatorias aún no han comenzado</div>
  }

  const roundMatches = STAGE_ORDER.map(stage => ({
    stage, label: STAGE_LABELS[stage], points: STAGE_POINTS[stage],
    matches: matches.filter(m => m.stage === stage)
  })).filter(r => r.matches.length > 0)

  const finalMatch = matches.find(m => m.stage === 'final')
  const semifinalists = matches.filter(m => m.stage === 'semi_final')

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '14px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 4px' }}>
          Cuadro de eliminatorias
        </h3>
        <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: 0 }}>
          Elige al ganador de cada partido. Apuestas cierran 3h antes del inicio.
        </p>
      </div>

      {/* ===== FINAL HERO ===== */}
      {finalMatch && (
        <div style={{
          background: 'linear-gradient(135deg, #22252f, #1a2520)',
          borderRadius: '12px', padding: '18px', marginBottom: '16px',
          border: '1px solid var(--green)', position: 'relative', overflow: 'hidden'
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, var(--gold), var(--green), var(--gold))' }} />
          <div style={{ fontSize: '10px', color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '1.2px', fontWeight: '700', textAlign: 'center', marginBottom: '14px' }}>
            🏆 Final del Mundial 2026
          </div>

          {finalMatch.status === 'finished' ? (
            /* Finished final */
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  {finalMatch.home_team?.flag_url && <img src={finalMatch.home_team.flag_url} alt="" style={{ width: '40px', height: '28px', borderRadius: '3px', objectFit: 'cover', marginBottom: '4px', border: '1px solid var(--border)' }} />}
                  <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>{finalMatch.home_team?.name}</div>
                </div>
                <div style={{ fontSize: '26px', fontWeight: '800', color: 'var(--gold)', letterSpacing: '3px' }}>
                  {finalMatch.home_score} - {finalMatch.away_score}
                </div>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  {finalMatch.away_team?.flag_url && <img src={finalMatch.away_team.flag_url} alt="" style={{ width: '40px', height: '28px', borderRadius: '3px', objectFit: 'cover', marginBottom: '4px', border: '1px solid var(--border)' }} />}
                  <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>{finalMatch.away_team?.name}</div>
                </div>
              </div>
              {(() => { const c = getWinner(finalMatch); return c ? (
                <div style={{ textAlign: 'center', marginTop: '12px', padding: '8px', background: 'rgba(255,204,0,0.08)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '20px' }}>🏆</div>
                  <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--gold)' }}>{c.name}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '2px' }}>Campeón del Mundo 2026</div>
                </div>
              ) : null })()}
            </>
          ) : (
            /* Betting on final */
            <>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                {['home', 'away'].map(side => {
                  const team = side === 'home' ? finalMatch.home_team : finalMatch.away_team
                  const picked = picks[finalMatch.id] === side
                  const open = isBettingOpen(finalMatch)
                  return (
                    <button key={side} onClick={() => open && handlePick(finalMatch.id, side)} disabled={!open} style={{
                      flex: 1, padding: '14px 8px', borderRadius: '8px', border: 'none', cursor: open ? 'pointer' : 'default',
                      background: picked ? 'rgba(0,122,69,0.15)' : 'var(--bg-input)',
                      border: picked ? '2px solid var(--green)' : '2px solid transparent',
                      opacity: !open && !picked ? 0.5 : 1, transition: 'all 0.2s'
                    }}>
                      {team?.flag_url && <img src={team.flag_url} alt="" style={{ width: '36px', height: '24px', borderRadius: '3px', objectFit: 'cover', marginBottom: '6px', border: '1px solid var(--border)' }} />}
                      <div style={{ fontSize: '13px', fontWeight: picked ? '700' : '500', color: picked ? 'var(--green)' : 'var(--text-primary)' }}>
                        {team?.name || 'TBD'}
                      </div>
                      {picked && <div style={{ fontSize: '10px', color: 'var(--green)', marginTop: '4px', fontWeight: '600' }}>✓ Tu apuesta</div>}
                    </button>
                  )
                })}
              </div>
              {/* Timer */}
              {finalMatch.match_date && (() => {
                const countdown = formatCountdown(finalMatch.match_date)
                const open = isBettingOpen(finalMatch)
                return (
                  <div style={{ textAlign: 'center', fontSize: '11px', color: open ? 'var(--gold)' : 'var(--red)' }}>
                    {open ? `⏱ Cierre apuestas en ${countdown}` : '🔒 Apuestas cerradas'}
                  </div>
                )
              })()}
            </>
          )}
        </div>
      )}

      {/* ===== SEMIFINAL FLOW ===== */}
      {semifinalists.length === 2 && (
        <div style={{
          background: 'var(--bg-secondary)', borderRadius: '10px', padding: '14px',
          marginBottom: '16px', border: '0.5px solid var(--border)'
        }}>
          <div style={{ fontSize: '10px', color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '700', marginBottom: '10px', textAlign: 'center' }}>
            Camino a la final
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {semifinalists.map((sf, i) => {
              const winner = getWinner(sf)
              return (
                <div key={sf.id} style={{
                  flex: 1, background: 'var(--bg-input)', borderRadius: '8px', padding: '8px', textAlign: 'center',
                  border: winner ? '1px solid var(--green)' : '0.5px solid var(--border)'
                }}>
                  <div style={{ fontSize: '9px', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '4px' }}>SF {i + 1}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-primary)' }}>{sf.home_team?.name?.split(' ')[0]}</div>
                  {sf.status === 'finished' && <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--green)', margin: '2px 0' }}>{sf.home_score}-{sf.away_score}</div>}
                  <div style={{ fontSize: '11px', color: 'var(--text-primary)' }}>{sf.away_team?.name?.split(' ')[0]}</div>
                  {winner && <div style={{ marginTop: '4px', fontSize: '9px', color: 'var(--green)', fontWeight: '600' }}>→ {winner.name}</div>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ===== ROUND TABS ===== */}
      <div style={{
        display: 'flex', gap: '4px', marginBottom: '14px',
        padding: '3px', background: 'var(--bg-input)', borderRadius: '8px', overflowX: 'auto'
      }}>
        {roundMatches.map(round => {
          const finished = round.matches.filter(m => m.status === 'finished').length
          const total = round.matches.length
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
                <span style={{ display: 'block', fontSize: '8px', color: 'var(--green)', marginTop: '1px' }}>✓</span>
              ) : round.points > 0 ? (
                <span style={{ display: 'block', fontSize: '8px', color: 'var(--text-dim)', marginTop: '1px' }}>{round.points}pt</span>
              ) : null}
            </button>
          )
        })}
      </div>

      {/* ===== MATCH CARDS ===== */}
      {roundMatches.filter(r => r.stage === activeRound).map(round => (
        <div key={round.stage}>
          {round.points > 0 && (
            <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginBottom: '8px', textAlign: 'center' }}>
              {round.points} punto{round.points > 1 ? 's' : ''} por acierto
            </div>
          )}

          {round.matches.map(match => {
            const isFinished = match.status === 'finished'
            const winner = getWinner(match)
            const homeWon = winner?.name === match.home_team?.name
            const awayWon = winner?.name === match.away_team?.name
            const open = isBettingOpen(match)
            const myPick = picks[match.id]
            const countdown = match.match_date ? formatCountdown(match.match_date) : null
            const isSaving = saving[match.id]

            // Did user's pick match the winner?
            const pickCorrect = isFinished && myPick && (
              (myPick === 'home' && homeWon) || (myPick === 'away' && awayWon)
            )
            const pickWrong = isFinished && myPick && !pickCorrect

            return (
              <div key={match.id} style={{
                background: 'var(--bg-secondary)', borderRadius: '10px', padding: '12px 14px',
                marginBottom: '8px',
                border: isFinished ? '0.5px solid var(--green)' : '0.5px solid var(--border)',
                borderLeft: pickCorrect ? '3px solid var(--gold)' : pickWrong ? '3px solid var(--red)' : isFinished ? '3px solid var(--green)' : '3px solid var(--border)'
              }}>
                {/* Header row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '9px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    #{match.id} · {round.label}
                  </span>
                  {isFinished && (
                    <span style={{ fontSize: '9px', color: 'var(--green)', fontWeight: '600', textTransform: 'uppercase' }}>
                      Finalizado
                    </span>
                  )}
                  {!isFinished && open && countdown && (
                    <span style={{ fontSize: '9px', color: 'var(--gold)', fontWeight: '600' }}>
                      ⏱ {countdown}
                    </span>
                  )}
                  {!isFinished && !open && (
                    <span style={{ fontSize: '9px', color: 'var(--red)', fontWeight: '600' }}>
                      🔒 Cerrado
                    </span>
                  )}
                </div>

                {/* Finished match — show results */}
                {isFinished && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      flex: 1, display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 10px', borderRadius: '6px',
                      background: homeWon ? 'rgba(0,122,69,0.1)' : 'var(--bg-input)',
                      border: homeWon ? '0.5px solid var(--green)' : '0.5px solid transparent'
                    }}>
                      {match.home_team?.flag_url && <img src={match.home_team.flag_url} alt="" style={{ width: '18px', height: '12px', borderRadius: '1px', objectFit: 'cover', flexShrink: 0 }} />}
                      <span style={{ fontSize: '12px', fontWeight: homeWon ? '700' : '400', color: homeWon ? 'var(--green)' : 'var(--text-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {match.home_team?.name}
                      </span>
                      <span style={{ fontSize: '15px', fontWeight: '700', color: homeWon ? 'var(--green)' : 'var(--text-dim)' }}>{match.home_score}</span>
                    </div>
                    <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>—</span>
                    <div style={{
                      flex: 1, display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 10px', borderRadius: '6px',
                      background: awayWon ? 'rgba(0,122,69,0.1)' : 'var(--bg-input)',
                      border: awayWon ? '0.5px solid var(--green)' : '0.5px solid transparent'
                    }}>
                      {match.away_team?.flag_url && <img src={match.away_team.flag_url} alt="" style={{ width: '18px', height: '12px', borderRadius: '1px', objectFit: 'cover', flexShrink: 0 }} />}
                      <span style={{ fontSize: '12px', fontWeight: awayWon ? '700' : '400', color: awayWon ? 'var(--green)' : 'var(--text-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {match.away_team?.name}
                      </span>
                      <span style={{ fontSize: '15px', fontWeight: '700', color: awayWon ? 'var(--green)' : 'var(--text-dim)' }}>{match.away_score}</span>
                    </div>
                  </div>
                )}

                {/* Open match — pick winner */}
                {!isFinished && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {['home', 'away'].map(side => {
                      const team = side === 'home' ? match.home_team : match.away_team
                      const picked = myPick === side
                      return (
                        <button key={side} onClick={() => open && handlePick(match.id, side)} disabled={!open} style={{
                          flex: 1, padding: '10px 8px', borderRadius: '8px',
                          background: picked ? 'rgba(0,122,69,0.12)' : 'var(--bg-input)',
                          border: picked ? '2px solid var(--green)' : '2px solid transparent',
                          cursor: open ? 'pointer' : 'default',
                          opacity: !open && !picked ? 0.5 : 1,
                          display: 'flex', alignItems: 'center', gap: '8px',
                          transition: 'all 0.15s'
                        }}>
                          {team?.flag_url && <img src={team.flag_url} alt="" style={{ width: '20px', height: '14px', borderRadius: '2px', objectFit: 'cover', flexShrink: 0 }} />}
                          <span style={{
                            fontSize: '12px', fontWeight: picked ? '700' : '500',
                            color: picked ? 'var(--green)' : 'var(--text-primary)',
                            flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                          }}>
                            {team?.name || 'TBD'}
                          </span>
                          {picked && <span style={{ fontSize: '10px', color: 'var(--green)', fontWeight: '700' }}>✓</span>}
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* Pick result feedback */}
                {isFinished && myPick && (
                  <div style={{
                    textAlign: 'center', marginTop: '6px', fontSize: '10px',
                    color: pickCorrect ? 'var(--gold)' : 'var(--red)', fontWeight: '600'
                  }}>
                    {pickCorrect ? `✓ Acertaste (+${round.points} pts)` : '✗ Fallaste'}
                  </div>
                )}
                {isFinished && !myPick && (
                  <div style={{ textAlign: 'center', marginTop: '6px', fontSize: '10px', color: 'var(--text-dim)' }}>
                    No apostaste
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
