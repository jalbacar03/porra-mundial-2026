import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { FootballSpinner } from '../components/Skeleton'
import { useToast } from '../components/Toast'
import { FRIENDLY_TOURNAMENT_ENABLED, isFriendlyVisible } from '../config/featureFlags'
import ScorePicker from '../components/predictions/ScorePicker'

/**
 * La Liguilla — mini-torneo opcional con los 12 amistosos del 4-9 jun.
 *
 * Mismo look&feel que GroupMatchPredictions (Mundial) pero con tonos azules
 * para diferenciarlo visualmente. Save batch con toast feedback (no
 * auto-save silencioso). Botón "Volver" arriba para salir a la app normal.
 *
 * Visible si:
 *   - FRIENDLY_TOURNAMENT_ENABLED && (no admin-only || is_admin)
 *   - payment_confirmed = true (si no, ven la página pero les sale "Falta pago")
 */

// Paleta La Liguilla — azul + dorado en lugar de verde + dorado
const LIGUILLA = {
  primary:    '#2563eb',           // azul ación
  primaryDim: 'rgba(37,99,235,0.15)',
  borderSoft: 'rgba(37,99,235,0.25)',
  gold:       '#ffcc00',
  green:      '#4ade80',
  red:        '#ff6b6b',
}

// Deadline global de La Liguilla: jueves 4 jun 20:30 hora España = 18:30 UTC.
// Después de esto: no se puede inscribir, no se puede predecir, no se puede editar.
export const LIGUILLA_DEADLINE = new Date('2026-06-04T18:30:00Z') // 20:30 hora España, 30 min antes del kickoff

