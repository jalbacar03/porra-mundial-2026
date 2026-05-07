import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../../supabase'
import { calculateGroupStandings } from '../../utils/groupStandings'
import {
  ROUNDS, R32_MATCHES, R16_MATCHES, QF_MATCHES, SF_MATCHES, FINAL_MATCH,
  resolveR32Matchups, resolveRoundMatchups
} from '../../utils/bracketStructure'
import BracketRound from './BracketRound'
import { FootballSpinner } from '../Skeleton'

export default function BracketView({ session }) {
  const [matches, setMatches] = useState([])
  const [predictions, setPredictions] = useState({})
  const [picks, setPicks] = useState({}) // { matchNumber: { predicted_winner_id, home_team_id, away_team_id } }
  const [teamsById, setTeamsById] = useState({})
  const [loading, setLoading] = useState(true)
  const [activeRound, setActiveRound] = useState('r32')
  const debounceTimers = useRef({})

  useEffect(() => {
    fetchData()
    return () => {
      Object.values(debounceTimers.current).forEach(clearTimeout)
    }
  }, [])

  async function fetchData() {
    const [matchesRes, predsRes, picksRes, teamsRes] = await Promise.all([
      supabase
        .from('matches')
        .select('*, home_team:teams!matches_home_team_id_fkey(id, name, code, flag_url), away_team:teams!matches_away_team_id_fkey(id, name, code, flag_url)')
        .eq('stage', 'group')
        .order('match_date'),
      supabase
        .from('predictions')
        .select('*')
        .eq('user_id', session.user.id),
      supabase
        .from('bracket_picks')
        .select('*')
        .eq('user_id', session.user.id),
      supabase
        .from('teams')
        .select('id, name, code, flag_url')
    ])

    if (matchesRes.data) setMatches(matchesRes.data)

    if (predsRes.data) {
      const map = {}
      predsRes.data.forEach(p => {
        map[p.match_id] = { home_score: p.predicted_home, away_score: p.predicted_away }
      })
      setPredictions(map)
    }

    if (picksRes.data) {
      const map = {}
      picksRes.data.forEach(p => {
        map[p.match_number] = p
      })
      setPicks(map)
    }

    if (teamsRes.data) {
      const map = {}
      teamsRes.data.forEach(t => { map[t.id] = t })
      setTeamsById(map)
    }

    setLoading(false)
  }

  // Calculate group standings from predictions
  const { groupStandings, thirdPlaceRanking } = useMemo(() => {
    if (!matches.length) return { groupStandings: {}, thirdPlaceRanking: [] }
    return calculateGroupStandings(matches, predictions)
  }, [matches, predictions])

  // Resolve R32 matchups from group standings
  const r32Matchups = useMemo(() => {
    if (!Object.keys(groupStandings).length) return {}
    return resolveR32Matchups(groupStandings, thirdPlaceRanking)
  }, [groupStandings, thirdPlaceRanking])

  // Resolve R16+ matchups from bracket picks
  const r16Matchups = useMemo(() => resolveRoundMatchups(picks, R16_MATCHES, teamsById), [picks, teamsById])
  const qfMatchups = useMemo(() => resolveRoundMatchups(picks, QF_MATCHES, teamsById), [picks, teamsById])
  const sfMatchups = useMemo(() => resolveRoundMatchups(picks, SF_MATCHES, teamsById), [picks, teamsById])
  const finalMatchups = useMemo(() => resolveRoundMatchups(picks, FINAL_MATCH, teamsById), [picks, teamsById])

  const allMatchups = {
    r32: r32Matchups,
    r16: r16Matchups,
    qf: qfMatchups,
    sf: sfMatchups,
    final: finalMatchups
  }

  // Count predictions filled
  const filledPredictions = Object.keys(predictions).filter(k => {
    const p = predictions[k]
    return p.home_score != null && p.away_score != null
  }).length

  async function handlePickWinner(matchNumber, teamId) {
    const matchup = findMatchup(matchNumber)
    if (!matchup) return

    // Determine round
    const round = getRoundForMatch(matchNumber)

    // Optimistic update
    const newPick = {
      match_number: matchNumber,
      round,
      predicted_winner_id: teamId,
      home_team_id: matchup.home?.id,
      away_team_id: matchup.away?.id
    }

    setPicks(prev => ({
      ...prev,
      [matchNumber]: { ...prev[matchNumber], ...newPick }
    }))

    // Debounced save
    if (debounceTimers.current[matchNumber]) {
      clearTimeout(debounceTimers.current[matchNumber])
    }

    debounceTimers.current[matchNumber] = setTimeout(async () => {
      const { error } = await supabase
        .from('bracket_picks')
        .upsert({
          user_id: session.user.id,
          match_number: matchNumber,
          round,
          predicted_winner_id: teamId,
          home_team_id: matchup.home?.id,
          away_team_id: matchup.away?.id,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,match_number' })

      if (error) console.error('Error saving bracket pick:', error)
    }, 400)
  }

  function findMatchup(matchNumber) {
    // Check all resolved matchups
    for (const roundKey of Object.keys(allMatchups)) {
      if (allMatchups[roundKey][matchNumber]) return allMatchups[roundKey][matchNumber]
    }
    return null
  }

  function getRoundForMatch(mn) {
    if (mn >= 73 && mn <= 88) return 'r32'
    if (mn >= 89 && mn <= 96) return 'r16'
    if (mn >= 97 && mn <= 100) return 'qf'
    if (mn >= 101 && mn <= 102) return 'sf'
    if (mn === 104) return 'final'
    return 'r32'
  }

  // Progress stats
  const totalR32Picked = R32_MATCHES.filter(m => picks[m.matchNumber]?.predicted_winner_id).length
  const totalR16Picked = R16_MATCHES.filter(m => picks[m.matchNumber]?.predicted_winner_id).length
  const totalQFPicked = QF_MATCHES.filter(m => picks[m.matchNumber]?.predicted_winner_id).length
  const totalSFPicked = SF_MATCHES.filter(m => picks[m.matchNumber]?.predicted_winner_id).length
  const totalFinalPicked = FINAL_MATCH.filter(m => picks[m.matchNumber]?.predicted_winner_id).length

  const roundProgress = {
    r32: `${totalR32Picked}/16`,
    r16: `${totalR16Picked}/8`,
    qf: `${totalQFPicked}/4`,
    sf: `${totalSFPicked}/2`,
    final: `${totalFinalPicked}/1`
  }

  if (loading) {
    return <FootballSpinner text="Cargando cuadro…" />
  }

  if (filledPredictions < matches.length * 0.5) {
    return (
      <div style={{
        padding: '40px 20px', textAlign: 'center',
        background: 'var(--bg-secondary)', borderRadius: '10px',
        margin: '10px 0', border: '1px solid rgba(255,255,255,0.05)'
      }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>🏆</div>
        <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '6px' }}>
          Bracket de eliminatorias
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
          Completa al menos el 50% de tus predicciones de grupo para desbloquear el bracket.
        </div>
        <div style={{
          fontSize: '12px', color: '#ffcc00', marginTop: '10px',
          background: 'rgba(255,204,0,0.08)', padding: '8px 12px', borderRadius: '6px', display: 'inline-block'
        }}>
          {filledPredictions}/{matches.length} partidos predichos
        </div>
      </div>
    )
  }

  // === Column-based view (4 columns: R16 / QF / SF / Final) ===
  // R32 picks happen automatically when there are matchups (auto-fill behind the scenes)
  // The user picks R16 onwards. Show them as a 4-column grid of compact team cards.

  // Auto-fill R32 picks: when matchup has both teams, default winner = the team with higher group ranking (1st > 2nd > 3rd)
  // This lets the cascade flow without requiring user input on R32. They can still tap to change.

  // Total picks needed: 8 R16 + 4 QF + 2 SF + 1 Final = 15
  const totalNeeded = 15
  const totalDone = totalR16Picked + totalQFPicked + totalSFPicked + totalFinalPicked
  // Potential points: sum of round.pointsPerWin × matches in round + champion bonus if final picked
  const potentialPts = (totalR16Picked * 1) + (totalQFPicked * 2) + (totalSFPicked * 4) + (totalFinalPicked * 5) + (totalFinalPicked * 8)

  const COLUMNS = [
    { key: 'r16', label: 'Octavos', pts: 1, matches: R16_MATCHES },
    { key: 'qf', label: 'Cuartos', pts: 2, matches: QF_MATCHES },
    { key: 'sf', label: 'Semi', pts: 4, matches: SF_MATCHES },
    { key: 'final', label: 'Final', pts: 5, matches: FINAL_MATCH }
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '14px' }}>
        <h2 style={{
          fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)',
          margin: '0 0 10px', letterSpacing: '-0.4px'
        }}>
          Cuadro ciego
        </h2>

        {/* Progress bar with potential pts */}
        <div style={{
          padding: '10px 12px', borderRadius: '10px',
          background: 'var(--bg-secondary)',
          display: 'flex', alignItems: 'center', gap: '12px'
        }}>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)',
              marginBottom: '6px', display: 'flex', justifyContent: 'space-between'
            }}>
              <span>{totalDone} / {totalNeeded} elegidos</span>
              <span style={{ color: 'var(--gold)' }}>+{potentialPts} potenciales</span>
            </div>
            <div style={{
              height: '6px', borderRadius: '3px',
              background: 'rgba(255,255,255,0.05)', overflow: 'hidden'
            }}>
              <div style={{
                width: `${(totalDone / totalNeeded) * 100}%`, height: '100%',
                background: 'linear-gradient(90deg, var(--green), var(--gold))',
                transition: 'width 0.4s ease'
              }} />
            </div>
          </div>
        </div>
      </div>

      {/* 4-column grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px',
        marginBottom: '14px'
      }}>
        {COLUMNS.map(col => (
          <div key={col.key} style={{
            fontSize: '9px', fontWeight: '700', color: 'var(--text-dim)',
            textTransform: 'uppercase', letterSpacing: '0.8px', textAlign: 'center',
            paddingBottom: '6px'
          }}>{col.label}</div>
        ))}
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px',
        marginBottom: '20px'
      }}>
        {COLUMNS.map(col => {
          const matchups = allMatchups[col.key]
          return (
            <div key={col.key} style={{ display: 'flex', flexDirection: 'column', gap: '6px', justifyContent: 'space-around' }}>
              {col.matches.map(m => {
                const matchup = matchups[m.matchNumber]
                const pick = picks[m.matchNumber]
                const winnerId = pick?.predicted_winner_id
                const winnerTeam = winnerId === matchup?.home?.id ? matchup.home : winnerId === matchup?.away?.id ? matchup.away : null
                const isFinal = col.key === 'final'
                // Points: round points; if final picked → add champion bonus 8
                const pts = isFinal && winnerTeam ? col.pts + 8 : col.pts

                const togglePick = () => {
                  if (!matchup?.home || !matchup?.away) return
                  // If no pick → pick home; if home → switch to away; if away → switch to home
                  const next = winnerId === matchup.home.id ? matchup.away.id
                             : winnerId === matchup.away.id ? matchup.home.id
                             : matchup.home.id
                  handlePickWinner(m.matchNumber, next)
                }

                if (!matchup?.home || !matchup?.away) {
                  return (
                    <div key={m.matchNumber} style={{
                      padding: '8px 6px', borderRadius: '8px',
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px dashed rgba(255,255,255,0.06)',
                      fontSize: '9px', color: 'var(--text-dim)', textAlign: 'center'
                    }}>—</div>
                  )
                }

                return (
                  <button
                    key={m.matchNumber}
                    onClick={togglePick}
                    style={{
                      padding: isFinal ? '12px 6px' : '8px 6px',
                      borderRadius: '8px', cursor: 'pointer',
                      background: isFinal && winnerTeam ? 'var(--gold)' : 'var(--bg-secondary)',
                      border: winnerTeam
                        ? (isFinal ? '1px solid var(--gold)' : '1px solid var(--green)')
                        : '1px solid var(--border-light)',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                      minHeight: isFinal ? '70px' : 'auto'
                    }}
                  >
                    {winnerTeam ? (
                      <>
                        {winnerTeam.flag_url && (
                          <img src={winnerTeam.flag_url} alt="" style={{
                            width: '20px', height: '14px', borderRadius: '2px', objectFit: 'cover'
                          }} />
                        )}
                        <span style={{
                          fontSize: '10px', fontWeight: '700',
                          color: isFinal ? '#1a1d26' : 'var(--text-primary)',
                          textAlign: 'center', lineHeight: '1.1',
                          maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                        }}>{winnerTeam.name}</span>
                        <span style={{
                          fontSize: '9px', fontWeight: '800',
                          color: isFinal ? 'rgba(0,0,0,0.7)' : 'var(--gold)'
                        }}>
                          {isFinal ? '🏆 +' : '+'}{pts}
                        </span>
                      </>
                    ) : (
                      <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>Elegir</span>
                    )}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Footer: cadena campeón hint + tab switcher (for R32 visibility) */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 14px', borderRadius: '10px', background: 'var(--bg-secondary)',
        marginBottom: '14px'
      }}>
        <div>
          <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '600' }}>
            Cadena campeón
          </div>
          <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--gold)', marginTop: '2px' }}>
            hasta +20
          </div>
        </div>
      </div>

      {/* R32 advanced view (collapsible) */}
      <details style={{ marginBottom: '14px' }}>
        <summary style={{
          padding: '10px 12px', borderRadius: '8px', background: 'var(--bg-secondary)',
          cursor: 'pointer', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)'
        }}>
          Ver dieciseisavos (R32) — auto-rellenado desde tus predicciones de grupo
        </summary>
        <div style={{ marginTop: '8px' }}>
          <BracketRound
            roundKey="r32"
            label="Dieciseisavos"
            matches={R32_MATCHES}
            matchups={r32Matchups}
            picks={picks}
            points={0}
            onPickWinner={handlePickWinner}
            disabled={false}
            r32Sources={true}
          />
        </div>
      </details>
    </div>
  )
}
