import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../../supabase'
import BetCard from '../../../components/bets/BetCard'
import BetProgress from '../../../components/bets/BetProgress'

const CATEGORY_LABELS = {
  podium: 'Podio y Campeón',
  players: 'Jugadores',
  teams: 'Selecciones',
  stats: 'Estadísticas',
  yesno: '¿Sí o No?'
}

const CATEGORY_ORDER = ['podium', 'players', 'teams', 'stats', 'yesno']

export default function PreTournamentBets({ session, deadline }) {
  const [bets, setBets] = useState([])
  const [entries, setEntries] = useState({}) // { bet_id: entry }
  const [loading, setLoading] = useState(true)
  const [savingBetId, setSavingBetId] = useState(null)
  const [message, setMessage] = useState('')
  const debounceTimers = useRef({})

  useEffect(() => {
    fetchData()
    return () => {
      // Cleanup debounce timers
      Object.values(debounceTimers.current).forEach(clearTimeout)
    }
  }, [])

  async function fetchData() {
    // Fetch bets catalog
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

    // Fetch user entries
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
      } else {
        // Update with real data from server
        if (data && data[0]) {
          setEntries(prev => ({
            ...prev,
            [betId]: data[0]
          }))
        }
      }

      setSavingBetId(null)
    }, 600) // 600ms debounce
  }

  if (loading) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
        Cargando apuestas...
      </div>
    )
  }

  const completedCount = bets.filter(b => entries[b.id]?.value).length
  const totalMaxPoints = bets.reduce((sum, b) => sum + b.max_points, 0)

  // Group by category
  const betsByCategory = {}
  bets.forEach(b => {
    if (!betsByCategory[b.category]) betsByCategory[b.category] = []
    betsByCategory[b.category].push(b)
  })

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '14px' }}>
        <h3 style={{
          fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)',
          margin: '0 0 4px'
        }}>
          Apuestas Pre-Torneo
        </h3>
        <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: 0 }}>
          20 apuestas especiales — hasta {totalMaxPoints} puntos extra
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

      {/* Bets by category */}
      {CATEGORY_ORDER.map(category => {
        const categoryBets = betsByCategory[category]
        if (!categoryBets?.length) return null

        return (
          <div key={category} style={{ marginBottom: '20px' }}>
            {/* Category header */}
            <div style={{
              fontSize: '11px',
              color: 'var(--text-dim)',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              fontWeight: '600',
              padding: '12px 0 8px',
              borderBottom: '0.5px solid var(--border-light)',
              marginBottom: '10px'
            }}>
              {CATEGORY_LABELS[category] || category}
            </div>

            {categoryBets.map(bet => (
              <BetCard
                key={bet.id}
                bet={bet}
                entry={entries[bet.id]}
                onSave={handleSave}
                disabled={deadline.expired}
              />
            ))}
          </div>
        )
      })}
    </div>
  )
}
