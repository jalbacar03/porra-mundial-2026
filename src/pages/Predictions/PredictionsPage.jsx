import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCountdown, PREDICTIONS_DEADLINE, WORLD_CUP_START } from '../../hooks/useCountdown'
import GroupMatchPredictions from './BeforeWorldCup/GroupMatchPredictions'
import PreTournamentBets from './BeforeWorldCup/PreTournamentBets'
import DuringPlaceholder from './DuringWorldCup/DuringPlaceholder'
import BracketView from '../../components/bracket/BracketView'

export default function PredictionsPage({ session, demoMode }) {
  const navigate = useNavigate()
  const [activeBlock, setActiveBlock] = useState('before') // 'before' | 'during'
  const [activeTab, setActiveTab] = useState('matches')    // 'matches' | 'bets' | 'bracket'
  const realDeadline = useCountdown(PREDICTIONS_DEADLINE)
  const worldCupStart = useCountdown(WORLD_CUP_START)

  // In demo mode, pretend deadline has expired (tournament already started)
  const deadline = demoMode
    ? { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true }
    : realDeadline

  const isDuringAvailable = true // Unlocked for development

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', padding: '16px' }}>

      {/* Countdown deadline */}
      {demoMode ? (
        <div style={{
          background: 'linear-gradient(135deg, rgba(0,122,69,0.12), rgba(0,122,69,0.04))',
          border: '1px solid rgba(0,122,69,0.2)',
          borderRadius: '10px',
          padding: '14px 18px',
          marginBottom: '16px',
          textAlign: 'center',
          fontSize: '13px',
          color: '#4ade80',
          fontWeight: '500'
        }}>
          ⚽ Mundial en curso — Jornada 2 de fase de grupos. Tus predicciones ya estan registradas.
        </div>
      ) : !deadline.expired ? (
        <div style={{
          background: 'linear-gradient(135deg, rgba(255,204,0,0.08), rgba(255,204,0,0.03))',
          border: '1px solid rgba(255,204,0,0.15)',
          borderRadius: '10px',
          padding: '16px 18px',
          marginBottom: '16px',
          textAlign: 'center'
        }}>
          <div style={{
            fontSize: '10px',
            color: 'var(--gold)',
            textTransform: 'uppercase',
            letterSpacing: '1.2px',
            marginBottom: '8px',
            fontWeight: '600'
          }}>
            Tiempo restante para predicciones
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '12px',
            marginBottom: '10px'
          }}>
            {[
              { value: deadline.days, label: 'días' },
              { value: deadline.hours, label: 'horas' },
              { value: deadline.minutes, label: 'min' }
            ].map((unit, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize: '24px',
                  fontWeight: '700',
                  color: 'var(--gold)',
                  lineHeight: '1',
                  fontVariantNumeric: 'tabular-nums',
                  minWidth: '40px'
                }}>
                  {String(unit.value).padStart(2, '0')}
                </div>
                <div style={{
                  fontSize: '9px',
                  color: 'var(--text-dim)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginTop: '3px'
                }}>
                  {unit.label}
                </div>
              </div>
            ))}
          </div>

          <div style={{
            fontSize: '11px',
            color: 'var(--text-muted)',
            lineHeight: '1.5'
          }}>
            Todas las predicciones deben realizarse{' '}
            <span style={{ color: 'var(--gold)', fontWeight: '600' }}>48 horas antes</span>{' '}
            del inicio del Mundial
          </div>
        </div>
      ) : (
        <div style={{
          background: 'var(--red-bg)',
          border: '1px solid rgba(226,75,74,0.2)',
          borderRadius: '10px',
          padding: '14px 18px',
          marginBottom: '16px',
          textAlign: 'center',
          fontSize: '13px',
          color: 'var(--red)',
          fontWeight: '500'
        }}>
          🔒 El plazo para predicciones pre-torneo ha finalizado
        </div>
      )}

      {/* Quick access: normas */}
      <div style={{
        display: 'flex', gap: '8px', marginBottom: '12px'
      }}>
        <button
          onClick={() => navigate('/rules')}
          style={{
            flex: 1, padding: '8px 12px', borderRadius: '6px',
            border: '0.5px solid var(--border)', background: 'var(--bg-secondary)',
            color: 'var(--text-muted)', fontSize: '11px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
          }}
        >
          📋 ¿Cómo funciona? Ver normas
        </button>
      </div>

      {/* Main block selector: Antes / Durante */}
      <div style={{
        display: 'flex',
        gap: '0',
        marginBottom: '16px',
        borderRadius: '8px',
        overflow: 'hidden',
        border: '1px solid var(--border)'
      }}>
        <button
          onClick={() => setActiveBlock('before')}
          style={{
            flex: 1,
            padding: '12px 8px',
            border: 'none',
            background: activeBlock === 'before' ? 'var(--green)' : 'var(--bg-secondary)',
            color: activeBlock === 'before' ? '#fff' : 'var(--text-muted)',
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer',
            letterSpacing: '0.3px',
            textTransform: 'uppercase'
          }}
        >
          ⚡ Antes del Mundial
        </button>
        <button
          onClick={() => isDuringAvailable && setActiveBlock('during')}
          style={{
            flex: 1,
            padding: '12px 8px',
            border: 'none',
            borderLeft: '1px solid var(--border)',
            background: activeBlock === 'during' ? 'var(--green)' : 'var(--bg-secondary)',
            color: activeBlock === 'during'
              ? '#fff'
              : isDuringAvailable ? 'var(--text-muted)' : 'var(--text-dim)',
            fontSize: '12px',
            fontWeight: '600',
            cursor: isDuringAvailable ? 'pointer' : 'not-allowed',
            letterSpacing: '0.3px',
            textTransform: 'uppercase',
            opacity: isDuringAvailable ? 1 : 0.5,
            position: 'relative'
          }}
        >
          {!isDuringAvailable && (
            <span style={{ marginRight: '4px' }}>🔒</span>
          )}
          Durante el Mundial
        </button>
      </div>

      {/* Content based on active block */}
      {activeBlock === 'before' && (
        <>
          {/* Sub-tabs: Partidos / Predicciones */}
          <div className="group-tabs" style={{ marginBottom: '16px' }}>
            {[
              { key: 'matches', label: '⚽ Grupos' },
              { key: 'bracket', label: '🏆 Cuadro' },
              { key: 'bets', label: '🎯 Especiales' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  flex: 1,
                  padding: '8px 14px',
                  borderRadius: '20px',
                  border: 'none',
                  background: activeTab === tab.key ? 'var(--green)' : 'var(--bg-secondary)',
                  color: activeTab === tab.key ? '#fff' : 'var(--text-muted)',
                  fontSize: '12px',
                  fontWeight: activeTab === tab.key ? '600' : '400',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s ease'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === 'matches' && (
            <GroupMatchPredictions session={session} deadline={deadline} demoMode={demoMode} />
          )}
          {activeTab === 'bets' && (
            <PreTournamentBets session={session} deadline={deadline} demoMode={demoMode} />
          )}
          {activeTab === 'bracket' && (
            <BracketView session={session} />
          )}
        </>
      )}

      {activeBlock === 'during' && (
        <DuringPlaceholder session={session} />
      )}
    </div>
  )
}
