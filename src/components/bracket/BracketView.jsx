import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../../supabase'
import { calculateGroupStandings } from '../../utils/groupStandings'
import {
  ROUNDS, R32_MATCHES, R16_MATCHES, QF_MATCHES, SF_MATCHES, FINAL_MATCH,
  resolveR32Matchups, resolveRoundMatchups
} from '../../utils/bracketStructure'
import BracketRound from './BracketRound'

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
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
        Cargando bracket...
      </div>
    )
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

  const activeRoundData = ROUNDS.find(r => r.key === activeRound)

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '12px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', margin: '0 0 4px' }}>
          🏆 Bracket de eliminatorias
        </h3>
        <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: 0 }}>
          Elige el ganador de cada partido. Tu campeón acumula hasta 20 pts.
        </p>
      </div>

      {/* Round tabs */}
      <div className="group-tabs" style={{ marginBottom: '14px' }}>
        {ROUNDS.map(round => {
          const isActive = activeRound === round.key
          const progress = roundProgress[round.key]
          return (
            <button
              key={round.key}
              onClick={() => setActiveRound(round.key)}
              style={{
                padding: '6px 12px', borderRadius: '20px', border: 'none',
                background: isActive ? 'var(--green)' : 'var(--bg-secondary)',
                color: isActive ? '#fff' : 'var(--text-muted)',
                cursor: 'pointer', fontSize: '11px', fontWeight: isActive ? '600' : '400',
                whiteSpace: 'nowrap', flexShrink: 0,
                transition: 'all 0.2s ease'
              }}
            >
              {round.label} <span style={{ opacity: 0.6, fontSize: '10px' }}>{progress}</span>
            </button>
          )
        })}
      </div>

      {/* Active round */}
      <BracketRound
        roundKey={activeRoundData.key}
        label={activeRoundData.label}
        matches={activeRoundData.matches}
        matchups={allMatchups[activeRoundData.key]}
        picks={picks}
        points={activeRoundData.pointsPerWin}
        onPickWinner={handlePickWinner}
        disabled={false}
        r32Sources={activeRoundData.key === 'r32'}
      />
    </div>
  )
}
