import { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from '../../../supabase'
import BetCard from '../../../components/bets/BetCard'
import BetProgress from '../../../components/bets/BetProgress'
import { generateMockBetEntries } from '../../../hooks/useDemoMode'
// GroupStandingsPreview removed — standings now shown in GroupMatchPredictions
// Bracket picks handled in BracketView component

const CATEGORY_LABELS = {
  players: 'Jugadores',
  teams: 'Selecciones',
  yesno: '¿Sí o No?'
}

const CATEGORY_ORDER = ['players', 'teams', 'yesno']

// Slugs to EXCLUDE from specials (moved to bracket or removed)
const EXCLUDED_SLUGS = [
  'round_of_32', 'round_of_16', 'quarter_finalists', 'semi_finalists', 'finalists', 'my_champion'
]

// Knockout cascade chain: higher tier flows into lower tiers
// Each entry: { slug, getTeamIds(value) }
const KNOCKOUT_CHAIN = [
  { slug: 'my_champion', label: 'champion', getTeamIds: v => v?.team_id ? [v.team_id] : [] },
  { slug: 'finalists', label: 'finalists', getTeamIds: v => v?.teams || [] },
  { slug: 'semi_finalists', label: 'semi_finalists', getTeamIds: v => v?.teams || [] },
  { slug: 'quarter_finalists', label: 'quarter_finalists', getTeamIds: v => v?.teams || [] },
  { slug: 'round_of_16', label: 'round_of_16', getTeamIds: v => v?.teams || [] },
  { slug: 'round_of_32', label: 'round_of_32', getTeamIds: v => v?.teams || [] }
]

export default function PreTournamentBets({ session, deadline, demoMode }) {
  const [bets, setBets] = useState([])
  const [entries, setEntries] = useState({}) // { bet_id: entry }
  const [loading, setLoading] = useState(true)
  const [savingBetId, setSavingBetId] = useState(null)
  const [message, setMessage] = useState('')
  const [activeCategory, setActiveCategory] = useState('players')
  const debounceTimers = useRef({})

  useEffect(() => {
    fetchData()
    return () => {
      Object.values(debounceTimers.current).forEach(clearTimeout)
    }
  }, [])

  async function fetchData() {
    const { data: betsData, error: betsError } = await supabase
      .from('pre_tournament_bets')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')

    if (betsError) {
      console.error('Error cargando apuestas:', betsError)
      setLoading(false)
      return
    }
    setBets(betsData || [])

    const { data: entriesData, error: entriesError } = await supabase
      .from('pre_tournament_entries')
      .select('*')
      .eq('user_id', session.user.id)

    if (!entriesError && entriesData) {
      const entriesMap = {}
      entriesData.forEach(e => {
        entriesMap[e.bet_id] = e
      })
      setEntries(entriesMap)
    }
    setLoading(false)
  }

  // Build slug → betId map
  const slugToBetId = useMemo(() => {
    const map = {}
    bets.forEach(b => {
      if (b.slug) map[b.slug] = b.id
    })
    return map
  }, [bets])

  // Compute cascade info for each knockout bet
  const cascadeInfoMap = useMemo(() => {
    const info = {} // { betId: { lockedTeams: [{ teamId, source }] } }

    // Walk the chain top-down, accumulating locked teams for each tier
    let accumulatedLocked = [] // [{ teamId, source }]

    for (let i = 0; i < KNOCKOUT_CHAIN.length; i++) {
      const { slug, label } = KNOCKOUT_CHAIN[i]
      const betId = slugToBetId[slug]
      if (!betId) continue

      // For this bet, the locked teams are everything accumulated from higher tiers
      if (i > 0) {
        info[betId] = {
          lockedTeams: [...accumulatedLocked]
        }
      }

      // Add this tier's selections to accumulated for lower tiers
      const entry = entries[betId]
      const teamIds = KNOCKOUT_CHAIN[i].getTeamIds(entry?.value)
      teamIds.forEach(tid => {
        // Only add if not already accumulated (avoid dupes)
        if (!accumulatedLocked.some(lt => lt.teamId === tid)) {
          accumulatedLocked.push({ teamId: tid, source: label })
        }
      })
    }

    return info
  }, [bets, entries, slugToBetId])

  async function saveEntry(betId, value) {
    setSavingBetId(betId)

    const { data, error } = await supabase
      .from('pre_tournament_entries')
      .upsert({
        user_id: session.user.id,
        bet_id: betId,
        value: value,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,bet_id' })
      .select()

    if (error) {
      setMessage('Error al guardar: ' + error.message)
      setTimeout(() => setMessage(''), 3000)
    } else if (data?.[0]) {
      setEntries(prev => ({ ...prev, [betId]: data[0] }))
    }
    setSavingBetId(null)
  }

  async function handleSave(betId, value) {
    if (deadline.expired) return

    // Optimistic update
    setEntries(prev => ({
      ...prev,
      [betId]: {
        ...prev[betId],
        bet_id: betId,
        user_id: session.user.id,
        value: value,
        is_resolved: false,
        points_awarded: 0,
        _saving: true
      }
    }))

    // Debounce the save
    if (debounceTimers.current[betId]) {
      clearTimeout(debounceTimers.current[betId])
    }

    debounceTimers.current[betId] = setTimeout(async () => {
      await saveEntry(betId, value)

      // Cascade: if this bet is in the knockout chain, auto-merge to lower tiers
      cascadeDown(betId, value)
    }, 600)
  }

  function cascadeDown(changedBetId, newValue) {
    // Find which position in the chain this bet is
    const chainIdx = KNOCKOUT_CHAIN.findIndex(c => slugToBetId[c.slug] === changedBetId)
    if (chainIdx === -1) return // not a knockout bet

    // Get the team IDs from the changed bet
    const changedTeamIds = KNOCKOUT_CHAIN[chainIdx].getTeamIds(newValue)

    // Recompute full accumulation from top down to know what's locked at each level
    let accumulated = []
    for (let i = 0; i <= chainIdx; i++) {
      const betId = slugToBetId[KNOCKOUT_CHAIN[i].slug]
      if (!betId) continue
      const entry = i === chainIdx
        ? { value: newValue } // use the new value for the changed bet
        : entries[betId]
      const tids = KNOCKOUT_CHAIN[i].getTeamIds(entry?.value)
      tids.forEach(tid => {
        if (!accumulated.includes(tid)) accumulated.push(tid)
      })
    }

    // For each lower tier, ensure locked teams are included
    for (let j = chainIdx + 1; j < KNOCKOUT_CHAIN.length; j++) {
      const lowerSlug = KNOCKOUT_CHAIN[j].slug
      const lowerBetId = slugToBetId[lowerSlug]
      if (!lowerBetId) continue

      const lowerEntry = entries[lowerBetId]
      const currentTeamIds = KNOCKOUT_CHAIN[j].getTeamIds(lowerEntry?.value)

      // Merge: keep existing + add any missing locked teams
      const merged = [...currentTeamIds]
      accumulated.forEach(tid => {
        if (!merged.includes(tid)) merged.push(tid)
      })

      // Check if lower bet has exact_count limit
      const lowerBet = bets.find(b => b.id === lowerBetId)
      const exactCount = lowerBet?.config?.exact_count
      const finalTeams = exactCount ? merged.slice(0, exactCount) : merged

      // Only save if actually changed
      if (JSON.stringify(finalTeams.sort()) !== JSON.stringify(currentTeamIds.sort())) {
        const newLowerValue = { teams: finalTeams }

        // Optimistic update
        setEntries(prev => ({
          ...prev,
          [lowerBetId]: {
            ...prev[lowerBetId],
            bet_id: lowerBetId,
            user_id: session.user.id,
            value: newLowerValue,
            is_resolved: false,
            points_awarded: 0
          }
        }))

        // Save to DB (no debounce for cascade)
        saveEntry(lowerBetId, newLowerValue)
      }

      // Add this tier's teams to accumulated for even lower tiers
      const lowerTeamIds = KNOCKOUT_CHAIN[j].getTeamIds(lowerEntry?.value)
      lowerTeamIds.forEach(tid => {
        if (!accumulated.includes(tid)) accumulated.push(tid)
      })
    }
  }

  // Demo mode: generate mock entries for all bets
  const demoEntries = useMemo(() => {
    if (!demoMode || !bets.length) return null
    return generateMockBetEntries(bets)
  }, [demoMode, bets])

  const displayEntries = demoMode && demoEntries ? demoEntries : entries

  if (loading) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
        Cargando apuestas...
      </div>
    )
  }

  const completedCount = bets.filter(b => displayEntries[b.id]?.value).length
  const totalMaxPoints = bets.reduce((sum, b) => sum + b.max_points, 0)

  // Group by category — exclude bracket slugs + stats category
  const betsByCategory = {}
  bets.forEach(b => {
    // Skip excluded bets (bracket + champion)
    if (EXCLUDED_SLUGS.includes(b.slug)) return
    // Skip stats category
    if (b.category === 'stats') return
    // Skip podium category (all moved to bracket)
    if (b.category === 'podium') return

    const cat = b.category
    if (!betsByCategory[cat]) betsByCategory[cat] = []
    betsByCategory[cat].push(b)
  })

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '14px' }}>
        <h3 style={{
          fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)',
          margin: '0 0 4px'
        }}>
          Apuestas Especiales
        </h3>
        <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: 0 }}>
          10 apuestas especiales — +2 puntos cada una
        </p>
      </div>

      {/* Progress */}
      <BetProgress completed={completedCount} total={bets.length} />

      {/* Message */}
      {message && (
        <div style={{
          padding: '10px 12px', marginBottom: '12px',
          background: message.includes('Error') ? 'var(--red-bg)' : 'var(--green-light)',
          borderRadius: '6px', fontSize: '13px', textAlign: 'center',
          color: message.includes('Error') ? 'var(--red)' : 'var(--green)'
        }}>
          {message}
        </div>
      )}

      {/* Category tabs */}
      <div className="group-tabs" style={{ marginBottom: '14px' }}>
        {CATEGORY_ORDER.map(cat => {
          const isActive = activeCategory === cat
          const catBets = betsByCategory[cat] || []
          const catCompleted = catBets.filter(b => displayEntries[b.id]?.value).length
          const allDone = catCompleted === catBets.length && catBets.length > 0
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                padding: '6px 12px', borderRadius: '4px', border: 'none',
                background: isActive ? 'var(--green)' : allDone ? 'var(--green-light)' : 'var(--bg-secondary)',
                color: isActive ? '#fff' : allDone ? 'var(--green)' : 'var(--text-muted)',
                cursor: 'pointer', fontSize: '11px', fontWeight: isActive ? '600' : '400',
                whiteSpace: 'nowrap', flexShrink: 0
              }}
            >
              {CATEGORY_LABELS[cat]} <span style={{ opacity: 0.6, fontSize: '10px' }}>{catCompleted}/{catBets.length}</span>
            </button>
          )
        })}
      </div>

      {/* Active category bets */}
      {(betsByCategory[activeCategory] || []).map(bet => (
        <BetCard
          key={bet.id}
          bet={bet}
          entry={displayEntries[bet.id]}
          onSave={demoMode ? () => {} : handleSave}
          disabled={deadline.expired || demoMode}
          cascadeInfo={cascadeInfoMap[bet.id] || null}
        />
      ))}
    </div>
  )
}
