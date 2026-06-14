import { useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../supabase'
import { generateMockLeaderboard } from '../hooks/useDemoMode'
import { SkeletonLeaderboard } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'
import H2HModal from '../components/H2HModal'
import { displayName, formatRealName } from '../utils/nickname'
import { FRIENDLY_TOURNAMENT_ENABLED, isFriendlyVisible } from '../config/featureFlags'
const BOT365_ID = 'b0365b03-65b0-365b-0365-b0365b036500'

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

  // ⭐ Favoritos (seguir) — experimento guardado SOLO en el navegador (localStorage),
  // sin tocar la BD. Los seguidos se fijan arriba con su posición real.
  const [following, setFollowing] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('lb_following') || '[]')) }
    catch { return new Set() }
  })
  function toggleFollow(id) {
    setFollowing(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      try { localStorage.setItem('lb_following', JSON.stringify([...next])) } catch { /* ignore */ }
      return next
    })
  }
  // La Liguilla (amistosos) ya terminó: su clasificación queda OCULTA en la app
  // (los datos se conservan en la BD / vistas, solo se retira de la UI).
  const onlyFriendly = false
  const [activeTab, setActiveTab] = useState('mundial')
  const [friendlyRankings, setFriendlyRankings] = useState([])
  const [userJoinedFriendly, setUserJoinedFriendly] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
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
    supabase.from('profiles').select('id, full_name, nickname, has_paid, payment_confirmed, admission_dismissed').then(({ data }) => {
      if (data) {
        const map = {}
        const fullNames = {}
        const paid = new Set()
        const payConfirmed = new Set()
        data.forEach(p => {
          // Nombre según el modo global (displayName del util). Hoy = real.
          const shown = displayName(p)
          map[p.id] = shown
          fullNames[p.id] = shown
          // Un usuario OCULTO (admission_dismissed) no aparece en la clasificación
          // aunque tenga has_paid=true → blindaje contra estados raros.
          if (p.has_paid && !p.admission_dismissed) paid.add(p.id)
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
      setIsAdmin(!!meProf?.is_admin)
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
      // Paginamos: en fase de grupos 3 días pueden superar las 1000 predicciones
      // (límite por defecto de Supabase) y la suma quedaría incompleta.
      let from = 0
      const size = 1000
      while (true) {
        const { data } = await supabase
          .from('predictions')
          .select('user_id, points_earned')
          .in('match_id', recentMatchIds)
          .range(from, from + size - 1)
        const batch = data || []
        preds = preds.concat(batch)
        if (batch.length < size) break
        from += size
      }
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

  // Export PDF de la clasificación — diseño con cabecera de marca, podio del
  // top 3 y tabla con estilo. Carga diferida de jsPDF. Sin importes.
  async function exportPDF() {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'), import('jspdf-autotable'),
    ])
    const isFriendly = activeTab === 'friendly'
    const played = isFriendly ? playedCounts.friendly : playedCounts.mundial
    const ACCENT = isFriendly ? [37, 99, 235] : [22, 163, 74]
    const DARK = isFriendly ? [15, 23, 42] : [13, 27, 21]
    const GOLD = [212, 175, 55], SILVER = [150, 152, 158], BRONZE = [176, 118, 64]
    const INK = [28, 31, 40], MUT = [120, 125, 135]

    const doc = new jsPDF()
    const W = doc.internal.pageSize.getWidth()
    const H = doc.internal.pageSize.getHeight()
    const M = 14
    const usableW = W - 2 * M
    const total = currentRankings.length

    const redZone = bottomRedZone(
      currentRankings,
      u => tabHasLive ? (u.effective_points ?? u.total_points ?? 0) : (u.total_points ?? 0)
    )
    const rows = currentRankings.map((u, i) => {
      const { rank, tied } = getTiedRank(i)
      const ex = tabHasLive ? (u.display_exact ?? u.exact_hits ?? 0) : (u.exact_hits || 0)
      const si = tabHasLive ? (u.display_sign ?? u.sign_hits ?? 0) : (u.sign_hits || 0)
      const pts = tabHasLive ? u.effective_points : u.total_points
      const medal = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : null
      const prize = !medal && (rank === 4 || rank === 5)   // premiados fuera del podio
      const bottom = redZone.has(u.user_id) && !medal && !prize
      return { rankLabel: tied ? `T${rank}` : `${rank}`, rank, name: u.full_name, played, ex, si, pts, medal, prize, bottom }
    })

    // ── Cabecera de marca ──
    doc.setFillColor(...DARK); doc.rect(0, 0, W, 42, 'F')
    doc.setFillColor(...ACCENT); doc.rect(0, 42, W, 1.5, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(235)
    doc.text('PORRA MUNDIAL ', M, 14)
    doc.setTextColor(...GOLD); doc.text('26', M + doc.getTextWidth('PORRA MUNDIAL '), 14)
    doc.setTextColor(255); doc.setFontSize(22)
    doc.text(isFriendly ? 'La Liguilla' : 'Clasificación', M, 30)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(185)
    doc.text(isFriendly ? 'Amistosos previos al Mundial' : 'Mundial 2026 · USA · México · Canadá', M, 37)
    doc.setFontSize(9); doc.setTextColor(205)
    const dateStr = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
    doc.text(dateStr, W - M, 30, { align: 'right' })
    doc.text(`${total} participantes`, W - M, 37, { align: 'right' })

    // Medallas (texto # ) y tintes de fila (toda la fila resaltada).
    const MEDAL = { gold: GOLD, silver: [120, 122, 128], bronze: BRONZE }
    const ROW_TINT = { gold: [250, 244, 214], silver: [236, 238, 241], bronze: [246, 236, 224] }

    // ── Tabla completa ──
    const body = rows.map(r => [r.rankLabel, r.name, r.played, r.ex, r.si, r.pts])
    autoTable(doc, {
      head: [['#', 'Participante', 'PJ', 'RE', '1X2', 'PTS']],
      body, startY: 52, theme: 'striped',
      styles: { fontSize: 9.5, cellPadding: 2.5, textColor: INK, lineColor: [232, 234, 238], lineWidth: 0.1 },
      alternateRowStyles: { fillColor: [248, 249, 251] },
      headStyles: { fillColor: ACCENT, textColor: 255, fontStyle: 'bold', halign: 'center' },
      columnStyles: {
        0: { cellWidth: 16, halign: 'center', fontStyle: 'bold' },
        1: { fontStyle: 'bold' },
        2: { cellWidth: 16, halign: 'center', textColor: MUT },
        3: { cellWidth: 16, halign: 'center' },
        4: { cellWidth: 16, halign: 'center' },
        5: { cellWidth: 20, halign: 'right', fontStyle: 'bold', textColor: ACCENT },
      },
      didParseCell: (data) => {
        if (data.section !== 'body') return
        const r = rows[data.row.index]; if (!r) return
        // Top 3 → toda la fila tintada oro/plata/bronce, # con el color medalla.
        if (r.medal) {
          data.cell.styles.fillColor = ROW_TINT[r.medal]
          if (data.column.index === 0) { data.cell.styles.textColor = MEDAL[r.medal] }
          if (data.column.index === 5) { data.cell.styles.textColor = ACCENT }
        }
        // 4º y 5º (premiados) → tinte arena muy tenue, # en dorado apagado.
        if (r.prize) {
          data.cell.styles.fillColor = [247, 243, 232]
          if (data.column.index === 0) { data.cell.styles.textColor = [154, 132, 86] }
          if (data.column.index === 5) { data.cell.styles.textColor = ACCENT }
        }
        // Descenso → toda la fila en rojo tenue, # en rojo fuerte.
        if (r.bottom) {
          data.cell.styles.fillColor = [252, 232, 232]
          if (data.column.index === 0) { data.cell.styles.textColor = [200, 35, 35] }
          if (data.column.index === 5) { data.cell.styles.textColor = ACCENT }
        }
      },
      didDrawPage: () => {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...MUT)
        doc.text('porra-mundial-2026', M, H - 8)
        doc.text(`Generado ${new Date().toLocaleString('es-ES')}`, W - M, H - 8, { align: 'right' })
      },
    })

    const today = new Date().toISOString().slice(0, 10)
    doc.save(`clasificacion-${isFriendly ? 'liguilla' : 'mundial'}-${today}.pdf`)
  }

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
          {isAdmin && !isEmpty && (
            <button
              onClick={exportPDF}
              title="Descargar clasificación en PDF"
              style={{
                marginLeft: 'auto', padding: '6px 12px', borderRadius: '8px',
                border: '1px solid var(--border)', background: 'var(--bg-secondary)',
                color: 'var(--text-muted)', fontSize: '12px', fontWeight: 700,
                cursor: 'pointer', whiteSpace: 'nowrap'
              }}
            >📄 PDF</button>
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

      {/* Tabs Mundial / La Liguilla — OCULTAS: La Liguilla terminó y ya no se
          muestra su clasificación en la app (datos conservados en BD). */}
      {false && userJoinedFriendly && !onlyFriendly && (
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
          following: activeTab === 'friendly' ? null : following,
          onToggleFollow: activeTab === 'friendly' ? null : toggleFollow,
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
// Zona roja (descenso): un participante está en rojo si hay MENOS de 3 personas
// con estrictamente menos puntos que él. Equivale a las últimas 3 POSICIONES por
// competición, pero incluyendo a TODOS los empatados del borde — no se parte un
// empate (si 5 empatan en el fondo, los 5 van en rojo; sin empates, salen 3).
function bottomRedZone(rankings, ptsOf) {
  const total = rankings.length
  if (total <= 6) return new Set()
  const allPts = rankings.map(ptsOf)
  const leaderPts = Math.max(...allPts)
  const ids = rankings.filter(u => {
    const p = ptsOf(u)
    if (p >= leaderPts) return false            // nadie con el máximo está en descenso
    return allPts.filter(v => v < p).length < 3 // <3 personas estrictamente por debajo
  })
  // Anti-degenerado: si la zona abarca a más de la mitad (todos muy empatados,
  // p.ej. inicio del torneo), no marcamos a nadie.
  if (ids.length > Math.floor(total / 2)) return new Set()
  return new Set(ids.map(u => u.user_id))
}

// Top 3 con medalla (oro/plata/bronce) · Últimos por competición con rank en rojo.
// Mundial añade: payment dot "no pagado" + onClick → H2H modal.
function renderSofaScore({
  fullRankings, currentRankings, getTiedRank,
  userId, tabHasLive, theme = 'friendly',
  playedCount = 0, paymentConfirmed, onRowClick,
  following = null, onToggleFollow = null,
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
    prize: '#9a8456',   // 4º y 5º: dorado apagado/arena, premiados pero discretos
    red: '#ef4444',
  }
  const total = fullRankings.length
  // Col # ancha para que "T115" (4 caracteres) no se pegue al nombre.
  // Mundial añade columna ESP (puntos de predicciones especiales) entre 1X2 y PTS.
  const showEsp = !isFriendly
  const canFollow = typeof onToggleFollow === 'function'
  // Estrella (seguir) = primera columna a la izquierda del todo.
  // Columnas de puntuación/ranking más estrechas → el nombre (1fr) gana ancho.
  const baseGrid = showEsp
    ? '34px 1fr 20px 22px 26px 24px 34px'
    : '34px 1fr 20px 22px 26px 34px'
  const GRID = (canFollow ? '15px ' : '') + baseGrid
  const clickable = typeof onRowClick === 'function'

  const redZone = bottomRedZone(
    fullRankings,
    u => tabHasLive ? (u.effective_points ?? u.total_points ?? 0) : (u.total_points ?? 0)
  )
  const fav = (u) => canFollow && following && following.has(u.user_id) && u.user_id !== BOT365_ID
  const followed = canFollow ? fullRankings.filter(fav) : []

  // Una fila. `pinned` = se pinta en la sección "Siguiendo" de arriba (no es la
  // posición real, solo un duplicado fijado). `last` controla el borde inferior.
  const Row = (user, { pinned = false, last = false } = {}) => {
    const isMe = user.user_id === userId
    const isFav = fav(user)
    const realIdx = currentRankings.findIndex(u => u.user_id === user.user_id)
    const { rank, tied } = getTiedRank(realIdx)
    const rankLabel = tied ? `T${rank}` : `${rank}`
    const isTop3 = rank <= 3
    const isPrize = rank === 4 || rank === 5
    const isBottom3 = !isTop3 && !isPrize && redZone.has(user.user_id)
    const rankColor = isTop3
      ? (rank === 1 ? C.gold : rank === 2 ? C.silver : C.bronze)
      : isPrize ? C.prize : isBottom3 ? C.red : 'var(--text-muted)'
    const ex = tabHasLive ? (user.display_exact ?? user.exact_hits ?? 0) : (user.exact_hits || 0)
    const si = tabHasLive ? (user.display_sign  ?? user.sign_hits  ?? 0) : (user.sign_hits  || 0)
    const esp = user.pre_tournament_points || 0
    const pj = playedCount
    const pts = tabHasLive ? user.effective_points : user.total_points
    const notPaid = !isFriendly && paymentConfirmed && !paymentConfirmed.has(user.user_id)
    const rowClickable = clickable && !isMe
    return (
      <div
        key={(pinned ? 'fav-' : '') + user.user_id}
        className={rowClickable ? 'tap-scale' : ''}
        onClick={rowClickable ? () => onRowClick(user) : undefined}
        style={{
          display: 'grid',
          gridTemplateColumns: GRID,
          gap: '2px', padding: '7px 6px',
          alignItems: 'center', minHeight: '34px',
          background: isMe ? `rgba(${C.accentBgRGB},0.12)` : 'transparent',
          borderLeft: isMe ? `3px solid ${C.accent}` : '3px solid transparent',
          borderBottom: last ? 'none' : `0.5px solid rgba(${C.accentBgRGB},0.08)`,
          fontSize: '13px',
          fontVariantNumeric: 'tabular-nums',
          cursor: rowClickable ? 'pointer' : 'default'
        }}>
        {canFollow && (
          user.user_id === BOT365_ID
            ? <span />
            : <span
                onClick={(e) => { e.stopPropagation(); onToggleFollow(user.user_id) }}
                role="button"
                aria-label={isFav ? 'Dejar de seguir' : 'Seguir'}
                title={isFav ? 'Dejar de seguir' : 'Seguir'}
                style={{
                  textAlign: 'center', cursor: 'pointer', fontSize: '13px', lineHeight: 1,
                  color: isFav ? '#ffcc00' : 'var(--text-dim)',
                  userSelect: 'none', padding: 0, marginLeft: '-2px'
                }}
              >{isFav ? '★' : '☆'}</span>
        )}
        <span style={{ fontWeight: 800, color: rankColor, textAlign: 'center', fontSize: '13px' }}>{rankLabel}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
          <span style={{
            color: isMe ? C.accentLight : 'var(--text-primary)', fontWeight: isMe ? 700 : 500,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0
          }}>{user.full_name}</span>
          {notPaid && (
            <span title="No pagado" style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#c2362b', flexShrink: 0 }} />
          )}
        </span>
        <span className={tabHasLive ? 'live-points' : ''}
          style={{ color: tabHasLive ? 'var(--red)' : 'var(--text-muted)', textAlign: 'center', fontSize: '13px', fontWeight: tabHasLive ? 700 : 400 }}>{pj}</span>
        <span className={tabHasLive ? 'live-points' : ''}
          style={{ color: tabHasLive ? 'var(--red)' : 'var(--text-muted)', textAlign: 'center', fontSize: '13px', fontWeight: tabHasLive ? 700 : 400 }}>{ex}</span>
        <span className={tabHasLive ? 'live-points' : ''}
          style={{ color: tabHasLive ? 'var(--red)' : 'var(--text-muted)', textAlign: 'center', fontSize: '13px', fontWeight: tabHasLive ? 700 : 400 }}>{si}</span>
        {showEsp && (
          <span className={tabHasLive ? 'live-points' : ''}
            style={{ color: tabHasLive ? 'var(--red)' : 'var(--text-muted)', textAlign: 'center', fontSize: '13px', fontWeight: tabHasLive ? 700 : 400 }}>{esp}</span>
        )}
        <span className={tabHasLive ? 'live-points' : ''}
          style={{ textAlign: 'right', fontWeight: 800, color: tabHasLive ? 'var(--red)' : (isMe ? C.accentLight : 'var(--text-primary)'), fontSize: '13px' }}>{pts}</span>
      </div>
    )
  }

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
        gap: '2px', padding: '6px 6px',
        fontSize: '9px', fontWeight: '800',
        color: C.accentLight, textTransform: 'uppercase', letterSpacing: '0.6px',
        background: `rgba(${C.accentBgRGB},0.10)`,
        borderBottom: `1px solid rgba(${C.accentBgRGB},0.20)`
      }}>
        {canFollow && <span />}
        <span style={{ textAlign: 'center' }}>#</span>
        <span>Participante</span>
        <span title="Partidos jugados" style={{ textAlign: 'center' }}>PJ</span>
        <span title="Resultado exacto · 3 pts" style={{ textAlign: 'center' }}>RE</span>
        <span title="Signo 1X2 · 1 pt" style={{ textAlign: 'center' }}>1X2</span>
        {showEsp && <span title="Puntos de predicciones especiales" style={{ textAlign: 'center' }}>ESP</span>}
        <span title="Puntos totales" style={{ textAlign: 'right' }}>PTS</span>
      </div>

      {/* Sección fijada "Siguiendo" — duplica a los favoritos arriba; SIGUEN también
          en su posición real más abajo. */}
      {followed.length > 0 && (
        <>
          <div style={{
            padding: '5px 10px', fontSize: '9px', fontWeight: '800',
            color: '#ffcc00', textTransform: 'uppercase', letterSpacing: '0.8px',
            background: 'rgba(255,204,0,0.06)'
          }}>★ Siguiendo</div>
          {followed.map((u, i) => Row(u, { pinned: true, last: i === followed.length - 1 }))}
          <div style={{ height: '2px', background: 'rgba(255,204,0,0.25)' }} />
        </>
      )}

      {fullRankings.map((u, idx) => Row(u, { last: idx === total - 1 }))}
    </div>
  )
}
