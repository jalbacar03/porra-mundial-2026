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

  // Every round uses the same "two slots per match" model:
  //   – Each match contributes [home slot, away slot] adjacent.
  //   – The slots are ordered along the feeder chain so the slots of any
  //     given match physically sit between the slots of the two feeding
  //     matches in the previous column (classic bracket layout).
  //
  // R32 (32 slots) → R16 (16 slots) → QF (8) → SF (4) → Final (2).
  // Every column totals 32 units of vertical space (flex weights below)
  // so cards line up cleanly across rounds.
  const R32_SLOTS = R16_MATCHES.flatMap(r16 => {
    const out = []
    for (const r32mn of [r16.homeMatch, r16.awayMatch]) {
      out.push({ matchNumber: r32mn, side: 'home' })
      out.push({ matchNumber: r32mn, side: 'away' })
    }
    return out
  })
  const slotsOf = (matchesArr) => matchesArr.flatMap(m => [
    { matchNumber: m.matchNumber, side: 'home' },
    { matchNumber: m.matchNumber, side: 'away' },
  ])
  const R16_SLOTS = slotsOf(R16_MATCHES)
  const QF_SLOTS = slotsOf(QF_MATCHES)
  const SF_SLOTS = slotsOf(SF_MATCHES)
  const FINAL_SLOTS = slotsOf(FINAL_MATCH)

  const COLUMNS = [
    { key: 'r32',   label: '16avos',  pts: 0, matches: R32_SLOTS,   flex: 1,  readonly: true },
    { key: 'r16',   label: 'Octavos', pts: 1, matches: R16_SLOTS,   flex: 2 },
    { key: 'qf',    label: 'Cuartos', pts: 2, matches: QF_SLOTS,    flex: 4 },
    { key: 'sf',    label: 'Semi',    pts: 4, matches: SF_SLOTS,    flex: 8 },
    { key: 'final', label: 'Final',   pts: 5, matches: FINAL_SLOTS, flex: 16 }
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
            <div key={col.key} style={{ display: 'flex', flexDirection: 'column' }}>
              {col.matches.map((slot, idx) => {
                // Unified slot rendering for every round: each slot represents
                // one team of one match. Two adjacent slots = one match.
                const matchup = matchups[slot.matchNumber]
                const team = matchup?.[slot.side]
                const pick = picks[slot.matchNumber]
                const isAdvancing = team && pick?.predicted_winner_id === team.id
                const isFinal = col.key === 'final'

                const matchInfo = knockoutDates[slot.matchNumber]
                const matchLocked = matchInfo && (matchInfo.date <= new Date() || matchInfo.status !== 'scheduled')

                // Visual grouping: tight gap inside a match (between the home
                // and away slots), wider gap between matches.
                const isAwayHalfBoundary = slot.side === 'away' && idx < col.matches.length - 1

                const clickable = team && !col.readonly && !matchLocked && matchup?.home && matchup?.away
                const handleClick = () => {
                  if (!clickable) return
                  // Set this slot's team as the match winner (no toggle off — to
                  // change the winner the user clicks the OTHER slot of the pair).
                  if (pick?.predicted_winner_id === team.id) return
                  handlePickWinner(slot.matchNumber, team.id)
                }

                // Slot wrapper with flex weight (round-proportional vertical
                // space → cards line up across columns like a real bracket).
                const slotWrapStyle = {
                  flex: col.flex,
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'stretch', justifyContent: 'center',
                  padding: '1px 0',
                  paddingBottom: isAwayHalfBoundary ? '6px' : '1px'
                }

                // Caption appears once per match, under the away slot, with
                // the date / city. R32 is read-only / very dense → skip caption.
                const showCaption = slot.side === 'away' && col.key !== 'r32' && matchInfo
                const matchCaption = showCaption && (
                  <div style={{
                    fontSize: '8.5px', color: 'var(--text-dim)',
                    textAlign: 'center', lineHeight: '1.25',
                    marginTop: '3px', padding: '0 2px'
                  }}>
                    {matchInfo.date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                    {' · '}
                    {matchInfo.date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    {matchInfo.city && <><br/>📍 {matchInfo.city}</>}
                  </div>
                )

                // Final winner = champion → gold treatment
                const isChampion = isFinal && isAdvancing

                // Placeholder when team isn't resolved yet
                if (!team) {
                  return (
                    <div key={`${col.key}-${idx}`} style={slotWrapStyle}>
                      <div style={{
                        padding: '4px 6px', borderRadius: '6px',
                        border: '1px dashed rgba(255,255,255,0.06)',
                        fontSize: '9px', color: 'var(--text-dim)', textAlign: 'center',
                        minHeight: col.key === 'final' ? '40px' : '24px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>?</div>
                      {matchCaption}
                    </div>
                  )
                }

                return (
                  <div key={`${col.key}-${idx}`} style={slotWrapStyle}>
                    <button
                      onClick={handleClick}
                      disabled={!clickable}
                      title={
                        matchLocked ? 'Partido ya iniciado'
                        : col.readonly ? 'Se deriva automáticamente de tus predicciones de grupo'
                        : isAdvancing ? 'Ya elegido como ganador'
                        : 'Tap para elegir como ganador'
                      }
                      style={{
                        width: '100%',
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
                    {matchCaption}
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
