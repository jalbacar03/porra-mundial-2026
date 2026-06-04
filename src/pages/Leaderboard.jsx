import { useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../supabase'
import { generateMockLeaderboard } from '../hooks/useDemoMode'
import { SkeletonLeaderboard } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'
import H2HModal from '../components/H2HModal'
import { displayName } from '../utils/nickname'
import { FRIENDLY_TOURNAMENT_ENABLED, isFriendlyVisible } from '../config/featureFlags'
const BOT365_ID = 'b0365b03-65b0-365b-0365-b0365b036500'

// Formato "Nombre Apellido" — primera palabra real (no prep/inicial) + segunda
// palabra real, ambas con Title Case. Ejemplos:
//   "javi albácar"                       → "Javi Albácar"
//   "Pedro J. Albácar"                   → "Pedro Albácar" (salta inicial)
//   "Gonzalo de Parellada Menéndez"      → "Gonzalo Parellada" (salta "de" y 2º apellido)
//   "Álvaro García-Valdecasas"           → "Álvaro García-Valdecasas" (1 apellido compuesto OK)
//   "José Antonio Menéndez"              → "José Antonio" (compromiso: trata 2ª palabra como apellido)
// Overrides manuales para nombres que el algoritmo no resuelve bien
// (nombres compuestos, preposiciones que SÍ van, etc). Key = full_name exacto.
const NAME_OVERRIDES = {
  'José Antonio Menéndez': 'José Menéndez',
  'Gonzalo de Parellada Menéndez': 'Gonzalo de Parellada',
  'Jose Maria Guitart': 'Jose María Guitart',
  'Álvaro García Magro': 'Álvaro García M.',
}

function formatRealName(fullName) {
  if (!fullName) return ''
  if (NAME_OVERRIDES[fullName]) return NAME_OVERRIDES[fullName]
  const PREPS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'da', 'do', 'di'])
  const isInitial = (w) => /^[a-záéíóúñ]\.?$/i.test(w)
  const titleCase = (w) => {
    if (!w) return w
    // Mantiene capitalización por segmento separado por guión: "García-Valdecasas"
    return w.split('-').map(seg =>
      seg ? seg[0].toUpperCase() + seg.slice(1).toLowerCase() : seg
    ).join('-')
  }
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  const real = parts.filter(p => !PREPS.has(p.toLowerCase()) && !isInitial(p))
  if (real.length === 0) return titleCase(parts[0])
  if (real.length === 1) return titleCase(real[0])
  return `${titleCase(real[0])} ${titleCase(real[1])}`
}


