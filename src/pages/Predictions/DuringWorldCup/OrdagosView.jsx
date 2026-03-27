import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../supabase'

// Fixed structure for the 6 órdagos
const ORDAGO_CONFIG = {
  1: { cost: 0, exact: 2, sign: 1 },
  2: { cost: 1, exact: 3, sign: 2 },
  3: { cost: 1, exact: 3, sign: 2 },
  4: { cost: 2, exact: 6, sign: 4 },
  5: { cost: 2, exact: 6, sign: 4 },
  6: { cost: 3, exact: 9, sign: 6 }
}

export default function OrdagosView({ session }) {
  const [ordagos, setOrdagos] = useState([])
  const [entries, setEntries] = useState({}) // ordago_id → entry
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState({})
  const [now, setNow] = useState(new Date())
  const [localScores, setLocalScores] = useState({}) // ordago_id → { home, away }

  const userId = session?.user?.id

  // Tick every minute
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const [ordagosRes, entriesRes] = await Promise.all([
      supabase.from('ordagos')
        .select(`
          *,
          match:matches(
            id, match_date, status, home_score, away_score,
            home_team:teams!matches_home_team_id_fkey(id, name, flag_url),
            away_team:teams!matches_away_team_id_fkey(id, name, flag_url)
          )
        `)
        .order('number'),
      userId
        ? supabase.from('ordago_entries').select('*').eq('user_id', userId)
        : { data: [] }
    ])

    const ordData = ordagosRes.data || []
    setOrdagos(ordData)

    const entryMap = {}
    const scoreMap = {}
    ;(entriesRes.data || []).forEach(e => {
      entryMap[e.ordago_id] = e
      scoreMap[e.ordago_id] = {
        home: e.predicted_home,
        away: e.predicted_away
      }
    })
    setEntries(entryMap)
    setLocalScores(scoreMap)
    setLoading(false)
  }

  // Deadline: 2h before match
  function getDeadline(match) {
    if (!match?.match_date) return null
    return new Date(new Date(match.match_date).getTime() - 2 * 60 * 60 * 1000)
  }

  function isOpen(ordago) {
    if (ordago.status === 'resolved' || ordago.status === 'closed') return false
    if (ordago.status === 'locked') return false
    if (!ordago.match) return false
    const deadline = getDeadline(ordago.match)
    if (!deadline) return false
    return now < deadline
  }

  function formatCountdown(match) {
    const deadline = getDeadline(match)
    if (!deadline) return null
    const diff = deadline - now
    if (diff <= 0) return null
    const days = Math.floor(diff / 86400000)
    const hours = Math.floor((diff % 86400000) / 3600000)
    const mins = Math.floor((diff % 3600000) / 60000)
    if (days > 0) return `${days}d ${hours}h`
    if (hours > 0) return `${hours}h ${mins}m`
    return `${mins}m`
  }

  // Determine which ordagos to show:
  // All resolved ones + the first non-resolved one
  function getVisibleOrdagos() {
    const visible = []
    for (const o of ordagos) {
      visible.push(o)
      if (o.status !== 'resolved') break // Show up to (and including) first non-resolved
    }
    return visible
  }

  function updateScore(ordagoId, field, value) {
    if (value !== '' && (isNaN(value) || parseInt(value) < 0 || parseInt(value) > 99)) return
    setLocalScores(prev => ({
      ...prev,
      [ordagoId]: {
        ...prev[ordagoId],
        [field]: value === '' ? '' : parseInt(value)
      }
    }))
  }

  const handleSave = useCallback(async (ordago) => {
    if (!userId) return
    const scores = localScores[ordago.id]
    if (!scores || scores.home === '' || scores.home === undefined ||
        scores.away === '' || scores.away === undefined) return

    setSaving(s => ({ ...s, [ordago.id]: true }))

    const { data, error } = await supabase
      .from('ordago_entries')
      .upsert({
        ordago_id: ordago.id,
        user_id: userId,
        predicted_home: scores.home,
        predicted_away: scores.away
      }, { onConflict: 'ordago_id,user_id' })
      .select()

    if (!error && data?.[0]) {
      setEntries(prev => ({ ...prev, [ordago.id]: data[0] }))
    }

    setSaving(s => ({ ...s, [ordago.id]: false }))
  }, [userId, localScores])

  // Calculate result for resolved ordago
  function getResult(ordago, entry) {
    if (ordago.status !== 'resolved' || !entry || !ordago.match) return null
    const m = ordago.match
    if (m.home_score === null || m.away_score === null) return null

    const config = ORDAGO_CONFIG[ordago.number] || {}
    const isExact = entry.predicted_home === m.home_score && entry.predicted_away === m.away_score

    // Sign comparison (1X2 at 90 min)
    const realSign = m.home_score > m.away_score ? '1' : m.home_score < m.away_score ? '2' : 'X'
    const predSign = entry.predicted_home > entry.predicted_away ? '1' : entry.predicted_home < entry.predicted_away ? '2' : 'X'
    const isSign = realSign === predSign

    if (isExact) return { type: 'exact', points: config.exact - config.cost, gross: config.exact, cost: config.cost }
    if (isSign) return { type: 'sign', points: config.sign - config.cost, gross: config.sign, cost: config.cost }
    return { type: 'fallo', points: -config.cost, gross: 0, cost: config.cost }
  }

  if (loading) {
    return <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>Cargando ordagos...</div>
  }

  if (ordagos.length === 0) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>🎲</div>
        <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Los ordagos se activaran durante el Mundial</div>
      </div>
    )
  }

  const visibleOrdagos = getVisibleOrdagos()
  const totalOrdagos = ordagos.length

  // Summary stats
  const resolvedEntries = ordagos
    .filter(o => o.status === 'resolved' && entries[o.id])
    .map(o => getResult(o, entries[o.id]))
    .filter(Boolean)
  const totalPoints = resolvedEntries.reduce((sum, r) => sum + r.points, 0)

  return (
    <div>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(255,204,0,0.08), rgba(255,204,0,0.03))',
        borderRadius: '10px', padding: '16px',
        border: '0.5px solid rgba(255,204,0,0.15)',
        marginBottom: '14px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--gold)' }}>
            Ordagos del Mundial
          </div>
          <span style={{
            fontSize: '10px', padding: '3px 8px', borderRadius: '4px',
            background: 'rgba(255,204,0,0.1)', color: 'var(--gold)', fontWeight: '600'
          }}>
            {visibleOrdagos.filter(o => o.status === 'resolved').length}/{totalOrdagos}
          </span>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5', margin: 0 }}>
          Predice el resultado exacto de partidos concretos. Cada ordago tiene un coste de entrada
          y una recompensa mayor. Son 100% opcionales.
        </p>

        {resolvedEntries.length > 0 && (
          <div style={{
            marginTop: '10px', padding: '8px 12px',
            background: totalPoints >= 0 ? 'rgba(0,122,69,0.08)' : 'rgba(231,76,60,0.08)',
            borderRadius: '6px', textAlign: 'center'
          }}>
            <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Tu balance: </span>
            <span style={{
              fontSize: '14px', fontWeight: '700',
              color: totalPoints > 0 ? '#4ade80' : totalPoints < 0 ? '#e74c3c' : 'var(--text-muted)'
            }}>
              {totalPoints > 0 ? '+' : ''}{totalPoints} pts
            </span>
          </div>
        )}
      </div>

      {/* Ordago cards */}
      {visibleOrdagos.map(ordago => {
        const config = ORDAGO_CONFIG[ordago.number] || {}
        const entry = entries[ordago.id]
        const scores = localScores[ordago.id] || {}
        const match = ordago.match
        const open = isOpen(ordago)
        const countdown = match ? formatCountdown(match) : null
        const result = getResult(ordago, entry)
        const isSaving = saving[ordago.id]

        const hasUnsaved = entry
          ? (scores.home !== entry.predicted_home || scores.away !== entry.predicted_away)
          : (scores.home !== undefined && scores.home !== '' && scores.away !== undefined && scores.away !== '')

        return (
          <div key={ordago.id} style={{
            background: 'var(--bg-secondary)',
            borderRadius: '10px',
            padding: '14px',
            marginBottom: '8px',
            border: result
              ? result.type === 'exact' ? '1px solid var(--gold)' :
                result.type === 'sign' ? '1px solid var(--green)' :
                '1px solid rgba(231,76,60,0.3)'
              : open ? '1px solid rgba(255,204,0,0.2)' : '0.5px solid var(--border)',
            opacity: ordago.status === 'locked' ? 0.5 : 1
          }}>
            {/* Top row: number + title + status */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '30px', height: '30px', borderRadius: '50%',
                  background: ordago.status === 'resolved'
                    ? (result?.type === 'fallo' ? 'rgba(231,76,60,0.15)' : 'rgba(0,122,69,0.15)')
                    : ordago.number === 1 || open ? 'var(--gold)' : 'var(--bg-input)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '13px', fontWeight: '700',
                  color: ordago.number === 1 || open ? '#1a1d26' : 'var(--text-dim)'
                }}>
                  {ordago.status === 'resolved' ? (
                    result?.type === 'fallo' ? '✗' : '✓'
                  ) : ordago.number}
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                    {ordago.title}
                  </div>
                  {ordago.description && (
                    <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '1px' }}>
                      {ordago.description}
                    </div>
                  )}
                </div>
              </div>

              {/* Status badge */}
              <div>
                {ordago.status === 'locked' && (
                  <span style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '4px', background: 'var(--bg-input)', color: 'var(--text-dim)', fontWeight: '600' }}>
                    🔒 Bloqueado
                  </span>
                )}
                {ordago.status === 'open' && open && (
                  <span style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '4px', background: 'rgba(255,204,0,0.1)', color: 'var(--gold)', fontWeight: '600' }}>
                    ⏱ {countdown || 'Abierto'}
                  </span>
                )}
                {ordago.status === 'open' && !open && (
                  <span style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '4px', background: 'rgba(231,76,60,0.1)', color: '#e74c3c', fontWeight: '600' }}>
                    🔒 Cerrado
                  </span>
                )}
                {ordago.status === 'resolved' && (
                  <span style={{
                    fontSize: '10px', padding: '3px 8px', borderRadius: '4px', fontWeight: '600',
                    background: result?.points > 0 ? 'rgba(0,122,69,0.1)' : result?.points < 0 ? 'rgba(231,76,60,0.1)' : 'var(--bg-input)',
                    color: result?.points > 0 ? '#4ade80' : result?.points < 0 ? '#e74c3c' : 'var(--text-dim)'
                  }}>
                    {result ? `${result.points > 0 ? '+' : ''}${result.points} pts` : 'Resuelto'}
                  </span>
                )}
              </div>
            </div>

            {/* Cost/Reward info */}
            {ordago.status !== 'locked' && (
              <div style={{
                display: 'flex', gap: '6px', marginBottom: '10px',
                fontSize: '10px', flexWrap: 'wrap'
              }}>
                <span style={{
                  padding: '3px 8px', borderRadius: '4px',
                  background: config.cost === 0 ? 'rgba(0,122,69,0.08)' : 'rgba(231,76,60,0.08)',
                  color: config.cost === 0 ? '#4ade80' : '#e74c3c',
                  fontWeight: '600'
                }}>
                  {config.cost === 0 ? 'GRATIS' : `Coste: -${config.cost}`}
                </span>
                <span style={{
                  padding: '3px 8px', borderRadius: '4px',
                  background: 'rgba(74,222,128,0.08)', color: '#4ade80', fontWeight: '600'
                }}>
                  Exacto: +{config.exact}
                </span>
                <span style={{
                  padding: '3px 8px', borderRadius: '4px',
                  background: 'rgba(255,204,0,0.08)', color: 'var(--gold)', fontWeight: '600'
                }}>
                  1X2: +{config.sign}
                </span>
              </div>
            )}

            {/* Match + score input (when open or has entry) */}
            {match && ordago.status !== 'locked' && (
              <div style={{
                background: 'var(--bg-input)', borderRadius: '8px', padding: '12px',
                border: '0.5px solid var(--border-light)'
              }}>
                {/* Teams + score input */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {/* Home team */}
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                    <span style={{
                      fontSize: '12px', fontWeight: '500', color: 'var(--text-primary)',
                      textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>
                      {match.home_team?.name || 'TBD'}
                    </span>
                    {match.home_team?.flag_url && (
                      <img src={match.home_team.flag_url} alt="" style={{
                        width: '20px', height: '14px', borderRadius: '2px', objectFit: 'cover', flexShrink: 0
                      }} />
                    )}
                  </div>

                  {/* Score inputs or result */}
                  {ordago.status === 'resolved' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <div style={{
                        width: '32px', height: '32px', borderRadius: '6px',
                        background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)'
                      }}>
                        {match.home_score}
                      </div>
                      <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>-</span>
                      <div style={{
                        width: '32px', height: '32px', borderRadius: '6px',
                        background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)'
                      }}>
                        {match.away_score}
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <input
                        type="number"
                        min="0"
                        max="99"
                        value={scores.home ?? ''}
                        onChange={e => updateScore(ordago.id, 'home', e.target.value)}
                        disabled={!open}
                        style={{
                          width: '36px', height: '36px', borderRadius: '6px',
                          border: '1.5px solid var(--border)',
                          background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                          fontSize: '16px', fontWeight: '700', textAlign: 'center',
                          outline: 'none', opacity: open ? 1 : 0.5
                        }}
                      />
                      <span style={{ fontSize: '12px', color: 'var(--text-dim)', fontWeight: '700' }}>-</span>
                      <input
                        type="number"
                        min="0"
                        max="99"
                        value={scores.away ?? ''}
                        onChange={e => updateScore(ordago.id, 'away', e.target.value)}
                        disabled={!open}
                        style={{
                          width: '36px', height: '36px', borderRadius: '6px',
                          border: '1.5px solid var(--border)',
                          background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                          fontSize: '16px', fontWeight: '700', textAlign: 'center',
                          outline: 'none', opacity: open ? 1 : 0.5
                        }}
                      />
                    </div>
                  )}

                  {/* Away team */}
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {match.away_team?.flag_url && (
                      <img src={match.away_team.flag_url} alt="" style={{
                        width: '20px', height: '14px', borderRadius: '2px', objectFit: 'cover', flexShrink: 0
                      }} />
                    )}
                    <span style={{
                      fontSize: '12px', fontWeight: '500', color: 'var(--text-primary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>
                      {match.away_team?.name || 'TBD'}
                    </span>
                  </div>
                </div>

                {/* User's prediction shown under resolved */}
                {ordago.status === 'resolved' && entry && (
                  <div style={{
                    marginTop: '8px', textAlign: 'center',
                    fontSize: '11px', color: 'var(--text-dim)'
                  }}>
                    Tu prediccion: {entry.predicted_home} - {entry.predicted_away}
                    {result && (
                      <span style={{
                        marginLeft: '8px', fontWeight: '600',
                        color: result.type === 'exact' ? 'var(--gold)' :
                               result.type === 'sign' ? '#4ade80' : '#e74c3c'
                      }}>
                        {result.type === 'exact' ? '¡Exacto!' :
                         result.type === 'sign' ? 'Signo OK' : 'Fallo'}
                        {' '}({result.points > 0 ? '+' : ''}{result.points} pts)
                      </span>
                    )}
                  </div>
                )}

                {!entry && ordago.status === 'resolved' && (
                  <div style={{ marginTop: '8px', textAlign: 'center', fontSize: '11px', color: 'var(--text-dim)' }}>
                    No participaste
                  </div>
                )}

                {/* Save button */}
                {open && hasUnsaved && (
                  <button
                    onClick={() => handleSave(ordago)}
                    disabled={isSaving}
                    style={{
                      marginTop: '10px', width: '100%', padding: '10px',
                      borderRadius: '6px', border: 'none',
                      background: 'var(--green)', color: '#fff',
                      fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                      opacity: isSaving ? 0.6 : 1
                    }}
                  >
                    {isSaving ? 'Guardando...' : entry ? 'Actualizar prediccion' : 'Participar en este ordago'}
                  </button>
                )}

                {/* Already saved indicator */}
                {open && entry && !hasUnsaved && (
                  <div style={{
                    marginTop: '8px', textAlign: 'center',
                    fontSize: '10px', color: 'var(--green)', fontWeight: '600'
                  }}>
                    ✓ Prediccion guardada ({entry.predicted_home}-{entry.predicted_away})
                  </div>
                )}
              </div>
            )}

            {/* Locked state info */}
            {ordago.status === 'locked' && (
              <div style={{
                padding: '12px', textAlign: 'center',
                fontSize: '11px', color: 'var(--text-dim)', fontStyle: 'italic'
              }}>
                Se desbloqueara cuando se resuelva el ordago anterior
              </div>
            )}
          </div>
        )
      })}

      {/* Remaining locked count */}
      {visibleOrdagos.length < totalOrdagos && (
        <div style={{
          textAlign: 'center', padding: '14px',
          fontSize: '12px', color: 'var(--text-dim)'
        }}>
          {totalOrdagos - visibleOrdagos.length} ordago{totalOrdagos - visibleOrdagos.length > 1 ? 's' : ''} mas por desbloquear
        </div>
      )}
    </div>
  )
}
