import { useState } from 'react'
import BracketResults from './BracketResults'
import OrdagosView from './OrdagosView'

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
          🎲 Ordagos
        </button>
      </div>

      {/* Cuadro Real */}
      {activeTab === 'bracket' && <BracketResults session={session} />}

      {/* Ordagos */}
      {activeTab === 'ordagos' && <OrdagosView session={session} />}
    </div>
  )
}