export default function Leaderboard({ demoMode }) {
  const [rankings, setRankings] = useState([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState(null)
  const [profileNames, setProfileNames] = useState({})
  const [positionChanges, setPositionChanges] = useState({})
  const [h2hRival, setH2hRival] = useState(null)
  const [liveMatches, setLiveMatches] = useState([])
  // Provisional por scope, calculado server-side (RPC SECURITY DEFINER) para
  // que TODOS los usuarios vean el provisional de TODOS (el RLS de predictions
  // impediría calcularlo en cliente para filas ajenas).
  const [liveProvisional, setLiveProvisional] = useState({ friendly: {}, mundial: {} })

  const mockRankings = useMemo(() => {
    if (!demoMode || !userId) return []
    return generateMockLeaderboard(userId)
  }, [demoMode, userId])

  const [paidUsers, setPaidUsers] = useState(new Set())
  const [profileFullNames, setProfileFullNames] = useState({})
  const [paymentConfirmed, setPaymentConfirmed] = useState(new Set())
  const [searchParams] = useSearchParams()
  // ?only=friendly → modo "solo Liguilla": tab activa friendly + tab bar oculta.
  const onlyFriendly = searchParams.get('only') === 'friendly'
  const [activeTab, setActiveTab] = useState(onlyFriendly ? 'friendly' : 'mundial')
  const [friendlyRankings, setFriendlyRankings] = useState([])
  const [userJoinedFriendly, setUserJoinedFriendly] = useState(false)
  // PJ = partidos JUGADOS (empezados o terminados), contador global por stage.
  // No es "predichos": cuando arranque España-Irak, friendly pasa a 1.
  const [playedCounts, setPlayedCounts] = useState({ friendly: 0, mundial: 0 })
  // (Antes había friendlyDetail/mundialDetail computados client-side, pero el
  // RLS en `predictions` bloqueaba ver picks ajenos → solo aparecía la fila
  // propia con PJ correcto. Ahora usamos los agregados que ya devuelven las
  // vistas leaderboard / leaderboard_friendly — esas corren como SECURITY
  // DEFINER y sí ven todo.)

  useEffect(() => {
    fetchData()
    supabase.from('profiles').select('id, full_name, nickname, has_paid, payment_confirmed').then(({ data }) => {
      if (data) {
        const map = {}
        const fullNames = {}
        const paid = new Set()
        const payConfirmed = new Set()
        data.forEach(p => {
          // Probando "nombre real" en la clasificación — formato "Nombre Apellido"
          // (1 nombre + 1 apellido, Title Case). Si full_name falta, fallback al
          // displayName (nickname) para no romper la fila.
          const real = formatRealName(p.full_name) || displayName(p)
          map[p.id] = real
          fullNames[p.id] = real
          if (p.has_paid) paid.add(p.id)
          if (p.payment_confirmed) payConfirmed.add(p.id)
        })
        setProfileNames(map)
        setProfileFullNames(fullNames)
        setPaidUsers(paid)
        setPaymentConfirmed(payConfirmed)
      }
    })
  }, [])

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) setUserId(user.id)

    const [lbRes, liveRes] = await Promise.all([
      supabase.from('leaderboard').select('*'),
      supabase.from('matches').select('id, home_score, away_score, status, stage').eq('status', 'live')
    ])

    if (!lbRes.error && lbRes.data) {
      setRankings(lbRes.data)
      await computePositionChanges(lbRes.data)
    }

    const liveData = liveRes.data || []
    setLiveMatches(liveData)

    // PJ global por stage: partidos que ya han empezado (live o finished).
    const { data: playedRows } = await supabase
      .from('matches')
      .select('stage, status')
      .in('status', ['live', 'finished'])
    const pc = { friendly: 0, mundial: 0 }
    ;(playedRows || []).forEach(m => {
      if (m.stage === 'friendly') pc.friendly++
      else if (m.stage !== 'test') pc.mundial++
    })
    setPlayedCounts(pc)

    // Provisional server-side: 1 RPC que ve todas las predicciones y devuelve
    // el total provisional por usuario y scope (friendly/mundial). Sortea el
    // RLS sin exponer picks individuales.
    if (liveData.length > 0) {
      const { data: provRows } = await supabase.rpc('live_provisional_points')
      const friendly = {}
      const mundial = {}
      ;(provRows || []).forEach(r => {
        const target = r.scope === 'friendly' ? friendly : mundial
        target[r.user_id] = {
          exact: r.prov_exact || 0,
          sign: r.prov_sign || 0,
          points: r.provisional || 0,
        }
      })
      setLiveProvisional({ friendly, mundial })
    } else {
      setLiveProvisional({ friendly: {}, mundial: {} })
    }

    // Pre-Mundial leaderboard (feature-flagged + admin-only durante prueba)
    // Visible para: (a) usuarios inscritos a La Liguilla, o
    //               (b) cualquier usuario pagado una vez pasado el deadline
    //                   de inscripción (modo espectador — pueden seguir el
    //                   torneo aunque no se apuntaron).
    if (FRIENDLY_TOURNAMENT_ENABLED) {
      const meProf = user
        ? (await supabase.from('profiles').select('friendly_joined, payment_confirmed, is_admin').eq('id', user.id).single()).data
        : null
      if (isFriendlyVisible(meProf)) {
        const { data: flb } = await supabase.from('leaderboard_friendly').select('*')
        if (flb) setFriendlyRankings(flb)
        const deadlinePassed = new Date() >= new Date('2026-06-04T18:50:00Z') // 20:50 hora España
        const canSeeSpectator = deadlinePassed && meProf?.payment_confirmed
        if (meProf?.friendly_joined || canSeeSpectator) setUserJoinedFriendly(true)
      }
    }

    setLoading(false)
  }

  async function computePositionChanges(currentRankings) {
    const twoDaysAgo = new Date()
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
    const cutoff = twoDaysAgo.toISOString()

    // Position changes solo se calculan con partidos del MUNDIAL real
    // (excluye friendlies). Sin esto, el día que termine España-Irak los
    // "▲ N posiciones" del leaderboard del Mundial reflejarían cambios
    // que no son del Mundial.
    const [matchesRes, preTournamentRes] = await Promise.all([
      supabase.from('matches').select('id').eq('status', 'finished').gte('match_date', cutoff).not('stage', 'in', '("friendly","test")'),
      supabase.from('pre_tournament_entries').select('user_id, points_awarded').eq('is_resolved', true).gte('updated_at', cutoff)
    ])

    const recentMatchIds = (matchesRes?.data || []).map(m => m.id)

    let preds = []
    if (recentMatchIds.length > 0) {
      const { data } = await supabase
        .from('predictions')
        .select('user_id, points_earned')
        .in('match_id', recentMatchIds)
      preds = data || []
    }

    const recentPoints = {}
    preds.forEach(p => {
      recentPoints[p.user_id] = (recentPoints[p.user_id] || 0) + (p.points_earned || 0)
    })
    ;(preTournamentRes?.data || []).forEach(e => {
      recentPoints[e.user_id] = (recentPoints[e.user_id] || 0) + (e.points_awarded || 0)
    })

    const current = currentRankings
      .filter(r => r.user_id !== BOT365_ID)
      .sort((a, b) => b.total_points - a.total_points || (b.exact_hits || 0) - (a.exact_hits || 0))

    const past = current.map(r => ({
      ...r,
      total_points: r.total_points - (recentPoints[r.user_id] || 0)
    })).sort((a, b) => b.total_points - a.total_points || (b.exact_hits || 0) - (a.exact_hits || 0))

    const currentRank = {}
    const pastRank = {}
    current.forEach((r, i) => { currentRank[r.user_id] = i + 1 })
    past.forEach((r, i) => { pastRank[r.user_id] = i + 1 })

    const changes = {}
    Object.keys(currentRank).forEach(uid => {
      const delta = (pastRank[uid] || currentRank[uid]) - currentRank[uid]
      if (delta !== 0) changes[uid] = delta
    })

    setPositionChanges(changes)
  }

  // Provisional points SEPARADOS por stage — ya calculados server-side por la
  // RPC live_provisional_points (ve todas las predicciones, sortea el RLS).
  // La tab Mundial usa scope 'mundial'; la tab Liguilla usa scope 'friendly'.
  const provisionalByStage = liveProvisional

  // Stages live separados — para que el badge "LIVE" en el header de cada tab
  // solo aparezca cuando hay un partido EN VIVO de esa tab concreta.
  const hasLiveMundial = liveMatches.some(m => m.stage !== 'friendly' && m.stage !== 'test')
  const hasLiveFriendly = liveMatches.some(m => m.stage === 'friendly')

  // Auto-refresh every 30s when there are live matches (fallback in case Realtime drops)
  useEffect(() => {
    if (!hasLiveMundial && !hasLiveFriendly) return
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [hasLiveMundial, hasLiveFriendly])

  // Realtime push: when ANY match row changes (score, status), refetch immediately
  useEffect(() => {
    const channel = supabase
      .channel('lb-matches-realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches' }, () => {
        fetchData()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  if (loading) {
    return (
      <div style={{ padding: '16px' }}>
        <SkeletonLeaderboard rows={10} />
      </div>
    )
  }

  const medals = [
    'linear-gradient(135deg, #ffd700, #b8860b)',
    'linear-gradient(135deg, #c0c0c0, #808080)',
    'linear-gradient(135deg, #cd7f32, #8b4513)'
  ]

  // Source data depende de la tab. friendly leaderboard ya viene filtrado por
  // friendly_joined desde la vista; solo aplicamos display name.
  const sourceRankings = activeTab === 'friendly' ? friendlyRankings : rankings
  const allRankings = demoMode ? mockRankings :
    sourceRankings
      .filter(r => activeTab === 'friendly' ? true : (r.user_id === BOT365_ID || paidUsers.has(r.user_id)))
      .map(r => {
        // Provisional según la tab activa — objeto {exact, sign, points} que
        // separa friendly/mundial. Vacío si el usuario no puntúa en vivo.
        const prov = (activeTab === 'friendly' ? provisionalByStage.friendly : provisionalByStage.mundial)[r.user_id]
          || { exact: 0, sign: 0, points: 0 }
        return {
          ...r,
          full_name: profileNames[r.user_id] || r.full_name || 'Participante',
          provisional: prov.points,
          prov_exact: prov.exact,
          prov_sign: prov.sign,
          // ex/si mostrados = finished (vista) + provisional (live)
          display_exact: (r.exact_hits || 0) + prov.exact,
          display_sign:  (r.sign_hits  || 0) + prov.sign,
          effective_points: (r.total_points || 0) + prov.points,
        }
      })
      // Always sort points desc, then exact hits desc (the tiebreaker), so the
      // visible order matches both the rules and the 🎯 exactos shown per row —
      // independent of whatever order the leaderboard view returns.
      .sort((a, b) => (b.total_points || 0) - (a.total_points || 0) || (b.exact_hits || 0) - (a.exact_hits || 0))

  // Re-sort by effective points when live (provisional points in play)
  // Resort por effective_points solo si hay live de la tab actual (si hay
  // friendly live pero estoy en tab mundial, no resorting).
  const tabHasLive = activeTab === 'friendly' ? hasLiveFriendly : hasLiveMundial
  if (tabHasLive && !demoMode) {
    allRankings.sort((a, b) =>
      b.effective_points - a.effective_points || (b.display_exact || 0) - (a.display_exact || 0)
    )
  }

  // Feature flag: temporarily hide Bot365 from the public UI. Data stays in
  // the database, predictions keep loading, the leaderboard view keeps
  // including it — only the visible row is suppressed. Flip to `true` to
  // bring the "Referencia · Casas de apuestas" row back without redeploys
  // beyond this file.
  const SHOW_BOT365 = false

  const bot365Entry = SHOW_BOT365 ? allRankings.find(u => u.user_id === BOT365_ID) : null
  const currentRankings = allRankings.filter(u => u.user_id !== BOT365_ID)
  const isEmpty = currentRankings.length === 0

  function getTiedRank(index) {
    const getPts = (r) => tabHasLive ? r.effective_points : r.total_points
    // Desempate: en vivo usa exactos provisionales incluidos (display_exact).
    const getEx  = (r) => tabHasLive ? (r.display_exact ?? r.exact_hits ?? 0) : (r.exact_hits || 0)
    const pts = getPts(currentRankings[index])
    const exactHits = getEx(currentRankings[index])
    // Walk back to the first row sharing this pts+exactHits → that's the rank.
    let firstWithSame = index
    while (firstWithSame > 0 &&
      getPts(currentRankings[firstWithSame - 1]) === pts &&
      getEx(currentRankings[firstWithSame - 1]) === exactHits) {
      firstWithSame--
    }
    const rank = firstWithSame + 1
    // Tied if ANY neighbour (before OR after) shares the same pts+exactHits.
    // Applies uniformly to every position — including 1st — so all members
    // of a tie get the "T" prefix (T1, T1, T1), not just the ones after the
    // first.
    const tiedWithPrev = firstWithSame < index
    const tiedWithNext = index + 1 < currentRankings.length &&
      getPts(currentRankings[index + 1]) === pts &&
      getEx(currentRankings[index + 1]) === exactHits
    const tied = tiedWithPrev || tiedWithNext
    return { rank, tied }
  }

  const bot365InsertAfter = bot365Entry
    ? currentRankings.filter(u => u.effective_points > bot365Entry.effective_points).length
    : -1

  // Build a unified ranking list including Bot365 inline (no separator)
  const fullRankings = bot365Entry
    ? [
        ...currentRankings.slice(0, bot365InsertAfter),
        { ...bot365Entry, isBot: true },
        ...currentRankings.slice(bot365InsertAfter)
      ]
    : currentRankings
  const maxPts = Math.max(...fullRankings.map(u => tabHasLive ? u.effective_points : u.total_points), 1)
  const firstLetter = (name) => ((name || '?')[0] || '?').toUpperCase()

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '16px', minHeight: '100svh' }}>

      {/* Header — título dinámico: si estoy en tab Liguilla (o modo onlyFriendly)
          el título refleja que solo se ve la clasificación de La Liguilla. */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h2 style={{
            fontSize: '28px', fontWeight: '800',
            color: activeTab === 'friendly' ? '#60a5fa' : 'var(--text-primary)',
            margin: 0, letterSpacing: '-0.5px'
          }}>
            {activeTab === 'friendly' ? 'Liguilla' : 'Clasificación'}
          </h2>
          {((activeTab === 'mundial' && hasLiveMundial) || (activeTab === 'friendly' && hasLiveFriendly)) && (
            <span className="live-pulse" style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              padding: '3px 9px', borderRadius: '20px',
              background: 'rgba(226,75,74,0.15)', border: '1px solid rgba(226,75,74,0.3)',
              fontSize: '10px', fontWeight: '700', color: 'var(--red)',
              textTransform: 'uppercase', letterSpacing: '1px'
            }}>
              <span className="live-dot" /> LIVE
            </span>
          )}
        </div>
        {activeTab === 'friendly' && (
          <div style={{
            fontSize: '12px', fontWeight: '600',
            color: 'var(--text-muted)', marginTop: '4px',
            letterSpacing: '0.2px'
          }}>
            Amistosos previos al Mundial · 12 partidos
          </div>
        )}
      </div>

      {/* Tabs Mundial / Pre-Mundial — ocultas en modo onlyFriendly (entrada
          directa desde /pre-mundial → Clasificación). Indicador azul para la
          tab Liguilla, verde para Mundial — refuerza la separación visual. */}
      {userJoinedFriendly && !onlyFriendly && (
        <div style={{
          display: 'flex', gap: '6px', marginBottom: '14px',
          padding: '4px', borderRadius: '10px',
          background: 'var(--bg-secondary)'
        }}>
          {[
            { key: 'mundial',  label: 'Mundial',     accent: 'var(--green)' },
            { key: 'friendly', label: 'La Liguilla', accent: '#2563eb' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              style={{
                flex: 1, padding: '8px 12px', borderRadius: '8px',
                border: 'none', cursor: 'pointer',
                background: activeTab === t.key ? t.accent : 'transparent',
                color: activeTab === t.key ? '#fff' : 'var(--text-muted)',
                fontSize: '12px', fontWeight: '700',
                letterSpacing: '0.4px',
                transition: 'background 0.15s ease, color 0.15s ease'
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {isEmpty ? (
        <EmptyState
          icon="🏆"
          title="Sin clasificación aún"
          subtitle="Se rellenará cuando empiecen los partidos del Mundial."
        />
      ) : (
        // Mismo render compacto SofaScore para ambas tabs — solo cambia el
        // theme (azul Liguilla / verde Mundial), el detail (friendlyDetail /
        // mundialDetail) y los extras (payment dot + H2H click solo Mundial).
        renderSofaScore({
          fullRankings, currentRankings, getTiedRank,
          userId, tabHasLive,
          theme: activeTab === 'friendly' ? 'friendly' : 'mundial',
          playedCount: activeTab === 'friendly' ? playedCounts.friendly : playedCounts.mundial,
          paymentConfirmed: activeTab === 'friendly' ? null : paymentConfirmed,
          onRowClick: activeTab === 'friendly'
            ? null
            : (user) => setH2hRival({ id: user.user_id, name: user.full_name }),
        })
      )}

      {/* H2H Modal */}
      {h2hRival && (
        <H2HModal
          userId={userId}
          rivalId={h2hRival.id}
          rivalName={h2hRival.name}
          onClose={() => setH2hRival(null)}
        />
      )}
    </div>
  )
}

// Recorta nombres largos para que quepan sin truncar bruscamente con "...".
// Reglas:
//  - "Pedro J Albacar" (3+ palabras, > maxLen) → "Pedro J. Albacar" cortado a inicial intermedia
//  - "Gonzalo de Parellada" (3 palabras larga) → "Gonzalo Parellada" o inicial 2º apellido
//  - "gonzalo.deparellada" (1 token largo) → recorta tras un punto si lo hay
//  - Fallback: ellipsis al final.
function compactName(name, maxLen = 18) {
  if (!name) return ''
  if (name.length <= maxLen) return name
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    // Estrategia 1: inicial al último apellido. "Gonzalo de Parellada" → "Gonzalo de P."
    const first = parts.slice(0, parts.length - 1).join(' ')
    const candidate = `${first} ${parts[parts.length - 1][0]}.`
    if (candidate.length <= maxLen) return candidate
    // Estrategia 2: solo primer nombre
    if (parts[0].length <= maxLen) return parts[0]
    return parts[0].slice(0, maxLen - 1) + '…'
  }
  // 1 token con puntos (handles tipo "gonzalo.deparellada")
  if (name.includes('.')) {
    const segs = name.split('.')
    const first = segs[0]
    if (first.length <= maxLen - 2) return `${first}.${segs[1][0]}.`
    return first.slice(0, maxLen - 1) + '…'
  }
  return name.slice(0, maxLen - 1) + '…'
}

// ─── Vista SofaScore-style — unificada Mundial + Liguilla ────────────────
// Tabla compacta: #, NICK, PJ, 3·(exactos), 1·(signos), PTS.
// theme='friendly' → paleta azul · theme='mundial' → paleta verde.
// Top 3 con medalla (oro/plata/bronce) · Últimos 3 con rank en rojo.
// Mundial añade: payment dot "no pagado" + onClick → H2H modal.
function renderSofaScore({
  fullRankings, currentRankings, getTiedRank,
  userId, tabHasLive, theme = 'friendly',
  playedCount = 0, paymentConfirmed, onRowClick,
}) {
  const isFriendly = theme === 'friendly'
  // Paleta — accent cambia con el theme; 3·/1· mantienen siempre azul/verde
  // (consistente con el código de color de los puntos: azul=exacto, verde=signo)
  const C = {
    accent:      isFriendly ? '#2563eb' : '#16a34a',
    accentLight: isFriendly ? '#60a5fa' : '#4ade80',
    accentBgRGB: isFriendly ? '37,99,235' : '22,163,74',
    blue: '#2563eb',
    green: '#4ade80',
    gold: '#ffd700',
    silver: '#c0c0c0',
    bronze: '#cd7f32',
    red: '#ef4444',
  }
  const total = fullRankings.length
  const GRID = '20px 1fr 22px 22px 22px 36px'
  const clickable = typeof onRowClick === 'function'
  return (
    <div style={{
      background: 'var(--bg-secondary)',
      borderRadius: '8px',
      overflow: 'hidden',
      border: `1px solid rgba(${C.accentBgRGB},0.18)`
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: GRID,
        gap: '3px', padding: '6px 8px',
        fontSize: '9px', fontWeight: '800',
        color: C.accentLight, textTransform: 'uppercase', letterSpacing: '0.6px',
        background: `rgba(${C.accentBgRGB},0.10)`,
        borderBottom: `1px solid rgba(${C.accentBgRGB},0.20)`
      }}>
        <span>#</span>
        <span>Participante</span>
        <span title="Partidos jugados" style={{ textAlign: 'center', color: 'var(--text-dim)' }}>PJ</span>
        <span title="Exactos (3pt)" style={{ textAlign: 'center', color: C.blue }}>3·</span>
        <span title="Signos (1pt)" style={{ textAlign: 'center', color: C.green }}>1·</span>
        <span title="Puntos totales" style={{ textAlign: 'right' }}>PTS</span>
      </div>
      {fullRankings.map((user, idx) => {
        const isMe = user.user_id === userId
        const realIdx = currentRankings.findIndex(u => u.user_id === user.user_id)
        const { rank, tied } = getTiedRank(realIdx)
        const rankLabel = tied ? `T${rank}` : `${rank}`
        const isTop3 = rank <= 3
        const isBottom3 = idx >= total - 3 && total > 6
        const rankColor = isTop3
          ? (rank === 1 ? C.gold : rank === 2 ? C.silver : C.bronze)
          : isBottom3
            ? C.red
            : 'var(--text-muted)'
        // En vivo: ex/si muestran finished + provisional (display_*). Sin live:
        // solo los de la vista. PJ = partidos jugados (global del stage).
        const ex = tabHasLive ? (user.display_exact ?? user.exact_hits ?? 0) : (user.exact_hits || 0)
        const si = tabHasLive ? (user.display_sign  ?? user.sign_hits  ?? 0) : (user.sign_hits  || 0)
        const pj = playedCount
        const pts = tabHasLive ? user.effective_points : user.total_points
        const isLast = idx === total - 1
        const notPaid = !isFriendly && paymentConfirmed && !paymentConfirmed.has(user.user_id)
        const rowClickable = clickable && !isMe
        return (
          <div
            key={user.user_id}
            className={rowClickable ? 'tap-scale' : ''}
            onClick={rowClickable ? () => onRowClick(user) : undefined}
            style={{
              display: 'grid',
              gridTemplateColumns: GRID,
              gap: '3px', padding: '7px 8px',
              alignItems: 'center', minHeight: '34px',
              background: isMe ? `rgba(${C.accentBgRGB},0.12)` : 'transparent',
              borderLeft: isMe ? `3px solid ${C.accent}` : '3px solid transparent',
              borderBottom: isLast ? 'none' : `0.5px solid rgba(${C.accentBgRGB},0.08)`,
              fontSize: '13px',
              fontVariantNumeric: 'tabular-nums',
              cursor: rowClickable ? 'pointer' : 'default'
            }}>
            <span style={{ fontWeight: 800, color: rankColor, textAlign: 'center', fontSize: '12px' }}>{rankLabel}</span>
            <span style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              minWidth: 0
            }}>
              <span style={{
                color: isMe ? C.accentLight : 'var(--text-primary)', fontWeight: isMe ? 700 : 500,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                minWidth: 0
              }}>{compactName(user.full_name)}</span>
              {notPaid && (
                <span
                  title="No pagado"
                  style={{
                    width: '6px', height: '6px', borderRadius: '50%',
                    background: '#c2362b', flexShrink: 0
                  }}
                />
              )}
            </span>
            <span
              className={tabHasLive ? 'live-points' : ''}
              style={{ color: tabHasLive ? 'var(--red)' : 'var(--text-muted)', textAlign: 'center', fontSize: '12px', fontWeight: tabHasLive ? 700 : 400 }}
            >{pj}</span>
            <span
              className={tabHasLive ? 'live-points' : ''}
              style={{ color: tabHasLive ? 'var(--red)' : (ex > 0 ? C.blue : 'var(--text-dim)'), textAlign: 'center', fontWeight: 700 }}
            >{ex}</span>
            <span
              className={tabHasLive ? 'live-points' : ''}
              style={{ color: tabHasLive ? 'var(--red)' : (si > 0 ? C.green : 'var(--text-dim)'), textAlign: 'center', fontWeight: 700 }}
            >{si}</span>
            <span
              className={tabHasLive ? 'live-points' : ''}
              style={{
                textAlign: 'right', fontWeight: 800,
                color: tabHasLive ? 'var(--red)' : (isMe ? C.accentLight : 'var(--text-primary)'),
                fontSize: '14px'
              }}
            >{pts}</span>
          </div>
        )
      })}
    </div>
  )
}
