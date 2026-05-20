import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { FootballSpinner } from '../components/Skeleton'
import { PREDICTIONS_DEADLINE } from '../hooks/useCountdown'

const SCORE_OPTIONS = [0, 1, 2, 3, 4, 5]

export default function MatchDetail({ session }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const matchId = parseInt(id)
  const userId = session.user.id

  const [match, setMatch] = useState(null)
  const [pred, setPred] = useState({ home: null, away: null })
  const [savedPred, setSavedPred] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => { fetchData() }, [matchId])

  async function fetchData() {
    setLoading(true)
    const [mRes, pRes] = await Promise.all([
      supabase
        .from('matches')
        .select('*, home_team:teams!matches_home_team_id_fkey(id,name,flag_url), away_team:teams!matches_away_team_id_fkey(id,name,flag_url)')
        .eq('id', matchId)
        .single(),
      supabase
        .from('predictions')
        .select('*')
        .eq('user_id', userId)
        .eq('match_id', matchId)
        .maybeSingle()
    ])

    if (mRes.data) setMatch(mRes.data)
    if (pRes.data) {
      setSavedPred(pRes.data)
      setPred({ home: pRes.data.predicted_home, away: pRes.data.predicted_away })
    }
    setLoading(false)
  }

  function selectScore(team, value) {
    setPred(p => ({ ...p, [team]: value }))
  }

  // Compute potential points for summary
  const basePoints = pred.home != null && pred.away != null ? 3 : 0

  async function handleSave() {
    if (pred.home == null || pred.away == null) {
      setError('Pon los dos goles')
      return
    }
    setSaving(true)
    setError(null)

    const { error: pErr } = await supabase
      .from('predictions')
      .upsert({
        user_id: userId,
        match_id: matchId,
        predicted_home: pred.home,
        predicted_away: pred.away
      }, { onConflict: 'user_id,match_id' })

    if (pErr) {
      setError(pErr.message)
      setSaving(false)
      return
    }

    setSaving(false)
    setSavedPred({ predicted_home: pred.home, predicted_away: pred.away })
    // Brief visual feedback then back
    setTimeout(() => navigate(-1), 300)
  }

  if (loading) {
    return <FootballSpinner text="Cargando partido…" />
  }

  if (!match) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>❌</div>
        <div style={{ color: 'var(--text-muted)' }}>Partido no encontrado.</div>
        <button onClick={() => navigate('/predictions')} style={{
          marginTop: '14px', padding: '10px 18px', borderRadius: '8px',
          background: 'var(--green)', color: '#fff', border: 'none', cursor: 'pointer'
        }}>Volver</button>
      </div>
    )
  }

  const matchDate = new Date(match.match_date)
  const today = new Date()
  const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1)
  const sameDay = (a, b) => a.toDateString() === b.toDateString()
  const dayLabel = sameDay(matchDate, today) ? 'Hoy'
                 : sameDay(matchDate, tomorrow) ? 'Mañana'
                 : matchDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '')
  const timeLabel = matchDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })

  const stageLabels = {
    'group': 'Fase de grupos',
    'Round of 32': 'Dieciseisavos', 'Round of 16': 'Octavos',
    'Quarter-finals': 'Cuartos', 'Semi-finals': 'Semifinales', 'Final': 'Final',
    'quarter_final': 'Cuartos', 'semi_final': 'Semifinales', 'final': 'Final'
  }
  const stageLabel = stageLabels[match.stage] || 'Partido'
  const matchdayLabel = match.matchday ? ` · J${match.matchday}` : ''

  // Lock criteria:
  //   - For group-stage matches: global deadline (9 jun 23:59h Spain)
  //   - For ANY match: locked once it has started or finished
  // The DB enforces these too via RLS — frontend lock here is purely UX.
  const now = new Date()
  const isGroup = match.stage === 'group'
  const groupDeadlineExpired = isGroup && now >= PREDICTIONS_DEADLINE
  const matchStarted = match.status === 'finished' || match.status === 'live' || new Date(match.match_date) <= now
  const isLocked = matchStarted || groupDeadlineExpired
  const lockReason = matchStarted
    ? (match.status === 'finished' ? '🔒 Partido finalizado' : '🔴 Partido en curso')
    : groupDeadlineExpired
      ? '🔒 Plazo cerrado (9 jun 23:59h)'
      : ''

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', padding: '14px 16px 24px' }}>

      {/* Header with back */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <button
          onClick={() => navigate(-1)}
          aria-label="Volver"
          style={{
            width: '36px', height: '36px', borderRadius: '50%',
            background: 'var(--bg-secondary)', border: 'none',
            color: 'var(--text-primary)', fontSize: '18px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}
        >←</button>
        <div style={{ flex: 1, textAlign: 'center', overflow: 'hidden' }}>
          <div style={{
            fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
          }}>
            {match.home_team?.name} · {match.away_team?.name}
          </div>
        </div>
        <div style={{ width: '36px' }} />
      </div>

      {/* Match meta strip */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: '10px',
        marginBottom: '16px'
      }}>
        <span style={{
          fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '1.2px'
        }}>
          {stageLabel}{matchdayLabel}
        </span>
        <span style={{
          fontSize: '11px', fontWeight: '700', color: 'var(--gold)',
          textTransform: 'uppercase', letterSpacing: '0.8px'
        }}>
          {dayLabel} · {timeLabel}
        </span>
      </div>

      {/* Score display + selector */}
      <div style={{
        background: 'var(--bg-secondary)', borderRadius: '12px',
        padding: '20px 16px', marginBottom: '14px'
      }}>
        {/* Score header showing both teams + current scores */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '10px',
          alignItems: 'center', marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
            {match.home_team?.flag_url && (
              <img src={match.home_team.flag_url} alt="" style={{ width: '36px', height: '24px', borderRadius: '3px', objectFit: 'cover' }} />
            )}
            <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)', textAlign: 'center', lineHeight: '1.2' }}>
              {match.home_team?.name}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ScoreBox value={pred.home} active />
            <span style={{ fontSize: '20px', color: 'var(--text-dim)' }}>-</span>
            <ScoreBox value={pred.away} active />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
            {match.away_team?.flag_url && (
              <img src={match.away_team.flag_url} alt="" style={{ width: '36px', height: '24px', borderRadius: '3px', objectFit: 'cover' }} />
            )}
            <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)', textAlign: 'center', lineHeight: '1.2' }}>
              {match.away_team?.name}
            </span>
          </div>
        </div>

        {/* Score selector buttons — one row per team */}
        <ScoreRow
          label={match.home_team?.name}
          flag={match.home_team?.flag_url}
          value={pred.home}
          onChange={v => !isLocked && selectScore('home', v)}
          disabled={isLocked}
        />
        <div style={{ height: '8px' }} />
        <ScoreRow
          label={match.away_team?.name}
          flag={match.away_team?.flag_url}
          value={pred.away}
          onChange={v => !isLocked && selectScore('away', v)}
          disabled={isLocked}
        />
      </div>

      {/* Summary */}
      {pred.home != null && pred.away != null && (
        <div style={{
          background: 'var(--bg-secondary)', borderRadius: '12px',
          padding: '14px 16px', marginBottom: '16px'
        }}>
          <div style={{
            fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: '10px'
          }}>Resumen</div>
          <SummaryRow label="Predicción base" value="+3 si exacto · +1 si signo" />
          <div style={{ height: '1px', background: 'var(--border-light)', margin: '8px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>Total potencial</span>
            <span style={{ fontSize: '20px', fontWeight: '800', color: 'var(--gold)' }}>
              +{basePoints} pts
            </span>
          </div>
        </div>
      )}

      {error && (
        <div style={{
          padding: '10px 14px', borderRadius: '8px',
          background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.25)',
          color: '#e74c3c', fontSize: '13px', marginBottom: '12px', textAlign: 'center'
        }}>{error}</div>
      )}

      {/* Save button */}
      {!isLocked ? (
        <button
          onClick={handleSave}
          disabled={saving || pred.home == null || pred.away == null}
          style={{
            width: '100%', padding: '14px',
            borderRadius: '10px', border: 'none',
            background: pred.home != null && pred.away != null ? 'var(--green)' : 'var(--bg-secondary)',
            color: pred.home != null && pred.away != null ? '#fff' : 'var(--text-dim)',
            fontSize: '14px', fontWeight: '700',
            letterSpacing: '0.3px',
            cursor: saving || pred.home == null ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1
          }}
        >
          {saving ? 'Guardando…' : savedPred ? 'Actualizar predicción' : 'Guardar predicción'}
        </button>
      ) : (
        <div style={{
          padding: '14px', borderRadius: '10px', textAlign: 'center',
          background: 'rgba(255,255,255,0.04)',
          fontSize: '12px', color: 'var(--text-muted)'
        }}>
          {lockReason}
          {savedPred && ` · Tu predicción: ${savedPred.predicted_home}-${savedPred.predicted_away}`}
        </div>
      )}
    </div>
  )
}

