import { useState } from 'react'
import BracketResults from './BracketResults'

export default function DuringPlaceholder({ session }) {
  const [activeTab, setActiveTab] = useState('bracket') // 'bracket' | 'ordagos'

  return (
    <div>
      {/* Sub-tabs */}
      <div style={{
        display: 'flex',
        gap: '4px',
        marginBottom: '16px',
        padding: '3px',
        background: 'var(--bg-input)',
        borderRadius: '6px'
      }}>
        <button
          onClick={() => setActiveTab('bracket')}
          style={{
            flex: 1, padding: '8px 12px', borderRadius: '4px', border: 'none',
            background: activeTab === 'bracket' ? 'var(--bg-secondary)' : 'transparent',
            color: activeTab === 'bracket' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontSize: '12px', fontWeight: activeTab === 'bracket' ? '600' : '400', cursor: 'pointer'
          }}
        >
          🏆 Cuadro Real
        </button>
        <button
          onClick={() => setActiveTab('ordagos')}
          style={{
            flex: 1, padding: '8px 12px', borderRadius: '4px', border: 'none',
            background: activeTab === 'ordagos' ? 'var(--bg-secondary)' : 'transparent',
            color: activeTab === 'ordagos' ? 'var(--gold)' : 'var(--text-muted)',
            fontSize: '12px', fontWeight: activeTab === 'ordagos' ? '600' : '400', cursor: 'pointer'
          }}
        >
          🎲 Órdagos
        </button>
      </div>

      {/* Cuadro Real */}
      {activeTab === 'bracket' && <BracketResults session={session} />}

      {/* Órdagos */}
      {activeTab === 'ordagos' && (
        <div>
          <div style={{
            background: 'linear-gradient(135deg, rgba(255,204,0,0.08), rgba(255,204,0,0.03))',
            borderRadius: '8px',
            padding: '16px',
            border: '0.5px solid rgba(255,204,0,0.15)',
            marginBottom: '12px'
          }}>
            <div style={{
              fontSize: '14px', fontWeight: '600', color: 'var(--gold)', marginBottom: '8px'
            }}>
              Órdagos del Mundial
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.6', margin: 0 }}>
              10 órdagos especiales durante todo el torneo. Cada uno con un peso diferente.
              ¡Arriésgate y suma puntos extra!
            </p>
          </div>

          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} style={{
              background: 'var(--bg-secondary)',
              borderRadius: '6px',
              padding: '12px 14px',
              marginBottom: '6px',
              border: '0.5px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  background: i === 0 ? 'var(--gold)' : 'var(--bg-input)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '12px', fontWeight: '700',
                  color: i === 0 ? '#1a1d26' : 'var(--text-dim)'
                }}>
                  {i + 1}
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)' }}>
                    Órdago #{i + 1}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '1px' }}>
                    Por definir
                  </div>
                </div>
              </div>
              <span style={{
                fontSize: '10px', padding: '3px 8px', borderRadius: '4px',
                background: i === 0 ? 'rgba(255,204,0,0.1)' : 'var(--bg-input)',
                color: i === 0 ? 'var(--gold)' : 'var(--text-dim)'
              }}>
                {i === 0 ? 'Próximo' : 'Pendiente'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
