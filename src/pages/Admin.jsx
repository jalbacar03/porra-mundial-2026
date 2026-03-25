import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

export default function Admin({ session }) {
  const [matches, setMatches] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [scores, setScores] = useState({})
  const [saving, setSaving] = useState(null)
  const [message, setMessage] = useState('')
  const [activeGroup, setActiveGroup] = useState('A')
  const [activeTab, setActiveTab] = useState('results') // 'results' | 'payments' | 'sync'
  const [syncing, setSyncing] = useState(false)
  const [syncLog, setSyncLog] = useState(null)

  const groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']

  useEffect(() => {
    checkAdmin()
  }, [])

  async function checkAdmin() {
    const { data } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', session.user.id)
      .single()
    if (data?.is_admin) {
      setIsAdmin(true)
      await Promise.all([fetchMatches(), fetchProfiles()])
    }
    setLoading(false)
  }

  async function fetchMatches() {
    const { data, error } = await supabase
      .from('matches')
      .select('*, home_team:teams!matches_home_team_id_fkey(name, flag_url), away_team:teams!matches_away_team_id_fkey(name, flag_url)')
      .order('match_date', { ascending: true })

    if (!error && data) {
      setMatches(data)
      const initialScores = {}
      data.forEach(m => {
        initialScores[m.id] = {
          home: m.home_score !== null ? String(m.home_score) : '',
          away: m.away_score !== null ? String(m.away_score) : ''
        }
      })
      setScores(initialScores)
    }
  }

  async function fetchProfiles() {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, nickname, has_paid, created_at')
      .order('created_at', { ascending: true })

    if (!error && data) setProfiles(data)
  }

  async function saveResult(matchId) {
    const home = parseInt(scores[matchId]?.home)
    const away = parseInt(scores[matchId]?.away)

    if (isNaN(home) || isNaN(away) || home < 0 || away < 0) {
      setMessage('Introduce un resultado válido')
      setTimeout(() => setMessage(''), 3000)
      return
    }

    setSaving(matchId)
    const { error } = await supabase
      .from('matches')
      .update({ home_score: home, away_score: away, status: 'finished' })
      .eq('id', matchId)

    if (error) {
      setMessage('Error: ' + error.message)
    } else {
      setMatches(prev => prev.map(m =>
        m.id === matchId ? { ...m, home_score: home, away_score: away, status: 'finished' } : m
      ))
      setMessage('Resultado guardado')
    }
    setSaving(null)
    setTimeout(() => setMessage(''), 3000)
  }

  async function togglePayment(userId, currentStatus) {
    const { error } = await supabase
      .from('profiles')
      .update({ has_paid: !currentStatus })
      .eq('id', userId)

    if (!error) {
      setProfiles(prev => prev.map(p =>
        p.id === userId ? { ...p, has_paid: !currentStatus } : p
      ))
    }
  }

  function updateScore(matchId, side, value) {
    setScores(prev => ({
      ...prev,
      [matchId]: { ...prev[matchId], [side]: value }
    }))
  }

  function formatDate(dateStr) {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleDateString('es-ES', {
      weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
        Cargando...
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
        No tienes permisos de administrador.
      </div>
    )
  }

  // Stats
  const totalMatches = matches.length
  const finishedMatches = matches.filter(m => m.status === 'finished').length
  const totalUsers = profiles.length
  const paidUsers = profiles.filter(p => p.has_paid).length
  const totalRevenue = paidUsers * 25

  // Group matches
  const groupMatches = matches.filter(m => m.group_name === activeGroup)

  function countGroupFinished(group) {
    return matches.filter(m => m.group_name === group && m.status === 'finished').length
  }
  function countGroupTotal(group) {
    return matches.filter(m => m.group_name === group).length
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '16px', minHeight: '100svh' }}>

      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{
          fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)',
          margin: '0 0 4px', letterSpacing: '0.3px'
        }}>
          Panel de Admin
        </h2>
        <p style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
          Gestión de la porra
        </p>
      </div>

      {/* Stats cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '16px' }}>
        <div style={{
          background: 'var(--bg-secondary)', borderRadius: '8px', padding: '12px',
          border: '0.5px solid var(--border)', textAlign: 'center'
        }}>
          <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)' }}>
            {finishedMatches}/{totalMatches}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '2px' }}>
            Partidos
          </div>
        </div>
        <div style={{
          background: 'var(--bg-secondary)', borderRadius: '8px', padding: '12px',
          border: '0.5px solid var(--border)', textAlign: 'center'
        }}>
          <div style={{ fontSize: '20px', fontWeight: '700', color: paidUsers === totalUsers ? 'var(--green)' : 'var(--gold)' }}>
            {paidUsers}/{totalUsers}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '2px' }}>
            Pagados
          </div>
        </div>
        <div style={{
          background: 'var(--bg-secondary)', borderRadius: '8px', padding: '12px',
          border: '0.5px solid var(--border)', textAlign: 'center'
        }}>
          <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--green)' }}>
            {totalRevenue}€
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '2px' }}>
            Recaudado
          </div>
        </div>
      </div>

      {/* Tab switcher: Resultados / Pagos */}
      <div style={{ display: 'flex', gap: '0', marginBottom: '16px', borderRadius: '6px', overflow: 'hidden', border: '0.5px solid var(--border)' }}>
        <button
          onClick={() => setActiveTab('results')}
          style={{
            flex: 1, padding: '10px', border: 'none', cursor: 'pointer',
            fontSize: '13px', fontWeight: '600',
            background: activeTab === 'results' ? 'var(--green)' : 'var(--bg-secondary)',
            color: activeTab === 'results' ? '#fff' : 'var(--text-muted)'
          }}
        >
          Resultados
        </button>
        <button
          onClick={() => setActiveTab('payments')}
          style={{
            flex: 1, padding: '10px', border: 'none', cursor: 'pointer',
            fontSize: '13px', fontWeight: '600',
            background: activeTab === 'payments' ? 'var(--green)' : 'var(--bg-secondary)',
            color: activeTab === 'payments' ? '#fff' : 'var(--text-muted)'
          }}
        >
          Pagos
        </button>
        <button
          onClick={() => setActiveTab('sync')}
          style={{
            flex: 1, padding: '10px', border: 'none', cursor: 'pointer',
            fontSize: '13px', fontWeight: '600',
            background: activeTab === 'sync' ? 'var(--green)' : 'var(--bg-secondary)',
            color: activeTab === 'sync' ? '#fff' : 'var(--text-muted)'
          }}
        >
          ⚡ Sync API
        </button>
      </div>

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

      {/* ========== RESULTS TAB ========== */}
      {activeTab === 'results' && (
        <>
          {/* Group selector */}
          <div className="group-tabs" style={{ marginBottom: '14px' }}>
            {groups.map(g => {
              const total = countGroupTotal(g)
              const done = countGroupFinished(g)
              const isActive = activeGroup === g
              const isComplete = done === total && total > 0
              return (
                <button
                  key={g}
                  onClick={() => setActiveGroup(g)}
                  style={{
                    padding: '6px 14px', borderRadius: '4px', border: 'none',
                    background: isActive ? 'var(--green)' : isComplete ? 'var(--green-light)' : 'var(--bg-secondary)',
                    color: isActive ? '#fff' : isComplete ? 'var(--green)' : 'var(--text-muted)',
                    cursor: 'pointer', fontSize: '12px', fontWeight: isActive ? '600' : '400',
                    whiteSpace: 'nowrap', flexShrink: 0
                  }}
                >
                  {g} <span style={{ opacity: 0.6, fontSize: '10px' }}>{done}/{total}</span>
                </button>
              )
            })}
          </div>

          {/* Group progress */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: '6px',
            marginBottom: '12px', border: '0.5px solid var(--border)'
          }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Grupo {activeGroup}
            </span>
            <span style={{
              fontSize: '12px', fontWeight: '600',
              color: countGroupFinished(activeGroup) === countGroupTotal(activeGroup) && countGroupTotal(activeGroup) > 0 ? 'var(--green)' : 'var(--gold)'
            }}>
              {countGroupFinished(activeGroup)}/{countGroupTotal(activeGroup)} finalizados
            </span>
          </div>

          {/* Match list */}
          {groupMatches.map(match => (
            <div key={match.id} style={{
              padding: '12px 0',
              borderBottom: '0.5px solid var(--border-light)'
            }}>
              {/* Date */}
              <div style={{
                fontSize: '11px', color: 'var(--text-dim)',
                marginBottom: '10px', textAlign: 'center'
              }}>
                {formatDate(match.match_date)}
              </div>

              {/* Teams and scores */}
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {/* Home team */}
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  {match.home_team?.flag_url && (
                    <img src={match.home_team.flag_url} alt="" style={{
                      width: '20px', height: '14px', borderRadius: '2px', objectFit: 'cover', flexShrink: 0
                    }} />
                  )}
                  <span style={{
                    fontSize: '13px', color: 'var(--text-primary)', fontWeight: '500',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                  }}>
                    {match.home_team?.name || 'Local'}
                  </span>
                </div>

                {/* Score inputs */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '0 4px', flexShrink: 0 }}>
                  <input
                    type="number"
                    min="0"
                    max="99"
                    value={scores[match.id]?.home ?? ''}
                    onChange={e => updateScore(match.id, 'home', e.target.value)}
                    style={{
                      width: '36px', height: '32px', textAlign: 'center',
                      fontSize: '15px', fontWeight: '600', borderRadius: '4px',
                      border: match.status === 'finished' ? '1px solid var(--green)' : '1px solid var(--border)',
                      background: 'var(--bg-input)',
                      color: scores[match.id]?.home !== '' ? 'var(--text-primary)' : 'var(--text-dim)',
                      outline: 'none'
                    }}
                  />
                  <span style={{ color: 'var(--text-dim)', fontSize: '11px' }}>:</span>
                  <input
                    type="number"
                    min="0"
                    max="99"
                    value={scores[match.id]?.away ?? ''}
                    onChange={e => updateScore(match.id, 'away', e.target.value)}
                    style={{
                      width: '36px', height: '32px', textAlign: 'center',
                      fontSize: '15px', fontWeight: '600', borderRadius: '4px',
                      border: match.status === 'finished' ? '1px solid var(--green)' : '1px solid var(--border)',
                      background: 'var(--bg-input)',
                      color: scores[match.id]?.away !== '' ? 'var(--text-primary)' : 'var(--text-dim)',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Away team */}
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end', minWidth: 0 }}>
                  <span style={{
                    fontSize: '13px', color: 'var(--text-primary)', fontWeight: '500',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                  }}>
                    {match.away_team?.name || 'Visitante'}
                  </span>
                  {match.away_team?.flag_url && (
                    <img src={match.away_team.flag_url} alt="" style={{
                      width: '20px', height: '14px', borderRadius: '2px', objectFit: 'cover', flexShrink: 0
                    }} />
                  )}
                </div>
              </div>

              {/* Status + Save button */}
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
                <span style={{
                  fontSize: '10px', padding: '3px 10px', borderRadius: '3px',
                  background: match.status === 'finished' ? 'var(--green-light)' : 'var(--bg-secondary)',
                  color: match.status === 'finished' ? 'var(--green)' : 'var(--text-dim)'
                }}>
                  {match.status === 'finished' ? 'Finalizado' : 'Pendiente'}
                </span>
                <button
                  onClick={() => saveResult(match.id)}
                  disabled={saving === match.id}
                  style={{
                    padding: '5px 16px',
                    background: match.status === 'finished' ? 'var(--bg-secondary)' : 'var(--green)',
                    color: match.status === 'finished' ? 'var(--text-muted)' : '#fff',
                    border: match.status === 'finished' ? '0.5px solid var(--border)' : 'none',
                    borderRadius: '4px', cursor: 'pointer',
                    fontSize: '11px', fontWeight: '600',
                    opacity: saving === match.id ? 0.7 : 1
                  }}
                >
                  {saving === match.id ? '...' : match.status === 'finished' ? 'Actualizar' : 'Guardar'}
                </button>
              </div>
            </div>
          ))}
        </>
      )}

      {/* ========== PAYMENTS TAB ========== */}
      {activeTab === 'payments' && (
        <>
          {/* Payment summary */}
          <div style={{
            background: 'linear-gradient(135deg, #00392a, #005e3a)',
            borderRadius: '8px', padding: '14px 16px', marginBottom: '14px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  Recaudación
                </div>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#fff', marginTop: '2px' }}>
                  {totalRevenue}€
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  Pagados
                </div>
                <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--gold)', marginTop: '2px' }}>
                  {paidUsers}<span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}>/{totalUsers}</span>
                </div>
              </div>
            </div>
            {/* Progress bar */}
            <div style={{
              height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px',
              marginTop: '12px', overflow: 'hidden'
            }}>
              <div style={{
                height: '100%', width: totalUsers > 0 ? `${(paidUsers / totalUsers) * 100}%` : '0%',
                background: 'var(--gold)', borderRadius: '2px', transition: 'width 0.3s ease'
              }} />
            </div>
          </div>

          {/* Header */}
          <div style={{
            display: 'flex', padding: '8px 12px', fontSize: '10px', color: 'var(--text-dim)',
            textTransform: 'uppercase', letterSpacing: '0.6px', borderBottom: '0.5px solid var(--border)'
          }}>
            <span style={{ flex: 1 }}>Nombre</span>
            <span style={{ width: '70px', textAlign: 'center' }}>Estado</span>
            <span style={{ width: '70px', textAlign: 'center' }}>Acción</span>
          </div>

          {/* User list */}
          {profiles.map(profile => (
            <div key={profile.id} style={{
              display: 'flex', alignItems: 'center', padding: '10px 12px',
              borderBottom: '0.5px solid var(--border-light)'
            }}>
              <span style={{
                flex: 1, fontSize: '13px', fontWeight: '500',
                color: profile.has_paid ? 'var(--text-primary)' : 'var(--text-muted)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
              }}>
                {profile.nickname || profile.full_name || 'Sin nombre'}
              </span>
              <span style={{
                width: '70px', textAlign: 'center', fontSize: '10px',
                padding: '3px 8px', borderRadius: '3px',
                background: profile.has_paid ? 'var(--green-light)' : 'var(--red-bg)',
                color: profile.has_paid ? 'var(--green)' : 'var(--red)'
              }}>
                {profile.has_paid ? 'Pagado' : 'Pendiente'}
              </span>
              <div style={{ width: '70px', textAlign: 'center' }}>
                <button
                  onClick={() => togglePayment(profile.id, profile.has_paid)}
                  style={{
                    padding: '4px 10px', borderRadius: '4px', cursor: 'pointer',
                    fontSize: '10px', fontWeight: '600', border: 'none',
                    background: profile.has_paid ? 'var(--bg-secondary)' : 'var(--green)',
                    color: profile.has_paid ? 'var(--text-dim)' : '#fff'
                  }}
                >
                  {profile.has_paid ? 'Quitar' : 'Marcar'}
                </button>
              </div>
            </div>
          ))}
        </>
      )}

      {/* ========== SYNC TAB ========== */}
      {activeTab === 'sync' && (
        <>
          <div style={{
            background: 'var(--bg-secondary)', borderRadius: '8px',
            padding: '16px', marginBottom: '14px',
            border: '1px solid rgba(255,255,255,0.05)'
          }}>
            <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '6px' }}>
              ⚡ Sincronización con API-Football
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5', marginBottom: '12px' }}>
              Actualiza resultados de partidos, resuelve apuestas pre-torneo y sincroniza estadísticas.
              Se ejecuta automáticamente cada 2 horas durante el Mundial.
            </div>
            <button
              onClick={async () => {
                setSyncing(true)
                setSyncLog(null)
                try {
                  const res = await fetch('/api/sync-results')
                  const data = await res.json()
                  setSyncLog(data)
                  if (data.matchesUpdated > 0) {
                    fetchMatches() // Refresh matches
                  }
                } catch (err) {
                  setSyncLog({ error: err.message })
                }
                setSyncing(false)
              }}
              disabled={syncing}
              style={{
                width: '100%', padding: '12px', borderRadius: '6px',
                border: 'none', cursor: syncing ? 'not-allowed' : 'pointer',
                fontSize: '13px', fontWeight: '600',
                background: syncing ? 'var(--bg-input)' : 'var(--green)',
                color: syncing ? 'var(--text-muted)' : '#fff',
                letterSpacing: '0.5px', textTransform: 'uppercase'
              }}
            >
              {syncing ? '🔄 Sincronizando...' : '▶ Ejecutar sync ahora'}
            </button>
          </div>

          {/* Sync results */}
          {syncLog && (
            <div style={{
              background: '#0d1117', borderRadius: '8px', padding: '14px',
              border: '1px solid rgba(255,255,255,0.08)', fontFamily: 'monospace'
            }}>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Resultado del sync
              </div>
              {syncLog.error ? (
                <div style={{ color: '#e74c3c', fontSize: '12px' }}>❌ Error: {syncLog.error}</div>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: '16px', marginBottom: '10px' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--green)' }}>{syncLog.matchesUpdated}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>Partidos</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '20px', fontWeight: '700', color: '#ffcc00' }}>{syncLog.betsResolved}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>Apuestas</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-muted)' }}>{syncLog.totalFinished}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>Terminados</div>
                    </div>
                  </div>
                  <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    {(syncLog.log || []).map((line, i) => (
                      <div key={i} style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '2px 0', lineHeight: '1.4' }}>
                        {line}
                      </div>
                    ))}
                  </div>
                </>
              )}
              <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '8px' }}>
                {syncLog.timestamp && new Date(syncLog.timestamp).toLocaleString('es-ES')}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