export default function PreMundial({ session }) {
  const navigate = useNavigate()
  const toast = useToast()
  const [profile, setProfile] = useState(null)
  const [matches, setMatches] = useState([])
  const [predictions, setPredictions] = useState({})        // matchId → { home_score, away_score }
  const [savedPredictions, setSavedPredictions] = useState({})  // mirror DB
  const [editingIds, setEditingIds] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    if (!FRIENDLY_TOURNAMENT_ENABLED) return
    fetchData()
  }, [])

  async function fetchData() {
    const [profRes, mRes, pRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, nickname, has_paid, payment_confirmed, friendly_joined, is_admin').eq('id', session.user.id).single(),
      supabase.from('matches')
        .select('*, home_team:teams!matches_home_team_id_fkey(id,name,flag_url,code), away_team:teams!matches_away_team_id_fkey(id,name,flag_url,code)')
        .eq('stage', 'friendly')
        .order('match_date', { ascending: true }),
      supabase.from('predictions').select('*').eq('user_id', session.user.id),
    ])
    if (profRes.data) setProfile(profRes.data)
    if (mRes.data) setMatches(mRes.data)
    if (pRes.data) {
      const m = {}
      const s = {}
      pRes.data.forEach(p => {
        const entry = { home_score: p.predicted_home, away_score: p.predicted_away }
        m[p.match_id] = entry
        if (p.predicted_home != null && p.predicted_away != null) {
          s[p.match_id] = entry
        }
      })
      setPredictions(m)
      setSavedPredictions(s)
    }
    setLoading(false)
  }

  async function handleJoin() {
    if (new Date() >= LIGUILLA_DEADLINE) {
      toast.error('La inscripción a La Liguilla está cerrada.')
      return
    }
    setJoining(true)
    const { error } = await supabase
      .from('profiles')
      .update({ friendly_joined: true })
      .eq('id', session.user.id)
    if (error) {
      toast.error('No se ha podido apuntar: ' + error.message)
    } else {
      setProfile(p => ({ ...p, friendly_joined: true }))
      toast.success('Apuntado. Predice antes del primer partido.')
    }
    setJoining(false)
  }

  function setScore(matchId, side, value) {
    setPredictions(prev => ({
      ...prev,
      [matchId]: {
        home_score: side === 'home' ? value : (prev[matchId]?.home_score ?? ''),
        away_score: side === 'away' ? value : (prev[matchId]?.away_score ?? ''),
      },
    }))
  }

  function startEditing(matchId) {
    setEditingIds(prev => new Set(prev).add(matchId))
  }

  function isEditing(matchId) {
    return editingIds.has(matchId)
  }

  async function saveAll() {
    if (new Date() >= LIGUILLA_DEADLINE) {
      toast.error('La Liguilla está cerrada. No se pueden cambiar predicciones.')
      return
    }
    setSaving(true)
    try {
      const toSave = []
      for (const m of matches) {
        const p = predictions[m.id]
        if (p && p.home_score !== '' && p.home_score != null
            && p.away_score !== '' && p.away_score != null) {
          // Solo guardar si cambió respecto al saved
          const saved = savedPredictions[m.id]
          if (!saved || saved.home_score !== p.home_score || saved.away_score !== p.away_score) {
            toSave.push({
              user_id: session.user.id,
              match_id: m.id,
              predicted_home: parseInt(p.home_score),
              predicted_away: parseInt(p.away_score),
            })
          }
        }
      }
      if (toSave.length === 0) {
        toast.info('Nada nuevo que guardar')
        return
      }
      const { error } = await supabase
        .from('predictions')
        .upsert(toSave, { onConflict: 'user_id,match_id' })
      if (error) {
        toast.error('Error al guardar: ' + error.message)
        return
      }
      const next = { ...savedPredictions }
      toSave.forEach(p => {
        next[p.match_id] = { home_score: p.predicted_home, away_score: p.predicted_away }
      })
      setSavedPredictions(next)
      setEditingIds(prev => {
        const n = new Set(prev)
        toSave.forEach(p => n.delete(p.match_id))
        return n
      })
      toast.success(`${toSave.length} predicción${toSave.length !== 1 ? 'es' : ''} guardada${toSave.length !== 1 ? 's' : ''}`)
    } catch (err) {
      console.error('Save error:', err)
      toast.error('Error inesperado al guardar')
    } finally {
      setSaving(false)
    }
  }

  const filledCount = useMemo(() => {
    return matches.filter(m => {
      const s = savedPredictions[m.id]
      return s && s.home_score != null && s.away_score != null
    }).length
  }, [matches, savedPredictions])

  const unsavedCount = useMemo(() => {
    return matches.filter(m => {
      const p = predictions[m.id]
      const s = savedPredictions[m.id]
      if (!p || p.home_score === '' || p.home_score == null || p.away_score === '' || p.away_score == null) return false
      return !s || s.home_score !== p.home_score || s.away_score !== p.away_score
    }).length
  }, [matches, predictions, savedPredictions])

  // ── Guard: feature flag off
  if (!FRIENDLY_TOURNAMENT_ENABLED) {
    return <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>Página no disponible.</div>
  }
  if (loading) return <FootballSpinner text="Cargando La Liguilla…" />
  if (!isFriendlyVisible(profile)) {
    return <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>Página no disponible.</div>
  }

  // ── No ha pagado todavía
  if (!profile?.payment_confirmed) {
    return (
      <PageWrap>
        <BackBar navigate={navigate} />
        <div style={{ maxWidth: '500px', margin: '20px auto', padding: '20px' }}>
          <div style={{
            background: 'var(--bg-secondary)', borderRadius: '14px', padding: '24px',
            textAlign: 'center', border: `1px solid ${LIGUILLA.borderSoft}`
          }}>
            <div style={{ fontSize: '13px', color: LIGUILLA.primary, fontWeight: '800', letterSpacing: '1.4px', textTransform: 'uppercase', marginBottom: '8px' }}>
              La Liguilla
            </div>
            <div style={{ fontSize: '18px', fontWeight: '700', marginBottom: '10px', color: 'var(--text-primary)' }}>
              Falta el pago
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.55' }}>
              Para participar en La Liguilla primero hay que tener pagada la porra real (20 €).
              Cuando hagas el bizum al admin y te confirme el pago, podrás apuntarte.
            </div>
          </div>
        </div>
      </PageWrap>
    )
  }

  // ── Deadline cerrado: La Liguilla terminó el periodo de inscripción/edición
  const deadlinePassed = new Date() >= LIGUILLA_DEADLINE

  // ── Opt-in: pagado pero no apuntado todavía
  // Si NO pasó el deadline → muestra pantalla de inscripción.
  // Si SÍ pasó el deadline → cae al render principal pero en MODO ESPECTADOR
  //   (ve clasificación + resultados, sin selectores ni save bar).
  if (!profile?.friendly_joined && !deadlinePassed) {
    return (
      <PageWrap>
        <BackBar navigate={navigate} />
        <OptInScreen onJoin={handleJoin} joining={joining} />
      </PageWrap>
    )
  }
  // Spectator mode = pagado + no apuntado + deadline ya pasó.
  const spectatorMode = !profile?.friendly_joined && deadlinePassed

  // ── Vista principal
  const now = new Date()
  return (
    <PageWrap>
      <BackBar navigate={navigate} />

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '16px' }}>
        {/* Banner spectator mode */}
        {spectatorMode && (
          <div style={{
            background: 'rgba(255,204,0,0.08)',
            border: `1px solid rgba(255,204,0,0.3)`,
            borderRadius: '10px', padding: '12px 14px', marginBottom: '14px',
            fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5'
          }}>
            <strong style={{ color: LIGUILLA.gold }}>Modo espectador.</strong> No te apuntaste a La Liguilla,
            pero puedes seguir la clasificación y los resultados de los 12 partidos en directo.
          </div>
        )}

        {/* Header */}
        <div style={{ marginBottom: '14px' }}>
          <div style={{
            fontSize: '12px', color: LIGUILLA.primary, fontWeight: '800',
            letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: '8px',
            display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px'
          }}>
            <span>La Liguilla · 12 partidos · 4-9 jun</span>
            <span style={{
              fontSize: '10px',
              color: deadlinePassed ? LIGUILLA.red : LIGUILLA.gold,
              fontWeight: '700',
              padding: '2px 8px',
              borderRadius: '12px',
              background: deadlinePassed ? 'rgba(231,76,60,0.12)' : 'rgba(255,204,0,0.12)'
            }}>
              {deadlinePassed ? 'Cerrada' : 'Cierra jue 20:30'}
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <h2 style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.4px' }}>
              {spectatorMode ? 'Partidos y resultados' : 'Tus predicciones'}
            </h2>
            <button
              onClick={() => navigate('/leaderboard?only=friendly')}
              style={{
                background: LIGUILLA.primaryDim, border: `1px solid ${LIGUILLA.borderSoft}`,
                color: LIGUILLA.primary, padding: '8px 14px', borderRadius: '8px',
                fontSize: '12px', fontWeight: '700', cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              Clasificación →
            </button>
          </div>
          {!spectatorMode && (
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {filledCount}/{matches.length} guardadas · top 3 recuperan los 20 €
            </div>
          )}
        </div>

        {/* Progress bar — solo si el user está inscrito */}
        {!spectatorMode && (
          <div style={{
            height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.05)',
            overflow: 'hidden', marginBottom: '14px'
          }}>
            <div style={{
              width: `${(filledCount / Math.max(matches.length, 1)) * 100}%`,
              height: '100%',
              background: `linear-gradient(90deg, ${LIGUILLA.primary}, ${LIGUILLA.gold})`,
              transition: 'width 0.4s ease'
            }} />
          </div>
        )}

        {/* Match cards */}
        {matches.map(m => {
          const matchDate = new Date(m.match_date)
          // Lock por (a) deadline global de La Liguilla, (b) kickoff del partido, (c) finished.
          const locked = deadlinePassed || matchDate <= now || m.status === 'finished'
          const pred = predictions[m.id] || {}
          const saved = savedPredictions[m.id]
          const editing = isEditing(m.id)
          const collapsed = !!saved && !editing && !locked

          return (
            <MatchCard
              key={m.id}
              match={m}
              pred={pred}
              saved={saved}
              locked={locked}
              collapsed={collapsed}
              onSetScore={(side, value) => setScore(m.id, side, value)}
              onEdit={() => startEditing(m.id)}
            />
          )
        })}

        {/* Sticky save bar */}
        {unsavedCount > 0 && !spectatorMode && (
          <div style={{
            position: 'sticky', bottom: '12px', marginTop: '20px',
            background: LIGUILLA.primary, borderRadius: '12px',
            padding: '14px 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            zIndex: 10
          }}>
            <div style={{ fontSize: '13px', color: '#fff', fontWeight: '600' }}>
              {unsavedCount} sin guardar
            </div>
            <button
              onClick={saveAll}
              disabled={saving}
              style={{
                padding: '10px 20px', borderRadius: '8px',
                background: '#fff', color: LIGUILLA.primary,
                border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
                fontSize: '13px', fontWeight: '800',
                letterSpacing: '0.5px', textTransform: 'uppercase'
              }}
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        )}

        <div style={{
          marginTop: '24px', padding: '14px',
          background: LIGUILLA.primaryDim,
          borderRadius: '10px', border: `1px solid ${LIGUILLA.borderSoft}`,
          fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.55', textAlign: 'center'
        }}>
          Los partidos se bloquean al pitido inicial. Top 3 al final de La Liguilla
          recuperan los 20 € de la inscripción.
        </div>

        {/* Predicciones de otros — solo tras el cierre, para no spoiler */}
        {deadlinePassed && (
          <OtherPredictionsViewer
            currentUserId={session.user.id}
            matches={matches}
          />
        )}
      </div>
    </PageWrap>
  )
}

