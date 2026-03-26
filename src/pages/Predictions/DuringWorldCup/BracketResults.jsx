import { useState, useEffect } from 'react'
import { supabase } from '../../../supabase'

const STAGE_ORDER = ['r32', 'r16', 'quarter_final', 'semi_final', 'final']
const STAGE_LABELS = {
  r32: 'Dieciseisavos',
  r16: 'Octavos',
  quarter_final: 'Cuartos',
  semi_final: 'Semifinales',
  final: 'Final'
}

export default function BracketResults() {
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeRound, setActiveRound] = useState('r16') // Skip r32 by default — too many

  useEffect(() => { fetchMatches() }, [])

  async function fetchMatches() {
    const { data } = await supabase
      .from('matches')
      .select('id, stage, status, home_score, away_score, home_team:teams!matches_home_team_id_fkey(name, flag_url), away_team:teams!matches_away_team_id_fkey(name, flag_url)')
      .neq('stage', 'group')
      .order('id', { ascending: true })

    setMatches(data || [])
    setLoading(false)
  }

  if (loading) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
        Cargando cuadro...
      </div>
    )
  }

  if (matches.length === 0) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
        Las eliminatorias aún no han comenzado
      </div>
    )
  }

  const roundMatches = STAGE_ORDER.map(stage => ({
    stage,
    label: STAGE_LABELS[stage],
    matches: matches.filter(m => m.stage === stage)
  })).filter(r => r.matches.length > 0)

  // Find the latest round with results for the bracket flow
  const semifinalists = matches.filter(m => m.stage === 'semi_final')
  const finalMatch = matches.find(m => m.stage === 'final')

  // Get winner of a match
  const getWinner = (m) => {
    if (!m || m.status !== 'finished') return null
    return m.home_score > m.away_score ? m.home_team : m.away_team
  }

  return (
    <div>

      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{
          fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)',
          margin: '0 0 4px', letterSpacing: '0.3px'
        }}>
          Cuadro de eliminatorias
        </h2>
        <p style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
          {matches.filter(m => m.status === 'finished').length} de {matches.length} partidos jugados
        </p>
      </div>

      {/* ===== FINAL HERO ===== */}
      {finalMatch && (
        <div style={{
          background: 'linear-gradient(135deg, #22252f, #1a2520)',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '18px',
          border: '1px solid var(--green)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
            background: 'linear-gradient(90deg, var(--gold), var(--green), var(--gold))'
          }} />

          <div style={{
            fontSize: '10px', color: 'var(--gold)', textTransform: 'uppercase',
            letterSpacing: '1.2px', fontWeight: '700', textAlign: 'center', marginBottom: '16px'
          }}>
            🏆 Final del Mundial 2026
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px'
          }}>
            {/* Home team */}
            <div style={{ flex: 1, textAlign: 'center' }}>
              {finalMatch.home_team?.flag_url && (
                <img src={finalMatch.home_team.flag_url} alt="" style={{
                  width: '48px', height: '32px', borderRadius: '4px', objectFit: 'cover',
                  marginBottom: '8px', border: '1px solid var(--border)'
                }} />
              )}
              <div style={{
                fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)',
                marginBottom: '2px'
              }}>
                {finalMatch.home_team?.name || 'TBD'}
              </div>
            </div>

            {/* Score or VS */}
            <div style={{ textAlign: 'center' }}>
              {finalMatch.status === 'finished' ? (
                <div style={{
                  fontSize: '28px', fontWeight: '800', color: 'var(--gold)',
                  letterSpacing: '4px'
                }}>
                  {finalMatch.home_score} - {finalMatch.away_score}
                </div>
              ) : (
                <div style={{
                  padding: '8px 16px', background: 'rgba(255,204,0,0.1)',
                  borderRadius: '8px', border: '1px dashed var(--gold)'
                }}>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--gold)' }}>VS</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '2px' }}>Próximamente</div>
                </div>
              )}
            </div>

            {/* Away team */}
            <div style={{ flex: 1, textAlign: 'center' }}>
              {finalMatch.away_team?.flag_url && (
                <img src={finalMatch.away_team.flag_url} alt="" style={{
                  width: '48px', height: '32px', borderRadius: '4px', objectFit: 'cover',
                  marginBottom: '8px', border: '1px solid var(--border)'
                }} />
              )}
              <div style={{
                fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)',
                marginBottom: '2px'
              }}>
                {finalMatch.away_team?.name || 'TBD'}
              </div>
            </div>
          </div>

          {/* Champion */}
          {finalMatch.status === 'finished' && (() => {
            const champion = getWinner(finalMatch)
            return champion ? (
              <div style={{
                textAlign: 'center', marginTop: '16px',
                padding: '10px', background: 'rgba(255,204,0,0.08)',
                borderRadius: '8px'
              }}>
                <div style={{ fontSize: '24px', marginBottom: '4px' }}>🏆</div>
                <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--gold)' }}>
                  {champion.name}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>
                  Campeón del Mundo 2026
                </div>
              </div>
            ) : null
          })()}
        </div>
      )}

      {/* ===== BRACKET FLOW (SF → QF visual) ===== */}
      {semifinalists.length === 2 && (
        <div style={{
          background: 'var(--bg-secondary)', borderRadius: '10px',
          padding: '16px', marginBottom: '18px', border: '0.5px solid var(--border)'
        }}>
          <div style={{
            fontSize: '10px', color: 'var(--gold)', textTransform: 'uppercase',
            letterSpacing: '1px', fontWeight: '700', marginBottom: '12px', textAlign: 'center'
          }}>
            Camino a la final
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {semifinalists.map((sf, i) => {
              const winner = getWinner(sf)
              return (
                <div key={sf.id} style={{
                  flex: 1, background: 'var(--bg-input)', borderRadius: '8px',
                  padding: '10px', textAlign: 'center',
                  border: winner ? '1px solid var(--green)' : '0.5px solid var(--border)'
                }}>
                  <div style={{ fontSize: '9px', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Semifinal {i + 1}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '4px' }}>
                    {sf.home_team?.flag_url && <img src={sf.home_team.flag_url} alt="" style={{ width: '16px', height: '11px', borderRadius: '1px' }} />}
                    <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: '500' }}>
                      {sf.home_team?.name?.split(' ').slice(0, 2).join(' ')}
                    </span>
                  </div>
                  {sf.status === 'finished' && (
                    <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--green)', margin: '4px 0' }}>
                      {sf.home_score} - {sf.away_score}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    {sf.away_team?.flag_url && <img src={sf.away_team.flag_url} alt="" style={{ width: '16px', height: '11px', borderRadius: '1px' }} />}
                    <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: '500' }}>
                      {sf.away_team?.name?.split(' ').slice(0, 2).join(' ')}
                    </span>
                  </div>
                  {winner && (
                    <div style={{
                      marginTop: '6px', fontSize: '10px', color: 'var(--green)',
                      fontWeight: '600', textTransform: 'uppercase'
                    }}>
                      → {winner.name}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ===== ROUND TABS ===== */}
      <div style={{
        display: 'flex', gap: '4px', marginBottom: '16px',
        padding: '3px', background: 'var(--bg-input)', borderRadius: '8px',
        overflowX: 'auto'
      }}>
        {roundMatches.map(round => {
          const finished = round.matches.filter(m => m.status === 'finished').length
          const total = round.matches.length
          return (
            <button
              key={round.stage}
              onClick={() => setActiveRound(round.stage)}
              style={{
                flex: 1, padding: '8px 6px', borderRadius: '6px', border: 'none',
                background: activeRound === round.stage ? 'var(--bg-secondary)' : 'transparent',
                color: activeRound === round.stage ? 'var(--text-primary)' : 'var(--text-muted)',
                fontSize: '11px', fontWeight: activeRound === round.stage ? '600' : '400',
                cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, position: 'relative',
                minWidth: 0
              }}
            >
              {round.label}
              {finished > 0 && finished < total && (
                <span style={{
                  display: 'block', fontSize: '9px', color: 'var(--green)', marginTop: '1px'
                }}>
                  {finished}/{total}
                </span>
              )}
              {finished === total && (
                <span style={{
                  display: 'block', fontSize: '9px', color: 'var(--green)', marginTop: '1px'
                }}>✓</span>
              )}
            </button>
          )
        })}
      </div>

      {/* ===== MATCH CARDS FOR SELECTED ROUND ===== */}
      {roundMatches.filter(r => r.stage === activeRound).map(round => (
        <div key={round.stage}>
          {round.matches.map(match => {
            const isFinished = match.status === 'finished'
            const winner = getWinner(match)
            const homeWon = winner && winner.name === match.home_team?.name
            const awayWon = winner && winner.name === match.away_team?.name

            return (
              <div key={match.id} style={{
                background: 'var(--bg-secondary)',
                borderRadius: '10px',
                padding: '12px 14px',
                marginBottom: '8px',
                border: isFinished ? '0.5px solid var(--green)' : '0.5px solid var(--border)',
                borderLeft: isFinished ? '3px solid var(--green)' : '3px solid var(--border)'
              }}>
                {/* Match number badge */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  marginBottom: '8px'
                }}>
                  <span style={{
                    fontSize: '9px', color: 'var(--text-dim)', textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Partido #{match.id}
                  </span>
                  {isFinished && (
                    <span style={{
                      fontSize: '9px', color: 'var(--green)', fontWeight: '600',
                      textTransform: 'uppercase', letterSpacing: '0.5px'
                    }}>
                      Finalizado
                    </span>
                  )}
                  {!isFinished && (
                    <span style={{
                      fontSize: '9px', color: 'var(--gold)', fontWeight: '600',
                      textTransform: 'uppercase', letterSpacing: '0.5px'
                    }}>
                      Próximo
                    </span>
                  )}
                </div>

                {/* Teams row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {/* Home team */}
                  <div style={{
                    flex: 1, display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '8px 10px', borderRadius: '6px',
                    background: homeWon ? 'rgba(0,122,69,0.1)' : 'var(--bg-input)',
                    border: homeWon ? '0.5px solid var(--green)' : '0.5px solid transparent'
                  }}>
                    {match.home_team?.flag_url && (
                      <img src={match.home_team.flag_url} alt="" style={{
                        width: '20px', height: '14px', borderRadius: '2px', objectFit: 'cover', flexShrink: 0
                      }} />
                    )}
                    <span style={{
                      fontSize: '12px', fontWeight: homeWon ? '700' : '500',
                      color: homeWon ? 'var(--green)' : 'var(--text-primary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1
                    }}>
                      {match.home_team?.name || 'TBD'}
                    </span>
                    {isFinished && (
                      <span style={{
                        fontSize: '16px', fontWeight: '700',
                        color: homeWon ? 'var(--green)' : 'var(--text-dim)'
                      }}>
                        {match.home_score}
                      </span>
                    )}
                  </div>

                  {/* VS divider */}
                  <span style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: '600', flexShrink: 0 }}>
                    {isFinished ? '—' : 'vs'}
                  </span>

                  {/* Away team */}
                  <div style={{
                    flex: 1, display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '8px 10px', borderRadius: '6px',
                    background: awayWon ? 'rgba(0,122,69,0.1)' : 'var(--bg-input)',
                    border: awayWon ? '0.5px solid var(--green)' : '0.5px solid transparent'
                  }}>
                    {match.away_team?.flag_url && (
                      <img src={match.away_team.flag_url} alt="" style={{
                        width: '20px', height: '14px', borderRadius: '2px', objectFit: 'cover', flexShrink: 0
                      }} />
                    )}
                    <span style={{
                      fontSize: '12px', fontWeight: awayWon ? '700' : '500',
                      color: awayWon ? 'var(--green)' : 'var(--text-primary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1
                    }}>
                      {match.away_team?.name || 'TBD'}
                    </span>
                    {isFinished && (
                      <span style={{
                        fontSize: '16px', fontWeight: '700',
                        color: awayWon ? 'var(--green)' : 'var(--text-dim)'
                      }}>
                        {match.away_score}
                      </span>
                    )}
                  </div>
                </div>

                {/* Winner label */}
                {winner && (
                  <div style={{
                    textAlign: 'center', marginTop: '6px',
                    fontSize: '10px', color: 'var(--green)', fontWeight: '600'
                  }}>
                    → Pasa: {winner.name}
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
