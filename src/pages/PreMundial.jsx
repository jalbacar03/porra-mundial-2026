import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { FootballSpinner } from '../components/Skeleton'
import { FRIENDLY_TOURNAMENT_ENABLED, isFriendlyVisible } from '../config/featureFlags'

/**
 * Mini-torneo Pre-Mundial — 12 amistosos (4-9 jun 2026) antes del Mundial.
 *
 * Mecánica: idéntica al Mundial (3 pts exacto, 1 pt signo). Opt-in opcional
 * (profiles.friendly_joined). Premio: top 3 entrada gratis al Mundial real.
 *
 * Visible solo si:
 *   - VITE_FRIENDLY_TOURNAMENT_ENABLED=true (env var Vercel)
 *   - user.has_paid = true
 *   - user.friendly_joined = true (después de aceptar el opt-in)
 */
export default function PreMundial({ session }) {
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [matches, setMatches] = useState([])
  const [predictions, setPredictions] = useState({}) // matchId → {predicted_home, predicted_away, points_earned}
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const debounceTimers = useRef({})

  useEffect(() => {
    if (!FRIENDLY_TOURNAMENT_ENABLED) return
    fetchData()
    return () => Object.values(debounceTimers.current).forEach(clearTimeout)
  }, [])

  async function fetchData() {
    const [profRes, mRes, pRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, nickname, has_paid, friendly_joined, is_admin').eq('id', session.user.id).single(),
      supabase.from('matches')
        .select('*, home_team:teams!matches_home_team_id_fkey(id,name,flag_url,code), away_team:teams!matches_away_team_id_fkey(id,name,flag_url,code)')
        .eq('stage', 'friendly')
        .order('match_date', { ascending: true }),
      supabase.from('predictions').select('*').eq('user_id', session.user.id),
    ])
    if (profRes.data) setProfile(profRes.data)
    if (mRes.data) setMatches(mRes.data)
    if (pRes.data) {
      const map = {}
      pRes.data.forEach(p => { map[p.match_id] = p })
      setPredictions(map)
    }
    setLoading(false)
  }

  async function handleJoin() {
    setJoining(true)
    const { error } = await supabase
      .from('profiles')
      .update({ friendly_joined: true })
      .eq('id', session.user.id)
    if (!error) setProfile(p => ({ ...p, friendly_joined: true }))
    setJoining(false)
  }

  async function savePrediction(matchId, home, away) {
    // Optimistic update
    setPredictions(prev => ({
      ...prev,
      [matchId]: { ...prev[matchId], predicted_home: home, predicted_away: away },
    }))
    if (debounceTimers.current[matchId]) clearTimeout(debounceTimers.current[matchId])
    debounceTimers.current[matchId] = setTimeout(async () => {
      await supabase.from('predictions').upsert(
        {
          user_id: session.user.id,
          match_id: matchId,
          predicted_home: home,
          predicted_away: away,
        },
        { onConflict: 'user_id,match_id' }
      )
    }, 400)
  }

  const filledCount = useMemo(
    () => Object.values(predictions).filter(p => {
      if (p.predicted_home == null || p.predicted_away == null) return false
      return matches.some(m => m.id === p.match_id)
    }).length,
    [predictions, matches]
  )

  // ── Guard: feature flag off → 404
  if (!FRIENDLY_TOURNAMENT_ENABLED) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
        Página no disponible.
      </div>
    )
  }

  if (loading) return <FootballSpinner text="Cargando Pre-Mundial…" />

  // ── Guard: admin-only durante la fase de prueba
  if (!isFriendlyVisible(profile)) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
        Página no disponible.
      </div>
    )
  }

  // ── Guard: no pagado → mensaje
  if (!profile?.has_paid) {
    return (
      <div style={{ maxWidth: '500px', margin: '40px auto', padding: '20px' }}>
        <div style={{
          background: 'var(--bg-secondary)', borderRadius: '14px', padding: '24px',
          textAlign: 'center', border: '1px solid var(--border-light)'
        }}>
          <div style={{ fontSize: '13px', color: 'var(--gold)', fontWeight: '800', letterSpacing: '1.4px', textTransform: 'uppercase', marginBottom: '8px' }}>
            Pre-Mundial
          </div>
          <div style={{ fontSize: '18px', fontWeight: '700', marginBottom: '10px', color: 'var(--text-primary)' }}>
            Solo participantes admitidos
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
            Para participar en el mini-torneo Pre-Mundial primero tienes que estar
            admitido en la porra real. Avisa a Javi.
          </div>
        </div>
      </div>
    )
  }

  // ── Opt-in screen: el user pagó pero aún no se inscribió
  if (!profile?.friendly_joined) {
    return <OptInScreen onJoin={handleJoin} joining={joining} />
  }

  // ── Vista principal: lista de partidos para predecir
  const now = new Date()
  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '16px', minHeight: '100svh' }}>

      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '12px', color: 'var(--gold)', fontWeight: '800', letterSpacing: '1.4px', textTransform: 'uppercase', marginBottom: '4px' }}>
          Pre-Mundial · 12 partidos
        </div>
        <h2 style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.4px' }}>
          Tus predicciones
        </h2>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
          {filledCount}/{matches.length} predichos · top 3 ganan entrada gratis al Mundial
        </div>
      </div>

      {/* Progress bar */}
      <div style={{
        height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.05)',
        overflow: 'hidden', marginBottom: '20px'
      }}>
        <div style={{
          width: `${(filledCount / Math.max(matches.length, 1)) * 100}%`,
          height: '100%',
          background: 'linear-gradient(90deg, var(--green), var(--gold))',
          transition: 'width 0.4s ease'
        }} />
      </div>

      {/* Match list */}
      {matches.map(m => {
        const matchDate = new Date(m.match_date)
        const locked = matchDate <= now || m.status !== 'scheduled'
        const pred = predictions[m.id] || {}
        return (
          <MatchCard
            key={m.id}
            match={m}
            pred={pred}
            locked={locked}
            onSave={(h, a) => savePrediction(m.id, h, a)}
          />
        )
      })}

      <div style={{
        marginTop: '24px', padding: '14px',
        background: 'rgba(255,204,0,0.06)',
        borderRadius: '10px', border: '1px solid rgba(255,204,0,0.15)',
        fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5', textAlign: 'center'
      }}>
        Los partidos se bloquean al pitido inicial. Top 3 al final del mini-torneo
        recuperan los 20 € de la porra. Suerte.
      </div>

    </div>
  )
}