// ─── Wrappers ──────────────────────────────────────────────────────────────

function PageWrap({ children }) {
  return <div style={{ minHeight: '100svh', background: 'var(--bg-primary)' }}>{children}</div>
}

function BackBar({ navigate }) {
  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 20,
      background: 'rgba(15,18,24,0.95)', backdropFilter: 'blur(8px)',
      padding: '12px 16px',
      borderBottom: '1px solid var(--border-light)'
    }}>
      <button
        onClick={() => navigate('/')}
        style={{
          padding: '8px 12px', borderRadius: '8px',
          background: 'transparent', border: 'none',
          color: 'var(--text-muted)', fontSize: '13px', fontWeight: '700',
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
        }}
      >
        ← Volver
      </button>
    </div>
  )
}

// ─── Opt-in ────────────────────────────────────────────────────────────────

function OptInScreen({ onJoin, joining }) {
  return (
    <div style={{ maxWidth: '500px', margin: '20px auto', padding: '20px' }}>
      <div style={{
        background: `linear-gradient(135deg, #1a2433, #0f1b2e)`,
        border: `1px solid ${LIGUILLA.borderSoft}`,
        borderRadius: '14px', padding: '28px 24px', marginBottom: '16px'
      }}>
        <div style={{ fontSize: '11px', color: LIGUILLA.primary, fontWeight: '800', letterSpacing: '1.6px', textTransform: 'uppercase', marginBottom: '6px' }}>
          La Liguilla · mini-torneo opcional
        </div>
        <div style={{ fontSize: '24px', fontWeight: '800', color: '#fff', lineHeight: '1.2', marginBottom: '14px' }}>
          Calienta motores con 12 amistosos antes del Mundial
        </div>
        <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.75)', lineHeight: '1.6' }}>
          Del jueves 4 al martes 9 de junio. Mismas reglas que la porra real:
          3 puntos por resultado exacto, 1 punto por acertar el signo.
        </div>
      </div>

      <div style={{
        background: 'var(--bg-secondary)', borderRadius: '12px',
        padding: '20px', marginBottom: '14px', border: '1px solid var(--border-light)'
      }}>
        <div style={{ fontSize: '11px', color: LIGUILLA.gold, fontWeight: '800', letterSpacing: '1.4px', textTransform: 'uppercase', marginBottom: '10px' }}>
          Premio
        </div>
        <div style={{ fontSize: '14px', color: 'var(--text-primary)', lineHeight: '1.6' }}>
          Los <strong style={{ color: LIGUILLA.gold }}>3 primeros</strong> recuperan
          los <strong style={{ color: LIGUILLA.gold }}>20 €</strong> de inscripción a la porra real.
        </div>
      </div>

      <button
        onClick={onJoin}
        disabled={joining}
        style={{
          width: '100%', padding: '16px',
          borderRadius: '12px', border: 'none',
          background: joining ? 'var(--bg-input)' : LIGUILLA.primary,
          color: '#fff', fontSize: '15px', fontWeight: '800',
          cursor: joining ? 'not-allowed' : 'pointer',
          letterSpacing: '0.6px', textTransform: 'uppercase',
          marginBottom: '10px'
        }}
      >
        {joining ? 'Apuntándote…' : 'Apuntarme a La Liguilla'}
      </button>

      <div style={{ fontSize: '11px', color: 'var(--text-dim)', textAlign: 'center', lineHeight: '1.5' }}>
        Opcional. Si no te apuntas sigues con la porra del Mundial normal.
      </div>
    </div>
  )
}

