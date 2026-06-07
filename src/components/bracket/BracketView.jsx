import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../../supabase'
import { calculateGroupStandings } from '../../utils/groupStandings'
import {
  ROUNDS, R32_MATCHES, R16_MATCHES, QF_MATCHES, SF_MATCHES, FINAL_MATCH,
  resolveR32Matchups, resolveRoundMatchups
} from '../../utils/bracketStructure'
import { FootballSpinner } from '../Skeleton'

export default function BracketView({ session, targetUserId, persist }) {
  // Usuario destino: por defecto el propio; en modo admin-Bot365 se pasa su UID
  // y un adaptador `persist` que escribe vía servidor (el cliente no puede por RLS).
  const uid = targetUserId || session.user.id
  const [matches, setMatches] = useState([])
  const [predictions, setPredictions] = useState({})
  const [picks, setPicks] = useState({}) // { matchNumber: { predicted_winner_id, home_team_id, away_team_id } }
  const [teamsById, setTeamsById] = useState({})
  const [knockoutDates, setKnockoutDates] = useState({}) // { match_number: Date } — for per-match locking
  const [loading, setLoading] = useState(true)
  // Default tab = Octavos (first round the user actually picks; R32 is read-
  // only-ish since it auto-fills from group predictions).
  const [activeRound, setActiveRound] = useState('r16')
  const debounceTimers = useRef({})

  useEffect(() => {
    fetchData()
    return () => {
      Object.values(debounceTimers.current).forEach(clearTimeout)
    }
  }, [])

  // Adaptadores de guardado: si hay `persist` (modo Bot365) escribe por servidor;
  // si no, escribe directo en Supabase como el propio usuario.
  async function persistUpsert(rows) {
    if (persist) return persist.upsert(rows)
    return supabase.from('bracket_picks').upsert(
      rows.map(p => ({ ...p, user_id: uid, updated_at: new Date().toISOString() })),
      { onConflict: 'user_id,match_number' }
    )
  }
  async function persistClear(matchNumbers) {
    if (persist) return persist.clear(matchNumbers)
    return supabase.from('bracket_picks')
      .update({ predicted_winner_id: null, updated_at: new Date().toISOString() })
      .eq('user_id', uid)
      .in('match_number', matchNumbers)
  }

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
        .eq('user_id', uid),
      supabase
        .from('bracket_picks')
        .select('*')
        .eq('user_id', uid),
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
      persistUpsert(toUpsert).then((r) => { if (r?.error) console.error('Auto-fill bracket save error:', r.error) })
    }
    if (toClear.length) {
      persistClear(toClear).then((r) => { if (r?.error) console.error('Cascade-clear bracket error:', r.error) })
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
      const r = await persistUpsert([{
        match_number: matchNumber,
        round,
        predicted_winner_id: teamId,
        home_team_id: matchup.home?.id,
        away_team_id: matchup.away?.id,
      }])
      if (r?.error) console.error('Error saving bracket pick:', r.error)
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
  // Potential points: 16avos 1 · Octavos 1 · Cuartos 2 · Semis 4 · Final 8.
  // Ganar la final ya vale 8 (sin bonus aparte). Cadena campeón = 16.
  const potentialPts = (totalR32Picked * 1) + (totalR16Picked * 1) + (totalQFPicked * 2) + (totalSFPicked * 4) + (totalFinalPicked * 8)

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
    { key: 'r32',   label: '16avos',  pts: 1, matches: R32_MATCHES_ORDERED, flex: 2 },
    { key: 'r16',   label: 'Octavos', pts: 1, matches: R16_MATCHES,         flex: 4 },
    { key: 'qf',    label: 'Cuartos', pts: 2, matches: QF_MATCHES,          flex: 8 },
    { key: 'sf',    label: 'Semi',    pts: 4, matches: SF_MATCHES,          flex: 16 },
    { key: 'final', label: 'Final',   pts: 8, matches: FINAL_MATCH,         flex: 32 }
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

      {/* Round tabs — one round at a time. The earlier 5-column cascading
          bracket fought against narrow phone screens (too cramped). Now we
          show each round full-width: tap a tab → its matches expand below,
          big and breathable, with home/away cards stacked. The progress
          counters (X/Y per round) live in the tab so the user always knows
          how much they have left. */}
      <div style={{
        display: 'flex', gap: '4px',
        marginBottom: '12px',
        padding: '4px', borderRadius: '10px',
        background: 'var(--bg-secondary)',
        overflowX: 'auto', WebkitOverflowScrolling: 'touch'
      }}>
        {COLUMNS.map(col => {
          const isActive = activeRound === col.key
          const pickedThisRound = col.matches.filter(m => picks[m.matchNumber]?.predicted_winner_id).length
          const totalThisRound = col.matches.length
          return (
            <button
              key={col.key}
              onClick={() => setActiveRound(col.key)}
              style={{
                flex: 1, minWidth: 0,
                padding: '8px 6px', borderRadius: '8px',
                border: 'none',
                background: isActive ? 'var(--green)' : 'transparent',
                color: isActive ? '#fff' : 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: '2px',
                transition: 'background 0.18s ease, color 0.18s ease'
              }}
            >
              <span style={{
                fontSize: '11px', fontWeight: '700',
                letterSpacing: '0.3px'
              }}>{col.label}</span>
              <span style={{
                fontSize: '9px', fontWeight: '600',
                opacity: isActive ? 0.85 : 0.55
              }}>{pickedThisRound}/{totalThisRound}</span>
            </button>
          )
        })}
      </div>

      {/* Active round — matches expanded full-width */}
      {(() => {
        const col = COLUMNS.find(c => c.key === activeRound) || COLUMNS[1]
        const matchups = allMatchups[col.key]
        const isFinal = col.key === 'final'

        // Visual groupings: every group of matches feeding the same next-round
        // match gets a header showing the destination ("Mitad izquierda →
        // Semifinal 1", etc.) and clicking the header jumps to that round.
        // Keeps the FIFA structure intact while making the bracket geometry
        // explicit on a single-column phone layout.
        const getGroupings = (roundKey) => {
          if (roundKey === 'final') return null
          if (roundKey === 'sf') {
            return [{
              label: 'Semifinales → Final',
              destinationRound: 'final',
              matches: SF_MATCHES
            }]
          }
          if (roundKey === 'qf') {
            return [
              {
                label: 'Mitad izquierda → Semifinal 1',
                destinationRound: 'sf',
                matches: QF_MATCHES.filter(m => [97, 98].includes(m.matchNumber))
              },
              {
                label: 'Mitad derecha → Semifinal 2',
                destinationRound: 'sf',
                matches: QF_MATCHES.filter(m => [99, 100].includes(m.matchNumber))
              }
            ]
          }
          if (roundKey === 'r16') {
            return QF_MATCHES.map((qf, idx) => ({
              label: `→ Cuartos · Partido ${idx + 1}`,
              destinationRound: 'qf',
              matches: R16_MATCHES.filter(m =>
                [qf.homeMatch, qf.awayMatch].includes(m.matchNumber)
              )
            }))
          }
          if (roundKey === 'r32') {
            return R16_MATCHES.map((r16, idx) => ({
              label: `→ Octavos · Partido ${idx + 1}`,
              destinationRound: 'r16',
              matches: R32_MATCHES_ORDERED.filter(m =>
                [r16.homeMatch, r16.awayMatch].includes(m.matchNumber)
              )
            }))
          }
          return null
        }

        const groupings = getGroupings(col.key)
        const orderedMatches = groupings ? groupings.flatMap(g => g.matches) : col.matches

        const renderMatch = (m, idx, isLastInGroup) => {
          const matchup = matchups[m.matchNumber]
          const pick = picks[m.matchNumber]
          const matchInfo = knockoutDates[m.matchNumber]
          const matchLocked = matchInfo && (matchInfo.date <= new Date() || matchInfo.status !== 'scheduled')

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
                  padding: '12px 14px', borderRadius: '8px',
                  border: '1px dashed rgba(255,255,255,0.08)',
                  fontSize: '12px', color: 'var(--text-dim)', textAlign: 'center',
                  minHeight: '44px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>Por determinar</div>
              )
            }

            return (
              <button
                onClick={handleClick}
                disabled={!clickable}
                style={{
                  width: '100%',
                  padding: '12px 14px', borderRadius: '8px',
                  cursor: clickable ? 'pointer' : 'default',
                  background: isChampion ? 'var(--gold)'
                    : isAdvancing ? 'rgba(0,122,69,0.20)'
                    : 'var(--bg-secondary)',
                  border: isChampion ? '1.5px solid var(--gold)'
                    : isAdvancing ? '1.5px solid var(--green)'
                    : '1px solid var(--border-light)',
                  display: 'flex', alignItems: 'center', gap: '12px',
                  minHeight: '48px',
                  opacity: matchLocked && !isAdvancing ? 0.5 : 1,
                  transition: 'background 0.15s ease, border-color 0.15s ease'
                }}
              >
                {team.flag_url && (
                  <img src={team.flag_url} alt="" style={{
                    width: '28px', height: '20px',
                    borderRadius: '2px', objectFit: 'cover', flexShrink: 0,
                    opacity: isAdvancing ? 1 : 0.6
                  }} />
                )}
                <span style={{
                  fontSize: '14px',
                  fontWeight: isAdvancing ? '700' : '500',
                  color: isChampion ? '#1a1d26'
                    : isAdvancing ? 'var(--text-primary)'
                    : 'var(--text-muted)',
                  flex: 1, textAlign: 'left'
                }}>{team.name}</span>
                {isAdvancing && !isChampion && (
                  <span style={{
                    fontSize: '10px', fontWeight: '700', color: 'var(--green)',
                    flexShrink: 0
                  }}>✓ PASA</span>
                )}
                {isChampion && (
                  <span style={{
                    fontSize: '13px', color: 'rgba(0,0,0,0.7)', flexShrink: 0,
                    fontWeight: '800'
                  }}>🏆 CAMPEÓN</span>
                )}
              </button>
            )
          }

          return (
            <div key={`${col.key}-${m.matchNumber}-${idx}`} style={{
              padding: '10px 0',
              borderBottom: !isLastInGroup ? '0.5px solid var(--border-light)' : 'none'
            }}>
              {/* Match label */}
              <div style={{
                fontSize: '10px', fontWeight: '700',
                color: 'var(--text-dim)', letterSpacing: '0.6px',
                textTransform: 'uppercase',
                marginBottom: '8px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <span>Partido {idx + 1}</span>
                {matchInfo && (
                  <span style={{ fontWeight: '500', letterSpacing: '0', textTransform: 'none' }}>
                    {matchInfo.date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                    {' · '}
                    {matchInfo.date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    {matchInfo.city && ` · 📍 ${matchInfo.city}`}
                  </span>
                )}
              </div>

              {/* Two stacked slots */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {renderSlot('home')}
                {renderSlot('away')}
              </div>

              {/* Points hint per match (todas las rondas dan puntos ya) */}
              {col.pts > 0 && (
                <div style={{
                  marginTop: '6px',
                  fontSize: '10px', color: 'var(--text-dim)',
                  textAlign: 'right'
                }}>
                  Acertar el ganador: <span style={{ color: 'var(--gold)', fontWeight: '700' }}>+{col.pts} pts{isFinal ? ' (campeón)' : ''}</span>
                </div>
              )}
            </div>
          )
        }

        return (
          <div style={{
            background: 'var(--bg-secondary)',
            borderRadius: '12px',
            padding: '14px 16px',
            marginBottom: '14px'
          }}>
            {/* Section title */}
            <div style={{
              fontSize: '15px', fontWeight: '700',
              color: 'var(--text-primary)',
              marginBottom: '10px'
            }}>{col.label}</div>

            {groupings ? (
              groupings.map((group, gIdx) => (
                <div key={`${col.key}-grp-${gIdx}`} style={{
                  marginTop: gIdx === 0 ? '4px' : '16px',
                  background: 'rgba(0,122,69,0.04)',
                  border: '1px solid rgba(0,122,69,0.15)',
                  borderRadius: '10px',
                  padding: '4px 10px 8px'
                }}>
                  {/* Clickable destination header — jumps to next round tab */}
                  <button
                    onClick={() => setActiveRound(group.destinationRound)}
                    style={{
                      width: '100%',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 4px',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: '1px dashed rgba(0,122,69,0.25)',
                      cursor: 'pointer',
                      marginBottom: '4px'
                    }}
                  >
                    <span style={{
                      fontSize: '11px', fontWeight: '800',
                      color: 'var(--green)',
                      letterSpacing: '0.3px',
                      textTransform: 'uppercase'
                    }}>
                      {group.label}
                    </span>
                    <span style={{
                      fontSize: '10px', fontWeight: '700',
                      color: 'var(--green)',
                      opacity: 0.8
                    }}>
                      Ver →
                    </span>
                  </button>
                  {group.matches.map((m, mIdx) => {
                    const globalIdx = orderedMatches.indexOf(m)
                    const isLastInGroup = mIdx === group.matches.length - 1
                    return renderMatch(m, globalIdx, isLastInGroup)
                  })}
                </div>
              ))
            ) : (
              col.matches.map((m, idx) => renderMatch(m, idx, idx === col.matches.length - 1))
            )}
          </div>
        )
      })()}
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
            hasta +16
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '2px' }}>
            1 + 1 + 2 + 4 + 8
          </div>
        </div>
      </div>

    </div>
  )
}