function OptInScreen({ onJoin, joining }) {
  return (
    <div style={{ maxWidth: '500px', margin: '40px auto', padding: '20px' }}>
      <div style={{
        background: 'linear-gradient(135deg, #00392a, #00643d)',
        borderRadius: '14px', padding: '28px 24px', marginBottom: '16px'
      }}>
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', fontWeight: '800', letterSpacing: '1.6px', textTransform: 'uppercase', marginBottom: '6px' }}>
          Mini-torneo opcional
        </div>
        <div style={{ fontSize: '24px', fontWeight: '800', color: '#fff', lineHeight: '1.2', marginBottom: '14px' }}>
          Calienta motores con 12 amistosos pre-Mundial
        </div>
        <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.85)', lineHeight: '1.6' }}>
          Del jueves 4 al martes 9 de junio. Las mismas reglas que la porra real:
          3 pts por resultado exacto, 1 pt por acertar el signo.
        </div>
      </div>

      <div style={{
        background: 'var(--bg-secondary)', borderRadius: '12px',
        padding: '20px', marginBottom: '14px', border: '1px solid var(--border-light)'
      }}>
        <div style={{ fontSize: '11px', color: 'var(--gold)', fontWeight: '800', letterSpacing: '1.4px', textTransform: 'uppercase', marginBottom: '10px' }}>
          Premio
        </div>
        <div style={{ fontSize: '14px', color: 'var(--text-primary)', lineHeight: '1.6' }}>
          Los <strong style={{ color: 'var(--gold)' }}>3 primeros</strong> del mini-torneo recuperan
          los <strong style={{ color: 'var(--gold)' }}>20 €</strong> de inscripción a la porra real.
        </div>
      </div>

      <button
        onClick={onJoin}
        disabled={joining}
        style={{
          width: '100%', padding: '16px',
          borderRadius: '12px', border: 'none',
          background: joining ? 'var(--bg-input)' : 'var(--green)',
          color: '#fff', fontSize: '15px', fontWeight: '800',
          cursor: joining ? 'not-allowed' : 'pointer',
          letterSpacing: '0.6px', textTransform: 'uppercase',
          marginBottom: '10px',
          transition: 'background 0.15s ease'
        }}
      >
        {joining ? 'Apuntándote…' : 'Apuntarme al Pre-Mundial'}
      </button>

      <div style={{ fontSize: '11px', color: 'var(--text-dim)', textAlign: 'center', lineHeight: '1.5' }}>
        Es totalmente opcional. Si no te apuntas no pasa nada, sigues con la porra real normal.
      </div>
    </div>
  )
}