// ─── Match Card ────────────────────────────────────────────────────────────


function MatchCard({ match, pred, saved, locked, collapsed, onSetScore, onEdit }) {
  const matchDate = new Date(match.match_date)
  const dateStr = matchDate.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
  const timeStr = matchDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  const isLive = match.status === 'live'
  const isFinished = match.status === 'finished'

  // ── Collapsed: ya guardado, mostrar compacto con Editar
  if (collapsed && !isLive && !isFinished) {
    return (
      <div style={{
        background: 'var(--bg-secondary)',
        border: `1px solid ${LIGUILLA.borderSoft}`,
        borderRadius: '10px', padding: '12px 14px', marginBottom: '8px'
      }}>
        <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: '600', marginBottom: '8px', textAlign: 'center' }}>
          {dateStr} · {timeStr}{match.city ? ` · ${match.city}` : ''}
        </div>
        <table role="presentation" cellPadding="0" cellSpacing="0" border="0" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td width="40%" style={{ textAlign: 'right', verticalAlign: 'middle', paddingRight: '10px' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', marginRight: '6px' }}>{match.home_team?.name}</span>
                {match.home_team?.flag_url && <img src={match.home_team.flag_url} alt="" style={{ width: '20px', height: '14px', borderRadius: '2px', verticalAlign: 'middle' }} />}
              </td>
              <td width="20%" style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                <span style={{ fontSize: '20px', fontWeight: '800', color: LIGUILLA.gold, fontVariantNumeric: 'tabular-nums' }}>
                  {saved.home_score}-{saved.away_score}
                </span>
              </td>
              <td width="40%" style={{ textAlign: 'left', verticalAlign: 'middle', paddingLeft: '10px' }}>
                {match.away_team?.flag_url && <img src={match.away_team.flag_url} alt="" style={{ width: '20px', height: '14px', borderRadius: '2px', verticalAlign: 'middle' }} />}
                <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', marginLeft: '6px' }}>{match.away_team?.name}</span>
              </td>
            </tr>
          </tbody>
        </table>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '8px', gap: '8px' }}>
          <span style={{
            padding: '2px 10px', borderRadius: '4px', fontSize: '10px',
            background: LIGUILLA.primaryDim, color: LIGUILLA.primary, fontWeight: '700'
          }}>
            Guardado
          </span>
          <button onClick={onEdit} style={{
            padding: '2px 10px', background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--border-light)', borderRadius: '4px',
            color: 'var(--text-muted)', fontSize: '10px', fontWeight: '600',
            cursor: 'pointer', letterSpacing: '0.3px'
          }}>
            Editar
          </button>
        </div>
      </div>
    )
  }

  // ── Expanded: picker activo (o bloqueado / live / finished)
  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: `1px solid ${saved ? LIGUILLA.borderSoft : 'var(--border-light)'}`,
      borderRadius: '10px', padding: '12px 14px', marginBottom: '8px',
      opacity: locked && !saved ? 0.6 : 1,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <span style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: '600' }}>
          {dateStr} · {timeStr}{match.city ? ` · ${match.city}` : ''}
        </span>
        {isLive && (
          <span className="live-pulse" style={{
            fontSize: '10px', fontWeight: '800', color: LIGUILLA.red,
            background: 'rgba(226,75,74,0.15)', padding: '2px 8px', borderRadius: '20px'
          }}>● LIVE</span>
        )}
        {isFinished && (
          <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)' }}>FINAL</span>
        )}
      </div>

      <table role="presentation" cellPadding="0" cellSpacing="0" border="0" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: locked ? '0' : '10px' }}>
        <tbody>
          <tr>
            <td width="45%" style={{ textAlign: 'right', verticalAlign: 'middle', paddingRight: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', marginRight: '6px' }}>{match.home_team?.name}</span>
              {match.home_team?.flag_url && <img src={match.home_team.flag_url} alt="" style={{ width: '22px', height: '15px', borderRadius: '2px', verticalAlign: 'middle' }} />}
            </td>
            <td width="10%" style={{ textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
              {isFinished || isLive ? (
                <span style={{ fontSize: '18px', fontWeight: '800', color: LIGUILLA.gold }}>
                  {match.home_score ?? 0}-{match.away_score ?? 0}
                </span>
              ) : (
                <span style={{ fontSize: '13px', color: 'var(--text-dim)', fontWeight: '700' }}>vs</span>
              )}
            </td>
            <td width="45%" style={{ textAlign: 'left', verticalAlign: 'middle', paddingLeft: '8px' }}>
              {match.away_team?.flag_url && <img src={match.away_team.flag_url} alt="" style={{ width: '22px', height: '15px', borderRadius: '2px', verticalAlign: 'middle' }} />}
              <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', marginLeft: '6px' }}>{match.away_team?.name}</span>
            </td>
          </tr>
        </tbody>
      </table>

      {!locked && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <ScorePicker
            value={typeof pred.home_score === 'number' ? pred.home_score : null}
            onChange={v => onSetScore('home', v)}
            accent="green"
          />
          <ScorePicker
            value={typeof pred.away_score === 'number' ? pred.away_score : null}
            onChange={v => onSetScore('away', v)}
            accent="green"
          />
        </div>
      )}

      {locked && saved && (
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '8px', fontWeight: '600' }}>
          Tu predicción: {saved.home_score}-{saved.away_score}
        </div>
      )}
    </div>
  )
}

