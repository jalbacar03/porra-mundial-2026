import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../supabase'
import { FootballSpinner } from '../../../components/Skeleton'

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
  const [expandedId, setExpandedId] = useState(null)

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

  // Deadline: 3h before match
  function getDeadline(match) {
    if (!match?.match_date) return null
    return new Date(new Date(match.match_date).getTime() - 3 * 60 * 60 * 1000)
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

  // Show ALL ordagos — locked ones are visible but disabled
  function getVisibleOrdagos() {
    return ordagos
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

  const handleCancel = useCallback(async (ordago) => {
    if (!userId) return
    const entry = entries[ordago.id]
    if (!entry) return

    setSaving(s => ({ ...s, [ordago.id]: true }))

    const { error } = await supabase
      .from('ordago_entries')
      .delete()
      .eq('ordago_id', ordago.id)
      .eq('user_id', userId)

    if (!error) {
      setEntries(prev => {
        const next = { ...prev }
        delete next[ordago.id]
        return next
      })
      setLocalScores(prev => {
        const next = { ...prev }
        delete next[ordago.id]
        return next
      })
    }

    setSaving(s => ({ ...s, [ordago.id]: false }))
  }, [userId, entries])

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
    return <FootballSpinner text="Cargando órdagos…" />
  }

  if (ordagos.length === 0) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>🎲</div>
        <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Los órdagos se activarán durante el Mundial</div>
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

  // Max possible net reward: sum of (exact - cost) for all
  const maxNetReward = ordagos.reduce((sum, o) => {
    const c = ORDAGO_CONFIG[o.number] || {}
    return sum + ((c.exact || 0) - (c.cost || 0))
  }, 0)
  const dateLabel = (dateStr) => {
    if (!dateStr) return ''
    const d = new Date(dateStr); const today = new Date(); const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1)
    const same = (a, b) => a.toDateString() === b.toDateString()
    const day = same(d, today) ? 'Hoy' : same(d, tomorrow) ? 'Mañana' : d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '')
    const time = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    return `${day} · ${time}`
  }

  return (
    <div>
      {/* ===== Header card ===== */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(0,122,69,0.18), rgba(0,122,69,0.06))',
        borderRadius: '12px', padding: '14px 16px',
        border: '1px solid rgba(0,144,81,0.3)',
        marginBottom: '14px'
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{
            fontSize: '10px', fontWeight: '700', color: 'var(--green)',
            textTransform: 'uppercase', letterSpacing: '1.2px'
          }}>
            Recompensa máx. neta
          </span>
          <span style={{ fontSize: '22px', fontWeight: '800', color: 'var(--gold)' }}>
            +{maxNetReward} pts
          </span>
        </div>
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4', margin: 0 }}>
          Seis predicciones opcionales. Se desbloquean en cadena según avanza el torneo.
        </p>
        {resolvedEntries.length > 0 && (
          <div style={{ marginTop: '10px', padding: '6px 12px', borderRadius: '6px', background: 'rgba(0,0,0,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Tu balance</span>
            <span style={{ fontSize: '13px', fontWeight: '700', color: totalPoints > 0 ? '#4ade80' : totalPoints < 0 ? '#e74c3c' : 'var(--text-muted)' }}>
              {totalPoints > 0 ? '+' : ''}{totalPoints} pts
            </span>
          </div>
        )}
      </div>

      {/* ===== Compact list ===== */}
      {visibleOrdagos.map(ordago => {
        const config = ORDAGO_CONFIG[ordago.number] || {}
        const entry = entries[ordago.id]
        const scores = localScores[ordago.id] || {}
        const match = ordago.match
        const open = isOpen(ordago)
        const countdown = match ? formatCountdown(match) : null
        const result = getResult(ordago, entry)
        const isSaving = saving[ordago.id]
        const isExpanded = expandedId === ordago.id

        const hasUnsaved = entry
          ? (scores.home !== entry.predicted_home || scores.away !== entry.predicted_away)
          : (scores.home !== undefined && scores.home !== '' && scores.away !== undefined && scores.away !== '')

        // Status color: open → gold, locked → muted, resolved depends on result
        const statusColor = result
          ? (result.type === 'exact' ? 'var(--gold)' : result.type === 'sign' ? 'var(--green)' : '#e74c3c')
          : open ? 'var(--gold)' : ordago.status === 'locked' ? 'var(--text-dim)' : 'var(--green)'
        const borderColor = result
          ? (result.type === 'exact' ? 'var(--gold)' : result.type === 'sign' ? 'rgba(0,144,81,0.5)' : 'rgba(231,76,60,0.4)')
          : open ? 'rgba(255,204,0,0.5)' : 'transparent'

        // Match label: real teams or generic placeholder
        let matchLabel = ordago.title
        if (match?.home_team?.name && match?.away_team?.name) {
          matchLabel = `${match.home_team.name} · ${match.away_team.name}`
        }

        return (
          <div key={ordago.id} style={{
            marginBottom: '8px',
            borderRadius: '12px',
            background: 'var(--bg-secondary)',
            border: `1px solid ${borderColor}`,
            opacity: ordago.status === 'locked' && !match ? 0.55 : ordago.status === 'locked' ? 0.75 : 1,
            overflow: 'hidden'
          }}>
            {/* COMPACT ROW (always visible) */}
            <div
              onClick={() => setExpandedId(isExpanded ? null : ordago.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '14px', cursor: 'pointer'
              }}
            >
              <span style={{
                fontSize: '15px', fontWeight: '700', color: 'var(--text-dim)',
                fontVariantNumeric: 'tabular-nums', minWidth: '20px'
              }}>
                {String(ordago.number).padStart(2, '0')}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                }}>
                  {matchLabel}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>
                  {match?.match_date ? dateLabel(match.match_date) : ordago.description || 'Por determinar'}
                </div>
              </div>
              <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                  <span style={{
                    fontSize: '11px', fontWeight: '700',
                    color: config.cost === 0 ? 'var(--green)' : '#e74c3c'
                  }}>
                    {config.cost === 0 ? 'GRATIS' : `−${config.cost}`}
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--gold)' }}>
                    +{config.exact}
                  </span>
                </div>
                <span style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: statusColor,
                  flexShrink: 0
                }} />
              </div>
            </div>

            {/* EXPANDED (only when tapped) */}
            {isExpanded && (
              <div style={{
                borderTop: '1px solid var(--border-light)',
                padding: '12px 14px', background: 'rgba(0,0,0,0.15)'
              }}>
            {/* Status info row inside expanded */}
            <div style={{
              display: 'flex', gap: '6px', marginBottom: '12px', fontSize: '10px',
              flexWrap: 'wrap', alignItems: 'center'
            }}>
              <span style={{
                padding: '3px 8px', borderRadius: '4px',
                background: 'rgba(74,222,128,0.08)', color: '#4ade80', fontWeight: '600'
              }}>
                Exacto +{config.exact}
              </span>
              <span style={{
                padding: '3px 8px', borderRadius: '4px',
                background: 'rgba(255,204,0,0.08)', color: 'var(--gold)', fontWeight: '600'
              }}>
                Signo +{config.sign}
              </span>
              {ordago.status === 'open' && open && countdown && (
                <span style={{
                  marginLeft: 'auto', fontSize: '10px', padding: '3px 8px', borderRadius: '4px',
                  background: 'rgba(255,204,0,0.1)', color: 'var(--gold)', fontWeight: '600'
                }}>⏱ {countdown}</span>
              )}
              {ordago.status === 'locked' && (
                <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--text-dim)', fontWeight: '600' }}>
                  🔒 Bloqueado
                </span>
              )}
              {ordago.status === 'open' && !open && (
                <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#e74c3c', fontWeight: '600' }}>
                  🔒 Cerrado
                </span>
              )}
              {ordago.status === 'resolved' && (
                <span style={{
                  marginLeft: 'auto', fontSize: '10px', padding: '3px 8px', borderRadius: '4px', fontWeight: '700',
                  background: result?.points > 0 ? 'rgba(0,122,69,0.1)' : result?.points < 0 ? 'rgba(231,76,60,0.1)' : 'var(--bg-input)',
                  color: result?.points > 0 ? '#4ade80' : result?.points < 0 ? '#e74c3c' : 'var(--text-dim)'
                }}>
                  {result ? `${result.points > 0 ? '+' : ''}${result.points} pts` : 'Resuelto'}
                </span>
              )}
            </div>

            {/* Match + score input (when not locked) */}
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
                      {match.home_team?.name || 'Por determinar'}
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
                      {match.away_team?.name || 'Por determinar'}
                    </span>
                  </div>
                </div>

                {/* User's prediction shown under resolved */}
                {ordago.status === 'resolved' && entry && (
                  <div style={{
                    marginTop: '8px', textAlign: 'center',
                    fontSize: '11px', color: 'var(--text-dim)'
                  }}>
                    Tu predicción: {entry.predicted_home} - {entry.predicted_away}
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
                    {isSaving ? 'Guardando...' : entry ? 'Actualizar predicción' : 'Participar en este órdago'}
                  </button>
                )}

                {/* Already saved indicator + cancel */}
                {open && entry && !hasUnsaved && (
                  <div style={{ marginTop: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: 'var(--green)', fontWeight: '600' }}>
                      ✓ Predicción guardada ({entry.predicted_home}-{entry.predicted_away})
                    </div>
                    <button
                      onClick={() => handleCancel(ordago)}
                      disabled={isSaving}
                      style={{
                        marginTop: '6px', padding: '6px 16px',
                        borderRadius: '4px',
                        border: '1px solid rgba(231,76,60,0.3)',
                        background: 'transparent',
                        color: '#e74c3c',
                        fontSize: '10px', fontWeight: '600',
                        cursor: 'pointer',
                        opacity: isSaving ? 0.5 : 1
                      }}
                    >
                      Retirar predicción
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Locked: show match preview if available, otherwise info text */}
            {ordago.status === 'locked' && match && (
              <div style={{
                background: 'var(--bg-input)', borderRadius: '8px', padding: '12px',
                border: '0.5px solid var(--border-light)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {match.home_team?.flag_url && (
                      <img src={match.home_team.flag_url} alt="" style={{ width: '20px', height: '14px', borderRadius: '2px', objectFit: 'cover' }} />
                    )}
                    <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>{match.home_team?.name || 'Por determinar'}</span>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>vs</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>{match.away_team?.name || 'Por determinar'}</span>
                    {match.away_team?.flag_url && (
                      <img src={match.away_team.flag_url} alt="" style={{ width: '20px', height: '14px', borderRadius: '2px', objectFit: 'cover' }} />
                    )}
                  </div>
                </div>
                <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '10px', color: 'var(--text-dim)', fontStyle: 'italic' }}>
                  {ordago.number === 1
                    ? '🔒 Se desbloqueará cuando empiece el Mundial (11 jun 2026)'
                    : '🔒 Se desbloqueará cuando se resuelva el órdago anterior'}
                </div>
              </div>
            )}
            {ordago.status === 'locked' && !match && (
              <div style={{
                padding: '12px', textAlign: 'center',
                fontSize: '11px', color: 'var(--text-dim)', fontStyle: 'italic'
              }}>
                {ordago.number === 1
                  ? '🔒 Se desbloqueará cuando empiece el Mundial (11 jun 2026)'
                  : '🔒 Se desbloqueará cuando se resuelva el órdago anterior'}
              </div>
            )}
              </div>
            )}
          </div>
        )
      })}

      {/* All ordagos are now visible */}
    </div>
  )
}
