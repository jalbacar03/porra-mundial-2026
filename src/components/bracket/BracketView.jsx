import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../../supabase'
import { calculateGroupStandings } from '../../utils/groupStandings'
import {
  ROUNDS, R32_MATCHES, R16_MATCHES, QF_MATCHES, SF_MATCHES, FINAL_MATCH,
  resolveR32Matchups, resolveRoundMatchups
} from '../../utils/bracketStructure'
import { FootballSpinner } from '../Skeleton'

export default function BracketView({ session }) {
  const [matches, setMatches] = useState([])
  const [predictions, setPredictions] = useState({})
  const [picks, setPicks] = useState({}) // { matchNumber: { predicted_winner_id, home_team_id, away_team_id } }
  const [teamsById, setTeamsById] = useState({})
  const [knockoutDates, setKnockoutDates] = useState({}) // { match_number: Date } — for per-match locking
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
    const [matchesRes, predsRes, picksRes, teamsRes, knockoutRes] = await Promise.all([
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
        .select('id, name, code, flag_url'),
      supabase
        .from('matches')
        .select('id, match_date, status, city, match_number')
        .neq('stage', 'group')
    ])

    if (matchesRes.data) setMatches(matchesRes.data)

    if (knockoutRes.data) {
      const dates = {}
      knockoutRes.data.forEach(m => {
        // key by both id and match_number for safety (they're equal for bracket
        // matches in this DB but the rest of the code reads by match_number).
        const entry = { date: new Date(m.match_date), status: m.status, city: m.city }
        dates[m.id] = entry
        if (m.match_number) dates[m.match_number] = entry
      })
      setKnockoutDates(dates)
    }

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
  const { groupStandings, completedGroups, thirdPlaceRanking } = useMemo(() => {
    if (!matches.length) return { groupStandings: {}, completedGroups: new Set(), thirdPlaceRanking: [] }
    return calculateGroupStandings(matches, predictions)
  }, [matches, predictions])

  // Resolve R32 matchups — only from FULLY predicted groups. Filter the
  // standings to the subset of complete groups so that partial groups (where
  // the user hasn't predicted every match yet) don't hand the bracket a
  // phantom seed. R32 slots from incomplete groups stay empty.
  const r32Matchups = useMemo(() => {
    if (!Object.keys(groupStandings).length) return {}
    const completeStandings = {}
    for (const g of completedGroups) {
      if (groupStandings[g]) completeStandings[g] = groupStandings[g]
    }
    return resolveR32Matchups(completeStandings, thirdPlaceRanking)
  }, [groupStandings, completedGroups, thirdPlaceRanking])

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

  // ─── Auto-fill R32 + cascade invalidation ──────────────────────────────
  // R32 has 16 matches that pair the 32 group qualifiers with no user choice
  // needed at that level (the bracket already says "1E vs 3ABCDF", etc.).
  // To stop the user from having to manually click 16 R32 cards before the
  // bracket cascade lights up, we auto-pick the higher-seeded team (home, which
  // resolveR32Matchups already puts there). The user can still change it from
  // the collapsible R32 panel at the bottom.
  //
  // Also: if a previously picked winner is no longer one of the two teams
  // resolved for that match (because a group prediction changed upstream),
  // the pick is stale — we invalidate it so the downstream rounds don't show
  // a phantom country that doesn't actually play.
  useEffect(() => {
    if (loading) return
    if (!Object.keys(r32Matchups).length) return

    const toUpsert = []
    const toClear = []

    // R32 — auto-fill missing + invalidate stale.
    // If the matchup didn't resolve (upstream group incomplete) AND there's
    // a previously saved pick, clear it so the downstream rounds also lose
    // their phantom feeder team.
    for (const m of R32_MATCHES) {
      const mu = r32Matchups[m.matchNumber]
      const pick = picks[m.matchNumber]
      if (!mu?.home || !mu?.away) {
        if (pick?.predicted_winner_id) toClear.push(m.matchNumber)
        continue
      }
      const validIds = [mu.home.id, mu.away.id]
      if (!pick?.predicted_winner_id) {
        toUpsert.push({
          match_number: m.matchNumber, round: 'r32',
          predicted_winner_id: mu.home.id,
          home_team_id: mu.home.id, away_team_id: mu.away.id,
        })
      } else if (!validIds.includes(pick.predicted_winner_id)) {
        // Stale: the picked winner no longer plays this match → reset to home
        toUpsert.push({
          match_number: m.matchNumber, round: 'r32',
          predicted_winner_id: mu.home.id,
          home_team_id: mu.home.id, away_team_id: mu.away.id,
        })
      }
    }

    // R16/QF/SF/Final — invalidate stale picks where the predicted winner
    // is no longer one of the two resolved candidates.
    for (const [round, [matches, mus]] of Object.entries({
      r16: [R16_MATCHES, r16Matchups],
      qf: [QF_MATCHES, qfMatchups],
      sf: [SF_MATCHES, sfMatchups],
      final: [FINAL_MATCH, finalMatchups],
    })) {
      for (const m of matches) {
        const mu = mus[m.matchNumber]
        const pick = picks[m.matchNumber]
        if (!pick?.predicted_winner_id) continue
        if (!mu?.home || !mu?.away) {
          // Upstream broke → clear this pick so the user re-picks knowingly
          toClear.push(m.matchNumber)
          continue
        }
        if (![mu.home.id, mu.away.id].includes(pick.predicted_winner_id)) {
          toClear.push(m.matchNumber)
        }
      }
    }

    if (!toUpsert.length && !toClear.length) return

    // Apply optimistic local changes
    setPicks(prev => {
      const next = { ...prev }
      toUpsert.forEach(p => { next[p.match_number] = { ...next[p.match_number], ...p } })
      toClear.forEach(mn => { if (next[mn]) next[mn] = { ...next[mn], predicted_winner_id: null } })
      return next
    })

    // Persist
    if (toUpsert.length) {
      supabase.from('bracket_picks').upsert(
        toUpsert.map(p => ({ ...p, user_id: session.user.id, updated_at: new Date().toISOString() })),
        { onConflict: 'user_id,match_number' }
      ).then(({ error }) => { if (error) console.error('Auto-fill bracket save error:', error) })
    }
    if (toClear.length) {
      supabase.from('bracket_picks')
        .update({ predicted_winner_id: null, updated_at: new Date().toISOString() })
        .eq('user_id', session.user.id)
        .in('match_number', toClear)
        .then(({ error }) => { if (error) console.error('Cascade-clear bracket error:', error) })
    }
  }, [loading, r32Matchups, r16Matchups, qfMatchups, sfMatchups, finalMatchups]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // Bracket layout: every column is a flex column of MATCH wrappers. Each
  // wrapper holds the two team slots (home + away) for that match and is
  // sized by a flex weight that's exactly proportional to how many "R32
  // units" the match spans:
  //   R32: 16 matches × flex 2  = 32 units total
  //   R16:  8 matches × flex 4  = 32
  //   QF :  4 matches × flex 8  = 32
  //   SF :  2 matches × flex 16 = 32
  //   Final 1 × flex 32         = 32
  // Every column totals the same vertical height, and the gap-between-
  // matches is uniform per column → each match in round N+1 ends up
  // physically centered against the two matches that feed it in round N.
  // R32 ordered to follow the R16 feeder chain so the geometry holds.
  const R32_MATCHES_ORDERED = R16_MATCHES.flatMap(r16 => [
    R32_MATCHES.find(m => m.matchNumber === r16.homeMatch),
    R32_MATCHES.find(m => m.matchNumber === r16.awayMatch),
  ]).filter(Boolean)

  const COLUMNS = [
    { key: 'r32',   label: '16avos',  pts: 0, matches: R32_MATCHES_ORDERED, flex: 2 },
    { key: 'r16',   label: 'Octavos', pts: 1, matches: R16_MATCHES,         flex: 4 },
    { key: 'qf',    label: 'Cuartos', pts: 2, matches: QF_MATCHES,          flex: 8 },
    { key: 'sf',    label: 'Semi',    pts: 4, matches: SF_MATCHES,          flex: 16 },
    { key: 'final', label: 'Final',   pts: 5, matches: FINAL_MATCH,         flex: 32 }
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

      {/* One unified 5-column grid for headers + bracket cards. Two rows:
          row 1 = column labels, row 2 = each column's match stack. Sharing
          the same grid guarantees the labels sit exactly above their
          respective columns (no mismatch from two separate grids). */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
        gridTemplateRows: 'auto 1fr',
        columnGap: '4px', rowGap: '8px',
        marginBottom: '20px',
        alignItems: 'stretch'
      }}>
        {/* Row 1: headers */}
        {COLUMNS.map(col => (
          <div key={`h-${col.key}`} style={{
            fontSize: '9px', fontWeight: '700', color: 'var(--text-dim)',
            textTransform: 'uppercase', letterSpacing: '0.8px', textAlign: 'center'
          }}>{col.label}</div>
        ))}
        {/* Row 2: bracket columns */}
        {COLUMNS.map(col => {
          const matchups = allMatchups[col.key]
          return (
            <div key={col.key} style={{
              display: 'flex', flexDirection: 'column',
              // Uniform gap between match wrappers — this is what gives the
              // visual grouping (slots inside a match are flush, gap shows
              // up only between matches).
              gap: '8px'
            }}>
              {col.matches.map((m, idx) => {
                const matchup = matchups[m.matchNumber]
                const pick = picks[m.matchNumber]
                const isFinal = col.key === 'final'

                const matchInfo = knockoutDates[m.matchNumber]
                const matchLocked = matchInfo && (matchInfo.date <= new Date() || matchInfo.status !== 'scheduled')

                const showCaption = !!matchInfo && col.key !== 'r32'
                const captionText = matchInfo && (
                  matchInfo.date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
                  + ' · ' +
                  matchInfo.date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
                )

                // Render one team slot inside this match wrapper
                const renderSlot = (side) => {
                  const team = matchup?.[side]
                  const isAdvancing = team && pick?.predicted_winner_id === team.id
                  const clickable = team && !matchLocked && matchup?.home && matchup?.away
                  const isChampion = isFinal && isAdvancing
                  const handleClick = () => {
                    if (!clickable || !team) return
                    if (pick?.predicted_winner_id === team.id) return
                    handlePickWinner(m.matchNumber, team.id)
                  }

                  if (!team) {
                    return (
                      <div style={{
                        flex: 1,
                        padding: '4px 6px', borderRadius: '6px',
                        border: '1px dashed rgba(255,255,255,0.06)',
                        fontSize: '9px', color: 'var(--text-dim)', textAlign: 'center',
                        minHeight: col.key === 'final' ? '40px' : '24px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>?</div>
                    )
                  }

                  return (
                    <button
                      onClick={handleClick}
                      disabled={!clickable}
                      title={
                        matchLocked ? 'Partido ya iniciado'
                        : isAdvancing ? 'Ya elegido como ganador'
                        : 'Tap para elegir como ganador'
                      }
                      style={{
                        flex: 1,
                        padding: isFinal ? '8px 6px' : '4px 6px',
                        borderRadius: '6px',
                        cursor: clickable ? 'pointer' : 'default',
                        background: isChampion ? 'var(--gold)'
                          : isAdvancing ? 'rgba(0,122,69,0.20)'
                          : 'rgba(255,255,255,0.03)',
                        border: isChampion ? '1px solid var(--gold)'
                          : isAdvancing ? '1px solid var(--green)'
                          : '1px solid rgba(255,255,255,0.06)',
                        display: 'flex', alignItems: 'center', gap: '5px',
                        minHeight: isFinal ? '36px' : '24px',
                        opacity: matchLocked && !isAdvancing ? 0.5 : 1,
                        transition: 'background 0.15s ease, border-color 0.15s ease'
                      }}
                    >
                      {team.flag_url && (
                        <img src={team.flag_url} alt="" style={{
                          width: isFinal ? '20px' : '15px',
                          height: isFinal ? '14px' : '11px',
                          borderRadius: '1.5px', objectFit: 'cover', flexShrink: 0,
                          opacity: isAdvancing ? 1 : 0.55
                        }} />
                      )}
                      <span style={{
                        fontSize: isFinal ? '11px' : '9.5px',
                        fontWeight: isAdvancing ? '700' : '500',
                        color: isChampion ? '#1a1d26'
                          : isAdvancing ? 'var(--text-primary)'
                          : 'var(--text-muted)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        flex: 1, textAlign: 'left'
                      }}>{team.name}</span>
                      {isChampion && (
                        <span style={{ fontSize: '11px', color: 'rgba(0,0,0,0.7)', flexShrink: 0 }}>🏆</span>
                      )}
                    </button>
                  )
                }

                return (
                  <div key={`${col.key}-${m.matchNumber}-${idx}`} style={{
                    // Wrapper: flex weight makes every column total 32 units.
                    // Slots stay in normal flow (they MUST contribute to the
                    // wrapper's intrinsic size or the whole column collapses).
                    // The slot stack is centered inside the wrapper via
                    // justify-content:center. The caption is position:absolute
                    // so it does NOT push the slots up — keeps the slot
                    // midpoint exactly on the wrapper midpoint regardless of
                    // whether this column carries captions or not.
                    flex: col.flex,
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center'
                  }}>
                    <div style={{
                      display: 'flex', flexDirection: 'column',
                      gap: '2px'
                    }}>
                      {renderSlot('home')}
                      {renderSlot('away')}
                    </div>
                    {showCaption && (
                      <div style={{
                        position: 'absolute',
                        bottom: '2px', left: 0, right: 0,
                        fontSize: '8.5px', color: 'var(--text-dim)',
                        textAlign: 'center', lineHeight: '1.25',
                        padding: '0 2px',
                        pointerEvents: 'none'
                      }}>
                        {captionText}
                        {matchInfo.city && <><br/>📍 {matchInfo.city}</>}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Footer: cadena campeón hint */}
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

    </div>
  )
}
