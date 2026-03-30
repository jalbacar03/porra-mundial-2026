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
  const [activeTab, setActiveTab] = useState('results') // 'results' | 'payments' | 'sync' | 'bets'
  const [syncing, setSyncing] = useState(false)
  const [syncLog, setSyncLog] = useState(null)

  // Bets tab state
  const [allPredictions, setAllPredictions] = useState([])
  const [preTournamentBets, setPreTournamentBets] = useState([])
  const [preTournamentEntries, setPreTournamentEntries] = useState([])
  const [betsFilterGroup, setBetsFilterGroup] = useState('A')
  const [betsFilterUser, setBetsFilterUser] = useState('')
  const [betsSubTab, setBetsSubTab] = useState('matches') // 'matches' | 'pre' | 'ordagos' | 'completion'
  const [teams, setTeams] = useState([])
  const [ordagos, setOrdagos] = useState([])
  const [ordagoEntries, setOrdagoEntries] = useState([])

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
      await Promise.all([fetchMatches(), fetchProfiles(), fetchBetsData()])
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

  async function fetchBetsData() {
    const [predsRes, betsRes, entriesRes, teamsRes, ordagosRes, ordagoEntriesRes] = await Promise.all([
      supabase.from('predictions')
        .select('user_id, match_id, predicted_home, predicted_away, points_earned'),
      supabase.from('pre_tournament_bets')
        .select('*').order('id', { ascending: true }),
      supabase.from('pre_tournament_entries')
        .select('user_id, bet_id, value, points_awarded, is_resolved'),
      supabase.from('teams').select('id, name, flag_url'),
      supabase.from('ordagos').select(`
        *,
        match:matches(
          id, match_date, status, home_score, away_score,
          home_team:teams!matches_home_team_id_fkey(id, name, flag_url),
          away_team:teams!matches_away_team_id_fkey(id, name, flag_url)
        )
      `).order('number'),
      supabase.from('ordago_entries')
        .select('user_id, ordago_id, predicted_home, predicted_away, points_awarded')
    ])
    setAllPredictions(predsRes.data || [])
    setPreTournamentBets(betsRes.data || [])
    setPreTournamentEntries(entriesRes.data || [])
    setTeams(teamsRes.data || [])
    setOrdagos(ordagosRes.data || [])
    setOrdagoEntries(ordagoEntriesRes.data || [])
  }

  function getTeamName(teamId) {
    const t = teams.find(tm => tm.id === teamId)
    return t ? t.name : `Equipo ${teamId}`
  }

  function formatBetValue(value, inputType) {
    if (!value) return '-'
    if (inputType === 'single_team') return getTeamName(value.team_id)
    if (inputType === 'multi_team') return (value.teams || []).map(id => getTeamName(id)).join(', ')
    if (inputType === 'single_player') return value.player_name || '-'
    if (inputType === 'yes_no') return value.answer === 'yes' ? 'Si' : 'No'
    if (inputType === 'range') return value.range || '-'
    if (inputType === 'single_group') return `Grupo ${value.group}` || '-'
    return JSON.stringify(value)
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
  const admittedUsers = profiles.filter(p => p.has_paid).length

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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
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
          <div style={{ fontSize: '20px', fontWeight: '700', color: admittedUsers === totalUsers ? 'var(--green)' : 'var(--gold)' }}>
            {admittedUsers}/{totalUsers}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '2px' }}>
            Admitidos
          </div>
        </div>
      </div>

      {/* Tab switcher: Resultados / Solicitudes / Sync */}
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
          Solicitudes
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
          ⚡ Sync
        </button>
        <button
          onClick={() => setActiveTab('bets')}
          style={{
            flex: 1, padding: '10px', border: 'none', cursor: 'pointer',
            fontSize: '13px', fontWeight: '600',
            background: activeTab === 'bets' ? 'var(--green)' : 'var(--bg-secondary)',
            color: activeTab === 'bets' ? '#fff' : 'var(--text-muted)'
          }}
        >
          Apuestas
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

      {/* ========== SOLICITUDES TAB ========== */}
      {activeTab === 'payments' && (
        <>
          {/* Summary */}
          <div style={{
            background: 'linear-gradient(135deg, #00392a, #005e3a)',
            borderRadius: '8px', padding: '14px 16px', marginBottom: '14px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  Solicitudes
                </div>
                <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--gold)', marginTop: '2px' }}>
                  {admittedUsers}<span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}>/{totalUsers}</span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  Pendientes
                </div>
                <div style={{ fontSize: '28px', fontWeight: '700', color: totalUsers - admittedUsers > 0 ? '#e74c3c' : 'var(--green)', marginTop: '2px' }}>
                  {totalUsers - admittedUsers}
                </div>
              </div>
            </div>
            {/* Progress bar */}
            <div style={{
              height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px',
              marginTop: '12px', overflow: 'hidden'
            }}>
              <div style={{
                height: '100%', width: totalUsers > 0 ? `${(admittedUsers / totalUsers) * 100}%` : '0%',
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
            <span style={{ width: '90px', textAlign: 'center' }}>Acción</span>
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
                background: profile.has_paid ? 'var(--green-light)' : 'rgba(255,204,0,0.08)',
                color: profile.has_paid ? 'var(--green)' : 'var(--gold)'
              }}>
                {profile.has_paid ? 'Admitido' : 'Pendiente'}
              </span>
              <div style={{ width: '90px', display: 'flex', justifyContent: 'center', gap: '4px' }}>
                {!profile.has_paid ? (
                  <button
                    onClick={() => togglePayment(profile.id, profile.has_paid)}
                    style={{
                      padding: '4px 10px', borderRadius: '4px', cursor: 'pointer',
                      fontSize: '10px', fontWeight: '600', border: 'none',
                      background: 'var(--green)', color: '#fff'
                    }}
                  >
                    Admitir
                  </button>
                ) : (
                  <button
                    onClick={() => togglePayment(profile.id, profile.has_paid)}
                    style={{
                      padding: '4px 10px', borderRadius: '4px', cursor: 'pointer',
                      fontSize: '10px', fontWeight: '600', border: 'none',
                      background: 'var(--bg-secondary)', color: 'var(--text-dim)'
                    }}
                  >
                    Revocar
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Clear Forum button */}
          <div style={{
            marginTop: '24px', padding: '16px',
            background: 'var(--bg-secondary)', borderRadius: '8px',
            border: '0.5px solid var(--border)'
          }}>
            <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '6px' }}>
              🗑 Gestión del foro
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5', marginBottom: '12px' }}>
              Elimina todos los mensajes del foro general. Los comunicados oficiales no se borran.
            </div>
            <button
              onClick={async () => {
                if (!window.confirm('¿Estás seguro de que quieres borrar TODOS los mensajes del foro general? Esta acción no se puede deshacer.')) return
                const { error } = await supabase
                  .from('forum_messages')
                  .delete()
                  .or('channel.eq.general,channel.is.null')
                if (error) {
                  setMessage('Error al limpiar foro: ' + error.message)
                } else {
                  setMessage('Foro limpiado correctamente')
                }
                setTimeout(() => setMessage(''), 3000)
              }}
              style={{
                padding: '10px 20px', borderRadius: '6px', border: 'none',
                cursor: 'pointer', fontSize: '12px', fontWeight: '600',
                background: '#e74c3c', color: '#fff'
              }}
            >
              Limpiar foro general
            </button>
          </div>
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

      {/* ========== BETS TAB ========== */}
      {activeTab === 'bets' && (() => {
        const BOT365_ID = 'b0365b03-65b0-365b-0365-b0365b036500'
        const realProfiles = profiles.filter(p => p.id !== BOT365_ID)
        const sortedBetsProfiles = [...realProfiles].sort((a, b) =>
          (a.nickname || a.full_name || '').localeCompare(b.nickname || b.full_name || '')
        )

        // Completion stats
        const totalMatchCount = matches.filter(m => m.group_name).length
        const completionData = realProfiles.map(p => {
          const preds = allPredictions.filter(pr => pr.user_id === p.id)
          const betCount = preTournamentEntries.filter(e => e.user_id === p.id).length
          return {
            ...p,
            matchPreds: preds.length,
            betCount,
            matchPct: totalMatchCount > 0 ? Math.round((preds.length / totalMatchCount) * 100) : 0,
            betPct: preTournamentBets.length > 0 ? Math.round((betCount / preTournamentBets.length) * 100) : 0
          }
        }).sort((a, b) => b.matchPct - a.matchPct)

        // Match predictions for selected group
        const groupMatchesForBets = matches.filter(m => m.group_name === betsFilterGroup)

        return (
          <>
            {/* Sub-tab switcher */}
            <div style={{
              display: 'flex', gap: '3px', marginBottom: '14px',
              padding: '3px', background: 'var(--bg-input)', borderRadius: '6px'
            }}>
              {[
                { key: 'matches', label: 'Partidos' },
                { key: 'pre', label: 'Pre-torneo' },
                { key: 'ordagos', label: 'Ordagos' },
                { key: 'completion', label: 'Progreso' }
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setBetsSubTab(tab.key)}
                  style={{
                    flex: 1, padding: '8px 4px', borderRadius: '4px', border: 'none',
                    background: betsSubTab === tab.key ? 'var(--bg-secondary)' : 'transparent',
                    color: betsSubTab === tab.key ? 'var(--text-primary)' : 'var(--text-muted)',
                    fontSize: '11px', fontWeight: betsSubTab === tab.key ? '600' : '400',
                    cursor: 'pointer'
                  }}
                >{tab.label}</button>
              ))}
            </div>

            {/* ---- MATCH PREDICTIONS SUB-TAB ---- */}
            {betsSubTab === 'matches' && (
              <>
                {/* Group selector */}
                <div className="group-tabs" style={{ marginBottom: '12px' }}>
                  {groups.map(g => (
                    <button
                      key={g}
                      onClick={() => setBetsFilterGroup(g)}
                      style={{
                        padding: '5px 12px', borderRadius: '4px', border: 'none',
                        background: betsFilterGroup === g ? 'var(--green)' : 'var(--bg-secondary)',
                        color: betsFilterGroup === g ? '#fff' : 'var(--text-muted)',
                        cursor: 'pointer', fontSize: '11px', fontWeight: betsFilterGroup === g ? '600' : '400',
                        whiteSpace: 'nowrap', flexShrink: 0
                      }}
                    >{g}</button>
                  ))}
                </div>

                {/* User filter */}
                <select
                  value={betsFilterUser}
                  onChange={e => setBetsFilterUser(e.target.value)}
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: '6px',
                    border: '0.5px solid var(--border)', background: 'var(--bg-input)',
                    color: 'var(--text-primary)', fontSize: '12px', outline: 'none',
                    appearance: 'auto', marginBottom: '12px'
                  }}
                >
                  <option value="">Todos los participantes</option>
                  {sortedBetsProfiles.map(p => (
                    <option key={p.id} value={p.id}>{p.nickname || p.full_name}</option>
                  ))}
                </select>

                {/* Match cards with aggregate predictions */}
                {groupMatchesForBets.map(match => {
                  const matchPreds = allPredictions.filter(p => p.match_id === match.id && (!betsFilterUser || p.user_id === betsFilterUser))
                  // Count 1X2
                  let h = 0, d = 0, a = 0
                  const resultCounts = {}
                  matchPreds.forEach(p => {
                    if (p.predicted_home > p.predicted_away) h++
                    else if (p.predicted_home === p.predicted_away) d++
                    else a++
                    const key = `${p.predicted_home}-${p.predicted_away}`
                    resultCounts[key] = (resultCounts[key] || 0) + 1
                  })
                  const topResults = Object.entries(resultCounts)
                    .sort(([, ca], [, cb]) => cb - ca)
                    .slice(0, 3)

                  return (
                    <div key={match.id} style={{
                      background: 'var(--bg-secondary)', borderRadius: '8px', padding: '12px',
                      marginBottom: '8px', border: '0.5px solid var(--border)'
                    }}>
                      {/* Teams */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: '500' }}>
                            {match.home_team?.name || 'TBD'}
                          </span>
                          {match.home_team?.flag_url && <img src={match.home_team.flag_url} alt="" style={{ width: '18px', height: '12px', borderRadius: '2px', objectFit: 'cover' }} />}
                        </div>
                        <span style={{
                          fontSize: match.status === 'finished' ? '14px' : '11px',
                          fontWeight: '700',
                          color: match.status === 'finished' ? 'var(--green)' : 'var(--text-dim)',
                          padding: '2px 8px', background: match.status === 'finished' ? 'var(--green-light)' : 'var(--bg-input)',
                          borderRadius: '4px'
                        }}>
                          {match.status === 'finished' ? `${match.home_score}-${match.away_score}` : 'vs'}
                        </span>
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {match.away_team?.flag_url && <img src={match.away_team.flag_url} alt="" style={{ width: '18px', height: '12px', borderRadius: '2px', objectFit: 'cover' }} />}
                          <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: '500' }}>
                            {match.away_team?.name || 'TBD'}
                          </span>
                        </div>
                      </div>

                      {/* Stats */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', color: 'var(--text-dim)', marginBottom: '6px' }}>
                        <span>{matchPreds.length} predicciones</span>
                        <span>1: {h} | X: {d} | 2: {a}</span>
                      </div>

                      {/* Top predicted results */}
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {topResults.map(([result, count], i) => (
                          <span key={result} style={{
                            padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600',
                            background: i === 0 ? 'rgba(255,204,0,0.1)' : 'var(--bg-input)',
                            color: i === 0 ? 'var(--gold)' : 'var(--text-muted)'
                          }}>
                            {result} ({count})
                          </span>
                        ))}
                      </div>

                      {/* Individual predictions if user filtered */}
                      {betsFilterUser && matchPreds.length > 0 && (
                        <div style={{ marginTop: '8px', padding: '6px 8px', background: 'var(--bg-input)', borderRadius: '4px' }}>
                          {matchPreds.map(p => {
                            const prof = profiles.find(pr => pr.id === p.user_id)
                            return (
                              <div key={p.user_id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '2px 0' }}>
                                <span style={{ color: 'var(--text-muted)' }}>{prof?.nickname || prof?.full_name || 'Participante'}</span>
                                <span style={{
                                  fontWeight: '600',
                                  color: p.points_earned === 3 ? 'var(--green)' : p.points_earned === 1 ? 'var(--gold)' : 'var(--text-primary)'
                                }}>
                                  {p.predicted_home}-{p.predicted_away}
                                  {p.points_earned !== null && ` (${p.points_earned}pts)`}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </>
            )}

            {/* ---- PRE-TOURNAMENT BETS SUB-TAB ---- */}
            {betsSubTab === 'pre' && (
              <>
                {preTournamentBets.map(bet => {
                  const entries = preTournamentEntries.filter(e => e.bet_id === bet.id)
                  const counts = {}
                  entries.forEach(e => {
                    const label = formatBetValue(e.value, bet.input_type)
                    counts[label] = (counts[label] || 0) + 1
                  })
                  const sorted = Object.entries(counts)
                    .sort(([, ca], [, cb]) => cb - ca)
                    .slice(0, 8)

                  return (
                    <div key={bet.id} style={{
                      background: 'var(--bg-secondary)', borderRadius: '8px', padding: '14px',
                      marginBottom: '8px', border: '0.5px solid var(--border)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '2px' }}>
                            {bet.name || bet.question}
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
                            {entries.length} respuestas · Max {bet.max_points} pts
                          </div>
                        </div>
                        <span style={{
                          padding: '3px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '600',
                          background: entries.length >= realProfiles.length * 0.8 ? 'var(--green-light)' : 'rgba(255,204,0,0.08)',
                          color: entries.length >= realProfiles.length * 0.8 ? 'var(--green)' : 'var(--gold)'
                        }}>
                          {Math.round((entries.length / (realProfiles.length || 1)) * 100)}%
                        </span>
                      </div>

                      {sorted.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {sorted.map(([label, count], i) => (
                            <div key={label}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                                <span style={{
                                  fontSize: '12px', fontWeight: i === 0 ? '600' : '400',
                                  color: i === 0 ? 'var(--gold)' : 'var(--text-primary)',
                                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%'
                                }}>
                                  {i === 0 ? '👑 ' : ''}{label}
                                </span>
                                <span style={{
                                  fontSize: '11px', fontWeight: '600',
                                  color: i === 0 ? 'var(--gold)' : 'var(--text-muted)'
                                }}>
                                  {count} ({Math.round((count / entries.length) * 100)}%)
                                </span>
                              </div>
                              <div style={{
                                height: '6px', background: 'var(--bg-input)', borderRadius: '3px', overflow: 'hidden'
                              }}>
                                <div style={{
                                  height: '100%', borderRadius: '3px',
                                  background: i === 0 ? 'var(--gold)' : 'var(--green)',
                                  width: `${(count / (sorted[0]?.[1] || 1)) * 100}%`
                                }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: '11px', color: 'var(--text-dim)', textAlign: 'center', padding: '8px' }}>
                          Sin respuestas
                        </div>
                      )}
                    </div>
                  )
                })}
              </>
            )}

            {/* ---- ORDAGOS SUB-TAB ---- */}
            {betsSubTab === 'ordagos' && (
              <>
                {ordagos.length === 0 ? (
                  <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '12px' }}>
                    No hay ordagos configurados todavia.
                  </div>
                ) : (
                  ordagos.map(ord => {
                    const entries = ordagoEntries.filter(e => e.ordago_id === ord.id)
                    const resultCounts = {}
                    entries.forEach(e => {
                      const key = `${e.predicted_home}-${e.predicted_away}`
                      resultCounts[key] = (resultCounts[key] || 0) + 1
                    })
                    const topResults = Object.entries(resultCounts)
                      .sort(([, ca], [, cb]) => cb - ca)
                      .slice(0, 5)

                    return (
                      <div key={ord.id} style={{
                        background: 'var(--bg-secondary)', borderRadius: '8px', padding: '14px',
                        marginBottom: '8px', border: '0.5px solid var(--border)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '2px' }}>
                              {ord.title || `Ordago #${ord.number}`}
                            </div>
                            {ord.match && (
                              <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                                {ord.match.home_team?.name} vs {ord.match.away_team?.name}
                                {ord.match.status === 'finished' && (
                                  <span style={{ color: 'var(--green)', fontWeight: '600', marginLeft: '6px' }}>
                                    {ord.match.home_score}-{ord.match.away_score}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          <span style={{
                            padding: '3px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '600',
                            background: ord.status === 'resolved' ? 'var(--green-light)' : 'rgba(255,204,0,0.08)',
                            color: ord.status === 'resolved' ? 'var(--green)' : 'var(--gold)'
                          }}>
                            {entries.length} apuestas
                          </span>
                        </div>

                        <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginBottom: '6px' }}>
                          Coste: {ord.cost} pts · Exacto: +{ord.reward_exact} · Signo: +{ord.reward_sign}
                        </div>

                        {topResults.length > 0 ? (
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {topResults.map(([result, count], i) => (
                              <span key={result} style={{
                                padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600',
                                background: i === 0 ? 'rgba(255,204,0,0.1)' : 'var(--bg-input)',
                                color: i === 0 ? 'var(--gold)' : 'var(--text-muted)'
                              }}>
                                {result} ({count})
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div style={{ fontSize: '11px', color: 'var(--text-dim)', textAlign: 'center' }}>
                            Sin apuestas
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </>
            )}

            {/* ---- COMPLETION SUB-TAB ---- */}
            {betsSubTab === 'completion' && (
              <>
                <div style={{
                  background: 'var(--bg-secondary)', borderRadius: '8px', padding: '12px',
                  marginBottom: '12px', border: '0.5px solid var(--border)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-dim)', marginBottom: '6px' }}>
                    <span>Totales: {totalMatchCount} partidos · {preTournamentBets.length} apuestas pre-torneo</span>
                  </div>
                </div>

                {/* Header */}
                <div style={{
                  display: 'flex', padding: '8px 12px', fontSize: '10px', color: 'var(--text-dim)',
                  textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '0.5px solid var(--border)'
                }}>
                  <span style={{ flex: 1 }}>Nombre</span>
                  <span style={{ width: '60px', textAlign: 'center' }}>Partidos</span>
                  <span style={{ width: '60px', textAlign: 'center' }}>Apuestas</span>
                </div>

                {completionData.map(user => (
                  <div key={user.id} style={{
                    display: 'flex', alignItems: 'center', padding: '8px 12px',
                    borderBottom: '0.5px solid var(--border-light)'
                  }}>
                    <span style={{
                      flex: 1, fontSize: '12px', fontWeight: '500',
                      color: user.matchPct === 100 && user.betPct === 100 ? 'var(--green)' : 'var(--text-primary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>
                      {user.nickname || user.full_name || 'Sin nombre'}
                    </span>
                    <div style={{ width: '60px', textAlign: 'center' }}>
                      <div style={{ fontSize: '12px', fontWeight: '600', color: user.matchPct === 100 ? 'var(--green)' : user.matchPct > 50 ? 'var(--gold)' : 'var(--text-dim)' }}>
                        {user.matchPreds}
                      </div>
                      <div style={{ fontSize: '9px', color: 'var(--text-dim)' }}>{user.matchPct}%</div>
                    </div>
                    <div style={{ width: '60px', textAlign: 'center' }}>
                      <div style={{ fontSize: '12px', fontWeight: '600', color: user.betPct === 100 ? 'var(--green)' : user.betPct > 50 ? 'var(--gold)' : 'var(--text-dim)' }}>
                        {user.betCount}
                      </div>
                      <div style={{ fontSize: '9px', color: 'var(--text-dim)' }}>{user.betPct}%</div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </>
        )
      })()}
    </div>
  )
}