// ─── Viewer de predicciones de otros ─────────────────────────────────────
// Solo se muestra tras el cierre. Selector con todos los inscritos a La
// Liguilla; al elegir uno, fetch de sus 12 predicciones y lista compacta
// con el resultado real al lado si el partido ya terminó.
function OtherPredictionsViewer({ currentUserId, matches }) {
  const [people, setPeople] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [theirPreds, setTheirPreds] = useState({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, full_name, nickname')
      .eq('friendly_joined', true)
      .neq('id', currentUserId)
      .order('full_name')
      .then(({ data }) => setPeople(data || []))
  }, [currentUserId])

  async function load(uid) {
    if (!uid) { setTheirPreds({}); return }
    setLoading(true)
    const { data } = await supabase
      .from('predictions')
      .select('match_id, predicted_home, predicted_away, points_earned')
      .eq('user_id', uid)
      .in('match_id', matches.map(m => m.id))
    const map = {}
    ;(data || []).forEach(p => { map[p.match_id] = p })
    setTheirPreds(map)
    setLoading(false)
  }

  return (
    <div style={{
      marginTop: '20px', padding: '16px',
      background: 'var(--bg-secondary)', borderRadius: '12px',
      border: '1px solid var(--border-light)'
    }}>
      <div style={{
        fontSize: '11px', color: LIGUILLA.primary, fontWeight: '800',
        letterSpacing: '1.4px', textTransform: 'uppercase', marginBottom: '10px'
      }}>
        Ver predicciones de otros
      </div>
      <select
        value={selectedId}
        onChange={e => { setSelectedId(e.target.value); load(e.target.value) }}
        style={{
          width: '100%', padding: '10px 12px', borderRadius: '8px',
          border: '1px solid var(--border-light)', background: 'var(--bg-primary)',
          color: 'var(--text-primary)', fontSize: '13px', fontWeight: '600', outline: 'none',
          marginBottom: selectedId ? '12px' : '0'
        }}
      >
        <option value="">Selecciona participante…</option>
        {people.map(p => (
          <option key={p.id} value={p.id}>{p.nickname || p.full_name}</option>
        ))}
      </select>
      {loading && <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '12px' }}>Cargando…</div>}
      {!loading && selectedId && matches.map(m => {
        const p = theirPreds[m.id]
        const isFinished = m.status === 'finished'
        return (
          <div key={m.id} style={{
            padding: '8px 0', borderBottom: '1px solid var(--border-light)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px'
          }}>
            <span style={{ fontSize: '12px', color: 'var(--text-primary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {m.home_team?.name} – {m.away_team?.name}
            </span>
            {isFinished && (
              <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600 }}>
                Real: {m.home_score}-{m.away_score}
              </span>
            )}
            <span style={{
              fontSize: '13px', fontWeight: '800',
              color: p ? (p.points_earned === 3 ? 'var(--green)' : p.points_earned === 1 ? 'var(--gold)' : 'var(--text-primary)') : 'var(--text-dim)',
              minWidth: '50px', textAlign: 'right'
            }}>
              {p && p.predicted_home != null
                ? `${p.predicted_home}-${p.predicted_away}${isFinished ? ` (${p.points_earned || 0}pt)` : ''}`
                : '—'}
            </span>
          </div>
        )
      })}
    </div>
  )
}