const SCORE_OPTIONS = [0, 1, 2, 3, 4, 5]

function MatchCard({ match, pred, locked, onSave }) {
  const matchDate = new Date(match.match_date)
  const dateStr = matchDate.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
  const timeStr = matchDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  const isLive = match.status === 'live'
  const isFinished = match.status === 'finished'

  const homeScore = pred.predicted_home
  const awayScore = pred.predicted_away
  const filled = homeScore != null && awayScore != null

  return (
    <div style={{
      background: 'var(--bg-secondary)', borderRadius: '12px',
      padding: '14px 16px', marginBottom: '10px',
      border: filled ? '1px solid rgba(0,144,81,0.3)' : '1px solid var(--border-light)',
      opacity: locked && !filled ? 0.6 : 1,
    }}>
      {/* Top row: fecha + status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: '600' }}>
          {dateStr} · {timeStr}{match.city ? ` · ${match.city}` : ''}
        </span>
        {isLive && (
          <span className="live-pulse" style={{
            fontSize: '10px', fontWeight: '800', color: 'var(--red)',
            background: 'rgba(226,75,74,0.15)', padding: '2px 8px', borderRadius: '20px'
          }}>● LIVE</span>
        )}
        {isFinished && (
          <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)' }}>FINAL</span>
        )}
      </div>

      {/* Teams + score selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: locked ? '0' : '10px' }}>
        <div style={{ flex: 1, textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
          <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>{match.home_team?.name}</span>
          {match.home_team?.flag_url && <img src={match.home_team.flag_url} alt="" style={{ width: '24px', height: '16px', borderRadius: '2px' }} />}
        </div>

        {isFinished || isLive ? (
          <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--gold)', whiteSpace: 'nowrap', padding: '0 8px' }}>
            {match.home_score ?? 0} - {match.away_score ?? 0}
          </div>
        ) : (
          <div style={{ fontSize: '14px', color: 'var(--text-dim)', fontWeight: '700' }}>vs</div>
        )}

        <div style={{ flex: 1, textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {match.away_team?.flag_url && <img src={match.away_team.flag_url} alt="" style={{ width: '24px', height: '16px', borderRadius: '2px' }} />}
          <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>{match.away_team?.name}</span>
        </div>
      </div>

      {/* Score selectors */}
      {!locked && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
          <ScoreSelector value={homeScore} onChange={v => onSave(v, awayScore ?? 0)} />
          <span style={{ fontSize: '14px', color: 'var(--text-dim)', fontWeight: '700' }}>-</span>
          <ScoreSelector value={awayScore} onChange={v => onSave(homeScore ?? 0, v)} />
        </div>
      )}

      {/* User's prediction shown post-lock */}
      {locked && filled && (
        <div style={{
          fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '8px',
          fontWeight: '600'
        }}>
          Tu predicción: {homeScore}-{awayScore}
          {isFinished && pred.points_earned > 0 && (
            <span style={{ color: pred.points_earned === 3 ? 'var(--green)' : 'var(--gold)', marginLeft: '8px' }}>
              · +{pred.points_earned} pts
            </span>
          )}
          {isFinished && (pred.points_earned ?? 0) === 0 && (
            <span style={{ color: 'var(--red)', marginLeft: '8px' }}>· 0 pts</span>
          )}
        </div>
      )}

    </div>
  )
}

function ScoreSelector({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      {SCORE_OPTIONS.map(n => (
        <button
          key={n}
          onClick={() => onChange(n)}
          style={{
            width: '34px', height: '34px',
            borderRadius: '8px',
            border: 'none', cursor: 'pointer',
            background: value === n ? 'var(--green)' : 'var(--bg-input)',
            color: value === n ? '#fff' : 'var(--text-muted)',
            fontSize: '14px', fontWeight: '700',
            transition: 'all 0.12s ease',
          }}
        >
          {n}
        </button>
      ))}
    </div>
  )
}
