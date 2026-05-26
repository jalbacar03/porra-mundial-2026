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

  // R32 ordered to follow the R16 feeder chain: for each R16 match (89..96),
  // place its two feeding R32 matches (homeMatch, awayMatch) adjacent. That
  // way the visual position of each R32 card lines up with the R16 card it
  // feeds — same trick we use for QF→SF→Final via the flex weights below.
  const R32_ORDERED = R16_MATCHES.flatMap(r16 => [
    R32_MATCHES.find(m => m.matchNumber === r16.homeMatch),
    R32_MATCHES.find(m => m.matchNumber === r16.awayMatch),
  ]).filter(Boolean)

  // flex weight per column: each card occupies vertical space proportional
  // to how many R32 cards it sits "above". 16 R32 cards × 0.5 = 8 units,
  // 8 R16 cards × 1 = 8, 4 QF × 2 = 8, 2 SF × 4 = 8, 1 Final × 8 = 8.
  // Every column has the same total height → matching cards line up.
  const COLUMNS = [
    { key: 'r32', label: '16avos', pts: 0, matches: R32_ORDERED, flex: 0.5, readonly: true },
    { key: 'r16', label: 'Octavos', pts: 1, matches: R16_MATCHES, flex: 1 },
    { key: 'qf', label: 'Cuartos', pts: 2, matches: QF_MATCHES, flex: 2 },
    { key: 'sf', label: 'Semi', pts: 4, matches: SF_MATCHES, flex: 4 },
    { key: 'final', label: 'Final', pts: 5, matches: FINAL_MATCH, flex: 8 }
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
              {col.matches.map(m => {
                const matchup = matchups[m.matchNumber]
                const pick = picks[m.matchNumber]
                const winnerId = pick?.predicted_winner_id
                const winnerTeam = winnerId === matchup?.home?.id ? matchup.home : winnerId === matchup?.away?.id ? matchup.away : null
                const isFinal = col.key === 'final'
                // Points: round points; if final picked → add champion bonus 8
                const pts = isFinal && winnerTeam ? col.pts + 8 : col.pts

                // Per-match deadline: lock when the match has already started
                const matchInfo = knockoutDates[m.matchNumber]
                const matchLocked = matchInfo && (matchInfo.date <= new Date() || matchInfo.status !== 'scheduled')

                const togglePick = () => {
                  if (matchLocked) return
                  if (col.readonly) return  // R32 is auto-derived from group predictions, no manual change
                  if (!matchup?.home || !matchup?.away) return
                  // If no pick → pick home; if home → switch to away; if away → switch to home
                  const next = winnerId === matchup.home.id ? matchup.away.id
                             : winnerId === matchup.away.id ? matchup.home.id
                             : matchup.home.id
                  handlePickWinner(m.matchNumber, next)
                }

                // Slot wrapper: flex weight ensures each card occupies vertical
                // space proportional to its round, so cards align with the
                // midpoint of the two cards feeding it in the previous round.
                const slotStyle = {
                  flex: col.flex,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '3px 0',
                  gap: '3px'
                }

                // Match metadata caption (date + city). R32 cards are half the
                // height of R16 cards and have 16 of them — packing fecha + city
                // there would visually saturate the column. Show full caption
                // only from R16 onwards. (R32 cards keep just the team name.)
                const matchCaption = matchInfo && col.key !== 'r32' && (
                  <div style={{
                    fontSize: '8.5px', color: 'var(--text-dim)',
                    textAlign: 'center', lineHeight: '1.2',
                    width: '100%', overflow: 'hidden', textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap', padding: '0 2px'
                  }}>
                    {matchInfo.date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                    {' · '}
                    {matchInfo.date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    {matchInfo.city && (
                      <>
                        <br/>📍 {matchInfo.city}
                      </>
                    )}
                  </div>
                )

                if (!matchup?.home || !matchup?.away) {
                  return (
                    <div key={m.matchNumber} style={slotStyle}>
                      <div style={{
                        width: '100%',
                        padding: '8px 6px', borderRadius: '8px',
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px dashed rgba(255,255,255,0.06)',
                        fontSize: '9px', color: 'var(--text-dim)', textAlign: 'center'
                      }}>—</div>
                      {matchCaption}
                    </div>
                  )
                }

                return (
                  <div key={m.matchNumber} style={slotStyle}>
                    <button
                      onClick={togglePick}
                      disabled={matchLocked || col.readonly}
                      title={
                        matchLocked ? 'Partido ya iniciado'
                        : col.readonly ? 'Se deriva automáticamente de tus predicciones de grupo'
                        : ''
                      }
                      style={{
                        width: '100%',
                        padding: isFinal ? '12px 6px' : col.key === 'r32' ? '4px 3px' : '8px 6px',
                        borderRadius: col.key === 'r32' ? '6px' : '8px',
                        cursor: matchLocked || col.readonly ? 'default' : 'pointer',
                        background: isFinal && winnerTeam ? 'var(--gold)' : 'var(--bg-secondary)',
                        border: winnerTeam
                          ? (isFinal ? '1px solid var(--gold)' : col.readonly ? '1px solid rgba(255,255,255,0.08)' : '1px solid var(--green)')
                          : '1px solid var(--border-light)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        gap: col.key === 'r32' ? '1px' : '3px',
                        minHeight: isFinal ? '70px' : 'auto',
                        opacity: matchLocked ? 0.6 : 1
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
                            fontSize: col.key === 'r32' ? '9px' : '10px',
                            fontWeight: '700',
                            color: isFinal ? '#1a1d26' : 'var(--text-primary)',
                            textAlign: 'center', lineHeight: '1.1',
                            maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                          }}>{winnerTeam.name}</span>
                          {pts > 0 && (
                            <span style={{
                              fontSize: '9px', fontWeight: '800',
                              color: isFinal ? 'rgba(0,0,0,0.7)' : 'var(--gold)'
                            }}>
                              {isFinal ? '🏆 +' : '+'}{pts}
                            </span>
                          )}
                        </>
                      ) : (
                        <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>Elegir</span>
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

    </div>
  )
}
