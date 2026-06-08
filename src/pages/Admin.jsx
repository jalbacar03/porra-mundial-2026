import { useEffect, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../supabase'
import { useToast } from '../components/Toast'
import { FootballSpinner } from '../components/Skeleton'
import Avatar from '../components/Avatar'
import BracketView from '../components/bracket/BracketView'
import PlayerSelector from '../components/bets/PlayerSelector'

const SYNC_HISTORY_KEY = 'admin_sync_history_v1'

export default function Admin({ session }) {
  const [matches, setMatches] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [scores, setScores] = useState({})
  const [saving, setSaving] = useState(null)
  const [activeGroup, setActiveGroup] = useState('A')
  const toast = useToast()
  const [activeTab, setActiveTab] = useState('results') // 'results' | 'payments' | 'sync' | 'bets'
  const [syncing, setSyncing] = useState(false)
  const [syncLog, setSyncLog] = useState(null)
  const [syncHistory, setSyncHistory] = useState([])
  const [sendingDigest, setSendingDigest] = useState(false)
  const [digestLog, setDigestLog] = useState(null)
  const [seedingBot, setSeedingBot] = useState(false)
  const [seedLog, setSeedLog] = useState(null)
  // Editor de predicciones de Bot365 (tab "🤖 Bot365")
  const [bot365Scores, setBot365Scores] = useState({}) // { match_id: { home:'', away:'' } }
  const [bot365Loaded, setBot365Loaded] = useState(false)
  const [bot365Saving, setBot365Saving] = useState(false)
  const [bot365Msg, setBot365Msg] = useState(null)
  const [bot365Group, setBot365Group] = useState('A')
  const [bot365SubTab, setBot365SubTab] = useState('matches') // 'matches' | 'bracket' | 'specials'
  const [bot365Bets, setBot365Bets] = useState([])
  const [bot365Teams, setBot365Teams] = useState([])
  const [bot365Entries, setBot365Entries] = useState({}) // { bet_id: value }
  const [bot365SpecialsSaving, setBot365SpecialsSaving] = useState(false)
  const [bot365SpecialsMsg, setBot365SpecialsMsg] = useState(null)

  // Results tab — search filter
  const [matchSearch, setMatchSearch] = useState('')

  // Admisiones tab — filters
  const [admissionsFilter, setAdmissionsFilter] = useState('pending') // 'pending' | 'admitted' | 'all'
  const [admissionsSort, setAdmissionsSort] = useState('requested') // 'requested' | 'created' | 'name'

  // Bets tab state
  const [allPredictions, setAllPredictions] = useState([])
  const [preTournamentBets, setPreTournamentBets] = useState([])
  const [preTournamentEntries, setPreTournamentEntries] = useState([])
  const [betsFilterGroup, setBetsFilterGroup] = useState('A')
  const [betsFilterUser, setBetsFilterUser] = useState('')
  const [betsSubTab, setBetsSubTab] = useState('matches') // 'matches' | 'pre' | 'completion'
  const [teams, setTeams] = useState([])

  const groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']

  useEffect(() => {
    checkAdmin()
    // Load sync history from localStorage
    try {
      const raw = localStorage.getItem(SYNC_HISTORY_KEY)
      if (raw) setSyncHistory(JSON.parse(raw))
    } catch {}
  }, [])

  // Carga las predicciones de Bot365 la primera vez que se abre su tab.
  useEffect(() => {
    if (activeTab === 'bot365' && !bot365Loaded) loadBot365Preds()
  }, [activeTab, bot365Loaded])

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
      .select('id, full_name, nickname, has_paid, payment_confirmed, created_at, access_requested_at, avatar_url, admission_dismissed')
      .order('created_at', { ascending: true })

    if (!error && data) setProfiles(data)
  }

  async function fetchBetsData() {
    const [predsRes, betsRes, entriesRes, teamsRes] = await Promise.all([
      supabase.from('predictions')
        .select('user_id, match_id, predicted_home, predicted_away, points_earned'),
      supabase.from('pre_tournament_bets')
        .select('*').order('id', { ascending: true }),
      supabase.from('pre_tournament_entries')
        .select('user_id, bet_id, value, points_awarded, is_resolved'),
      supabase.from('teams').select('id, name, flag_url')
    ])
    setAllPredictions(predsRes.data || [])
    setPreTournamentBets(betsRes.data || [])
    setPreTournamentEntries(entriesRes.data || [])
    setTeams(teamsRes.data || [])
  }

  function getTeamName(teamId) {
    const t = teams.find(tm => tm.id === teamId)
    return t ? t.name : `Equipo ${teamId}`
  }

  // Export XLSX: 1 fila por participante inscrito a La Liguilla, 1 columna por
  // partido. Celda = "X-Y" si predijo, "-" si no.
  async function exportLiguillaXLSX() {
    try {
      const [profRes, matchRes, teamRes] = await Promise.all([
        supabase.from('profiles')
          .select('id, full_name, nickname')
          .eq('friendly_joined', true)
          .order('full_name'),
        supabase.from('matches')
          .select('id, home_team_id, away_team_id, match_date, home_score, away_score, status')
          .eq('stage', 'friendly')
          .order('match_date'),
        supabase.from('teams').select('id, name')
      ])
      const liguillaProfiles = profRes.data || []
      const liguillaMatches  = matchRes.data  || []
      const teamMap = Object.fromEntries((teamRes.data || []).map(t => [t.id, t.name]))

      // Filtrar predicciones SOLO por los 12 partidos friendly. Sin esto,
      // select() sobre predictions trae las 2300+ filas y Supabase corta en
      // 1000 → faltarían participantes. Filtrado = ~550 filas, todas caben.
      const friendlyMatchIds = liguillaMatches.map(m => m.id)
      const { data: predData } = await supabase
        .from('predictions')
        .select('user_id, match_id, predicted_home, predicted_away')
        .in('match_id', friendlyMatchIds)
      const allPreds = predData || []

      // Predicción por (user, match) → "X-Y"
      const predMap = {}
      allPreds.forEach(p => {
        if (p.predicted_home == null || p.predicted_away == null) return
        predMap[`${p.user_id}__${p.match_id}`] = `${p.predicted_home}-${p.predicted_away}`
      })

      const matchHeader = (m) => `${teamMap[m.home_team_id] || '?'} - ${teamMap[m.away_team_id] || '?'}`
      const matchResult = (m) =>
        m.home_score != null && m.away_score != null ? `${m.home_score}-${m.away_score}` : '—'

      // Array-of-arrays: header → resultado real → 1 fila/participante
      const data = []
      data.push(['Participante', ...liguillaMatches.map(matchHeader)])
      data.push(['Resultado real', ...liguillaMatches.map(matchResult)])
      liguillaProfiles.forEach(p => {
        const row = [p.full_name || p.nickname || p.id]
        liguillaMatches.forEach(m => {
          row.push(predMap[`${p.id}__${m.id}`] || '-')
        })
        data.push(row)
      })

      const ws = XLSX.utils.aoa_to_sheet(data)
      // Anchos: nombre 26, partidos 18, score 7
      ws['!cols'] = [{ wch: 26 }, ...liguillaMatches.map(() => ({ wch: 18 }))]
      // Congelar fila 1 (cabecera) y columna A (nombres) para scroll cómodo
      ws['!freeze'] = { xSplit: 1, ySplit: 1 }
      ws['!views'] = [{ xSplit: 1, ySplit: 1, state: 'frozen' }]

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Liguilla')
      const today = new Date().toISOString().slice(0, 10)
      XLSX.writeFile(wb, `liguilla-predicciones-${today}.xlsx`)

      toast?.success(`Excel exportado: ${liguillaProfiles.length} participantes × ${liguillaMatches.length} partidos`)
    } catch (e) {
      console.error('Export Liguilla failed', e)
      toast?.error('No se pudo exportar — revisa consola')
    }
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
      toast.error('Introduce un resultado válido')
      return
    }

    setSaving(matchId)
    const { error } = await supabase
      .from('matches')
      .update({ home_score: home, away_score: away, status: 'finished' })
      .eq('id', matchId)

    if (error) {
      toast.error('Error: ' + error.message)
    } else {
      setMatches(prev => prev.map(m =>
        m.id === matchId ? { ...m, home_score: home, away_score: away, status: 'finished' } : m
      ))
      toast.success('Resultado guardado')
    }
    setSaving(null)
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

  // Pago confirmado (≠ admisión). Este es el que requiere La Liguilla.
  async function togglePaymentConfirmed(userId, currentStatus) {
    const { error } = await supabase
      .from('profiles')
      .update({ payment_confirmed: !currentStatus })
      .eq('id', userId)
    if (!error) {
      setProfiles(prev => prev.map(p =>
        p.id === userId ? { ...p, payment_confirmed: !currentStatus } : p
      ))
    }
  }

  // Ocultar de Admisiones sin borrar la cuenta. Limpia la solicitud → si
  // vuelve a pulsar "Solicitar acceso" reaparece (PaymentWall pone dismissed=false).
  async function dismissAdmission(userId, name) {
    if (!window.confirm(`¿Ocultar a ${name} de Admisiones? Si vuelve a solicitar acceso, reaparecerá.`)) return
    const { error } = await supabase
      .from('profiles')
      .update({ admission_dismissed: true, access_requested_at: null })
      .eq('id', userId)
    if (!error) {
      setProfiles(prev => prev.map(p =>
        p.id === userId ? { ...p, admission_dismissed: true, access_requested_at: null } : p
      ))
      toast?.success(`${name} oculto de Admisiones`)
    } else {
      toast?.error('No se pudo ocultar')
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

  function formatRelative(dateStr) {
    if (!dateStr) return '—'
    const d = new Date(dateStr)
    const diffMs = Date.now() - d.getTime()
    const diffMin = Math.round(diffMs / 60000)
    if (diffMin < 1) return 'ahora'
    if (diffMin < 60) return `hace ${diffMin} min`
    const diffHr = Math.round(diffMin / 60)
    if (diffHr < 24) return `hace ${diffHr} h`
    const diffDay = Math.round(diffHr / 24)
    if (diffDay < 7) return `hace ${diffDay} d`
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
  }

  function pushSyncHistory(entry) {
    const next = [entry, ...syncHistory].slice(0, 3)
    setSyncHistory(next)
    try { localStorage.setItem(SYNC_HISTORY_KEY, JSON.stringify(next)) } catch {}
  }

  const BOT365_UID = 'b0365b03-65b0-365b-0365-b0365b036500'
  // Adaptador para que BracketView guarde el cuadro de Bot365 vía servidor.
  const bot365BracketPersist = {
    upsert: async (rows) => {
      const { data: { session: s } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin-bot365', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(s?.access_token ? { Authorization: `Bearer ${s.access_token}` } : {}) },
        body: JSON.stringify({ bracket: { upsert: rows } }),
      })
      return res.ok ? {} : { error: 'save failed' }
    },
    clear: async (matchNumbers) => {
      const { data: { session: s } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin-bot365', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(s?.access_token ? { Authorization: `Bearer ${s.access_token}` } : {}) },
        body: JSON.stringify({ bracket: { clear: matchNumbers } }),
      })
      return res.ok ? {} : { error: 'save failed' }
    },
  }
  async function loadBot365Preds() {
    const { data } = await supabase
      .from('predictions')
      .select('match_id, predicted_home, predicted_away')
      .eq('user_id', BOT365_UID)
    const map = {}
    ;(data || []).forEach(p => {
      map[p.match_id] = {
        home: p.predicted_home != null ? String(p.predicted_home) : '',
        away: p.predicted_away != null ? String(p.predicted_away) : '',
      }
    })
    setBot365Scores(map)

    // Especiales: bets activas + equipos + entries actuales de Bot365.
    const [betsRes, teamsRes, entriesRes] = await Promise.all([
      supabase.from('pre_tournament_bets').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('teams').select('id, name').order('name'),
      supabase.from('pre_tournament_entries').select('bet_id, value').eq('user_id', BOT365_UID),
    ])
    setBot365Bets(betsRes.data || [])
    setBot365Teams(teamsRes.data || [])
    const em = {}
    ;(entriesRes.data || []).forEach(e => { em[e.bet_id] = e.value })
    setBot365Entries(em)

    setBot365Loaded(true)
  }

  function setBot365Entry(betId, value) {
    setBot365Entries(prev => ({ ...prev, [betId]: value }))
  }

  async function saveBot365Specials() {
    setBot365SpecialsSaving(true)
    setBot365SpecialsMsg(null)
    const pre = Object.entries(bot365Entries)
      .filter(([, v]) => v != null)
      .map(([bet_id, value]) => ({ bet_id: Number(bet_id), value }))
    try {
      const { data: { session: s } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin-bot365', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(s?.access_token ? { Authorization: `Bearer ${s.access_token}` } : {}) },
        body: JSON.stringify({ pre }),
      })
      const out = await res.json()
      setBot365SpecialsMsg(out.error ? `Error: ${out.error}` : `✅ Guardadas ${out.preSaved} especiales`)
    } catch (err) {
      setBot365SpecialsMsg(`Error: ${err.message}`)
    }
    setBot365SpecialsSaving(false)
  }

  async function saveBot365() {
    setBot365Saving(true)
    setBot365Msg(null)
    const preds = Object.entries(bot365Scores)
      .filter(([, v]) => v.home !== '' && v.away !== '')
      .map(([match_id, v]) => ({ match_id: Number(match_id), home: Number(v.home), away: Number(v.away) }))
    try {
      const { data: { session: s } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin-bot365', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(s?.access_token ? { Authorization: `Bearer ${s.access_token}` } : {}),
        },
        body: JSON.stringify({ preds }),
      })
      const out = await res.json()
      setBot365Msg(out.error ? `Error: ${out.error}` : `✅ Guardadas ${out.saved} predicciones${out.skipped ? ` (${out.skipped} ignoradas)` : ''}`)
    } catch (err) {
      setBot365Msg(`Error: ${err.message}`)
    }
    setBot365Saving(false)
  }

  async function runSeedBot365(dry) {
    setSeedingBot(true)
    setSeedLog(null)
    try {
      const { data: { session: s } } = await supabase.auth.getSession()
      const headers = s?.access_token ? { Authorization: `Bearer ${s.access_token}` } : {}
      const res = await fetch(`/api/seed-bot365${dry ? '?dry=1' : ''}`, { headers })
      setSeedLog(await res.json())
    } catch (err) {
      setSeedLog({ error: err.message })
    }
    setSeedingBot(false)
  }

  async function runDigest(force, testEmail) {
    setSendingDigest(true)
    setDigestLog(null)
    try {
      const { data: { session: s } } = await supabase.auth.getSession()
      const headers = s?.access_token ? { Authorization: `Bearer ${s.access_token}` } : {}
      const params = new URLSearchParams()
      if (force) params.set('force', 'true')
      if (testEmail) params.set('test', testEmail)
      const url = '/api/send-daily-digest' + (params.toString() ? `?${params}` : '')
      const res = await fetch(url, { headers })
      const data = await res.json()
      setDigestLog(data)
    } catch (err) {
      setDigestLog({ error: err.message })
    }
    setSendingDigest(false)
  }

  async function runSync() {
    setSyncing(true)
    setSyncLog(null)
    const startedAt = new Date().toISOString()
    try {
      // Send the user's Supabase JWT so the function can verify admin
      // server-side (works whether or not CRON_SECRET is set in env).
      const { data: { session: s } } = await supabase.auth.getSession()
      const headers = s?.access_token ? { Authorization: `Bearer ${s.access_token}` } : {}
      const res = await fetch('/api/sync-results', { headers })
      const data = await res.json()
      setSyncLog(data)
      if (data.matchesUpdated > 0) {
        fetchMatches()
      }
      pushSyncHistory({
        timestamp: data.timestamp || startedAt,
        matchesUpdated: data.matchesUpdated || 0,
        betsResolved: data.betsResolved || 0,
        totalFinished: data.totalFinished || 0,
        notificationsSent: data.notificationsSent || 0,
        ok: !data.error,
        error: data.error || null
      })
    } catch (err) {
      setSyncLog({ error: err.message })
      pushSyncHistory({ timestamp: startedAt, ok: false, error: err.message })
    }
    setSyncing(false)
  }

  if (loading) {
    return <FootballSpinner text="Cargando panel de admin…" />
  }

  if (!isAdmin) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
        No tienes permisos de administrador.
      </div>
    )
  }

  // Stats. Bot365 es un participante interno (línea de referencia, oculto en
  // todas las vistas públicas) → no debe contar como admitido en el Admin tampoco.
  const BOT365_ID_STATS = 'b0365b03-65b0-365b-0365-b0365b036500'
  const realProfilesStats = profiles.filter(p => p.id !== BOT365_ID_STATS)
  const totalMatches = matches.length
  const finishedMatches = matches.filter(m => m.status === 'finished').length
  const liveMatches = matches.filter(m => m.status === 'live').length
  // Los "ocultos" (admission_dismissed) no cuentan ni se muestran en Admisiones.
  const visibleProfilesStats = realProfilesStats.filter(p => !p.admission_dismissed)
  const totalUsers = visibleProfilesStats.length
  const admittedUsers = visibleProfilesStats.filter(p => p.has_paid).length
  const pendingUsers = totalUsers - admittedUsers

  // Group matches with optional search filter
  const searchLower = matchSearch.trim().toLowerCase()
  const groupMatches = matches.filter(m => {
    if (searchLower) {
      const home = (m.home_team?.name || '').toLowerCase()
      const away = (m.away_team?.name || '').toLowerCase()
      return home.includes(searchLower) || away.includes(searchLower)
    }
    return m.group_name === activeGroup
  })

  function countGroupFinished(group) {
    return matches.filter(m => m.group_name === group && m.status === 'finished').length
  }
  function countGroupTotal(group) {
    return matches.filter(m => m.group_name === group).length
  }

  // Match status helper for visual distinction
  function getMatchStatus(m) {
    if (m.status === 'finished') return 'finished'
    if (m.status === 'live') return 'live'
    const start = new Date(m.match_date).getTime()
    const now = Date.now()
    if (now < start) return 'upcoming'
    return 'pending' // past start time but no result entered
  }

  const STATUS_META = {
    finished: { label: 'Finalizado', color: 'var(--green)', bg: 'var(--green-light)' },
    live: { label: 'En vivo', color: '#fff', bg: '#e74c3c' },
    pending: { label: 'Pendiente', color: 'var(--gold)', bg: 'rgba(255,204,0,0.1)' },
    upcoming: { label: 'Por jugar', color: 'var(--text-muted)', bg: 'var(--bg-input)' }
  }

  // Section header style — used across the page
  const sectionHeader = {
    fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '1.2px', color: 'var(--text-muted)',
    margin: '0 0 10px'
  }

  // Pill-tab style helper
  function pillStyle(active) {
    return {
      padding: '6px 12px', borderRadius: '20px', border: 'none',
      background: active ? 'var(--green)' : 'var(--bg-secondary)',
      color: active ? '#fff' : 'var(--text-muted)',
      cursor: 'pointer', fontSize: '12px', fontWeight: active ? 600 : 500,
      whiteSpace: 'nowrap', flexShrink: 0,
      transition: 'all 0.15s ease'
    }
  }

  // Filter & sort profiles for the Admisiones tab.
  // Bot365 oculto siempre (no es un participante real).
  const filteredProfiles = (() => {
    // Bot365 y los ocultos (admission_dismissed) nunca aparecen.
    let arr = profiles.filter(p => p.id !== BOT365_ID_STATS && !p.admission_dismissed)
    if (admissionsFilter === 'pending') arr = arr.filter(p => !p.has_paid)
    else if (admissionsFilter === 'admitted') arr = arr.filter(p => p.has_paid)

    if (admissionsSort === 'requested') {
      arr = [...arr].sort((a, b) => {
        const ta = a.access_requested_at ? new Date(a.access_requested_at).getTime() : 0
        const tb = b.access_requested_at ? new Date(b.access_requested_at).getTime() : 0
        return tb - ta // newest request first
      })
    } else if (admissionsSort === 'created') {
      arr = [...arr].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    } else if (admissionsSort === 'name') {
      arr = [...arr].sort((a, b) =>
        (a.full_name || '').localeCompare(b.full_name || '')
      )
    }
    return arr
  })()

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '16px', minHeight: '100svh' }}>

      {/* ===== Header ===== */}
      <div style={{ marginBottom: '18px' }}>
        <h1 style={{
          fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)',
          margin: '0 0 4px', letterSpacing: '-0.4px'
        }}>
          Panel de Admin
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
          Resultados, admisiones y sincronización con API-Football
        </p>
      </div>

      {/* ===== Stats overview ===== */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '18px' }}>
        <div style={{
          background: 'var(--bg-secondary)', borderRadius: '10px', padding: '14px 12px',
          border: '0.5px solid var(--border)', textAlign: 'center'
        }}>
          <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
            {finishedMatches}<span style={{ fontSize: '13px', color: 'var(--text-dim)', fontWeight: 600 }}>/{totalMatches}</span>
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '2px', fontWeight: 600 }}>
            Partidos
          </div>
        </div>
        <div style={{
          background: 'var(--bg-secondary)', borderRadius: '10px', padding: '14px 12px',
          border: '0.5px solid var(--border)', textAlign: 'center'
        }}>
          <div style={{
            fontSize: '22px', fontWeight: 800, letterSpacing: '-0.5px',
            color: pendingUsers === 0 ? 'var(--green)' : 'var(--gold)'
          }}>
            {pendingUsers}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '2px', fontWeight: 600 }}>
            Pendientes
          </div>
        </div>
        <div style={{
          background: 'var(--bg-secondary)', borderRadius: '10px', padding: '14px 12px',
          border: '0.5px solid var(--border)', textAlign: 'center'
        }}>
          <div style={{
            fontSize: '22px', fontWeight: 800, letterSpacing: '-0.5px',
            color: liveMatches > 0 ? '#e74c3c' : 'var(--text-primary)'
          }}>
            {liveMatches}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '2px', fontWeight: 600 }}>
            En vivo
          </div>
        </div>
      </div>

      {/* ===== Tab switcher (pills) ===== */}
      <div style={{
        display: 'flex', gap: '6px', marginBottom: '18px',
        overflowX: 'auto', paddingBottom: '2px',
        scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch'
      }}>
        <button onClick={() => setActiveTab('results')} style={pillStyle(activeTab === 'results')}>
          Resultados
        </button>
        <button onClick={() => setActiveTab('payments')} style={pillStyle(activeTab === 'payments')}>
          Admisiones {pendingUsers > 0 && (
            <span style={{
              marginLeft: '6px', padding: '1px 6px', borderRadius: '10px',
              background: activeTab === 'payments' ? 'rgba(255,255,255,0.18)' : 'var(--gold)',
              color: activeTab === 'payments' ? '#fff' : '#000',
              fontSize: '10px', fontWeight: 700
            }}>{pendingUsers}</span>
          )}
        </button>
        <button onClick={() => setActiveTab('sync')} style={pillStyle(activeTab === 'sync')}>
          ⚡ Sync API
        </button>
        <button onClick={() => setActiveTab('bets')} style={pillStyle(activeTab === 'bets')}>
          Predicciones
        </button>
        <button onClick={() => setActiveTab('bot365')} style={pillStyle(activeTab === 'bot365')}>
          🤖 Bot365
        </button>
      </div>


      {/* ========== RESULTS TAB ========== */}
      {activeTab === 'results' && (
        <>
          {/* Search input */}
          <div style={{ marginBottom: '12px' }}>
            <input
              type="text"
              value={matchSearch}
              onChange={e => setMatchSearch(e.target.value)}
              placeholder="Buscar por equipo (ej: España, Brasil…)"
              style={{
                width: '100%', padding: '10px 14px', borderRadius: '10px',
                border: '0.5px solid var(--border)', background: 'var(--bg-input)',
                color: 'var(--text-primary)', fontSize: '13px', outline: 'none',
                boxSizing: 'border-box'
              }}
              onFocus={e => e.target.style.borderColor = 'var(--green)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
          </div>

          {/* Group selector — hidden when searching */}
          {!searchLower && (
            <>
              <div style={sectionHeader}>Grupos</div>
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
                        padding: '6px 12px', borderRadius: '20px', border: 'none',
                        background: isActive ? 'var(--green)' : isComplete ? 'var(--green-light)' : 'var(--bg-secondary)',
                        color: isActive ? '#fff' : isComplete ? 'var(--green)' : 'var(--text-muted)',
                        cursor: 'pointer', fontSize: '12px', fontWeight: isActive ? 600 : 500,
                        whiteSpace: 'nowrap', flexShrink: 0
                      }}
                    >
                      {g} <span style={{ opacity: 0.65, fontSize: '10px', marginLeft: '2px' }}>{done}/{total}</span>
                    </button>
                  )
                })}
              </div>

              {/* Group progress */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: '10px',
                marginBottom: '12px', border: '0.5px solid var(--border)'
              }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Grupo {activeGroup}
                </span>
                <span style={{
                  fontSize: '12px', fontWeight: 700,
                  color: countGroupFinished(activeGroup) === countGroupTotal(activeGroup) && countGroupTotal(activeGroup) > 0 ? 'var(--green)' : 'var(--gold)'
                }}>
                  {countGroupFinished(activeGroup)}/{countGroupTotal(activeGroup)} finalizados
                </span>
              </div>
            </>
          )}

          {/* Search summary */}
          {searchLower && (
            <div style={{
              padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: '10px',
              marginBottom: '12px', border: '0.5px solid var(--border)',
              fontSize: '12px', color: 'var(--text-muted)'
            }}>
              {groupMatches.length} {groupMatches.length === 1 ? 'partido encontrado' : 'partidos encontrados'} con “{matchSearch.trim()}”
            </div>
          )}

          {/* Match list */}
          {groupMatches.length === 0 && (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '13px' }}>
              Sin partidos
            </div>
          )}
          {groupMatches.map(match => {
            const statusKey = getMatchStatus(match)
            const meta = STATUS_META[statusKey]
            // Subtle left-border accent for live + pending
            const accentColor = statusKey === 'live' ? '#e74c3c'
              : statusKey === 'pending' ? 'var(--gold)'
              : statusKey === 'finished' ? 'var(--green)'
              : 'transparent'
            return (
              <div key={match.id} style={{
                padding: '12px 14px',
                marginBottom: '8px',
                background: 'var(--bg-secondary)',
                borderRadius: '10px',
                border: '0.5px solid var(--border)',
                borderLeft: `3px solid ${accentColor}`
              }}>
                {/* Date + group tag */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  fontSize: '11px', color: 'var(--text-dim)', marginBottom: '10px'
                }}>
                  <span>{formatDate(match.match_date)}</span>
                  {searchLower && match.group_name && (
                    <span style={{
                      padding: '2px 8px', borderRadius: '20px', background: 'var(--bg-input)',
                      color: 'var(--text-muted)', fontSize: '10px', fontWeight: 600
                    }}>
                      Grupo {match.group_name}
                    </span>
                  )}
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
                      fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600,
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
                        width: '38px', height: '34px', textAlign: 'center',
                        fontSize: '15px', fontWeight: 700, borderRadius: '6px',
                        border: statusKey === 'finished' ? '1px solid var(--green)' : '1px solid var(--border)',
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
                        width: '38px', height: '34px', textAlign: 'center',
                        fontSize: '15px', fontWeight: 700, borderRadius: '6px',
                        border: statusKey === 'finished' ? '1px solid var(--green)' : '1px solid var(--border)',
                        background: 'var(--bg-input)',
                        color: scores[match.id]?.away !== '' ? 'var(--text-primary)' : 'var(--text-dim)',
                        outline: 'none'
                      }}
                    />
                  </div>

                  {/* Away team */}
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end', minWidth: 0 }}>
                    <span style={{
                      fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600,
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

                {/* Status badge + Save button */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                  <span style={{
                    fontSize: '10px', padding: '4px 10px', borderRadius: '20px',
                    background: meta.bg, color: meta.color,
                    fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px',
                    display: 'inline-flex', alignItems: 'center', gap: '5px'
                  }}>
                    {statusKey === 'live' && (
                      <span style={{
                        width: '6px', height: '6px', borderRadius: '50%',
                        background: '#fff', display: 'inline-block', boxShadow: '0 0 8px #fff'
                      }} />
                    )}
                    {meta.label}
                  </span>
                  <button
                    onClick={() => saveResult(match.id)}
                    disabled={saving === match.id}
                    style={{
                      padding: '6px 16px',
                      background: statusKey === 'finished' ? 'var(--bg-input)' : 'var(--green)',
                      color: statusKey === 'finished' ? 'var(--text-muted)' : '#fff',
                      border: statusKey === 'finished' ? '0.5px solid var(--border)' : 'none',
                      borderRadius: '6px', cursor: saving === match.id ? 'not-allowed' : 'pointer',
                      fontSize: '11px', fontWeight: 700,
                      opacity: saving === match.id ? 0.7 : 1,
                      letterSpacing: '0.4px', textTransform: 'uppercase'
                    }}
                  >
                    {saving === match.id ? '...' : statusKey === 'finished' ? 'Actualizar' : 'Guardar'}
                  </button>
                </div>
              </div>
            )
          })}
        </>
      )}

      {/* ========== ADMISIONES TAB ========== */}
      {activeTab === 'payments' && (
        <>
          {/* Hero summary */}
          <div style={{
            background: 'linear-gradient(135deg, #00392a, #005e3a)',
            borderRadius: '12px', padding: '16px', marginBottom: '14px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '1.2px', fontWeight: 700 }}>
                  Admitidos
                </div>
                <div style={{ fontSize: '30px', fontWeight: 800, color: 'var(--gold)', marginTop: '2px', letterSpacing: '-0.5px' }}>
                  {admittedUsers}<span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}>/{totalUsers}</span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '1.2px', fontWeight: 700 }}>
                  Pendientes
                </div>
                <div style={{
                  fontSize: '30px', fontWeight: 800, marginTop: '2px', letterSpacing: '-0.5px',
                  color: pendingUsers > 0 ? '#ffb4b4' : 'var(--green)'
                }}>
                  {pendingUsers}
                </div>
              </div>
            </div>
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

          {/* Filter pills */}
          <div style={sectionHeader}>Filtrar</div>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <button onClick={() => setAdmissionsFilter('pending')} style={pillStyle(admissionsFilter === 'pending')}>
              Pendientes {pendingUsers > 0 && (
                <span style={{ marginLeft: '4px', opacity: 0.85 }}>({pendingUsers})</span>
              )}
            </button>
            <button onClick={() => setAdmissionsFilter('admitted')} style={pillStyle(admissionsFilter === 'admitted')}>
              Admitidos ({admittedUsers})
            </button>
            <button onClick={() => setAdmissionsFilter('all')} style={pillStyle(admissionsFilter === 'all')}>
              Todos ({totalUsers})
            </button>
          </div>

          {/* Sort */}
          <div style={{
            display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '12px',
            fontSize: '11px', color: 'var(--text-muted)'
          }}>
            <span style={{ textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700 }}>Ordenar:</span>
            <select
              value={admissionsSort}
              onChange={e => setAdmissionsSort(e.target.value)}
              style={{
                padding: '5px 10px', borderRadius: '8px',
                border: '0.5px solid var(--border)', background: 'var(--bg-input)',
                color: 'var(--text-primary)', fontSize: '11px', outline: 'none'
              }}
            >
              <option value="requested">Solicitud (recientes)</option>
              <option value="created">Registro (recientes)</option>
              <option value="name">Nombre A-Z</option>
            </select>
          </div>

          {/* User list */}
          {filteredProfiles.length === 0 && (
            <div style={{
              padding: '40px 16px', textAlign: 'center',
              color: 'var(--text-dim)', fontSize: '13px',
              background: 'var(--bg-secondary)', borderRadius: '10px',
              border: '0.5px solid var(--border)'
            }}>
              Sin usuarios en esta vista
            </div>
          )}

          {filteredProfiles.map(profile => {
            const name = profile.full_name || 'Sin nombre'
            return (
              <div key={profile.id} style={{
                padding: '12px 14px', marginBottom: '8px',
                background: 'var(--bg-secondary)', borderRadius: '10px',
                border: '0.5px solid var(--border)'
              }}>
                {/* Fila 1: avatar + nombre + badges (info) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: profile.has_paid ? '10px' : '0' }}>
                  <Avatar url={profile.avatar_url} name={name} size={36} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>
                      {name}
                    </div>
                    <div style={{
                      fontSize: '11px', color: 'var(--text-dim)', marginTop: '3px',
                      display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap'
                    }}>
                      <span style={{
                        padding: '1px 7px', borderRadius: '20px', fontSize: '10px',
                        background: profile.has_paid ? 'var(--green-light)' : 'rgba(255,204,0,0.1)',
                        color: profile.has_paid ? 'var(--green)' : 'var(--gold)',
                        fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px'
                      }}>
                        {profile.has_paid ? 'Admitido' : 'Pendiente'}
                      </span>
                      {profile.has_paid && (
                        <span style={{
                          padding: '1px 7px', borderRadius: '20px', fontSize: '10px',
                          background: profile.payment_confirmed ? 'rgba(0,144,81,0.15)' : 'rgba(226,75,74,0.15)',
                          color: profile.payment_confirmed ? 'var(--green)' : '#e74c3c',
                          fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px'
                        }}>
                          {profile.payment_confirmed ? '€ Pagado' : '€ Sin pagar'}
                        </span>
                      )}
                      {profile.access_requested_at && !profile.has_paid && (
                        <span title={new Date(profile.access_requested_at).toLocaleString('es-ES')}>
                          {formatRelative(profile.access_requested_at)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Fila 2: botones a ancho completo (sin solape) */}
                {!profile.has_paid ? (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => togglePayment(profile.id, profile.has_paid)}
                      style={{
                        flex: 2, padding: '9px 14px', borderRadius: '8px', cursor: 'pointer',
                        fontSize: '12px', fontWeight: 700, border: 'none',
                        background: 'var(--green)', color: '#fff',
                        letterSpacing: '0.5px', textTransform: 'uppercase'
                      }}
                    >
                      Admitir
                    </button>
                    <button
                      onClick={() => dismissAdmission(profile.id, name)}
                      title="Ocultar de Admisiones (tendría que volver a solicitar)"
                      style={{
                        flex: 1, padding: '9px 8px', borderRadius: '8px', cursor: 'pointer',
                        fontSize: '11px', fontWeight: 600, border: '0.5px solid var(--border)',
                        background: 'var(--bg-input)', color: 'var(--text-muted)',
                        letterSpacing: '0.4px', textTransform: 'uppercase'
                      }}
                    >
                      Ocultar
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => togglePaymentConfirmed(profile.id, profile.payment_confirmed)}
                      title={profile.payment_confirmed ? 'Marcar como NO pagado' : 'Marcar como pagado'}
                      style={{
                        flex: 2, padding: '9px 8px', borderRadius: '8px', cursor: 'pointer',
                        fontSize: '11px', fontWeight: 700, border: 'none',
                        background: profile.payment_confirmed ? 'var(--bg-input)' : 'var(--gold)',
                        color: profile.payment_confirmed ? 'var(--text-muted)' : '#1a1d26',
                        letterSpacing: '0.4px', textTransform: 'uppercase'
                      }}
                    >
                      {profile.payment_confirmed ? 'Quitar pago' : 'Marcar pagado'}
                    </button>
                    <button
                      onClick={() => togglePayment(profile.id, profile.has_paid)}
                      style={{
                        flex: 1, padding: '9px 8px', borderRadius: '8px', cursor: 'pointer',
                        fontSize: '11px', fontWeight: 600, border: '0.5px solid var(--border)',
                        background: 'var(--bg-input)', color: 'var(--text-muted)',
                        letterSpacing: '0.4px', textTransform: 'uppercase'
                      }}
                    >
                      Revocar
                    </button>
                  </div>
                )}
              </div>
            )
          })}

          {/* Forum management */}
          <div style={{
            marginTop: '24px', padding: '16px',
            background: 'var(--bg-secondary)', borderRadius: '12px',
            border: '0.5px solid var(--border)'
          }}>
            <div style={sectionHeader}>Gestión del foro</div>
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
                  toast.error('Error al limpiar foro: ' + error.message)
                } else {
                  toast.success('Foro limpiado correctamente')
                }
              }}
              style={{
                padding: '10px 20px', borderRadius: '8px', border: 'none',
                cursor: 'pointer', fontSize: '12px', fontWeight: 700,
                background: '#e74c3c', color: '#fff',
                letterSpacing: '0.4px', textTransform: 'uppercase'
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
          {/* Action card */}
          <div style={{
            background: 'var(--bg-secondary)', borderRadius: '12px',
            padding: '18px', marginBottom: '14px',
            border: '0.5px solid var(--border)'
          }}>
            <div style={sectionHeader}>Sincronización con API-Football</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.55', marginBottom: '14px' }}>
              Actualiza resultados de partidos, resuelve predicciones pre-torneo y sincroniza estadísticas en vivo.
              Se ejecuta automáticamente a las 9:00 UTC. Pulsa para forzar una sincronización inmediata.
            </div>
            <button
              onClick={runSync}
              disabled={syncing}
              style={{
                width: '100%', padding: '14px', borderRadius: '10px',
                border: 'none', cursor: syncing ? 'not-allowed' : 'pointer',
                fontSize: '13px', fontWeight: 700,
                background: syncing ? 'var(--bg-input)' : 'var(--green)',
                color: syncing ? 'var(--text-muted)' : '#fff',
                letterSpacing: '0.6px', textTransform: 'uppercase',
                transition: 'background 0.15s ease'
              }}
            >
              {syncing ? 'Sincronizando…' : '⚡ Ejecutar sync ahora'}
            </button>
          </div>

          {/* Loading state with FootballSpinner */}
          {syncing && !syncLog && (
            <div style={{
              background: 'var(--bg-secondary)', borderRadius: '12px',
              padding: '20px', marginBottom: '14px',
              border: '0.5px solid var(--border)'
            }}>
              <FootballSpinner size={32} text="Llamando a API-Football, calculando puntos…" />
            </div>
          )}

          {/* Result panel */}
          {syncLog && !syncing && (
            <div style={{
              background: 'var(--bg-secondary)', borderRadius: '12px', padding: '16px',
              border: '0.5px solid var(--border)', marginBottom: '14px'
            }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: '12px'
              }}>
                <div style={sectionHeader}>
                  {syncLog.error ? 'Error en el sync' : 'Resultado del último sync'}
                </div>
                {syncLog.timestamp && (
                  <span style={{ fontSize: '10px', color: 'var(--text-dim)', margin: '0 0 10px' }}>
                    {new Date(syncLog.timestamp).toLocaleTimeString('es-ES')}
                  </span>
                )}
              </div>

              {syncLog.error ? (
                <div style={{
                  padding: '12px', borderRadius: '8px',
                  background: 'rgba(231,76,60,0.1)', border: '0.5px solid rgba(231,76,60,0.3)',
                  color: '#e74c3c', fontSize: '12px', fontFamily: 'monospace'
                }}>
                  ❌ {syncLog.error}
                </div>
              ) : (
                <>
                  {/* Stat grid */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px',
                    marginBottom: '14px'
                  }}>
                    <div style={{ textAlign: 'center', padding: '10px 4px', background: 'var(--bg-input)', borderRadius: '8px' }}>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--green)' }}>{syncLog.matchesUpdated || 0}</div>
                      <div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginTop: '2px', fontWeight: 600 }}>Partidos</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '10px 4px', background: 'var(--bg-input)', borderRadius: '8px' }}>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--gold)' }}>{syncLog.betsResolved || 0}</div>
                      <div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginTop: '2px', fontWeight: 600 }}>Predicc.</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '10px 4px', background: 'var(--bg-input)', borderRadius: '8px' }}>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>{syncLog.notificationsSent || 0}</div>
                      <div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginTop: '2px', fontWeight: 600 }}>Push</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '10px 4px', background: 'var(--bg-input)', borderRadius: '8px' }}>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-muted)' }}>{syncLog.totalFinished || 0}</div>
                      <div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginTop: '2px', fontWeight: 600 }}>Finaliz.</div>
                    </div>
                  </div>

                  {/* Log lines */}
                  {(syncLog.log || []).length > 0 && (
                    <div style={{
                      maxHeight: '200px', overflowY: 'auto',
                      padding: '10px 12px', background: '#0d1117',
                      borderRadius: '8px', border: '0.5px solid var(--border)',
                      fontFamily: 'monospace'
                    }}>
                      {(syncLog.log || []).map((line, i) => (
                        <div key={i} style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '2px 0', lineHeight: '1.4' }}>
                          {line}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* History */}
          {syncHistory.length > 0 && (
            <div>
              <div style={sectionHeader}>Últimas sincronizaciones</div>
              {syncHistory.map((entry, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 14px', marginBottom: '6px',
                  background: 'var(--bg-secondary)', borderRadius: '10px',
                  border: '0.5px solid var(--border)',
                  borderLeft: `3px solid ${entry.ok ? 'var(--green)' : '#e74c3c'}`
                }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {entry.ok ? 'Sync correcto' : 'Sync con error'}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>
                      {formatRelative(entry.timestamp)}
                      {' · '}
                      {new Date(entry.timestamp).toLocaleString('es-ES', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                    </div>
                  </div>
                  {entry.ok ? (
                    <div style={{ display: 'flex', gap: '10px', fontSize: '11px', color: 'var(--text-muted)' }}>
                      <span><b style={{ color: 'var(--green)' }}>{entry.matchesUpdated}</b> partidos</span>
                      <span><b style={{ color: 'var(--gold)' }}>{entry.betsResolved}</b> predicc.</span>
                    </div>
                  ) : (
                    <span style={{ fontSize: '11px', color: '#e74c3c', maxWidth: '50%', textAlign: 'right' }}>
                      {entry.error}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* === DIGEST DIARIO POR EMAIL === */}
          <div style={{
            background: 'var(--bg-secondary)', borderRadius: '12px',
            padding: '18px', marginTop: '14px', marginBottom: '14px',
            border: '0.5px solid var(--border)'
          }}>
            <div style={sectionHeader}>📧 Digest diario por email</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.55', marginBottom: '14px' }}>
              Envía a todos los participantes (vía Resend) un email con su posición,
              top 10, resultados del día anterior y la crónica. Cron automático a las
              06:00 UTC (08:00 hora España). Pulsa para enviar ahora — fuerza el envío
              aunque no haya partidos ayer.
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => runDigest(true, session?.user?.email)}
                disabled={sendingDigest || !session?.user?.email}
                style={{
                  flex: 1, padding: '14px', borderRadius: '10px',
                  border: '1px solid var(--border)', cursor: sendingDigest ? 'not-allowed' : 'pointer',
                  fontSize: '12px', fontWeight: 700,
                  background: 'var(--bg-input)',
                  color: sendingDigest ? 'var(--text-muted)' : 'var(--text-primary)',
                  letterSpacing: '0.4px',
                  transition: 'background 0.15s ease'
                }}
              >
                🧪 Probar (solo a mí)
              </button>
              <button
                onClick={() => runDigest(true)}
                disabled={sendingDigest}
                style={{
                  flex: 1, padding: '14px', borderRadius: '10px',
                  border: 'none', cursor: sendingDigest ? 'not-allowed' : 'pointer',
                  fontSize: '12px', fontWeight: 700,
                  background: sendingDigest ? 'var(--bg-input)' : 'var(--green)',
                  color: sendingDigest ? 'var(--text-muted)' : '#fff',
                  letterSpacing: '0.4px',
                  transition: 'background 0.15s ease'
                }}
              >
                {sendingDigest ? 'Enviando…' : '📨 Enviar a todos'}
              </button>
            </div>

            {sendingDigest && !digestLog && (
              <div style={{ marginTop: '14px' }}>
                <FootballSpinner size={28} text="Generando emails y enviando vía Resend…" />
              </div>
            )}

            {digestLog && !sendingDigest && (
              <div style={{
                marginTop: '14px', padding: '12px',
                background: 'var(--bg-input)', borderRadius: '8px',
                fontSize: '12px', color: 'var(--text-muted)'
              }}>
                {digestLog.error ? (
                  <div style={{ color: '#e74c3c' }}>
                    <strong>Error:</strong> {digestLog.error}
                  </div>
                ) : (
                  <>
                    <div style={{ marginBottom: '8px' }}>
                      <strong style={{ color: 'var(--text-primary)' }}>
                        ✅ {digestLog.sent || 0} emails enviados
                      </strong>
                      {digestLog.failed > 0 && (
                        <span style={{ color: '#e74c3c', marginLeft: '8px' }}>
                          · {digestLog.failed} fallos
                        </span>
                      )}
                    </div>
                    {digestLog.reason && (
                      <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '8px' }}>
                        Reason: {digestLog.reason}
                      </div>
                    )}
                    {digestLog.log && (
                      <details>
                        <summary style={{ cursor: 'pointer', fontSize: '11px' }}>Ver log completo</summary>
                        <pre style={{
                          marginTop: '6px', fontSize: '10px', lineHeight: '1.5',
                          whiteSpace: 'pre-wrap', wordBreak: 'break-all'
                        }}>{digestLog.log.join('\n')}</pre>
                      </details>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* === RE-SEED BOT365 (cuotas) === */}
          <div style={{
            background: 'var(--bg-secondary)', borderRadius: '12px',
            padding: '18px', marginBottom: '14px',
            border: '0.5px solid var(--border)'
          }}>
            <div style={sectionHeader}>🤖 Bot365 — predicciones por cuotas</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.55', marginBottom: '14px' }}>
              Rellena las predicciones de partidos de Bot365 con el favorito según
              las cuotas 1X2 de API-Football. "Previsualizar" no escribe nada (solo
              muestra el plan y la cobertura de cuotas).
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => runSeedBot365(true)}
                disabled={seedingBot}
                style={{
                  flex: 1, padding: '12px', borderRadius: '8px',
                  border: '1px solid var(--border)', cursor: seedingBot ? 'not-allowed' : 'pointer',
                  fontSize: '12px', fontWeight: 700, background: 'var(--bg-input)',
                  color: seedingBot ? 'var(--text-muted)' : 'var(--text-primary)'
                }}
              >🔍 Previsualizar</button>
              <button
                onClick={() => runSeedBot365(false)}
                disabled={seedingBot}
                style={{
                  flex: 1, padding: '12px', borderRadius: '8px', border: 'none',
                  cursor: seedingBot ? 'not-allowed' : 'pointer',
                  fontSize: '12px', fontWeight: 700,
                  background: seedingBot ? 'var(--bg-input)' : 'var(--green)',
                  color: seedingBot ? 'var(--text-muted)' : '#fff'
                }}
              >{seedingBot ? 'Procesando…' : '🤖 Aplicar'}</button>
            </div>
            {seedLog && !seedingBot && (
              <div style={{
                marginTop: '14px', padding: '12px', background: 'var(--bg-input)',
                borderRadius: '8px', fontSize: '12px', color: 'var(--text-muted)'
              }}>
                {seedLog.error ? (
                  <div style={{ color: '#e74c3c' }}><strong>Error:</strong> {seedLog.error}</div>
                ) : (
                  <>
                    <div style={{ color: 'var(--text-primary)', fontWeight: 700, marginBottom: '6px' }}>
                      {seedLog.dry ? 'Previsualización' : 'Aplicado'} · {seedLog.summary?.filled || 0} con cuota
                    </div>
                    <div style={{ fontSize: '11px' }}>
                      Sin fixture: {seedLog.summary?.noFixture ?? 0} · Sin cuota: {seedLog.summary?.noOdds ?? 0} · Total grupos: {seedLog.summary?.groupMatches ?? 0}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ========== BETS TAB ========== */}
      {activeTab === 'bets' && (() => {
        const BOT365_ID = 'b0365b03-65b0-365b-0365-b0365b036500'
        const realProfiles = profiles.filter(p => p.id !== BOT365_ID)
        const sortedBetsProfiles = [...realProfiles].sort((a, b) =>
          (a.full_name || '').localeCompare(b.full_name || '')
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
            {/* Export Liguilla XLSX — disponible cualquier momento (post-deadline
                muestra picks congelados; pre-deadline muestra estado vivo). */}
            <div style={{
              marginBottom: '12px', padding: '10px 12px',
              background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.25)',
              borderRadius: '8px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px'
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#60a5fa' }}>
                  Export Liguilla → Excel
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  1 fila por participante · 12 columnas (1 por partido) · resultado real arriba
                </div>
              </div>
              <button
                onClick={exportLiguillaXLSX}
                style={{
                  padding: '8px 14px', borderRadius: '8px', border: 'none',
                  background: '#2563eb', color: '#fff',
                  fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                  whiteSpace: 'nowrap', flexShrink: 0
                }}
              >Descargar .xlsx</button>
            </div>

            {/* Sub-tab switcher */}
            <div style={{
              display: 'flex', gap: '6px', marginBottom: '14px',
              overflowX: 'auto', scrollbarWidth: 'none'
            }}>
              {[
                { key: 'matches', label: 'Partidos' },
                { key: 'pre', label: 'Pre-torneo' },
                { key: 'completion', label: 'Progreso' }
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setBetsSubTab(tab.key)}
                  style={pillStyle(betsSubTab === tab.key)}
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
                      style={pillStyle(betsFilterGroup === g)}
                    >{g}</button>
                  ))}
                </div>

                {/* User filter */}
                <select
                  value={betsFilterUser}
                  onChange={e => setBetsFilterUser(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: '10px',
                    border: '0.5px solid var(--border)', background: 'var(--bg-input)',
                    color: 'var(--text-primary)', fontSize: '12px', outline: 'none',
                    appearance: 'auto', marginBottom: '12px', boxSizing: 'border-box'
                  }}
                >
                  <option value="">Todos los participantes</option>
                  {sortedBetsProfiles.map(p => (
                    <option key={p.id} value={p.id}>{p.full_name}</option>
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
                      background: 'var(--bg-secondary)', borderRadius: '10px', padding: '14px',
                      marginBottom: '8px', border: '0.5px solid var(--border)'
                    }}>
                      {/* Teams */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: 600 }}>
                            {match.home_team?.name || 'Por determinar'}
                          </span>
                          {match.home_team?.flag_url && <img src={match.home_team.flag_url} alt="" style={{ width: '18px', height: '12px', borderRadius: '2px', objectFit: 'cover' }} />}
                        </div>
                        <span style={{
                          fontSize: match.status === 'finished' ? '14px' : '11px',
                          fontWeight: 700,
                          color: match.status === 'finished' ? 'var(--green)' : 'var(--text-dim)',
                          padding: '2px 8px', background: match.status === 'finished' ? 'var(--green-light)' : 'var(--bg-input)',
                          borderRadius: '4px'
                        }}>
                          {match.status === 'finished' ? `${match.home_score}-${match.away_score}` : 'vs'}
                        </span>
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {match.away_team?.flag_url && <img src={match.away_team.flag_url} alt="" style={{ width: '18px', height: '12px', borderRadius: '2px', objectFit: 'cover' }} />}
                          <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: 600 }}>
                            {match.away_team?.name || 'Por determinar'}
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
                            padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
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
                                <span style={{ color: 'var(--text-muted)' }}>{prof?.full_name || 'Participante'}</span>
                                <span style={{
                                  fontWeight: 600,
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
                      background: 'var(--bg-secondary)', borderRadius: '10px', padding: '14px',
                      marginBottom: '8px', border: '0.5px solid var(--border)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>
                            {bet.name || bet.question}
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
                            {entries.length} respuestas · Max {bet.max_points} pts
                          </div>
                        </div>
                        <span style={{
                          padding: '3px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700,
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
                                  fontSize: '12px', fontWeight: i === 0 ? 700 : 500,
                                  color: i === 0 ? 'var(--gold)' : 'var(--text-primary)',
                                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%'
                                }}>
                                  {i === 0 ? '👑 ' : ''}{label}
                                </span>
                                <span style={{
                                  fontSize: '11px', fontWeight: 700,
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

            {/* ---- COMPLETION SUB-TAB ---- */}
            {betsSubTab === 'completion' && (
              <>
                <div style={{
                  background: 'var(--bg-secondary)', borderRadius: '10px', padding: '12px 14px',
                  marginBottom: '12px', border: '0.5px solid var(--border)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                    <span>Totales: {totalMatchCount} partidos · {preTournamentBets.length} predicciones pre-torneo</span>
                  </div>
                </div>

                {/* Header */}
                <div style={{
                  display: 'flex', padding: '8px 12px', fontSize: '10px', color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '0.5px solid var(--border)',
                  fontWeight: 700
                }}>
                  <span style={{ flex: 1 }}>Nombre</span>
                  <span style={{ width: '60px', textAlign: 'center' }}>Partidos</span>
                  <span style={{ width: '60px', textAlign: 'center' }}>Predicciones</span>
                </div>

                {completionData.map(user => (
                  <div key={user.id} style={{
                    display: 'flex', alignItems: 'center', padding: '8px 12px',
                    borderBottom: '0.5px solid var(--border-light)'
                  }}>
                    <span style={{
                      flex: 1, fontSize: '12px', fontWeight: 600,
                      color: user.matchPct === 100 && user.betPct === 100 ? 'var(--green)' : 'var(--text-primary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>
                      {user.full_name || 'Sin nombre'}
                    </span>
                    <div style={{ width: '60px', textAlign: 'center' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: user.matchPct === 100 ? 'var(--green)' : user.matchPct > 50 ? 'var(--gold)' : 'var(--text-dim)' }}>
                        {user.matchPreds}
                      </div>
                      <div style={{ fontSize: '9px', color: 'var(--text-dim)' }}>{user.matchPct}%</div>
                    </div>
                    <div style={{ width: '60px', textAlign: 'center' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: user.betPct === 100 ? 'var(--green)' : user.betPct > 50 ? 'var(--gold)' : 'var(--text-dim)' }}>
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

      {/* ========== BOT365 EDITOR TAB ========== */}
      {activeTab === 'bot365' && (() => {
        const groupMatches = matches
          .filter(m => m.stage === 'group' && m.group_name === bot365Group)
          .sort((a, b) => new Date(a.match_date) - new Date(b.match_date))
        const setScore = (mid, side, val) => {
          const v = val.replace(/[^0-9]/g, '').slice(0, 2)
          setBot365Scores(prev => ({ ...prev, [mid]: { ...prev[mid], [side]: v } }))
        }
        const filledCount = Object.values(bot365Scores).filter(v => v.home !== '' && v.away !== '').length
        return (
          <>
            <div style={{
              background: 'rgba(255,204,0,0.06)', border: '1px solid rgba(255,204,0,0.25)',
              borderRadius: '10px', padding: '12px 14px', marginBottom: '14px',
              fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5'
            }}>
              Editas las predicciones de <strong style={{ color: 'var(--gold)' }}>Bot365</strong> (la referencia
              "casas de apuestas"). Ajusta los marcadores a lo que diga bet365 y guarda.
              Total con predicción: <strong style={{ color: 'var(--text-primary)' }}>{filledCount}/72</strong>.
              {' '}(El pre-torneo se edita aparte.)
            </div>

            {/* Sub-tabs: Partidos / Cuadro / Especiales */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
              <button onClick={() => setBot365SubTab('matches')} style={pillStyle(bot365SubTab === 'matches')}>Partidos</button>
              <button onClick={() => setBot365SubTab('bracket')} style={pillStyle(bot365SubTab === 'bracket')}>Cuadro</button>
              <button onClick={() => setBot365SubTab('specials')} style={pillStyle(bot365SubTab === 'specials')}>Especiales</button>
            </div>

            {bot365SubTab === 'bracket' ? (
              <BracketView session={session} targetUserId={BOT365_UID} persist={bot365BracketPersist} />
            ) : bot365SubTab === 'specials' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {bot365Bets.map(bet => {
                  const val = bot365Entries[bet.id]
                  // Opciones de equipo según config (excluded_teams / only_teams)
                  let teamOpts = bot365Teams
                  if (bet.config?.excluded_teams?.length) teamOpts = bot365Teams.filter(t => !bet.config.excluded_teams.includes(t.name))
                  if (bet.config?.only_teams?.length) teamOpts = bot365Teams.filter(t => bet.config.only_teams.includes(t.name))
                  return (
                    <div key={bet.id} style={{
                      background: 'var(--bg-secondary)', borderRadius: '8px',
                      padding: '12px 14px', border: '0.5px solid var(--border)'
                    }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
                        {bet.name} <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 500 }}>· {bet.max_points} pts</span>
                      </div>
                      {bet.input_type === 'single_player' && (
                        <PlayerSelector
                          value={val}
                          onChange={v => setBot365Entry(bet.id, v)}
                          config={bet.config || {}}
                        />
                      )}
                      {bet.input_type === 'single_team' && (
                        <select
                          value={val?.team_id || ''}
                          onChange={e => setBot365Entry(bet.id, e.target.value ? { team_id: Number(e.target.value) } : null)}
                          style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '0.5px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: '14px', appearance: 'auto', boxSizing: 'border-box' }}
                        >
                          <option value="">— elegir —</option>
                          {teamOpts.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      )}
                      {bet.input_type === 'yes_no' && (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {[{ k: 'yes', l: 'Sí' }, { k: 'no', l: 'No' }].map(o => (
                            <button key={o.k}
                              onClick={() => setBot365Entry(bet.id, { answer: o.k })}
                              style={{
                                flex: 1, padding: '9px', borderRadius: '6px', cursor: 'pointer',
                                border: '1px solid var(--border)', fontSize: '13px', fontWeight: 700,
                                background: val?.answer === o.k ? 'var(--green)' : 'var(--bg-input)',
                                color: val?.answer === o.k ? '#fff' : 'var(--text-muted)',
                              }}
                            >{o.l}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
                <div style={{ marginTop: '6px' }}>
                  {bot365SpecialsMsg && (
                    <div style={{ marginBottom: '10px', fontSize: '12px', fontWeight: 600, color: bot365SpecialsMsg.startsWith('Error') ? '#e74c3c' : 'var(--green)' }}>
                      {bot365SpecialsMsg}
                    </div>
                  )}
                  <button onClick={saveBot365Specials} disabled={bot365SpecialsSaving}
                    style={{ width: '100%', padding: '14px', borderRadius: '10px', border: 'none', cursor: bot365SpecialsSaving ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 700, background: bot365SpecialsSaving ? 'var(--bg-input)' : 'var(--green)', color: bot365SpecialsSaving ? 'var(--text-muted)' : '#fff' }}>
                    {bot365SpecialsSaving ? 'Guardando…' : '💾 Guardar especiales de Bot365'}
                  </button>
                </div>
              </div>
            ) : (<>

            {/* Selector de grupo */}
            <div className="group-tabs" style={{ marginBottom: '12px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {groups.map(g => (
                <button key={g} onClick={() => setBot365Group(g)} style={pillStyle(bot365Group === g)}>{g}</button>
              ))}
            </div>

            {!bot365Loaded ? (
              <FootballSpinner text="Cargando predicciones de Bot365…" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {groupMatches.map(m => {
                  const sc = bot365Scores[m.id] || { home: '', away: '' }
                  return (
                    <div key={m.id} style={{
                      display: 'grid', gridTemplateColumns: '1fr 38px 14px 38px 1fr',
                      alignItems: 'center', gap: '6px',
                      background: 'var(--bg-secondary)', borderRadius: '8px',
                      padding: '8px 10px', border: '0.5px solid var(--border)'
                    }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-primary)', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m.home_team?.name || '?'}
                      </span>
                      <input
                        inputMode="numeric" value={sc.home}
                        onChange={e => setScore(m.id, 'home', e.target.value)}
                        style={{ width: '38px', padding: '7px 0', textAlign: 'center', borderRadius: '6px', border: '0.5px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: '14px', fontWeight: 700 }}
                      />
                      <span style={{ textAlign: 'center', color: 'var(--text-dim)' }}>-</span>
                      <input
                        inputMode="numeric" value={sc.away}
                        onChange={e => setScore(m.id, 'away', e.target.value)}
                        style={{ width: '38px', padding: '7px 0', textAlign: 'center', borderRadius: '6px', border: '0.5px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: '14px', fontWeight: 700 }}
                      />
                      <span style={{ fontSize: '12px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m.away_team?.name || '?'}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Guardar (sticky-ish) */}
            <div style={{ marginTop: '16px' }}>
              {bot365Msg && (
                <div style={{ marginBottom: '10px', fontSize: '12px', color: bot365Msg.startsWith('Error') ? '#e74c3c' : 'var(--green)', fontWeight: 600 }}>
                  {bot365Msg}
                </div>
              )}
              <button
                onClick={saveBot365}
                disabled={bot365Saving}
                style={{
                  width: '100%', padding: '14px', borderRadius: '10px', border: 'none',
                  cursor: bot365Saving ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 700,
                  background: bot365Saving ? 'var(--bg-input)' : 'var(--green)',
                  color: bot365Saving ? 'var(--text-muted)' : '#fff', letterSpacing: '0.5px'
                }}
              >
                {bot365Saving ? 'Guardando…' : '💾 Guardar predicciones de Bot365'}
              </button>
            </div>
            </>)}
          </>
        )
      })()}
    </div>
  )
}
