import { useState } from 'react'
import { useCountdown, PREDICTIONS_DEADLINE, WORLD_CUP_START } from '../../hooks/useCountdown'
import GroupMatchPredictions from './BeforeWorldCup/GroupMatchPredictions'
import PreTournamentBets from './BeforeWorldCup/PreTournamentBets'
import DuringPlaceholder from './DuringWorldCup/DuringPlaceholder'
import BracketView from '../../components/bracket/BracketView'

export default function PredictionsPage({ session }) {
  const [activeBlock, setActiveBlock] = useState('before') // 'before' | 'during'
  const [activeTab, setActiveTab] = useState('matches')    // 'matches' | 'bets' | 'bracket'
  const deadline = useCountdown(PREDICTIONS_DEADLINE)
  const worldCupStart = useCountdown(WORLD_CUP_START)

  const isDuringAvailable = true // Unlocked for development

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', padding: '16px' }}>

      {/* Countdown deadline */}
      {!deadline.expired && (
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
      )}

      {deadline.expired && (
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
          {/* Sub-tabs: Partidos / Apuestas */}
          <div style={{
            display: 'flex',
            gap: '4px',
            marginBottom: '16px',
            padding: '3px',
            background: 'var(--bg-input)',
            borderRadius: '6px'
          }}>
            <button
              onClick={() => setActiveTab('matches')}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '4px',
                border: 'none',
                background: activeTab === 'matches' ? 'var(--bg-secondary)' : 'transparent',
                color: activeTab === 'matches' ? 'var(--text-primary)' : 'var(--text-muted)',
                fontSize: '12px',
                fontWeight: activeTab === 'matches' ? '600' : '400',
                cursor: 'pointer'
              }}
            >
              ⚽ Grupos
            </button>
            <button
              onClick={() => setActiveTab('bracket')}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '4px',
                border: 'none',
                background: activeTab === 'bracket' ? 'var(--bg-secondary)' : 'transparent',
                color: activeTab === 'bracket' ? 'var(--text-primary)' : 'var(--text-muted)',
                fontSize: '12px',
                fontWeight: activeTab === 'bracket' ? '600' : '400',
                cursor: 'pointer'
              }}
            >
              🏆 Cuadro
            </button>
            <button
              onClick={() => setActiveTab('bets')}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '4px',
                border: 'none',
                background: activeTab === 'bets' ? 'var(--bg-secondary)' : 'transparent',
                color: activeTab === 'bets' ? 'var(--text-primary)' : 'var(--text-muted)',
                fontSize: '12px',
                fontWeight: activeTab === 'bets' ? '600' : '400',
                cursor: 'pointer'
              }}
            >
              🎯 Especiales
            </button>
          </div>

          {/* Tab content */}
          {activeTab === 'matches' && (
            <GroupMatchPredictions session={session} deadline={deadline} />
          )}
          {activeTab === 'bets' && (
            <PreTournamentBets session={session} deadline={deadline} />
          )}
          {activeTab === 'bracket' && (
            <BracketView session={session} />
          )}
        </>
      )}

      {activeBlock === 'during' && (
        <DuringPlaceholder />
      )}
    </div>
  )
}