function ScoreBox({ value, active }) {
  return (
    <div style={{
      width: '46px', height: '46px', borderRadius: '8px',
      background: 'var(--bg-input)',
      border: active ? '2px solid var(--gold)' : '1px solid var(--border)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '22px', fontWeight: '800',
      color: value != null ? 'var(--text-primary)' : 'var(--text-dim)'
    }}>
      {value != null ? value : '·'}
    </div>
  )
}

function ScoreRow({ label, flag, value, onChange, disabled }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', paddingLeft: '4px' }}>
        {flag && <img src={flag} alt="" style={{ width: '16px', height: '11px', borderRadius: '2px', objectFit: 'cover' }} />}
        <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)' }}>{label}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '5px' }}>
        {SCORE_OPTIONS.map(n => {
          const isLast = n === 5
          const isSel = value === n
          return (
            <button
              key={n}
              onClick={() => onChange(n)}
              disabled={disabled}
              style={{
                padding: '12px 0', borderRadius: '8px', border: 'none',
                background: isSel ? 'var(--green)' : 'var(--bg-input)',
                color: isSel ? '#fff' : 'var(--text-primary)',
                fontSize: '15px', fontWeight: '700',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.5 : 1,
                transition: 'background 0.15s ease'
              }}
            >
              {isLast ? '5+' : n}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function SummaryRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '4px 0' }}>
      <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--gold)' }}>{value}</span>
    </div>
  )
}
